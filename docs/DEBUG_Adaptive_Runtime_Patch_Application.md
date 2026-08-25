# Adaptive Runtime Patch Application Debug Record

## Purpose

This change fixes a failure observed in the P005 adaptive study session: Decision 2 produced valid-looking sound proposals, but Module 03 rejected every resulting `SceneJourneyPlan`. The planner then continued reasoning as if the rejected sounds had been applied.

## Evidence from the recorded session

The adaptive session proposed three changes:

1. Add global ambient `forest_stream_ambient_bed_01` after the 220-second checkpoint.
2. Add event `forest_bird_far_02` at 425 seconds.
3. Add event `forest_insect_chirp_far_01` at 515 seconds.

All three runtime applications failed with:

```text
Invalid SceneJourneyPlan: soundscape.ambient[1].locationId must be omitted for global ambient.
```

The first proposal contained a strict-schema placeholder:

```json
{
  "mode": "global",
  "locationId": null
}
```

For Module 03, a global ambient item must omit `locationId`; `null` is not equivalent to omission. Although runtime rejected the plan, the adaptive planner had already committed the projected Base Plan. Consequently, the invalid stream remained in later Decision 2 context and caused the two otherwise independent event proposals to fail as well.

## Changes made

### 1. Normalize global ambient payloads before Base Plan projection

File: `packages/adaptive-planner/src/patching.ts`

`normalizeLegacyPlanPatch` now clones every ambient upsert and removes `locationId` whenever `mode` is `global`. This brings the Base Plan patching path into line with the existing `mergePlanPatch` behavior and with Module 03's validator contract.

Localized ambient sources are unchanged and continue to require a valid `locationId`.

### 2. Commit adaptive state only after runtime acceptance

File: `packages/adaptive-planner/src/engine.ts`

Validated projections are now stored as pending applications. Before Module 03 accepts the plan, the planner no longer mutates:

- the active Base Plan;
- the current runtime plan used by later prompts;
- accepted patch history;
- adaptation history and asset history;
- transition/cooldown timing.

When the integration layer calls `acknowledgeApplication(..., 'APPLIED', ...)`, the pending projection is committed atomically. When it reports `FAILED`, the pending projection is discarded. The lifecycle still records the failed application for inspection.

This prevents a runtime-rejected proposal from appearing as an applied sound in later LLM context or reflection memory.

### 3. Add regression coverage

File: `packages/adaptive-planner/tests/base-plan-patching.test.ts`

A regression test reproduces the recorded payload (`mode: "global"` plus `locationId: null`), projects it through the Base Plan patch path, materializes the runtime plan, and verifies that the resulting global ambient item has no `locationId` property.

## Expected behavior after the fix

For the same first proposal:

1. Decision 2 may return `locationId: null` because the strict output schema requires the field.
2. The compatibility normalization layer removes that field for a global ambient source.
3. The projected `SceneJourneyPlan` passes Module 03 ambient validation.
4. Runtime applies the plan.
5. Only after successful application does the planner record the stream as applied and start cooldown/reflection timing.

If runtime rejects any future proposal for another reason, the coherent Base Plan continues and subsequent decisions receive the last successfully applied runtime state.

## Verification

The regression coverage targets both the exact invalid payload shape found in the session recording and the runtime acknowledgement boundary. It verifies that:

- `locationId: null` is omitted before a global ambient reaches Module 03;
- a proposed plan is visible to the integration layer but is not yet committed to planner state;
- `APPLIED` commits the plan, history, and accepted patch;
- `FAILED` discards the pending plan without contaminating planner state.

Verification completed successfully:

```text
@neuroscape/adaptive-planner: 34 tests passed
@neuroscape/runtime-scene-controller: 31 tests passed
@neuroscape/frontend: 63 tests passed
```

The contracts, adaptive planner, and runtime scene controller TypeScript builds also completed successfully. The local Node version produced an engine-range warning during dependency installation (`v23.11.0` versus the repository's supported LTS/current ranges), but builds and tests passed.
