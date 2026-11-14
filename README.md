# Detective de tendencias del sistema Tierra · NASA Space Apps 2026

**Equipo:** Laboratorio Boreal · **Reto:** *Be an Earth System Trend Detective*

Una herramienta para que estudiantes y público con algo de formación científica investiguen
si una variable del sistema Tierra está cambiando: **qué** cambia, **dónde**, **cuánto** y si
el cambio es **estadísticamente significativo** o podría ser casualidad.

- Preguntas guiadas (tema → variable → lugar → periodo), con definiciones sencillas.
- Cuatro ejemplos de un clic para entender la herramienta.
- Serie temporal sin el ciclo estacional, con promedio anual y recta de tendencia.
- Tasa de cambio con Theil–Sen y regresión lineal, ambas con intervalo de confianza del 95 %;
  significancia con Mann-Kendall y t-test.
- **Escanear** un lugar: las 14 variables ordenadas por evidencia, con p ajustado por
  pruebas múltiples.
- **Comparar regiones:** la misma variable sube en unos lugares y baja en otros.
- Avisos honestos: autocorrelación, series cortas y saltos bruscos que suelen venir de los
  datos y no del clima.

Datos: [NASA POWER](https://power.larc.nasa.gov) (modelo MERRA-2 y observaciones de CERES),
mensuales desde 1981, sin clave. Detalle del método y límites: [docs/RETO.md](docs/RETO.md).
Guía de estudio del equipo (tema, estadística e ideas de innovación): [docs/GUIA_ESTUDIO.md](docs/GUIA_ESTUDIO.md).

## Arranque rápido

Requisitos: [uv](https://docs.astral.sh/uv/), Node 22 y `make`.

```bash
make setup
```

```bash
make backend
```

```bash
make frontend
```

- Web: http://localhost:5173
- API y documentación interactiva: http://localhost:8000/docs

Funciona sin claves. Si NASA POWER no responde durante la demo, las 7 regiones de ejemplo
usan muestras guardadas en `backend/app/data/samples/` (se actualizan con `make samples`).

## Estructura

```
backend/
  app/catalog.py           Variables (con definiciones), temas, regiones y ejemplos
  app/services/power.py    Cliente de NASA POWER con caché y respaldo sin conexión
  app/services/trends.py   Estadística: estacionalidad, Theil–Sen, Mann-Kendall, OLS, saltos
  app/main.py              API: /api/catalog, /api/trend, /api/scan, /api/compare
  app/data/samples/        Datos guardados de las regiones de ejemplo
frontend/                  React + Vite + TypeScript + Recharts
notebooks/                 Exploración con el mismo código de la API
docs/                      Método, ofertas globales y lista de entrega
```

## API

| Endpoint | Qué devuelve |
|---|---|
| `GET /api/catalog` | Temas, variables, regiones, ejemplos, años disponibles |
| `GET /api/trend?variable=T2M&lat=12.13&lon=-86.25&start=1990` | Serie y análisis de una variable |
| `GET /api/scan?lat=12.13&lon=-86.25&start=1990` | Todas las variables ordenadas por evidencia |
| `GET /api/compare?variable=T2M&start=1990` | Una variable en todas las regiones de ejemplo |

## Comandos

| Comando | Qué hace |
|---|---|
| `make test` | Pruebas del backend (estadística con datos sintéticos y API sin red) |
| `make lint` | Revisa estilo en backend y frontend |
| `make notebook` | Abre JupyterLab |
| `make build` | Compila la web para desplegar |
| `make samples` | Vuelve a descargar las muestras sin conexión |

Extras opcionales para otras fuentes (MODIS, GPM, AIRS, Planetary Computer) y la nube:
`make setup-all`. Ver [docs/OFERTAS.md](docs/OFERTAS.md).

## Entrega

Ver [docs/ENTREGA.md](docs/ENTREGA.md).

## Licencia

MIT
