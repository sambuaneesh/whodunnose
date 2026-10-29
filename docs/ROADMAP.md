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
- [x] New settings and cases where they serve the story (season two opener: the plane)
- [x] Reverse case ("you dealt it")
- [x] Daily case, achievements
- [x] Accessibility: colour-blind palette check, touch controls, remappable keys
- [x] Performance pass, final polish, v4 release notes

### Iteration 5 (v4.1): neatness, and season two begins
- [x] Glasses: two separate lenses with a bridge; sunglasses cover the eyes
- [x] Layout pass: nothing floating over the scene overlaps (bubbles, name tags, debug chips), the HUD steps aside, the camera frames the scene above the action bar, captions behave like subtitles, crowds stagger so faces stay visible
- [x] Briefings and the title fit on one screen; results open at the top
- [x] Season two opener: "Cruising Altitude", a plane with a seatbelt sign
- [ ] More season two cases: Thornbury Tower under its new owner, with Mr. Lindqvist as a rival nose
- [ ] A human playtest of case 1, the bonus case and the plane

## Log
- 2026-10-29: roadmap created. Starting iteration 1.
- 2026-10-29: audio engine v4 done (buses, compressor, generated room reverb, adaptive themes with intensity layers, ducking, ambience, new farts/voices/foley, end jingles). Levels measured headlessly; no clipping.
- 2026-10-29: character design v2 (arms/sleeves, trousers/skirts/shoes, outfits, per-character features, breathing, clipped eyelids, brows above eyes, face-clipped tints, raised cap/beanie brims). The floating watching-eye moved into the HUD; zone labels painted on the floor under people; reaction badges smaller. Iteration 1 complete.
- 2026-10-29: playtest tools (js/playtest.js). Open the game with `?playtest=pullmyfinger` (or `#pullmyfinger`); `?playtest=off` or the Settings checkbox turns it off. Backquote (or F2, or the PLAYTEST badge) opens the panel: jump to any case or Free Play with any seed; the case's full truth (culprit, food, origin, cover-up, lie, decoys, witness, every fact); time controls (pause, ×0.25–×4, +15 s, jump to the fart or the call-out); god view (culprit and origin marked, where everyone stood, gas always visible, NPC labels with suspicion/theory/knowledge, vision cones); cheats (reveal all clues, refill Aura, calm everyone, tummy, rumble, force the mention, call it, solve instantly); live rule toggles and accusation mode; audio meter. Shift-click teleports. Playtest runs never write campaign progress. Presenter mode now only shows the pitch tour and ] skip. Iteration 2 complete.
- 2026-10-29: iteration 3 (writing). Research summary in DESIGN.md. Season one "Thornbury Tower" in js/story.js: six authored cases (fixed culprit, meal, lie with a motive, decoys, witness, positions, witness and bag lines, per-case voice lines and confessions), a briefing "previously" paragraph, "what really happened" and "what happened next" on the results, a season-end card. The bride is now Dana from HR. Consistency fixes: the elevator descends thirty floors over each case's own length, Sal gets on at twenty-two (he said twenty-one; the car stopped at twenty-two), floor nine is a real stop in every ride, the c1 lobby no longer arrives at floor nine. Verified: every authored case generates as written, only the culprit and near decoy stand at the origin, all cases solve in the stress script; Free Play culprits still spread across the whole cast.
- 2026-10-29: consistency audit. Chapel clock now starts at each case's time (the rehearsal is 9:30, not 10:58); the "Two suspects?" tip became "That is a match" (case 1 has a single eater); the pitch tour says the season is written and Free Play is generated; Kevin has shot four weddings (he has one review); whispers that blame you use who you are in that case ("Dana's elevator friend", "the elevator person", "the Nose"). Iteration 3 complete.
- 2026-10-29: bonus case 7 "You Dealt It" (reverse): you are the culprit; release timing and place, gag, plant your cup, hush the witness, rumours, and the room decides at the lobby. Own objectives, tips, ranks and endings; playtest panel shows the room's live scores. Verified headlessly: good play earns S, doing nothing gets you named, partial play earns A/B; detective cases unchanged in the stress script.
- 2026-10-29: daily case (same seed for everyone on a date, alternating elevator and chapel, Normal difficulty, first finish of the day counts, streak, spoiler-free "Copy result" text) and 19 achievements (js/meta.js) with an unlock pop-up and a list on the title screen. Campaign reset keeps achievements and daily history; playtest runs never count. Fixed the chapel bunting, which still said BRAD + CHANTELLE.
- 2026-10-29: accessibility. Phones held sideways: the case file collapses to a one-line tab with a count (tap to open), meters, toasts and action buttons tighten, key hints are hidden on touch screens, and Search/Plant is a press-and-hold button. Remappable keys in Settings > Controls (js/keys.js): bindings use physical key positions so WASD works on AZERTY, clashes swap, Escape/Enter/arrows/number keys are reserved, and the action bar shows the bound keys (labelled for the keyboard layout where the browser allows). Colour check: no state is shown by colour alone (vision cones also differ in strength, objectives use ticks and crosses, ranks are letters, Aura has a number, "watching" is text).
- 2026-10-29: performance measured (1.3 to 3 ms frame work median at 2x, under 6 ms p95: no changes needed). Polish: pitch sheet lists the new modes as playable, the reverse case says "The room decides" at the lobby and "Bonus case" on results. v4 release notes in docs/RELEASE-v4.md. Iteration 4 complete apart from new settings and cases.
- 2026-10-29: owner feedback: the glasses still overlapped ("the specs is not fixed"), and screens looked cluttered and overlapping. Fixed glasses (separate lenses, wider-set eyes inside them) and sunglasses (eyes hidden, proper lenses). Layout pass: one screen-space layout (Tags in game.js) places bubbles, Smell Vision names and playtest chips so they never overlap each other or the HUD; HUD cards fade while someone stands behind them; the case file folds to one line and opens when an objective changes; the camera frames each scene above the action bar; captions sit low like subtitles and jump to the top when you stand there; crowds stagger (a depth factor in the spacing rule), nobody spawns on you or on furniture; zone names choose a free corner and fade under people; the rumble prompt moved into the prompt bar; vision cones stop at the walls; briefings and the title fit on one screen; results open at the top; playtest labels are compact chips. Lines that start with a dish name now start with a capital everywhere.
- 2026-10-29: season two opener "Cruising Altitude" (js/levels/plane.js, case c8, unlocked after case 6). A seated crowd mode: passengers keep their seats facing forward (blind spot behind), the seatbelt sign decides when you may walk the aisle and standing with it on costs Aura, the flight attendant patrols, Uncle Gary was in the lavatory (the latecomer), turbulence, landing call. Levels now describe their crowd (standing, mingling, seated), speeds, labels and late-arrival wording instead of the engine checking for the elevator; levels can rename dishes (the eggs are a cheese omelette). Written case: Brad ate two omelettes on the flight home from the honeymoon and blamed the dog he bought a seat for; Rosa Delgado (buying Thornbury Tower) and Mr. Lindqvist (a rival nose) set up season two. Free Play and the daily case include the plane. Verified headlessly: c8 generates as written and solves, Free Play on the plane solves, all earlier cases unchanged.
