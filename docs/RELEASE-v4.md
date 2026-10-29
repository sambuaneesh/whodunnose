# v4 release notes

## v4.1
- **Season two opener, "Cruising Altitude":** the flight home from the honeymoon. A new plane setting where everyone is strapped in facing forward, the seatbelt sign decides when you can walk the aisle, the flight attendant patrols, and you call it before landing. Two new characters set up season two.
- **A tidier screen:** speech bubbles, name tags and labels never overlap each other or the HUD; HUD cards fade when someone is behind them; the case file folds to one line; captions sit low like subtitles and move when you are standing there; the scene is framed above the action bar; crowds stagger so every face is visible.
- **Fixed:** glasses (two separate lenses) and sunglasses (they now hide the eyes). Briefings and the title screen fit on one screen. Results open at the top.
- Free Play and the daily case now include the plane.

## v4.0

v4 turns the v3 campaign into a written season with a bonus case, a daily case and achievements. Sound, characters, playtesting tools and phone support were all reworked.

## Story
- **Season One: Thornbury Tower.** Six authored cases over one week: an office elevator from Monday to Friday, a wedding on Saturday, and a finale back in the elevator on Monday. Each case has a fixed culprit and a reason they ate what they ate, a reason to lie, set decoys and witnesses, and lines written for that case. Each one sets up the next.
- **Briefings** open with a "previously" paragraph. **Results** say what really happened and what happened next. Finishing the season shows a closing card.
- **Recurring cast with arcs:** Josh goes from unpaid to paid. Dana from HR goes from the potluck to her own wedding. Mrs. Pemberton suspects you at the rehearsal and is exposed at the ceremony. Thornbury breaks his own potluck ban.
- **Free Play stays procedural**, and is unchanged.

## New ways to play
- **Bonus case, "You Dealt It":** you are the culprit. Choose when and where to let it go, gag convincingly, plant your empty cup in someone's bag, hush the witness and spread rumours. The room names someone at the lobby.
- **Daily case:** everyone gets the same case on a given date, alternating elevator and chapel, on Normal difficulty. It tracks a streak and gives a spoiler-free result to copy.
- **19 achievements**, with an unlock pop-up and a list on the title screen.

## Sound
- New audio engine: mixing buses, a compressor and a generated room reverb for each setting.
- Adaptive music with intensity layers, ducked under dialogue, plus stingers and end jingles.
- Richer synthesised sound: food-dependent farts, a distinct voice timbre per character, elevator and chapel ambience, footsteps and paper UI sounds.

## Characters
- Arms and sleeves, trousers, skirts, shoes, outfits and per-character features. Breathing idle and more expressions.
- **Fixed:** eyelids and eyebrows no longer draw over hair, glasses or neighbours. The floating "watching" eye moved into the HUD, zone names are painted on the floor, and reaction badges are smaller.

## Playtest tools
- Open the game with `?playtest=pullmyfinger` (or `#pullmyfinger`). Turn it off with `?playtest=off` or from Settings.
- Backquote (or F2) opens the panel:
  - Jump to any case or seed.
  - See the full truth of the case.
  - Pause, slow down or speed up time (×0.25 to ×4), and skip ahead.
  - God view: culprit, origin, gas, NPC theories and vision cones.
  - Cheats, live rule toggles and an audio meter.
- Shift-click to teleport.
- Playtest runs never touch progress or achievements.
- Presenter mode no longer unlocks cases. It only keeps the pitch tour and the skip key.

## Accessibility and devices
- **Phones held sideways:** a collapsible case file, a tighter HUD, no key hints on touch screens, and press-and-hold Search.
- **Remappable keys:** bindings use physical key positions, so WASD works on AZERTY. Clashing bindings swap, and the action bar shows your keys.
- **Colour:** no state is shown by colour alone.

## Consistency fixes
- The elevator descends thirty floors over each case's own length, and both stops happen at the right floors.
- Sal gets on at twenty-two, as he says.
- The chapel clock follows each case: the rehearsal is at 9:30.
- The bride is Dana everywhere: vows, bunting and dialogue.
- Tip, pitch and achievement wording now matches what actually happens.

## Performance
Frame work measured headlessly at 2x resolution: 1.3 to 3 ms median, under 6 ms at the 95th percentile.
