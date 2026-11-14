# VERDICT · Design System & UX Architecture ("Orbital Observatory")

> **Project:** VERDICT — Earth System Trend Detective (NASA Space Apps Challenge 2026)  
> **Team:** Laboratorio Boreal · **Goal:** Radical clarity for students, rigorous statistical honesty for researchers.

---

## 1. Why Redesign? (Problem Diagnosis)

The first prototype concatenated every control, map, globe, form, and statistical table on a **single long scrolling page**. That created three UX barriers:

1. **No clear entry narrative:** Users landed immediately on dense controls without understanding *why* climate trend detection is tricky (e.g., why ordinary trend lines produce up to **49% false alarms** under climate autocorrelation).
2. **Split spatial interaction:** A 3D globe at the top duplicated a 2D Leaflet map further down, forcing users to switch mental models instead of **zooming smoothly into any region on the same 3D planet**.
3. **Intimidating statistical jargon:** Raw p-values (`mk_p`, `ols_p`, `τ`, `n_eff`), confidence intervals, and complex multi-line charts overwhelmed high-school and undergraduate students, even though the core answers (*What, Where, How Much, Is it Real or Noise?*) are intuitive.

---

## 2. Core Architecture: 3 Progressive Phases + Dual Audience Mode

Instead of one crowded page, VERDICT organizes the investigation into **three focused phases** accessible via a sticky top Mission Bar, plus a global **Audience Mode** (`Estudiante` / `Investigador`) and **Language Toggle** (`ES` / `EN`).

```
[ 01 · Guía y Misión ]  ──▶  [ 02 · Planeta 3D Unificado ]  ──▶  [ 03 · Paneles y Veredicto ]
   Briefing & Method           Global Cells + Local Zoom           Verdict KPIs, Charts & Studio
```

### Phase 1 · Briefing & Mission (`01 · Guía y Misión`)
- **Purpose:** Onboard the user in under 45 seconds before touching controls.
- **Key Sections:**
  1. **Editorial Hero:** Mission statement, live platform telemetry (`14 NASA variables`, `45-year span`, `2,592 cells`, `249 countries`), and clear primary CTA (`Explorar el Planeta 3D →`).
  2. **The 4 Detective Questions:** Visual cards for *What changes?*, *Where?*, *How much?*, and *Is it statistically significant or natural luck?*
  3. **Why Normal Graphs Lie (The Anti-False-Alarm Filter):** Plain-language visual explanation of climate "memory" (year-to-year autocorrelation) alongside the **Monte Carlo Validation Table** comparing Standard Regression (`19.3% – 49.0%` false alarms) vs. VERDICT (`3.6% – 8.2%` false alarms).
  4. **The Verdict Traffic Light:** Visual legend of the 3 verdicts (`Confirmed Change`, `In Observation / Not Yet`, `Stable / No Clear Trend`) highlighting that *"Not Yet"* includes an estimate of **how many years of data are needed**.
  5. **1-Click Guided Case Studies:** Curated investigations (Managua, Nicaragua Dry Corridor, Central Amazon, Arctic Svalbard) that jump directly to the planet or statistical studio.

### Phase 2 · Unified 3D Planet Explorer (`02 · Planeta 3D`)
- **Purpose:** Replace both the isolated globe banner and the redundant 2D Leaflet map with **one unified interactive Earth**.
- **Spatial Seamlessness (Macro → Micro on the Same Planet):**
  - **Planetary Scale (`zoom 1.8 – 3.5`):** Shows 2,592 five-degree trend cells colored by direction/magnitude and filtered by Benjamini-Hochberg FDR (`q = 0.10`), over NASA GIBS Blue Marble / VIIRS Black Marble.
  - **Regional & Local Zoom (`zoom 4.0 – 12.0`):** As the user zooms into a selected zone (via search, quick chip, or clicking a cell), cell fill opacity automatically fades smoothly (`fill-opacity` interpolation from `1.0` down to `0.08`) while crisp grid borders remain, revealing high-resolution Esri World Imagery satellite terrain underneath.
  - **Click Anywhere:** Users can click *any* coordinate on the globe (even when zoomed into a city or valley), drop a live cyan marker (`Spot A`) or amber marker (`Spot B` for comparison), and inspect it immediately.
- **Mission Control Side Dock (3 Clean Steps):**
  1. **Where:** City/region search, quick region chips that fly the 3D camera, and a "Pick 2nd comparison spot" switch.
  2. **What:** Natural-language question bar (Claude AI or offline keyword rules), Concern pills, Place-Type pills, and the 3 recommended variables in plain language.
  3. **Launch:** Prominent CTA (`Analizar Zona y Ver Veredicto →`) transitioning cleanly into Phase 3.

### Phase 3 · Verdict & Analytics Studio (`03 · Paneles y Veredicto`)
- **Purpose:** Present scientific conclusions clearly without visual noise.
- **Sticky Zone Context Strip:** Displays active coordinates/location, quick variable & start-year selectors, and a 1-click button back to the 3D Planet (`🌍 Cambiar zona en el planeta`).
- **6 Focused Studio Views:**
  1. **Veredicto y Futuro (`trend`):**
     - **Traffic-Light Verdict Header** with audience-adapted narrative summary.
     - **4 Simplified KPI Cards** with visual progress bars instead of raw math jargon:
       - *What & Direction* (`↑` / `↓` / `→`)
       - *Pace of Change* (`rate / decade` + total period change + plausible 95% interval)
       - *Statistical Certainty Meter* (`0–100%` visual gauge derived from `1 - p`)
       - *Data Sufficiency Progress* (`n_years` observed vs. `years_needed` to confirm at 90% power)
     - **Clean Chart View Toggle:** *Simple View* (Annual average + Trend line + Future Scenario — default for Students) vs. *Full View* (+ Monthly anomaly noise — default for Researchers).
     - **Interactive Scenario Pills:** `2030`, `2040`, `2050`, `2075`, `2100` labeled clearly as *"If today's pace continues (Scenario, not forecast)"*.
     - **AI / Template Explainer:** Grounded strictly in motor numbers.
     - **Researcher Rigor Card:** Expanded automatically in `Investigador` mode (collapsible in `Estudiante` mode) showing Prewhitened Mann-Kendall ($\tau, p$), Effective-Sample OLS ($n_{\text{eff}}, r, p$), and Monte Carlo validation benchmarks.
  2. **Radar de las 14 Variables (`scan`):** Scans all 14 NASA variables at the selected spot (with Bonferroni correction) AND includes regional comparison across the 7 reference biomes.
  3. **Comparar 2 Zonas (`compare`):** Side-by-side verdict cards + standardized z-score overlay proving opposite trends across locations.
  4. **Satélite 1984–2025 (`satellite`):** Interactive year slider (Landsat 5/7/8/9 & Sentinel-2, 16×16 km crop) + annual Land Cover classification bars + built-up area scenario.
  5. **Población ONU (`population`):** Official UN World Population Prospects projection to 2100 compared against naive linear extrapolation for 249 countries.
  6. **Clima y Sociedad (`relate`):** World Bank socioeconomic indicator pairing, distinguishing *Apparent Correlation* from *Real Year-to-Year (Detrended) Correlation* with a visual correlation gauge.

---

## 3. Dual Audience Simplification Rules

| Element | 🎓 Modo Estudiante (Simple) | 🔬 Modo Investigador (Avanzado) |
|---|---|---|
| **Significance indicator** | Visual Certainty Bar (`99.4% certainty · Very unlikely to be luck`) | Exact `MK p`, `OLS p_eff`, `τ`, `n_eff`, lag-1 `r` |
| **Data horizon** | Progress bar: `36 of 42 years needed (~6 more years)` | Weatherhead (1998) formula & AR(1) variance parameters |
| **Main Time-Series Chart** | Annual means + Theil–Sen line + Scenario band (clean) | Full monthly deseasonalized anomalies + annual + trend + band |
| **Methodology & Rigor Card** | Collapsed under *"¿Cómo funciona?"* | Open by default with dual-method comparison table |
| **Warnings** | Plain-language advice (*"Check another satellite source"*) | Technical specifics (*"Pettitt step-change p = …; MERRA-2 assimilation shift"*) |

---

## 4. Visual Design Tokens

- **Canvas & Surfaces:**
  - Deep Space Background: `#040812` with subtle radial orbital glow (`#0d1e38`)
  - Glass Panel Surface: `rgba(11, 19, 34, 0.84)` with `backdrop-filter: blur(14px)` and hairline border `#1b2a42`
  - Elevated Card Surface: `#0f1a2d` with subtle inner highlight
- **Semantic Verdict Accents:**
  - **Confirmed / Significant:** Cyan `#3fd0e6` + Emerald `#34d399`
  - **In Observation / Not Yet:** Amber `#f2b84b`
  - **No Clear Trend / Stable:** Cool Slate `#9aabc4`
  - **Future Scenarios & AI Explainer:** Soft Violet `#a78bfa`
  - **Comparison Spot B:** Coral Orange `#f59e42`
- **Typography:**
  - UI & Editorial: `'Inter', system-ui, sans-serif` (clear hierarchy, `1.55` line height)
  - Numeric Telemetry: `ui-monospace, 'JetBrains Mono', 'SF Mono', monospace` with `tabular-nums`
