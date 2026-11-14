# VERDICT · NASA Space Apps Challenge 2026 — Official Submission Copy (English)

> Ready-to-paste English copy for the NASA Space Apps project submission form, judging summary, dataset attributions, AI disclosure, and 30-second / 7-slide demo script.

---

## 1. High-Level Summary (Short Pitch)

**VERDICT** (*Be an Earth System Trend Detective*) is a bilingual (**EN / ES**) interactive platform that empowers students and researchers to investigate whether Earth's climate and landscapes are truly changing **anywhere on the planet** — without falling into the statistical trap of false alarms.

Unlike standard trend dashboards that draw a naive regression line over noisy environmental data, VERDICT combines a **unified 3D Earth Explorer** (zooming smoothly from 2,592 planetary grid cells right down to local satellite terrain) with an **autocorrelation-resistant statistical engine** and **dual Student / Researcher interfaces**.

---

## 2. Detailed Project Description (Problem → Solution)

### The Problem
The *Be an Earth System Trend Detective* challenge asks four fundamental questions: **What is changing? Where? How much? And is that change statistically significant or just natural variability?**

In practice, building a tool for students faces two critical hurdles:
1. **Environmental data has "memory" (autocorrelation):** A warm or dry year tends to follow another. Standard regression ignores this and produces **19% to 49% false-positive trend alarms** even when no real trend exists.
2. **Intimidating UX & fragmented tools:** Students get lost in raw p-values, disconnected 2D/3D maps, and unguided 14-variable tables without understanding *why* a trend is marked "Not Yet Significant."

### Our Solution: 3 Progressive Phases + Dual Audience Mode
VERDICT replaces single-page dashboard clutter with a clear **3-Phase Investigation Flow** and a live **Student / Researcher Mode** toggle:

1. **Phase 01 · Briefing & Method:** Teaches users the 4 detective questions, demonstrates via Monte Carlo validation why standard regression fails under autocorrelation, explains the 3-level Traffic-Light Verdict (*Confirmed*, *Not Yet + Years Needed*, *No Clear Trend*), and offers 1-click guided case studies.
2. **Phase 02 · Unified 3D Planet Explorer:** One interactive MapLibre 3D globe powered by **NASA GIBS** (Blue Marble & VIIRS Black Marble) and Esri World Imagery. From orbit, users see **2,592 global 5° cells** filtered with Benjamini–Hochberg False Discovery Rate control ($q = 0.10$). As users search a city or zoom into a region on the *same* globe, grid shading smoothly turns translucent to reveal local satellite terrain where any coordinate can be clicked. A side Mission Dock turns plain questions into up to 3 recommended NASA variables.
3. **Phase 03 · Verdict & Analytics Studio:**
   - **Simplified Student Mode:** Visual Statistical Certainty meters (`0–100%`), Data Sufficiency progress bars showing *"how many more years of records are needed"* (adapted Weatherhead et al., 1998 formula), clean annual charts, and plain-language summaries.
   - **Rigorous Researcher Mode:** Exposes exact prewhitened Mann-Kendall ($\tau, p$), bias-corrected lag-1 autocorrelation ($r$), effective sample size ($n_{\text{eff}}$), OLS confidence intervals, Pettitt step-change alerts (to catch satellite assimilation shifts like MERRA-2 rainfall jumps), and period-sensitivity checks ($\pm 3$ years).
   - **Multi-Dimensional Evidence Tabs:** 14-variable Bonferroni Radar Scan, Side-by-Side Place Comparison, Historical Satellite Timelapse (Landsat 5/7/8/9 & Sentinel-2, 1984–2025 + Annual Land Cover), UN Population Projections to 2100, and Climate–Society Detrended Correlation (World Bank).

---

## 3. Statistical Validation (Anti-False-Alarm Benchmark)

Tested via Monte Carlo simulation (30-year annual series with **zero underlying trend** and AR(1) climate memory $\phi$):

| Climate Memory ($\phi$) | Ordinary Regression (False Positives) | VERDICT Dual Engine (Prewhitened MK + Effective-N OLS + Bias Fix) |
|---|---|---|
| $\phi = 0.0$ | 4.8% | **3.6%** |
| $\phi = 0.4$ | 19.3% | **4.8%** |
| $\phi = 0.8$ | 49.0% | **8.2%** |

Weatherhead's years-needed estimator ($n^*$) detects real trends at the **88–96%** rate (target: 90%) in our simulation suite. All offline unit & statistical tests are automated in `backend/tests/`.

---

## 4. NASA & External Data Sources Used

| Dataset / Service | Purpose in VERDICT | Reference URL |
|---|---|---|
| **NASA POWER (MERRA-2 & CERES)** | 14 monthly Earth variables worldwide since 1981 (temperature, precipitation, soil moisture, humidity, solar radiation, wind, pressure) | https://power.larc.nasa.gov |
| **NASA GIBS (Blue Marble & VIIRS Black Marble)** | Orbital daytime & nighttime raster tiles for the 3D Earth Explorer | https://earthdata.nasa.gov/gibs |
| **Microsoft Planetary Computer STAC** | Cloud-free Landsat 5/7/8/9 (1984+) & Sentinel-2 (2016+) 16×16 km timelapses + Impact Observatory/Esri 10 m Annual Land Cover | https://planetarycomputer.microsoft.com |
| **UN World Population Prospects (via Our World in Data)** | Demographic indicators & official UN cohort-component projections through 2100 for 249 countries | https://ourworldindata.org |
| **World Bank Open Data API** | Agricultural & socioeconomic indicators for detrended climate-society coupling | https://data.worldbank.org |
| **Open-Meteo Geocoding & GeoNames (`reverse_geocoder`)** | Global place search and offline coordinate-to-country resolution | https://open-meteo.com |

---

## 5. Artificial Intelligence (AI) Disclosure

- **In-App AI (Optional & Strictly Grounded):** When `ANTHROPIC_API_KEY` is configured, Claude (`claude-opus-5-5`) performs two tightly bounded roles:
  1. **Question Routing (`/api/ask`):** Maps a user's plain-language question into a structured catalog concern (`heat`, `water`, `drought`, `sun`, `wind`), place type, and location query via strict JSON schema. Variable selection remains deterministic via our rule table.
  2. **Plain-Language Explanation (`/api/explain`):** Receives **only** pre-computed statistics recalculated server-side and explains plausible physical hypotheses, future scenario caveats, and reliability warnings without inventing figures or deciding verdicts.
  3. **Zero-Key Fallback:** Without an API key (or offline), deterministic keyword rules and scientific templates operate seamlessly.
- **Development Assistance:** AI coding assistants were used to help refactor frontend UI components, write bilingual localization dictionaries (`ES/EN`), and document the design system. All statistical formulas, simulation tests, and architectural choices were reviewed and validated by the team.

---

## 6. Demo Script (30-Second Video / 7-Slide Flow)

- **Slide 1 / 0:00–0:04 — Hook:** *"Is your city really heating up, or is it just a lucky streak? Standard trend lines get fooled up to 49% of the time."* (Show Phase 1 Monte Carlo table & Traffic Light).
- **Slide 2 / 0:04–0:10 — Unified 3D Planet:** Transition to **Phase 2 (3D Planet)**. Spin the 2,592 FDR-checked cells on NASA Blue Marble, then type *"Managua"* and click **Zoom to Zone** to watch the grid turn translucent over real satellite imagery.
- **Slide 3 / 0:10–0:16 — Honest Verdict ("Not Yet"):** Open **Phase 3 (Analytics Studio)** in **Student Mode** for Managua temperature (`T2M`). Show the Amber **"Under Observation / Not Yet"** verdict, the visual Certainty Meter, and the Data Sufficiency bar showing how many more years are needed.
- **Slide 4 / 0:16–0:21 — Opposite Stories Side-by-Side:** Click **Compare 2 Zones** against **Svalbard (Arctic)** — showing Svalbard's rapid, confirmed warming (`+0.73 °C/decade`) vs. Managua's natural swings.
- **Slide 5 / 0:21–0:26 — Reanalysis Trap & Satellite Proof:** Switch briefly to **Researcher Mode** to show a Pettitt step-change warning on MERRA-2 data, then open the **Satellite Timelapse (1984–2025)** slider to see physical land-cover growth.
- **Slide 6 / 0:26–0:30 — Close:** Show **UN Population** / **AI Explanation** anchored to real numbers. End on VERDICT logo: *"Ask. Zoom. Get an Honest Verdict."*
