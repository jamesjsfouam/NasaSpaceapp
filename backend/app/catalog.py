"""Catálogo de variables, temas y regiones de ejemplo.

Todas las variables vienen de NASA POWER (https://power.larc.nasa.gov), que reúne salidas del
modelo de reanálisis MERRA-2 y observaciones de CERES. Las definiciones están pensadas para
estudiantes: qué mide la variable y qué significaría que suba o baje.
"""
from pydantic import BaseModel


class Variable(BaseModel):
    key: str  # código del parámetro en NASA POWER o variable derivada
    label: str
    unit: str
    theme: str
    definition: str
    ratio_scale: bool  # True si el cero es significativo (permite hablar de % de cambio)
    source: str = "MERRA-2 (NASA POWER)"
    reliability: str = "Reanálisis: modelo + observaciones. Contrasta con otra fuente antes de concluir."
    derived: bool = False


class Region(BaseModel):
    id: str
    label: str
    biome: str
    lat: float
    lon: float
    country: str | None = None  # ISO3 del país para los indicadores socioeconómicos


class Demo(BaseModel):
    title: str
    why: str
    region: str
    variable: str


THEMES: dict[str, str] = {
    "temperature": "Temperatura",
    "water": "Lluvia y agua",
    "soil": "Suelo y agricultura",
    "humidity": "Humedad y nubes",
    "sun": "Energía solar",
    "wind": "Viento y presión",
}

VARIABLES: list[Variable] = [
    Variable(key="T2M", label="Temperatura del aire (media)", unit="°C", theme="temperature",
             ratio_scale=False,
             definition="Temperatura promedio del aire a 2 m del suelo, la que sentimos en el día a día.",
             source="MERRA-2 (NASA POWER)",
             reliability="Fiable para tendencias de largo plazo; es una celda de ~50 km, no una estación. Contraste posible: AIRS."),
    Variable(key="T2M_MAX", label="Temperatura máxima diaria", unit="°C", theme="temperature",
             ratio_scale=False,
             definition="Promedio de la temperatura más alta de cada día. Sube con las olas de calor.",
             source="MERRA-2 (NASA POWER)",
             reliability="Los extremos diarios del reanálisis son menos fiables que la media."),
    Variable(key="T2M_MIN", label="Temperatura mínima diaria", unit="°C", theme="temperature",
             ratio_scale=False,
             definition="Promedio de la temperatura más baja de cada día (las noches).",
             source="MERRA-2 (NASA POWER)",
             reliability="Los extremos diarios del reanálisis son menos fiables que la media."),
    Variable(key="TS", label="Temperatura de la superficie", unit="°C", theme="temperature",
             ratio_scale=False,
             definition="Temperatura del suelo o del mar en la superficie, no la del aire.",
             source="MERRA-2 (NASA POWER)",
             reliability="Temperatura de la superficie modelada; MODIS la mide desde 2000 (solo con cielo despejado)."),
    Variable(key="PRECTOTCORR", label="Precipitación", unit="mm/día", theme="water",
             ratio_scale=True,
             definition="Lluvia (y nieve) promedio por día. 1 mm equivale a 1 litro por metro cuadrado.",
             source="MERRA-2 corregida (NASA POWER)",
             reliability="La lluvia del reanálisis puede tener saltos y tendencias falsas cuando cambian los satélites (hay uno conocido hacia 1987). Mejor contrastar con GPM IMERG."),
    Variable(key="EVLAND", label="Evaporación del suelo", unit="mm/día", theme="water",
             ratio_scale=True,
             definition="Agua que pasa del suelo al aire por día. Depende del calor y de cuánta agua hay.",
             source="MERRA-2 (NASA POWER)",
             reliability="Variable de modelo, depende de la lluvia del reanálisis: hereda sus saltos."),
    Variable(key="GWETROOT", label="Humedad del suelo (zona de raíces)", unit="0–1", theme="soil",
             ratio_scale=True,
             definition="Qué tan mojado está el suelo donde llegan las raíces: 0 seco, 1 saturado. Clave para los cultivos.",
             source="MERRA-2 (NASA POWER)",
             reliability="Humedad del suelo modelada; GLDAS o SMOS/SMAP sirven de contraste."),
    Variable(key="GWETTOP", label="Humedad del suelo (superficie)", unit="0–1", theme="soil",
             ratio_scale=True,
             definition="Qué tan mojado está el suelo en los primeros centímetros: 0 seco, 1 saturado.",
             source="MERRA-2 (NASA POWER)",
             reliability="Humedad del suelo modelada; SMOS/SMAP la miden desde el espacio desde 2010/2015."),
    Variable(key="RH2M", label="Humedad relativa del aire", unit="%", theme="humidity",
             ratio_scale=True,
             definition="Cuánta humedad tiene el aire respecto al máximo que podría contener a esa temperatura.",
             source="MERRA-2 (NASA POWER)",
             reliability="La humedad del reanálisis es sensible a cambios en los satélites asimilados."),
    Variable(key="T2MDEW", label="Punto de rocío", unit="°C", theme="humidity",
             ratio_scale=False,
             definition="Temperatura a la que el vapor del aire se condensa. Más alto significa aire más húmedo y pesado.",
             source="MERRA-2 (NASA POWER)",
             reliability="La humedad del reanálisis es sensible a cambios en los satélites asimilados."),
    Variable(key="CLOUD_AMT", label="Nubosidad", unit="%", theme="humidity",
             ratio_scale=True,
             definition="Porcentaje del cielo cubierto por nubes.",
             source="CERES / MERRA-2 (NASA POWER)",
             reliability="Las nubes son difíciles de medir de forma homogénea en el tiempo."),
    Variable(key="ALLSKY_SFC_SW_DWN", label="Radiación solar en superficie", unit="MJ/m²/día",
             theme="sun", ratio_scale=True,
             definition="Energía del Sol que llega al suelo por día. Es la que aprovechan los paneles solares y las plantas.",
             source="CERES (NASA POWER)",
             reliability="Registro largo basado en satélite; bueno para tendencias."),
    Variable(key="WS2M", label="Velocidad del viento", unit="m/s", theme="wind",
             ratio_scale=True,
             definition="Velocidad promedio del viento a 2 m del suelo.",
             source="MERRA-2 (NASA POWER)",
             reliability="El viento cerca del suelo depende mucho del terreno local."),
    Variable(key="PS", label="Presión atmosférica", unit="kPa", theme="wind",
             ratio_scale=True,
             definition="Peso del aire sobre la superficie. Cambia con las masas de aire y las tormentas.",
             source="MERRA-2 (NASA POWER)",
             reliability="Muy estable y bien observada."),
    Variable(key="VPD", label="Déficit de presión de vapor (VPD)", unit="kPa", theme="humidity",
             ratio_scale=True, derived=True,
             definition="Qué tan 'sediento' está el aire respecto a su saturación. Valores altos secan rápido las hojas y suelos.",
             source="Derivada de T2M y RH2M (MERRA-2 / NASA POWER)",
             reliability="Combina temperatura y humedad del reanálisis; muy sensible para estrés agrícola e incendios."),
    Variable(key="DTR", label="Rango térmico diurno (DTR)", unit="°C", theme="temperature",
             ratio_scale=True, derived=True,
             definition="Diferencia entre la temperatura máxima del día y la mínima de la noche (T2M_MAX − T2M_MIN).",
             source="Derivada de T2M_MAX y T2M_MIN (MERRA-2 / NASA POWER)",
             reliability="Cuando las noches se calientan más rápido que los días, el DTR disminuye."),
    Variable(key="WBGT", label="Estrés térmico húmedo (WBGT aprox.)", unit="°C", theme="temperature",
             ratio_scale=False, derived=True,
             definition="Índice compuesto de calor y humedad en sombra que refleja la carga térmica sobre el cuerpo humano.",
             source="Derivada de T2M y RH2M (fórmula BoM / MERRA-2)",
             reliability="Aproximación en sombra sin radiación solar directa ni viento local; útil para tendencias de riesgo térmico."),
]
VARIABLE_BY_KEY = {v.key: v for v in VARIABLES}

REGIONS: list[Region] = [
    Region(id="managua", label="Managua, Nicaragua", biome="Ciudad tropical", lat=12.13, lon=-86.25, country="NIC"),
    Region(id="corredor_seco", label="Corredor Seco (Somoto), Nicaragua", biome="Bosque seco tropical",
           lat=13.48, lon=-86.58, country="NIC"),
    Region(id="bluefields", label="Bluefields, Caribe de Nicaragua", biome="Selva húmeda y costa",
           lat=12.01, lon=-83.76, country="NIC"),
    Region(id="amazonas", label="Amazonía central (Manaos), Brasil", biome="Selva tropical",
           lat=-3.10, lon=-60.02, country="BRA"),
    Region(id="sahara", label="Sahara central, Argelia", biome="Desierto", lat=25.0, lon=10.0, country="DZA"),
    Region(id="artico", label="Svalbard, Ártico", biome="Ártico", lat=78.22, lon=15.65),
    Region(id="cdmx", label="Ciudad de México", biome="Gran ciudad de altura", lat=19.43, lon=-99.13, country="MEX"),
]
REGION_BY_ID = {r.id: r for r in REGIONS}

DEMOS: list[Demo] = [
    Demo(title="¿Se está calentando Managua?", region="managua", variable="T2M",
         why="La temperatura media es la variable más simple para empezar a investigar."),
    Demo(title="¿Se seca el suelo del Corredor Seco?", region="corredor_seco", variable="GWETROOT",
         why="La humedad en las raíces afecta directamente a los cultivos de la zona."),
    Demo(title="¿Cambia la lluvia en la Amazonía?", region="amazonas", variable="PRECTOTCORR",
         why="La lluvia es ruidosa año a año: sirve para ver por qué hace falta una prueba estadística."),
    Demo(title="¿El Ártico se calienta igual que el trópico?", region="artico", variable="T2M",
         why="Compara este resultado con el de Managua: la tendencia no es igual en todas partes."),
]

DATA_NOTE = (
    "Los datos vienen de NASA POWER, que usa el modelo de reanálisis MERRA-2 y observaciones de "
    "CERES. Un reanálisis mezcla un modelo con observaciones que cambian con los años (satélites "
    "nuevos, instrumentos distintos), así que una tendencia puede venir de esos cambios y no solo "
    "del clima, sobre todo en lluvia y humedad. Además, cada valor representa una celda de unos "
    "50 × 60 km, no una estación. Sirven para detectar patrones; confírmalos con otra fuente."
)


class Indicator(BaseModel):
    key: str  # código del Banco Mundial
    label: str
    unit: str
    definition: str
    suggested_variable: str  # variable de la Tierra con la que tiene sentido compararlo
    ratio_scale: bool = True


INDICATORS: list[Indicator] = [
    Indicator(key="AG.YLD.CREL.KG", label="Rendimiento de cereales", unit="kg/ha",
              suggested_variable="GWETROOT",
              definition="Kilos de cereal (maíz, arroz, trigo, sorgo…) cosechados por hectárea. "
                         "Baja en años de sequía o de exceso de lluvia."),
    Indicator(key="AG.PRD.CROP.XD", label="Índice de producción de cultivos", unit="índice",
              suggested_variable="PRECTOTCORR",
              definition="Cuánto se produce en cultivos agrícolas comparado con un periodo de referencia (= 100)."),
    Indicator(key="AG.PRD.FOOD.XD", label="Índice de producción de alimentos", unit="índice",
              suggested_variable="PRECTOTCORR",
              definition="Producción de alimentos (cultivos y ganado) comparada con un periodo de referencia (= 100)."),
    Indicator(key="NV.AGR.TOTL.ZS", label="Agricultura en la economía", unit="% del PIB",
              suggested_variable="PRECTOTCORR",
              definition="Parte de toda la producción del país que viene de la agricultura, la pesca y los bosques."),
    Indicator(key="SL.AGR.EMPL.ZS", label="Empleo en agricultura", unit="% del empleo",
              suggested_variable="T2M_MAX",
              definition="Porcentaje de trabajadores que trabajan en el campo. Es una estimación modelada (OIT)."),
    Indicator(key="SN.ITK.DEFC.ZS", label="Subalimentación", unit="% de la población",
              suggested_variable="GWETROOT",
              definition="Porcentaje de personas que no comen lo suficiente de forma habitual."),
    Indicator(key="SP.RUR.TOTL.ZS", label="Población rural", unit="% de la población",
              suggested_variable="T2M",
              definition="Porcentaje de la población que vive fuera de las ciudades."),
    Indicator(key="NY.GDP.PCAP.KD", label="PIB por persona", unit="US$ constantes",
              suggested_variable="T2M",
              definition="Producción económica promedio por habitante, sin el efecto de la inflación."),
    Indicator(key="EG.ELC.ACCS.ZS", label="Acceso a electricidad", unit="% de la población",
              suggested_variable="ALLSKY_SFC_SW_DWN",
              definition="Porcentaje de personas con acceso a electricidad en su vivienda."),
    Indicator(key="SP.POP.TOTL", label="Población", unit="habitantes",
              suggested_variable="T2M",
              definition="Número total de habitantes del país."),
]
INDICATOR_BY_KEY = {i.key: i for i in INDICATORS}

COUNTRIES: dict[str, str] = {
    "NIC": "Nicaragua",
    "HND": "Honduras",
    "SLV": "El Salvador",
    "GTM": "Guatemala",
    "CRI": "Costa Rica",
    "PAN": "Panamá",
    "MEX": "México",
    "COL": "Colombia",
    "BRA": "Brasil",
    "PER": "Perú",
    "DZA": "Argelia",
    "NER": "Níger",
}


# --- Recomendador por reglas (PDF, sección 3.2): de una preocupación y un tipo de lugar a
# --- tres variables como máximo. Es una tabla, no un modelo: predecible y sin conexión.

CONCERNS: dict[str, str] = {
    "heat": "Calor",
    "water": "Lluvia y agua",
    "drought": "Sequía y cultivos",
    "sun": "Sol y energía",
    "wind": "Viento y tormentas",
}

PLACE_TYPES: dict[str, str] = {
    "city": "Una ciudad",
    "farmland": "Zona agrícola",
    "forest": "Bosque o selva",
    "coast": "Costa",
    "dry": "Zona seca o desierto",
    "cold": "Montaña o zona fría",
}

_RULES: dict[str, list[str]] = {
    "heat": ["T2M", "T2M_MAX", "T2M_MIN"],
    "water": ["PRECTOTCORR", "GWETROOT", "EVLAND"],
    "drought": ["GWETROOT", "PRECTOTCORR", "T2M_MAX"],
    "sun": ["ALLSKY_SFC_SW_DWN", "CLOUD_AMT", "T2M"],
    "wind": ["WS2M", "PS", "PRECTOTCORR"],
}
_PLACE_TWEAKS: dict[tuple[str, str], list[str]] = {
    ("heat", "city"): ["T2M_MIN", "DTR", "WBGT"],  # noches cálidas, DTR y estrés térmico
    ("heat", "cold"): ["T2M", "TS", "T2M_MIN"],
    ("heat", "coast"): ["WBGT", "T2M", "RH2M"],  # calor húmedo
    ("water", "dry"): ["PRECTOTCORR", "GWETTOP", "VPD"],
    ("water", "forest"): ["PRECTOTCORR", "EVLAND", "RH2M"],
    ("drought", "farmland"): ["GWETROOT", "VPD", "PRECTOTCORR"],
    ("drought", "dry"): ["GWETTOP", "VPD", "T2M_MAX"],
    ("wind", "coast"): ["WS2M", "PS", "PRECTOTCORR"],
}


def recommend(concern: str, place_type: str | None) -> list[str]:
    keys = _PLACE_TWEAKS.get((concern, place_type or ""), _RULES.get(concern, []))
    return [k for k in keys if k in VARIABLE_BY_KEY][:3]
