# Memoria del proyecto · Detective de tendencias del sistema Tierra

> Contexto para un Proyecto de Claude. Resume qué es el proyecto, cómo está hecho, qué se
> decidió y por qué, y qué falta. Última actualización: 2026-11-14.

## 1. Identidad

- **Evento:** NASA Space Apps Challenge 2026.
- **Equipo:** Laboratorio Boreal. Son 6 integrantes de Nicaragua; el propietario del equipo es
  José Manuel Obregón Alonzo.
- **Reto:** *Be an Earth System Trend Detective* (Ciencias de la Tierra y software, nivel avanzado).
- **Repositorio actual:** https://github.com/jamesjsfouam/NasaSpaceapp (público, rama `main`).
  - Repositorio anterior, ya abandonado: `jamesjsfouam/Nasa-Spaceappschallenge`.
- **Idioma:** todo en español (interfaz, documentación, commits). Números con coma decimal
  (0,73) en textos para usuarios.

## 2. El reto (resumen)

Crear una herramienta que:

1. Identifique variables de ciencias de la Tierra que puedan mostrar tendencias.
2. Obtenga los datos para una región concreta.
3. Genere y visualice una serie temporal suficientemente larga.
4. Calcule la tasa de cambio y pruebe su significancia con t-test, Mann-Kendall o intervalos
   de confianza.

El alcance se limita a **tendencias lineales**.

Otros puntos del enunciado:

- **Público:** estudiantes de secundaria y universidad, y público con algo de formación
  científica. Pide definiciones simples, preguntas guiadas y ejemplos de demostración.
- **IA:** sugiere opcionalmente usarla para proponer variables según la región.
- **Fuentes que cita:** MODIS, OMI, AIRS, GPM, MERRA-2, GLDAS, Giovanni y CUAHSI.
- **Idea clave del enunciado:** una misma variable puede subir en una región y bajar en otra
  aunque la cause el mismo proceso, y a veces una tendencia solo necesita más años para ser
  significativa.

## 3. Qué hace la app hoy (todo funciona y está probado)

- **Interfaz guiada:**
  - 4 ejemplos de un clic: Managua (temperatura), Corredor Seco (humedad del suelo),
    Amazonía (lluvia) y Ártico (temperatura).
  - O bien: tema → variable (con definición sencilla) → lugar (región de ejemplo o coordenadas)
    → año de inicio.
- **Pestaña Tendencia:**
  - Veredicto en lenguaje llano y cuatro tarjetas: ¿qué cambia?, ¿dónde?, ¿cuánto?,
    ¿significativo?
  - Gráfica de anomalías mensuales, promedio anual y recta de Theil–Sen.
  - Avisos, y la sección "¿Cómo se calculó?" con la tabla de ambos métodos.
- **Pestaña Escanear:** las 14 variables de un lugar, ordenadas por valor p de Mann-Kendall,
  con el p ajustado por Bonferroni. Se puede abrir cualquiera.
- **Pestaña Comparar regiones:** la misma variable en las 7 regiones de ejemplo, con el recuento
  de cuántas suben y cuántas bajan de forma significativa.
- **Nota fija** sobre los límites del reanálisis.

## 4. Stack y arquitectura

```
frontend/  React 19 + Vite + TypeScript + Recharts (proxy /api → :8000)
backend/   Python 3.11+, FastAPI, httpx, numpy, pandas, scipy; gestionado con uv
  app/catalog.py          14 variables (código POWER, etiqueta, unidad, tema, definición,
                          ratio_scale), 6 temas, 7 regiones, 4 demos, DATA_NOTE
  app/services/power.py   NASA POWER mensual por punto (1981–año anterior), una sola
                          petición trae las 14 variables; caché en memoria de 6 h; si falla,
                          usa app/data/samples/<region>.json (solo regiones de ejemplo)
  app/services/trends.py  toda la estadística (ver sección 5)
  app/main.py             API
  app/services/meteomatics.py, planetary.py, firebase.py   integraciones opcionales
  scripts/fetch_samples.py  regenera las muestras (make samples)
  tests/                  test_trends.py (datos sintéticos) y test_api.py (sin red)
notebooks/01_exploracion.ipynb   usa el mismo código que la API
docs/   RETO.md (método y límites), GUIA_ESTUDIO.md, OFERTAS.md, ENTREGA.md
.github/workflows/ci.yml   ruff + pytest + lint + build
Makefile   setup, setup-all, backend, frontend, notebook, test, lint, build, samples
```

**Endpoints:**

| Endpoint | Para qué |
|---|---|
| `GET /api/catalog` | Datos que necesita la interfaz |
| `GET /api/trend?variable&lat&lon&start&end` | Tendencia de una variable en un punto |
| `GET /api/scan?lat&lon&start&end` | Todas las variables de un punto |
| `GET /api/compare?variable&start&end` | Una variable en todas las regiones |
| `GET /api/health` | Estado del servidor |
| `GET /api/weather` | Tiempo actual con Meteomatics |

Errores: 422 por periodo o variable no válidos y 502 si NASA POWER no responde y no hay muestra.

**Variables (códigos de NASA POWER):**

| Tema | Variables |
|---|---|
| Temperatura | T2M, T2M_MAX, T2M_MIN, TS |
| Lluvia y agua | PRECTOTCORR, EVLAND |
| Suelo | GWETROOT, GWETTOP |
| Humedad y nubes | RH2M, T2MDEW, CLOUD_AMT |
| Energía solar | ALLSKY_SFC_SW_DWN |
| Viento y presión | WS2M, PS |

Se usa la comunidad "AG" de POWER.

**Regiones de ejemplo:**

| Región | Latitud, longitud |
|---|---|
| Managua | 12.13, −86.25 |
| Corredor Seco (Somoto) | 13.48, −86.58 |
| Bluefields | 12.01, −83.76 |
| Amazonía (Manaos) | −3.10, −60.02 |
| Sahara | 25.0, 10.0 |
| Svalbard | 78.22, 15.65 |
| Ciudad de México | 19.43, −99.13 |

## 5. Método estadístico (`trends.py`)

1. **Años y estación:** solo se usan años completos (12 meses). La climatología de cada mes da
   las anomalías para la gráfica.
2. **Serie anual:** las pruebas se hacen sobre la **media anual**, lo que elimina la estación.
   Hace falta un mínimo de 10 años (`MIN_YEARS`).
3. **Tasa de cambio:** **Theil–Sen** (`scipy.stats.theilslopes`) con IC 95 %, como pendiente
   principal. Se reporta por década, en total y en % (el % solo si `ratio_scale`; no en °C).
4. **Significancia:** **Mann-Kendall** (`scipy.stats.kendalltau(años, valores)`) da el p
   principal. Como contraste, **OLS + t-test** (`linregress`) con IC 95 % y el campo
   `methods_agree`.
5. **Niveles:** p < 0,01 "muy significativa", < 0,05 "significativa", < 0,10 "indicio débil";
   el resto, "no significativa".
6. **Avisos:**
   - Autocorrelación lag-1 de los residuos > 0,3.
   - Serie de menos de 20 años.
   - **Salto brusco:** Pettitt con p < 0,05 **y** un escalón con RSS < 0,7 × RSS de la recta.
     Devuelve `step_year`.
7. **Escaneo:** p ajustado de Bonferroni (`p_adjusted`).
8. **Interpretación:** un texto en español generado en el backend.

**Pruebas:** 22 en total.

- Con series sintéticas se comprueba que:
  - recupera la pendiente conocida;
  - el ruido puro da como mucho 7 de 40 falsos positivos;
  - la estación no crea tendencia;
  - detecta un escalón y no marca una tendencia gradual;
  - el formato numérico usa coma.
- La API se prueba sin red, usando las muestras locales.

## 6. Hallazgos con datos reales (1990–2025)

| Caso | Resultado |
|---|---|
| Temperatura media (T2M) por región | Svalbard +0,73 °C/déc; CDMX +0,40; Sahara +0,38; Amazonía +0,26; Bluefields +0,18 (todas significativas); Managua −0,21 (p 0,027); Corredor Seco −0,21 (indicio débil) |
| Svalbard, solo 2008–2025 | +0,53 °C/déc con p = 0,175: ejemplo de que hacen falta más años |
| Managua, lluvia | Pasa de ~2 mm/día en los 90 a >5 mm/día en los 2010, y la temperatura máxima baja ~2 °C. El cálculo está verificado de forma independiente; **probable artefacto del reanálisis MERRA-2**, no contrastado con estaciones |
| Bluefields | La herramienta marca un salto hacia 1999 en GWETROOT, GWETTOP, RH2M y EVLAND |
| Tiempo de detección (Weatherhead 1998) | Svalbard ~13 años; CDMX ~11; lluvia en la Amazonía ~22 |

**Mensaje para la presentación:** *"significativo no es lo mismo que real"*. Un buen detective
contrasta con otra fuente.

## 7. Decisiones tomadas y por qué

- **NASA POWER como fuente principal:** es oficial de la NASA, se basa en MERRA-2 (citado en el
  reto), no pide cuenta ni clave y da series largas por punto. Su límite: es un reanálisis y
  cada valor es una celda de unos 50 × 60 km.
- **Estadística sobre medias anuales:** es simple de explicar al público objetivo y robusta a la
  estación.
- **Mann-Kendall + Theil–Sen como principales:** son el estándar en clima e hidrología y robustos
  a valores extremos. OLS y t-test se mantienen porque el reto los menciona.
- **Honestidad ante todo:** avisos de autocorrelación, saltos, series cortas, pruebas múltiples y
  la nota del reanálisis. Una herramienta que declare "muy significativo" un artefacto sería
  engañosa.
- **Muestras locales en el repo:** para que la demo funcione aunque falle la red o la API.
- **Historial del proyecto:** primero era un reto médico (monitor de salud del astronauta), que se
  abandonó al cambiar de reto. Luego el repo se rehízo en el nuevo repositorio con 15 commits
  lógicos, con fecha real y sin falsear fechas.

## 8. Pendientes e ideas (en orden de prioridad)

1. **"¿Cuántos años necesito?":** si no es significativa, estimar el tiempo de detección con
   Weatherhead et al. (1998):
   n* ≈ [3,3·σN/|ω0| · √((1+φ)/(1−φ))]^(2/3).
   Esfuerzo bajo; responde a una frase literal del reto.
2. **Corregir la autocorrelación:** Mann-Kendall modificado (Hamed y Rao 1998), por ejemplo con el
   paquete `pymannkendall`, en lugar de solo avisar. Esfuerzo bajo.
3. **Una función "estrella", a elegir:**
   - (a) **Segunda opinión:** contrastar con GPM/IMERG o MODIS mediante `earthaccess` (necesita
     cuenta de Earthdata) o con Planetary Computer.
   - (b) **Asistente con IA anclada:** solo elige entre el catálogo y nunca inventa números.
   - (c) **Pistas entre variables:** relacionar procesos, por ejemplo "sube la temperatura, sube
     la evaporación y baja la humedad del suelo".
4. **Otras:**
   - mapa de tendencias con FDR;
   - modo "predice antes de ver";
   - quitar El Niño usando el índice ONI;
   - exportar a CSV y enlaces permanentes;
   - caso completo del Corredor Seco como historia de la presentación.
5. **Antes de entregar:**
   - Contrastar los resultados de Managua con otra fuente.
   - Revisar la *Project Submission Guide* y la *Judging and Awards Guide* oficiales.
   - Grabar el video de la demo (guion en `docs/GUIA_ESTUDIO.md`, sección 5.5).

## 9. Entorno y credenciales

- **NASA POWER:** no necesita clave.
- **Meteomatics (oferta global):** la cuenta del equipo está configurada solo en el `.env` local
  (ignorado por git) y caduca el **2026-11-22**. **Nunca** pegar la contraseña en el repo ni en
  chats. Hoy solo la usa `/api/weather`, no el análisis.
- **Earthdata:** todavía sin cuenta. Hace falta para GPM, MODIS y GLDAS con `earthaccess`.
- **Ofertas globales disponibles:** Google Cloud/Firebase (hosting ya configurado en
  `firebase.json`), Microsoft (Planetary Computer, Azure), Meteomatics, GoDaddy (dominio) y Miro.
- **Commits:** hasta ahora firmados por "Claude". Cada integrante debería configurar su
  `git config user.name` y `user.email` si las reglas piden autoría del equipo.

## 10. Cómo ejecutar

```bash
make setup      # uv sync + npm install + crea .env desde .env.example
make backend    # http://localhost:8000/docs
make frontend   # http://localhost:5173
make test       # pytest
```

## 11. Instrucciones para Claude en este proyecto

- Responder en español. Ser conciso y directo.
- Toda estadística nueva va en `backend/app/services/trends.py` **con pruebas** sobre datos
  sintéticos de respuesta conocida antes de mostrarla en la web.
- No presentar un resultado como hallazgo sin mencionar los límites de los datos. Nunca inventar
  cifras: los números salen del análisis.
- Mantener el público objetivo: explicaciones simples, definiciones claras y sin jerga
  innecesaria.
- Hacer commits pequeños y lógicos en español, y push a `main` del repo `NasaSpaceapp`.
- No subir secretos (`.env`) ni datos personales.
