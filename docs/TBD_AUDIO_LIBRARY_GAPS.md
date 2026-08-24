# Audio Library Gaps — TBD

This list is intentionally non-blocking for the runnable prototype. The authored source of truth is `packages/contracts/src/audio_library.json`; the items below should be reconciled before the production study library is frozen.

## Local files not yet described in `audio_library.json`

- `forest/event/forest_insect_chirp_far_01.wav`
- `forest/event/forest_small_animal_rustle_far_01.wav`
- `forest/event/forest_soft_owl_far_01.wav`
- `ocean_beach/event/ocean_child_sand_play_far_01.wav`
- `ocean_beach/event/ocean_pebble_wash_mid_01.wav`
- `ocean_beach/event/ocean_shorebird_far_01.wav`

These files remain available locally but are not eligible for Decision 2 retrieval until authored records are added.

## Forest-water transition gap

The current narrative prototype contains `stream_bank` and `waterfall` semantic locations, but the authored library does not yet contain forest stream or waterfall recordings. Existing legacy demo aliases temporarily resolve to ocean shoreline/wave clips so older Module 03/04 scenarios continue to run. New Decision 2 retrieval does not present these cross-scene aliases as forest-compatible candidates.

## Metadata refinements for later review

- Confirm whether an explicit authored `family_id`/`variant_id` should replace the current deterministic family derivation that removes the trailing numeric suffix.
- Confirm functional roles for footsteps (`locomotion`, `embodied-anchor`, `rhythmic-regulation`, or `transition-cue`).
- Preserve the distinction between `default_motion.duration`, `auto_delete_after_sec`, and looping lifecycle when reviewing measured clip lengths.
