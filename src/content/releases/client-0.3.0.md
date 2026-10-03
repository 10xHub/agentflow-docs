---
package: client
version: "0.3.0"
date: 2026-07-21
summary: Adds graphTools() and observability() endpoints and fixes packaging, sourcemap, typing and Node 18 issues. Dev tooling moves to vitest 3 and vite 7, clearing all reported vulnerabilities.
breaking: false
---

### Added

- `client.graphTools()` lists the tools exposed by the graph's tool nodes, grouped by node and tagged with their source (`local`, `mcp` or `remote`).
- `client.observability(threadId, runId?)` returns the reconstructed trace (spans, events, cost) for a thread, defaulting to the latest run.
- ESLint 9 (flat config) and Prettier, with `lint`, `format`, `typecheck` and `check` scripts.
- CI covering lint, Prettier, `tsc --noEmit`, tests on Node 18, 20 and 22, and a packaging job that smoke tests the CJS and ESM entry points from a clean install. The release workflow is gated on CI, and CodeQL scanning and Dependabot were added.

### Changed

- Upgraded vitest 1.x to 3.x and vite 5.x to 7.x, which cleared all 11 reported vulnerabilities. `npm audit` now reports zero.
- `tsconfig.json` type-checks `tests/` as well as `src/`, which surfaced and fixed six type errors in the test suite.
- Twelve `@ts-ignore` comments became `@ts-expect-error`, and all of them turned out to be suppressing nothing, so they were removed.
- Coverage thresholds were raised and pinned as a ratchet (72% lines and statements, 82% branches, 76% functions).

### Fixed

- **`npm publish` would have failed.** Scoped packages default to `restricted`, so `publishConfig.access: "public"` was added, along with `provenance: true`.
- **`uploadFile()` threw on Node 18.** `File` only became a global in Node 20, and the upload path did an unguarded `file instanceof File`, so every call failed with `ReferenceError: File is not defined`, including calls passing a plain `Blob`. The check is now guarded.
- **The build was not cross-platform.** `npm run build` ended in `cp -r dist-types/* dist/`, which does not exist on Windows. `tsc` now emits declarations straight into `dist/` through `tsconfig.build.json`.
- **Shipped sourcemaps did not resolve.** The tarball contained 41 `.map` files but no sources. `src/` is now included in `files`.
- **`NodeJS.Timeout` leaked into the public types**, forcing browser-only consumers to install `@types/node`. `forgetMemories` now uses `ReturnType<typeof setTimeout>`, and `Error.captureStackTrace` is accessed structurally.
