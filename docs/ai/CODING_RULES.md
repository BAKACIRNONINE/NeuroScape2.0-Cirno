# Coding Rules

## Change isolation

Prefer small changesets with one architectural purpose.

Recommended order for the current redesign:

```text
project infrastructure
-> shared Scene Graph topology
-> manual/legal scene transitions
-> audio transition compatibility
-> debug trace improvements
-> LLM route choice
-> EEG influence on route choice
```

Do not change EEG interpretation, route architecture, audio policy, and UI behavior in one
large patch unless there is no reasonable way to isolate them.

## Contracts

- Search for an existing contract before adding a new model.
- Prefer extending existing `SceneJourneyPlan`, Runtime state, and adaptive trace contracts.
- Avoid parallel `Journey`, `SceneGraph`, or trace event hierarchies that represent the
  same concepts differently.

## Planner and Runtime

- Planner output must be bounded to known semantic locations.
- A route choice must be legal with respect to semantic adjacency.
- Runtime validation must independently verify legality.
- Planner convenience logic must not become the sole safety boundary.

## EEG

- Do not feed raw EEG directly into frontend behavior.
- Do not infer stronger neuroscience claims than the calibrated features support.
- Do not silently change pilot thresholds while performing unrelated refactors.

## Tests

Every topology/policy change should include tests for both allowed and rejected behavior.

For Scene Graph work, include at minimum:

```text
legal adjacent transition -> accepted
illegal jump -> rejected
planner reachable locations -> current + legal neighbors only
unknown semantic location -> rejected
```

## Validation

Before commit:

```text
just verify
```

If verification fails, keep the change local and diagnose before push.

## Documentation

Use `docs/adr/` for durable architecture decisions whose rationale could otherwise be lost.
Do not duplicate large architecture explanations across many files; link to the canonical
document instead.
