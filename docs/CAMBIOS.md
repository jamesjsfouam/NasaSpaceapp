# DATEX · Registro de cambios

**Proyecto:** DATEX, ¿el clima está cambiando de verdad? · NASA Space Apps Challenge 2026 · Boreal Labs
**Fecha:** 15 de noviembre de 2026 · **Web oficial:** https://jamesjsfouam.github.io/Datexv2/ · **Código oficial:** https://github.com/jamesjsfouam/Datexv2 (rama `main`)

Este documento reúne todo lo que se cambió, creó o descubrió. Está ordenado por tema y cada punto dice **por qué** se hizo. Al final hay la lista completa de commits, los pendientes y lo que no se pudo verificar.

---

# 1. Resumen

1. **La web oficial pasa a ser la de José** (`Jose21NC/datex`, commit `d6d7a87`). Se copió a un repositorio nuevo, `Datexv2`, conservando su historial y su autoría. Ahí se trabaja ahora.
2. **Datos del Banco Mundial completados** (Argelia, México, Brasil y Nicaragua: 10 de 10 indicadores) y datos estáticos regenerados. La pestaña Sociedad pasa de 176 a 246 relaciones precalculadas.
3. **Modelo de crecimiento urbano «Ciudad 3D»** (Managua): un escenario por celdas de 100 m, con crecimiento **horizontal** (celdas nuevas) y **vertical** (más pisos, con alturas reales de GHSL), impulsado por población urbana, ingreso y clima. Validado: acierta dónde crece la ciudad con AUC 0.857. Está en la sección **Satélite**, debajo del contenido.
4. **Rediseño completo del frontend de `NasaSpaceapp`** con la identidad DATEX del manual de marca (paleta azul marino/cian, Satoshi, píldoras, sin recuadros), mapa plano, análisis en un panel lateral, tablas estadísticas con CSV, método comparativo y geolocalización.
5. **Documento con todas las fórmulas** (41 páginas, más de 1.000 fórmulas), con base en la web de José.
6. **Figma, documento NASA de Google y entregables del formulario** actualizados o redactados.
7. **Hallazgos importantes** sobre la calidad de los datos y la coherencia de los cálculos (sección 8).

---

# 2. Repositorios y ramas (estado final)

| Repositorio | Rama | Estado |
|---|---|---|
| `jamesjsfouam/Datexv2` | `main` | **Oficial.** Web de José + datos completos + Ciudad 3D (horizontal y vertical) + despliegue a Pages. |
| `jamesjsfouam/Datexv2` | `main-limpia`, `ciudad-3d`, `ciudad-3d-limpia`, `datos-banco-mundial`, `datos-banco-mundial-limpia` | **Sobran.** Todo está ya en `main`. Hay que borrarlas desde GitHub (el proxy de la sesión no permite borrar ramas). |
| `jamesjsfouam/NasaSpaceapp` | `actualizacion-frontend` | Rediseño de marca, mapa plano, tablas, geolocalización, datos, modelo de crecimiento (script de Python) y fórmulas. |
| `jamesjsfouam/NasaSpaceapp` | `wip-interruptor-vista` | Interruptor Gráfica/Tabla **a medias, no compila.** No integrar tal cual. |
| `jamesjsfouam/NasaSpaceapp` | `main` | Sin cambios desde el commit `6802643`. |
| `Jose21NC/datex` | `main` | Solo lectura. Sin cambios por nuestra parte (no hay permiso de escritura). |

---

# 3. Web oficial (`Datexv2`): qué se añadió sobre la base de José

| Cambio | Por qué |
|---|---|
| **Datos del Banco Mundial completos** y `bundle.json` regenerado (6,5 MB). | Argelia tenía 1 de 10 indicadores, México 6, Brasil 9 y Nicaragua 9. El Sahara usa Argelia: la demo de clima y sociedad quedaba casi vacía. |
| **Sección «Crecimiento urbano proyectado: horizontal y vertical»**, bajo el contenido de Satélite. | Petición expresa: integrar el crecimiento en Satélite, abajo, y que no se vea plano. Solo aparece si hay una ciudad precalculada a menos de 30 km (hoy, Managua). |
| **Tres capas en 3D:** lo construido en 2023 con alturas reales (azul marino), crecimiento horizontal (cian) y crecimiento vertical como capa de pisos (blanco). | Distinguir de un vistazo lo existente, lo que se expande y lo que se densifica. |
| **Control «Exageración vertical»** (1×–12×, por defecto 6×) y botón «Girar la vista». | Con celdas de 100 m y edificios de unos 6 m el 3D saldría plano. Las cifras mostradas son reales; solo se exagera el dibujo. |
| **Interruptor «Clima + sociedad» ⇄ «Solo población»**, control de años 2023–2050 con «Reproducir» y «Solo lo proyectado». | Mostrar cuánto cambia el resultado por los impulsores no demográficos. |
| **KPIs:** superficie construida, población urbana, altura media de lo existente, **celda con mayor altura media**, volumen construido (y parte vertical). | Cuantificar el crecimiento en horizontal y en vertical. |
| **Desplegables:** «Variables que se tuvieron en cuenta», «Qué pasaría si», «Cómo se calcula y qué tan fiable es». | Transparencia: el usuario ve los supuestos, la sensibilidad y los límites. |
| **README** con enlace de la web, qué incluye y créditos. Flujo de despliegue a Pages. | Entrega NASA y atribución de fuentes. |
| Se eliminó la pestaña independiente «Ciudad 3D». | Duplicaba la sección de Satélite. El botón «Ver la ciudad en 3D» del planeta abre Satélite. |

**Corrección posterior a una observación tuya.** El KPI se llamaba «Edificio más alto» (23,9 m en 2023; 29,4 m en 2050). Estaba mal: GHSL da la **altura media por celda de 100 m**, no edificios individuales. Se renombró a **«Celda con mayor altura media»**, con una nota visible: «Las alturas vienen de GHSL (100 m): son promedios por celda, no edificios individuales; las torres aisladas aparecen suavizadas».

---

# 4. Modelo de crecimiento urbano «Ciudad 3D» (Managua)

**Código:** `backend/scripts/build_city_growth.py` (repositorio `NasaSpaceapp`). **Datos que genera:** `static-api/city/managua.json`. Fórmulas completas en `DATEX_Formulas.pdf` (Parte 4, Q1–Q14).

## 4.1 Crecimiento horizontal
- **Datos de partida:** cobertura del suelo anual de 10 m (Impact Observatory/Esri, 2017–2023, Microsoft Planetary Computer), reproyectada a una malla de 240 × 240 celdas de 100 m.
- **Dónde crece:** regresión logística (cercanía a lo construido, densidad vecina a 300 m, 700 m y 1,5 km, pendiente del terreno y cercanía al agua) y reparto por autómata celular.
- **Cuánto crece:** el área construida sigue la población urbana de la ONU elevada a un exponente β ajustado (β = 1,68, acotado a 1,30).
- **Validación (ajuste 2017→2020, prueba 2020→2023, 1213 celdas nuevas):** AUC 0,857; figura de mérito 0,182 frente a 0,115 (regla «construir junto a lo existente») y 0,037 (azar): unas 5 veces mejor que el azar y 1,6 veces mejor que la regla ingenua.

## 4.2 Impulsores climáticos y sociales (escenario «Clima + sociedad»)
- **Sociales:** ingreso por habitante (Banco Mundial, +1,95 %/año) y empleo agrario (−0,45 %/año), con tendencias de Theil–Sen acotadas.
- **Climáticos:** tendencias NASA POWER de temperatura, lluvia y humedad del suelo. **Control de calidad:** si el test de Pettitt detecta un salto brusco (p < 0,05), solo se usa la tendencia posterior al salto. Se ponderan por evidencia (significativa 1, «todavía no» 0,5, sin tendencia 0).
- **Supuestos explícitos y ajustables** (no coeficientes ajustados): empuje migratorio por clima κ = 0,5 y efecto del ingreso γ = 0,2.
- **Resultado en Managua:** sin estrés climático confirmado. Tras los saltos de 1999 (temperatura) y 2005 (lluvia y humedad del suelo) ninguna tendencia es significativa, y las de lluvia y humedad apuntan a más agua, no a sequía. La diferencia entre escenarios viene solo del ingreso.
- **Área construida en 2050:** 226,4 km² (2023) → 345,5 km² con solo población y 383,5 km² con clima + sociedad. Con estrés climático hipotético entre 0,5 y 1 y distinto empuje, el rango sube de 417 a 524 km².

## 4.3 Crecimiento vertical (más pisos)
- **Alturas de partida reales:** capa GHSL GHS-BUILT-H (altura media neta de edificación, 100 m, 2018), del JRC de la Comisión Europea.
- **Cómo crece:** la altura de lo existente aumenta según el ingreso por habitante, m(t) = (G(t)/G(2023))^θ con **θ = 0,5 (supuesto explícito)**, y se concentra en el núcleo denso (peso de centralidad 0–1). En «Solo población» no hay crecimiento vertical.
- **Resultado en Managua:** altura media de lo existente 5,72 m → 6,98 m (2050); celda con mayor altura media 23,9 m → 29,4 m; volumen construido 1244,9 → 1956,4 millones de m³, de los cuales 281,0 por crecimiento vertical (con solo población: 1576,0 millones de m³).
- **Sensibilidad a θ** (volumen 2050): θ = 0 → 1664,2; θ = 0,5 → 1956,4; θ = 1 → 2335,9 millones de m³.

## 4.4 Límites (también escritos en la propia web)
- Es un **escenario, no una predicción**: prolonga la tendencia 2017–2023 y no conoce planes urbanísticos.
- Con 10 m de cobertura se ven manzanas, no edificios; las alturas de GHSL son **promedios por celda** a 100 m.
- Ingreso, clima y crecimiento vertical actúan con **supuestos explícitos**, no con coeficientes ajustados.
- Hoy solo está calculada **Managua**; para otras ciudades hay que ejecutar el script.

---

# 5. Rediseño del frontend de `NasaSpaceapp` (rama `actualizacion-frontend`)

| Cambio | Por qué |
|---|---|
| **Identidad DATEX** del manual de marca: azul marino `#00023d`, cian `#56e1e8`, tipografía Satoshi incluida en los archivos, logotipo vectorial extraído del PDF, patrón de cuartos de círculo, botones y etiquetas en píldora, números en círculo. | Aplicar el manual de identidad corporativa. |
| **Sin recuadros:** el análisis usa un título en píldora con línea cian sobre la propia página. | Petición del usuario: las secciones en recuadro no gustaban. |
| **Mapa plano** por defecto (con opción de globo), celdas translúcidas y sin líneas a escala mundial. | Petición: un mapa liso, no necesariamente esférico; la cuadrícula se veía mal. |
| **Análisis como panel lateral** sobre el mapa (ampliable), en lugar de una fase aparte. | Integrar los datos estadísticos con el mapa, como en la referencia. |
| **Tablas estadísticas** en Veredicto (descriptivos, **método comparativo** Theil–Sen frente a OLS con n efectivo, datos por año con medias por década, escenario por año), Radar (p, IC, años), Comparar (A frente a B, correlación, diferencia de pendientes), Satélite, Población y Clima y Sociedad, todas con **CSV**. | Faltaba «la tabla normal del análisis» y el método comparativo. |
| **Geolocalización:** botón «Usar mi ubicación» (Nominatim) y fondo de calles OpenStreetMap. Google Maps **no** se activó: necesita una clave. | «Integra una API de mapas geolocalizados». |
| **Nombre del equipo:** «Boreal Labs» en la app, el README, los documentos y la licencia. | Corrección del nombre. |

> La rama `wip-interruptor-vista` (interruptor deslizante Gráfica ⇄ Tabla por sección) quedó **sin terminar y no compila**. Su diseño está en el Figma (marco 09). Pendiente de retomar.

---

# 6. Documentos y entregables

| Entregable | Estado |
|---|---|
| **`DATEX_Formulas.pdf`** (41 páginas, más de 1.000 fórmulas) y `docs/FORMULAS.md` | Todas las fórmulas y umbrales de la web de José, el motor de Python que generó los datos, una tabla de 34 diferencias entre ambos, y el modelo de crecimiento urbano (Parte 4, Q1–Q14). Marca los cálculos que no se pudieron interpretar con certeza. |
| **Documento «NASA» de Google** | Se corrigió: equipo «Boreal Labs», «(licencia MIT)», web publicada, «tiempo real» → «datos de la NASA», cifras de Svalbard (+0,73 °C/década, p < 0,001) y Managua (−0,21 °C/década, p = 0,109), aclaración de 1981/1990 y de los servicios que consulta la web. Quedan vacíos «Video demostrativo», las gráficas y las partes 3 y 6. |
| **Tres figuras** (Svalbard, Managua, comparación) | Capturas de la web de José, enviadas como archivos. No se pudieron insertar solas en el documento (Google Docs necesita imágenes públicas y el sistema lo bloqueó). |
| **Figma** (archivo `CKK08B7wxK0HBZN0A3ZGVP`, página «04 · Implementación web (código)») | Wireframes de escritorio: Guía, Planeta, Mapa + panel, «Ayúdame a elegir» y un panel por pestaña; tres pantallas móviles; marco 09 con la vista de gráfica por defecto frente a la de tabla; y el componente «Interruptor de vista». Las páginas 00–03 son del equipo y no se tocaron. |
| **Textos del formulario de NASA** | Resumen, detalles, uso de IA, datos de la NASA y otros datos redactados en inglés (y resumen en español). |

---

# 7. Datos

| Dato | Antes | Después |
|---|---|---|
| Banco Mundial, Argelia | 1 de 10 indicadores | 10 de 10 |
| Banco Mundial, México | 6 de 10 | 10 de 10 |
| Banco Mundial, Brasil / Nicaragua | 9 de 10 | 10 de 10 |
| Relaciones clima–sociedad precalculadas | 176 | 246 |
| Ciudad 3D | no existía | `static-api/city/managua.json` (≈530 KB) con base, crecimiento horizontal y vertical, impulsores y validación |

La descarga del Banco Mundial falló por momentos (error 503); Argelia necesitó dos descargas adicionales para completar los 10 indicadores.

---

# 8. Hallazgos importantes

1. **Salto brusco en las series de Managua hacia 2005** (lluvia ≈2 → ≈4,8 mm/día, humedad del suelo 0,58 → 0,67, temperatura máxima −1,5 °C). Las tendencias «significativas» de lluvia, humedad y Tmax que muestra el motor para Managua son casi seguro un **artefacto del reanálisis MERRA-2**. El detector de saltos del motor (`_step_change`) **no lo marcó**: exige que un escalón ajuste mejor que la recta y aquí hay además una rampa.
2. **La web de José no da el mismo veredicto en todos los sitios.** Para las 7 regiones usa los datos precalculados por el motor de Python; para cualquier otro punto calcula en el navegador con otro algoritmo. Con Managua (temperatura media) el bundle dice «todavía no» (p = 0,1085) y el algoritmo del navegador daría «significativa» (p ≈ 0,008; valor obtenido de un port a Python, no ejecutando el TypeScript). Diferencias principales: Mann–Kendall con preblanqueo TFPW (que nuestro propio README descarta por dar entre 20 y 58 % de falsos positivos), años necesarios sin el factor √12, sin sensibilidad al periodo, Pettitt sin la condición del escalón y relación clima–sociedad con primeras diferencias.
3. **La tabla Monte Carlo (49 % → 8,2 %) es un texto fijo.** El repositorio no tiene el script que la generó, solo pruebas: no es reproducible.
4. **Al bundle de José le faltaban 70 relaciones** (casi todo Argelia y México); el bundle nuevo las incluye.
5. **Texto «14 variables»** en la web, cuando son 17.
6. **Rótulo de altura:** «Edificio más alto» era un error de interpretación de GHSL (ver sección 3).

---

# 9. Autoría y commits

- **Regla desde que el usuario lo pidió** («todo push como si fuera mío»): autor y committer = *James Santiago Fernández Obregón <james@borealabs.org>*, sin líneas de coautoría de Claude. Rige para `Datexv2` y para los commits recientes de `NasaSpaceapp`.
- Los commits anteriores de `NasaSpaceapp` también van a nombre de James, pero llevan la línea «Co-Authored-By: Claude». Quitarla exige reescribir esas ramas con *force-push*, que el sistema bloqueó; queda a decisión del usuario.
- En `Datexv2`, el commit `49f526b` (en el historial de `main`) tiene esa coautoría; se corrigió una versión limpia (`9918428`) pero `main` conserva el commit antiguo en su historia.

## `Datexv2` · rama `main`

| Commit | Autor | Descripción |
|---|---|---|
| `61645f5` | James Santiago Fernández Obregón | Celdas 3D: color por altura GHSL, corona vertical translúcida, pulso en lo nuevo, relieve, luz y animación de subida |
| `185dc2a` | James Santiago Fernández Obregón | El crecimiento urbano pasa a la sección Satélite (abajo) y se elimina la pestaña independiente |
| `9665b94` | James Santiago Fernández Obregón | Ciudad 3D: crecimiento horizontal y vertical con capa de pisos, exageración vertical y KPIs de altura y volumen |
| `ce08115` | James Santiago Fernández Obregón | Datos de Managua con alturas reales (GHSL 2018) y crecimiento vertical |
| `234b784` | James Santiago Fernández Obregón | README: enlace de la web publicada, qué incluye y créditos |
| `971a33c` | James Santiago Fernández Obregón | Integra main-limpia: datos del Banco Mundial completos, pestaña Ciudad 3D y despliegue |
| `41f7cc3` | James Santiago Fernández Obregón | Despliegue a GitHub Pages también desde main-limpia |
| `90e7de0` | James Santiago Fernández Obregón | Integra la pestaña Ciudad 3D (escenario de crecimiento urbano) en la rama principal |
| `b2df34e` | James Santiago Fernández Obregón | Datos del Banco Mundial completos (DZA, MEX, BRA, NIC: 10/10) y bundle estático regenerado |
| `320e99d` | James Santiago Fernández Obregón | Pestaña «Ciudad 3D»: cómo se verá la ciudad (escenario de crecimiento urbano en 3D) |
| `9918428` | James Santiago Fernández Obregón | Importa la web DATEX de José (Jose21NC/datex, d6d7a87) como base del proyecto |
| `8e6f912` | James Santiago Fernández Obregón | Datos: escenario de crecimiento urbano de Managua (public/static-api/city) |
| `49f526b` | James Santiago Fernández Obregón | Importa la web DATEX de José (Jose21NC/datex, d6d7a87) como base del proyecto |
| `b29a79e` | James Santiago Fernández Obregón | Initial commit |
| `d6d7a87` | Jose21NC | DATEX: versión inicial |

## `NasaSpaceapp` · rama `actualizacion-frontend` (desde `90886c2`)

| Commit | Descripción |
|---|---|
| `bd050c0` | Crecimiento urbano vertical: alturas reales GHSL 2018 y crecimiento por ingreso concentrado en el núcleo denso |
| `df74074` | FORMULAS.md: estado del portado a la web de José |
| `123f788` | Documento de fórmulas: todo lo que calcula la web de José (navegador y motor que generó los datos) y el modelo de crecimiento urbano |
| `2255074` | Ciudad 3D: interruptor de escenario (clima + sociedad / solo población), variables consideradas y tabla 'Qué pasaría si' |
| `9308fb0` | Vista 3D de crecimiento urbano: pestaña Ciudad 3D, botón en el planeta y escenario por celdas |
| `5065121` | Crecimiento urbano: impulsores climáticos y sociales (población urbana, ingreso, empuje climático) con control de discontinuidades |
| `815642b` | Escenario de crecimiento urbano de Managua (autómata celular, celdas de 100 m) con validación 2020→2023 |
| `bb0a45f` | Datos del Banco Mundial completos (DZA, MEX, BRA, NIC: 10/10) y bundle estático regenerado |
| `019d2dd` | Nombre del equipo: Boreal Labs (textos de la app, README, docs y titular de la licencia MIT) |
| `68b7cea` | README: OpenStreetMap/Nominatim y nota sobre Google Maps (opcional, no activado) |
| `b74aa1f` | Geolocalización (Usar mi ubicación + Nominatim) y fondo de calles OSM en el mapa |
| `a18831a` | Tablas numéricas en Comparar, Satélite, Población y Clima y Sociedad (con CSV) |
| `507dcf5` | Tabla estadística en Veredicto (descriptivos, método comparativo, datos por año) y columnas p/IC/años en el Radar |
| `4a1016d` | Malla del mapa más suave: celdas translúcidas y sin líneas a escala mundial |
| `6802643` | Estilos de marca sin recuadros, nombre DATEX en textos y documentación |
| `d3d42d7` | Mapa plano por defecto y análisis estadístico como panel lateral sobre el mapa |
| `2919b79` | Identidad de marca DATEX: tipografía Satoshi, logotipo, patrón y paleta azul marino/cian |

---

# 10. Pendientes y decisiones

1. **Borrar las 5 ramas sobrantes** de `Datexv2` (GitHub → Branches). Deja solo `main`.
2. **Licencia:** `Datexv2` tiene MIT a nombre de *James Santiago Fernández Obregón*; el documento NASA dice «Boreal Labs». Y el repositorio de José no tenía licencia: conviene su visto bueno.
3. **Corregir el detector de saltos** y unificar el cálculo de veredictos entre el motor y el navegador (hallazgos 1 y 2).
4. **Escribir el script de la simulación Monte Carlo** para poder reproducir el 49 % → 8,2 %.
5. **Video del demo** (30 s) o 7 diapositivas, y rellenar los campos vacíos del formulario de NASA.
6. **Más ciudades** en el modelo de crecimiento (solo está Managua).
7. **Validación independiente** (ERA5, GPM o estaciones de INETER).
8. **Terminar el interruptor Gráfica ⇄ Tabla** (rama `wip-interruptor-vista`) y darle una gráfica propia al Radar.
9. **Sección de créditos y privacidad** visible en la web, y datos del mapa sin conexión.

---

# 11. Cómo ejecutarlo

**Web (Datexv2)**
```
npm install
npm run dev
```
Se abre en `http://localhost:5173`. Para ver el crecimiento: Planeta → Ver la ciudad en 3D, o el caso «¿Se está calentando Managua?» → pestaña **Satélite**, hasta abajo.

**Regenerar el crecimiento de una ciudad** (carpeta `modelo/` del zip, requiere el repositorio `NasaSpaceapp`):
```
cd backend
uv sync --extra geo
PYTHONPATH=. uv run python -u scripts/build_city_growth.py managua
```

---

# 12. Lo que no se verificó

- Aspecto del 3D con una **GPU real** y en navegadores reales: todas las pruebas se hicieron con WebGL por software.
- El fondo del mapa necesita internet (teselas de Esri).
- El TypeScript de José no se ejecutó con Node; sus ejemplos salen de un port a Python.
- El botón «Girar la vista» solo se comprobó que existe.
- Hay una capa blanca de crecimiento vertical que, con exageración alta, puede cubrir casi todo lo existente; conviene revisarla a ojo.
