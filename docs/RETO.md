# Reto: Be an Earth System Trend Detective

> Crear una herramienta que pueda seleccionar variables medidas por misiones de ciencias de la
> Tierra o producidas por modelos, visualizar cómo cambian con el tiempo y determinar qué está
> cambiando, dónde, cuánto y si esos cambios son "significativos".

## Idea base: *DATEX* (del análisis del equipo)

El análisis completo está en
[Earth_System_Trend_Detective_analisis_y_solucion.pdf](Earth_System_Trend_Detective_analisis_y_solucion.pdf).
Su idea central: los proyectos no se van a distinguir por complejidad, sino por tres cosas.

1. **Guiar de verdad la elección de la variable.** Unas pocas preguntas en lenguaje llano
   llevan a tres variables como máximo, cada una con su definición, su fuente y una nota de
   fiabilidad.
2. **No declarar tendencias que no existen.** Las pruebas tienen que resistir la
   autocorrelación de los datos ambientales.
3. **Explicar el resultado a un estudiante,** con un veredicto honesto. "Todavía no es
   significativo" también es un resultado: se acompaña de los años de datos que faltan.

Recorrido: **preguntar → ver → veredicto**, más comparar dos lugares (la misma variable puede
subir en uno y bajar en otro).

## Cómo cubrimos cada objetivo

| Objetivo del reto | En la herramienta |
|---|---|
| Identificar variables de interés | Pregunta libre (IA o reglas) y preguntas guiadas (qué preocupa y tipo de lugar), que llevan a un **recomendador por reglas** de hasta 3 variables con definición, fuente y fiabilidad. **Escanear** ordena las 14 variables de un lugar por evidencia |
| Datos de una región concreta | **Cualquier lugar del mundo:** búsqueda por nombre, clic en el mapa y detección automática del país. Las regiones de ejemplo quedan como atajos |
| Serie temporal suficientemente larga | Datos mensuales desde 1981 (NASA POWER). Gráfica de anomalías, promedio anual y recta |
| Tasa de cambio y significancia | Theil–Sen e IC 95 %; Mann-Kendall con preblanqueo; regresión con n efectivo; veredicto en 4 niveles |
| Público estudiante y ejemplos | Ejemplos de un clic, veredicto en lenguaje llano, "¿Cómo se calculó?", botón **Explicar** |
| Tendencias opuestas por región | **Comparar lugares** (dos puntos cualesquiera) y **Regiones de ejemplo** |
| IA (opcional en el reto) | De la pregunta al catálogo, y explicación anclada a las cifras (ver más abajo) |

Extensiones que pidió el equipo, más allá del reto:

- **Satélite:** imágenes Landsat/Sentinel-2 del lugar año a año y cobertura del suelo anual
  (zona construida, cultivos, árboles…).
- **Población:** datos de la ONU para cualquier país, con su proyección oficial.
- **Clima y sociedad:** relación con indicadores del Banco Mundial.
- **Escenario futuro:** qué pasaría si el ritmo actual continuara.

## Motor estadístico (`backend/app/services/trends.py`)

1. **Anomalías:** a cada mes se le resta la media de ese mes del calendario.
2. **Medias anuales** de las anomalías, con al menos 10 meses válidos por año. Se exige un
   mínimo de **15 años**; si no, el resultado es "datos insuficientes".
3. **Magnitud:** pendiente de Theil–Sen por década con su IC 95 %, más la de mínimos cuadrados.
4. **Significancia resistente a la autocorrelación:**
   - **Mann-Kendall con preblanqueo:** se quita la autocorrelación de lag 1 antes de la prueba.
   - **Regresión con tamaño de muestra efectivo,** n·(1−r)/(1+r), para el intervalo.
   - En los dos, la autocorrelación r se **corrige por el sesgo de muestra pequeña**,
     r + (1+4r)/n. Con 30 años la estimación sin corregir sale demasiado baja, y la corrección
     sola no basta.
5. **Veredicto** (umbrales de diseño, publicados aquí):

   | Veredicto | Condición |
   |---|---|
   | Tendencia significativa | Mann-Kendall p < 0,05 **y** el IC 95 % (n efectivo) no incluye el cero |
   | Todavía no significativa | p entre 0,05 y 0,20, o las dos pruebas no coinciden |
   | Sin tendencia clara | p ≥ 0,20 |
   | Datos insuficientes | Menos de 15 años con datos |

6. **Años que faltan** (Weatherhead et al. 1998, adaptado a datos anuales):
   n* ≈ [3,3 · σ · √12 / |ω| · √((1+φ)/(1−φ))]^(2/3).
7. **Sensibilidad al periodo:** se repite el veredicto moviendo el inicio y el fin hasta 3 años,
   y se avisa si cambia.
8. **Saltos bruscos** (Pettitt) y **notas de fiabilidad** por variable.

### Validación por simulación (series anuales de 30 años, sin tendencia)

| Autocorrelación φ | Regresión corriente | Solo preblanqueo | Solo n efectivo | **Nuestro veredicto (ambas + corrección)** |
|---|---|---|---|---|
| 0 | 4,8 % | 3,8 % | 4,3 % | **3,6 %** |
| 0,4 | 19,3 % | 11,0 % | 8,7 % | **4,8 %** |
| 0,8 | 49,0 % | 23,1 % | 13,1 % | **8,2 %** |

- **Coste en sensibilidad:** con φ = 0 detecta una tendencia de 0,06 desviaciones por año en el
  65 % de los casos, frente al 74 % de la regresión sola.
- **Fórmula de años que faltan:** a n* años se detecta la tendencia en el 88–96 % de los casos
  simulados (objetivo: 90 %).
- **Mann-Kendall con preblanqueo "sin tendencia" (TFPW):** dio un 20–58 % de falsos positivos y
  se descartó, como advierte el PDF sobre las variantes "modificadas".
- **Pruebas automáticas:** las de `tests/test_trends.py` repiten la comprobación clave (≤ 9 % con
  φ = 0,4, cuando la regresión ingenua da más del 12 %).

**Diferencia con el PDF:** el PDF midió sobre 300 valores mensuales. Con nuestras series anuales
de unos 30 años, los dos métodos sin la corrección de sesgo no se mantenían en el 5 %. Por eso
añadimos la corrección y exigimos que coincidan los dos métodos.

## Globo 3D (`scripts/build_globe.py` y `frontend/src/Globe3D.tsx`)

Portada con el mundo entero de un vistazo.

- **Malla:** 2.592 celdas de 5°. El centro de cada una se consulta en NASA POWER para 5
  variables (1990–2025) y pasa por el **mismo motor del veredicto**.
- **Control de falsos descubrimientos:** se aplica Benjamini-Hochberg con q = 0,10 sobre todas
  las celdas de cada variable (hallazgo 4 del análisis). Una celda se pinta opaca solo si tiene
  veredicto "significativa" **y** pasa el FDR; el resto queda casi transparente.
- **Color:** muestra la pendiente con paletas divergentes. Azul/rojo en temperatura;
  marrón/verde azulado en agua (más seco / más húmedo).
- **Clic** en una celda: abre el veredicto completo de ese punto.
- **Técnica:**
  - MapLibre GL en proyección de globo, cargado aparte para no pesar en la página principal; la
    malla es una sola capa GeoJSON dibujada en GPU (antes: 2.592 polígonos 3D con three.js, lento);
  - imagen real en teselas según el zoom: NASA GIBS Blue Marble y VIIRS Black Marble (dominio
    público) de lejos, Esri World Imagery de cerca; las teselas necesitan conexión;
  - la malla se precalcula (`make globe`) y se sirve como archivo.
- **Aviso del análisis:** "un globo 3D es vistoso pero no responde a las cuatro preguntas". Por
  eso es la puerta de entrada, y el núcleo sigue siendo el veredicto.

## Previsión (`forecast.py`): un escenario, no una predicción

- Extrapolación lineal de la serie anual con **intervalo de predicción del 95 %**:
  ŷ ± t·s·√(1 + 1/n + (x₀−x̄)²/Σ(x−x̄)²). En las pruebas, la cobertura simulada queda entre el
  91 % y el 99 %.
- Se respetan los **límites físicos** (0–100 %, 0–1, ≥ 0).
- **Avisos:**
  - el horizonte va más allá de la mitad del periodo observado;
  - hay autocorrelación;
  - la tendencia de base no es significativa.
- **En población, la referencia es la proyección oficial de la ONU,** que modela nacimientos,
  muertes y migración. La recta solo sirve para comparar.
- **Por qué es una extensión:** el PDF señala que la predicción queda fuera del alcance del
  reto. Por eso se presenta separada del veredicto y siempre etiquetada como escenario.

## IA (`ai.py`): usos acotados

1. **De la pregunta al catálogo:** Claude devuelve JSON restringido a las opciones del catálogo
   (preocupación, tipo de lugar y nombre del lugar). Las variables las elige el recomendador por
   reglas.
2. **Explicar:** el servidor **recalcula** el análisis y le pasa a Claude solo esas cifras. Las
   reglas del prompt:
   - no inventar números;
   - presentar las causas como hipótesis;
   - no hablar de tendencia confirmada si el veredicto es "todavía no";
   - etiquetar el futuro como escenario.

Además:

- El veredicto sigue siendo una plantilla fija, nunca texto de la IA.
- **Sin clave** (`ANTHROPIC_API_KEY`) o si falla el servicio, se usan reglas por palabras clave y
  plantillas: la app funciona igual.
- Modelo `claude-opus-5-5`, con esfuerzo bajo y *fallbacks* del lado del servidor ante rechazos.

## Fuentes de datos

| Fuente | Qué aporta | Acceso |
|---|---|---|
| NASA POWER (MERRA-2, CERES) | 14 variables mensuales desde 1981, cualquier punto | Sin clave; muestras locales de 7 regiones |
| Microsoft Planetary Computer | Landsat (desde 1984), Sentinel-2 (desde 2016), cobertura del suelo anual 2017–2023 | Sin clave |
| ONU vía Our World in Data | Población, crecimiento, fecundidad, natalidad, mortalidad, urbanización, esperanza de vida; proyecciones a 2100 | Sin clave; caché por indicador y muestras |
| Banco Mundial | Indicadores socioeconómicos anuales | Sin clave; a veces muy lento, por eso hay muestras |
| Open-Meteo | Búsqueda de lugares por nombre | Sin clave |
| GeoNames (`reverse_geocoder`) | País de cualquier coordenada | Sin conexión |

## Límites que hay que contar en la presentación

- **NASA POWER es un reanálisis (MERRA-2).** Cuando cambian los satélites que alimentan el
  modelo, la serie puede saltar. Ejemplos en nuestros datos:
  - salto hacia 1999 en la humedad de Bluefields;
  - lluvia de Managua sospechosamente creciente.

  Cada variable lleva su nota de fiabilidad.
- **Con el motor corregido, varias tendencias de temperatura pasan a "todavía no
  significativas"** (Managua, Bluefields, Amazonía), mientras el Ártico, el Sahara y Ciudad de
  México siguen siendo significativas. Es el comportamiento buscado: antes las declarábamos con
  demasiada confianza.
- **La cobertura del suelo la clasifica un modelo automático.** Un salto de un año suele ser del
  clasificador, no del terreno (ejemplo: Lagos, 2017–2018).
- Una correlación no demuestra causa, y un punto no representa a todo un país.

## Pendiente importante para la entrega

- **La entrega debe estar en inglés.** Página del proyecto, demo y material. La interfaz está en
  español; conviene añadir un selector de idioma o traducirla antes de grabar la demo.
- Demo de **7 diapositivas o un video de 30 segundos**. Confirmar la hora límite local.
