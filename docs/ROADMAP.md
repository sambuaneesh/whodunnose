# Roadmap and iteration log

Working agreement (from the product owner, 2026-10-29):
- Work in iterations across many sessions. Each iteration ends **verified** (headless, muted browser), then is committed under the owner's name (no AI attribution) and pushed to the live GitHub Pages site.
- Aim: a complete, carefully written browser game. Every case is authored with intent; nothing should feel random or unexplained.
- Public names stay neutral ("Whodunnose"); the game itself keeps its content.
- Read this file first at the start of every session, pick the next unchecked item, and log what was done at the bottom.

## Backlog (in order)

### Iteration 1: sound and characters
- [x] Audio engine v4: mixing bus with compressor, generated reverb per setting, music ducking under dialogue
- [x] Adaptive music: per-setting themes with intensity layers (calm → investigating → tension → trial), stingers for key beats
- [x] Sound design: richer fart synthesis (body, flutter, turbulence, sputter tail, food-dependent), character voice blips with distinct timbres, ambience beds (elevator motor, cables, floor ticks; chapel room tone, pew creaks), footsteps, paper UI sounds
- [x] Character design v2: real arms and sleeves, trousers and shoes, clothing details, per-character facial features, idle breathing, more expressions
- [x] Fix: eyes, eyelids and eyebrows drawing over hair, glasses and neighbours (clip eyelids to the eye shape, brows relative to eyes)

### Iteration 2: playtest tools
- [ ] Admin / playtest mode unlocked by a code in the URL: every case open, god view (culprit, origin, all facts), NPC debug overlay (suspicion, theories, who sees whom), time controls (pause, ×0.5–×4, skip), teleport, reveal clues, toggle rules, pick seeds
- [ ] Replace the Settings "Presenter mode: unlock every case" with this; keep the pitch tour for presenters

### Iteration 3: writing and world
- [ ] Research what players love in comedy mysteries (reviews, blogs, forums) and write findings into docs/DESIGN.md
- [ ] A season story that connects the cases (same building, same people, the wedding as the finale), recurring characters with arcs
- [ ] Hand-authored per-case dialogue, motives (why they ate it, why they lie), and an ending beat per case
- [ ] Audit every line of text and every mechanic for consistency ("connect all the dots")

### Iteration 4 (v4 release)
- [ ] New settings and cases where they serve the story
- [ ] Reverse case ("you dealt it"), daily case, achievements
- [ ] Accessibility: colour-blind palette check, touch controls, remappable keys
- [ ] Performance pass, final polish, v4 release notes

## Log
- 2026-10-29: roadmap created. Starting iteration 1.
- 2026-10-29: audio engine v4 done (buses, compressor, generated room reverb, adaptive themes with intensity layers, ducking, ambience, new farts/voices/foley, end jingles). Levels measured headlessly; no clipping.
- 2026-10-29: character design v2 (arms/sleeves, trousers/skirts/shoes, outfits, per-character features, breathing, clipped eyelids, brows above eyes, face-clipped tints, raised cap/beanie brims). The floating watching-eye moved into the HUD; zone labels painted on the floor under people; reaction badges smaller. Iteration 1 complete.
