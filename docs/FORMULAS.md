# DATEX · Fórmulas y cálculos (documento de referencia)

> **Base: web de José (Jose21NC/datex, commit d6d7a87)** — clon de solo lectura en `/home/user/jose21nc/datex`. Es la web oficial: una aplicación **estática** (sin backend) que combina (a) resultados **precalculados** en `public/static-api/bundle.json` y `globe.json` y (b) un **motor de cálculo en TypeScript que se ejecuta en el navegador** (`src/staticFallback.ts`).
>
> Este documento recoge **todas las fórmulas, umbrales y reglas** de esa web. Para cada una distingue si **se ejecuta en el navegador** (Parte 1) o si **viene precalculada** por el motor Python del repositorio `/home/user/nasaspaceapp` (rama `actualizacion-frontend`; Parte 2: `backend/app/services/*`, `backend/scripts/*`, excepto `build_city_growth.py`, documentado aparte), y **marca explícitamente dónde la versión TypeScript de José difiere de la implementación Python** (Parte 3 y avisos "Difiere de Python" en cada fórmula).
>
> **Convenciones.** Fórmulas en LaTeX (`$…$`, `$$…$$`) para KaTeX. Referencias `archivo:línea`: `staticFallback.ts`, `api.ts`, `i18n.ts`, `*.tsx` son de la web de José salvo indicación; `trends.py`, `forecast.py`, etc., del repo `nasaspaceapp`. Los ejemplos se obtuvieron ejecutando el código Python del repo o leyendo `bundle.json`/`globe.json`; los del navegador, **reproduciendo `staticFallback.ts` en Python** (no se ejecutó el TypeScript). Los ejemplos hipotéticos se rotulan así. Si código y documentación del proyecto discrepan, se documenta **el código**.
>
> **Resultado clave.** `bundle.json` de José coincide con el motor Python (diferencia relativa máxima 1,8·10⁻¹², 70 claves `relate` menos). Pero cuando la web recalcula en el navegador (otro año de inicio, otro punto, rezago, etc.) usa un motor **distinto y más liberal** (preblanqueo TFPW, sin criterio doble, sin sensibilidad al periodo, años necesarios sin $\sqrt{12}$…): p. ej. Managua T2M 1990–2025 es `not_yet` ($p_{MK}=0{,}1085$) en el bundle y saldría `significant` ($p_{MK}\approx0{,}008$) con el algoritmo del navegador.

---

## Índice

1. [Tabla de símbolos](#tabla-de-símbolos)
2. **[PARTE 1 · Navegador de la web de José](#parte-1--lo-que-se-ejecuta-en-el-navegador-de-la-web-de-josé)**
   - W0 qué se calcula dónde · W1 emparejado con regiones · W2 mensual→anual · W3 tendencia y veredicto (Theil–Sen, lag‑1, OLS con n efectivo, MK‑TFPW, Pettitt, % cambio, años necesarios, veredicto, avisos, Bonferroni) · W4 escenario lineal · W5 relación clima–sociedad · W6 demografía · W7 satélite/lugares/preguntas · W8 presentación (certeza, barras, z‑score, formato, Monte Carlo fijo, color del globo)
3. **[PARTE 2 · Motor Python que generó los datos precalculados](#parte-2--motor-que-generó-los-datos-precalculados-de-la-web-backend-python-de-homeusernasaspaceapp)**
   - A datos y derivadas (DTR, VPD, WBGT) · B anomalías y medias anuales · C magnitud · D significancia y veredicto (lag‑1, MK, n efectivo, OLS, veredicto, años necesarios, periodo, Pettitt, avisos, Bonferroni, certeza) · E escenario y ONU · F relación · G geometría, satélite, demografía · H globo (BH‑FDR, p98) · I reglas del recomendador/IA · J scripts y Monte Carlo
4. **[PARTE 3 · Comparación TypeScript vs. Python](#parte-3--comparación-explícita-motor-typescript-navegador-de-josé-vs-motor-python)**
5. **[PARTE 4 · Modelo de crecimiento urbano «Ciudad 3D»](#parte-4--modelo-de-crecimiento-urbano-ciudad-3d-escenario-por-celdas)** — Q1 malla · Q2 fracción construida · Q3 pendiente · Q4 variables · Q5 regresión logística · Q6 validación (AUC, FoM) · Q7 población urbana · Q8 exponente β · Q9 impulsores sociales · Q10 impulsores climáticos y Pettitt · Q11 área objetivo · Q12 reparto · Q13 altura y color 3D
6. [Constantes y umbrales](#constantes-y-umbrales-tabla-maestra) · [N. Dónde NO hay fórmula propia](#n-dónde-no-hay-fórmula-propia-se-delega-en-una-fuente-externa) · [O. Hallazgos](#o-hallazgos-rarezas-y-discrepancias) · [P. Auto‑verificación](#p-autoverificación) · [Apéndice](#apéndice--cálculos-del-frontend-de-nasaspaceapp-que-no-están-en-la-web-de-josé)

---

## Tabla de símbolos

| Símbolo | Significado | Dónde |
|---|---|---|
| $t$ | Índice de año calendario | B |
| $m\in\{1,\dots,12\}$ | Mes del calendario | B |
| $y_{t,m}$ | Valor mensual observado (NASA POWER, o derivado) | A, B |
| $\bar y_m$ | Climatología: media del mes $m$ sobre el periodo elegido | B1 |
| $a_{t,m}$ | Anomalía mensual $y_{t,m}-\bar y_m$ | B1 |
| $\bar b$ | Nivel base: media de las 12 climatologías | B2 |
| $M_t$ | Número de meses válidos del año $t$ | B2 |
| $A_t$ | Media anual (en unidades de la variable) | B2 |
| $x_i$ | Año $i$ de la serie anual (variable independiente) | C–F |
| $n$ | Número de años de la serie anual | C–F |
| $N=n(n-1)/2$ | Número de pares $i<j$ | C1, D2 |
| $\hat\omega$ | Pendiente de Theil–Sen (por año) | C1 |
| $\hat a$ | Intercepto de Theil–Sen | C1 |
| $\hat\beta$ | Pendiente de mínimos cuadrados (OLS), por año | C4 |
| $e_i$ | Residuo de un ajuste | C, D |
| $\sigma$ | Desv. típica residual (Theil–Sen, `ddof=2`) | C6 |
| $s$ | Error típico residual de OLS, $\sqrt{\mathrm{RSS}/(n-2)}$ | E1 |
| $S_{xx}$ | $\sum_i (x_i-\bar x)^2$ | C4, E1 |
| $r$ | Autocorrelación lag‑1 muestral (cruda) | D1 |
| $r^\ast$ (código: `r`) | Autocorrelación lag‑1 corregida, en $[0;\,0{,}95]$ | D1 |
| $\phi$ | Parámetro AR(1) verdadero (en simulaciones) | D6, L |
| $n_{\mathrm{eff}}$ | Tamaño de muestra efectivo | D3 |
| $\nu$ | Grados de libertad efectivos $=\max(1,n_{\mathrm{eff}}-2)$ | D4 |
| $t_{q,\nu}$ | Cuantil $q$ de la t de Student con $\nu$ g.l. | D4, E1 |
| $\Phi$ | Función de distribución normal estándar | D2, J |
| $S$ | Estadístico de Mann–Kendall (concordantes − discordantes) | D2 |
| $\tau$ | Tau de Kendall | D2 |
| $Z$ | Estadístico normal de Mann–Kendall | D2 |
| $p_{MK}$ | p bilateral de Mann–Kendall (preblanqueado) | D2 |
| $p_{\mathrm{eff}}$ | p bilateral de la regresión con $n_{\mathrm{eff}}$ | D4 |
| $\alpha=0{,}05$ | Nivel de significancia (`ALPHA`) | D5 |
| $\alpha_{\mathrm{ny}}=0{,}20$ | Umbral "todavía no" (`NOT_YET_P`) | D5 |
| $n^\ast$ | Años necesarios para detectar la tendencia | D6 |
| $U_k,\ K$ | Estadístico de Pettitt en el punto $k$ y su máximo | D8 |
| $m$ (en D10/H) | Número de pruebas simultáneas | D10, H3 |
| $q=0{,}10$ | Tasa de falsos descubrimientos objetivo (`FDR_Q`) | H3 |
| $p_{(i)}$ | $i$‑ésimo valor p ordenado | H3 |
| $\ell$ | Rezago en años (0, 1 o 2) | F1 |
| $r_{raw},\ r_{det},\ \rho_{det}$ | Pearson aparente, Pearson sin tendencia, Spearman sin tendencia | F |
| $R=6371\ \mathrm{km}$ | Radio terrestre medio usado en haversine | G |
| $\varphi,\lambda$ | Latitud y longitud (radianes) | G |
| $h$ | Semilado del recuadro satelital en km (`half_km`) | G1 |
| $\theta_{98}$ | Percentil 98 de $\lvert\text{pendiente}\rvert$ por variable (`slope_p98`) | H5 |
| $\kappa$ | Pendiente escalada $=\text{pendiente}/\theta_{98}$ | H6 |
| $r^{\mathrm{TS}},\ r^+$ | Autocorrelación lag‑1 del navegador y su parte positiva | W3 |

---

# PARTE 1 · Lo que se ejecuta EN EL NAVEGADOR de la web de José

> La web de José (`/home/user/jose21nc/datex`) **no tiene backend** (`api.ts:3-4,14-17,26-31`: si `VITE_API_URL` no está definida, `api()`/`apiPost()` llaman a `staticGet()`/`staticPost()` de `src/staticFallback.ts`). Todo cálculo ocurre, o bien (a) **precalculado** y leído de `public/static-api/{bundle,catalog,globe}.json`, o bien (b) **en el navegador** con el código TypeScript de esta parte. Los ficheros `bundle.json` (salvo ruido de coma flotante ≤1,8·10⁻¹² y 70 claves `relate` menos que en `/home/user/nasaspaceapp`) y `globe.json` coinciden con los del motor Python (Parte 2); `catalog.json` es idéntico.
>
> **Aviso metodológico.** El cálculo del navegador **no es el mismo** que el del motor Python: otra estimación de autocorrelación, preblanqueo *trend‑free* (TFPW, que el motor Python descartó), aproximaciones normales de la t, otra fórmula de años necesarios, otro criterio de veredicto, sin sensibilidad al periodo, etc. La Parte 3 las enumera una por una. Los ejemplos numéricos del navegador se obtuvieron **reproduciendo el algoritmo de `staticFallback.ts` en Python** sobre `backend/app/data/samples/*.json` (no se ejecutó el TypeScript en un navegador ni en Node): cualquier discrepancia con la ejecución real debe tomarse como error de este documento.

## W0. Qué se calcula dónde (mapa de rutas de `staticGet`)

| Ruta simulada | ¿Precalculado (bundle/globe)? | ¿Cálculo en navegador? | Referencia |
|---|---|---|---|
| `/api/catalog` | `catalog.json` tal cual | no | `staticFallback.ts:80-83,889-891` |
| `/api/globe` | `globe.json` tal cual (FDR, p98 ya calculados por Python, H) | no | `:85-88,892-894` |
| `/api/recommend` | `bundle.recommend` (35 claves = 5 preocupaciones × (1 + 6 tipos)); si falta, las 3 primeras variables del catálogo | no | `:897-909` |
| `/api/places/locate` | `bundle.locate` (7 puntos) por clave exacta, o por región a ≤45 km | sí: haversine; si no hay región, consulta a BigDataCloud o devuelve las coordenadas | `:910-957` |
| `/api/places/search` | no | Open‑Meteo + coincidencia local de regiones | `:732-776` |
| `/api/trend` | `bundle.trend` (119 = 7 regiones × 17 variables, `start=1990`) por clave exacta o región a ≤28 km (solo con `start=1990`) | **sí** para cualquier otra coordenada o año de inicio (W1–W3) | `:698-730` |
| `/api/scan` | `bundle.scan` (7 puntos, `start=1990`) | **sí** si no hay coincidencia: descarga POWER y llama a W2–W3 para cada variable (W3.11) | `:987-1014` |
| `/api/compare` | `bundle.compare` (17 variables) si `start=1990` | **sí** (por región, `resolveTrend`) en otro caso | `:963-986` |
| `/api/forecast` | `bundle.forecast` (280 = 7 regiones × 8 variables núcleo × 5 horizontes {2030, 2040, 2050, 2075, 2100}) | **sí** (W4) para cualquier otra variable/horizonte/coordenada | `:1023-1048` |
| `/api/demography` | `bundle.demography` (84 = 4 países × 7 indicadores × 3 horizontes {2030, 2050, 2100}, `start=1990`) | **sí**: con `start=1990` y horizonte 2040/2075 reutiliza `history`/`un_projection` del bundle pero **recalcula el escenario** (W6); otro país o año, descarga OWID | `:1049-1105` |
| `/api/relate` | `bundle.relate` (176 claves; NIC 111, BRA 37, MEX 24, DZA 4) solo con `lag=0` y sin excluir 2020–2021 | **sí** si hay rezago, exclusión de 2020–2021, o falta la clave (W5) | `:1106-1146` |
| `/api/satellite/timeline` | no | consulta STAC (W7) | `:1147-1200` |
| `/api/satellite/landcover` | no | **no existe**: lanza error; `SatelliteView.tsx:57,176` ni siquiera la pide si no hay backend | `:1201-1205` |
| `POST /api/ask`, `/api/explain` | no | reglas por expresiones regulares y plantillas de texto (W7), sin IA | `:1215-1301` |

- **Consecuencia importante.** Para un mismo punto de ejemplo (p. ej. Managua) la interfaz puede mostrar números del **motor Python** (bundle) o del **motor TypeScript** (navegador) según el año de inicio, el rezago, etc. (ver ejemplo en W3.12).
- Claves del bundle: `coordKey(lat,lon)` = `round(lat·100)/100` y `round(lon·100)/100` con `toFixed(2)`; clave de tendencia `VAR|lat,lon|start`; pronóstico `VAR|lat,lon|start|año`; relación `VAR|IND|PAIS|lat,lon|start` (`:95-99`).
- Pausa artificial: `paced(work)` espera `1000 + Random·1500` ms (1–2,5 s) a propósito para que el cargador no parpadee (`api.ts:19-24`, usado en tendencias, comparación, demografía, relación y satélite).

## W1. Emparejado de puntos con las regiones precalculadas

- **Haversine** (idéntico a G3, $R=6371$ km, con $\min(1,\sqrt a)$): `staticFallback.ts:101-109`.
- **Región más cercana dentro de un radio:** se elige la región del catálogo de menor distancia con $d\le r_{\max}$; $r_{\max}=28$ km para tendencias/escaneo/pronóstico/relación (solo si `start = generated_start = 1990`) y $45$ km para `locate` (`:111-123,915`). Fuera de ese radio se calcula en vivo.
- Límite: una coordenada a 27 km de Managua recibe **la serie y el veredicto de Managua** (celda POWER de ~50 km) sin recalcular.

## W2. Series mensuales → anomalías → medias anuales (navegador) — `computeTrendFromPowerDict`

- **Filtro:** clave `^\d{6}$`, mes 1–12, $\text{start}\le y\le$ `lastYear` (**2025 fijo**, `:470`), valor finito y $>-900$ (el motor Python excluye exactamente $-999$ y el mes 13). La descarga pide años 1981–2025 fijos (`:516-517`).
- **Climatología y anomalía mensual:** igual que B1: $\bar y_m$ = media de los valores crudos del mes $m$ (0 si no hay datos del mes), $a_{t,m}=y_{t,m}-\bar y_m$ (`:489-502`).
- **Media anual:**
$$A_t=\frac{1}{M_t}\sum_{m}y_{t,m}\quad\text{si }M_t\ge10\qquad(\text{media de los valores crudos})$$
  Diferencia con B2: Python promedia **anomalías** más el nivel base $\bar b$; el navegador promedia valores **crudos**. Son idénticos en años completos; en años con 10–11 meses el navegador **sí** puede sesgar la media anual por estacionalidad (falta un mes cálido/frío). `:493-498`.
- **Variables derivadas:** el navegador **no calcula** DTR, VPD ni WBGT. Para `/api/scan` y `/api/compare` en vivo pide a NASA POWER los 17 códigos del catálogo (`fetchPowerParams`, `:508-532`), pero DTR/VPD/WBGT no son parámetros de POWER y solo se mantienen las variables para las que POWER devolvió datos (`:1001-1003`). *Duda:* no se pudo comprobar sin red si POWER rechaza la petición completa por códigos desconocidos (ver sección P).
- **Ejemplo (Managua T2M, ene‑dic 1990 completos):** $A_{1990}=27{,}8883$ °C, igual que el bundle.

## W3. Tendencia y veredicto en el navegador — `analyzeAnnualTrend` (`:318-464`)

Entradas: serie anual $(x_i,A_i)$ de $n$ años. **Mínimos:** si $n<5$ devuelve una tendencia vacía (`no_trend`, `years_needed=30`, aviso "se necesitan al menos 15 años", `:330-362`); para $5\le n<15$ calcula todo pero fuerza `no_trend` (`:404`) con un aviso (`:409`).

### W3.1 Pendiente de Theil–Sen e IC (`theilSenAndCi`, `:290-312`)

$$\hat\omega=\operatorname{mediana}\Big\{\tfrac{A_j-A_i}{x_j-x_i}\Big\}_{i<j},\qquad
\hat a=\operatorname{mediana}_i(A_i-\hat\omega x_i)\ \ (\text{intercepto «conjunto»}),$$
$$\sigma_S^2=\frac{n(n-1)(2n+5)}{18}\ \ (\text{sin corrección de empates}),\quad c=1{,}96\,\sigma_S,\quad
i_l=\max\!\big(0,\lfloor\tfrac{N-c}{2}\rfloor\big),\quad i_u=\min\!\big(N-1,\lceil\tfrac{N+c}{2}\rceil-1\big)$$
  IC95 = (pendiente ordenada $[i_l]$, pendiente ordenada $[i_u]$) ×10 por década; se omiten pares con $x_j=x_i$. La mediana de un número par es la media de los dos centrales (`:153-158`).
- **Difiere de Python (C1):** intercepto $\hat a=\operatorname{mediana}(A-\hat\omega x)$ (no `median(y)−ω·median(x)`) y límites con `floor/ceil` en lugar de `round(…)−1` y `round(…)`.
- **Ejemplo (Managua):** pendiente $-0{,}2110$ °C/década (igual que Python), IC95 $[-0{,}3556;\,-0{,}0375]$ (Python: $[-0{,}3604;\,-0{,}0330]$); intercepto $70{,}1626$ (Python $70{,}1048$).

### W3.2 Autocorrelación lag‑1 corregida (`lag1BiasCorrected`, `:194-200`)

$$r=\operatorname{corr}(e_{1..n-1},e_{2..n})\ \ (0\text{ si }n<5),\qquad r^{\mathrm{TS}}=\operatorname{clamp}_{[-0{,}92;\,0{,}92]}\Big(\frac{n\,r+1}{\max(1,\,n-3)}\Big)$$
- $e$ = residuos de OLS (para $n_{\mathrm{eff}}$, `autocorrelation` publicado, años necesarios) o residuos $A_i-\hat\omega(x_i-x_1)$ (para el preblanqueo). La correlación `pearsonR` devuelve 0 si el denominador es 0 y se recorta a $[-1,1]$.
- **Difiere de Python (D1):** corrección $(nr+1)/(n-3)$ en vez de $r+(1+4r)/n$; cotas $[-0{,}92;\,0{,}92]$ en vez de $[0;\,0{,}95]$ (puede ser **negativa**); mínimo $n=5$ en vez de 4.
- **Ejemplo (Managua, OLS):** $r=0{,}4118\Rightarrow r^{\mathrm{TS}}=\frac{36\cdot0{,}4118+1}{33}=0{,}4795$ (Python: $0{,}4853$).

### W3.3 Regresión OLS con tamaño efectivo (`olsStats`, `:202-235`)

$$r^+=\max(0,r^{\mathrm{TS}}),\quad n_{\mathrm{eff}}=\max\!\Big(3,\ \min\!\Big(n,\ \frac{n(1-r^+)}{\max(0{,}05,\ 1+r^+)}\Big)\Big),\quad \nu=\max(1,n_{\mathrm{eff}}-2)$$
$$s^2=\frac{\mathrm{SSE}}{\max(1,n-2)},\quad \mathrm{se}=\sqrt{\frac{s^2\,(n/n_{\mathrm{eff}})}{S_{xx}}},\quad t=\frac{\hat\beta}{\mathrm{se}},\quad p_{\mathrm{OLS}}=p_t(t,\nu),\quad \mathrm{IC}_{95}=(\hat\beta\pm1{,}96\,\mathrm{se})\times10$$
- $p_t$ = **aproximación normal de la t** (`twoSidedTP`, `:139-149`): con $a=\lvert t\rvert$,
$$z=\begin{cases}a&\nu>200\\ \sqrt{\max\!\big(0,(\nu-0{,}5)\ln\!\big(1+\tfrac{a^2}{\max(1,\nu-0{,}5)}\big)\big)}\,\Big(1-\frac{1}{4\nu}\Big)&\text{otro caso}\end{cases},\qquad p=\operatorname{clamp}_{[10^{-12},1]}\big(2[1-\Phi(z)]\big);\quad p=1\ \text{si }\nu\le1$$
  $\Phi$ = normal con la aproximación de Abramowitz–Stegun 7.1.26 (`normalCdf`, `:124-133`, error <1,5·10⁻⁷). Precisión frente a la t exacta (calculada en este documento): $t=1{,}41,\nu=10{,}5$: $0{,}1878$ vs $0{,}1865$; $t=2,\nu=10$: $0{,}0748$ vs $0{,}0734$; $t=3,\nu=5$: $0{,}0347$ vs $0{,}0301$; $t=2{,}5,\nu=3$: $0{,}105$ vs $0{,}088$ (la aproximación es **conservadora** con pocos g.l.).
- **Difiere de Python (D3–D4):** $n_{\mathrm{eff}}\le n$ y denominador $\max(0{,}05,1+r^+)$; error estándar $\sqrt{s^2(n/n_{\mathrm{eff}})/S_{xx}}$ (equivale a $\mathrm{se}_0\sqrt{n/n_{\mathrm{eff}}}$, no $\mathrm{se}_0\sqrt{(n-2)/\nu}$); IC con **1,96** (normal) en vez de $t_{0{,}975,\nu}$ (el IC es más estrecho); $p$ aproximado.
- **Ejemplo (Managua):** $n_{\mathrm{eff}}=12{,}664$ (Python $12{,}474$); $\mathrm{se}=0{,}012803$/año; $p_{\mathrm{OLS}}=0{,}1612$ (Python $0{,}1865$); IC95/década $[-0{,}4443;\ +0{,}0576]$ (Python $[-0{,}4964;\ +0{,}1096]$).

### W3.4 Mann–Kendall con preblanqueo *trend‑free* (TFPW) (`mannKendallPrewhitened`, `:237-261`)

$$e_i=A_i-\hat\omega(x_i-x_1),\quad r_1=r^{\mathrm{TS}}(e),\qquad
w_i=\begin{cases}e_i-r_1e_{i-1}+\hat\omega(x_i-x_1)&\lvert r_1\rvert\ge0{,}05\ \ (i=2..n)\\ A_i&\text{si }\lvert r_1\rvert<0{,}05\ \ (\text{serie original completa})\end{cases}$$
$$S=\sum_{i<j}\operatorname{sgn}(w_j-w_i),\quad k=\text{longitud de }w,\quad \tau=\frac{S}{k(k-1)/2},\quad
\operatorname{Var}(S)=\frac{k(k-1)(2k+5)}{18},\quad Z=\frac{S-\operatorname{sgn}(S)}{\sqrt{\operatorname{Var}(S)}},\quad p_{MK}=\operatorname{clamp}_{[10^{-12},1]}\big(2[1-\Phi(\lvert Z\rvert)]\big)$$
- Si $n<5$: $(\tau,p)=(0,1)$. **Sin corrección de empates**; **siempre normal** con **corrección de continuidad** $(S-\operatorname{sgn}S)$; $\tau$ es la tau‑a **de la serie preblanqueada**.
- **Difiere de Python (D2):** (i) es **TFPW** (quita tendencia → preblanquea el residuo → devuelve la tendencia), método que el README/RETO del motor Python dicen haber **descartado** por 20–58 % de falsos positivos; el motor Python usa preblanqueo simple $w_i=A_i-r^\ast A_{i-1}$; (ii) preblanquea también con $r_1<0$ (coeficiente negativo), Python solo con $r^\ast>0$; (iii) $\tau$ de la serie preblanqueada (Python: τ‑b de la original); (iv) sin método exacto ni empates; (v) con continuidad.
- **Ejemplo (Managua T2M 1990–2025):** $r_1=0{,}4795$, $k=35$, $S=-187$, $\tau=-0{,}3143$, $Z=\frac{-187+1}{70{,}42}=-2{,}641$, $p_{MK}=0{,}0083$ (Python: $S=-113$, $p=0{,}1085$). **Con el mismo dato, el navegador concluye "significativa" y el motor Python "todavía no".**

### W3.5 Salto brusco, versión del navegador (`pettittStepYear`, `:263-288`)

$$R_i=1+\#\{j:A_j<A_i\}+\tfrac12\#\{j\ne i:A_j=A_i\},\qquad U_t=\Big\lvert2\sum_{i\le t}R_i-(t+1)(n+1)\Big\rvert,\qquad p=2\exp\!\Big[\tfrac{-6\max_tU_t^2}{n^3+n^2}\Big]$$
$$\text{se avisa si}\ \ n\ge20\ \land\ p<0{,}05\ \land\ 0<t^\ast<n-1,\qquad \text{año}=x_{t^\ast+1}\quad(t\text{ 0‑based},\ t=0..n-2)$$
- $U_t$ (rangos de Mann–Whitney) es equivalente al $U_k$ de Pettitt de D8 (mismo máximo; empates con rangos medios). **Difiere de Python:** exige $n\ge20$, **no** exige que el escalón explique mejor que la recta ($\mathrm{RSS}_{esc}<0{,}7\,\mathrm{RSS}_{rec}$), y el aviso se escribe "Posible cambio brusco o salto hacia {año} (prueba de Pettitt p < 0,05)". Por tanto avisa **con más frecuencia**.
- **Ejemplo (Managua):** $U=205$, $t^\ast=8$ (0‑based), $p=0{,}0104$ ⇒ **avisa "salto hacia 1999"** (Python no avisa porque $\mathrm{RSS}$ ratio $=0{,}7006\ge0{,}7$).

### W3.6 Cambio total y porcentual (`:372-376`)

$$\Delta_{tot}=\hat\omega\,(x_n-x_1),\qquad \%\Delta=\frac{\Delta_{tot}}{\lvert\hat a+\hat\omega x_1\rvert}\times100\ \ (\text{solo si }\texttt{ratio\_scale}\text{ y }\lvert\hat a+\hat\omega x_1\rvert>10^{-6})$$
- **Difiere de Python (C2):** la base es el valor **ajustado** de Theil–Sen en el primer año, no la media de los 5 primeros años (y el umbral es $10^{-6}$, no $10^{-9}$).

### W3.7 Años necesarios (`:376-400`)

$$n^\ast_{TS}=\min\!\Big(200,\ \max\!\Big(15,\ \Big\lceil\Big(\frac{3{,}3\,s}{\lvert\hat\omega\rvert}\sqrt{\frac{1+r^+}{\max(0{,}05,\ 1-r^+)}}\Big)^{2/3}\Big\rceil\Big)\Big),\qquad s=\sqrt{\mathrm{SSE}_{\mathrm{OLS}}/(n-2)}$$
- Si $\lvert\hat\omega\rvert\le10^{-9}$: 120. El valor publicado es `correctedYearsNeeded`; hay una primera expresión `yearsNeeded` (con una precedencia de operadores distinta: `…**0.5)**(2/3)`) que **solo se usa para comprobar que es finita** (`:452`). Se muestra **siempre** (incluso con veredicto `significant`).
- **Difiere de Python (D6) de forma sustancial:** **falta el factor $\sqrt{12}$** (el valor es $12^{1/3}=2{,}29$ veces menor), $s$ es el error típico residual de **OLS** (no $\sigma$ de Theil–Sen), la autocorrelación es $r^+\le0{,}92$, y hay piso 15 y techo 200. La validación "≈90 % de detección" que cita la documentación corresponde a la fórmula de Python **con** $\sqrt{12}$; para la del navegador no hay validación en el repo.
- **Ejemplo (Managua):** navegador $n^\ast=25$ años; Python $58$ años (`bundle.json`).

### W3.8 Veredicto y acuerdo entre pruebas (`:402-405`)

$$\text{veredicto}=\begin{cases}\text{no\_trend}&n<15\\ \text{significant}&p_{MK}<0{,}05\\ \text{not\_yet}&0{,}05\le p_{MK}<0{,}20\\ \text{no\_trend}&p_{MK}\ge0{,}20\end{cases},\qquad
\text{methods\_agree}=\big[(p_{MK}<0{,}05)=(p_{\mathrm{OLS}}<0{,}05)\big]\land\big[\operatorname{sgn}\hat\omega=\operatorname{sgn}\hat\beta\big]$$
$$\text{significant (booleano)}=[p_{MK}<0{,}05],\qquad \text{dirección}=\begin{cases}\text{flat}&\lvert10\hat\omega\rvert<10^{-6}\\ \text{up/down}&\text{por el signo}\end{cases}$$
- **Difiere de Python (D5):** el veredicto del navegador **no** exige que el IC de OLS excluya el cero y **no** manda a `not_yet` cuando las pruebas discrepan; `methods_agree` solo se muestra, **no influye**. El umbral de 0,05 y 0,20 sí coincide.

### W3.9 Avisos y sensibilidad al periodo

- Avisos generados en el navegador (`:407-416`): serie corta ($n<15$); salto (W3.5); discrepancia MK/OLS (`!methods_agree`). **No** genera el aviso de autocorrelación alta ($r>0{,}5$), **ni** `period_sensitive` (siempre `false`, `:453`). En inglés, los textos de aviso del navegador ("Posible cambio brusco…", "Mann‑Kendall y regresión OLS discrepan…") no coinciden con los prefijos que traduce `translateWarning` y se muestran en español.

### W3.10 Recta de tendencia y textos

- `trend_line` = recta de Theil–Sen **en todos los años** (en Python, solo los extremos): $\hat a+\hat\omega x$. Textos: `fmtEs(x,d)` = `toFixed(d)` con coma; veredicto "Tendencia confirmada…" / "todavía no significativa… harían falta unos $n^\ast$ años de datos (hay $n$)" / "Sin tendencia clara…" (`:418-427`). `p_adjusted` = `null` salvo en el escáner (W3.11).

### W3.11 Corrección de Bonferroni en el escaneo en vivo (`:1001-1008`)

$$p^{adj}_j=\min(1,\ m\,p_{MK,j}),\qquad m=\max(1,\ \text{número de variables que devolvió POWER})$$
- $m$ excluye las derivadas, de modo que es ≤14 (en Python, 17). Solo informativo, no entra al veredicto. En el escaneo **precalculado** (`bundle.scan`) $m=17$ (D10).

### W3.12 Ejemplo comparado: Managua T2M 1990–2025

| Resultado | Motor Python (bundle; lo que se ve con `start=1990` en Managua) | Navegador (si se recalcula, p. ej. otro año de inicio con el mismo punto) |
|---|---|---|
| Pendiente (°C/década) | $-0{,}2110$ | $-0{,}2110$ |
| IC95 Theil–Sen | $[-0{,}3604;-0{,}0330]$ | $[-0{,}3556;-0{,}0375]$ |
| $r$ lag‑1 publicado | $0{,}4853$ | $0{,}4795$ |
| $n_{\mathrm{eff}}$ | $12{,}47$ | $12{,}66$ |
| $p_{\mathrm{OLS}}$ | $0{,}1865$ | $0{,}1612$ |
| $p_{MK}$ | $0{,}1085$ | $0{,}0083$ |
| Años necesarios | $58$ | $25$ |
| Salto (Pettitt) | no | sí, 1999 |
| Sensible al periodo | sí | siempre no |
| **Veredicto** | **not_yet** | **significant** (según W3.8) |

*(El navegador solo recalcula cuando no hay clave exacta en el bundle; las columnas son ilustrativas de lo que daría el algoritmo del navegador sobre los mismos datos.)*

## W4. Escenario lineal en el navegador — `buildEarthForecast` (`:534-581`)

$$\hat\beta=\frac{\texttt{ols\_slope\_per\_decade}}{10},\quad \hat\alpha=\bar A-\hat\beta\bar x,\quad s=\sqrt{\frac{\mathrm{SSE}}{\max(1,n-2)}},\quad n_e=\max(3,\ n_{\mathrm{eff}}^{\text{publicado}})$$
$$\hat y(x_0)=\hat\alpha+\hat\beta x_0,\qquad \text{semiancho}=1{,}96\;s\sqrt{1+\frac1{n_e}+\frac{(x_0-\bar x)^2}{S_{xx}}}\ \ (\text{si }S_{xx}=0,\text{ el último término es }0)$$
- Puntos para $x_0=x_n+1,\dots,\text{to\_year}$; **sin recorte a límites físicos** (puede dar humedad $<0$ o $>1$, % fuera de 0–100); aviso único: autocorrelación publicada $>0{,}25$; `n_points` = número de **años futuros** (en Python es $n$); texto con `fmtEs` (3 decimales en la tasa por década, 1 decimal en valores) y unidad sin traducir.
- **Difiere de Python (E1–E3):** z=1,96 en vez de $t_{0{,}975,n-2}$; término $1/n_e$ (con $n_e$ del navegador o del bundle) en vez de $1/n$ (banda más ancha cuando hay autocorrelación); no hay avisos de horizonte, de tendencia no significativa ni de límite físico; no hay bounds; umbral de autocorrelación $0{,}25$ (Python $0{,}3$ sobre $r_1$ crudo). `trend.n_effective` y `ols_slope_per_decade` provienen de la tendencia que se le pasa (del bundle → Python, o del navegador).
- **Dónde se usa:** `bundle.forecast` cubre 8 variables × 5 horizontes × 7 regiones; en cualquier otro caso (otra variable, otra coordenada, escenario de demografía, `/api/explain`) se usa esta función.
- **Ejemplo (Managua 2050, tendencia navegador):** $\hat y=26{,}9425$, banda $[25{,}790;\ 28{,}095]$ (Python/bundle: $[25{,}767;\ 28{,}118]$).

## W5. Relación clima–sociedad en el navegador — `buildRelation` (`:603-696`)

- **Años:** puntos del indicador con $x_1^{earth}\le y\le x_n^{earth}+\ell$; serie Tierra desplazada: clave $y+\ell$; `overlap` = años con ambos; exclusión de {2020, 2021} opcional; se exige **≥8** años en común (Python: 10), si no lanza error. La serie de la Tierra es `series.annual` de la tendencia (bundle o navegador).
- **Correlación aparente:** $r_{raw}$ (`pearsonR`, 0 si $n<3$ o varianza 0; recortada a $[-1,1]$).
- **«Sin tendencia» = primeras diferencias** (no residuo de regresión lineal): $\Delta e_i=e_{i+1}-e_i$, $\Delta g_i=g_{i+1}-g_i$ ($n-1$ pares); $r_{det}=\operatorname{pearsonR}(\Delta e,\Delta g)$; $\rho_{det}$ = Pearson de rangos medios de las diferencias (`spearmanRho`, `:177-192`).
- **$p$ de cada correlación** (`pFromR`): $p=1$ si $n\le3$; $p=0$ si $\lvert r\rvert\ge0{,}9999$; si no $t=r\sqrt{\frac{n-2}{\max(10^{-9},1-r^2)}}$ y $p=p_t(t,\,n-2)$ con la aproximación normal de W3.3 (`:637-642`). $n$ = pares en común (para $r_{raw}$) y $n-1$ (para diferencias).
- **Reglas:**
$$\text{fuerza}=\begin{cases}\text{fuerte}&p_{det}<0{,}05\land\lvert r_{det}\rvert\ge0{,}5\\ \text{moderada}&\lvert r_{det}\rvert\ge0{,}25\\ \text{débil}&\text{otro}\end{cases},\quad
\text{trend\_driven}=\lvert r_{raw}\rvert\ge0{,}5\land p_{raw}<0{,}05\land p_{det}\ge0{,}1,\quad \text{significant}=p_{det}<0{,}05$$
- `points`: la primera fila tiene `earth_detrended = indicator_detrended = 0` (la diferencia empieza en el 2.º año). Avisos: rezago, años excluidos, y si `trend_driven` "Correlación aparente dominada por tendencias paralelas…". **No** genera el aviso de pocos años, el de Pearson≠Spearman ni la nota de escala espacial; `spatial_note` no se calcula.
- La tendencia del indicador usa `analyzeAnnualTrend` (W3) con `ratio_scale = indMeta.ratio_scale ?? true` (`:614`).
- **Difiere de Python (F1–F4):** mínimo 8 vs 10; diferencias vs. residuo de regresión; $p$ de Pearson por aproximación; umbrales de fuerza (0,25/0,5 con condición de $p$ vs 0,3/0,5 solo con $\lvert r\rvert$); `trend_driven` más estricto (exige $\lvert r_{raw}\rvert\ge0{,}5$ y $p_{det}\ge0{,}1$); sin comprobación de series constantes.
- **Ejemplo (Corredor Seco, `GWETROOT` vs. rendimiento de cereales de Nicaragua, 1990–2023, $n=34$, `lag=0`):** navegador: $r_{raw}=0{,}4746$ ($p=0{,}0046$), $r_{\Delta}=-0{,}2273$ ($p=0{,}2035$), $\rho_\Delta=-0{,}1805$ ($p=0{,}3149$); `trend_driven=False` (porque $\lvert r_{raw}\rvert<0{,}5$), fuerza "débil". Python (el que muestra el bundle cuando `lag=0`): $r_{det}=-0{,}1369$ ($p=0{,}4399$), `trend_driven=True`.

## W6. Demografía en el navegador (`:800-820,1049-1105`)

- **Con bundle** (`NIC/BRA/MEX/DZA`, `start=1990`): `history` y `un_projection` del bundle (calculados por Python); si el horizonte no está precalculado (2040 y 2075 en la interfaz), se devuelve el bundle de 2100 o 2050 con `un_projection` **filtrada** a $y\le\text{to\_year}$, `un_value_at_horizon` = último valor filtrado y `forecast = buildEarthForecast(tendencia del bundle, to_year)` (W4: sin límites físicos). `:1057-1068`.
- **Sin bundle:** descarga el CSV de OWID (`csvType=filtered`, slug por indicador, `:1074-1090`) y `parseOwidCsv`: columna de valor = **la última columna**; filas con año $\le$ **2023 (fijo)** → histórico, $>2023$ → proyección ONU (Python separa por la cabecera "projected"). Tendencia = `analyzeAnnualTrend` sobre los años $\ge\text{start}$ (o toda la serie si hay <5), con `ratio_scale` del indicador; escenario = W4.
- **Interfaz:** la serie histórica mostrada filtra año $\ge1950$ (`DemographyView.tsx:152`); horizontes 2030/2040/2050/2075/2100 (`:118`).

## W7. Satélite, lugares, preguntas y explicaciones (navegador)

- **Línea de tiempo satelital** (`:1147-1200`): ignora el parámetro `years`; usa objetivos fijos $[1990,2000,2010,2016,2020,2025]$; recuadro $[\lambda\pm0{,}08,\ \varphi\pm0{,}08]$ en grados (≈ ±8,9 km en latitud y $\pm8{,}9\cos\varphi$ km en longitud: **no** es cuadrado en el terreno); colección: $y\ge2016$ Sentinel‑2 L2A, si no Landsat C2 L2 (sin filtro de plataforma ni exclusión de Landsat 7); nubosidad $<35\,\%$ (Python: $<20\,\%$); `limit=8`; se queda, entre las escenas con `rendered_preview`, con la de **menor** `eo:cloud_cover` (`sort` local); plataforma = "Sentinel‑2" o "Landsat". Si ninguna escena: error.
- **Cobertura del suelo, área construida y su escenario:** no existen en esta web (G4–G5 y E5 son solo del motor Python).
- **Interpretación de preguntas** (`interpretQuestion`, `:778-798`): reglas con expresiones regulares sobre `question.toLowerCase()` (sin quitar tildes): preocupación = primera que coincide en el orden water → drought → sun → wind, si no `heat`; tipo de lugar = primero que coincide en city → farmland → forest → coast → dry → cold; `placeQuery` = texto tras " en/de/in/of " que empiece por mayúscula (2–32 caracteres). **No** hay puntuación por conteo ni desempate como en Python (I2).
- **Explicación `/api/explain`:** plantilla fija (`buildTemplateExplanation`, `:822-881`) con cifras ya calculadas, sin IA. Para tendencia reutiliza `buildEarthForecast` si `to_year` viene en la petición.
- **Búsqueda de lugares:** Open‑Meteo (`count=8`), `ISO2_TO_ISO3` tabla fija; si falla, coincidencia por subcadena con regiones locales. **Localización:** bundle → región ≤45 km → BigDataCloud → coordenadas (distance_km = 0).

## W8. Cálculos de presentación en la web de José

| Cálculo | Fórmula | Referencia |
|---|---|---|
| Certeza ("% de certeza") | $\mathrm{pct}=\max(5,\min(99{,}9,(1-p_{MK})\cdot100))$; para `no_trend` el campo vale $\min(\mathrm{pct},79)$ (D11) | `i18n.ts:311-347` |
| Barra de suficiencia de datos | `significant` ⇒ 100; si no, $\max\!\big(12,\min(96,\operatorname{round}(100\,n/\max(1,n_{needed})))\big)$ con $n_{needed}=\texttt{years\_needed}\ ??\ n$; años que faltan $=\texttt{years\_needed}-n$ si positivo | `TrendView.tsx:51-55` |
| Serie estandarizada (comparador) | $z_i=(A_i-\bar A)/\operatorname{sd}_{pob}$, $\operatorname{sd}_{pob}=\sqrt{\tfrac1n\sum(A_i-\bar A)^2}$ ($\to1$ si 0); por lugar, eje año = unión de años | `ComparePlaces.tsx:73-83` |
| Serie estandarizada (relación) | igual que la anterior, para `earth` e `indicator` | `RelateView.tsx:22-26,79-83` |
| Barra de fuerza de la relación | ancho $=\min(100,\lvert r_{det}\rvert\cdot100)\,\%$ | `RelateView.tsx:206` |
| Gráfico de tendencia | $\text{offset}=\bar A$; se dibuja $A_t-\text{offset}$, recta, escenario y banda menos offset; $x_{anual}=y+0{,}5$; $x_{mensual}=y+(m-0{,}5)/12$ | `TrendChart.tsx:27-43` |
| Escenario en gráfica genérica | une series por año; banda $[low,high]$ | `SeriesChart.tsx:24-33` |
| Barras de cobertura del suelo | ancho $=\min(100,\%)$ (solo con backend) | `SatelliteView.tsx:164` |
| Años de inicio ofrecidos | $\{\text{first\_year},\dots,\text{last\_year}-14\}$ (1981…2011) para garantizar ≥15 años | `App.tsx:278` |
| Ayudas de selección de lugar | región "activa" si $\lvert\Delta\varphi\rvert<0{,}05$ y $\lvert\Delta\lambda\rvert<0{,}05$ | `GlobeSection.tsx:249`; `ComparePlaces.tsx` |
| Resumen de portada | `variables` = `cat.variables.length` (17), años = `last_year − first_year + 1` (45), celdas "2.592" **literal**, países = nº de claves de `countries` | `Briefing.tsx:26-33` |
| Tabla Monte Carlo de la portada | **datos fijos escritos a mano**, no calculados: $\phi=0$: 4,8 % vs 3,6 %; $\phi=0{,}4$: 19,3 % vs 4,8 %; $\phi=0{,}8$: 49,0 % vs 8,2 % | `Briefing.tsx:6-10` |
| Formato numérico | `fmtNum(x)`= `toLocaleString(locale,{maximumSignificantDigits:d})` (d=3 por defecto) y `-0`→`0`; `compactNum`: notación compacta si $\lvert x\rvert\ge10^4$; `fmtProb(p)`: `< 0,0001` si $p<10^{-4}$, si no `toFixed(4)`; `pTextLang`; `fmt/fmtP` de `api.ts` (solo `es`) | `i18n.ts:8-32`; `api.ts:144-153` |
| Porcentaje de cambio mostrado | `toFixed(1)` con signo | `i18n.ts:361`; `TrendView.tsx:87` |
| Texto del escenario | $\text{tasa}=\texttt{slope\_per\_year}\cdot10$; `fmtNum` (3 cifras) | `i18n.ts:476-486` |

### W8.1 Color y opacidad de las celdas del globo (continuo, no por clases) — `globeColors.ts`, `Globe3D.tsx`

$$t=\operatorname{clamp}_{[-1,1]}\!\Big(\frac{\text{pendiente}}{\theta_{98}}\Big)\ (0\text{ si }\theta_{98}=0),\qquad
C_{canal}=\operatorname{round}\!\big(235+(c_{objetivo}-235)\,\lvert t\rvert\big),\quad c_{objetivo}=\begin{cases}\text{color negativo}&t<0\\ \text{color positivo}&t\ge0\end{cases}$$
$$\alpha=\begin{cases}0{,}22+0{,}54\cdot\min\!\big(1,\ \lvert\text{pendiente}/\theta_{98}\rvert\big)&\text{si la celda pasa FDR}\\ 0{,}06&\text{si no pasa}\end{cases}$$
- Interpolación lineal en RGB desde el gris neutro $(235,235,235)$ hacia el color extremo. Paletas $[\text{negativo},\text{positivo}]$: `T2M` `#4f8cff`→`#ff5a4f`; `PRECTOTCORR`, `GWETROOT`, `RH2M` `#c8843c`→`#2fc7b5`; `WS2M` `#8f7cf6`→`#f2b84b`; variable desconocida → paleta de `T2M`. Leyenda: gradiente lineal `neg → #ebebeb → pos` con etiquetas $-\theta_{98}$, 0, $+\theta_{98}$ a 2 cifras (`globeColors.ts:22-25`, `GlobeSection.tsx:189-194`). Con "solo cambios confirmados" las celdas que no pasan FDR se omiten (`Globe3D.tsx:156`).
- $\theta_{98}$ = `slope_p98` de `globe.json` (precalculado, H5). Geometría y recorte a ±85° como en H7 (`Globe3D.tsx:148-170`); `pct = round(100·fdr_significant / max(1, cells))` (`GlobeSection.tsx:99`). El texto de ayuda muestra $n$ = número de celdas y "BH FDR q = 0,10".
- **Ejemplo (`T2M`, $\theta_{98}=0{,}893$):** celda de pendiente $+0{,}514$ que pasa FDR: $t=0{,}576$; canales $R=\operatorname{round}(235+(255-235)\cdot0{,}576)=247$ (de `#ff` = 255), $G=\operatorname{round}(235+(90-235)\cdot0{,}576)=152$, $B=\operatorname{round}(235+(79-235)\cdot0{,}576)=145$ ⇒ `rgba(247,152,145,α)` con $\alpha=0{,}22+0{,}54\cdot0{,}576=0{,}531$.

### W8.2 Lo que **no** existe en la web de José (existe en otros árboles del repo)

La web de José **no incluye**: `stats.ts` (Pearson/Fisher/`seFromCI`), `TrendTables.tsx` (descriptivos, CV, tabla de métodos, tabla por año), la prueba de diferencia de pendientes entre dos lugares ni las correlaciones entre series en `ComparePlaces`, las tablas de `DemographyView`/`RelateView`/`SatelliteView`, la vista de crecimiento urbano 3D ni la escala de 7 clases de color. Esos cálculos solo aparecen en el frontend de `/home/user/nasaspaceapp` (resumidos en el Apéndice).

---

# PARTE 2 · Motor que generó los datos precalculados de la web (backend Python de `/home/user/nasaspaceapp`)

> Esta parte documenta el motor `backend/app/**` y `backend/scripts/*.py` que produjo `bundle.json` y `globe.json` (verificado: los valores de la web de José coinciden con los del motor a 1,8·10⁻¹² de error relativo, con 70 claves `relate` menos). **La web de José no ejecuta nada de esto**: solo lee los resultados. Las fórmulas siguen siendo la referencia metodológica oficial (README, `docs/RETO.md`) y son las que se ven para los 7 puntos de ejemplo con `start=1990`. Las referencias de línea son de `/home/user/nasaspaceapp` salvo que se diga "web de José".

---

## A. Datos de entrada y variables derivadas

Archivo: `backend/app/services/power.py`.

### A1. Limpieza de la respuesta de NASA POWER

- **Propósito:** descartar valores faltantes y los promedios anuales que POWER mezcla con los meses.
- **Regla:** se conserva el valor $v$ de la clave `YYYYMM` solo si $v\neq -999{,}0$ (`MISSING`) **y** la clave no termina en `"13"` (mes 13 = promedio anual de POWER).
- **Referencia:** `power.py:25`, `power.py:65-71`.
- **Supuestos/límites:** la comparación es de igualdad exacta con `-999.0`; no hay validación de rangos físicos de las 14 variables de origen.

### A2. Rango térmico diurno (DTR)

- **Propósito:** diferencia entre la temperatura máxima y mínima diaria promedio del mes.
$$\mathrm{DTR}_{t,m}=T2M\_MAX_{t,m}-T2M\_MIN_{t,m}\qquad[^\circ\mathrm{C}]$$
- **Parámetros:** se calcula solo para claves `YYYYMM` presentes en ambas series; se redondea a 4 decimales. Catálogo: `ratio_scale=True`, `derived=True` (`catalog.py:123-127`).
- **Supuestos/límites:** se opera sobre medias mensuales de máximas y mínimas diarias (no sobre días individuales). Aunque es una diferencia en °C, el catálogo la marca como escala de razón (permite % de cambio).
- **Referencia:** `power.py:45-47`.
- **Ejemplo (Managua, ene‑1990):** $T_{max}=34{,}69$, $T_{min}=21{,}25$ ⇒ DTR $=13{,}44\ ^\circ$C (valor almacenado: 13,44).

### A3. Déficit de presión de vapor (VPD)

- **Propósito:** "sed" de la atmósfera; mide cuánto vapor le falta al aire para saturarse.
$$e_s(T)=0{,}6108\,\exp\!\left(\frac{17{,}27\,T}{T+237{,}3}\right)\ \mathrm{kPa},\qquad
e_a=e_s(T)\cdot\frac{\min\!\big(100,\max(0,\mathrm{RH})\big)}{100},\qquad
\mathrm{VPD}=\max(0,\;e_s-e_a)$$
- **Símbolos:** $T$ = `T2M` (°C, media mensual), RH = `RH2M` (%). $e_s$ presión de vapor de saturación; $e_a$ presión de vapor real. Resultado en kPa, redondeado a 4 decimales.
- **Constantes:** $0{,}6108$ kPa, $17{,}27$, $237{,}3\ ^\circ$C (forma de Tetens/Murray).
- **Supuestos/límites:** usa $T$ y RH **medias mensuales**; como $e_s$ es convexa en $T$, VPD de medias mensuales no es la media de VPD diarios (sesgo por no linealidad). Se calcula solo en claves comunes a `T2M` y `RH2M`.
- **Referencia:** `power.py:49-55`; catálogo `catalog.py:118-122`.
- **Ejemplo (Managua, ene‑1990):** $T=27{,}83$, RH $=59{,}5$ ⇒ $e_s=3{,}7427$ kPa, $e_a=2{,}2269$ kPa, VPD $=1{,}5158$ kPa (almacenado: 1,5158).

### A4. Estrés térmico húmedo (WBGT aproximado, fórmula BoM en sombra)

- **Propósito:** índice compuesto calor‑humedad (carga térmica sobre el cuerpo humano).
$$\mathrm{WBGT}\approx 0{,}567\,T+0{,}393\,e+3{,}94\qquad[^\circ\mathrm{C}],\qquad e\;[\mathrm{hPa}]=10\cdot e_a\;[\mathrm{kPa}]$$
- **Símbolos:** $T$ = `T2M` (°C); $e_a$ la presión de vapor real de A3 (convertida de kPa a hPa multiplicando por 10). Redondeo a 4 decimales.
- **Supuestos/límites:** aproximación **en sombra** (sin radiación solar directa ni viento local); la fórmula original de la BoM calcula $e$ con $6{,}105\exp(17{,}27T/(237{,}7+T))\cdot\mathrm{RH}/100$; el código reutiliza su propio $e_a$ de A3 (constantes $0{,}6108$ y $237{,}3$), una diferencia numérica pequeña. Se aplica a medias mensuales.
- **Referencia:** `power.py:56-57`; catálogo `catalog.py:128-132` (`ratio_scale=False`).
- **Ejemplo (Managua, ene‑1990):** $0{,}567\cdot27{,}83+0{,}393\cdot22{,}269+3{,}94=28{,}4713\ ^\circ$C (almacenado: 28,4713).

### A5. Ventana temporal, caché y emparejado de muestras

- **Ventana:** `FIRST_YEAR = 1981`; `last_full_year() = año_actual − 1` (`power.py:21,30-31`). La petición a POWER usa `community=AG` y solo los 14 parámetros no derivados (`power.py:74-83`).
- **Caché en memoria:** clave $(\mathrm{round}(\text{lat},2),\ \mathrm{round}(\text{lon},2))$, TTL $6\cdot3600=21\,600$ s, máximo 256 entradas con expulsión del más antiguo (`power.py:23-24,101-117`).
- **Muestra local:** se usa la muestra de una región de ejemplo si $|\Delta\text{lat}|<0{,}01$ y $|\Delta\text{lon}|<0{,}01$ (`power.py:90-96`). Las variables derivadas se **recalculan** al cargar la muestra (`_clean` → `_derive_variables`), no están guardadas en los JSON.
- **Validación de periodo (API):** `start ≥ 1981`, `end ≤ last_full_year`, `end > start`, y `end − start + 1 ≥ 15` (`main.py:89-95`). Valor por defecto `start = 1990`.

---

## B. Anomalías, desestacionalización y medias anuales

Archivo: `backend/app/services/trends.py`.

### B1. Climatología y anomalías mensuales (desestacionalización)

- **Propósito:** quitar el ciclo estacional restando a cada mes la media de ese mes del calendario.
$$\bar y_m=\frac{1}{|Y_m|}\sum_{t\in Y_m}y_{t,m},\qquad a_{t,m}=y_{t,m}-\bar y_m$$
- **Símbolos:** $Y_m$ = conjunto de años del periodo $[\text{start},\text{end}]$ en los que existe el mes $m$ (se usan **todos** los años, también los incompletos).
- **Supuestos:** el ciclo estacional es estable durante el periodo; la climatología se calcula con el mismo periodo que se analiza (no hay periodo base fijo tipo 1981‑2010). La media de todas las anomalías mensuales es 0 (verificado por test: `tests/test_trends.py:122-126`).
- **Referencia:** `trends.py:206-212,223-236`.
- **Ejemplo (Managua T2M 1990–2025):** $\bar y_1=27{,}172$, $\bar y_4=30{,}221$ °C (abril, el mes más cálido), $\bar y_{11}=26{,}428$ °C. Para ene‑1990: $a=27{,}83-27{,}172=+0{,}658$ °C. Se generan 432 puntos mensuales ($36\times12$).

### B2. Media anual (con nivel base)

- **Propósito:** serie anual con un valor por año, expresada en unidades de la variable.
$$\bar b=\frac{1}{12}\sum_{m=1}^{12}\bar y_m,\qquad
A_t=\bar b+\frac{1}{M_t}\sum_{m\in\text{meses válidos de }t}a_{t,m}\quad\text{si }M_t\ge 10$$
- **Parámetros:** `MIN_MONTHS_PER_YEAR = 10`. Años con $M_t<10$ se descartan de la serie anual (pero sus meses sí entran en la climatología y en la lista de anomalías mensuales). El promedio de $\bar b$ se hace sobre las climatologías disponibles (`clim.values()`).
- **Supuestos/límites:** al promediar anomalías (no valores crudos), que falte un mes de verano no sesga el año (test: `tests/test_trends.py:98-108`). Es una media aritmética sin ponderar por días del mes.
- **Referencia:** `trends.py:42-43,215-244`.
- **Ejemplo (Managua 1990):** $\bar b=27{,}76435$; media de las 12 anomalías de 1990 $=+0{,}12398$ ⇒ $A_{1990}=27{,}88833\ ^\circ$C (coincide con `bundle.json`, `T2M|12.13,-86.25|1990`, `series.annual[0]`).

### B3. Mínimos de datos para analizar

- Una serie anual necesita **al menos 15 años** (`MIN_YEARS = 15`); si no, se lanza `InsufficientData` (HTTP 422 en `/api/trend`; omitida en `/api/scan` y en `/api/compare`). Aplica a `analyze` y a `analyze_annual` (`trends.py:42,257-263,280-284`).
- `analyze_annual` también se usa para series que ya son anuales (Banco Mundial, demografía ONU): no hay desestacionalización ni regla de 10 meses.

---

## C. Magnitud del cambio

### C1. Pendiente de Theil–Sen, intercepto e IC del 95 %

- **Propósito:** pendiente robusta a valores extremos.
- **Fórmula (pendiente, mediana de pares):**
$$\hat\omega=\operatorname*{mediana}_{i<j}\left\{\frac{A_j-A_i}{x_j-x_i}\right\}\quad(N=n(n-1)/2\text{ pares}),\qquad
\hat a=\operatorname{mediana}(A)-\hat\omega\cdot\operatorname{mediana}(x)$$
- **IC del 95 % (Sen, 1968, ec. 2.6, implementado por SciPy):** con $\sigma_S^2=\frac{1}{18}\Big[n(n-1)(2n+5)-\sum_{\text{ties }x}t(t-1)(2t+5)-\sum_{\text{ties }y}u(u-1)(2u+5)\Big]$, $z=1{,}95996$ (cuantil 0,975 normal):
$$R_l=\max\!\Big(\operatorname{round}\tfrac{N-z\sigma_S}{2}-1,\ 0\Big),\qquad
R_u=\min\!\Big(\operatorname{round}\tfrac{N+z\sigma_S}{2},\ N-1\Big)$$
  y el IC es el par (pendiente ordenada en la posición $R_l$, pendiente ordenada en la posición $R_u$), con índices 0‑based y `round` = redondeo de NumPy (mitad al par).
- **Parámetros:** `stats.theilslopes(annual, years, 0.95)` con `method='separate'` (por defecto de SciPy ≥1.14; el intercepto es el de arriba, no la mediana de $A-\hat\omega x$). Por década: $\hat\omega\times10$ (`slope_per_decade`, `ci_low_per_decade`, `ci_high_per_decade`).
- **Supuestos/límites:** supone tendencia monótona lineal; el IC de Sen supone observaciones independientes — **no corrige autocorrelación** (por eso el veredicto no se apoya en él).
- **Referencia:** `trends.py:288,377-379`.
- **Ejemplo (Managua T2M 1990–2025):** $n=36$, $N=630$, $\sigma_S=73{,}417$ ⇒ $R_l=242$, $R_u=387$; pendiente $=-0{,}2110$ °C/década, IC95 $=[-0{,}3604;\,-0{,}0330]$ (coincide con `bundle.json`). Intercepto $\hat a=70{,}1048$.

### C2. Cambio total y cambio porcentual

$$\Delta_{tot}=\hat\omega\,(x_n-x_1),\qquad
\%\Delta=\frac{\Delta_{tot}}{\lvert \bar A_{1..5}\rvert}\times100\quad(\text{solo si }\texttt{ratio\_scale}=\text{True y }\lvert\bar A_{1..5}\rvert>10^{-9})$$
- **Símbolos:** $x_n-x_1$ = años transcurridos entre el primero y el último año de la serie (35 para 36 años); $\bar A_{1..5}$ = media de los **primeros cinco** valores anuales.
- **Supuestos/límites:** el porcentaje solo se da para variables con cero significativo (`ratio_scale`); en °C y similares es `None`. Si $\bar A_{1..5}\approx0$, `None`. (La réplica en cliente usa otra base: ver K.)
- **Referencia:** `trends.py:296-301,380-381`.
- **Ejemplos:** Managua T2M: $-0{,}021097\times35=-0{,}7384$ °C; porcentaje `None`. Rendimiento de cereales de Nicaragua 1990–2023 (`relate`, `indicator_trend`): $\Delta_{tot}=+739{,}04$ kg/ha ⇒ $+45{,}38\,\%$ (base ≈ 1.628 kg/ha).

### C3. Dirección

$$\text{dirección}=\begin{cases}\text{flat}&\hat\omega=0\\ \text{up}&\hat\omega>0\\ \text{down}&\hat\omega<0\end{cases}$$
- Comparación exacta con 0 (no hay banda de tolerancia). **Referencia:** `trends.py:294`.

### C4. Pendiente de mínimos cuadrados (OLS)

$$\hat\beta=\frac{\sum_i(x_i-\bar x)(A_i-\bar A)}{S_{xx}},\qquad
\mathrm{se}_0=\sqrt{\frac{\sum e_i^2/(n-2)}{S_{xx}}},\qquad e_i=A_i-(\hat\alpha+\hat\beta x_i)$$
- `scipy.stats.linregress`. Se publica como `ols_slope_per_decade` ($\hat\beta\times10$). Es la base de la regresión con $n_{\mathrm{eff}}$ (D4) y del **escenario** (E1). **Referencia:** `trends.py:150,382`; `forecast.py:81`.
- **Ejemplo (Managua):** $\hat\beta=-0{,}019338$ °C/año $=-0{,}1934$ °C/década (la de Theil–Sen es $-0{,}2110$: difieren un 8 %).

### C5. Recta de tendencia dibujada

$$\hat A(x)=\hat a+\hat\omega\,x\quad\text{en }x\in\{x_1,\ x_n\}$$
- El backend devuelve **solo los dos extremos** (`trend_line`, 2 puntos). **Referencia:** `trends.py:401-404`. Ejemplo: $\hat A(1990)=28{,}1213$, $\hat A(2025)=27{,}3829$ °C.

### C6. Desviación típica residual $\sigma$

$$\sigma=\sqrt{\frac{1}{n-2}\sum_{i=1}^n\big(e_i-\bar e\big)^2},\qquad e_i=A_i-(\hat a+\hat\omega x_i)$$
- Es `np.std(resid, ddof=2)` con **residuos de Theil–Sen** (no de OLS); se resta la media de los residuos (que no es exactamente 0 en Theil–Sen). Si $n\le2$, $\sigma=0$. Entra en D6. **Referencia:** `trends.py:303-305`.
- **Ejemplo (Managua):** $\sigma=0{,}47368$ °C (media de residuos $=0{,}01227$).

---

## D. Significancia y veredicto

### D1. Autocorrelación lag‑1 corregida por sesgo de muestra pequeña — `lag1`

- **Propósito:** estimar la "memoria" año a año de los residuos, corrigiendo que con pocos años $r$ sale demasiado baja.
$$r=\operatorname{corr}\big(e_{1..n-1},\,e_{2..n}\big),\qquad
r^\ast=\min\!\Big(0{,}95,\ \max\!\Big(0,\ r+\frac{1+4r}{n}\Big)\Big)$$
- **Parámetros:** devuelve 0 si $n<4$ o si la desviación típica de cualquiera de los dos segmentos es 0. Cota inferior 0 (la autocorrelación negativa **nunca** aumenta el tamaño efectivo) y superior 0,95. La corrección $+(1+4r)/n$ compensa el sesgo $-(1+4\rho)/n$ de $r$ (Kendall, 1954). $r$ es el coeficiente de Pearson entre los dos segmentos desplazados (cada uno con su propia media).
- **Dónde se aplica (dos residuos distintos):** (i) en `ols_effective`: residuos de la **regresión OLS** → $r^\ast$ que entra en $n_{\mathrm{eff}}$, en $n^\ast$ y en los avisos; (ii) en `mk_prewhitened`: residuos $A_i-\hat\omega x_i$ de **Theil–Sen** (sin intercepto; no importa porque $r$ es invariante a constantes).
- **Referencia:** `trends.py:128-134`, usos en `trends.py:141,152`.
- **Ejemplo (Managua, OLS):** $r=0{,}41180$ ⇒ $r^\ast=0{,}41180+\frac{1+4\cdot0{,}41180}{36}=0{,}48534$. Para el residuo de Theil–Sen: $r^\ast=0{,}48526$.

### D2. Mann–Kendall con preblanqueo — `mk_prewhitened`

- **Propósito:** prueba de tendencia monótona no paramétrica, resistente a autocorrelación.
- **Estadístico y tau:** sobre una serie $z_1,\dots,z_k$ con años $x_1,\dots,x_k$:
$$S=\sum_{i<j}\operatorname{sgn}(z_j-z_i)\quad(=\text{concordantes}-\text{discordantes}),\qquad
\tau_b=\frac{S}{\sqrt{(T_0-T_x)(T_0-T_z)}},\ \ T_0=\tfrac{k(k-1)}{2}$$
  donde $T_x,T_z$ = número de pares empatados en $x$ y en $z$ (en años no hay empates ⇒ $T_x=0$).
- **Varianza y Z (asintótica, con corrección de empates en $z$; sin corrección de continuidad):**
$$\operatorname{Var}(S)=\frac{k(k-1)(2k+5)-\sum_{\text{grupos de }z}u(u-1)(2u+5)}{18},\qquad
Z=\frac{S}{\sqrt{\operatorname{Var}(S)}},\qquad p=2\,[1-\Phi(\lvert Z\rvert)]$$
  (SciPy añade, solo si hay empates en ambos ejes, los términos $\frac{2T_xT_z}{k(k-1)}$ y $\frac{x_0z_0}{9k(k-1)(k-2)}$; con años sin empates valen 0.) **Método exacto:** si no hay empates y $k\le33$ (o $\min(\mathrm{dis},T_0-\mathrm{dis})\le1$), `kendalltau(method='auto')` usa la **distribución exacta** de $S$ en lugar de la normal.
- **Preblanqueo (lo que hace `mk_prewhitened`):**
  1. $\hat\omega$ = pendiente de Theil–Sen de la serie original; residuo $e_i=A_i-\hat\omega x_i$.
  2. $r^\ast$ = `lag1(e)` (D1, con $n$ = tamaño de la serie original).
  3. Si $r^\ast\le0$: se devuelve $(\tau,\ p)$ de `kendalltau(x, A)` sobre la serie **original**.
  4. Si $r^\ast>0$: se forma $w_i=A_i-r^\ast A_{i-1}$ para $i=2..n$ y se calcula `kendalltau(x_{2..n}, w)`; se devuelve **$\tau$ de la serie original** y **$p$ de la serie preblanqueada**.
$$w_i=A_i-r^\ast A_{i-1}\qquad(i=2,\dots,n)$$
- **Parámetros:** $\alpha=0{,}05$ para el veredicto (D5). Es preblanqueo **simple (PW)**, no "trend‑free prewhitening" (TFPW): el README (§10, punto 4) y `docs/RETO.md` indican que TFPW se evaluó y se descartó por dar 20–58 % de falsos positivos (esa evaluación no está en un script del repositorio; ver J4).
- **Supuestos/límites:** AR(1); la serie preblanqueada tiene $n-1$ puntos (con $n\le34$ aún usa el método exacto; con 35 o más, el asintótico). El preblanqueo reduce la pendiente efectiva en el factor $(1-r^\ast)$ pero no cambia el signo del contraste de rangos.
- **Referencia:** `trends.py:137-145`.
- **Ejemplo (Managua T2M 1990–2025):** $r^\ast=0{,}48526$; serie original: $S=-162$, $\tau=-0{,}2571$ (con $p$ sin preblanquear $=0{,}0273$, que daría "significativa"); serie preblanqueada: $k=35$, $S=-113$, $\operatorname{Var}(S)=\frac{35\cdot34\cdot75}{18}=4958{,}33$, $Z=-113/70{,}42=-1{,}605$, $p_{MK}=0{,}1085$ (coincide con `mk_p=0,10855` en `bundle.json`). El preblanqueo cambia el veredicto de "significativa" a "todavía no".

### D3. Tamaño de muestra efectivo — `n_eff`

$$n_{\mathrm{eff}}=\max\!\Big(3,\ n\cdot\frac{1-r^\ast}{1+r^\ast}\Big)$$
- **Propósito:** cuántas observaciones independientes "valen" los $n$ años cuando hay memoria AR(1). Con $r^\ast=0{,}95$ y $n=34$: $n\cdot0{,}05/1{,}95=0{,}87\to$ se aplica el piso 3.
- **Referencia:** `trends.py:153`. **Ejemplo (Managua):** $36\cdot\frac{1-0{,}48534}{1+0{,}48534}=12{,}474$ (`n_effective=12,4738`). **Ejemplo extremo (población de Nicaragua, ONU):** $r^\ast=0{,}95\Rightarrow n_{\mathrm{eff}}=3{,}0$ (piso).

### D4. Regresión OLS con $n_{\mathrm{eff}}$ (IC, t, p) — `ols_effective`

$$\nu=\max(1,\ n_{\mathrm{eff}}-2),\qquad
\mathrm{se}=\mathrm{se}_0\sqrt{\frac{n-2}{\nu}},\qquad
\mathrm{IC}_{95}=\hat\beta\pm t_{0{,}975,\nu}\,\mathrm{se},\qquad
p_{\mathrm{eff}}=2\,\big[1-F_{t,\nu}(\lvert\hat\beta/\mathrm{se}\rvert)\big]$$
- **Símbolos:** $\mathrm{se}_0$ = error estándar de $\hat\beta$ de `linregress` (C4); $F_{t,\nu}$ = FDA de la t de Student (con $\nu$ **real**, no entero, vía `scipy.stats.t`). Si $\mathrm{se}=0$, $p_{\mathrm{eff}}=1$. Se publican `ols_slope_per_decade`, `ols_ci_low/high_per_decade` (×10), `ols_p`, `n_effective` y `autocorrelation` $=r^\ast$.
- **Supuestos/límites:** corrige la varianza de $\hat\beta$ inflando $\mathrm{se}$, pero no ajusta el estimador; asume AR(1) estacionario. Es un ajuste de tipo Santer/Bayley–Hammersley.
- **Referencia:** `trends.py:148-158`.
- **Ejemplo (Managua):** $\nu=10{,}4738$, $t_{0{,}975,\nu}=2{,}2146$, $\mathrm{se}=\mathrm{se}_0\cdot\sqrt{34/10{,}4738}=1{,}8017\,\mathrm{se}_0=0{,}013681$ °C/año; $\hat\beta=-0{,}019338$; $t=-1{,}413$; IC95 por década $=[-0{,}4964;\ +0{,}1096]$ (incluye 0); $p_{\mathrm{eff}}=0{,}1865$.

### D5. Regla del veredicto de tres niveles — `_verdict`

$$\begin{aligned}
c_0&=\mathbb 1\big[\mathrm{IC}^{\mathrm{eff}}_{\mathrm{bajo}}>0\ \ \lor\ \ \mathrm{IC}^{\mathrm{eff}}_{\mathrm{alto}}<0\big]\ \ (\text{el IC95 de D4 excluye el cero})\\
\text{coinciden}&=\big(p_{MK}<\alpha\big)=\big(p_{\mathrm{eff}}<\alpha\big)\\[2pt]
\text{veredicto}&=\begin{cases}
\textbf{significant}&p_{MK}<0{,}05\ \ \land\ \ c_0\\
\textbf{not\_yet}&p_{MK}<0{,}20\ \ \lor\ \ \lnot\,\text{coinciden}\quad(\text{si no es «significant»})\\
\textbf{no\_trend}&\text{en cualquier otro caso (}p_{MK}\ge0{,}20\text{ y coinciden)}
\end{cases}
\end{aligned}$$
- **Umbrales:** $\alpha=$ `ALPHA` $=0{,}05$; $\alpha_{ny}=$ `NOT_YET_P` $=0{,}20$. "Datos insuficientes" = menos de 15 años (B3). `significant` (booleano) $\Leftrightarrow$ veredicto `significant`. `methods_agree` = `coinciden`.
- **Observación:** como el IC de D4 y $p_{\mathrm{eff}}$ salen del mismo $\mathrm{se}$ y $\nu$, "IC excluye 0" equivale a $p_{\mathrm{eff}}<0{,}05$ (salvo $\mathrm{se}=0$); en la práctica, `significant` exige $p_{MK}<0{,}05$ **y** $p_{\mathrm{eff}}<0{,}05$.
- **Etiquetas de interfaz:** `significant` → "Cambio Confirmado / Confirmed Change"; `not_yet` → "En Observación (Todavía no)"; `no_trend` → "Estable / Variación Natural" (`i18n.ts:296-309` de la web de José).
- **Referencia:** `trends.py:44-45,170-177,292-293`.
- **Ejemplo (Managua T2M):** $p_{MK}=0{,}1085$ (<0,20) y $p_{\mathrm{eff}}=0{,}1865$; ambos ≥ 0,05 ⇒ coinciden; veredicto **not_yet** (significativa solo si ambos < 0,05).

### D6. Años necesarios para detectar el ritmo (potencia / ruido, ≈90 %) — `years_needed`

$$n^\ast=\left\lceil\left(\frac{3{,}3\;\sigma\;\sqrt{12}}{\lvert\hat\omega\rvert}\sqrt{\frac{1+\varphi}{1-\varphi}}\right)^{2/3}\right\rceil,\qquad \varphi=\min(r^\ast,\,0{,}95)$$
- **Símbolos:** $\sigma$ de C6 (residuos de Theil–Sen, anuales), $\hat\omega$ pendiente anual de Theil–Sen, $r^\ast$ = autocorrelación de D1 (la de la regresión OLS).
- **Parámetros:** constante $3{,}3$ y factor $\sqrt{12}$ tal como están en el código ("Weatherhead et al. 1998, adaptado a datos anuales"). Devuelve `None` si $\hat\omega=0$ o $\sigma\le0$. Solo se calcula si el veredicto **no** es `significant` (`years_needed=None` si lo es). El docstring afirma validación por simulación: a $n^\ast$ años se detecta en ≈90 % (88–96 % según README/RETO; ver J4).
- **Supuestos/límites:** ruido AR(1) y tendencia lineal; la derivación del factor $\sqrt{12}$ no está en el código (ver sección P3, duda 1). No es un cálculo de potencia exacto.
- **Referencia:** `trends.py:161-167,305`. Test: `years_needed(1,0.1,0)=24` ($\sigma=1$, pendiente 0,1, $\varphi=0$), `>24` con $\varphi=0{,}4$, `None` con pendiente 0 (`tests/test_trends.py:86-89`).
- **Ejemplo (Managua):** $\sigma=0{,}47368$, $\hat\omega=0{,}021097$, $r^\ast=0{,}48534$ ⇒ $\frac{3{,}3\cdot0{,}47368\cdot3{,}4641}{0{,}021097}=256{,}7$; $\sqrt{1{,}48534/0{,}51466}=1{,}6989$; producto $436{,}1$; $436{,}1^{2/3}=57{,}5\to n^\ast=58$ años (hay 36; `years_needed=58`).
- **Barra de suficiencia de datos (UI):** ver W8.

### D7. Sensibilidad al periodo — `period_sensitive`

$$\mathcal V=\Big\{\ \text{veredicto}\big(x_{ds+1..n-de}\big)\ :\ ds,de\in\{0,1,2,3\},\ \ (n-de)-ds\ge15\Big\},\qquad
\text{period\_sensitive}=\big(\lvert\mathcal V\rvert>1\big)$$
- **Parámetros:** `PERIOD_SHIFT = 3` (hasta 3 años a cada extremo ⇒ hasta 16 ventanas, incluida la completa). El veredicto de cada ventana usa solo `_quick_verdict` = D2+D4+D5 (sin Pettitt ni avisos).
- **Referencia:** `trends.py:46,180-183,307-314`.
- **Ejemplo (Managua):** $\mathcal V=\{\text{no\_trend},\text{not\_yet}\}$ ⇒ `period_sensitive=True` (aviso "El veredicto cambia si se mueve el año inicial o final…").

### D8. Salto brusco (Pettitt, versión del código) — `_step_change`

$$U_k=\sum_{i=1}^{k}\sum_{j=k+1}^{n}\operatorname{sgn}(A_j-A_i),\quad k=1,\dots,n-1;\qquad
K=\max_k\lvert U_k\rvert;\qquad
p_{P}=\min\!\Big(1,\ 2\exp\!\Big[\frac{-6K^2}{n^3+n^2}\Big]\Big)$$
$$\text{Se avisa si}\quad p_P<0{,}05\ \ \land\ \ \mathrm{RSS}_{\text{escalón}}<0{,}7\cdot\mathrm{RSS}_{\text{recta}}$$
$$\mathrm{RSS}_{\text{escalón}}=\sum_{i\le k^\ast}(A_i-\bar A_{\le k^\ast})^2+\sum_{i>k^\ast}(A_i-\bar A_{>k^\ast})^2,\qquad
\mathrm{RSS}_{\text{recta}}=\sum_i e_i^2\ \ (\text{residuos de Theil–Sen})$$
- **Salida:** el año del salto es $x_{k^\ast+1}$ (primer año **después** del escalón), con $k^\ast=\arg\max\lvert U_k\rvert$ (primer máximo). Es una **aproximación asintótica** de $p$ (no exacta, no ajustada por empates).
- **Parámetros:** $\alpha=0{,}05$, razón de ajuste $0{,}7$. Se aplica a toda serie analizada (no hay mínimo de $n$ propio salvo $n\ge15$).
- **Supuestos/límites:** un único punto de cambio; no ajusta por autocorrelación (series con memoria fuerte pueden dar Pettitt "significativo" sin salto real; por eso la 2.ª condición de la recta). Sirve solo como **aviso**: no cambia el veredicto.
- **Referencia:** `trends.py:186-200`, aviso en `trends.py:330-336`. Tests: `tests/test_trends.py:161-169`.
- **Ejemplos:** (a) Managua T2M: $K=205$ en el punto $k^\ast=9$ (año 1999 es el primero tras el corte; el índice 0‑based es 8), $p_P=0{,}0104<0{,}05$, pero $\mathrm{RSS}_{\text{escalón}}/\mathrm{RSS}_{\text{recta}}=5{,}348/7{,}634=0{,}7006\ge0{,}7$ ⇒ **no** se avisa (`step_year=None`), por muy poco margen. (b) Bluefields (12,01; −83,76), `GWETROOT`, `EVLAND`, `GWETTOP`, `VPD`, `RH2M`: `step_year=1999`; `T2M`: 2015 (`bundle.json`).

### D9. Avisos automáticos (umbrales)

| Aviso | Condición exacta | Referencia |
|---|---|---|
| Autocorrelación alta | $r^\ast>0{,}5$ | `trends.py:317-321` |
| Pruebas no coinciden | `coinciden = False` (D5) | `trends.py:322-325` |
| Veredicto sensible al periodo | $\lvert\mathcal V\rvert>1$ (D7) | `trends.py:326-329` |
| Salto brusco | Pettitt (D8) | `trends.py:330-336` |

### D10. Corrección de múltiples pruebas: Bonferroni en el radar (`/api/scan`)

$$p^{\mathrm{adj}}_j=\min\!\big(1,\ m\cdot p_{MK,j}\big),\qquad m=\text{número de variables analizadas con ≥15 años}$$
- **Parámetros:** $m$ = `len(results)` (variables que no lanzaron `InsufficientData`): 17 en los datos de ejemplo (14 de POWER + 3 derivadas). Resultados ordenados por $p_{MK}$ ascendente.
- **Supuestos/límites:** $p^{\mathrm{adj}}$ es **solo informativo**: **no** se usa en el veredicto (una variable puede ser `significant` con $p^{\mathrm{adj}}>0{,}05$). No hay corrección en `/api/trend` ni `/api/compare`. Un texto de la interfaz EN dice "Testing 14 variables" aunque $m$ es 17 (ver O).
- **Referencia:** `trends.py:409-422`; test `tests/test_trends.py:141-150`; UI `ScanView.tsx:54-56`.
- **Ejemplo (Managua):** `T2M_MAX`: $p_{MK}=0{,}001036\Rightarrow p^{\mathrm{adj}}=17\cdot0{,}001036=0{,}01761$; `WBGT`: $0{,}003285\to0{,}05585$ (>0,05 aunque su veredicto sea `significant`); `T2M`: $0{,}1085\to1$.

### D11. "Certeza" mostrada y barras (solo presentación; `i18n.ts`)

$$\mathrm{pct}=\max\!\big(5,\ \min(99{,}9,\ (1-p_{MK})\times100)\big)$$
- Para `significant` y `not_yet` se muestra "`pct` % de certeza"; para `no_trend` el texto es "Señal compatible con azar" y el campo `pct` queda en $\min(\mathrm{pct},79)$ (la barra de la interfaz usa este valor). Nota: $1-p$ **no** es una probabilidad de que la tendencia sea real; es una forma didáctica de presentar $p$.
- **Referencia:** `i18n.ts:311-347` (web de José; idéntico en `nasaspaceapp`).
- **Ejemplos:** Managua $p_{MK}=0{,}1085\to89{,}15\,\%$; Svalbard T2M $p_{MK}=6{,}59\cdot10^{-5}\to$ tope $99{,}9\,\%$.

### D12. Formato de las cifras del texto interpretativo (backend)

- `_fmt(x)`: $\text{decimales}=\min\big(6,\max(0,\,2-\lfloor\log_{10}\lvert x\rvert\rfloor)\big)$, coma decimal; 3 cifras significativas para $\lvert x\rvert<1000$ (a partir de 1000, 0 decimales). `_signed` antepone `+` si $x>0$. `_p_text(p)` = `p < 0,0001` si $p<10^{-4}$, si no `p = 0,xxxx` (4 decimales). **Referencia:** `trends.py:109-122`.
- Textos de interpretación: `significant` → "…sube/baja… Cambio total estimado… Es muy improbable que sea azar…"; `not_yet` → añade "harían falta unos $n^\ast$ años" (y "hay $n$" o "pero las pruebas no coinciden" si $n^\ast\le n$); `no_trend` → "Si existiera un cambio de ese tamaño, harían falta unos $n^\ast$ años". **Referencia:** `trends.py:338-365`.

---

## E. Escenario lineal y proyección ONU

Archivo: `backend/app/services/forecast.py`. Responde a "si el ritmo observado continuara…": **no es un modelo del clima ni de la sociedad**.

### E1. Valor central e intervalo de predicción del 95 % — `linear_forecast`

$$\hat y(x_0)=\hat\alpha+\hat\beta\,x_0,\qquad
\hat y(x_0)\ \pm\ t_{0{,}975,\,n-2}\;s\,\sqrt{1+\frac1n+\frac{(x_0-\bar x)^2}{S_{xx}}},\qquad
s=\sqrt{\frac{\sum_i e_i^2}{n-2}}$$
- **Símbolos:** $\hat\alpha,\hat\beta$ = ajuste **OLS** (no Theil–Sen) de la serie anual sobre el año; $x_0\in\{x_n+1,\dots,\text{to\_year}\}$ (un punto por año futuro); $S_{xx}=\sum(x_i-\bar x)^2$; $t$ con $n-2$ g.l. enteros.
- **Parámetros:** `MIN_POINTS = 5` años mínimos; `to_year` debe ser mayor que el último año observado (si no, `ForecastError`); la API limita `to_year ≤ MAX_HORIZON = 2100` (`main.py:330,346`). Defecto 2050. La interfaz ofrece 2030, 2040, 2050, 2075, 2100 (`TrendView.tsx:142`, `DemographyView.tsx:118` de la web de José).
- **Supuestos/límites:** relación lineal que continúa indefinidamente; **errores independientes** (el intervalo clásico **no** se ensancha por autocorrelación: por eso hay un aviso, E3); el ancho crece con la distancia al centro de los datos, $\propto\sqrt{(x_0-\bar x)^2/S_{xx}}$. El intervalo **no incluye** incertidumbre de modelo (no lineal) ni de escenarios.
- **Referencia:** `forecast.py:64-97` (ajuste 81, $s$ 83, $S_{xx}$ 84, $t$ 85, banda 91). Cobertura simulada 91–99 % (`tests/test_forecast.py:16-26`).
- **Ejemplo (Managua T2M 1990–2025, año 2050):** $\bar x=2007{,}5$, $S_{xx}=3885$, $s=0{,}47330$, $t_{0{,}975,34}=2{,}0322$, $\hat y=26{,}9425$; semiancho $=2{,}0322\cdot0{,}4733\cdot\sqrt{1+\frac1{36}+\frac{42{,}5^2}{3885}}=1{,}1752$ ⇒ banda $[25{,}767;\ 28{,}118]$ °C (idéntico a `bundle.json`, clave `forecast…|2050`, y al texto "26,9 °C (25,8 a 28,1)"). Para 2026: $26{,}407$ ± $1{,}016$.

### E2. Límites físicos (recorte del valor central y de la banda) — `bounds_for` y `_clip`

$$[\ell,u]=\begin{cases}[0,100]&\text{si la unidad empieza por «\%»}\\ [0,1]&\text{si la unidad es «0–1»}\\ [0,+\infty)&\text{si }\texttt{ratio\_scale}\\ (-\infty,+\infty)&\text{en otro caso}\end{cases}\qquad
\text{valor}\leftarrow\min\big(u,\max(\ell,\ \text{valor})\big)$$
- Se recortan por separado el valor central, el límite inferior y el superior. El aviso de "límite físico" se emite si algún `value` queda **exactamente** en $\ell$ o $u$.
- **Rareza relevante:** la regla "unidad empieza por %" también atrapa unidades como `"% anual"` (crecimiento de la población, que puede ser negativo): ese escenario se recorta a $[0,100]$ aunque `ratio_scale=False`. (Ver O.)
- **Referencia:** `forecast.py:45-61,118-119`. Tests: `tests/test_forecast.py:38-49`.

### E3. Avisos del escenario (umbrales exactos)

| Aviso | Condición | Referencia |
|---|---|---|
| Horizonte largo | $\text{horizonte}=\text{to\_year}-x_n>\tfrac12\,\text{span}$, con $\text{span}=x_n-x_1+1$ | `forecast.py:99-106` |
| Años consecutivos parecidos | $r_1>0{,}3$, con $r_1=\operatorname{corr}(e_{1..n-1},e_{2..n})$ de los residuos OLS, **sin** corrección de sesgo (requiere $n\ge4$ y desv. típica>0) | `forecast.py:107-112` |
| Tendencia de base no significativa | $p_{\mathrm{OLS}}\ge0{,}05$ del `linregress` **ordinario** (no el $p_{\mathrm{eff}}$ de D4) | `forecast.py:113-117` |
| Límite físico alcanzado | ver E2 | `forecast.py:118-119` |

- **Ejemplo (Managua 2050):** horizonte 25 > 36/2=18 ⇒ aviso; $r_1=0{,}412>0{,}3$ ⇒ aviso (ambos presentes en `bundle.json`).

### E4. Texto del escenario

- Backend: "Si el ritmo de $x_1$–$x_n$ continuara ($\hat\beta\cdot10$ unidad por década), en `to_year` … rondaría $\hat y$ (intervalo del 95 %: low a high)". `forecast.py:121-127`.
- Frontend: `formatForecastText` reconstruye la frase con `rate = slope_per_year × 10` y `fmtNum` (3 cifras significativas). `i18n.ts:476-486` (web de José).

### E5. Escenario de la zona construida (cobertura del suelo)

- Se aplica E1 a la serie $\{(\text{año},\ \text{share de «Zona construida»})\}$, con límites $[0,100]$ y unidad "% del área", solo si hay `len(years) ≥ forecast.MIN_POINTS = 5` años de cobertura; `to_year` por defecto 2035 (máx. 2100). **Referencia:** `main.py:451-471`.

### E6. Proyección oficial de la ONU frente a la extrapolación lineal (demografía)

- **Qué se calcula (`main.py:381-417`):** (i) ventana $\{y\ge\text{start}\}$ de las **estimaciones** de Our World in Data; (ii) `trend` = `analyze_annual` sobre la ventana (D, si hay ≥15 años; si no, `None`); (iii) `forecast` = E1 sobre la ventana (con límites de E2 según unidad/`ratio_scale`); (iv) `un_projection` = serie de la ONU con año $\le$ `to_year`; (v) `un_value_at_horizon` $=\text{proj}[\text{to\_year}]$ (o `None`).
- **Diferencia ONU − lineal:** $\Delta_{\mathrm{ONU-lin}}(y)=\text{ONU}(y)-\text{lineal}(y)$ la calcula solo la tabla del frontend de `nasaspaceapp` (`DemographyView.tsx:117-120`); **la web de José no la calcula**: solo dibuja ambas curvas y muestra los valores del horizonte.
- **Supuestos/límites:** la proyección ONU (variante media, modelo por cohortes de edad) **no se recalcula aquí**: se toma de Our World in Data; la lineal es una recta OLS. El intervalo de predicción lineal no pretende contener la proyección ONU.
- **Ejemplo (Nicaragua, población, 2050; `bundle.json` clave `NIC|population|1990|2050`):** pendiente $=+785\,182$ hab./década (`significant`, $n_{\mathrm{eff}}=3{,}0$, $r^\ast=0{,}95$); lineal 2050 $=8\,879\,482$ (banda $8\,798\,829$–$8\,960\,135$); ONU 2050 $=8\,756\,437$ ⇒ $\Delta_{\mathrm{ONU-lin}}=-123\,045$ (la ONU queda **por debajo** de la banda lineal del 95 %, lo que ilustra que la recta no modela la transición demográfica).

---

## F. Relación clima–sociedad

Archivo: `backend/app/services/relate.py` (endpoint `/api/relate`, `main.py:214-268`). Compara **una serie anual de la Tierra** (media anual de la variable en un punto, `trends.annual_means`) con **un indicador anual del Banco Mundial** del país.

### F1. Años en común, rezago y exclusión de años de choque

$$\mathcal Y=\big(\{\,y+\ell:\ y\in\text{años de la serie Tierra}\}\ \cap\ \{\text{años del indicador}\}\big)\ \setminus\ \big(\{2020,2021\}\ \text{si se excluyen}\big)$$
- **Parámetros:** rezago $\ell\in\{0,1,2\}$ (la API limita `lag` a 0–2); `SHOCK_YEARS = {2020, 2021}`; se exige $\lvert\mathcal Y\rvert\ge$ `MIN_OVERLAP` $=10$; las dos series deben tener desviación típica $>0$ (si no, `InsufficientOverlap`).
- **Interpretación del rezago:** el valor de la Tierra del año $t$ se compara con el indicador del año $t+\ell$ ("clima en $t$ ↔ indicador social en $t+\ell$"). Los años en $\{2020,2021\}$ que se excluyen se listan en `excluded_years`.
- **Referencia:** `relate.py:21-22,78-90`; `main.py:224-225,244`. Test: `tests/test_relate.py:108-137`.

### F2. Correlación "aparente" (con tendencias)

$$r_{raw}=\frac{\sum_i(e_i-\bar e)(g_i-\bar g)}{\sqrt{\sum_i(e_i-\bar e)^2\sum_i(g_i-\bar g)^2}},\qquad
t=r_{raw}\sqrt{\frac{n-2}{1-r_{raw}^2}}\ \sim t_{n-2}\ \Rightarrow\ p_{raw}$$
- $e_i$ = valor de la Tierra, $g_i$ = valor del indicador, ambos en los años de $\mathcal Y$. `scipy.stats.pearsonr` (p bilateral con $n-2$ g.l.). **Referencia:** `relate.py:92`.

### F3. Quitar la tendencia lineal (detrend) y correlación "año a año"

$$\tilde e_i=e_i-(\hat\alpha_e+\hat\beta_e x_i),\qquad \tilde g_i=g_i-(\hat\alpha_g+\hat\beta_g x_i)\quad(\text{OLS de cada serie sobre el año})$$
$$r_{det}=\operatorname{Pearson}(\tilde e,\tilde g),\ \ p_{det};\qquad
\rho_{det}=\operatorname{Pearson}\big(\operatorname{rang}(\tilde e),\operatorname{rang}(\tilde g)\big),\ \ p_\rho\ (\text{Spearman, rangos medios en empates})$$
- El detrend usa los años reales de $\mathcal Y$ (con huecos si se excluyó 2020–2021). La correlación **sin tendencia** es la que gobierna el veredicto. **Referencia:** `relate.py:58-60,93-95`.

### F4. Reglas de decisión de la relación

$$\begin{aligned}
\text{significant}&=\ p_{det}<0{,}05\\
\text{trend\_driven}&=\ p_{raw}<0{,}05\ \ \land\ \ \Big(\lnot\,\text{significant}\ \ \lor\ \ \lvert r_{raw}\rvert-\lvert r_{det}\rvert>0{,}3\Big)\\
\text{fuerza}&=\begin{cases}\text{fuerte}&\lvert r_{det}\rvert\ge0{,}5\\ \text{moderada}&0{,}3\le\lvert r_{det}\rvert<0{,}5\\ \text{débil}&\lvert r_{det}\rvert<0{,}3\end{cases}
\end{aligned}$$
- `ALPHA = 0,05` importado de `trends.py`. La fuerza depende solo de $\lvert r_{det}\rvert$ (no de la significancia). Barra de la interfaz: ancho $=\min(100,\ \lvert r_{det}\rvert\cdot100)\,\%$ (`RelateView.tsx:206` de la web de José).
- **Redacción:** "por encima/por debajo" según el signo de $r_{det}$; si `trend_driven`, se añade la advertencia de que la correlación aparente se debe a tendencias paralelas. **Referencia:** `relate.py:98-120`.

### F5. Avisos de la relación (umbrales)

| Aviso | Condición | Referencia |
|---|---|---|
| Escala espacial | siempre (1 punto de ~50×60 km vs. agregado nacional) | `relate.py:122-128` |
| Rezago aplicado | $\ell>0$ | `relate.py:129-130` |
| Años de choque excluidos | hay `excluded_years` | `relate.py:131-134` |
| Pocos años | $n<20$ | `relate.py:135-136` |
| Pearson y Spearman no coinciden | $(p_\rho<0{,}05)\ne\text{significant}$ | `relate.py:137-140` |

### F6. Tendencia del indicador (columna adicional)

- `analyze_annual` (D) sobre el indicador del Banco Mundial en $[\text{start},\text{end}]$ (si hay ≥15 años; si no, `None`). Hereda `ratio_scale` del catálogo de indicadores. **Referencia:** `main.py:244-251`.

### F7. Supuestos y límites de F

- Los $p$ de Pearson/Spearman **no corrigen autocorrelación** tras quitar la tendencia ni el hecho de explorar muchas combinaciones variable×indicador (no hay Bonferroni/FDR aquí). Asociación ≠ causa. Un punto de malla no representa necesariamente un país entero.
- **Test:** con series sin relación pero con tendencia, la tasa de falsos positivos "año a año" es ≤20/200 (`tests/test_relate.py:93-97`).
- **Ejemplo (Corredor Seco, `GWETROOT` vs. rendimiento de cereales de Nicaragua, 1990–2023, $n=34$; `bundle.json`):** $r_{raw}=+0{,}4746$ ($p=0{,}0046$); $r_{det}=-0{,}1369$ ($p=0{,}4399$); $\rho_{det}=-0{,}2021$ ($p=0{,}2516$) ⇒ `significant=False`; `trend_driven=True` (porque $p_{raw}<0{,}05$ y no es significativa); fuerza "débil". Tendencia del indicador: $+223{,}95$ kg/ha/década, `significant`, $n_{\mathrm{eff}}=7{,}33$, $r^\ast=0{,}645$, $p_{MK}=7{,}8\cdot10^{-6}$.

---

## G. Geometría, lugares, satélite, demografía y Banco Mundial

### G1. Recuadro satelital alrededor de un punto — `bbox_around` (`satellite.py:65-68`)

$$\Delta\varphi=\frac{h}{111},\qquad \Delta\lambda=\frac{h}{111\cdot\max\!\big(0{,}05,\ \cos\varphi\big)},\qquad
\text{bbox}=\big[\lambda-\Delta\lambda,\ \varphi-\Delta\varphi,\ \lambda+\Delta\lambda,\ \varphi+\Delta\varphi\big]\ \ (\text{grados, 5 decimales})$$
- $h$ = `half_km` (por defecto 8 km; la API admite 1–40, `main.py:431,455`). Constante 111 km/grado. El `max(0,05, cos φ)` evita dividir por casi cero cerca de los polos (válido hasta $\lvert\varphi\rvert\approx87{,}1^\circ$). No maneja el cruce del antimeridiano ni de los polos.
- **Ejemplo (Managua, $h=8$):** $\Delta\varphi=0{,}07207^\circ$, $\Delta\lambda=0{,}07372^\circ$ ⇒ `[-86.32372, 12.05793, -86.17628, 12.20207]`. **Svalbard (78,22°N):** $\Delta\lambda=0{,}3530^\circ$ ⇒ `[15.29697, 78.14793, 16.00303, 78.29207]`.

### G2. Área del recuadro — `area_km2` (`satellite.py:71-74`)

$$A=\lvert\varphi_N-\varphi_S\rvert\cdot111\ \times\ \lvert\lambda_E-\lambda_W\rvert\cdot111\cdot\cos\!\Big(\frac{\varphi_S+\varphi_N}{2}\Big)\ \ [\mathrm{km}^2]$$
- Aproximación plana (sin curvatura), con $111$ km/grado. Resulta $A\approx(2h)^2$. Se publica `area_km2` redondeado a 2 decimales.
- **Ejemplo:** Managua, $h=8$ ⇒ $A=255{,}9998\approx256$ km² (el texto de la interfaz dice "cuadro de 16 × 16 km"). Svalbard: $255{,}995$ km². Test: ±5 km² del esperado (`tests/test_places_demography_satellite.py:21-25`).
- **Límite:** por encima de ≈87,1° de latitud el recorte `max(0,05,…)` de G1 hace que $A$ ya no sea $(2h)^2$.

### G3. Distancia de círculo máximo (haversine)

$$a=\sin^2\!\frac{\Delta\varphi}{2}+\cos\varphi_1\cos\varphi_2\sin^2\!\frac{\Delta\lambda}{2},\qquad d=2R\arcsin\sqrt a,\quad R=6371\ \mathrm{km}$$
- Aparece en dos sitios en la web de José: backend Python `places._haversine_km` (`places.py:67-72`, que generó `locate`) y navegador `staticFallback.haversineKm` (`staticFallback.ts:101-109`, con `min(1, √a)`); en `nasaspaceapp` hay una tercera copia (`cities.ts`). Son numéricamente equivalentes.
- **Usos:** (i) País de una coordenada: se busca la ciudad GeoNames más cercana (`reverse_geocoder`, modo 1) y se asigna su país **solo si** $d\le$ `MAX_COUNTRY_KM` $=250$ km; si no, se considera mar abierto/zona remota (sin país ni lugar cercano). `distance_km` redondeado a 1 decimal (`places.py:75-89`). (ii) Navegador (web de José): la región de muestra más cercana dentro de 28 km (`matchSampleRegionKey`, `staticFallback.ts:111-123`) o 45 km para `/api/places/locate` (`staticFallback.ts:915`); ver W1. (iii) (solo `nasaspaceapp`) ciudad con escenario 3D más cercana a ≤ 30 km.
- **Ejemplo:** Managua (12,13; −86,25) – Somoto (13,48; −86,58): $d=154{,}32$ km.

### G4. Cobertura del suelo: porcentajes por clase y superficie construida (`satellite.py:170-210`)

$$\text{share}_{c,t}=\operatorname{round}\!\Big(100\cdot\frac{n_{c,t}}{\sum_{c'\in\mathcal C}n_{c',t}},\ 2\Big),\qquad
\text{built\_km}^2_t=\operatorname{round}\!\Big(A\cdot\frac{\text{share}_{\text{Zona construida},t}}{100},\ 3\Big)$$
- **Símbolos:** $n_{c,t}$ = píxeles de la clase $c$ en el año $t$ (histograma de `statistics` de Planetary Computer, colección `io-lulc-annual-v02`, 10 m); $\mathcal C$ = clases con nombre (1 Agua, 2 Árboles, 4 Vegetación inundada, 5 Cultivos, 7 Zona construida, 8 Suelo desnudo, 9 Nieve y hielo, 11 Pastizal y matorral). La clase 10 (**nubes**) **no** entra en el denominador (`CLOUD_CLASS=10`), por lo que los porcentajes son sobre el "área válida". Años con 0 píxeles válidos se omiten. $A$ de G2.
- **Aviso por salto:** se añade si $\max_t\lvert\text{share}_{\text{construida},t+1}-\text{share}_{\text{construida},t}\rvert>5$ puntos porcentuales (`itertools.pairwise`, `satellite.py:206-208`).
- **Ejemplo hipotético (no hay datos de cobertura en el repo; se consulta en vivo):** si $A=256$ km² y la clase construida es 10,5 % ⇒ $\text{built\_km}^2=26{,}880$.
- **Solo frontend de `nasaspaceapp` (no existe en la web de José):** cambio por clase entre el primer y el último año: $\Delta\text{pp}=\text{share}_{last}-\text{share}_{first}$ y $\Delta\mathrm{km}^2=\frac{\Delta\text{pp}}{100}A$; se muestran solo clases con share $\ge0{,}01\,\%$ en alguno de los dos años, ordenadas por $\lvert\Delta\text{pp}\rvert$ descendente (`SatelliteView.tsx:94-109`). Barras: ancho $=\min(100,\text{share})\,\%$ (`SatelliteView.tsx:184`); se muestran las 5 primeras clases con share $\ge1\,\%$ en algún año (`:60,:169`).

### G5. Tipo de lugar sugerido a partir del suelo — `suggest_place_type` (`satellite.py:139-157`)

Reglas evaluadas **en este orden** sobre los shares del **último año** (%), con $\varphi$ = latitud del punto:

| # | Condición | Resultado |
|---|---|---|
| 1 | Nieve y hielo $>20$ **o** $\lvert\varphi\rvert>60$ | `cold` |
| 2 | Zona construida $>25$ | `city` |
| 3 | Agua $>20$ | `coast` |
| 4 | Suelo desnudo $>40$ | `dry` |
| 5 | Cultivos $>25$ | `farmland` |
| 6 | Árboles $>40$ | `forest` |
| 7 | Pastizal y matorral $>40$ | `dry` |
| 8 | ninguna | `None` |

### G6. Elección de escena satelital (`satellite.py:77-135`)

- **Filtro por año $y$:** $y\ge2016$ → Sentinel‑2 L2A; $y\le2002$ → Landsat C2 L2 con plataformas {landsat‑5, landsat‑7}; $2003\le y\le2011$ → {landsat‑5}; $2012\le y\le2015$ → {landsat‑8, landsat‑9}. Todas con nubosidad $<$ `MAX_CLOUD` $=20\,\%$; se pide **1 escena** ordenada por `eo:cloud_cover` ascendente, en el intervalo `y-01-01/y-12-31`.
- **Render:** imagen cuadrada `size`×`size` (por defecto 640) para que no se deforme lejos del ecuador; Landsat con `rescale=7500,14000` (reflectancia escalada → color natural). Años por defecto `[1990, 2000, 2010, 2016, 2020, 2025]`; la API admite 1–12 años entre 1984 y `last_full_year()+1` (`main.py:423,438`).

### G7. Demografía (Our World in Data / ONU) — `parse_owid_csv` (`demography.py:72-91`)

- Se leen las filas con código ISO3 de longitud 3 (se descartan regiones); estimaciones = 4.ª columna; proyección = 5.ª columna **solo si** su cabecera contiene "projected". Caché de 24 h por gráfico (`CACHE_TTL_S = 24·3600`). No hay conversiones numéricas.
- 7 indicadores (`demography.py:35-60`): población (hab.), crecimiento (% anual; `ratio_scale=False`), fecundidad (hijos por mujer), natalidad y mortalidad (por 1000 hab.), población urbana (% de la población), esperanza de vida (años); solo población, crecimiento y fecundidad traen proyección ONU.

### G8. Banco Mundial — `worldbank._parse` (`worldbank.py:29-36`)

- Se conservan las filas con `value ≠ null` y `date` numérico; periodo `FIRST_YEAR:last_full_year` (`per_page=100`); caché 24 h, máx. 512 entradas; 10 indicadores (catálogo `INDICATORS`). No hay transformaciones numéricas (los indicadores se usan tal cual).

---

## H. Globo 3D

Archivos: `backend/scripts/build_globe.py` (cálculo, una vez), `backend/app/data/globe.json` (resultado; idéntico a `frontend/public/static-api/globe.json`), `frontend/src/Globe3D.tsx`, `globeColors.ts`, `GlobeSection.tsx` (dibujo).

### H1. Malla de 5° (`build_globe.py:28,37-40`)

$$\varphi_k=-90+\tfrac{5}{2}+5k\quad(k=0..35),\qquad \lambda_l=-180+\tfrac52+5l\quad(l=0..71)\ \Rightarrow\ 36\times72=2592\text{ centros}$$
- Centros de $-87{,}5$ a $+87{,}5$ en latitud y de $-177{,}5$ a $+177{,}5$ en longitud (test `tests/test_globe_grid.py:6-8`). Cada celda se representa **solo por la serie de su centro** (no es un promedio de celda).

### H2. Qué se calcula por celda — `analyze_cell` (`build_globe.py:60-73`)

- Para cada una de 5 variables `GLOBE_VARS = [T2M, PRECTOTCORR, GWETROOT, RH2M, WS2M]`: medias anuales (B) en $[1990,\ \text{last\_full\_year}]$ (por defecto hasta 2025); si hay ≥15 años, `analyze_annual` (C–D) y se guarda el vector `[pendiente/década, p_MK, código de veredicto, media, pasa_fdr]`, con:
$$\text{pendiente}=\operatorname{sig}_4(10\,\hat\omega),\quad p=\operatorname{round}(p_{MK},5),\quad \text{código}=\{\text{significant}:2,\ \text{not\_yet}:1,\ \text{no\_trend}:0\},\quad \text{media}=\operatorname{sig}_4(\overline{A})$$
  ($\operatorname{sig}_4$ = 4 cifras significativas, `f"{x:.4g}"`). `GWETROOT` solo existe en 734 de 2.592 celdas (probablemente donde POWER devuelve dato válido; en el resto no hay serie suficiente). Reintentos de descarga: 4 intentos con espera $2^{k}\cdot2$ s (`build_globe.py:46-56`); lotes de 60 celdas; 6 trabajadores por defecto.

### H3. Control de la tasa de falsos descubrimientos (Benjamini–Hochberg) — `benjamini_hochberg`

$$p_{(1)}\le\dots\le p_{(m)},\qquad i^\ast=\max\Big\{i:\ p_{(i)}\le q\,\frac{i}{m}\Big\},\qquad \text{umbral}=p_{(i^\ast)}\ \ (0\text{ si ningún }i\text{ cumple})$$
- **Parámetros:** $q=$ `FDR_Q` $=0{,}10$; $m$ = número de celdas con dato **para esa variable** (2.592 en `T2M`, 734 en `GWETROOT`). Las $p$ son las $p_{MK}$ (D2) ya **redondeadas a 5 decimales** (empates en 0,0). Se aplica **por variable**, independientemente.
- **Supuestos/límites:** BH controla la tasa esperada de falsos descubrimientos bajo independencia o dependencia positiva; las celdas vecinas están correlacionadas espacialmente (el supuesto no se verifica). Los $p_{MK}$ ya incluyen el preblanqueo temporal de D2 pero no una corrección espacial.
- **Referencia:** `build_globe.py:76-81`; test `tests/test_globe_grid.py:11-24` (nulos U(0,1)×2000 + 200 reales; FDR empírica ≤0,15 con $q=0{,}10$; devuelve 0 si ningún $p$ pasa).
- **Ejemplo (`T2M`, `globe.json`):** $m=2592$, $i^\ast=1533$, $p_{(1533)}=0{,}05892$ (comprobación: $0{,}10\cdot1533/2592=0{,}05914\ge0{,}05892$) ⇒ umbral $0{,}05892$ (`fdr_threshold`).

### H4. Celda que "pasa FDR" (`build_globe.py:91-95`)

$$\text{pasa\_fdr}=\mathbb 1\big[\,p_{MK}\le\text{umbral}\ \ \land\ \ \text{código}=2\,\big]$$
- Es decir, exige **ambas** cosas: pasar BH y tener veredicto `significant` (que a su vez requiere $p_{eff}<0{,}05$ y $p_{MK}<0{,}05$). `fdr_significant` = número de celdas con `pasa_fdr=1`.
- **Ejemplo (`T2M`):** 1.533 celdas cumplen $p\le0{,}05892$, de ellas **1.344** tienen veredicto `significant` y pasan (`fdr_significant=1344`; 1344/2592 = 51,9 % ⇒ la interfaz muestra "52 %": `pct = round(100·fdr_significant / max(1, cells))`, `GlobeSection.tsx:99` (web de José)). Otras variables: `PRECTOTCORR` 337/2592 (umbral 0,01402), `RH2M` 853/2592 (0,03434), `WS2M` 315/2592 (0,0122), `GWETROOT` 89/734 (0,01213).

### H5. Escala del color: percentil 98 de $\lvert\text{pendiente}\rvert$ (`slope_p98`)

$$\theta_{98}=P_{98}\big(\lvert\text{pendiente}_{c}\rvert\ :\ c\in\text{celdas de la variable}\big)$$
- `np.percentile(np.abs(slopes), 98)` con interpolación lineal (defecto de NumPy). Se calcula **por variable** sobre **todas** las celdas con dato (pasen o no FDR). Sirve para que unos pocos valores extremos no saturen la paleta. Si no hay celdas, 0; el cliente usa `?? 1` si falta la variable (`Globe3D.tsx:150` (web de José)).
- **Valores del repo (`globe.json`):** `T2M` $0{,}8930$ °C/década; `PRECTOTCORR` $0{,}6171$ mm/día/década; `GWETROOT` $0{,}0543$; `RH2M` $2{,}008$ %/década; `WS2M` $0{,}1751$ m/s/década.

### H6. Clases de color de la malla (7 clases) — **solo frontend de `nasaspaceapp`**; la web de José usa el degradado continuo de W8.1

> `globeColors.ts:19-45` de `/home/user/nasaspaceapp`. En la web de José `globeColors.ts` (25 líneas) no tiene clases ni bordes: ver W8.1. Se conserva porque el dato `slope_p98` es el mismo para ambos.

$$\kappa=\frac{\text{pendiente}}{\theta_{98}}\ \ (\kappa=0\text{ si }\theta_{98}=0),\qquad
\text{clase}=\#\{e\in\mathcal E:\ \kappa\ge e\},\quad \mathcal E=\{-0{,}70,\ -0{,}40,\ -0{,}15,\ +0{,}15,\ +0{,}40,\ +0{,}70\}$$

| Clase | Rango de $\kappa$ | Color (rampa `WARMING`: T2M, T2M_MAX, T2M_MIN, TS, T2MDEW) |
|---|---|---|
| 0 | $\kappa<-0{,}70$ | `#1b4f9c` |
| 1 | $[-0{,}70,-0{,}40)$ | `#4a8fd0` |
| 2 | $[-0{,}40,-0{,}15)$ | `#9cc6ea` |
| 3 | $[-0{,}15,+0{,}15)$ (sin cambio) | `#e6e1d8` |
| 4 | $[+0{,}15,+0{,}40)$ | `#f4b942` |
| 5 | $[+0{,}40,+0{,}70)$ | `#e8622c` |
| 6 | $\kappa\ge+0{,}70$ | `#a8124f` |

- Otras rampas: `WATER` (PRECTOTCORR, GWETROOT, GWETTOP, RH2M, EVLAND): neg `#8a4b12 #c9812f #e6bb7a`, pos `#8fd9cc #26a69a #00695c`; `WIND` (WS2M, PS): neg `#4a2c8f #7e63c4 #b9a8e6`, pos `#f2d36b #e0a800 #a87200`; clave desconocida → `WARMING`. El color indica **dirección**, no si es "bueno" o "malo".
- **Opacidad (alfa) en `nasaspaceapp`:** $\alpha=0{,}9$ si la celda pasa FDR y $0{,}07$ si no (`Globe3D.tsx:196` de ese repo; en la web de José: ver W8.1); con el filtro "solo cambios confirmados" las celdas que no pasan FDR se omiten. Los bordes de la leyenda son $e\cdot\theta_{98}$ (`legendClasses`, `globeColors.ts:47-55`), en `GlobeSection.tsx:187,362` (etiquetas con signo y 2 cifras significativas).
- **Ejemplo (`T2M`, $\theta_{98}=0{,}893$):** bordes en $\pm0{,}625$, $\pm0{,}357$, $\pm0{,}134$ °C/década. La celda (−87,5; −172,5) tiene $+0{,}514$ °C/década ⇒ $\kappa=0{,}576$ ⇒ clase 5 (`#e8622c`), $p=0{,}00085$, veredicto 2, pasa FDR ⇒ $\alpha=0{,}9$.

### H7. Geometría dibujada de cada celda (`Globe3D.tsx:148-170` (web de José))

$$\text{polígono}=\big[\lambda\mp\tfrac{c}{2}\big]\times\big[\operatorname{clamp}_{\pm85}(\varphi\mp\tfrac c2)\big],\quad c=\texttt{cell\_deg}=5$$
- La latitud se recorta a $\pm85^\circ$ (límite de Mercator del mapa). Texto emergente: pendiente con signo, `fmtNum` (3 cifras), y etiqueta del veredicto 0/1/2 (`Globe3D.tsx:30-33,320-340`).

---

## I. Reglas del recomendador y de la IA

> Son reglas tabulares/heurísticas, no estadística. Se documentan porque determinan qué variables se sugieren.

### I1. Recomendador por reglas — `recommend` (`catalog.py:250-271`)

$$\text{variables}=\big[\ k\in L(\text{preocupación},\text{tipo de lugar})\ :\ k\in\text{catálogo}\ \big]_{[:3]},\qquad
L=\begin{cases}\texttt{\_PLACE\_TWEAKS}[(c,p)]&\text{si el par existe}\\ \texttt{\_RULES}[c]&\text{si no}\end{cases}$$
- Tabla base `_RULES`: heat → T2M, T2M_MAX, T2M_MIN; water → PRECTOTCORR, GWETROOT, EVLAND; drought → GWETROOT, PRECTOTCORR, T2M_MAX; sun → ALLSKY_SFC_SW_DWN, CLOUD_AMT, T2M; wind → WS2M, PS, PRECTOTCORR. Excepciones `_PLACE_TWEAKS` (8 pares): (heat, city) → T2M_MIN, DTR, WBGT; (heat, cold) → T2M, TS, T2M_MIN; (heat, coast) → WBGT, T2M, RH2M; (water, dry) → PRECTOTCORR, GWETTOP, VPD; (water, forest) → PRECTOTCORR, EVLAND, RH2M; (drought, farmland) → GWETROOT, VPD, PRECTOTCORR; (drought, dry) → GWETTOP, VPD, T2M_MAX; (wind, coast) → WS2M, PS, PRECTOTCORR. Máximo 3 variables.

### I2. Clasificación por palabras clave (plan B sin IA) — `interpret_with_rules` (`ai.py:57-83`)

$$\text{score}_k=\sum_{w\in W_k}\mathbb 1[\,w\subset q\,],\qquad
\text{preocupación}=\begin{cases}\arg\max_k\text{score}_k&\text{si algún score}>0\ (\text{empate: gana el primero en el orden heat, drought, water, sun, wind})\\ \text{heat}&\text{si todos son 0}\end{cases}$$
- $q$ = pregunta en minúsculas y sin tildes (`NFD`, quitando marcas `Mn`); coincidencia por **subcadena**. El tipo de lugar es la **primera** categoría (orden city, farmland, forest, coast, dry, cold) con alguna palabra contenida; `place_query = None`. (La réplica cliente usa expresiones regulares distintas: ver K.)

### I3. Parámetros de la llamada a la IA (no son cálculos)

- Modelo `claude-opus-5-5`, `max_tokens=16000`, `effort="low"`, `timeout=90 s`, `max_retries=2`, salida JSON restringida para `interpret`; plantilla de reserva muestra a lo sumo 4 avisos (`ai.py:26,48,114,117,189-214,229`). La IA solo recibe cifras recalculadas por el servidor (`main.py:546-599`), redondeadas: pendiente, IC, cambio total y $p_{MK}$ a 5 decimales (`_trend_facts`, `main.py:526-536`); valor, límites 95 % del escenario a 4 decimales (`_forecast_facts`, `main.py:514-523`); en relación: $r_{det}$ a 3 decimales, $p_{det}$ a 5, $r_{raw}$ a 3 (`main.py:595-597`).

---

## J. Scripts y simulaciones Monte Carlo (motor Python)

### J1. `backend/scripts/export_static_api.py` — cómo se generó `bundle.json`

- Ejecuta la API FastAPI con `TestClient` **sin red** (`httpx.AsyncClient.get/post` parcheados para fallar, `:27-32`), de modo que usa solo las muestras locales. Constantes: `START_YEAR = 1990` (`:41`), `FORECAST_YEARS = [2030, 2040, 2050, 2075, 2100]` (`:42`), `CORE_VARS` = {T2M, T2M_MIN, T2M_MAX, PRECTOTCORR, GWETROOT, RH2M, WS2M, ALLSKY_SFC_SW_DWN} (`:45-54`), clave de coordenadas $\texttt{f"\{round(lat,2):.2f\},\{round(lon,2):.2f\}"}$ (`:57-58`), demografía para horizontes (2030, 2050, 2100) (`:187`), relación con variables $\{\text{variable sugerida},\text{T2M},\text{PRECTOTCORR},\text{GWETROOT},\text{T2M\_MAX}\}$ por cada indicador del que haya muestra (`:211`). Cubre 7 regiones × 17 variables (119 tendencias), 17 comparaciones, 7 escaneos (`start=1990`). Copia `globe.json` sin modificar.
- No contiene fórmulas propias; todo cálculo delega en `trends.py`, `forecast.py`, `relate.py`, `demography.py` (A–G).

### J2. `backend/scripts/fetch_samples.py` — muestras locales

- Descarga y guarda, sin transformar, NASA POWER (por región, `_fetch_live`), Banco Mundial (3 reintentos por indicador, `:41`) y OWID/ONU (estimaciones y proyección por país). Sin fórmulas. `worldbank.fetch_all` reintenta 2 veces (`worldbank.py:81`).

### J3. `build_globe.py` — ver H. Parámetros de ejecución: 60 celdas por lote, `--workers` 6 por defecto, reanudable con `.globe_partial.json`.

### J4. Simulaciones Monte Carlo (dónde viven realmente)

No hay un script de simulación en `backend/scripts/`. Las simulaciones están en `backend/tests/` (`pytest`, con semilla fija) y la **tabla de la portada es un dato fijo** (`Briefing.tsx:6-10` en la web de José; `docs/RETO.md`, README §10). Los ensayos reproducibles son:

| Prueba (archivo:línea) | Diseño | Aserción |
|---|---|---|
| `test_trends.py:45-54` | `default_rng(7)`, 300 series AR(1) de $n=30$ (1990–2019), $\phi=0{,}4$, **sin tendencia** (generador `ar1`: $x_t=\phi x_{t-1}+\varepsilon_t$, $\varepsilon\sim N(0,1)$, 50 puntos de calentamiento, `test_trends.py:22-27`) | tasa de `significant` ≤ 9 % |
| `test_trends.py:57-63` | `default_rng(7)`, 300 series AR(1) $\phi=0{,}4$, regresión ingenua `linregress(p<0,05)` | tasa > 12 % (control) |
| `test_trends.py:66-73` | `default_rng(11)`, 200 series de $n=40$, AR(1) $\phi=0{,}2$ + tendencia $0{,}08$/año | potencia > 85 % |
| `test_trends.py:76-83` | `default_rng(5)`, $n=20$, pendiente $0{,}03$, ruido $N(0;0{,}6)$ | `years_needed > 20`, aparece en el texto |
| `test_trends.py:86-89` | fórmula | `years_needed(1;0,1;0)=24` |
| `test_trends.py:129-138` | 40 series de $n=36$, pendiente $0{,}012$, ruido $N(0;0{,}25)$, semilla 4 | alguna `period_sensitive` |
| `test_forecast.py:16-26` | `default_rng(0)`, 400 series $n=36$, $5+0{,}1(x-1990)+N(0,1)$; verdad futura 2030 con ruido $N(0,1)$ | cobertura del PI en [0,91; 0,99] |
| `test_relate.py:93-97` | semillas 0–199, 200 pares de series con tendencia y ruido independientes | ≤ 20 falsos positivos "año a año" y `trend_driven` en todas |
| `test_globe_grid.py:11-24` | `default_rng(0)`, 2000 p~U(0,1) + 200 p~U(0,10⁻⁴), BH q=0,10 | todos los reales pasan, FDR empírica ≤ 0,15; 0 si p∈U(0,5;1) |

- **Tabla de falsos positivos** (30 años, sin tendencia; `docs/RETO.md`, README): $\phi=0$: ordinaria 4,8 %, solo preblanqueo 3,8 %, solo $n_{eff}$ 4,3 %, **motor 3,6 %**; $\phi=0{,}4$: 19,3 %, 11,0 %, 8,7 %, **4,8 %**; $\phi=0{,}8$: 49,0 %, 23,1 %, 13,1 %, **8,2 %**. Potencia con $\phi=0$ a $0{,}06\sigma$/año: 65 % (74 % la regresión sola); detección a $n^\ast$: 88–96 %; cobertura del PI: 91–99 %; TFPW: 20–58 % de falsos positivos. **El código que produjo estas cifras exactas (número de réplicas, semilla) no está en el repositorio**: solo se pueden reproducir las desigualdades de los tests. Las cifras describen el **motor Python**, no el motor TypeScript de la web de José.

---

# PARTE 3 · Comparación explícita: motor TypeScript (navegador de José) vs. motor Python

| # | Elemento | Python (`trends.py`/`forecast.py`/`relate.py`) | TypeScript (`staticFallback.ts`) | Efecto |
|---|---|---|---|---|
| 1 | Año válido | ≥10 meses; media = base + media de anomalías (B2) | ≥10 valores; media cruda (W2) | Igual en años completos; sesgo estacional en años incompletos (TS) |
| 2 | Último año / ventana | `last_full_year()` (año actual−1) | `2025` fijo | TS no avanza solo |
| 3 | Valores faltantes | `≠ −999` y no mes 13 | `> −900`, finito, mes 1–12 | Equivalente en la práctica |
| 4 | $r$ lag‑1 | $r+(1+4r)/n$, $[0;0{,}95]$, $n\ge4$ | $(nr+1)/(n-3)$, $[-0{,}92;0{,}92]$, $n\ge5$ | Ligeras diferencias numéricas; TS admite negativos |
| 5 | $n_{eff}$ | $\max(3,\,n(1-r^\ast)/(1+r^\ast))$ | $\max(3,\min(n,\,n(1-r^+)/\max(0{,}05,1+r^+)))$ | Casi igual |
| 6 | Error estándar OLS | $\mathrm{se}_0\sqrt{(n-2)/(n_{eff}-2)}$ | $\mathrm{se}_0\sqrt{n/n_{eff}}$ | TS algo menor |
| 7 | $p$ OLS e IC | $t$ exacta (g.l. reales), IC con $t_{0{,}975,\nu}$ | aprox. normal de la t; IC con 1,96 | TS más estrecho; $p$ conservadora con g.l. bajos |
| 8 | Mann–Kendall | preblanqueo simple si $r^\ast>0$; $p$ exacta ($k\le33$) o normal sin continuidad, con empates; τ‑b original | **TFPW** si $\lvert r\rvert\ge0{,}05$; normal con continuidad, sin empates; τ‑a de la serie preblanqueada | TS más liberal (Managua: $p=0{,}008$ vs $0{,}109$) |
| 9 | Theil–Sen | intercepto `median(y)−ω·median(x)`; IC Sen con ties y `round` | intercepto `median(y−ωx)`; IC sin ties con `floor/ceil` | IC ligeramente distinto |
| 10 | % de cambio | base = media de los 5 primeros años; $10^{-9}$ | base = valor ajustado en el 1.er año; $10^{-6}$ | Porcentajes distintos |
| 11 | Años necesarios | $\sqrt{12}$ incluido; σ de Theil–Sen; $\varphi\le0{,}95$; sin piso/techo; `None` si significativa | **sin** $\sqrt{12}$; $s$ de OLS; $r^+\le0{,}92$; piso 15, techo 200; 120 si pendiente≈0; siempre se muestra | TS ≈2,3× menos años |
| 12 | Veredicto | `significant` exige $p_{MK}<0{,}05$ **y** IC de OLS sin 0; `not_yet` si $p<0{,}20$ **o** discrepan | `significant` si $p_{MK}<0{,}05$; `not_yet` si $<0{,}20$; discrepancia solo informativa | TS más liberal |
| 13 | Datos insuficientes | error (HTTP 422 / omitida) si <15 años | $n<5$ tendencia vacía; $5\le n<15$ `no_trend` | Comportamiento distinto |
| 14 | Sensibilidad al periodo | 16 ventanas (`PERIOD_SHIFT=3`) | **no se calcula** (`false`) | TS no avisa |
| 15 | Salto (Pettitt) | $p<0{,}05$ **y** RSS escalón $<0{,}7$ RSS recta | $n\ge20$, $p<0{,}05$, $0<t^\ast<n-1$ | TS avisa más |
| 16 | Avisos | 4 (autocorr >0,5; discrepancia; periodo; salto) | 3 (corta; salto; discrepancia) | Faltan 2 en TS |
| 17 | Bonferroni | $m$ = nº de resultados (17 en el bundle) | $m$ = nº de variables devueltas por POWER (≤14) | $p_{adj}$ menor en TS |
| 18 | Pronóstico: cuantil | $t_{0{,}975,n-2}$ | 1,96 | Banda TS algo más estrecha |
| 19 | Pronóstico: $1/n$ | $1/n$ | $1/n_e$ ($n_e\ge3$) | Banda TS más ancha con autocorrelación |
| 20 | Pronóstico: límites físicos | $[\ell,u]$ por unidad/`ratio_scale` (E2) | ninguno | TS puede salir de rango |
| 21 | Pronóstico: avisos | horizonte, $r_1>0{,}3$, $p\ge0{,}05$, límite | sólo autocorrelación publicada $>0{,}25$ | Menos avisos en TS |
| 22 | `n_points` del pronóstico | $n$ (años observados) | nº de años futuros | Campo con distinto significado |
| 23 | Relación: mínimo de años | 10 | 8 | TS acepta menos solapamiento |
| 24 | Relación: "sin tendencia" | residuo de regresión lineal sobre el año | primeras diferencias | Correlaciones distintas (Somoto: $-0{,}137$ vs $-0{,}227$) |
| 25 | Relación: $p$ | `scipy` exacto (t con $n-2$ g.l.) | t aprox. por normal | Pequeñas diferencias |
| 26 | Relación: fuerza | $\lvert r_{det}\rvert\ge0{,}5$ fuerte; $\ge0{,}3$ moderada | fuerte si $p<0{,}05$ y $\ge0{,}5$; moderada si $\ge0{,}25$ | Umbrales distintos |
| 27 | Relación: `trend_driven` | $p_{raw}<0{,}05$ y (no sig. o $\lvert r_{raw}\rvert-\lvert r_{det}\rvert>0{,}3$) | $\lvert r_{raw}\rvert\ge0{,}5$, $p_{raw}<0{,}05$, $p_{det}\ge0{,}1$ | Somoto: Python sí, TS no |
| 28 | Relación: avisos y nota espacial | 5 avisos (n<20; Pearson≠Spearman; escala…) | solo rezago, exclusión y tendencia paralela | Menos avisos en TS |
| 29 | Demografía: separación hist./proyección | cabecera "projected" | año ≤ 2023 fijo, última columna | TS frágil ante cambios de OWID |
| 30 | Demografía: escenario | OLS + límites (E2) | W4 (sin límites) | Distinto para 2040/2075 |
| 31 | Satélite: nubosidad / plataforma / recuadro | <20 %, plataforma por año, recuadro cuadrado en km | <35 %, sin filtro, ±0,08° | Imágenes y encuadre distintos |
| 32 | Cobertura del suelo | cálculo completo (G4–G5, E5) | no existe | — |
| 33 | Clasificación de pregunta | conteo de palabras clave sin tildes | regex en orden de prioridad | Resultados distintos |
| 34 | Color del globo | (no calcula color) | degradado continuo + alfa continuo (W8.1) | — |

---

# PARTE 4 · Modelo de crecimiento urbano «Ciudad 3D» (escenario por celdas)

> **Qué es.** Un escenario —no una predicción— de cómo crece una ciudad: un autómata celular de celdas de 100 m cuyas probabilidades de transición se aprenden con una regresión logística sobre la cobertura del suelo 2017–2023, y cuya **cantidad** de suelo construido sigue la población urbana de la ONU, el ingreso por habitante y un empuje migratorio por clima. Código: `backend/scripts/build_city_growth.py` (genera `static-api/city/<ciudad>.json`) y `frontend/src/CityGrowth3D.tsx` (dibuja el resultado). **Estado:** es nuestro repositorio; está portándose a la web de José. Ejemplo numérico: Managua (`city/managua.json`).

## Q1. Malla de 100 m (`grid_for`)

$$\Delta\varphi=\frac{100}{111\,320},\qquad \Delta\lambda=\frac{100}{111\,320\cos\varphi_0},\qquad n=\operatorname{round}\!\left(\frac{2\,h\cdot 1000}{100}\right)$$

$$\lambda_{\text{oeste}}=\lambda_0-\tfrac12 n\,\Delta\lambda,\qquad \varphi_{\text{norte}}=\varphi_0+\tfrac12 n\,\Delta\varphi$$

$h$ = semi‑lado en km (12 para Managua), $\varphi_0,\lambda_0$ = centro de la ciudad. Resultado: $n=240$ filas y columnas, celdas de ≈100 m × 100 m ($0{,}01$ km² cada una).

## Q2. Fracción construida y agua por celda (`read_lulc_year`)

Cobertura del suelo anual de 10 m (Impact Observatory/Esri, colección `io-lulc-annual-v02`; clase 7 = construido, clase 1 = agua). Para cada año $t\in\{2017,\dots,2023\}$ y cada celda $c$ de 100 m:

$$f_c(t)=\frac{1}{|P_c|}\sum_{p\in P_c}\mathbf 1[\text{clase}(p,t)=7],\qquad w_c(t)=\frac{1}{|P_c|}\sum_{p\in P_c}\mathbf 1[\text{clase}(p,t)=1]$$

$P_c$ = píxeles de 10 m que caen en la celda (promedio al reproyectar a la malla lon/lat con `Resampling.average`). Se define:

$$B_c(t)=\mathbf 1[f_c(t)\ge 0{,}5],\qquad B_c(t)\leftarrow B_c(t)\lor B_c(t-1)\ \text{(lo construido no «desaparece»; evita el parpadeo de clasificación)}$$

$$W_c=\operatorname{mediana}_t\,w_c(t),\qquad \text{celda de agua}\iff W_c\ge 0{,}5$$

Área construida del año $t$: $A(t)=0{,}01\cdot\sum_c B_c(t)$ km². Managua: $A(2017)=190{,}9$ → $A(2023)=226{,}4$ km².

## Q3. Pendiente del terreno (`read_slope`)

Modelo digital de elevaciones Copernicus GLO‑30 reproyectado a la malla (bilineal). Con $z$ suavizado por un filtro gaussiano de $\sigma=1$ celda y $\Delta=100$ m:

$$g_x=\frac{\partial z}{\partial x},\ g_y=\frac{\partial z}{\partial y}\ \ (\text{diferencias centrales}),\qquad \text{pendiente}=\arctan\!\sqrt{g_x^2+g_y^2}\ \ [^\circ]$$

## Q4. Variables explicativas de cada celda (`features`)

Calculadas desde el estado construido $B$ del momento (se recalculan en cada paso del escenario):

$$x_1=\ln(1+d_c),\quad d_c=\text{distancia euclídea (en celdas) a la celda construida más cercana}$$

$$x_2=\overline{B}_{3\times3},\quad x_3=\overline{B}_{7\times7},\quad x_4=\overline{B}_{15\times15}\quad(\text{media de la máscara en ventanas centradas: densidades a ≈300 m, 700 m y 1{,}5 km})$$

$$x_5=\frac{\text{pendiente}}{10},\qquad x_6=\ln(1+d^{\text{agua}}_c),\quad d^{\text{agua}}_c=\text{distancia (celdas) a la celda de agua más cercana}$$

## Q5. Probabilidad de que una celda libre se construya: regresión logística (`fit_logistic`, `score`)

Muestras: celdas libres en $t_0$ (no construidas y con $W_c<0{,}5$), con etiqueta $y_c=1$ si $B_c(t_1)=1$. Se estandariza $\tilde x_j=(x_j-\mu_j)/\sigma_j$ (con $\sigma_j+10^{-9}$) y:

$$z_c=\mathbf w^\top\tilde{\mathbf x}_c+b,\qquad p_c=\frac{1}{1+e^{-z_c}}$$

$$\mathcal L(\mathbf w,b)=-\frac{1}{N}\sum_c\Big[y_c\ln(p_c+\varepsilon)+(1-y_c)\ln(1-p_c+\varepsilon)\Big]+\lambda\sum_{j=1}^{6}w_j^2,\qquad \lambda=10^{-3},\ \varepsilon=10^{-9}$$

(el sesgo $b$ no se penaliza). Se minimiza con L‑BFGS‑B usando el gradiente analítico $\nabla_{\mathbf w}\mathcal L=\tfrac1N\tilde X^\top(p-y)+2\lambda\mathbf w$. **Modelo final:** transiciones de años consecutivos 2017→2018, …, 2022→2023 apiladas. Para el *reparto* se usa $z_c$ (basta el orden: es monótono respecto a $p_c$).

Coeficientes finales (Managua): cercanía a lo construido = -0,894, densidad 300 m = 0,654, densidad 700 m = 0,110, densidad 1,5 km = -0,056, pendiente = -0,372, cercanía al agua = 0,050.

## Q6. Validación: ¿acierta dónde crece la ciudad? (`transitions`, AUC, figura de mérito)

Se ajusta solo con 2017→2020 y se prueba en 2020→2023 (celdas nuevas reales $T$, $|T|=n_1=1213$):

$$\text{AUC}=\frac{R_1-n_1(n_1+1)/2}{n_1\,n_0}$$

$R_1$ = suma de los rangos de las celdas con $y=1$ en el orden de $z$; $n_0$ = celdas libres que no se construyeron. Equivale a $P(z_{\text{nueva}}>z_{\text{no nueva}})$.

$$\text{FoM}=\frac{|P\cap T|}{|P\cup T|}=\frac{\text{aciertos}}{\text{aciertos+omisiones+falsas alarmas}},\qquad P=\text{las }n_1\text{ celdas de mayor }z$$

Referencias: **cercanía** (las $n_1$ celdas con menor $d_c$) y **azar** (muestra aleatoria sin reemplazo, semilla 1). Resultado Managua: AUC = 0,857; FoM modelo = 0,182, cercanía = 0,115, azar = 0,037 → el modelo acierta ≈4.9 veces más que el azar y ≈1.6 veces más que la cercanía.

## Q7. Población urbana (`urban_population`)

Población total $P(t)$ (ONU WPP vía OWID: estimada y proyectada hasta 2100) y porcentaje urbano $u(t)$ (solo hasta 2025). Para $t>2025$ se prolonga $u$ con la tendencia logística de 2000–2025:

$$\operatorname{logit}\!\left(\frac{u(t)}{100}\right)=a+b\,t\ \ (\text{MCO sobre 2000–2025}),\qquad u(t)=\frac{100}{1+e^{-(a+bt)}},\qquad U(t)=P(t)\,\frac{u(t)}{100}$$

## Q8. Exponente de escala $\beta$ (suelo construido vs. población urbana)

$$\ln A(t)=c+\beta\ln U(t)\ \ (\text{MCO sobre 2017–2023}),\qquad \beta_c=\min\!\big(\max(\beta,\,0{,}5),\,1{,}3\big)$$

Managua: $\beta=1{,}68$ → usado $\beta_c=1{,}30$. *Límite:* el salto 2017→2018 (33,1 % → 35,2 % de la malla) parece un ajuste de la clasificación y no crecimiento real; por eso se acota $\beta$.

## Q9. Impulsores sociales (`social_drivers`, `theil_sen_projection`)

Ingreso por habitante $G(t)$ (Banco Mundial `NY.GDP.PCAP.KD`) y participación del empleo agrario $a(t)$ (`SL.AGR.EMPL.ZS`/100), ambos con tendencia log‑lineal de Theil–Sen desde 2005:

$$\hat\omega=\operatorname{mediana}_{i<j}\frac{\ln G_j-\ln G_i}{x_j-x_i},\qquad \hat\omega\leftarrow\operatorname{clip}\big(\hat\omega,\ \ln(1+g_{\min}),\ \ln(1+g_{\max})\big),\qquad \hat a=\operatorname{mediana}_i(\ln G_i-\hat\omega x_i)$$

$$G(t)=\exp(\hat a+\hat\omega\,t)$$

Cotas de crecimiento anual: ingreso $g\in[0\,\%,\,3{,}5\,\%]$; empleo agrario $g\in[-5\,\%,\,0\,\%]$. Managua/Nicaragua: ingreso 1,95 %/año; empleo agrario -0,45 %/año.

## Q10. Impulsores climáticos y estrés (`climate_drivers`, `pettitt`, `stress_index`)

Para $X\in\{\text{T2M},\text{PRECTOTCORR},\text{GWETROOT}\}$ se usa el motor de tendencias de DATEX (Parte 2) sobre las medias anuales 1990–último año completo. **Control de discontinuidades (Pettitt):**

$$U_k=\sum_{i\le k}\sum_{j>k}\operatorname{sgn}(y_j-y_i),\qquad K=\max_k|U_k|,\qquad p_{\text{Pettitt}}=\min\!\Big(1,\,2\,e^{-6K^2/(n^3+n^2)}\Big)$$

Si $p_{\text{Pettitt}}<0{,}05$ se considera que hay un salto en $k^\ast+1$ y se **reestima la tendencia solo con los años posteriores al salto** (si quedan al menos 15). Se pondera por la evidencia del veredicto $v$ de esa tendencia:

$$w_X=\begin{cases}1&v=\text{significativa}\\0{,}5&v=\text{todavía no}\\0&v=\text{sin tendencia}\end{cases},\qquad \Delta X(t)=w_X\cdot\frac{\hat\omega_X^{\text{déc}}}{10}\,(t-2023)\ \ (\text{escenario lineal})$$

$$h(t)=\operatorname{clip}\!\Big(\frac{\max(0,\Delta T)}{2\,{}^{\circ}\text{C}},\,0,\,1\Big),\qquad d(t)=\operatorname{clip}\!\Big(\tfrac12\frac{\max(0,-\Delta\text{GW})}{0{,}10}+\tfrac12\frac{\max(0,-\Delta P/\bar P_{10})}{0{,}25},\,0,\,1\Big)$$

$$S(t)=\operatorname{clip}\big(\tfrac12 h(t)+\tfrac12 d(t),\,0,\,1\big)$$

$\bar P_{10}$ = media de lluvia de los últimos 10 años; $\Delta\text{GW}$ = cambio de humedad de raíces (0–1). Las escalas «2 °C», «0,10» y «25 %» son **supuestos de escenario** (estrés = 1). Managua: Pettitt detecta saltos en T2M (1999), PRECTOTCORR (2005) y GWETROOT (2005); tras el salto, ninguna tendencia es significativa (veredictos no_trend, not_yet, not_yet) y las tendencias de lluvia y humedad apuntan a más agua, no a sequía, así que $S(t)=0$.

## Q11. Cuánto suelo se construye: área objetivo (`target_area`)

$$A_{\text{población}}(t)=A(2023)\left(\frac{U(t)}{U(2023)}\right)^{\beta_c}$$

$$A_{\text{integrado}}(t)=A(2023)\left[\frac{U(t)}{U(2023)}\Big(1+\kappa\,S(t)\,a(t)\Big)\right]^{\beta_c}\left(\frac{G(t)}{G(2023)}\right)^{\gamma},\qquad \kappa=0{,}5,\ \gamma=0{,}2$$

$\kappa$ (empuje migratorio máximo por clima, proporcional al empleo agrario expuesto) y $\gamma$ (elasticidad del suelo por persona al ingreso) son **supuestos explícitos y ajustables, no coeficientes ajustados**; se muestra su sensibilidad. **Ejemplo (Managua, 2050):** $U(2023)=4{,}034$ M, $U(2050)=5{,}585$ M, $G(2023)=2282$ USD, $G(2050)=3847$ USD, $S=0$ ⇒

$$A_{\text{población}}(2050)=226{,}4\left(\frac{5{,}585}{4{,}034}\right)^{1{,}30}=345{,}6\ \text{km}^2,\qquad A_{\text{integrado}}(2050)=345{,}6\left(\frac{3847}{2282}\right)^{0{,}2}=383{,}6\ \text{km}^2$$

(valores del JSON: 345.5 y 383.5 km²).

**Sensibilidad 2050** (misma fórmula variando supuestos): estrés climático $S_{2050}=0/0{,}5/1$ con $\kappa=0{,}5$ → 383.5 / 417.7 / 452.6 km²; con $\kappa=1$ y $S=1$ → 524.3 km²; sin efecto del ingreso ($\gamma=0$) → 345.5 km².

## Q12. Dónde se construye: reparto año a año (`allocate`, `run_scenario`)

Para cada año $t_k\in\{2030{,}2035{,}2040{,}2045{,}2050\}$ (con el estado actual $B$):

$$N_k=\operatorname{round}\!\left(\frac{A_{\text{objetivo}}(t_k)-0{,}01\sum_cB_c}{0{,}01}\right),\qquad \text{se construyen las }N_k\text{ celdas libres con mayor }z_c\ \ (\text{libre}=\neg B\wedge\neg\text{agua})$$

Tras cada paso se recalculan $x_1,\dots,x_6$ (efecto de contagio: lo recién construido atrae lo siguiente). Se guarda en qué paso $k$ se añadió cada celda (rejilla `added`, 0 = no añadida).

## Q13. Codificación y dibujo en 3D

- **Densidad base** (celdas construidas en 2023): $\text{densidad}_c=\operatorname{round}(100\,f_c(2023))\in[0{,}100]$.
- **Densidad de las celdas nuevas:** $\bar\rho=\operatorname{clip}\big(\operatorname{media}\{f_c(t_1): B_c(t_0)=0,\,B_c(t_1)=1\},\ 0{,}3,\ 1\big)$ ⇒ 0,75 en Managua.
- **Altura del bloque (`heightOf`, `jitter`, `CityGrowth3D.tsx`):**

$$h_c=6+54\left(\frac{\text{densidad}_c}{100}\right)^{1{,}3}+6\,j_c\ \ [\text{m}],\qquad j_c=\operatorname{frac}\!\big(\sin(127{,}1\,r+311{,}7\,c)\cdot 43\,758{,}5453\big)\in[0{,}1)$$

($r,c$ = fila y columna; $j_c$ es una variación determinista para que los bloques no se vean planos; las alturas son **esquemáticas**, no edificios reales). Para celdas proyectadas se usa $\text{densidad}=100\,\bar\rho$.
- **Color de lo proyectado:** interpolación lineal entre un cian cercano (año 2030) y uno lejano (2050) según el año en que se añade la celda; lo construido en 2023 va en azul marino.
- **Cifras mostradas:** superficie construida del año $t$ (de `stats.built_km2`), población urbana ($U$), celdas visibles = celdas con $B$ en 2023 o añadidas con año $\le t$.

**Límites declarados en la propia vista:** escenario de tendencia, no predicción; no conoce planes urbanísticos; con 10 m se ven manzanas, no edificios; ingreso y clima actúan con supuestos explícitos.

---

# CONSTANTES Y UMBRALES (tabla maestra)

| Constante | Valor | Dónde |
|---|---|---|
| Años mínimos de una serie | 15 (Python); TS: <5 vacío, <15 `no_trend` | `trends.py:42`; `staticFallback.ts:330,404` |
| Meses mínimos por año | 10 | `trends.py:43`; `staticFallback.ts:496` |
| $\alpha$ (significancia) | 0,05 | `trends.py:44`; `staticFallback.ts:404` |
| Umbral "todavía no" | 0,20 | `trends.py:45`; `staticFallback.ts:404` |
| Desplazamiento de periodo | 3 años (Python); no existe en TS | `trends.py:46` |
| IC Theil–Sen / OLS | 95 % (Python: $z=1{,}95996$ y $t_{0{,}975,\nu}$; TS: 1,96) | `trends.py:288`; `staticFallback.ts:224,303` |
| Constante de años necesarios | 3,3 (Python con $\sqrt{12}$; TS sin) | `trends.py:166`; `staticFallback.ts:388-396` |
| Cotas de autocorrelación | Python $[0;0{,}95]$; TS $[-0{,}92;0{,}92]$ | `trends.py:134`; `staticFallback.ts:199` |
| Piso de $n_{eff}$ | 3 | `trends.py:153`; `staticFallback.ts:218` |
| Pettitt: $p$ y razón de RSS | 0,05 y 0,7 (Python); TS $p<0{,}05$, $n\ge20$ | `trends.py:198`; `staticFallback.ts:265,286` |
| Años mínimos de escenario | 5; horizontes hasta 2100 | `forecast.py:19`; `main.py:330` |
| Aviso de horizonte | $>$ span/2 | `forecast.py:102` |
| Aviso de autocorrelación del escenario | Python $r_1>0{,}3$; TS $>0{,}25$ | `forecast.py:109`; `staticFallback.ts:563` |
| Relación: años mínimos / choque | 10 / {2020, 2021} (Python); 8 (TS) | `relate.py:21-22`; `staticFallback.ts:625` |
| Relación: fuerza | 0,3 y 0,5 (Python); 0,25 y 0,5 (TS) | `relate.py:65`; `staticFallback.ts:647` |
| `trend_driven` | $\Delta r>0{,}3$ (Python); $\lvert r_{raw}\rvert\ge0{,}5$, $p_{det}\ge0{,}1$ (TS) | `relate.py:99`; `staticFallback.ts:649` |
| Rezago permitido | 0, 1, 2 | `main.py:224`; `staticFallback.ts:1113` |
| Celda del globo / nº de celdas | 5° / 2.592 | `build_globe.py:28` |
| FDR objetivo $q$ | 0,10 | `build_globe.py:31` |
| Percentil de escala | 98 | `build_globe.py:100` |
| Alfa del globo (José) | $0{,}22+0{,}54\min(1,\lvert t\rvert)$ o 0,06 | `Globe3D.tsx:167` |
| Bordes de las clases de color (solo `nasaspaceapp`) | $\pm0{,}15,\ \pm0{,}40,\ \pm0{,}70$ | `globeColors.ts` (otro repo) |
| Radio de región / locate (navegador) | 28 km / 45 km | `staticFallback.ts:111,915` |
| País por ciudad más cercana | ≤250 km | `places.py:19` |
| Radio terrestre (haversine) | 6371 km | `places.py:72`; `staticFallback.ts:102` |
| km por grado (satélite) | 111 | `satellite.py:66-67,72-73` |
| `half_km` | 8 (por defecto), 1–40 | `satellite.py:128,170`; `main.py:431` |
| Nubosidad máxima | 20 % (Python), 35 % (TS) | `satellite.py:23`; `staticFallback.ts:1166` |
| Salto de cobertura | >5 puntos | `satellite.py:207` |
| Caché POWER / OWID / BM | 6 h (256) / 24 h / 24 h (512) | `power.py:23-24`; `demography.py:22`; `worldbank.py:18-19` |
| Año inicial / por defecto | 1981 / 1990 | `power.py:21`; `App.tsx:58` (José) |
| Pausa artificial | 1000–2500 ms | `api.ts:21` |

---

# N. Dónde NO hay fórmula propia (se delega en una fuente externa)

| Qué | Quién lo calcula | Dónde se usa |
|---|---|---|
| Variables climáticas básicas (T2M, T2M_MAX/MIN, TS, PRECTOTCORR, EVLAND, GWETROOT/TOP, RH2M, T2MDEW, CLOUD_AMT, ALLSKY_SFC_SW_DWN, WS2M, PS) | NASA POWER (MERRA‑2/CERES); sin conversiones de unidades en el código | `power.py`; muestras `samples/*.json` |
| Indicadores socioeconómicos (10) | Banco Mundial (API v2) | `worldbank.py` |
| Población, crecimiento, fecundidad, natalidad, mortalidad, urbana, esperanza de vida y la **proyección ONU** (variante media) | ONU WPP vía Our World in Data | `demography.py`; `bundle.demography` |
| Cobertura del suelo anual (10 m) | Impact Observatory/Esri vía Planetary Computer (solo Python) | `satellite.py` |
| Escenas satelitales (imagen, nubosidad, plataforma) | Microsoft Planetary Computer (STAC y servicio de datos) | `satellite.py`; `staticFallback.ts:1147-1200` |
| Geocodificación, país de coordenada | Open‑Meteo, GeoNames/`reverse_geocoder`, `pycountry`, BigDataCloud | `places.py`; `staticFallback.ts` |
| Distribución t, normal, Theil–Sen, Kendall, Pearson, Spearman (en Python) | SciPy/NumPy (con las salvedades de D2/C1) | `trends.py`, `relate.py`, `forecast.py` |
| Explicación narrada y clasificación de preguntas con IA | Claude (solo backend Python; **no** en la web de José) | `ai.py` |
| Meteomatics, Firebase, Planetary Computer SDK (`planetary.py`) | Servicios externos; sin cálculo | `meteomatics.py`, `firebase.py`, `planetary.py` |
| Mapa base, relieve, noche (VIIRS), proyección de globo | MapLibre GL, Esri, NASA GIBS, OSM | `Globe3D.tsx` |
| Gráficos | Recharts (escalas, interpolación) | `*Chart.tsx` |
| Formato de números/fechas | `Number.prototype.toLocaleString` (`Intl`) | `i18n.ts`, `api.ts` |
| Tabla Monte Carlo de la portada | Texto fijo (resultado de simulaciones externas al repo) | `Briefing.tsx:6-10` |

---

# O. Hallazgos, rarezas y discrepancias

1. **Dos motores, dos veredictos.** El mismo dato puede dar `not_yet` (Python) o `significant` (navegador). La web de José no avisa al usuario de cuál se usa (W0, W3.12).
2. **TFPW en el navegador:** el propio README/RETO del motor Python indica que TFPW da 20–58 % de falsos positivos; el navegador lo usa. Tampoco aplica el criterio doble (MK + IC de OLS) ni la sensibilidad al periodo, que son parte de las garantías de falsos positivos de la Tabla Monte Carlo.
3. **Años necesarios** sin $\sqrt{12}$ en el navegador (≈2,3× menos) y con piso 15 (W3.7).
4. **`yearsNeeded` huérfano:** en `staticFallback.ts:378-387` se calcula una expresión que solo sirve para `Number.isFinite`; el valor publicado es `correctedYearsNeeded`.
5. **`methods_agree`** del navegador incluye igualdad de signo entre Theil–Sen y OLS (Python no).
6. **Límites del escenario:** en Python, `"% anual"` (crecimiento de la población, que puede ser negativo) se recorta a $[0,100]$ porque la unidad empieza por `%` (E2); el navegador no recorta nada.
7. **Texto "14 variables" vs 17:** la nota de Bonferroni en inglés y el subtítulo del escaneo hablan de 14; el catálogo tiene 17 (14 + DTR, VPD, WBGT) (`i18n.ts:634,758`).
8. **`translateWarning`** no reconoce los avisos del navegador ("Posible cambio brusco…", "Mann‑Kendall y regresión OLS discrepan…"): en inglés salen en español (W3.9).
9. **Fijos escritos a mano:** "2.592" y la tabla Monte Carlo (`Briefing.tsx`), año 2023 como límite histórico de OWID, año 2025 como último año (`staticFallback.ts:470,516,807`), objetivos satelitales fijos.
10. **Bonferroni informativo:** variables `significant` con $p_{adj}>0{,}05$ (p. ej. WBGT en Managua, $p_{adj}=0{,}0559$).
11. **Pettitt de Managua** queda a 0,0006 del umbral de 0,7 de RSS (0,7006): un cambio mínimo en los datos lo activaría.
12. **Relación:** 70 claves `relate` precalculadas menos en la web de José (casi todo DZA/MEX); esos casos se recalculan en el navegador con otra definición de "sin tendencia".
13. **Residuos de Theil–Sen no centrados** (media 0,012 en Managua): σ resta la media (`np.std`), pero `RSS_recta` de Pettitt no.
14. **Resolución espacial:** cada punto representa una celda de ~50×60 km; el globo representa cada celda de 5° solo por su centro (H1).

---

# P. Auto‑verificación

## P1. Archivos leídos

**Web de José (`/home/user/jose21nc/datex`, commit d6d7a87):** `src/staticFallback.ts` (completo; comparado con la copia de `nasaspaceapp`: solo difieren 3 comentarios y la numeración de líneas), `src/api.ts`, `src/i18n.ts` (funciones de formato, `certaintyInfo`, `humanVerdictSummary`, `translateWarning`, `formatForecastText`, `formatRelationText`, textos con umbrales), `src/globeColors.ts`, `src/Globe3D.tsx` (cálculo de celdas), `src/GlobeSection.tsx`, `src/TrendView.tsx`, `src/ScanView.tsx`, `src/ComparePlaces.tsx`, `src/DemographyView.tsx`, `src/RelateView.tsx`, `src/SatelliteView.tsx`, `src/SeriesChart.tsx`, `src/TrendChart.tsx`, `src/Briefing.tsx`, `src/App.tsx` (búsqueda de cálculos y años), `src/ui.tsx`, `src/Explain.tsx` (revisión de cálculos: ninguno), `package.json`, `README.md`; `public/static-api/{bundle,catalog,globe}.json` (comparados con los de `nasaspaceapp`).

**Motor Python (`/home/user/nasaspaceapp`, rama `actualizacion-frontend`):** `backend/app/main.py`, `config.py`, `catalog.py`, `services/{trends,forecast,relate,power,places,demography,worldbank,satellite,ai,meteomatics,planetary,firebase}.py`; `backend/scripts/{build_globe,export_static_api,fetch_samples}.py` (`build_city_growth.py` excluido); `backend/tests/{test_trends,test_forecast,test_relate,test_globe_grid,test_places_demography_satellite}.py`; `app/data/samples/*.json` y `globe.json`; `README.md` §10 y `docs/RETO.md`; para el Apéndice, `frontend/src/{stats,globeColors,TrendTables,ComparePlaces,DemographyView,RelateView,SatelliteView,SeriesChart,TrendChart,Globe3D,GlobeSection,CityGrowth3D,cities}.ts(x)`. Se inspeccionó el código fuente de SciPy 1.18.1 (`kendalltau`, `theilslopes`) para describir el IC de Sen y la varianza con empates.

## P2. Cómo se obtuvieron los ejemplos

- Valores del motor Python: ejecutando el propio código (`trends.py`, `forecast.py`, `power.py`, `satellite.py`, `places.py`) con el entorno virtual del repo y leyendo `bundle.json`/`globe.json`.
- Valores del navegador (W3, W4, W5): **port a Python** del algoritmo TypeScript; no se ejecutó el TypeScript.

## P3. Dudas y cálculos no interpretados con certeza

1. **Factor $\sqrt{12}$** en `years_needed` (Python): el código dice "Weatherhead adaptado a datos anuales" pero no justifica el factor; solo se verificó el caso de prueba (24 años). El navegador lo omite.
2. **Petición a POWER con códigos derivados** (`staticFallback.ts:516`): sin red no se pudo comprobar si POWER rechaza la petición completa o ignora los códigos no válidos (VPD, DTR, WBGT). El código asume que simplemente no aparecen.
3. **Celdas con `GWETROOT`:** `globe.json` tiene 734 de 2.592 celdas; se supone que es porque POWER no devuelve datos válidos en el resto (océano/hielo), pero no está en el código ni se verificó.
4. **Resultado numérico real de la web** al recalcular en el navegador: reproducido por port; puede diferir en detalles de redondeo de JavaScript.
5. **Origen exacto de las cifras Monte Carlo** (4,8/3,8/4,3/3,6 %, etc.): no hay script en el repo; se citan de la documentación.
6. **Estado del backend de la web de José:** si el despliegue define `VITE_API_URL`, los cálculos irían a un servidor que no está en el repo de José; este documento asume el modo estático.
7. **Regiones de `relate` faltantes** (70): se verificó el recuento y las claves, no la causa.
8. `staticFallback.ts` hace `searchPlacesOnline`, `locate` y `fetchPowerParams` contra servicios externos; el comportamiento ante fallos no se probó.

---

# APÉNDICE · Cálculos del frontend de `nasaspaceapp` que NO están en la web de José

Se conservan por exhaustividad (el frontend de `/home/user/nasaspaceapp/frontend/src` es más rico que el de José). Todas se ejecutan en el navegador con datos que devuelve la API (o el bundle).

| Cálculo | Fórmula | Referencia |
|---|---|---|
| Media y desviación muestral (n−1) | $\bar x=\frac1n\sum x$; $s=\sqrt{\frac{\sum(x-\bar x)^2}{n-1}}$ | `stats.ts:3-10` |
| Normal acumulada (A&S 7.1.26) | $\operatorname{erf}(x)\approx1-(a_1t+\dots+a_5t^5)e^{-x^2}$, $t=\frac1{1+0{,}3275911\lvert x\rvert}$; $\Phi(z)=\tfrac12[1+\operatorname{erf}(z/\sqrt2)]$; $p=2[1-\Phi(\lvert z\rvert)]$ | `stats.ts:13-24` |
| Pearson y $p$ por Fisher | $r$; $p=2[1-\Phi(\lvert\operatorname{atanh}(r)\sqrt{n-3}\rvert)]$ ($r$ recortado a ±0,999999; $n>3$) | `stats.ts:26-47` |
| SE desde un IC95 | $\mathrm{se}=(hi-lo)/(2\cdot1{,}96)$ | `stats.ts:50` |
| Diferencia de pendientes entre dos lugares | $z=\dfrac{b_A-b_B}{\sqrt{se_A^2+se_B^2}}$, $p=2[1-\Phi(\lvert z\rvert)]$ (ej.: Managua vs. Svalbard `T2M`: $-0{,}939/0{,}1654=-5{,}68$, $p=1{,}4\cdot10^{-8}$) | `ComparePlaces.tsx:149-159` |
| Correlación entre dos lugares (valores y primeras diferencias) | Pearson sobre años en común, $p$ de Fisher (Managua–Svalbard: $r=-0{,}448$, $n=36$; diferencias $r=-0{,}193$, $n=35$) | `ComparePlaces.tsx:160-171` |
| Estadísticos descriptivos | $n$, media, $s$, mínimo/máximo con año, $CV=100\,s/\lvert\bar x\rvert$ (si $\lvert\bar x\rvert>10^{-9}$) | `TrendTables.tsx:147-163` |
| Δ OLS−Theil–Sen | $\hat\beta_{10}-\hat\omega_{10}$ | `TrendTables.tsx:172` |
| Medias por década | media de $A$, de la recta ajustada y del residuo por grupo $\lfloor y/10\rfloor$ | `TrendTables.tsx:199-221` |
| Diferencia ONU − lineal | $\text{ONU}(y)-\text{lin}(y)$ | `DemographyView.tsx:117-120` |
| Cambio por clase de suelo | $\Delta pp=l-f$; $\Delta km^2=\frac{\Delta pp}{100}A$ | `SatelliteView.tsx:97-109` |
| Escala de color de 7 clases | G6/H6 | `globeColors.ts` |
| Vista 3D de ciudad | altura $=6+54\,(d/100)^{1{,}3}+6\,j(r,c)$ con $j=\operatorname{frac}(\sin(127{,}1r+311{,}7c)\cdot43758{,}5453)$; $\%\Delta=(km^2_y/km^2_{base}-1)\cdot100$; razones $FoM/\text{base}$ | `CityGrowth3D.tsx:38-46,219-224` |
| Patrón decorativo (no científico) | PRNG mulberry32 con semilla fija | `BrandPattern.tsx:6-15` |
