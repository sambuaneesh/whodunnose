#!/bin/sh
# Syntax check every script, then play every case headlessly (muted).
cd "$(dirname "$0")/.." || exit 1
for f in js/*.js js/levels/*.js; do node --check "$f" || exit 1; done
T=$(mktemp -d)
printf '[{"nav":"file://%s/index.html?playtest=off","wait":2000},{"evalFile":"%s/tools/checks/solve.js","print":true}]' "$PWD" "$PWD" > "$T/steps.json"
node tools/shoot.mjs "$T/steps.json"
