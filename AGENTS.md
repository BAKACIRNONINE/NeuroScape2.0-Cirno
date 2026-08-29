# NeuroScape AI Development Guide

This file is the short entry point for AI-assisted development. Detailed context lives
under `docs/ai/` and task-specific procedures live under `ai_skills/`.

## Read first

1. `README.md`
2. `PROJECT_BOOTSTRAP.md`
3. `docs/ai/PROJECT_CONTEXT.md`
4. `docs/ai/CURRENT_STATE.md`
5. `docs/ai/CODING_RULES.md`
6. `docs/END_TO_END_DEVELOPMENT.md`

For specialized work, also read the matching `ai_skills/*/SKILL.md`.

## Architecture invariants

1. `RuntimeWorldState` remains the authoritative spatial runtime state.
2. Reuse the existing Runtime SceneGraph implementation. Do not introduce a parallel
   SceneGraph system without an explicit architecture decision.
3. Planner-facing legal movement and Runtime validation must converge on one semantic
   topology source of truth.
4. Runtime validation remains authoritative even when an LLM proposes a plan.
5. Do not hard-code a fixed participant journey. Deterministic policy may constrain legal
   transitions and progression, while route choice remains bounded.
6. Do not allow an LLM to invent semantic locations that do not exist in the topology.
7. Raw EEG interpretation belongs in the EEG/attention pipeline, not in frontend UI code.
8. Preserve recording/replay compatibility when changing adaptive decision structures.
9. Prefer extending existing contracts and trace records over adding parallel duplicate
   models.
10. Pilot timing/threshold values must not be described as scientifically validated unless
    the repository contains evidence that establishes that claim.

## Current development direction

The next architecture milestone is a shared Scene Graph topology used by both the adaptive
planner and Runtime-facing integration. The existing Runtime SceneGraph and PlanValidator
should be preserved as the final legality boundary.

Scene progression pressure should be distinguishable from generic soundscape/adaptation
stasis so that a local audio change does not necessarily count as a semantic scene change.

## Standard project commands

Use the repository task interface:

```text
just setup
just run
just doctor
just lint
just typecheck
just test
just build
just verify
```

`just verify` is the standard pre-commit validation path.

## Iceywing Pop Flow

For AI-generated change packages:

```text
iceywing pop inspect <change.icepatch>
iceywing pop apply <change.icepatch>
iceywing pop diff
iceywing pop commit
iceywing pop push
```

Push is always an explicit human-triggered operation.

## Documentation responsibility

When an architecture decision materially changes, update the relevant document in
`docs/ai/` and add an ADR when the reason for the decision is likely to matter later.
