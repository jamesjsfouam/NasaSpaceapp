"""IA integrada (Claude), con límites claros y un plan B sin IA.

Dos usos, siguiendo el análisis del reto (docs/RETO.md):

1. **De la pregunta al catálogo:** convierte una pregunta libre ("¿se está secando mi pueblo?")
   en una preocupación y un tipo de lugar del catálogo, con salida JSON restringida a esos
   valores. Las variables las elige después el recomendador por reglas.
2. **Explicar un resultado:** recibe solo las cifras que ya calculó el motor estadístico y las
   explica en lenguaje llano: qué muestran, por qué *podría* estar pasando (como hipótesis) y
   cómo se vería el escenario futuro. Tiene prohibido inventar cifras o afirmar causas.

Sin ANTHROPIC_API_KEY en .env, o si el servicio falla, se usan reglas por palabras clave y
plantillas fijas: la herramienta funciona igual, solo que sin la explicación narrada.
"""
from __future__ import annotations

import json
import unicodedata

import anthropic
from pydantic import BaseModel

from app.catalog import CONCERNS, PLACE_TYPES
from app.config import get_settings

MODEL = "claude-opus-5-5"
FALLBACK_BETA = "server-side-fallback-2026-07-01"
API_URL = "https://api.anthropic.com"


class Interpretation(BaseModel):
    concern: str
    place_type: str | None
    place_query: str | None  # lugar mencionado en la pregunta, para buscarlo
    source: str  # "claude" | "reglas"


class Explanation(BaseModel):
    text: str
    source: str  # "claude" | "plantilla"
    note: str | None = None


def client() -> anthropic.AsyncAnthropic | None:
    key = get_settings().anthropic_api_key
    if not key:
        return None
    return anthropic.AsyncAnthropic(api_key=key, base_url=API_URL, timeout=90.0, max_retries=2)


def _first_text(response) -> str:
    return next((b.text for b in response.content if b.type == "text"), "")


# --- 1. de la pregunta al catálogo -------------------------------------------------------------

_KEYWORDS = {
    "heat": ["calor", "caliente", "temperatura", "calentando", "calienta", "ola de calor", "heat", "hot", "warm"],
    "drought": ["sequia", "seca", "secando", "cultivo", "cosecha", "maiz", "frijol", "suelo", "drought", "crop"],
    "water": ["lluvia", "llueve", "llover", "agua", "inundacion", "rio", "humedad", "rain", "flood", "water"],
    "sun": ["sol", "solar", "radiacion", "panel", "nube", "nublado", "energia", "sun", "cloud"],
    "wind": ["viento", "tormenta", "huracan", "presion", "wind", "storm", "hurricane"],
}
_PLACE_WORDS = {
    "city": ["ciudad", "urbano", "barrio", "capital", "city"],
    "farmland": ["campo", "finca", "cultivo", "cosecha", "agricola", "farm"],
    "forest": ["bosque", "selva", "jungla", "forest", "rainforest"],
    "coast": ["costa", "playa", "mar", "puerto", "coast", "beach"],
    "dry": ["desierto", "arido", "corredor seco", "desert"],
    "cold": ["montana", "volcan", "glaciar", "frio", "nieve", "artico", "mountain", "snow"],
}


def _plain(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")


def interpret_with_rules(question: str) -> Interpretation:
    q = _plain(question)
    scores = {k: sum(w in q for w in words) for k, words in _KEYWORDS.items()}
    concern = max(scores, key=scores.get) if any(scores.values()) else "heat"
    place = next((k for k, words in _PLACE_WORDS.items() if any(w in q for w in words)), None)
    return Interpretation(concern=concern, place_type=place, place_query=None, source="reglas")


_INTERPRET_SCHEMA = {
    "type": "object",
    "properties": {
        "concern": {"type": "string", "enum": list(CONCERNS)},
        "place_type": {"type": "string", "enum": [*PLACE_TYPES, "unknown"]},
        "place_query": {"type": "string"},
    },
    "required": ["concern", "place_type", "place_query"],
    "additionalProperties": False,
}

_INTERPRET_SYSTEM = (
    "Clasificas preguntas de estudiantes sobre cambios en el ambiente de un lugar. "
    "Devuelve: concern (la preocupación principal entre las opciones), place_type (tipo de lugar "
    "si se deduce de la pregunta, o 'unknown') y place_query (el nombre del lugar mencionado, tal "
    "como lo escribiría alguien en un buscador de mapas, o cadena vacía si no menciona ninguno). "
    "Opciones de concern: " + ", ".join(f"{k} = {v}" for k, v in CONCERNS.items()) + ". "
    "Opciones de place_type: " + ", ".join(f"{k} = {v}" for k, v in PLACE_TYPES.items()) + "."
)


async def interpret(question: str) -> Interpretation:
    c = client()
    if c is None:
        return interpret_with_rules(question)
    try:
        response = await c.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": _INTERPRET_SCHEMA}},
            system=_INTERPRET_SYSTEM,
            messages=[{"role": "user", "content": question}],
        )
        if response.stop_reason == "refusal":
            return interpret_with_rules(question)
        data = json.loads(_first_text(response))
    except (anthropic.APIError, json.JSONDecodeError, StopIteration):
        return interpret_with_rules(question)
    place_type = data.get("place_type")
    return Interpretation(
        concern=data["concern"] if data.get("concern") in CONCERNS else "heat",
        place_type=place_type if place_type in PLACE_TYPES else None,
        place_query=(data.get("place_query") or "").strip() or None,
        source="claude",
    )


# --- 2. explicar un resultado ------------------------------------------------------------------

_EXPLAIN_SYSTEM = """Eres un divulgador científico que explica resultados de una herramienta de \
NASA Space Apps a estudiantes de secundaria y universidad, en español claro.

Recibes un JSON con resultados YA calculados por un motor estadístico (tendencias, pruebas de \
significancia, escenarios futuros, datos de satélite o demográficos). Escribe una explicación de \
150 a 250 palabras con estas cuatro partes, cada una con un subtítulo corto en negrita:

1. **Qué muestran los datos**: el veredicto y las cifras clave, tal como vienen.
2. **Por qué podría estar pasando**: 2 o 3 procesos físicos o sociales plausibles para ese lugar \
y esa variable, presentados como hipótesis ("podría deberse a", "una explicación posible es"). \
Nunca como hechos comprobados: la herramienta mide cambios, no causas.
3. **Cómo podría verse en el futuro**: describe el escenario que viene en los datos (valor e \
intervalo) y qué significaría en la vida diaria. Aclara que es un escenario si el ritmo actual \
continuara, no una predicción.
4. **Con qué cautela leerlo**: los avisos que vengan en los datos (fiabilidad de la fuente, \
autocorrelación, saltos, escala) en una o dos frases.

Reglas estrictas:
- Usa solo cifras que aparezcan en el JSON. No inventes números, fechas, estudios ni fuentes.
- Si el veredicto es "not_yet" o "no_trend", no hables como si hubiera una tendencia confirmada.
- No des consejos médicos, legales ni de inversión.
- Formato: texto con los cuatro subtítulos en negrita, sin listas largas ni encabezados #."""


def explain_with_template(facts: dict) -> Explanation:
    parts = [facts.get("interpretation") or ""]
    fc = facts.get("forecast_text")
    if fc:
        parts.append(f"**Escenario:** {fc}")
    for w in facts.get("warnings", [])[:4]:
        parts.append(f"**Cautela:** {w}")
    if facts.get("reliability"):
        parts.append(f"**Fiabilidad de la fuente:** {facts['reliability']}")
    parts.append(
        "La herramienta mide cuánto cambia y si es significativo; no puede decir por qué. "
        "Para investigar las causas, contrasta con otras variables y fuentes."
    )
    return Explanation(text="\n\n".join(p for p in parts if p), source="plantilla",
                       note="Explicación automática sin IA (configura ANTHROPIC_API_KEY para la narrada).")


async def explain(facts: dict) -> Explanation:
    c = client()
    if c is None:
        return explain_with_template(facts)
    try:
        response = await c.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            output_config={"effort": "low"},
            system=_EXPLAIN_SYSTEM,
            messages=[{"role": "user", "content": json.dumps(facts, ensure_ascii=False)}],
        )
    except anthropic.APIError:
        out = explain_with_template(facts)
        out.note = "El servicio de IA no respondió; se muestra la explicación automática."
        return out
    text = _first_text(response).strip()
    if response.stop_reason == "refusal" or not text:
        out = explain_with_template(facts)
        out.note = "La IA no generó una explicación; se muestra la automática."
        return out
    note = "Generado con IA a partir de las cifras del análisis. Las causas son hipótesis, no hechos."
    if response.stop_reason == "max_tokens":
        note += " (Texto recortado.)"
    return Explanation(text=text, source="claude", note=note)
