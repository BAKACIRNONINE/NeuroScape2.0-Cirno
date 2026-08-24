from __future__ import annotations

import asyncio
import mimetypes
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app import config
from app.calibration.machine import InvalidTransition
from app.calibration.service import CalibrationService
from app.models.schemas import CalibrationStart, SelfReportSubmit, SessionCreate
from app.signal_processing.core import (
    INCOMPATIBLE_PROFILE_MESSAGE,
    IncompatibleCalibrationProfile,
    validate_calibration_profile,
)

service = CalibrationService()

mimetypes.add_type("application/javascript", ".js", strict=True)
mimetypes.add_type("application/javascript", ".mjs", strict=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    service.start_services()
    yield
    service.shutdown()


app = FastAPI(title="NeuroScape Calibration", version="4.0.0", lifespan=lifespan)


@app.exception_handler(InvalidTransition)
async def invalid_transition_handler(_, exc: InvalidTransition):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "osc_port": config.OSC_PORT, "data_local": True}


@app.post("/api/session/create")
def create_session(payload: SessionCreate) -> dict:
    return service.create_session(payload.participant_id)


@app.post("/api/connection/test")
async def test_connection() -> dict:
    return await service.connection_test()


@app.post("/api/calibration/acclimation/start")
def start_acclimation(payload: CalibrationStart = CalibrationStart()) -> dict:
    try:
        return service.start_acclimation(payload.quality_override).model_dump()
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/api/calibration/acclimation/end-early")
def end_acclimation_early() -> dict:
    return service.end_acclimation_early().model_dump()


@app.post("/api/calibration/acclimation/accept")
def accept_acclimation() -> dict:
    try:
        return service.accept_acclimation().model_dump()
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/api/calibration/acclimation/repeat")
def repeat_acclimation(payload: CalibrationStart = CalibrationStart()) -> dict:
    try:
        return service.repeat_acclimation(payload.quality_override).model_dump()
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/api/calibration/block/start")
def start_block(payload: CalibrationStart = CalibrationStart()) -> dict:
    try:
        return service.start_block(payload.quality_override).model_dump()
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/api/calibration/block/end-early")
def end_block_early() -> dict:
    return service.end_block_early().model_dump()


@app.post("/api/calibration/self-report")
def submit_self_report(payload: SelfReportSubmit) -> dict:
    return service.submit_self_report(payload)


@app.post("/api/calibration/reset")
def reset_calibration() -> dict:
    service.reset()
    return {"state": "IDLE"}


@app.get("/api/status")
def status() -> dict:
    return service.status()


@app.get("/api/calibration/result")
def result() -> dict:
    try:
        return service.calibration_result()
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except IncompatibleCalibrationProfile as exc:
        raise HTTPException(409, str(exc)) from exc


@app.post("/api/live/start")
def start_live_session() -> dict:
    try:
        return service.start_live_session()
    except FileNotFoundError as exc:
        raise HTTPException(409, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc


@app.get("/api/live/epoch")
def live_epoch(after_sample_index: int = -1) -> dict:
    return service.live_epoch(after_sample_index)


@app.get("/api/sessions")
def sessions() -> list[dict]:
    return service.store.list_sessions()


@app.get("/api/sessions/{session_id}")
def session_details(session_id: str) -> dict:
    try:
        details = service.store.details(session_id)
    except FileNotFoundError as exc:
        raise HTTPException(404, "Session not found") from exc
    if "profile" in details:
        try:
            validate_calibration_profile(details["profile"])
            details["profile_compatible"] = True
        except IncompatibleCalibrationProfile:
            details["profile"] = None
            details["profile_compatible"] = False
            details["profile_error"] = INCOMPATIBLE_PROFILE_MESSAGE
    return details


@app.get("/api/sessions/{session_id}/download")
def download_session(session_id: str):
    try:
        path = service.store.archive(session_id)
    except FileNotFoundError as exc:
        raise HTTPException(404, "Session not found") from exc
    return FileResponse(path, filename=path.name, media_type="application/zip")


@app.get("/api/sessions/{session_id}/files/{filename}")
def download_file(session_id: str, filename: str):
    if filename not in {
        "calibration_profile.json",
        "quality_report.json",
        "calibration_record.json",
    }:
        raise HTTPException(404, "File not available")
    target = (service.store.root / session_id / filename).resolve()
    if target.parent != (service.store.root / session_id).resolve() or not target.is_file():
        raise HTTPException(404, "File not found")
    return FileResponse(target, filename=filename, media_type="application/json")


@app.websocket("/ws/live")
async def live(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            await websocket.send_json({"status": service.status()})
            await asyncio.sleep(0.5)
    except (WebSocketDisconnect, RuntimeError):
        pass


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=False,
)
def api_not_found(path: str) -> None:
    raise HTTPException(404, f"API endpoint not found: /api/{path}")


if config.FRONTEND_DIST.exists():
    assets = config.FRONTEND_DIST / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        candidate = (config.FRONTEND_DIST / path).resolve()
        if candidate.parent == config.FRONTEND_DIST.resolve() and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(config.FRONTEND_DIST / "index.html")
else:

    @app.get("/")
    def root() -> dict:
        return {"message": "Frontend is not built. Run npm.cmd run build in frontend/."}
