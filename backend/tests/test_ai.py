import types

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import ai, power

client = TestClient(app)


@pytest.fixture(autouse=True)
def no_key_and_offline(monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "anthropic_api_key", "")

    async def boom(*_a, **_k):
        import httpx
        raise httpx.ConnectError("sin red")

    monkeypatch.setattr(power, "_fetch_live", boom)
    power._cache.clear()


@pytest.mark.parametrize("question,concern,place", [
    ("¿Se está secando el suelo de mi finca?", "drought", "farmland"),
    ("¿Hace más calor en mi ciudad que antes?", "heat", "city"),
    ("¿Llueve menos en la selva?", "water", "forest"),
    ("¿Hay más viento en la costa?", "wind", "coast"),
])
def test_rules_interpret_questions_without_ai(question, concern, place):
    r = ai.interpret_with_rules(question)
    assert (r.concern, r.place_type, r.source) == (concern, place, "reglas")


def test_ask_endpoint_without_key_uses_rules_and_recommender():
    r = client.post("/api/ask", json={"question": "¿hace más calor en la ciudad?"}).json()
    assert r["interpretation"]["source"] == "reglas"
    assert [v["key"] for v in r["variables"]] == ["T2M_MIN", "DTR", "WBGT"]


def test_explain_without_key_uses_template_with_engine_numbers():
    r = client.post("/api/explain", json={"kind": "trend", "variable": "T2M", "lat": 78.22, "lon": 15.65,
                                          "to_year": 2040}).json()
    assert r["source"] == "plantilla"
    assert "Escenario" in r["text"] and "no puede decir por qué" in r["text"]


def test_explain_supports_english_template_and_prompt():
    r = client.post("/api/explain", json={"kind": "trend", "variable": "T2M", "lat": 78.22, "lon": 15.65,
                                          "to_year": 2040, "lang": "en"}).json()
    assert r["source"] == "plantilla"
    assert "Scenario:" in r["text"] and "cannot prove why" in r["text"]


def test_explain_validates_kind_and_required_params():
    assert client.post("/api/explain", json={"kind": "nope"}).status_code == 422
    assert client.post("/api/explain", json={"kind": "trend", "lat": 1, "lon": 1}).status_code == 422


class FakeMessages:
    def __init__(self, response=None, error=None):
        self.response, self.error, self.calls = response, error, []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.response


def _fake_client(messages):
    return types.SimpleNamespace(beta=types.SimpleNamespace(messages=messages))


def _response(text, stop="end_turn"):
    return types.SimpleNamespace(stop_reason=stop, content=[types.SimpleNamespace(type="text", text=text)])


async def test_explain_with_claude_sends_only_facts_and_uses_fallbacks(monkeypatch):
    msgs = FakeMessages(_response("**Qué muestran los datos** ..."))
    monkeypatch.setattr(ai, "client", lambda: _fake_client(msgs))
    out = await ai.explain({"interpretation": "x", "slope_per_decade": 0.7})
    assert out.source == "claude" and "hipótesis" in out.note
    call = msgs.calls[0]
    assert call["model"] == "claude-opus-5-5" and call["fallbacks"] == "default"
    assert '"slope_per_decade": 0.7' in call["messages"][0]["content"]


async def test_explain_falls_back_on_refusal_and_on_api_error(monkeypatch):
    monkeypatch.setattr(ai, "client", lambda: _fake_client(FakeMessages(_response("", "refusal"))))
    assert (await ai.explain({"interpretation": "x"})).source == "plantilla"
    import anthropic
    import httpx
    err = anthropic.APIConnectionError(request=httpx.Request("POST", "https://api.anthropic.com"))
    monkeypatch.setattr(ai, "client", lambda: _fake_client(FakeMessages(error=err)))
    out = await ai.explain({"interpretation": "x"})
    assert out.source == "plantilla" and "no respondió" in out.note


async def test_interpret_with_claude_is_restricted_to_catalog(monkeypatch):
    msgs = FakeMessages(_response('{"concern": "drought", "place_type": "farmland", "place_query": "Estelí"}'))
    monkeypatch.setattr(ai, "client", lambda: _fake_client(msgs))
    out = await ai.interpret("¿se seca Estelí?")
    assert (out.concern, out.place_type, out.place_query, out.source) == ("drought", "farmland", "Estelí", "claude")
    schema = msgs.calls[0]["output_config"]["format"]["schema"]
    assert set(schema["properties"]["concern"]["enum"]) == {"heat", "water", "drought", "sun", "wind"}
