.PHONY: setup setup-all backend frontend notebook test lint build samples

setup:        ## Instala lo básico (API + análisis + frontend)
	cd backend && uv sync
	cd frontend && npm install
	@test -f .env || cp .env.example .env

setup-all:    ## Instala también los extras (otras fuentes satelitales y nube)
	cd backend && uv sync --extra geo --extra cloud
	cd frontend && npm install
	@test -f .env || cp .env.example .env

backend:      ## API en http://localhost:8000 (docs en /docs)
	cd backend && uv run uvicorn app.main:app --reload

frontend:     ## Web en http://localhost:5173
	cd frontend && npm run dev

notebook:     ## JupyterLab con el entorno del backend
	cd backend && uv run jupyter lab --notebook-dir=../notebooks

test:
	cd backend && uv run pytest -q

lint:
	cd backend && uv run ruff check .
	cd frontend && npm run lint

build:
	cd frontend && npm run build

samples:      ## Vuelve a descargar las muestras sin conexión de NASA POWER
	cd backend && PYTHONPATH=. uv run python -u scripts/fetch_samples.py
