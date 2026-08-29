# NeuroScape AI / Developer Tools

This directory is for small project-specific inspection and validation utilities.

These tools are not production runtime modules and should not duplicate application logic.

Current utility:

- `check-environment.mjs`
  - checks Node/npm/Python/just availability
  - reports `.env`, `node_modules`, and EEG calibration virtual-environment readiness

Future good candidates:

- `validate-scene-graph.ts`
- `audit-audio-library.ts`
- `summarize-adaptive-trace.ts`

Cross-project tooling belongs in the separate UniversalTools/Iceywing project rather than
here.
