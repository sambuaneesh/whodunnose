# Who Farted? — design notes and research

A comedy deduction game. Someone farted at the worst possible moment. You work out who, then call it out in front of everyone, without anyone deciding it was you.

## Pillars

1. **Investigate.** The fart is a physical gas cloud. What someone ate decides how loud it was and how it smells. Everyone tells the truth except the culprit.
2. **Keep your aura.** Your reputation is the fail state. People see slices of the room, gossip about you, and apply playground law. You also need to go.
3. **Prove it.** Plant rumours to steer who the room suspects, then cross-examine the accused and break their testimony with evidence.

## Systems in the demo (v2)

| System | What it does | Where |
|---|---|---|
| Episodes | Each setting is a level module with its own rules, cast, timeline, art and set pieces | `js/levels/*.js` |
| Procedural cases | Culprit, meal, origin, lie, cover-up, decoys and witnesses from a case number; always solvable by three independent chains | `js/case.js` |
| Gas simulation | Diffusion + air currents + vents + doors on a 64×36 grid; level supplies walls and airflow | `js/gas.js` |
| Fart science | Food sets stink (gas amount) and loudness (fart type probabilities) | `FOODS` in `js/data.js` |
| Noses | Nose height and tolerance per character; reaction order points to the origin | `js/npc.js` |
| Vision cones + traits | Per-character perception (enforcers see further, notice more) and gossip rate (blabbermouths) | `CAST` entries |
| Aura + gossip | Witnessed actions raise suspicion; suspicion and opinions spread between people standing together | `js/game.js` |
| Room opinion + rumours | Every NPC keeps a theory; reactions, tells, mentions and your rumours feed it; it sets starting belief in the trial | `js/npc.js`, `js/game.js` |
| Eavesdropping | NPCs whisper what they know; stand close and you overhear it for free | `js/npc.js` |
| Photo evidence | A capture of the scene at the moment it happened (Kevin's camera / the elevator's security camera) | `takePhoto` in `js/game.js` |
| Pressure + clench | Your own need to go; release under loud moments; hold C during rumbles | `js/game.js` |
| Smell Board | Golden Idol-style fill-in-the-blanks with "one away" feedback | `js/ui.js` |
| Cross-examination | Three statements; press for more, present the clue that breaks each; wrong evidence costs belief and aura; one withdrawal allowed | `testimony` in `js/game.js` |
| Comic recap | Results show the fart-moment snapshot, the call-out snapshot and the final line | `js/ui.js` |

## Episodes

- **S1E1 Going Down (elevator, ~2.5 min).** Everyone faces the doors, so the back of the car is a blind spot. Talking and shuffling are noticed. Sal the pizza guy boards halfway: he cannot be the culprit, but he is the preferred witness. The doors open twice, venting gas. Call it before the lobby doors open.
- **S1E2 Til Death Do Us Fart (wedding, ~5 min).** Mingling, then places, the procession (the organ is the safest moment to let one go), silent vows, and "speak now or forever hold your peace" as the courtroom.

## Research that shaped the design

**Competitors (all fart-themed, none a detective game):** [Who Fart? on Steam](https://store.steampowered.com/app/3750310/Who_Fart/) (multiplayer hidden role, coming soon), [PRRRT...](https://boardgamematcher.com/game/prrrt) (board game with "shame values", which became our accusation stakes), [Bad Air Day](https://toucharcade.com/2011/02/21/bad-air-day-review/) (gas as physics, guests with different tolerances and nose heights), [Pizhe Xianzhi](https://boardgamematcher.com/game/pizhe-xianzhi).

**Deduction:** [The Case of the Golden Idol](https://www.gamedeveloper.com/design/case-of-the-golden-idol): judge partial progress, keep scenes minimal, give every suspect a plausible motive. [Return of the Obra Dinn](https://en.wikipedia.org/wiki/Return_of_the_Obra_Dinn) validates in groups of three to stop guessing. [Duck Detective](https://www.nintendoworldreport.com/review/66994) shows silly tone and real deduction can coexist.

**Courtroom:** Ace Attorney's press/present and the Perceive system; [Danganronpa](https://en.wikipedia.org/wiki/Danganronpa:_Trigger_Happy_Havoc) breaks statements with "truth bullets". Critics note cluttered debates make contradictions hard to find, so we keep testimony to three clear statements.

**Social stealth:** [SpyParty](https://spyparty.fandom.com/wiki/Behaviorism) (act like an NPC), [Untitled Goose Game](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-house-house-s-i-untitled-goose-game-i-) (jokes land when nobody is watching; readable NPC states), Hitman (overheard conversations, enforcers who see through you).

**Procedural mysteries:** [Shadows of Doubt](https://www.startmenu.co.uk/home/review-shadows-of-doubt) is criticised for clues that feel the same every run, so cases here mix clue types (bags, witnesses, overheard whispers, photos, tells, reactions, sound).

**Elevator behaviour:** riders face the doors, spread to the corners and stop talking ([NPR, "Why we behave so oddly in elevators"](https://www.npr.org/2012/12/24/167977420/why-we-behave-so-oddly-in-elevators)). That became the elevator's stealth rules.

**Fart science:** most fart gas is odourless; the smell is sulfur, mainly hydrogen sulfide, from sulfur-rich protein such as eggs, fish and meat; garlic produces methanethiol and dimethyl sulfide; beans produce lots of mostly odourless gas ([Mental Floss summary of the Minneapolis VA *Gut* study](https://www.mentalfloss.com/article/87818/foods-responsible-smelliest-farts), [ScienceNorway](https://www.sciencenorway.no/bacteria-digestive-tract-food-and-nutrition/why-do-farts-stink/2366392)). The in-game Field Guide keeps this simple and avoids numbers.

**Comedy:** [Thank Goodness You're Here!](https://www.gamedeveloper.com/design/-humor-is-all-we-ve-really-got-championing-absurdity-in-thank-goodness-you-re-here-) put comedy before mechanics. Here, comic beats are scripted on the timeline (the mention, the organ, the vows) so timing stays in the designer's hands.

**Art:** South Park's look comes from cut construction paper, later emulated digitally, with separate mouth shapes. We use jagged paper polygons with drop shadows, 8 fps pose-hopping, three mouth shapes for talking, and eyebrows for expression.

## What players love (research, iteration 3)

Read across reviews and essays on comedy and deduction games, October 2026:

- **Deduction they do themselves.** Reviewers of [The Case of the Golden Idol](https://www.pcgamer.com/best-story-2022-the-case-of-the-golden-idol) and the newer wave of detective games praise "asking the right questions ... and putting the clues together yourself" ([bit-tech](https://bit-tech.net/features/gaming/pc/the-10-best-detective-games/1)). We never auto-solve: the Smell Board and the accusation are the player's call.
- **A climax where you confront the culprit.** A common complaint is that detective games "lack a climactic moment where the detective confronts and accuses the true culprit". Every case ends in a public call-out, and from case 5 a cross-examination with a confession.
- **Characters you remember.** Golden Idol's mysteries were praised but its cast less so; [Duck Detective](https://gameluster.com/?p=105366) wins on characters ("from the gruff boss to the emotional receptionist, they were all great"). Ace Attorney fans love recurring characters and running gags ([Gameluster on The Great Ace Attorney](https://gameluster.com/gamelusters-2021-top-10-the-great-ace-attorney-chronicles/)). So the same people recur across the season and change because of what happens.
- **Comedy from doing, not telling.** [Untitled Goose Game](https://www.acmi.net.au/stories-and-ideas/untitled-goose-player-comedians/) "gives you the material to make your own jokes". Our systemic jokes (whispers, the playground law, getting caught in a bag) sit beside scripted timing (the mention, the organ, the vows).
- **Short runs you want to replay.** [Overboard!](https://www.pcgamer.com/uk/reverse-murder-mystery-overboard-is-a-deliciously-evil-twist-on-the-detective-genre) is loved for short, replayable runs and small checklist goals; it is also the model for the planned reverse case ("you dealt it").

What this changed: campaign cases are now authored rather than rolled, every lie has a motive, every case plants the next, and the debrief tells the story of what really happened.

## Season one: Thornbury Tower

You are a new junior analyst on the thirtieth floor of Thornbury & Partners. One week, one elevator, one wedding.

| Case | When | Culprit | Why they ate it | Why they lie | What it sets up |
| --- | --- | --- | --- | --- | --- |
| 1 Going Down | Mon 12:52 | Chad (protein shake) | Potluck "isn't in his macros" | He doesn't (no lies yet) | Thornbury cancels Dana's potluck and caters; Josh collects the food |
| 2 Rush Hour | Wed 5:04 | Josh (garlic knots) | Unpaid, no lunch money | The knots were stolen from the CEO's order | Josh gets paid; Dana starts a juice cleanse for her dress |
| 3 Floor Nine | Fri 4:47 | Dana (deviled eggs) | Broke her cleanse at her own send-off | The head of HR wrote the odour policy | Dana invites you to her wedding rehearsal |
| 4 The Rehearsal | Sat 9:30 | Brittany (broccoli quiche) | Sponsored "zero bloat" quiche, eaten live | Admitting it ends the sponsorship | Mrs. Pemberton decides you are trouble; the video goes viral |
| 5 Til Death Do Us Fart | Sat 10:58 | Mrs. Pemberton (tuna melt) | Refused Edna's eggs, ate in secret in the car | She blames Edna's eggs and the dog | The grandmothers make peace; Gary sends the couple home with chili |
| 6 Express Down | Mon 12:52 | Mr. Thornbury (chili) | Ate the potluck he banned | The CEO, in front of "the Nose"; he frames you | The potluck returns; you become Head of Air Quality |

Running threads: the car always stops at floor nine for nobody (Accounting calls it and takes the stairs, explained in case 3); Thornbury always stands in "his" back right corner (where case 6 starts); Pemberton always orders the tuna melt (case 4, then case 5); Gary's chili feeds the player's own tummy in cases 4 and 5 and the finale in case 6.

Each case's data lives in `js/story.js`: the fixed mystery (`fix`: culprit, meal, lie, decoys, witness, where people stood, witness and bag text), per-case voice lines and confessions (`say`), roles, the briefing, "what really happened" and "what happened next". Free Play stays fully procedural.

## Next steps

- Playtest with people who have not seen it: is the elevator readable in one run, and is the wedding too long?
- A "You dealt it" reverse episode: you farted, now frame someone.
- More episodes: job interview, funeral, yoga class, Zoom call with your mic on.
- Controller support and a proper settings menu.
