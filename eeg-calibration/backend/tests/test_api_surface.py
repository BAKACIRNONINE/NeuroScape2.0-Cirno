import mimetypes

from fastapi.testclient import TestClient

from app import config
from app.main import app


def test_protocol_v4_api_surface_replaces_two_phase_api():
    paths = app.openapi()["paths"]
    expected = {
        "/api/calibration/acclimation/start",
        "/api/calibration/acclimation/end-early",
        "/api/calibration/acclimation/accept",
        "/api/calibration/acclimation/repeat",
        "/api/calibration/block/start",
        "/api/calibration/block/end-early",
        "/api/calibration/self-report",
    }
    assert expected <= paths.keys()
    assert "/api/calibration/relaxation/start" not in paths
    assert "/api/calibration/focus/start" not in paths


def test_removed_runtime_api_is_not_exposed():
    response = TestClient(app).get("/api/runtime/status")
    assert response.status_code == 404
    assert response.json()["detail"].startswith("API endpoint not found")


def test_javascript_modules_have_browser_compatible_mime_type():
    assert mimetypes.guess_type("frontend-bundle.js")[0] == "application/javascript"
    assets = config.FRONTEND_DIST / "assets"
    if assets.exists():
        bundle = next(assets.glob("*.js"))
        response = TestClient(app).get(f"/assets/{bundle.name}")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/javascript")
