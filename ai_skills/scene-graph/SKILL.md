# Scene Graph Skill

Use this procedure when changing semantic locations, adjacency, route legality, or
scene-transition planning.

## Read

- `AGENTS.md`
- `docs/ai/PROJECT_CONTEXT.md`
- `docs/ai/CURRENT_STATE.md`
- Runtime SceneGraph implementation
- Runtime PlanValidator
- adaptive planner audio/route retrieval logic
- integration forest scenario

## Procedure

1. Identify the current semantic topology owners.
2. Prefer one shared topology representation over copied neighbor maps.
3. Keep Runtime SceneGraph/PlanValidator as the final legality boundary.
4. Add or update semantic nodes without hard-coding a participant route.
5. Make planner reachable locations derive from the shared topology.
6. Check audio narrative/location metadata for newly introduced locations.
7. Add legal-adjacency and illegal-jump tests.
8. Run `just verify`.
9. Update `docs/ai/CURRENT_STATE.md` if the architecture milestone is complete.

## Do not

- create a parallel Runtime SceneGraph
- let the LLM invent location IDs
- remove deterministic validation
- combine EEG scientific changes into the topology patch
