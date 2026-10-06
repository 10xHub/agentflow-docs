#!/usr/bin/env python3
"""Verify that the docs describe an API that actually exists.

Three drift bugs shipped before this check existed: a documented `run()` eval
protocol that was never implemented, a `generate(thread_id)` signature that was
really `async generate_name(messages)`, and a `GET /v1/store/memories` route
that was really `POST /v1/store/memories/list`. All three were invisible because
nothing compared prose against the packages users install.

This script does that comparison against the *published* packages, which is the
version readers actually have:

  pip install 10xscale-agentflow 10xscale-agentflow-cli
  python3 scripts/verify_api_reference.py

Checks:
  1. Every `from agentflow... import X` line in any Python code fence under
     docs/ resolves in the installed core package.
  2. Every `METHOD /path` heading in docs/reference/rest-api/ matches a route
     registered by the installed CLI package.
  3. Every `agentflow <command>` documented in the CLI reference exists.

Exit code 1 on any mismatch. Missing packages are reported as skips, not
failures, so the script stays usable in a docs-only checkout.
"""

from __future__ import annotations

import ast
import importlib
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

PY_FENCE = re.compile(r"```python\n(.*?)```", re.DOTALL)
# "## POST /v1/store/memories/`{memory_id}`" -> ("POST", "/v1/store/memories/{memory_id}")
REST_HEADING = re.compile(
    r"^#{2,3}\s+(GET|POST|PUT|PATCH|DELETE|WS)\s+(\S+)", re.MULTILINE
)
ROUTE_DECORATOR = re.compile(
    r"@router\.(get|post|put|patch|delete|websocket)\(\s*\n?\s*[\"']([^\"']+)[\"']"
)


@dataclass
class Report:
    failures: list[str] = field(default_factory=list)
    skips: list[str] = field(default_factory=list)
    checked: int = 0

    def fail(self, message: str) -> None:
        self.failures.append(message)

    def skip(self, message: str) -> None:
        self.skips.append(message)


def iter_docs() -> list[Path]:
    return sorted(p for p in DOCS.rglob("*.md*") if p.is_file())


def module_available(name: str) -> bool:
    try:
        importlib.import_module(name)
    except Exception:
        return False
    return True


# ---------------------------------------------------------------- imports ----


def collect_imports(text: str) -> set[tuple[str, tuple[str, ...]]]:
    """Return {(module, (name, ...))} for agentflow imports inside python fences."""
    found: set[tuple[str, tuple[str, ...]]] = set()
    for fence in PY_FENCE.findall(text):
        # Docs snippets are frequently partial; parse line by line so one
        # incomplete line does not discard the whole fence.
        for line in fence.splitlines():
            stripped = line.strip()
            if not stripped.startswith("from agentflow"):
                continue
            if stripped.endswith("("):  # multi-line import, skip the tail
                continue
            try:
                node = ast.parse(stripped).body[0]
            except SyntaxError:
                continue
            if not isinstance(node, ast.ImportFrom) or node.module is None:
                continue
            names = tuple(alias.name for alias in node.names)
            found.add((node.module, names))
    return found


def check_imports(report: Report) -> None:
    if not module_available("agentflow"):
        report.skip("agentflow not installed — skipped import checks")
        return

    imports: dict[tuple[str, tuple[str, ...]], list[str]] = {}
    for path in iter_docs():
        rel = path.relative_to(ROOT).as_posix()
        for entry in collect_imports(path.read_text(encoding="utf8")):
            imports.setdefault(entry, []).append(rel)

    for (module, names), files in sorted(imports.items()):
        report.checked += 1
        try:
            mod = importlib.import_module(module)
        except Exception as exc:  # noqa: BLE001 - message is the point
            report.fail(f"{files[0]}: cannot import module `{module}` ({exc.__class__.__name__})")
            continue
        for name in names:
            if name == "*":
                continue
            if not hasattr(mod, name):
                report.fail(f"{files[0]}: `{module}` has no attribute `{name}`")


# ------------------------------------------------------------------ routes ----


def installed_routes() -> set[tuple[str, str]] | None:
    try:
        import agentflow_cli  # noqa: F401
    except Exception:
        return None

    package_dir = Path(importlib.import_module("agentflow_cli").__file__).parent
    routers = package_dir / "src" / "app" / "routers"
    if not routers.is_dir():
        return None

    routes: set[tuple[str, str]] = set()
    for source in routers.rglob("*.py"):
        text = source.read_text(encoding="utf8")
        for method, path in ROUTE_DECORATOR.findall(text):
            routes.add(("WS" if method == "websocket" else method.upper(), path))
    return routes or None


def normalise(path: str) -> str:
    return path.replace("`", "").rstrip("/") or "/"


def check_rest_routes(report: Report) -> None:
    routes = installed_routes()
    if routes is None:
        report.skip("10xscale-agentflow-cli not installed — skipped REST route checks")
        return

    known = {(method, normalise(path)) for method, path in routes}
    for path in sorted((DOCS / "reference" / "rest-api").glob("*.md")):
        rel = path.relative_to(ROOT).as_posix()
        for method, documented in REST_HEADING.findall(path.read_text(encoding="utf8")):
            target = normalise(documented)
            if not target.startswith("/"):
                continue
            report.checked += 1
            if (method, target) not in known:
                report.fail(f"{rel}: `{method} {target}` is not a route in the installed server")


# --------------------------------------------------------------- commands ----


def check_cli_commands(report: Report) -> None:
    try:
        from agentflow_cli.cli.main import app  # type: ignore[import-not-found]
    except Exception:
        report.skip("agentflow CLI not importable — skipped command checks")
        return

    registered = set()
    for command in getattr(app, "registered_commands", []):
        name = getattr(command, "name", None) or getattr(command.callback, "__name__", "")
        if name:
            registered.add(name.replace("_", "-"))
    for group in getattr(app, "registered_groups", []):
        if getattr(group, "name", None):
            registered.add(group.name)

    if not registered:
        report.skip("could not introspect CLI commands — skipped command checks")
        return

    reference = DOCS / "reference" / "api-cli" / "commands.md"
    documented = set(re.findall(r"^#{2}\s+`?agentflow ([a-z-]+)`?", reference.read_text("utf8"), re.M))
    for name in sorted(documented):
        report.checked += 1
        if name not in registered:
            report.fail(f"docs/reference/api-cli/commands.md: `agentflow {name}` is not a CLI command")

    for name in sorted(registered - documented):
        report.fail(f"docs/reference/api-cli/commands.md: CLI command `agentflow {name}` is undocumented")


# ------------------------------------------------------------------- main ----


def main() -> int:
    report = Report()
    check_imports(report)
    check_rest_routes(report)
    check_cli_commands(report)

    for note in report.skips:
        print(f"skip    {note}")

    if report.failures:
        print()
        for failure in report.failures:
            print(f"FAIL    {failure}")
        print(f"\n{len(report.failures)} mismatch(es) across {report.checked} checked references.")
        return 1

    print(f"OK      {report.checked} documented references match the installed packages.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
