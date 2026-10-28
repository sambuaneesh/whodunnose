# Whodunnose

A small comedy deduction game prototype. Something happened in a crowded room. Work out who did it,
then call them out in front of everyone, without anyone deciding it was you.

Open `index.html` in a browser. Works fully offline: no build step, no network. Art and audio are generated in code;
the only bundled assets are three fonts in `fonts/` (SIL Open Font License).

A six-case campaign that introduces one to three mechanics per case, then Free Play with every mechanic and three difficulties.
Progress and settings are saved in the browser. Design notes: [`docs/DESIGN.md`](docs/DESIGN.md) · audit and redesign: [`docs/AUDIT.md`](docs/AUDIT.md).

## Controls
WASD / click to walk · E talk · hold E search a bag · Q sniff · V smell vision · F let one go · hold C clench ·
N notebook · O call it · H hint · Esc pause · M mute. Presenter mode (Settings) adds P pitch tour and `]` skip +15 s.

## Code
| File | What it does |
|---|---|
| `js/data.js` | Foods, the Aura cost table, difficulty, campaign cases, rules, objectives, tips, and the level builder |
| `js/save.js` | Settings and campaign progress in local storage |
| `js/levels/*.js` | One file per episode: zones, cast, voices, timeline, airflow, art, set pieces |
| `js/case.js` | Generates a solvable mystery from a case number |
| `js/gas.js` | Grid simulation: diffusion, air currents, vents, doors |
| `js/npc.js` | NPC AI: vision, reactions, opinions, whispers, tells, confrontations |
| `js/game.js` | Engine: timeline, player actions, evidence, cross-examination, scoring, rendering |
| `js/ui.js` | Title, HUD, dialogue, notebook, cross-examination screen, results |
| `js/art.js` | Cut-paper characters, expressions, props and effects |
| `js/audio.js` | Synthesised sound and music |
