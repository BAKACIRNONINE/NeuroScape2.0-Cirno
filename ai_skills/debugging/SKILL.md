# Debugging Skill

Use this procedure when a planned adaptation is missing, rejected, not audible, or not
reflected in Runtime state.

## Trace in order

```text
EEG epoch
-> attention state
-> eligibility
-> Decision 1
-> candidate retrieval
-> Decision 2
-> deterministic plan validation
-> patch lifecycle
-> Runtime application
-> reflection / recorded outcome
```

## Rules

- Find the first stage whose expected output is absent or invalid.
- Do not compensate for an upstream failure by weakening Runtime validation.
- Prefer existing adaptive trace and recorded-session data over adding ad hoc console logs.
- Record enough structured context to distinguish "not proposed", "proposed but illegal",
  "blocked by policy", and "applied but inaudible".
- Run focused tests first, then `just verify`.
