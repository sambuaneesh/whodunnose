# v2 audit and v3 redesign

**Status:** every section below is implemented in v3, except the items under "Still open" at the end.

v2 has good systems but no game around them. These are the problems found by playing it as a newcomer, and how v3 tackles each one.

## 1. Too much at once (screen overload)
| Problem | Fix in v3 |
|---|---|
| From second one: 8 action buttons, 2 meters, room pill, LOUD badge, cones, zone tags, 2 pitch pop-ups, 3 clue toasts, captions, stamps, bubbles | The HUD only shows what the current case has taught. Case 1 has three verbs and no meters |
| Pitch pop-ups are for investors, not players | Moved behind a **Presenter mode** setting, off by default |
| Clue toasts stack up to three | One compact toast at a time, plus a counter badge on the notebook |
| Zone labels, vision cones and suspicion marks are always on | Shown only once those mechanics are introduced |
| The dialogue panel covers half the screen | Compact dialogue box with fewer, clearer options |

## 2. No learning curve
| Problem | Fix |
|---|---|
| All 23 systems are live in the first level | A **6-case campaign**, each case introducing 1–3 mechanics, then Free Play with everything |
| No goal on screen | A **Case File** objectives panel, specific to each case, with ticks |
| No explanation when a mechanic appears | **Briefing card** before each case ("New this case") and short **contextual tips** that pause the game the first time something happens |
| Stuck players have no way forward | **Hint** button (H) that explains the next unticked objective |
| The ending doesn't teach | The results screen has a **"What you missed"** debrief and a **Next case** button |

## 3. Controls that bite
| Problem | Fix |
|---|---|
| E means talk OR search, depending on which is closer, so a bag search happens by accident and costs 20 Aura | **Tap E = talk** to people. **Hold E = search** a bag, with a progress ring, so it's always deliberate |
| No warning before a risky action | An **eye above your head** shows how many people can see you right now |
| No pause, settings or controls reference | **Esc pause menu** (resume, how to play, settings, restart, quit); settings saved locally |
| The game keeps running when the tab is hidden | Auto-pause |

## 4. Mechanics depth
| Problem | Fix |
|---|---|
| The culprit is passive apart from one repeated tell | The culprit **sweats when you stand close** (innocent nervous types sweat too) and **whispers blame** onto others, which you can overhear as evidence |
| Reaction order is invisible unless you read the log | **1, 2, 3 badges** pop over heads as people react |
| The trial evidence list has 30+ items | Statements are tagged by topic; the evidence list shows clues **about this person** first |
| The accusation is all-or-nothing from the start | The accusation grows over the campaign: **point** (cases 1), then **point + one proof** (2–4), then **cross-examination** (5–6) |

## 5. Progression and replay
| Problem | Fix |
|---|---|
| Nothing is saved; everything is unlocked | Campaign progress and best rank per case saved in the browser; the next case unlocks when you finish one |
| One difficulty | Free Play has Easy / Normal / Hard (clock speed, Aura costs, Smell Vision charges) |
| The presenter needs everything instantly | Presenter mode unlocks every case and turns the pitch tour on |

## The campaign

| # | Case | Setting | New mechanics | Accusation |
|---|---|---|---|---|
| 1 | Going Down | Elevator, 4 people | Walk, sniff, ask what they ate, reaction order | Point |
| 2 | Rush Hour | Elevator, 5 people | Someone lies · search bags (hold E) · Aura and the eye | Point + proof |
| 3 | Floor Nine | Elevator, full car + latecomer | "Where were you?" · Smell Vision · playground law · witnesses · Field Guide | Point + proof |
| 4 | The Rehearsal | Chapel, mingling | Moving crowds · overheard whispers · gossip · cover-ups and sweating · your own tummy and loud moments | Point + proof |
| 5 | Til Death Do Us Fart | Chapel, full ceremony | Ceremony phases and silent vows · photo evidence · clench · **cross-examination** | Cross-exam |
| 6 | Express Down | Elevator, everything | Rumours and room opinion · confrontations · Smell Board | Cross-exam |
| ∞ | Free Play | Either setting | Everything, random case numbers, difficulty | Cross-exam |

## 6. World realism and proportions
| Problem | Fix |
|---|---|
| The elevator car is ~780×520 units for people ~40 units wide: about 4× too big, so it reads as a room and isn't claustrophobic | Real proportions: a ~2.0 × 1.5 m car (~220×150 units) packed shoulder to shoulder, with a **camera that zooms in** so it fills the screen |
| Everything is drawn at one fixed scale for every setting | Each level defines a **view**; the camera maps it to the screen. Text, bubbles and labels are drawn at screen scale so they stay readable at any zoom |
| People walk through each other; the player walks through a packed elevator | Soft collisions between people; in the elevator, **squeezing past someone** is slow and gets noticed |
| Guests walk through chapel pews and stand on them | Pews are solid. Guests route through the aisles; random spots avoid pew rows |
| Bags in the elevator float at odd distances from their owners | Bags sit at their owner's feet, scaled to the car |
| The gas grid has the same coarse cells everywhere | The gas grid covers each level's view, so the small car gets fine cells and a believable, fast fill |

## 7. Balance: the Aura economy
v2 charged Aura for things that are not weird (walking during the vows, talking in the elevator) and showed no costs up front. v3 rule: **Aura only drops when someone sees you do something a real person would find odd.** Normal behaviour is always free, and suspicion fades while you act normal.

| Action | Cost (Normal) | Who it affects |
|---|---|---|
| Walking, standing, waiting | free | — |
| Asking what someone ate / where they stood | free | — |
| "Seen anything weird?" | +4 suspicion | the person you asked |
| Sniffing the air | 6 | everyone who sees you |
| Searching a bag | 18 (×1.5 if the owner sees) | everyone who sees you |
| Squeezing past someone in the elevator | 3 | the person you squeeze past |
| Staring into the security camera | 6 | everyone who sees you |
| Mentioning the smell first (playground law) | +40 suspicion | the person you told, then gossip |
| Talking during the silent vows | 4 | everyone who sees you |
| Stomach gurgle (failed clench) | 8 | everyone within earshot |
| Audible fart / forced fart | 30 / 50 | everyone within earshot |
| Planting a rumour (after it has been mentioned) | −6 suspicion | the person you told |
| Staying calm when confronted | −35 suspicion | the person confronting you |

- **Recovery:** suspicion fades at 0.15/s, and 0.45/s once you have gone 15 s without being seen doing anything odd.
- **Preview:** the eye over your head shows how many people can see you. Prompts for risky actions show the cost before you commit.
- **Difficulty** (Free Play): costs ×0.6 / ×1 / ×1.3; clock speed ×0.75 / ×1 / ×1.15; Smell Vision 5 / 3 / 1.

**Ranks are criteria, not opaque score thresholds**, and the results screen shows what each rank needs:

| Rank | Needs |
|---|---|
| S | Right culprit, full proof, Aura ≥ 80, no hints |
| A | Right culprit, full proof, Aura ≥ 50 |
| B | Right culprit, some proof |
| C | Right culprit, no proof |
| D | Didn't call it |
| F | Wrong person, or Aura ran out |

## Still open
- **Playtesting with new players.** Difficulty, timings and tip wording are tuned by design and automated runs only.
- **Touch controls.** Mouse and touch work for walking, talking and tapping buttons, but there is no on-screen joystick, and hold-to-search on touch means pressing and holding the bag.
- **Controller support** and remappable keys.
- **Colour-blind check** for the vision cones (orange and yellow) and Smell Vision (green and yellow).
- **More settings** beyond the two current ones, for example a reverse "you did it" episode.
