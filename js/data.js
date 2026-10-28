'use strict';
// Shared content: foods, cover-ups, the campaign (cases, rules, objectives, tips), difficulty,
// the Aura cost table, the pitch tour, and the level builder that turns a case into the live level.
const GAME_TITLE = 'WHO FARTED?';
const W = 1280, H = 720;

// stink: how bad it smells (sulfur). loud: how much gas volume, so how loud it tends to be.
const FOODS = [
  { id: 'eggs', name: 'deviled eggs', smell: 'rotten eggs', stink: 1.0, loud: 0.15, wrapper: 'a napkin smeared with deviled-egg filling',
    science: 'Egg protein is rich in sulfur. Gut bacteria turn it into hydrogen sulfide, the main stink in a fart. Not much volume, so these tend to be silent but deadly.' },
  { id: 'chili', name: 'three-bean chili', smell: 'chili beans', stink: 0.45, loud: 1.0, wrapper: 'an empty chili cup with a plastic spoon',
    science: 'Beans feed gut bacteria lots of carbohydrate, which makes lots of gas. Most of it is odourless hydrogen and carbon dioxide. Loud, but not the worst smell.' },
  { id: 'broccoli', name: 'broccoli quiche', smell: 'boiled cabbage', stink: 0.75, loud: 0.6, wrapper: 'a foil quiche tin with green crumbs',
    science: 'Broccoli and cabbage do both: plenty of gas from fibre, plus some sulfur. Medium volume, medium-high stink.' },
  { id: 'garlic', name: 'garlic knots', smell: 'garlic', stink: 0.7, loud: 0.35, wrapper: 'a greasy paper bag of garlic-knot crumbs',
    science: 'Garlic and onions produce methanethiol and dimethyl sulfide, a different sulfur smell from eggs. You can tell them apart.' },
  { id: 'tuna', name: 'a tuna melt', smell: 'old fish', stink: 0.9, loud: 0.25, wrapper: 'a tuna melt wrapper, still warm',
    science: 'Fish protein is another sulfur source, so expect hydrogen sulfide. Usually quiet and nasty.' },
  { id: 'shake', name: 'a protein shake', smell: 'sulfury vanilla', stink: 0.95, loud: 0.3, wrapper: 'an empty shaker bottle that smells of vanilla and sulfur',
    science: 'Protein powder is concentrated protein. More protein reaching the gut means more hydrogen sulfide.' },
  { id: 'cheese', name: 'the blue cheese platter', smell: 'gym socks', stink: 0.8, loud: 0.4, special: true, wrapper: 'a chewed rind of blue cheese',
    science: 'Dogs are not built for blue cheese. Dairy plus a dog digestive system is a weapon.' },
  { id: 'peas', name: 'pureed peas', smell: 'sour milk', stink: 0.6, loud: 0.5, special: true, wrapper: 'an empty jar of pureed peas',
    science: 'Babies swallow air when they feed, and peas bring fibre. Small body, surprising output.' },
];
const foodById = (id) => FOODS.find((f) => f.id === id);
const HUMAN_FOODS = () => FOODS.filter((f) => !f.special && (!L.foods || L.foods.includes(f.id)));

const COVERS = [
  { id: 'fan', label: 'fanning the air behind them', anim: 'fan', bubble: null },
  { id: 'perfume', label: 'spraying perfume around', anim: 'spray', bubble: null },
  { id: 'blamedog', label: 'blaming someone else loudly', anim: 'point', bubble: null },
  { id: 'cough', label: 'fake coughing', anim: 'cough', bubble: '*COUGH* *COUGH* *ahem*' },
  { id: 'arms', label: 'loudly changing the subject', anim: 'arms', bubble: null },
];

// ---------------- the Aura economy ----------------
// Aura only drops when someone SEES (or hears) you do something a real person would find odd.
const COSTS = {
  sniff: 6, search: 18, squeeze: 3, camera: 6, mentionFirst: 40, silentTalk: 4, nosy: 4,
  gurgle: 8, audible: 30, forced: 50, rumorRelief: 6, calmRelief: 35,
};

const DIFFICULTY = {
  easy: { label: 'Easy', clock: 0.75, aura: 0.6, sv: 5, hints: true },
  normal: { label: 'Normal', clock: 1, aura: 1, sv: 3, hints: true },
  hard: { label: 'Hard', clock: 1.15, aura: 1.3, sv: 1, hints: false },
};

// ---------------- campaign rules ----------------
// Every mechanic can be switched on per case, so each case teaches a little more.
const RULES_ALL = {
  badges: true, questions: ['food', 'where', 'gossip', 'smell', 'rumor'], lies: true, search: true, aura: true, smellVision: true,
  folklore: true, guide: true, whispers: true, gossip: true, tells: true, sweat: true, deflect: true, tummy: true, clench: true,
  photo: true, rumors: true, confront: true, board: true, accuse: 'cross',
};
const R1 = { ...RULES_ALL, questions: ['food'], lies: false, search: false, aura: false, smellVision: false, folklore: false, guide: false,
  whispers: false, gossip: false, tells: false, sweat: false, deflect: false, tummy: false, clench: false, photo: false, rumors: false,
  confront: false, board: false, accuse: 'point' };
const R2 = { ...R1, lies: true, search: true, aura: true, accuse: 'proof' };
const R3 = { ...R2, questions: ['food', 'where', 'gossip', 'smell'], smellVision: true, folklore: true, guide: true };
const R4 = { ...R3, badges: false, whispers: true, gossip: true, tells: true, sweat: true, deflect: true, tummy: true };
const R5 = { ...R4, clench: true, photo: true, accuse: 'cross' };
const R6 = { ...RULES_ALL, badges: false };

// Objectives: what the Case File shows. check(G) ticks them; hint explains how.
const OBJECTIVES = {
  reactions: { label: 'Watch who reacts first', check: (G) => G.know.reactions.length >= 2,
    hint: 'When it happens, the people closest smell it first. Numbers pop up over their heads in the order they react.' },
  smell: { label: 'Work out what the smell is', check: (G) => G.know.smell,
    hint: 'Press Q to sniff, or just stand in the cloud until you catch it.' },
  askFood: { label: 'Ask everyone what they ate', check: (G) => G.npcs.filter((n) => !n.def.dog && n.present && G.cs.fartZone[n.id]).every((n) => G.know.claims[n.id]),
    hint: 'Walk up to someone, press E, and ask "What did you eat today?"' },
  search: { label: 'Search a bag without being seen', check: (G) => Object.keys(G.know.bags).length > 0,
    hint: 'Stand next to a bag and HOLD E. Wait until the eye over your head shows nobody watching.' },
  liar: { label: 'Catch someone lying', check: (G) => G.clues.some((c) => c.kind === 'contradiction'),
    hint: 'Someone lied about what they ate. Compare their answer with what is in their bag, or with what a witness saw.' },
  law: { label: 'Let someone else mention the smell', check: (G) => G.mentioned && G.mentionBy !== 'player', fail: (G) => G.mentionBy === 'player',
    hint: 'Playground law: whoever smelt it, dealt it. Do not be the first to bring up the smell. Someone else will.' },
  where: { label: 'Work out where it started', check: (G) => G.clues.some((c) => c.zone === G.cs.origin.id && (c.implicates || []).length),
    hint: 'Ask people "Where were you standing?" and compare with who reacted first. Smell Vision (V) shows where the cloud is thickest.' },
  overhear: { label: 'Overhear a whisper', check: (G) => G.clues.some((c) => /^Overheard/.test(c.text)),
    hint: 'People whisper what they know to whoever is next to them. Stand close, ideally behind them, and listen.' },
  cover: { label: 'Spot the cover-up', check: (G) => G.clues.some((c) => c.kind === 'tell' || c.kind === 'deflect'),
    hint: 'Stay near the people around where it started. The culprit keeps doing one suspicious thing, and blames others in whispers.' },
  safe: { label: 'Deal with your own tummy', check: (G) => G.flags.releasedLoud, fail: (G) => G.flags.releasedBadly,
    hint: 'When your Tummy fills, wait for something LOUD (watch the top of the screen), then press F.' },
  photo: { label: 'Find the photo', check: (G) => G.clues.some((c) => c.kind === 'photo'),
    hint: "Someone was taking pictures when it happened. Their camera bag might have the shot." },
  call: { label: () => `Call it (${L.callWhen})`, check: (G) => G.objected,
    hint: 'When you are sure, press O and name the culprit. You must do it before time runs out.' },
};

// Contextual tips: shown once, the first time something happens, and they pause the game.
const TIPS = {
  fart: { title: 'Something happened', text: 'Smells spread out from where they start, so the people closest notice first. Watch the numbers that pop up over their heads.' },
  smell: { title: 'That smell is a clue', text: 'What someone ate decides what it smells like. Now find out who ate it: walk up to people and press E to talk.' },
  claim: { title: 'Two suspects?', text: 'More than one person might have eaten it. The one standing closest to where it started, the one who reacted early, is your culprit.' },
  callPoint: { title: 'Time to call it', text: 'The doors are about to open. Press O and point at whoever did it.' },
  watched: { title: 'Someone can see you', text: 'The eye over your head shows how many people are watching. Odd behaviour only costs Aura if someone sees it. Everyone faces the doors, so behind them is a blind spot.' },
  bag: { title: 'Bags do not lie', text: 'HOLD E next to a bag to search it. Searching is odd behaviour, so check the eye first: zero watching means free.' },
  contradiction: { title: 'Caught a lie', text: 'Their story does not match the evidence. Hang on to that clue: when you call it, you will need proof.' },
  callProof: { title: 'Time to call it', text: 'This time you need proof. Point at the culprit, then pick the clue that shows it was them.' },
  law: { title: 'Playground law', text: 'New rule: whoever smelt it, dealt it. Do NOT be the first to mention the smell, or people will decide it was you. Wait for someone else.' },
  mention: { title: 'It is out in the open', text: 'Someone said it. Now it is safe for you to ask people about the smell. Try "Where were you standing?" too.' },
  smellvision: { title: 'Smell Vision', text: 'Press V to see where the cloud is thicker than the rest of the room. You only get a few charges, so use them early.' },
  late: { title: 'A latecomer', text: 'Someone got on after it happened, so they cannot be the culprit. But they might have seen something earlier. Ask "Seen anything weird?"' },
  badgesOff: { title: 'No more training wheels', text: 'From now on there are no numbers over heads. Watch faces: green and gagging means they just smelled it.' },
  whisper: { title: 'Whispers', text: 'People whisper what they know. Stand close, unseen, and you will overhear it for free.' },
  tell: { title: 'That looked odd', text: 'The culprit keeps doing one suspicious thing to cover it up. Nervous innocent people sweat too, so do not jump to conclusions.' },
  tummy: { title: 'Uh oh', text: 'You need to go too. Wait for something LOUD (it flashes at the top), then press F. Do it in silence and everyone hears.' },
  rumble: { title: 'RUMBLE', text: 'Your stomach is growling. HOLD C to clench before anyone hears it.' },
  photo: { title: 'Photo evidence', text: 'A picture from the exact moment it happened. It proves who was standing where.' },
  vows: { title: 'Silence', text: 'The vows. Talking now gets noticed. Seated guests face the altar, so the aisles behind them are a blind spot.' },
  cross: { title: 'Cross-examination', text: 'The accused makes three statements. Press one to hear more. Present the clue that breaks it. Wrong evidence costs you.' },
  rumor: { title: 'Rumours', text: 'New: plant a rumour. Who the room already suspects decides how much they believe you at the end. The culprit is doing it too.' },
  confront: { title: 'Confronted', text: 'Someone is onto you. Stay calm. Denying it too hard, or quoting the rhyme, only makes it worse.' },
};

// The campaign. Each case: a setting, who is there, which rules are on, timing, the goal, and what it teaches.
const CASES = [
  { id: 'c1', setting: 'elevator', num: 1, title: 'Going Down', seed: 1103, cast: ['thornbury', 'dana', 'josh', 'chad'], rules: R1,
    timeline: { fart: 8, mention: Infinity, speakNow: 92, end: 110 }, loud: [], callWhen: 'before the lobby',
    goal: 'Four strangers, one small elevator, thirty floors down. Someone is about to ruin everyone\'s morning. Work out who before the doors open in the lobby.',
    learn: [['WASD', 'Walk', 'Or click where you want to stand.'], ['Q', 'Sniff', 'Work out what the smell is.'], ['E', 'Talk', 'Ask people what they ate.'], ['O', 'Call it', 'Point at the culprit.']],
    objectives: ['reactions', 'smell', 'askFood', 'call'], tips: ['fart', 'smell', 'claim', 'callPoint'] },
  { id: 'c2', setting: 'elevator', num: 2, title: 'Rush Hour', seed: 2205, cast: ['thornbury', 'dana', 'josh', 'chad', 'priya', 'leo'], rules: R2,
    timeline: { fart: 8, mention: Infinity, speakNow: 112, end: 130 }, loud: [], callWhen: 'before the lobby',
    goal: 'A fuller car this time, and somebody will lie to your face. Bags do not lie. Just do not get caught going through them.',
    learn: [['!', 'Liars', 'One person will lie about what they ate.'], ['Hold E', 'Search bags', 'Bags show what people really ate.'], ['👁', 'Aura', 'Odd behaviour costs reputation, but only if someone sees it.'], ['O', 'Call it with proof', 'Point, then show the clue.']],
    objectives: ['smell', 'askFood', 'search', 'liar', 'call'], tips: ['watched', 'bag', 'contradiction', 'callProof'] },
  { id: 'c3', setting: 'elevator', num: 3, title: 'Floor Nine', seed: 3303, cast: null, rules: R3,
    timeline: {}, loud: [], callWhen: 'before the lobby',
    goal: 'The whole car, plus someone who gets on halfway down. Find out where it started, and whatever you do, do not be the first to mention the smell.',
    learn: [['E', '"Where were you?"', 'Pin down where it started.'], ['V', 'Smell Vision', 'See where the cloud is thickest.'], ['!', 'Playground law', 'Whoever smelt it, dealt it.'], ['N', 'Field Guide', 'Which foods smell like what.']],
    objectives: ['smell', 'law', 'where', 'liar', 'call'], tips: ['law', 'smellvision', 'mention', 'late', 'callProof'] },
  { id: 'c4', setting: 'wedding', num: 4, title: 'The Rehearsal', seed: 4404, cast: ['mulligan', 'gary', 'brittany', 'brad', 'pemberton', 'kevin', 'biscuit'], rules: R4,
    timeline: { places: Infinity, procession: Infinity, vows: Infinity, speakNow: 138, end: 158, mention: 80 }, loud: null, callWhen: 'before the ceremony',
    speakNow: { who: 'mulligan', line: 'Places in one minute, everyone! If anyone has anything to say, say it now.', caption: 'Last chance before the ceremony. Press O to call it.' },
    goal: 'A chapel full of people who keep moving and keep whispering. The culprit is covering their tracks. And you have eaten something you regret.',
    learn: [['👂', 'Whispers', 'Stand close to overhear.'], ['?!', 'Cover-ups', 'The culprit acts suspicious. So do nervous people.'], ['F', 'Your tummy', 'Let it go only under something loud.']],
    objectives: ['smell', 'where', 'overhear', 'cover', 'safe', 'call'], tips: ['badgesOff', 'whisper', 'tell', 'tummy', 'mention', 'callProof'] },
  { id: 'c5', setting: 'wedding', num: 5, title: 'Til Death Do Us Fart', seed: 5506, cast: null, rules: R5,
    timeline: {}, loud: null, callWhen: 'at "speak now"',
    goal: 'The real thing. Mingling, then a ceremony with dead-silent vows. When the priest says "speak now", you cross-examine the culprit in front of everyone.',
    learn: [['📷', 'Photos', 'A picture of the exact moment.'], ['C', 'Clench', 'Hold C when your stomach rumbles.'], ['O', 'Cross-examination', 'Break their testimony, statement by statement.']],
    objectives: ['smell', 'where', 'liar', 'cover', 'photo', 'call'], tips: ['photo', 'rumble', 'vows', 'cross'] },
  { id: 'c6', setting: 'elevator', num: 6, title: 'Express Down', seed: 6606, cast: null, rules: R6,
    timeline: {}, loud: null, callWhen: 'before the lobby',
    goal: 'Everything you have learned, in thirty floors. The culprit is spreading rumours about you. Spread some of your own.',
    learn: [['E', 'Rumours', 'Tell people who you think did it.'], ['!!', 'Confrontations', 'Stay calm when someone accuses you.'], ['N', 'Smell Board', 'Lock in your full theory for a bonus.']],
    objectives: ['smell', 'law', 'where', 'liar', 'cover', 'call'], tips: ['rumor', 'confront'] },
];
const FREE_PLAY = (setting, seed) => ({ id: 'free-' + setting, setting, num: 0, title: 'Free Play', seed, cast: null, rules: R6, timeline: {}, loud: null,
  callWhen: setting === 'elevator' ? 'before the lobby' : 'at "speak now"', free: true,
  goal: 'Everything is on. Random case. Find who did it.', learn: [], objectives: ['smell', 'where', 'liar', 'cover', 'call'], tips: [] });

// The pitch tour (Presenter mode): each system announces itself the first time it appears.
const FEATURES = [
  { id: 'art', title: 'Cut-paper style', body: 'Construction-paper cutouts with stop-motion timing and eyebrows that do the acting.' },
  { id: 'levels', title: 'A campaign that teaches', body: 'Six cases, each introducing one to three mechanics, then Free Play with everything.' },
  { id: 'procedural', title: 'New culprit every case', body: 'Culprit, meal, smell, origin, lies and cover-up are generated from a case number.' },
  { id: 'gas', title: 'Live gas simulation', body: 'The fart is a fluid. It diffuses, rides air currents and drains out of vents and doors.' },
  { id: 'science', title: 'Real fart science', body: 'What someone ate decides how loud it was and how bad it smells.' },
  { id: 'noses', title: 'Nose height and tolerance', body: 'Kids, babies and dogs smell it first. The order people react in points to the origin.' },
  { id: 'audio', title: 'Spatial fart audio', body: 'Squeakers and trumpets are panned in stereo to where they happened.' },
  { id: 'vision', title: 'Vision and the eye', body: 'Everyone sees a slice of the room. The eye over your head shows who is watching right now.' },
  { id: 'aura', title: 'Aura instead of health', body: 'Your reputation is the fail state. Odd behaviour costs Aura, but only if someone sees it.' },
  { id: 'traits', title: 'Enforcers and blabbermouths', body: 'Some people notice everything. Some cannot keep a secret.' },
  { id: 'gossip', title: 'Gossip network', body: 'Suspicion spreads between people who stand together.' },
  { id: 'rumors', title: 'Rumours and room opinion', body: 'Everyone forms a theory. Plant one. The culprit is planting theirs.' },
  { id: 'folklore', title: 'Playground law', body: 'Smelt it, dealt it. Denied it, supplied it. Made the rhyme, did the crime.' },
  { id: 'interrogate', title: 'Interrogation and lies', body: 'Everyone tells the truth except the culprit.' },
  { id: 'eavesdrop', title: 'Overheard conversations', body: 'Stand close enough, unseen, and you get the clue for free.' },
  { id: 'snoop', title: 'Physical evidence', body: 'Hold to search a bag. It looks terrible if you are seen.' },
  { id: 'photo', title: 'Photo evidence', body: 'A photo from the exact moment it happened.' },
  { id: 'smellvision', title: 'Smell Vision', body: 'See where the cloud is thicker than the rest of the room.' },
  { id: 'pressure', title: 'You need to go too', body: 'Hold it, or let it go under a loud moment.' },
  { id: 'clench', title: 'Clench!', body: 'Hold C to clench before anyone hears your stomach.' },
  { id: 'board', title: 'The Smell Board', body: 'Fill-in-the-blanks deduction that only confirms a full, correct theory.' },
  { id: 'object', title: 'Call it out', body: 'Every case has its moment. Stakes scale with who you accuse.' },
  { id: 'trial', title: 'Cross-examination', body: 'Break the testimony with evidence, one statement at a time.' },
];

// ---------------- levels ----------------
const LEVELS = {};
let L = null, ZONES = [], CAST = [], HUMANS = [], VOICES = {}, IDLES = {}, TIMELINE = {}, LOUD_EVENTS = [], ALL_COVERS = [];
let PLAYER_SEAT = { x: 0, y: 0, face: 0 }, PLAYER_LOOK = null, RULES = RULES_ALL;

// A case becomes a level: the setting's content, with the case's cast, rules and timing on top.
function buildLevel(caseDef) {
  const base = LEVELS[caseDef.setting];
  const lv = Object.create(base);
  lv.caseDef = caseDef;
  lv.rules = caseDef.rules;
  lv.cast = caseDef.cast ? base.cast.filter((c) => caseDef.cast.includes(c.id)) : base.cast;
  lv.timeline = { ...base.timeline, ...caseDef.timeline };
  lv.loud = caseDef.loud || base.loud;
  lv.callWhen = caseDef.callWhen;
  if (caseDef.speakNow) lv.speakNow = caseDef.speakNow;
  lv.lateArrivals = (base.lateArrivals || []).filter((id) => lv.cast.some((c) => c.id === id));
  return lv;
}
function loadLevel(caseDef) {
  L = buildLevel(caseDef);
  ZONES = L.zones; CAST = L.cast; VOICES = L.voices; IDLES = L.idles;
  TIMELINE = L.timeline; LOUD_EVENTS = L.loud; RULES = L.rules;
  HUMANS = CAST.filter((c) => !c.dog).map((c) => c.id);
  ALL_COVERS = [...COVERS, L.scapegoat.cover];
  PLAYER_SEAT = L.player.seat; PLAYER_LOOK = L.player.look;
  return L;
}

const zoneById = (id) => ZONES.find((z) => z.id === id);
const zoneCenter = (z) => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 });
function zoneAt(p) {
  let best = null, bd = Infinity;
  for (const z of ZONES) {
    const dx = Math.max(z.x - p.x, 0, p.x - (z.x + z.w)), dy = Math.max(z.y - p.y, 0, p.y - (z.y + z.h));
    const d = Math.hypot(dx, dy);
    if (d < bd) { bd = d; best = z; }
  }
  return best;
}
// A standing spot inside a zone: feet in the lower part, away from the edges.
const spotIn = (z, r) => ({ x: z.x + z.w * (0.15 + 0.7 * r()), y: z.y + z.h * (0.3 + 0.6 * r()) });
const castById = (id) => CAST.find((c) => c.id === id);

if (typeof module !== 'undefined') module.exports = { W, H, FOODS, COVERS, LEVELS, CASES, loadLevel };
