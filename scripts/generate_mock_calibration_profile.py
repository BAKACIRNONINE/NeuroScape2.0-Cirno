#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "eeg-calibration" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.signal_processing.core import FEATURE_VERSION, validate_calibration_profile

OUTPUT_PATH = REPO_ROOT / "data" / "mock" / "calibration_profile.json"

profile = {
    "participant_id": "P001",
    "session_id": "mock-calibration-profile-001",
    "sampling_rate_hz": 256,
    "feature_version": FEATURE_VERSION,
    "baseline_log_tbr": 1.27,
    "baseline_mad": 0.08,
    "baseline_scale": 0.118608,
    "effective_baseline_scale": 0.118608,
    "expected_epoch_count": 30,
    "valid_epoch_count": 28,
    "invalid_epoch_count": 2,
    "baseline_available": True,
    "collection_decision": "ready_to_continue",
    "ready_to_continue": True,
    "quality_status": "pass",
    "quality_issues": [],
    "self_reported_focus": 5,
    "self_reported_drowsiness": 2,
    "selected_baseline_id": "baseline-guided-v5",
    "blocks": [],
    "acclimation_attempts": [],
    "quality": {
        "status": "valid_collection",
        "collection_decision": "ready_to_continue",
        "quality_issues": [],
        "packet_completeness": 0.96,
        "valid_frontal_fraction": 0.95,
        "researcher_quality_override": False,
        "peak_to_peak_threshold_uv": 150.0,
        "baseline_policy": {
            "duration_seconds": 300,
            "expected_epochs": 30,
            "minimum_valid_epochs": 25,
            "maximum_redos": 1,
            "aggregation": "valid_epoch_median",
        },
        "baseline_summary": {
            "baseline_log_tbr": 1.27,
            "baseline_mad": 0.08,
            "baseline_scale": 0.118608,
        },
    },
}

validate_calibration_profile(profile)
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH.write_text(json.dumps(profile, indent=2), encoding="utf-8")
print(f"Generated valid calibration profile at {OUTPUT_PATH}")
print(json.dumps({
    "participant_id": profile["participant_id"],
    "session_id": profile["session_id"],
    "feature_version": profile["feature_version"],
    "baseline_log_tbr": profile["baseline_log_tbr"],
    "baseline_scale": profile["baseline_scale"],
    "ready_to_continue": profile["ready_to_continue"],
}, indent=2))
