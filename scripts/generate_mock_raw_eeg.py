#!/usr/bin/env python3
from __future__ import annotations

import csv
import math
from pathlib import Path

SAMPLE_RATE_HZ = 256
DURATION_SECONDS = 600
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "mock" / "raw_eeg_10min.csv"


def generate_row(sample_index: int) -> dict[str, object]:
    elapsed = sample_index / SAMPLE_RATE_HZ
    theta = 32.0 * math.sin(2.0 * math.pi * 7.0 * elapsed)
    beta = 23.0 * math.sin(2.0 * math.pi * 18.0 * elapsed)
    drift = 0.25 * elapsed
    tp9 = 82.0 + theta + beta + drift
    af7 = 80.0 + 1.1 * theta + 0.8 * beta + drift
    af8 = 78.0 + 1.2 * theta + 0.9 * beta + 0.15 * math.sin(2.0 * math.pi * 0.5 * elapsed)
    tp10 = 84.0 + 0.9 * theta + 1.2 * beta + drift
    return {
        "sample_index": sample_index,
        "monotonic_timestamp": round(elapsed, 8),
        "session_elapsed_seconds": round(elapsed, 8),
        "tp9": round(tp9, 6),
        "af7": round(af7, 6),
        "af8": round(af8, 6),
        "tp10": round(tp10, 6),
        "aux_right": None,
        "headband_on": True,
        "hsi_tp9": 2,
        "hsi_af7": 2,
        "hsi_af8": 2,
        "hsi_tp10": 2,
        "acc_x": 0.0,
        "acc_y": 0.0,
        "acc_z": 0.0,
        "gyro_x": 0.0,
        "gyro_y": 0.0,
        "gyro_z": 0.0,
        "blink": False,
        "jaw_clench": False,
    }


def main() -> Path:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    header = [
        "sample_index",
        "monotonic_timestamp",
        "session_elapsed_seconds",
        "tp9",
        "af7",
        "af8",
        "tp10",
        "aux_right",
        "headband_on",
        "hsi_tp9",
        "hsi_af7",
        "hsi_af8",
        "hsi_tp10",
        "acc_x",
        "acc_y",
        "acc_z",
        "gyro_x",
        "gyro_y",
        "gyro_z",
        "blink",
        "jaw_clench",
    ]
    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        for sample_index in range(DURATION_SECONDS * SAMPLE_RATE_HZ):
            writer.writerow(generate_row(sample_index))
    return OUTPUT_PATH


if __name__ == "__main__":
    path = main()
    print(f"Generated {path} with {DURATION_SECONDS * SAMPLE_RATE_HZ} samples")
