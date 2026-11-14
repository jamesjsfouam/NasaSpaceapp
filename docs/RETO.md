# Reto: Be an Earth System Trend Detective

> Crear una herramienta que pueda seleccionar variables medidas por misiones de ciencias de la
> Tierra o producidas por modelos, visualizar cómo cambian con el tiempo y determinar qué está
> cambiando, dónde, cuánto y si esos cambios son "significativos".

## Cómo cubrimos cada objetivo

| Objetivo del reto | En la herramienta |
|---|---|
| Identificar variables de interés | 14 variables de NASA POWER en 6 temas, cada una con definición sencilla; **Escanear** las ordena por evidencia de tendencia |
| Adquirir datos de una región concreta | Regiones de ejemplo (ciudad, desierto, selva, Ártico, Corredor Seco…) o cualquier coordenada |
| Serie temporal suficientemente larga | Datos mensuales desde 1981; gráfica de anomalías, promedio anual y recta de tendencia |
| Tasa de cambio y significancia | Theil–Sen e IC 95 %, regresión lineal e IC 95 %, Mann-Kendall y t-test |
| Público estudiante y ejemplos | Preguntas guiadas, 4 ejemplos de un clic, veredicto en lenguaje llano, sección "¿Cómo se calculó?" |
| Tendencias opuestas por región | **Comparar regiones**: la misma variable en todas las regiones de ejemplo |

## Método (`backend/app/services/trends.py`)

1. Se usan solo años completos y se calcula el ciclo estacional (promedio de cada mes).
2. Cada año se resume en su promedio de 12 meses: la estación desaparece y la serie anual
   tiene un valor por año. Así las pruebas no confunden el verano con una tendencia.
3. **Theil–Sen** (mediana de las pendientes entre pares de años) da la tasa de cambio, robusta
   a años extremos como El Niño, con su intervalo de confianza del 95 %.
4. **Mann-Kendall** (prueba principal, no asume normalidad) da el valor p. Como contraste se
   calcula la **regresión lineal con t-test** y se indica si ambos métodos coinciden.
5. Etiquetas: p < 0,01 muy significativa; p < 0,05 significativa; p < 0,10 indicio débil.
6. Avisos automáticos:
   - **Autocorrelación** de los residuos > 0,3: la significancia puede estar sobreestimada.
   - **Serie corta** (< 20 años).
   - **Salto brusco** (prueba de Pettitt): si un escalón explica los datos mejor que una recta.
7. Al **escanear** 14 variables se da también el p ajustado de Bonferroni: con 14 pruebas, una
   puede salir "significativa" por azar.

Las pruebas (`backend/tests/test_trends.py`) comprueban el método con series sintéticas de
tendencia conocida: recupera la pendiente, no inventa tendencias en ruido puro, ignora el
ciclo estacional y detecta un escalón artificial.

## Límites que hay que contar en la presentación

- **NASA POWER es un reanálisis (MERRA-2)**, no observaciones directas. Cuando cambian los
  satélites que alimentan el modelo, la serie puede saltar. Lo vimos en los datos reales:
  - **Bluefields:** la humedad del suelo, la humedad relativa y la evaporación muestran un
    salto hacia 1999, que la herramienta marca.
  - **Managua:** la lluvia pasa de unos 2 mm/día en los 90 a más de 5 mm/día en los 2010, y la
    temperatura media baja. Ese cambio es gradual, así que no se marca como salto, pero hay que
    contrastarlo con estaciones meteorológicas antes de creerlo. Es un buen ejemplo de "detective":
    un resultado significativo no es automáticamente un resultado real.
- Cada valor representa una celda de unos 50 × 60 km.
- Solo tendencias lineales, como pide el alcance del reto.

## Ideas para seguir (por prioridad)

1. Contrastar con otra fuente:
   - **GPM/IMERG** para la lluvia y **MODIS** para la temperatura de superficie y la vegetación.
     Se descargan con `earthaccess` (extra `geo`, requiere cuenta gratuita de Earthdata).
   - **Planetary Computer** (ya incluido en `services/planetary.py`), sin clave.
2. Promediar una región (varios puntos) en lugar de un solo punto.
3. Mapa para elegir la ubicación con un clic.
4. Exportar la serie a CSV para que los estudiantes repitan el análisis.
