# NeuroScape

Module 01/02 Phase 1 development and test instructions: [docs/MODULE_01_02_PHASE1.md](docs/MODULE_01_02_PHASE1.md).

Audio-library items intentionally deferred for later asset curation are tracked in [docs/TBD_AUDIO_LIBRARY_GAPS.md](docs/TBD_AUDIO_LIBRARY_GAPS.md).

NeuroScape is a neuroadaptive spatial-audio meditation runtime. Modules 03 and 04 are implemented: semantic plans become authoritative numerical world snapshots in Module 03, then Module 04 validates, visualizes, spatializes, records, and replays those snapshots in the browser.

```text
Module 01 → NeuroState ┐
Module 02 → SceneJourneyPlan → Module 03 → RuntimeWorldState
                              └───────────────┬───────────────┘
                                              ↓
                               Module 04 Runtime Store
                         React + Three.js + Web Audio/HRTF
```

`RuntimeWorldState` is the only spatial source of truth. The browser never interprets EEG, executes planner reasoning, or simulates source movement.

## Quick start

```bash
npm install
npm run dev
```

Put `OPENAI_API_KEY` in a repository-root `.env` file (see `.env.example`). `npm run dev` loads it only in the localhost backend; the key is never bundled into Vite or sent to the browser.

Open the displayed Vite URL. Choose the Phase 1 adaptive flow, then select **OpenAI · GPT-5.6** for real Decision 1/2 reasoning or **Offline mock** for a no-cost deterministic check. Adaptive sessions automatically save study artifacts under `study-results/` and also expose a ZIP download on the Summary page.

## Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

See [End-to-End Development Guide](docs/END_TO_END_DEVELOPMENT.md) for architecture, protocol, audio assets, demo operation, diagnostics, and upstream integration.

The source-of-truth specifications in `SystemDesign/` and legacy visual references in `UIreference/` are preserved unchanged.
