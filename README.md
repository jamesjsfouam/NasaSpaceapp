# VERDICT · Earth System Trend Detective (NASA Space Apps 2026)

**Team:** Laboratorio Boreal · **Challenge:** *Be an Earth System Trend Detective*

An interactive, bilingual (**EN / ES**) platform empowering students and researchers to investigate whether Earth's climate and landscapes are changing **anywhere in the world**. VERDICT answers **what** is changing, **where**, **how much**, and whether the change is **statistically significant** or could simply be natural climate variability.

> **Design System & Architecture:** [docs/DESIGN.md](docs/DESIGN.md)  
> **Official English Submission Copy & Demo Script:** [docs/SUBMISSION_EN.md](docs/SUBMISSION_EN.md)  
> **Project Analysis PDF:** [docs/Earth_System_Trend_Detective_analisis_y_solucion.pdf](docs/Earth_System_Trend_Detective_analisis_y_solucion.pdf)

---

## Key Experience: 3 Progressive Phases + Dual Audience Mode

VERDICT avoids single-page dashboard clutter by guiding users through **3 focused phases** paired with a live **🎓 Student / 🔬 Researcher** mode switcher and **ES / EN** language toggle:

1. **01 · Briefing & Method:** Explains the 4 detective questions, visualizes via Monte Carlo simulation why naive trend lines suffer up to **49% false alarms** under climate memory (autocorrelation), introduces the Traffic-Light Verdict system, and offers 1-click guided cases.
2. **02 · Unified 3D Planet Explorer:** One interactive MapLibre GL 3D globe powered by **NASA GIBS** (Blue Marble & VIIRS Black Marble) and Esri World Imagery. Shows **2,592 global 5° cells** with Benjamini–Hochberg FDR control ($q = 0.10$), and smoothly fades grid shading as you zoom into any city or valley so you can click exact coordinates directly on satellite terrain.
3. **03 · Verdict & Analytics Studio:**
   - **Verdict & Future:** Visual Statistical Certainty gauge, Data Sufficiency progress bar (*years observed vs. years needed*), Simple vs. Full chart toggle, linear future scenarios (2030–2100), grounded AI explanations, and an expandable Dual-Engine Researcher Rigor table.
   - **14-Variable Radar & Global Regions:** Bonferroni-corrected scan of all 14 NASA POWER variables + side-by-side comparison across 7 reference biomes.
   - **Compare 2 Zones:** Same variable across any two places on Earth using standardized z-scores.
   - **Satellite Timelapse (1984–2025):** Cloud-free Landsat 5/7/8/9 & Sentinel-2 imagery + 10 m annual land-cover breakdown via Microsoft Planetary Computer.
   - **UN Population:** Official UN World Population Prospects projections to 2100 for 249 countries.
   - **Climate & Society:** Detrended year-to-year coupling against World Bank indicators (catching deceptive trend-driven correlations).

## Quick Start (English)

Requirements: [uv](https://docs.astral.sh/uv/), Node 22+, and `make` (or run commands inside `backend/` and `frontend/`).

```bash
make setup
make backend   # API & Swagger docs at http://localhost:8000/docs
make frontend  # Web UI at http://localhost:5173
```

Works with **zero API keys** using public NASA POWER, Planetary Computer, Our World in Data, World Bank, and offline sample fallbacks (`backend/app/data/samples/`). Optionally add `ANTHROPIC_API_KEY` in `.env` to enable live Claude AI narration.

```bash
make test      # Backend statistical simulation & offline API tests
make lint      # Ruff (backend) & Oxlint (frontend)
make build     # TypeScript check + Vite production bundle
```

---

## Versión en Español · Detective de tendencias del sistema Tierra

Una herramienta para que estudiantes e investigadores investiguen si algo está cambiando en **cualquier lugar del mundo**, separando cambios reales de rachas naturales gracias a pruebas resistentes a la autocorrelación (**Mann-Kendall con preblanqueo** y **regresión con tamaño de muestra efectivo**, validado por simulación Monte Carlo).

### Arquitectura en 3 fases y modo dual

- **Fase 01 · Guía y Misión:** Explica las 4 preguntas del detective, por qué las gráficas comunes producen hasta un 49 % de falsas alarmas por autocorrelación, cómo leer el semáforo de veredictos y casos guiados en 1 clic.
- **Fase 02 · Planeta 3D Unificado:** Un solo globo interactivo (MapLibre + NASA GIBS + Esri World Imagery) con **2.592 celdas globales de 5°** y control FDR. Al hacer zoom hacia cualquier ciudad o zona, las celdas se vuelven semitransparentes para revelar el terreno real y marcar coordenadas exactas.
- **Fase 03 · Paneles Estadísticos:** Alterna en vivo entre **Modo Estudiante** (medidores visuales de certeza, barra de años suficientes, gráficas limpias y lenguaje sencillo) y **Modo Investigador** (valores $p$, $\tau$ de Kendall, $n_{\text{efectivo}}$, saltos Pettitt y tablas comparativas).

### Documentación del proyecto

- Diseño y flujo UX: [docs/DESIGN.md](docs/DESIGN.md)
- Entrega oficial en inglés: [docs/SUBMISSION_EN.md](docs/SUBMISSION_EN.md)
- Método estadístico, validación y límites: [docs/RETO.md](docs/RETO.md)
- Guía de estudio: [docs/GUIA_ESTUDIO.md](docs/GUIA_ESTUDIO.md)
- Memoria técnica: [docs/MEMORIA_PROYECTO.md](docs/MEMORIA_PROYECTO.md)
- Ofertas globales (Firebase, Meteomatics, Planetary Computer): [docs/OFERTAS.md](docs/OFERTAS.md)

## License

MIT
