
# NeuroScape Spec 02 — Scene Journey Planner (LLM)

## Responsibility
Reason about how the virtual meditation world should evolve.

## Inputs
A. Neuro State
B. Current Journey Context
C. Scene Graph
D. Sound Library
E. Adaptation History

## Scene Graph
Semantic locations only.

Example:

forest_entry
├── stream_bank
├── clearing
├── hill
└── waterfall

Each node contains:
- ambient candidates
- event candidates
- traversal connections

## Sound Library
Each sound stores:
- semantic meaning
- layer (ambient/action/event)
- recommended usage
- emotional effect
- spatial constraints

## LLM Tasks
1. Interpret neuro state
2. Decide adaptation goal
3. Plan user journey
4. Plan soundscape adaptation
5. Produce transition policy

## Output
SceneJourneyPlan

Contains:
- reasoning_summary
- user_journey
- ambient plan
- action plan
- event plan
- transition_policy

## Constraints
- Output semantic locations whenever possible.
- Never generate frame-by-frame positions.
- Preserve scene continuity.
