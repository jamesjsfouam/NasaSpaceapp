"""API del Detective de tendencias del sistema Tierra. Arranque: uv run uvicorn app.main:app --reload"""

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.catalog import (
    COUNTRIES,
    DATA_NOTE,
    DEMOS,
    INDICATOR_BY_KEY,
    INDICATORS,
    REGION_BY_ID,
    REGIONS,
    THEMES,
    VARIABLE_BY_KEY,
    VARIABLES,
    Demo,
    Indicator,
    Region,
    Variable,
)
from app.config import get_settings
from app.services import meteomatics, power, relate, trends, worldbank

settings = get_settings()
app = FastAPI(title="Detective de tendencias del sistema Tierra", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Catalog(BaseModel):
    themes: dict[str, str]
    variables: list[Variable]
    regions: list[Region]
    demos: list[Demo]
    first_year: int
    last_year: int
    data_note: str
    indicators: list[Indicator]
    countries: dict[str, str]


class TrendResponse(BaseModel):
    source: str  # nasa-power | muestra-local
    lat: float
    lon: float
    result: trends.TrendResult


class ScanResponse(BaseModel):
    source: str
    lat: float
    lon: float
    results: list[trends.TrendResult]


class RegionTrend(BaseModel):
    region: Region
    source: str
    result: trends.TrendResult | None
    error: str | None = None


def _check_period(start: int, end: int) -> None:
    if start < power.FIRST_YEAR or end > power.last_full_year() or end <= start:
        raise HTTPException(
            422, f"El periodo debe estar entre {power.FIRST_YEAR} y {power.last_full_year()}"
        )
    if end - start + 1 < trends.MIN_YEARS:
        raise HTTPException(422, f"Se necesitan al menos {trends.MIN_YEARS} años de datos")


def _variable(key: str) -> Variable:
    variable = VARIABLE_BY_KEY.get(key.upper())
    if variable is None:
        raise HTTPException(404, f"Variable desconocida: {key}")
    return variable


async def _monthly(lat: float, lon: float) -> tuple[dict, str]:
    try:
        return await power.get_monthly(lat, lon)
    except power.PowerUnavailable as exc:
        raise HTTPException(502, str(exc)) from exc


Lat = Query(ge=-90, le=90, description="Latitud en grados")
Lon = Query(ge=-180, le=180, description="Longitud en grados")


@app.get("/api/health")
def server_health() -> dict:
    """Estado del servidor y qué integraciones opcionales tienen claves configuradas."""
    return {
        "status": "ok",
        "integrations": {
            "nasa_power": True,  # no requiere clave
            "meteomatics": bool(settings.meteomatics_username),
            "earthdata": bool(settings.earthdata_username),
            "firebase": bool(settings.firebase_project_id),
        },
    }


@app.get("/api/catalog")
def catalog() -> Catalog:
    """Variables, temas, regiones de ejemplo y demostraciones para la interfaz."""
    return Catalog(
        themes=THEMES,
        variables=VARIABLES,
        regions=REGIONS,
        demos=DEMOS,
        first_year=power.FIRST_YEAR,
        last_year=power.last_full_year(),
        data_note=DATA_NOTE,
        indicators=INDICATORS,
        countries=COUNTRIES,
    )


@app.get("/api/trend")
async def trend(
    variable: str,
    lat: float = Lat,
    lon: float = Lon,
    start: int = 1990,
    end: int = Query(default_factory=power.last_full_year),
) -> TrendResponse:
    """Serie temporal y análisis de tendencia de una variable en un punto."""
    _check_period(start, end)
    var = _variable(variable)
    monthly, source = await _monthly(lat, lon)
    try:
        result = trends.analyze(var, monthly[var.key], start, end)
    except (trends.InsufficientData, KeyError) as exc:
        raise HTTPException(422, str(exc)) from exc
    return TrendResponse(source=source, lat=lat, lon=lon, result=result)


@app.get("/api/scan")
async def scan(
    lat: float = Lat,
    lon: float = Lon,
    start: int = 1990,
    end: int = Query(default_factory=power.last_full_year),
) -> ScanResponse:
    """Analiza todas las variables de un punto y las ordena por evidencia de tendencia."""
    _check_period(start, end)
    monthly, source = await _monthly(lat, lon)
    return ScanResponse(
        source=source, lat=lat, lon=lon, results=trends.scan(monthly, start, end)
    )


@app.get("/api/compare")
async def compare(
    variable: str,
    start: int = 1990,
    end: int = Query(default_factory=power.last_full_year),
) -> list[RegionTrend]:
    """Misma variable en todas las regiones de ejemplo: ¿la tendencia es igual en todas partes?"""
    _check_period(start, end)
    var = _variable(variable)
    out = []
    for region in REGIONS:
        try:
            monthly, source = await power.get_monthly(region.lat, region.lon)
            result = trends.analyze(var, monthly[var.key], start, end, include_series=False)
            out.append(RegionTrend(region=region, source=source, result=result))
        except (power.PowerUnavailable, trends.InsufficientData, KeyError) as exc:
            out.append(RegionTrend(region=region, source="", result=None, error=str(exc)))
    return out


class RelateResponse(BaseModel):
    earth_source: str
    indicator_source: str
    country: str
    country_label: str
    indicator: Indicator
    indicator_trend: trends.TrendResult | None
    relation: relate.Relation


@app.get("/api/relate")
async def relate_endpoint(
    variable: str,
    indicator: str,
    country: str,
    lat: float = Lat,
    lon: float = Lon,
    place: str = "",
    start: int = 1990,
    end: int = Query(default_factory=power.last_full_year),
) -> RelateResponse:
    """Relación año a año entre una variable de la Tierra y un indicador socioeconómico del país."""
    _check_period(start, end)
    var = _variable(variable)
    ind = INDICATOR_BY_KEY.get(indicator)
    if ind is None:
        raise HTTPException(404, f"Indicador desconocido: {indicator}")
    country = country.upper()
    if country not in COUNTRIES:
        raise HTTPException(404, f"País no disponible: {country}")

    monthly, earth_source = await _monthly(lat, lon)
    earth = trends.annual_means(monthly.get(var.key, {}), start, end)
    try:
        raw, ind_source = await worldbank.get_indicator(country, ind.key)
    except worldbank.WorldBankUnavailable as exc:
        raise HTTPException(502, str(exc)) from exc
    series = {y: v for y, v in raw.items() if start <= y <= end}

    as_variable = Variable(key=ind.key, label=ind.label, unit=ind.unit, theme="society",
                           definition=ind.definition, ratio_scale=ind.ratio_scale)
    try:
        ind_trend = trends.analyze_annual(as_variable, list(series), list(series.values()), False)
    except trends.InsufficientData:
        ind_trend = None
    try:
        relation = relate.relate(var.label, earth, ind.label, series,
                                 place or f"{lat:.2f}, {lon:.2f}", COUNTRIES[country])
    except relate.InsufficientOverlap as exc:
        raise HTTPException(422, str(exc)) from exc
    return RelateResponse(
        earth_source=earth_source,
        indicator_source=ind_source,
        country=country,
        country_label=COUNTRIES[country],
        indicator=ind,
        indicator_trend=ind_trend,
        relation=relation,
    )


@app.get("/api/regions/{region_id}")
def region(region_id: str) -> Region:
    if region_id not in REGION_BY_ID:
        raise HTTPException(404, "Región desconocida")
    return REGION_BY_ID[region_id]


@app.get("/api/weather")
async def weather(lat: float, lon: float, parameters: str = "t_2m:C,uv:idx") -> dict:
    """Tiempo actual con Meteomatics (opcional, requiere claves en .env)."""
    try:
        return await meteomatics.query(lat, lon, parameters.split(","))
    except meteomatics.MeteomaticsNotConfigured as exc:
        raise HTTPException(503, str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Meteomatics no respondió") from exc


