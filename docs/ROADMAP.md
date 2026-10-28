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
- [x] Admin / playtest mode unlocked by a code in the URL: every case open, god view (culprit, origin, all facts), NPC debug overlay (suspicion, theories, who sees whom), time controls (pause, ×0.5–×4, skip), teleport, reveal clues, toggle rules, pick seeds
- [x] Replace the Settings "Presenter mode: unlock every case" with this; keep the pitch tour for presenters

### Iteration 3: writing and world
- [x] Research what players love in comedy mysteries (reviews, blogs, forums) and write findings into docs/DESIGN.md
- [x] A season story that connects the cases (same building, same people, the wedding as the finale), recurring characters with arcs
- [x] Hand-authored per-case dialogue, motives (why they ate it, why they lie), and an ending beat per case
- [x] Audit every line of text and every mechanic for consistency ("connect all the dots")

### Iteration 4 (v4 release)
- [ ] New settings and cases where they serve the story
- [x] Reverse case ("you dealt it")
- [ ] Daily case, achievements
- [ ] Accessibility: colour-blind palette check, touch controls, remappable keys
- [ ] Performance pass, final polish, v4 release notes

## Log
- 2026-10-29: roadmap created. Starting iteration 1.
- 2026-10-29: audio engine v4 done (buses, compressor, generated room reverb, adaptive themes with intensity layers, ducking, ambience, new farts/voices/foley, end jingles). Levels measured headlessly; no clipping.
- 2026-10-29: character design v2 (arms/sleeves, trousers/skirts/shoes, outfits, per-character features, breathing, clipped eyelids, brows above eyes, face-clipped tints, raised cap/beanie brims). The floating watching-eye moved into the HUD; zone labels painted on the floor under people; reaction badges smaller. Iteration 1 complete.
- 2026-10-29: playtest tools (js/playtest.js). Open the game with `?playtest=pullmyfinger` (or `#pullmyfinger`); `?playtest=off` or the Settings checkbox turns it off. Backquote (or F2, or the PLAYTEST badge) opens the panel: jump to any case or Free Play with any seed; the case's full truth (culprit, food, origin, cover-up, lie, decoys, witness, every fact); time controls (pause, ×0.25–×4, +15 s, jump to the fart or the call-out); god view (culprit and origin marked, where everyone stood, gas always visible, NPC labels with suspicion/theory/knowledge, vision cones); cheats (reveal all clues, refill Aura, calm everyone, tummy, rumble, force the mention, call it, solve instantly); live rule toggles and accusation mode; audio meter. Shift-click teleports. Playtest runs never write campaign progress. Presenter mode now only shows the pitch tour and ] skip. Iteration 2 complete.
- 2026-10-29: iteration 3 (writing). Research summary in DESIGN.md. Season one "Thornbury Tower" in js/story.js: six authored cases (fixed culprit, meal, lie with a motive, decoys, witness, positions, witness and bag lines, per-case voice lines and confessions), a briefing "previously" paragraph, "what really happened" and "what happened next" on the results, a season-end card. The bride is now Dana from HR. Consistency fixes: the elevator descends thirty floors over each case's own length, Sal gets on at twenty-two (he said twenty-one; the car stopped at twenty-two), floor nine is a real stop in every ride, the c1 lobby no longer arrives at floor nine. Verified: every authored case generates as written, only the culprit and near decoy stand at the origin, all cases solve in the stress script; Free Play culprits still spread across the whole cast.
- 2026-10-29: consistency audit. Chapel clock now starts at each case's time (the rehearsal is 9:30, not 10:58); the "Two suspects?" tip became "That is a match" (case 1 has a single eater); the pitch tour says the season is written and Free Play is generated; Kevin has shot four weddings (he has one review); whispers that blame you use who you are in that case ("Dana's elevator friend", "the elevator person", "the Nose"). Iteration 3 complete.
- 2026-10-29: bonus case 7 "You Dealt It" (reverse): you are the culprit; release timing and place, gag, plant your cup, hush the witness, rumours, and the room decides at the lobby. Own objectives, tips, ranks and endings; playtest panel shows the room's live scores. Verified headlessly: good play earns S, doing nothing gets you named, partial play earns A/B; detective cases unchanged in the stress script.
