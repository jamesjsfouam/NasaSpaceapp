from app.services import demography, places, satellite


def test_owid_csv_parsing_keeps_countries_and_projection():
    text = (
        "entity,code,year,est,proj__projected\n"
        "Nicaragua,NIC,2022,6.8,\n"
        "Nicaragua,NIC,2023,6.9,\n"
        "Nicaragua,NIC,2024,,7.0\n"
        "World,OWID_WRL,2023,8000,\n"
        "Japan,JPN,2023,124,\n"
    )
    table = demography.parse_owid_csv(text)
    assert set(table) == {"NIC", "JPN"}  # las regiones sin ISO3 se descartan
    est, proj = table["NIC"]
    assert est == {2022: 6.8, 2023: 6.9} and proj == {2024: 7.0}


def test_country_names_and_codes():
    assert places.iso3_from_iso2("ni") == "NIC"
    assert places.country_name("BRA") == "Brasil"
    assert places.country_name("ZZZ") is None


def test_bbox_and_area():
    bbox = satellite.bbox_around(0.0, 0.0, 10)
    assert abs(satellite.area_km2(bbox) - 400) < 5
    high = satellite.bbox_around(70.0, 20.0, 10)
    assert abs(satellite.area_km2(high) - 400) < 10  # la longitud se ensancha con la latitud


def test_scene_choice_by_year():
    assert satellite._scene_query(2020)[0] == "sentinel-2-l2a"
    assert satellite._scene_query(1995)[1]["platform"]["in"] == ["landsat-5", "landsat-7"]
    assert satellite._scene_query(2008)[1]["platform"]["in"] == ["landsat-5"]  # sin Landsat 7 con franjas
    assert satellite._scene_query(2014)[1]["platform"]["in"] == ["landsat-8", "landsat-9"]


def test_place_type_from_land_cover():
    assert satellite.suggest_place_type({"Zona construida": 50}, 12) == "city"
    assert satellite.suggest_place_type({"Cultivos": 60}, 12) == "farmland"
    assert satellite.suggest_place_type({"Árboles": 80}, -3) == "forest"
    assert satellite.suggest_place_type({"Árboles": 80}, 70) == "cold"
