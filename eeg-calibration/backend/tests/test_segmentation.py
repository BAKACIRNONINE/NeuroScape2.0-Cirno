from app import config
from app.signal_processing.core import create_epochs


def test_five_minute_baseline_retains_all_thirty_epochs(make_samples):
    recorded = make_samples(seconds=config.BASELINE_SECONDS)
    epochs = create_epochs(recorded)
    assert len(epochs) == config.EXPECTED_BASELINE_EPOCHS == 30
    assert epochs[0][0].sample_index == 0


def test_short_recording_only_uses_complete_epochs(make_samples):
    recorded = make_samples(seconds=35)
    assert len(create_epochs(recorded)) == 3
