# Makefile for PyAgenity packaging, publishing, and docs

.PHONY: docs-serve docs-build docs-deploy

# ---------- Docs Section ----------
docs-serve:
	@echo "Serving docs at http://127.0.0.1:8000"
	mkdocs serve -a 127.0.0.1:8000

docs-build:
	# Build docs without strict mode to avoid aborting on warnings
	mkdocs build

# Deploy to GitHub Pages
docs-deploy: docs-build
	uv pip install mkdocs ghp-import
	ghp-import -n -p -f site
	@echo "✅ Docs deployed to GitHub Pages"
