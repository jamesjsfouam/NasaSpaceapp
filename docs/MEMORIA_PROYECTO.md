# Memoria del proyecto · Detective de tendencias del sistema Tierra (*Verdict*)

> Contexto para un Proyecto de Claude. Resume qué es el proyecto, cómo está hecho, qué se
> decidió y por qué, y qué falta. Última actualización: 2026-11-14 (motor Verdict, cualquier
> lugar del mundo, satélite, población, previsión e IA).

## 1. Identidad

- **Evento:** NASA Space Apps Challenge 2026 (14–15 de noviembre).
- **Equipo:** Laboratorio Boreal, 6 integrantes de Nicaragua.
- **Reto:** *Be an Earth System Trend Detective* (Ciencias de la Tierra y software, nivel avanzado).
- **Repositorio:** https://github.com/jamesjsfouam/NasaSpaceapp (público, rama `main`). El
  repositorio anterior, `jamesjsfouam/Nasa-Spaceappschallenge`, está abandonado.
- **Idea base:** el análisis del equipo en
  `docs/Earth_System_Trend_Detective_analisis_y_solucion.pdf`. Propone "Verdict": de una
  pregunta a un veredicto honesto.
- **Idioma:**
  - Interfaz, documentación y commits en español; números con coma decimal.
  - **Ojo:** la entrega a la NASA debe ir en **inglés** (página del proyecto y demo). Está
    pendiente traducir o hacer bilingüe la interfaz.

## 2. El reto y la idea base

**El reto pide:**

1. Identificar variables con potencial de tendencia.
2. Obtener los datos de una región.
3. Visualizar una serie temporal larga.
4. Dar la tasa de cambio y probar su significancia (t-test, Mann-Kendall o intervalos). Solo
   tendencias lineales.

**Público:** estudiantes y público con base científica. Pide definiciones simples, preguntas
guiadas y demos. La IA es opcional.

**Idea base del PDF** (lo que diferencia al proyecto):

- **Guiar la elección de la variable:** preguntas que llevan a un recomendador por reglas.
- **No declarar tendencias falsas:** pruebas resistentes a la autocorrelación.
- **Veredicto honesto:** "todavía no significativa" acompañado de los años de datos que faltan.
- **Comparar dos lugares:** la misma variable puede tener direcciones opuestas.
- **Notas de fiabilidad** por variable.
- **Demos que funcionen sin conexión.**

Recorrido: **preguntar → ver → veredicto**.

**Criterios de evaluación:** impacto, creatividad, validez, relevancia y presentación. La
entrega es una demo de 7 diapositivas o un video de 30 segundos.

**Petición del usuario, además del PDF:**

- **Cualquier lugar del mundo:** no solo las regiones de ejemplo.
- **Variables sociales y demográficas:** población, crecimiento, natalidad…
- **Satélite del lugar año a año.**
- **Previsión de cómo cambiarán los datos,** con gráfica.
- **IA integrada que explique por qué** y cómo se verá en el futuro.

**Resolución:**

- La previsión es un **escenario etiquetado,** separado del veredicto, porque el PDF la pone
  fuera del alcance.
- La IA está **anclada a las cifras del motor:** las causas se presentan como hipótesis y el
  veredicto es una plantilla.

## 3. Qué hace la app (todo funciona y está probado)

0. **Globo 3D (portada):**
   - 2.592 celdas de 5° con la tendencia de 5 variables;
   - veredicto completo + FDR de Benjamini-Hochberg (q = 0,10); opaca solo si es significativa
     y pasa el FDR;
   - clic en una celda para abrir su veredicto;
   - `react-globe.gl` cargado aparte, texturas NASA Blue/Black Marble, malla precalculada en
     `backend/app/data/globe.json` (`make globe`, unos 15 min, reanudable) y servida en
     `/api/globe`.
1. **Preguntar:**
   - Pregunta libre: Claude o unas reglas la convierten en preocupación, tipo de lugar y lugar.
   - Lugar: buscador por nombre (Open-Meteo) o clic en el mapa (Leaflet). El país se detecta
     sin conexión.
   - Fichas de preocupación (Calor, Lluvia y agua, Sequía y cultivos, Sol y energía, Viento) y de
     tipo de lugar (ciudad, agrícola, bosque, costa, seca, fría).
   - Recomendador por reglas: hasta 3 variables con definición, fuente y fiabilidad.
   - Selector de "cualquier otra variable" y año de inicio.
2. **Veredicto:**
   - Tarjeta con qué cambia, dónde, cuánto y si es significativo.
   - Gráfica de anomalías, promedio anual y recta.
   - Avisos y "¿Cómo se calculó?".
   - Botón de **escenario** hasta 2030–2100, con banda del 95 %.
   - Botón **Explicar.**
3. **Comparar lugares:** la misma variable en dos puntos (buscador o clic con "comparar"
   activado), con dos tarjetas de veredicto y series estandarizadas.
4. **Satélite:**
   - Imágenes del punto año a año: Landsat 5/7 hasta 2011, Landsat 8/9 y Sentinel-2 desde 2016.
     Cuadro de unos 16 × 16 km, con barra deslizante.
   - Cobertura del suelo 2017–2023 por clase.
   - Escenario de la zona construida y botón Explicar.
5. **Población:**
   - Cualquier país, 7 indicadores de la ONU.
   - Tendencia, escenario lineal y **proyección oficial de la ONU** hasta 2100, con Explicar.
6. **Clima y sociedad:** variable de la Tierra frente a un indicador del Banco Mundial, con la
   correlación aparente y la de año a año sin tendencias, y Explicar.
7. **Escanear el lugar:** las 14 variables ordenadas por p, con p ajustado (Bonferroni).
8. **Regiones de ejemplo:** 7 regiones fijas para mostrar direcciones opuestas.
9. **Ejemplos de un clic:** Managua, Corredor Seco, Amazonía y Ártico.

## 4. Stack y arquitectura

```
frontend/  React 19 + Vite + TypeScript + Recharts + Leaflet (proxy /api → :8000)
  App.tsx (flujo y pestañas), MapPicker, TrendChart, SeriesChart, ComparePlaces,
  SatelliteView, DemographyView, RelateView, Explain (botón IA), api.ts (tipos y fetch)
backend/   Python 3.11+, FastAPI, httpx, numpy, pandas, scipy, anthropic, reverse_geocoder,
           pycountry; gestionado con uv; pytest (+ pytest-asyncio)
  app/catalog.py            14 variables (código POWER, definición, fuente, fiabilidad),
                            temas, preocupaciones, tipos de lugar, recommend(), regiones,
                            demos, indicadores del Banco Mundial
  app/services/power.py     NASA POWER mensual por punto, caché 6 h, muestras de 7 regiones
  app/services/trends.py    motor Verdict (sección 5)
  app/services/forecast.py  escenario lineal con intervalo de predicción
  app/services/places.py    búsqueda (Open-Meteo) y país de una coordenada (sin conexión)
  app/services/demography.py  ONU vía Our World in Data (CSV completo por indicador, caché 24 h)
  app/services/satellite.py Planetary Computer: escenas y cobertura del suelo
  app/services/worldbank.py Banco Mundial (lento a veces; caché y muestras)
  app/services/relate.py    correlación aparente y año a año
  app/services/ai.py        Claude: interpretar preguntas y explicar; reglas y plantillas
  app/main.py               API (lista en README)
  app/data/samples/         POWER (7 regiones), demografía y Banco Mundial (países de ejemplo)
  scripts/fetch_samples.py  `make samples` o `... fetch_samples.py worldbank NIC MEX`
```

**Diseño visual:** tema oscuro de "control de misión", inspirado en el repo de referencia
`KIRIXDJ/tierra` (Auto-Farm). El código de estilos es propio, en `frontend/src/index.css`.

- **Base:** fondo espacial con estrellas, paneles con borde fino, acento cian `#3fd0e6`.
- **Tipografía:** títulos en versalitas espaciadas con la fuente de datos a la derecha;
  cifras en monoespaciada (clase `num`); logotipo "V E R D I C T".
- **Mapa:** imagen NASA GIBS Blue Marble.
- **Colores de los veredictos:** cian = significativa, ámbar = todavía no, gris = sin
  tendencia. Morado para el escenario y la IA.

## 5. Motor estadístico (`trends.py`)

1. **Anomalías mensuales** y medias anuales (≥ 10 meses por año). Mínimo de 15 años; si no, el
   resultado es "datos insuficientes".
2. **Magnitud:** Theil–Sen por década con IC 95 %, más OLS.
3. **Significancia:**
   - Mann-Kendall con **preblanqueo**.
   - Regresión con **n efectivo** = n(1−r)/(1+r).
   - En los dos, r se corrige por sesgo: r + (1+4r)/n, recortado a [0, 0,95].
4. **Veredicto:**
   - `significant`: p de Mann-Kendall < 0,05 **y** el IC del n efectivo excluye el cero.
   - `not_yet`: p entre 0,05 y 0,20, o las dos pruebas no coinciden.
   - `no_trend`: p ≥ 0,20.
5. **Años que faltan:** n* = [3,3·σ·√12/|ω|·√((1+φ)/(1−φ))]^(2/3). Es Weatherhead adaptado a
   datos anuales; con n* años se detecta la tendencia en ~90 % de las simulaciones.
6. **Sensibilidad al periodo** (±3 años en el inicio y el fin), **Pettitt** para saltos y aviso
   de autocorrelación alta (r > 0,5).
7. **Validación** (30 años, sin tendencia):

   | φ | Falsos positivos | Regresión corriente |
   |---|---|---|
   | 0 | 3,6 % | 4,8 % |
   | 0,4 | 4,8 % | 19 % |
   | 0,8 | 8,2 % | 49 % |

   La variante TFPW se descartó (20–58 % de falsos positivos).

- **Previsión:** OLS con intervalo de predicción, límites físicos y avisos de horizonte,
  autocorrelación y tendencia no significativa. Cobertura simulada entre el 91 % y el 99 %.
- **Clima y sociedad:** Pearson con los valores tal cual; Pearson y Spearman tras quitar la
  tendencia. Marca `trend_driven` y exige un mínimo de 10 años en común.

## 6. Hallazgos con datos reales (1990–2025)

| Caso | Resultado |
|---|---|
| T2M, motor nuevo | Ártico +0,73 °C/déc, Sahara +0,38 y CDMX +0,40: **significativas**. Managua −0,21, Bluefields +0,18 y Amazonía +0,26: **todavía no** (autocorrelación 0,4–0,6). Corredor Seco: sin tendencia clara |
| Managua, lluvia | Pasa de ~2 a más de 5 mm/día: probable artefacto de MERRA-2, sin contrastar |
| Bluefields | Salto hacia 1999 en humedad del suelo, humedad relativa y evaporación (Pettitt) |
| Nakuru (Kenia), humedad del suelo | +0,037/década, significativa, pero sensible al periodo |
| Zona construida (satélite) | Managua 51 → 54 %; Somoto 4,6 → 7,4 % (2017–2023); Lagos con un salto de clasificador en 2017–2018 |
| Lección de la demo | **Significativo no es lo mismo que real,** y "todavía no" también es un resultado |

## 7. Decisiones y por qué

- **NASA POWER como fuente en vivo:** sin clave, global y desde 1981. Es un reanálisis, así que
  cada variable lleva su nota de fiabilidad.
- **Veredicto conservador,** con ambas pruebas y la corrección de sesgo: la validez es el criterio
  que más pesa.
- **Cualquier lugar del mundo:** el análisis funciona con cualquier coordenada. País sin conexión
  con GeoNames y pycountry; a más de 250 km de una ciudad, se considera mar abierto.
- **Demografía de la ONU vía Our World in Data:** el Banco Mundial a veces tarda minutos. La
  proyección oficial de la ONU es la referencia; la recta solo compara.
- **Satélite vía Planetary Computer:** sin cuenta, global; Landsat desde 1984. Las imágenes se
  cargan desde la URL de recorte del servicio de datos. Sin Landsat 7 entre 2003 y 2011 (franjas).
- **IA anclada a las cifras:**
  - Modelo `claude-opus-5-5`, esfuerzo bajo, `fallbacks: "default"` (beta
    `server-side-fallback-2026-07-01`).
  - Salida JSON restringida al catálogo para interpretar preguntas.
  - El servidor recalcula las cifras antes de explicar.
  - Sin clave, reglas y plantillas.
- **Muestras sin conexión** para POWER, demografía y Banco Mundial en las regiones y países de
  ejemplo.

## 8. Pendientes (por prioridad)

1. **Inglés:** traducir la interfaz o añadir un selector ES/EN. Página del proyecto y demo en
   inglés.
2. **Clave de IA:** poner `ANTHROPIC_API_KEY` en `.env` para la explicación narrada; sin ella se
   usa la plantilla. La IA no se ha probado contra el servicio real, solo con simulaciones.
3. **Contrastar con otra fuente:** GPM/IMERG para la lluvia de Managua, o SMAP/SMOS para la
   humedad del suelo, con Earthdata.
4. **Promedio de área** (varios puntos ponderados por cos(lat)) y mapa de pendientes con FDR,
   según el PDF.
5. **Muestras del Banco Mundial:** comprobar cuáles quedaron guardadas (la API es lenta).
6. **Despliegue** (Render y Vercel, o Firebase), **demo** (video de 30 s o 7 diapositivas) y
   **página de método** con la tabla de validación.

## 9. Entorno y credenciales

- **Sin clave:** NASA POWER, Planetary Computer, Our World in Data, Banco Mundial y Open-Meteo.
- **Meteomatics:** solo en el `.env` local; caduca el 2026-11-22. Nunca pegar la contraseña.
- **Claude:** `ANTHROPIC_API_KEY` en `.env` (opcional).
- **Commits:** desde el 2026-11-14 los commits que hace Claude van **a nombre de James
  Santiago Fernández Obregón** (petición suya). Los 40 primeros quedaron firmados como
  "Claude". Cada integrante configura su propio `git config user.name` y `user.email` en su
  computadora.

## 10. Cómo ejecutar

```bash
make setup      # uv sync + npm install + crea .env
make backend    # http://localhost:8000/docs
make frontend   # http://localhost:5173
make test       # 66 pruebas
```

## 11. Instrucciones para Claude en este proyecto

- Responder en español, conciso y directo.
- Estadística nueva en `trends.py`, `forecast.py` o `relate.py`, **con pruebas** de datos
  sintéticos, y validada por simulación (tasa de falsos positivos) antes de mostrarla.
- No presentar hallazgos sin los límites de los datos. Nunca inventar cifras. Las causas son
  hipótesis.
- La IA solo recibe cifras calculadas por el motor. El veredicto no lo escribe la IA.
- Para modelos de Claude, usar el SDK oficial `anthropic` y `claude-opus-5-5`.
- Commits pequeños en español y push a `main` de `NasaSpaceapp`. No subir `.env` ni datos
  personales.
