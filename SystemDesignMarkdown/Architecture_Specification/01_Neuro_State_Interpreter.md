
# NeuroScape Spec 01 — Neuro State Interpreter

## Responsibility
Convert raw EEG (Muse) into a stable neuro-state representation for the LLM.

## Inputs
- Raw EEG (Delta/Theta/Alpha/Beta/Gamma)
- Optional HR/PPG
- Previous neuro state

## Pipeline
1. Signal quality check
2. Artifact removal
3. Windowing
4. Feature extraction
5. Neuro metric estimation
6. Trend estimation
7. Confidence estimation

## Output JSON
```json
{
  "timestamp":"...",
  "attention":{"value":0.72,"trend":"decreasing"},
  "arousal":{"value":0.41,"trend":"stable"},
  "stability":0.81,
  "confidence":0.92,
  "history_summary":"Attention has gradually declined over the past 2 minutes."
}
```

## Design Principles
- Never expose raw EEG to the planner.
- Output interpretable cognitive state.
- Include trend and confidence.
