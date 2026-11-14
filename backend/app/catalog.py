"""Catálogo de variables, temas y regiones de ejemplo.

Todas las variables vienen de NASA POWER (https://power.larc.nasa.gov), que reúne salidas del
modelo de reanálisis MERRA-2 y observaciones de CERES. Las definiciones están pensadas para
estudiantes: qué mide la variable y qué significaría que suba o baje.
"""
from pydantic import BaseModel


class Variable(BaseModel):
    key: str  # código del parámetro en NASA POWER
    label: str
    unit: str
    theme: str
    definition: str
    ratio_scale: bool  # True si el cero es significativo (permite hablar de % de cambio)


class Region(BaseModel):
    id: str
    label: str
    biome: str
    lat: float
    lon: float


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
             definition="Temperatura promedio del aire a 2 m del suelo, la que sentimos en el día a día."),
    Variable(key="T2M_MAX", label="Temperatura máxima diaria", unit="°C", theme="temperature",
             ratio_scale=False,
             definition="Promedio de la temperatura más alta de cada día. Sube con las olas de calor."),
    Variable(key="T2M_MIN", label="Temperatura mínima diaria", unit="°C", theme="temperature",
             ratio_scale=False,
             definition="Promedio de la temperatura más baja de cada día (las noches)."),
    Variable(key="TS", label="Temperatura de la superficie", unit="°C", theme="temperature",
             ratio_scale=False,
             definition="Temperatura del suelo o del mar en la superficie, no la del aire."),
    Variable(key="PRECTOTCORR", label="Precipitación", unit="mm/día", theme="water",
             ratio_scale=True,
             definition="Lluvia (y nieve) promedio por día. 1 mm equivale a 1 litro por metro cuadrado."),
    Variable(key="EVLAND", label="Evaporación del suelo", unit="mm/día", theme="water",
             ratio_scale=True,
             definition="Agua que pasa del suelo al aire por día. Depende del calor y de cuánta agua hay."),
    Variable(key="GWETROOT", label="Humedad del suelo (zona de raíces)", unit="0–1", theme="soil",
             ratio_scale=True,
             definition="Qué tan mojado está el suelo donde llegan las raíces: 0 seco, 1 saturado. Clave para los cultivos."),
    Variable(key="GWETTOP", label="Humedad del suelo (superficie)", unit="0–1", theme="soil",
             ratio_scale=True,
             definition="Qué tan mojado está el suelo en los primeros centímetros: 0 seco, 1 saturado."),
    Variable(key="RH2M", label="Humedad relativa del aire", unit="%", theme="humidity",
             ratio_scale=True,
             definition="Cuánta humedad tiene el aire respecto al máximo que podría contener a esa temperatura."),
    Variable(key="T2MDEW", label="Punto de rocío", unit="°C", theme="humidity",
             ratio_scale=False,
             definition="Temperatura a la que el vapor del aire se condensa. Más alto significa aire más húmedo y pesado."),
    Variable(key="CLOUD_AMT", label="Nubosidad", unit="%", theme="humidity",
             ratio_scale=True,
             definition="Porcentaje del cielo cubierto por nubes."),
    Variable(key="ALLSKY_SFC_SW_DWN", label="Radiación solar en superficie", unit="MJ/m²/día",
             theme="sun", ratio_scale=True,
             definition="Energía del Sol que llega al suelo por día. Es la que aprovechan los paneles solares y las plantas."),
    Variable(key="WS2M", label="Velocidad del viento", unit="m/s", theme="wind",
             ratio_scale=True,
             definition="Velocidad promedio del viento a 2 m del suelo."),
    Variable(key="PS", label="Presión atmosférica", unit="kPa", theme="wind",
             ratio_scale=True,
             definition="Peso del aire sobre la superficie. Cambia con las masas de aire y las tormentas."),
]
VARIABLE_BY_KEY = {v.key: v for v in VARIABLES}

REGIONS: list[Region] = [
    Region(id="managua", label="Managua, Nicaragua", biome="Ciudad tropical", lat=12.13, lon=-86.25),
    Region(id="corredor_seco", label="Corredor Seco (Somoto), Nicaragua", biome="Bosque seco tropical",
           lat=13.48, lon=-86.58),
    Region(id="bluefields", label="Bluefields, Caribe de Nicaragua", biome="Selva húmeda y costa",
           lat=12.01, lon=-83.76),
    Region(id="amazonas", label="Amazonía central (Manaos), Brasil", biome="Selva tropical",
           lat=-3.10, lon=-60.02),
    Region(id="sahara", label="Sahara central, Argelia", biome="Desierto", lat=25.0, lon=10.0),
    Region(id="artico", label="Svalbard, Ártico", biome="Ártico", lat=78.22, lon=15.65),
    Region(id="cdmx", label="Ciudad de México", biome="Gran ciudad de altura", lat=19.43, lon=-99.13),
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
