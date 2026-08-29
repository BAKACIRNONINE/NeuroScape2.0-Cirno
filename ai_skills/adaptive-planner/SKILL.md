# Adaptive Planner Skill

Use this procedure for Decision 1, Decision 2, eligibility, cooldown, stasis, progression,
patching, or reflection work.

## Read

- `AGENTS.md`
- `docs/ai/PROJECT_CONTEXT.md`
- `docs/ai/CODING_RULES.md`
- adaptive planner config/types/engine
- prompt/provider code
- retrieval and patching code
- adaptive planner tests

## Procedure

1. Decide whether the change belongs to deterministic policy or bounded LLM choice.
2. Keep eligibility/cooldown/safety restrictions deterministic.
3. Keep destination choices bounded by known legal semantic locations.
4. Distinguish semantic scene progression from local soundscape changes when needed.
5. Preserve traceability of eligibility, Decision 1, Decision 2, validation, and application.
6. Extend existing trace/contracts before creating new event hierarchies.
7. Add focused tests.
8. Run `just verify`.

## Research rule

Do not describe pilot thresholds as validated neuroscience parameters without documented
evidence in the repository.
