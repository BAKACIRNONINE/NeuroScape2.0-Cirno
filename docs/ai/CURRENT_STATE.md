# Current Development State

Generated against `research-v1` commit:

```text
214da160623229a82a149191cf6080dac6d62f44
```

Update this file at architecture milestones rather than on every small commit.

## Existing

- npm workspace repository with contracts, adaptive planner, Runtime scene controller,
  frontend, and study recorder server
- Node 22 recommended by `.nvmrc`
- Python 3.11+ calibration application with a repository-local virtual environment
- Runtime SceneGraph with semantic adjacency
- Runtime PlanValidator as a deterministic legality boundary
- adaptive planning with deterministic eligibility, Decision 1 / Decision 2 separation,
  cooldowns, stasis policy, patching, reflection, and trace records
- recorded adaptive trace/replay infrastructure
- existing forest integration topology and audio retrieval logic

## Infrastructure added by this milestone

- `iceywing.toml`
- `justfile`
- root `AGENTS.md`
- durable `docs/ai/` context
- reusable task procedures in `ai_skills/`
- project-specific helper utilities in `ai_tools/`

## Next engineering milestone

### Shared Scene Graph topology

1. Preserve the existing Runtime SceneGraph implementation.
2. Introduce one shared semantic topology representation.
3. Remove planner-only duplicated adjacency where practical.
4. Expand the Forest graph with branchable intermediate locations.
5. Keep Runtime validation authoritative.
6. Add adjacency and illegal-jump tests.

### Progression policy

After topology is stable:

1. distinguish semantic scene progression pressure from generic adaptation stasis
2. expose that pressure to bounded planning
3. do not encode a fixed route
4. do not change EEG scientific assumptions in the same patch

## Later

- audio metadata coverage for expanded semantic locations
- unified debug trace improvements
- research console
- route-planner refinements
- EEG-route coupling only after deterministic scene transitions are verified
