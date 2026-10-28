'use strict';
// Shared content (foods, cover-ups, pitch tour) plus the level registry. Level-specific
// globals (ZONES, CAST, VOICES, TIMELINE...) are swapped in by loadLevel().
const GAME_TITLE = 'WHO FARTED?';
const W = 1280, H = 720;

// stink: how bad it smells (sulfur). loud: how much gas volume, so how loud it tends to be.
// Based on real gut science: sulfur-rich protein (eggs, fish, meat) makes hydrogen sulfide and smells;
// beans make lots of mostly odourless gas; garlic makes a different sulfur gas.
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
    science: 'Protein powder is concentrated protein. More protein reaching the gut means more hydrogen sulfide. Gym bros, take note.' },
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

// The pitch tour: each system announces itself the first time the player meets it.
const FEATURES = [
  { id: 'art', title: 'Cut-paper style', body: 'Construction-paper cutouts with stop-motion timing, eyebrows that do the acting, and a TV-episode structure.' },
  { id: 'levels', title: 'Episodes', body: 'Each setting is an episode with its own rules. In the elevator everyone faces the doors and nobody talks. At the wedding there is a whole ceremony to survive.' },
  { id: 'procedural', title: 'New culprit every case', body: 'Culprit, meal, smell, origin, lies and cover-up are generated from a case number. Every run is a fresh mystery.' },
  { id: 'gas', title: 'Live gas simulation', body: 'The fart is a fluid. It diffuses, rides air currents and drains out of vents and doors. Where it spreads is evidence.' },
  { id: 'science', title: 'Real fart science', body: 'What someone ate decides how loud it was and how bad it smells. Beans are loud, eggs are silent and deadly. The Field Guide in your notebook explains it.' },
  { id: 'noses', title: 'Nose height and tolerance', body: 'Kids, babies and dogs smell it first. Grandma barely smells anything. The order people react in points to the origin.' },
  { id: 'audio', title: 'Spatial fart audio', body: 'Squeakers and trumpets are panned in stereo to where they happened. Silent-but-deadly cases give you nothing.' },
  { id: 'vision', title: 'Vision cones', body: 'Every guest sees a slice of the room. Snoop, sniff and wander only when nobody is looking.' },
  { id: 'traits', title: 'Enforcers and blabbermouths', body: 'Some people notice everything. Some cannot keep a secret. Learn who to avoid and who to use.' },
  { id: 'aura', title: 'Aura instead of health', body: 'Your reputation is the fail state. Weird behaviour costs Aura, but only if someone sees it.' },
  { id: 'gossip', title: 'Gossip network', body: 'Suspicion spreads between people who stand together. One witness becomes a rumour.' },
  { id: 'rumors', title: 'Rumours and room opinion', body: 'Everyone forms their own theory. Plant a rumour and watch it spread. Who the room already suspects decides how easily they believe you.' },
  { id: 'folklore', title: 'Playground law', body: 'Smelt it, dealt it. Denied it, supplied it. Made the rhyme, did the crime. Rules every player already knows.' },
  { id: 'interrogate', title: 'Interrogation and lies', body: 'Everyone tells the truth except the culprit. Cross-check their story against bags and witnesses.' },
  { id: 'eavesdrop', title: 'Overheard conversations', body: 'People whisper what they know to each other. Stand close enough, unseen, and you get the clue for free.' },
  { id: 'snoop', title: 'Physical evidence', body: "Bags hold what people really ate. Going through someone's handbag looks terrible if you're seen." },
  { id: 'photo', title: 'Photo evidence', body: 'A photo from the exact moment it happened. Who was standing where is now provable.' },
  { id: 'smellvision', title: 'Smell Vision', body: 'Three charges per case. See where the cloud is thicker than the rest of the room.' },
  { id: 'pressure', title: 'You need to go too', body: 'A second clock. Hold it in, or let it go under a loud moment. You are the detective and a suspect.' },
  { id: 'clench', title: 'Clench!', body: 'Your stomach rumbles. Hold C to clench before anyone hears it.' },
  { id: 'board', title: 'The Smell Board', body: 'Fill-in-the-blanks deduction. It confirms only when the whole theory is right and hints when you are one away.' },
  { id: 'object', title: 'Call it out', body: "Every episode has its moment: the wedding's 'speak now', the elevator's last floor. Stakes scale with who you accuse." },
  { id: 'trial', title: 'Cross-examination', body: 'The accused testifies. Press their statements, then present the clue that breaks each one. Wrong evidence costs you.' },
];

// ---------------- levels ----------------
const LEVELS = {};
let L = null, ZONES = [], CAST = [], HUMANS = [], VOICES = {}, IDLES = {}, TIMELINE = {}, LOUD_EVENTS = [], ALL_COVERS = [];
let PLAYER_SEAT = { x: 0, y: 0, face: 0 }, PLAYER_LOOK = null, FLOOR_TOP = 100;

function loadLevel(id) {
  L = LEVELS[id];
  ZONES = L.zones; CAST = L.cast; VOICES = L.voices; IDLES = L.idles;
  TIMELINE = L.timeline; LOUD_EVENTS = L.loud;
  HUMANS = CAST.filter((c) => !c.dog).map((c) => c.id);
  ALL_COVERS = [...COVERS, L.scapegoat.cover];
  PLAYER_SEAT = L.player.seat; PLAYER_LOOK = L.player.look; FLOOR_TOP = L.bounds.y0;
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
const castById = (id) => CAST.find((c) => c.id === id);

if (typeof module !== 'undefined') module.exports = { W, H, FOODS, COVERS, LEVELS, loadLevel };
