# Guía de estudio · Detective de tendencias del sistema Tierra

Preparación del equipo Laboratorio Boreal para el reto *Be an Earth System Trend Detective*
(NASA Space Apps 2026). La guía tiene cinco partes:

1. [El tema: sistema Tierra, variables y datos](#1-el-tema)
2. [La estadística, paso a paso](#2-la-estadística)
3. [Ejercicios con el repo](#3-ejercicios-con-el-repo)
4. [Puntos de innovación](#4-puntos-de-innovación)
5. [Cómo construir y presentar la app](#5-cómo-construir-y-presentar-la-app)

Al final hay un [glosario](#glosario) y [lecturas](#lecturas).

**Cómo usarla:** todos leen la parte 1 y las secciones 2.1 a 2.5. Después cada persona
profundiza en lo de su rol (tabla de la sección 5.3). Los ejemplos con números salen de
nuestros propios datos (NASA POWER, 1990–2025) y se pueden reproducir en
`notebooks/01_exploracion.ipynb`.

---

## 1. El tema

### 1.1 Qué pide el reto, en una frase

Elegir una variable y un lugar, y responder con datos: **qué** cambia, **dónde**, **cuánto**
y si el cambio es **significativo**. El alcance son **tendencias lineales**: lo no lineal
queda fuera del alcance. Una respuesta que visualiza y además analiza cubre todo el reto.

### 1.2 Conceptos clave

- **Sistema Tierra:** atmósfera, océano, tierra, hielo y vida, todos conectados. Un mismo
  proceso, como el calentamiento, puede hacer que una variable suba en un sitio y baje en
  otro. Por ejemplo, la lluvia puede aumentar en una región y disminuir en la de al lado.
- **Tendencia:** cambio sostenido en una dirección a lo largo de muchos años.
- **Variabilidad natural:** subidas y bajadas que no son tendencia.
  - El **ciclo estacional** se repite cada año.
  - **El Niño/La Niña (ENSO)** actúa cada 2 a 7 años y es muy importante en Centroamérica: con
    El Niño suele haber sequía en el Corredor Seco.
  - Además está la variación aleatoria de un año a otro.
- **Señal y ruido:** la tendencia es la señal; la variabilidad natural es el ruido. Detectar
  una tendencia significa mostrar que la señal se distingue del ruido.
- **Climatología:** el promedio de largo plazo de cada mes, por ejemplo el promedio de todos los
  eneros.
- **Anomalía:** el valor menos su climatología. Así se quita el ciclo estacional.

### 1.3 De dónde salen los datos

Hay dos tipos de fuente, y conviene saber explicar la diferencia ante los jueces.

| Tipo | Qué es | Ventaja | Cuidado |
|---|---|---|---|
| **Observación satelital** | Un instrumento mide desde el espacio | Mide de verdad | Las series empiezan cuando se lanza el satélite y pueden cambiar si cambia el instrumento |
| **Modelo / reanálisis** | Un modelo físico combinado con observaciones | Todo el globo, sin huecos, muchas variables, desde 1980 | Si cambian las observaciones que lo alimentan, la serie puede saltar sin que cambie el clima |

Instrumentos y modelos que cita el reto:

| Nombre | Qué es | Variables típicas | Desde |
|---|---|---|---|
| **MODIS** | Espectrorradiómetro en los satélites Terra y Aqua | Temperatura de superficie, vegetación (NDVI/EVI), nieve, incendios, aerosoles, color del océano | 2000 (Terra), 2002 (Aqua) |
| **OMI** | Instrumento de ozono en el satélite Aura | Ozono total, NO₂, SO₂, aerosoles | 2004 |
| **AIRS** | Sondeador infrarrojo en el satélite Aqua | Perfiles de temperatura y humedad, CO, CO₂, metano | 2002 |
| **GPM / IMERG** | Misión de precipitación; IMERG combina muchos satélites | Lluvia (cada media hora, diaria y mensual) | 2000 (IMERG) |
| **MERRA-2** | Reanálisis de la NASA (GMAO) | Cientos de variables de atmósfera y superficie | 1980 |
| **GLDAS** | Sistema de asimilación de datos de superficie terrestre | Humedad del suelo, evapotranspiración, escorrentía, nieve | 1948 / 2000, según la versión |

**Nuestra fuente actual, NASA POWER,** reúne MERRA-2 y CERES en una API sencilla: un punto,
datos mensuales desde 1981 y sin clave. Es ideal para el prototipo, pero es un reanálisis.

**Herramientas que ya existen** (conózcanlas: los jueces pueden preguntar qué aporta la app):

- **Giovanni** (giovanni.gsfc.nasa.gov) hace series de tiempo y mapas de datos de la NASA sin
  descargar nada, pero no explica ni prueba la significancia.
- **CUAHSI y HydroShare** ofrecen datos y herramientas de hidrología. El reto los sugiere para series
  hidrológicas.

Nuestra propuesta de valor frente a ellas: **guiar** a alguien sin experiencia y **decirle si
el cambio es real**, explicando por qué.

### 1.4 Lección de nuestros propios datos: "significativo" no es lo mismo que "real"

Con NASA POWER vimos dos casos que conviene contar en la presentación:

- **Managua:** la lluvia pasa de unos 2 mm/día en los 90 a más de 5 mm/día en los 2010, y la
  temperatura media baja. Estadísticamente es "muy significativo", pero no cuadra con el clima
  conocido de Managua. Lo más probable es un efecto del reanálisis, y aún no está contrastado
  con estaciones.
- **Bluefields:** la humedad del suelo da un salto hacia 1999. La app lo marca como un posible
  salto brusco.

Un buen detective no se queda con la primera pista: **contrasta con otra fuente**.

---

## 2. La estadística

Las ideas van de lo básico a lo avanzado. Lo marcado con ⭐ es imprescindible para todos.

### 2.1 ⭐ Serie temporal y estacionalidad

Una serie mensual mezcla tres cosas: **tendencia + ciclo estacional + ruido**. Si se ajusta una
recta directamente a los datos mensuales, el ciclo estacional estorba. Hay dos soluciones:

1. **Anomalías:** restar a cada mes su climatología.
2. **Promedios anuales:** resumir cada año en un número. Es lo que hace la app para las pruebas,
   porque es simple de explicar y elimina la estación por completo.

Solo se usan **años completos**. Un año con 6 meses de verano daría un promedio falso.

### 2.2 ⭐ Regresión lineal (mínimos cuadrados, OLS)

Ajusta la recta $y = a + b\,t$ que minimiza la suma de los errores al cuadrado.

- **Pendiente** $b$: la tasa de cambio por año. La app la multiplica por 10 para darla por
  década, que es más legible.
- **Residuos:** lo que la recta no explica, es decir, el ruido.
- **Error estándar de la pendiente:** $SE_b = \dfrac{\sigma}{\sqrt{\sum (t_i - \bar t)^2}}$,
  donde $\sigma$ es el desvío típico de los residuos.
- **t-test:** $t = b / SE_b$, con $n-2$ grados de libertad. Da el valor p para la pregunta
  "¿la pendiente es distinta de cero?".
- **Intervalo de confianza del 95 %:** $b \pm t_{0.975,\,n-2} \cdot SE_b$. Si el intervalo
  **no incluye el 0**, la tendencia es significativa al 5 %.

**Por qué más años ayudan tanto:** con años igualmente espaciados,
$\sum (t_i-\bar t)^2 = n(n^2-1)/12$, así que $SE_b \propto n^{-3/2}$. **Doblar los años
divide la incertidumbre de la pendiente por casi 3.** Lo vimos en el Ártico:

| Svalbard, temperatura media | Pendiente | p (Mann-Kendall) |
|---|---|---|
| 1990–2025 (36 años) | +0,73 °C/década | < 0,0001 |
| 2008–2025 (18 años) | +0,53 °C/década | 0,175 (no significativa) |

Es la misma región y casi la misma pendiente: lo que cambia es la cantidad de años.

**Supuestos de OLS:** residuos independientes, con varianza constante y aproximadamente
normales. Los datos climáticos suelen romper el primero (ver 2.6).

### 2.3 ⭐ El valor p, bien entendido

- **Hipótesis nula ($H_0$):** no hay tendencia.
- **Valor p:** si $H_0$ fuera cierta, la probabilidad de ver una pendiente al menos tan
  extrema como la observada.
- **α = 0,05:** si p < 0,05, se rechaza $H_0$ y se dice que la tendencia es "significativa".

Errores frecuentes, que los jueces pueden detectar:

- ❌ "p = 0,03 significa 97 % de probabilidad de que la tendencia sea real." **Falso.**
- ❌ "p = 0,20 demuestra que no hay tendencia." **Falso:** solo dice que no hay evidencia
  suficiente. Puede faltar tiempo de datos.
- ❌ "Significativo = importante." Una tendencia diminuta puede ser significativa con muchos
  datos. Reporten siempre **cuánto** cambia, no solo el valor p.

Tipos de error:

- **Tipo I (falso positivo):** declarar una tendencia que no existe. Ocurre con probabilidad α.
- **Tipo II (falso negativo):** no detectar una tendencia que sí existe.
- **Potencia:** la probabilidad de detectar una tendencia real. Crece con más años, más pendiente
  y menos ruido.

### 2.4 ⭐ Mann-Kendall: la prueba de tendencia no paramétrica

No asume normalidad ni una recta perfecta: solo pregunta si los valores tienden a crecer
o decrecer con el tiempo.

1. Comparar cada par de años $(i < j)$: sumar +1 si $x_j > x_i$, −1 si es menor y 0 si son iguales.
2. $S = \sum_{i<j} \operatorname{sign}(x_j - x_i)$. Si $S$ es muy positivo, hay tendencia creciente.
3. Sin empates, $\operatorname{Var}(S) = \dfrac{n(n-1)(2n+5)}{18}$, y
   $Z = \dfrac{S - \operatorname{sign}(S)}{\sqrt{\operatorname{Var}(S)}}$ sigue
   aproximadamente una normal. De ahí sale el valor p.
4. Equivale a la **τ de Kendall** entre el tiempo y la variable. En el código usamos
   `scipy.stats.kendalltau(años, valores)`.

**Ventajas:** es robusta a valores extremos (un El Niño fuerte no la domina) y a relaciones no
lineales pero monótonas. Es el estándar en hidrología y clima.

### 2.5 ⭐ Pendiente de Theil–Sen

Es la **mediana** de todas las pendientes entre pares de años:
$\operatorname{mediana}\left(\dfrac{x_j - x_i}{t_j - t_i}\right)$. Es el compañero natural
de Mann-Kendall: la prueba dice *si* hay tendencia y Theil–Sen dice *cuánta*. Un año extremo
apenas la mueve. `scipy.stats.theilslopes` da también el intervalo del 95 %.

### 2.6 Autocorrelación: el problema más común

Si un año cálido tiende a ir seguido de otro cálido, los datos tienen **autocorrelación**, y
hay "menos información" de la que parece. Las pruebas que asumen independencia dan entonces p
demasiado pequeños, es decir, falsos positivos.

- **Autocorrelación de lag 1:** $r_1$ = correlación entre los residuos de un año y los del siguiente.
- **Tamaño efectivo de muestra** (aproximación habitual): $n_{ef} \approx n\,\dfrac{1-r_1}{1+r_1}$.
  En la Amazonía (lluvia) $r_1 = 0{,}32$, así que 36 años "valen" como unos 18.
- **Soluciones:**
  - **Mann-Kendall modificado** de Hamed y Rao (1998), que corrige la varianza.
  - **Pre-whitening** (Yue et al. 2002).
  - **Errores estándar HAC** en la regresión (`statsmodels`, `cov_type="HAC"`).

La app hoy **avisa** cuando $r_1 > 0{,}3$. Implementar la corrección es una mejora concreta
(sección 4).

### 2.7 Pruebas múltiples

Si se prueban 14 variables con α = 0,05, se espera alrededor de un falso positivo por azar
(14 × 0,05 ≈ 0,7). Hay dos correcciones:

- **Bonferroni:** multiplica cada p por el número de pruebas. Es simple y conservadora; es lo
  que muestra la app al escanear.
- **Benjamini–Hochberg (FDR):** controla la proporción de falsos descubrimientos. Es menos
  estricta y más útil con muchas pruebas.
- En **mapas** de tendencias, punto por punto, aparece la *significancia de campo*. Ver Wilks
  (2016), en las lecturas.

### 2.8 Saltos bruscos y homogeneidad

Un **escalón** en la serie, por ejemplo cuando se cambia un instrumento, produce una "tendencia"
falsa. La **prueba de Pettitt** busca el año más probable de un cambio de nivel. La app marca un
salto cuando la prueba es significativa **y** un escalón describe los datos mejor que una recta.

### 2.9 ¿Cuántos años hacen falta? (tiempo de detección)

Weatherhead et al. (1998) dan una aproximación del número de años necesarios para detectar una
tendencia $\omega_0$ (por año), con una probabilidad del 90 % y al 95 % de confianza:

$$n^* \approx \left[\frac{3{,}3\,\sigma_N}{|\omega_0|}\sqrt{\frac{1+\phi}{1-\phi}}\right]^{2/3}$$

Aquí $\sigma_N$ es el ruido (desvío de los residuos anuales) y $\phi$ la autocorrelación.
Con nuestros datos de 1990–2025:

| Caso | Pendiente | Ruido σ | φ | Años necesarios ≈ | Con 2008–2025 (18 años) |
|---|---|---|---|---|---|
| Svalbard, temperatura | +0,73 °C/déc | 0,87 °C | 0,22 | 13 | p = 0,18, aún no alcanza |
| Ciudad de México, temperatura | +0,42 °C/déc | 0,39 °C | 0,13 | 11 | p < 0,001 |
| Amazonía, lluvia | −0,42 mm/día/déc | 0,94 | 0,32 | 22 | p = 0,33, le faltan años |

Esto conecta con una idea del reto: *"a veces todo lo que una tendencia necesita para ser
significativa es un periodo más largo"*. Es una gran oportunidad de innovación (sección 4).

### 2.10 Más allá de lo lineal (solo para conocer)

Estos métodos quedan fuera del alcance pedido, pero conviene saber nombrarlos si preguntan:

- **Seasonal Kendall** (Hirsch et al. 1982): Mann-Kendall por cada mes del año, combinado.
- **Descomposición STL:** separa tendencia, estación y resto, y permite tendencias curvas.
- **Regresión con índices climáticos**, por ejemplo el índice ONI de El Niño, para separar la
  variabilidad natural de la tendencia.

### 2.11 Correlación con variables sociales y económicas

La pestaña *Clima y sociedad* compara una variable de la Tierra con un indicador del Banco
Mundial. Hay que entender tres ideas.

- **Correlación de Pearson ($r$):** va de −1 a 1 y mide qué tan bien una recta relaciona las dos
  series. Su prueba usa $t = r\sqrt{n-2}/\sqrt{1-r^2}$ con $n-2$ grados de libertad.
  **Spearman ($\rho$)** hace lo mismo con los rangos y es robusta a años extremos.
- **⭐ Correlación espuria por tendencia:** dos series que crecen con el tiempo salen muy
  correlacionadas aunque no tengan nada que ver. La temperatura y el PIB suben a la vez, pero
  eso no significa que el calor cause crecimiento. La solución es **quitar la tendencia** de
  cada serie (restar su recta) y correlacionar lo que queda: las desviaciones año a año.
  Pregunta útil: *"¿en los años más secos de lo normal, la cosecha fue peor de lo normal?"*.
  La app muestra las dos cifras y avisa cuando la aparente es engañosa.
- **Correlación no es causa:** puede haber un tercer factor (El Niño afecta a la lluvia **y** a
  los precios), o la relación puede ir al revés. Además, comparar un punto de ~50 km con un país
  entero diluye la relación: es un problema de **escala**.

Ideas para ir más lejos:

- **Desfase (lag):** la lluvia de este año puede afectar la cosecha del siguiente.
- **Regresión múltiple:** separar el efecto de la lluvia y el de la temperatura.
- **Promedio regional:** promediar varios puntos de las zonas agrícolas del país.

### 2.12 Herramientas en Python

| Tarea | Función |
|---|---|
| Regresión + t-test | `scipy.stats.linregress` |
| Mann-Kendall (τ de Kendall) | `scipy.stats.kendalltau` |
| Theil–Sen | `scipy.stats.theilslopes` |
| Mann-Kendall modificado, Seasonal Kendall | paquete `pymannkendall` |
| OLS con errores HAC | `statsmodels.api.OLS(...).fit(cov_type="HAC", cov_kwds={"maxlags": 1})` |
| Benjamini–Hochberg | `statsmodels.stats.multitest.multipletests(p, method="fdr_bh")` |
| Descomposición STL | `statsmodels.tsa.seasonal.STL` |
| Datos en rejilla (mapas) | `xarray` (extra `geo` del repo) |
| Pearson / Spearman | `scipy.stats.pearsonr`, `scipy.stats.spearmanr` |

---

## 3. Ejercicios con el repo

Hagan estos ejercicios con `make notebook` o con la web (`make backend` y `make frontend`).

1. **Primera tendencia.** Abran el ejemplo del Ártico. Expliquen con sus palabras qué
   significan la pendiente, el intervalo y el valor p.
2. **El poder de los años.** Repitan Svalbard desde 1990, 2000 y 2010. ¿Cuándo deja de ser
   significativa? Relaciónenlo con $SE_b \propto n^{-3/2}$.
3. **Ruido vs. señal.** Comparen la temperatura y la lluvia en la Amazonía. ¿Cuál necesita más
   años? ¿Por qué?
4. **Opuestos.** En *Comparar regiones*, busquen una variable que suba en una región y baje en
   otra. Propongan un proceso físico que lo explique.
5. **Escaneo y azar.** Escaneen Managua. ¿Cuántas variables siguen siendo significativas con
   el p ajustado?
6. **Detective de datos.** Miren la lluvia de Managua y la humedad del suelo de Bluefields.
   ¿Es clima o artefacto? ¿Cómo lo comprobarían? Pista: GPM/IMERG, estaciones o Giovanni.
7. **A mano.** Con 6 números inventados, calculen $S$ de Mann-Kendall y la pendiente de
   Theil–Sen en papel. Comparen con `scipy`.
8. **Tiempo de detección.** Calculen $n^*$ para Managua (temperatura) con la fórmula de 2.9.
9. **Clima y sociedad.** En el Corredor Seco, comparen la humedad del suelo con el rendimiento
   de cereales de Nicaragua. Comparen después la temperatura con el PIB por persona. ¿Por qué
   la segunda correlación "aparente" es alta pero la de año a año no? ¿Qué falta para hablar de
   causa?

---

## 4. Puntos de innovación

La versión actual ya cumple el alcance completo. Lo que diferencia un proyecto ganador es
**una o dos ideas bien hechas**, no diez a medias. Están ordenadas por impacto respecto al
esfuerzo.

### 🥇 Alta prioridad

1. **"¿Cuántos años necesito?" (tiempo de detección).** Si la tendencia no es significativa,
   decir *"con este ruido, una tendencia así se detectaría en unos N años"*. Convierte un
   "no significativo" frustrante en una respuesta útil, responde literalmente a una frase del
   reto y es poco común en otras herramientas. Fórmula en la sección 2.9. **Esfuerzo:** bajo.
2. **"Segunda opinión" con otra fuente.** Comparar la tendencia de POWER con otra fuente
   independiente (GPM/IMERG para lluvia, MODIS para la temperatura de superficie) y mostrar si
   **coinciden**. Ataca de frente el problema de los artefactos y enseña método científico.
   **Esfuerzo:** medio; requiere cuenta Earthdata.
3. **Corrección de la autocorrelación.** Usar Mann-Kendall modificado (Hamed y Rao) en lugar de
   solo avisar. Es rigor estadístico que los jueces científicos valoran. **Esfuerzo:** bajo.

### 🥈 Diferenciadores fuertes

4. **Asistente con IA "anclada".** El reto lo sugiere. El usuario escribe *"¿se está secando
   mi pueblo?"* y la IA propone variables del catálogo y una ubicación. **Regla de oro:** la IA
   solo elige entre opciones reales y explica; **nunca inventa números**, porque todas las cifras
   salen del análisis. **Esfuerzo:** medio.
5. **Mapa de tendencias.** Calcular la tendencia en una rejilla de puntos y pintarla, con el color
   para la pendiente y un punteado donde sea significativa. Muestra visualmente que la tendencia
   sube aquí y baja allá. Requiere corrección FDR (sección 2.7). **Esfuerzo:** medio-alto.
6. **Pistas entre variables.** Cuando una variable cambia, mostrar qué otras cambian a la vez y
   proponer el proceso, por ejemplo: *"sube la temperatura, sube la evaporación y baja la humedad
   del suelo; posible proceso: aridificación"*. Es el corazón de "detective". **Esfuerzo:** medio.

### 🥉 Toques que suman

7. **Modo "predice antes de ver".** El estudiante adivina "¿sube, baja o nada?" antes del
   resultado. Es una técnica pedagógica probada y hace la demo más memorable.
8. **Quitar El Niño.** Retirar la influencia del índice ONI antes de calcular la tendencia, que es
   muy relevante para Centroamérica.
9. **Exportar y compartir.** CSV de la serie, enlace permanente a cada investigación y una
   "tarjeta" del resultado para redes sociales.
10. **Enfoque local.** Un caso completo y bien contado del Corredor Seco de Nicaragua (agricultura,
    sequía, El Niño) da impacto real y conecta con el jurado local.

**Recomendación:** implementar 1 y 3 seguro, que son baratos y sólidos; elegir **una** entre 2, 4 y
6 como "estrella"; y usar 10 como historia de la presentación.

---

## 5. Cómo construir y presentar la app

### 5.1 Arquitectura (ya montada en el repo)

```
Navegador (React + Recharts)
   │  /api/trend, /api/scan, /api/compare
   ▼
FastAPI (Python)
   ├─ catalog.py   variables, definiciones, regiones, ejemplos
   ├─ power.py     NASA POWER + caché + muestras sin conexión
   └─ trends.py    estadística (lo explicado en la parte 2)
```

Principio de diseño: **toda la estadística vive en el backend y está probada** con datos
sintéticos de respuesta conocida. La web solo muestra resultados.

### 5.2 Caminos posibles para ampliar

| Camino | Qué añade | Coste | Cuándo elegirlo |
|---|---|---|---|
| **A. Seguir con POWER por punto** | Ideas 1, 3, 4, 6, 7 y 10 | Bajo | Siempre: es la base |
| **B. Earthdata con `earthaccess` y `xarray`** | GPM, MODIS, GLDAS y MERRA-2 completos; "segunda opinión" y mapas | Medio-alto (descargas grandes, cuenta) | Si alguien domina `xarray` |
| **C. Planetary Computer** | MODIS y Landsat sin cuenta (STAC) | Medio | Alternativa a B para vegetación y temperatura |
| **D. Giovanni** | Series ya calculadas por la NASA | Bajo para validar a mano | Para comprobar nuestros números, no como base |

**Recomendación:** A como base y B o C solo para **una** variable de contraste, por ejemplo la
lluvia de GPM en Managua.

### 5.3 Roles sugeridos (6 personas)

| Rol | Responsabilidad | Estudiar sobre todo |
|---|---|---|
| Ciencia de datos (2) | Estadística, nuevas pruebas, validar resultados | Parte 2 completa, ejercicios 2, 5, 7 y 8 |
| Backend / datos | Nuevas fuentes (Earthdata/GPM), caché, API | 1.3, 2.11, camino B |
| Frontend / UX | Interfaz guiada, gráficas, mapa, accesibilidad | 1.2, 2.3 (para explicar bien), sección 4 |
| Ciencia de la Tierra / narrativa | Definiciones, procesos físicos, caso del Corredor Seco | Parte 1, 2.8, ejercicios 4 y 6 |
| Presentación / video | Guion, video demo, página del proyecto | Todo a nivel general, sección 5.5 |

### 5.4 Plan para el hackathon

1. **Inicio:** acordar 1 o 2 innovaciones y repartir roles. Que todos ejecuten la app.
2. **Primera mitad:** implementar las innovaciones, con pruebas para la estadística nueva.
3. **Mitad:** congelar funciones y validar resultados de los ejemplos con Giovanni u otra fuente.
4. **Última parte:** solo arreglos, el video, la página del proyecto y ensayar la demo.
   **No añadir funciones nuevas al final.**

### 5.5 Guion de demo (unos 2 minutos)

1. **El problema (15 s):** "Hay miles de variables y pocas personas saben si un cambio es real."
2. **Ejemplo guiado (30 s):** el Ártico, con su veredicto en lenguaje llano y la gráfica.
3. **La lección de los años (20 s):** el mismo Ártico desde 2008 da "no significativo". La
   tendencia necesita tiempo (y aquí entra la innovación 1).
4. **Opuestos (20 s):** *Comparar regiones*, donde la misma variable sube y baja según el lugar.
5. **Detective de verdad (25 s):** el caso de Managua o de Bluefields: significativo no es lo
   mismo que real, y la app avisa.
6. **Impacto local (10 s):** el Corredor Seco y quién lo usaría.

### 5.6 Criterios de los jueces

Lean la *Judging and Awards Guide* oficial, que manda sobre esta guía. En retos científicos suele
pesar mucho la **validez**: que los números sean correctos y los límites estén explicados. Por eso
conviene enseñar las pruebas con datos sintéticos, los avisos y el contraste con otra fuente.

---

## Glosario

| Término | Significado |
|---|---|
| Anomalía | Diferencia entre un valor y su promedio de largo plazo para ese mes |
| Autocorrelación | Parecido entre un valor y el siguiente en la serie |
| Climatología | Promedio de largo plazo de cada mes o estación |
| ENSO / El Niño | Oscilación del Pacífico tropical que altera lluvia y temperatura en todo el mundo |
| Hipótesis nula | Suposición de partida que se intenta rechazar; aquí, "no hay tendencia" |
| Intervalo de confianza | Rango de valores plausibles para la pendiente |
| Mann-Kendall | Prueba de tendencia basada en el orden de los datos |
| Reanálisis | Reconstrucción del clima pasado combinando un modelo con observaciones |
| Significancia | Evidencia de que un resultado no es fruto del azar (p < α) |
| Theil–Sen | Pendiente robusta: la mediana de las pendientes entre pares de puntos |
| Valor p | Probabilidad de un resultado tan extremo si no hubiera tendencia |

## Lecturas

**Fuentes de datos y herramientas**

- NASA POWER, documentación de la API: https://power.larc.nasa.gov
- NASA Earthdata (MODIS, OMI, AIRS, GPM, MERRA-2 y GLDAS): https://www.earthdata.nasa.gov
- Giovanni: https://giovanni.gsfc.nasa.gov
- CUAHSI: https://www.cuahsi.org

**Libro de referencia**

- Wilks, D. S. *Statistical Methods in the Atmospheric Sciences*. El libro de referencia;
  ver los capítulos de pruebas de hipótesis y series temporales.

**Artículos sobre los métodos**

- Mann (1945) y Kendall (1975): prueba de Mann-Kendall.
- Sen (1968): pendiente de Theil–Sen.
- Hirsch, Slack y Smith (1982): Seasonal Kendall.
- Hamed y Rao (1998): Mann-Kendall modificado para datos autocorrelacionados.
- Yue et al. (2002): pre-whitening y su influencia en Mann-Kendall.
- Weatherhead et al. (1998): factores que afectan la detección de tendencias (tiempo de detección).
- Pettitt (1979): prueba de punto de cambio.
- Benjamini y Hochberg (1995): tasa de falsos descubrimientos (FDR).
- Wilks (2016), *"The stippling shows statistically significant grid points"*: significancia en
  mapas.
