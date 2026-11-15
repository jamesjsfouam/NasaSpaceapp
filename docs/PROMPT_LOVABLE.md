# VERDICT · Prompt para Rediseño Frontend en Lovable (`lovely.ai`)

> Copia y pega el bloque inferior en Lovable cuando trabajes sobre el frontend del repositorio.

---

```text
Rediseña y pule por completo la interfaz y experiencia visual (UI/UX) del frontend de VERDICT ("Earth System Trend Detective") manteniendo intactos los contratos actuales de datos en `src/api.ts`, `src/staticFallback.ts` (compatibilidad con GitHub Pages en `./static-api/` y `base: './'`) y los tipos TypeScript estrictos (`tsc -b` y `oxlint` sin errores).

### Identidad visual ("Orbital Observatory")
- Tema espacial oscuro de alto contraste y acabado de observatorio científico moderno:
  - Fondo `#040812` con gradiente orbital radial sutil (`#0f2546`), paneles glass `rgba(11, 19, 34, 0.88)` con `backdrop-filter: blur(14px)` y bordes finos `#1b2a42`.
  - Paleta semántica estricta: Cyan `#3fd0e6` (acción primaria / Spot A / tendencia confirmada), Esmeralda `#34d399` (certeza alta / proyección ONU), Ámbar `#f2b84b` (en observación / todavía no / alertas), Gris azulado `#9aabc4` (estable / sin tendencia), Violeta `#a78bfa` (escenarios futuros y módulo explicador IA), Coral `#f59e42` (Spot B de comparación).
  - Tipografía: `Inter` para títulos/narrativa y `JetBrains Mono` (`tabular-nums`) para coordenadas, tasas, p-valores y tablas.

### Arquitectura obligatoria en 3 pantallas progresivas (NO una sola página larga)
1. **Barra Superior Fija (`Topbar` sticky):**
   - Logo `VERDICT` (vuelve a Fase 01), stepper de 3 fases (`01 · Guía y Misión`, `02 · Planeta 3D`, `03 · Paneles y Veredicto` con indicador verde si hay zona activa) y selector bilingüe `ES` / `EN`.
   - **HUD Único Unificado (SIN toggle `Estudiante` / `Investigador`):** existe una sola interfaz limpia y rigurosa para todos los usuarios, usando divulgación progresiva (*progressive disclosure*).

2. **Pantalla 01 · Guía y Misión (`briefing`):**
   - Hero editorial claro (qué problema resuelve VERDICT en menos de 45s) + 2 CTAs (`Explorar el Planeta 3D` y `Ver investigaciones guiadas`) + grid 2×2 de telemetría (`14 variables` incluyendo compuestas como `VPD`, `DTR` y `WBGT`, `45 años`, `2,592 celdas`, `249 países`).
   - 4 tarjetas visuales de las preguntas del detective (*¿Qué cambia?, ¿Dónde?, ¿Cuánto y desde cuándo?, ¿Realidad o azar?*).
   - Bloque metodológico en 2 columnas: tabla Monte Carlo (Regresión normal `19.3%–49.0%` falsas alarmas vs VERDICT `3.6%–8.2%`) y Semáforo de 3 veredictos.
   - 4 Demo Cards en 1 clic (`Managua`, `Corredor Seco`, `Amazonas`, `Ártico`) con botones `Abrir análisis →` y `Ver en Planeta 3D`.

3. **Pantalla 02 · Planeta 3D Unificado + Estación de Control (`planet`):**
   - **No dupliques mapas:** usa un único `Globe3D` (MapLibre GL en proyección `globe`). A escala global (`z=1.9`) muestra las 2,592 celdas `5°×5°`; al acercar (`zoom 3.5` a `5.8`), desvanece suavemente el relleno de las celdas (`1.0 → 0.08`) dejando solo los bordes para revelar Esri World Imagery debajo y capturar clics exactos (Spot A cyan / Spot B coral).
   - HUD flotante sobre el globo (`Global`, `Acercar zona`, `Modo noche Black Marble`, `Solo FDR` y capa opcional de `Teleconexiones / ENSO` con arcos de influencia climática a distancia), barra de leyenda y barra inferior de vista previa de la zona activa.
   - Dock lateral derecho en 3 pasos limpios: Paso 1 (`¿Dónde?`: buscador Open-Meteo + 7 chips de biomas + checkbox 2.º punto), Paso 2 (`¿Qué investigar?`: pregunta libre `/api/ask` + 5 chips preocupación + 6 chips tipo lugar + 3 recomendadas + selectores 14 variables —destacando `VPD`, `DTR` y `WBGT`— y año inicio), Paso 3 (`Analizar Zona y Ver Veredicto →`).

4. **Pantalla 03 · Estudio Analítico y Veredicto (`studio`):**
   - Cabecera fija con la zona activa, selectores rápidos de variable/año y botón `Cambiar zona en el planeta`.
   - 6 pestañas: `trend` (Veredicto y Futuro), `scan` (Radar 14 variables con Bonferroni + 7 biomas), `compare` (2 zonas lado a lado + gráfico Z-score), `satellite` (visor `640×640` 1984–2025 + slider años + cobertura suelo), `population` (249 países ONU WPP vs extrapolación lineal) y `relate` (10 indicadores Banco Mundial con selector de rezago `lag 0 / 1 / 2 años`, filtro de choque global `2020–2021`, aviso de validez espacial `1 punto vs país` y diferenciación entre correlación real sin tendencia vs aparente).
   - **HUD Único con Divulgación Progresiva (sin dos modos separados):**
     - **Primer plano claro para todos:** veredicto en lenguaje cotidiano, tasa por década, barras visuales de `% de certeza` y años faltantes, y gráfico limpio por defecto.
     - **Profundidad técnica bajo demanda:** switch local `+ ruido mensual` en el gráfico y tarjeta/acordeón colapsable `"Ver detalle estadístico y metodología"` con `MK p`, `OLS p_eff`, `τ`, `n_eff`, lag-1 `r`, prueba de Pettitt y proyecciones locales (`h=0..3`).
   - Opcionalmente, en la barra de contexto de la zona o tarjeta secundaria, si el backend local responde en `/api/meteomatics` (sin romper el modo estático si falla), muestra una insignia discreta con temperatura/UV/PM2.5 actual de Meteomatics para ese punto.
   - Cuida estados de carga, error, tablas con scroll horizontal y diseño responsive completo en `<= 1024px` (tablet) y `<= 680px` (móvil).
```
