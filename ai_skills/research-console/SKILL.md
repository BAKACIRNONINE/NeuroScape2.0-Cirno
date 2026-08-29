# Research Console Skill

Use this procedure for researcher/debug UI work.

## Principles

- Runtime state remains authoritative for spatial visualization.
- EEG panels display processed/calibrated state; they do not invent new EEG interpretation.
- Decision panels should expose eligibility -> Decision 1 -> Decision 2 -> validation ->
  application as structured facts.
- Prefer reuse/refactor of existing panels and recorded trace data.
- Keep research/debug controls distinguishable from participant-facing experience.
- Do not add debug shortcuts that can silently contaminate research sessions.

## Validation

Run UI-focused tests where available, then `just verify`.
