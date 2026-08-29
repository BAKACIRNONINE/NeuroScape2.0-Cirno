# NeuroScape project task interface.
# `just` stays thin: existing package scripts remain authoritative.

setup:
    npm ci
    npm run calibration:setup

run:
    npm run dev

doctor:
    node ai_tools/check-environment.mjs

lint:
    npm run lint

typecheck:
    npm run typecheck

test:
    npm test

build:
    npm run build

format:
    npm run format

format-check:
    npm run format:check

# Keep the validation contract aligned with README.md.
verify:
    just lint
    just typecheck
    just test
    just build
