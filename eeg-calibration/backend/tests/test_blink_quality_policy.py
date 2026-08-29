from __future__ import annotations

import numpy as np

from app import config
from app.calibration.service import CalibrationService, GUIDED_BASELINE
from app.signal_processing.core import analyze_segment
from app.storage.session_store import SessionStore


def test_blink_is_a_soft_epoch_flag(make_samples):
    samples = make_samples()
    samples[len(samples) // 2].blink = True
    result = analyze_segment(samples)[0]
    assert result.usable
    assert result.quality_flags == ["blink_overlap"]
    assert all("blink_overlap" not in reasons for reasons in result.invalid_reasons.values())


def test_peak_to_peak_rejects_only_affected_channel(make_samples):
    samples = make_samples()
    time_axis = np.arange(len(samples)) / config.SAMPLING_RATE_HZ
    high_amplitude = 220 * np.sin(2 * np.pi * 6 * time_axis)
    for index, sample in enumerate(samples): sample.af8 = float(high_amplitude[index])
    result = analyze_segment(samples)[0]
    assert result.usable and result.valid_channels == ["AF7"]
    assert "peak_to_peak" in result.invalid_reasons["AF8"]


def test_blink_burden_is_recorded_but_does_not_invalidate_baseline(tmp_path):
    service = CalibrationService(store=SessionStore(tmp_path))
    values = [1.0] * 25
    service.blocks = [{"block_id": "baseline_1", "condition": GUIDED_BASELINE,
        "included_in_baseline": False, "eeg_quality": {"status": "pass", "reasons": [],
        "total_epochs": 30, "valid_epochs": 25, "invalid_epochs": 5, "blink_epochs": 25,
        "epoch_tbrs": values, "rejection_counts": {}, "channel_contributions": {"AF7": 25, "AF8": 25}}}]
    evaluation = service._baseline_evaluation()
    assert evaluation["status"] == "pass"
    assert evaluation["blink_epochs"] == 25
    service.store.close()
