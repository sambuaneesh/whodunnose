'use strict';
// Season two opener: the flight home. Everyone is strapped into a seat facing the front of the plane, so the
// rows behind you are a blind spot and the seatbelt sign decides when anyone can move. Call it before landing.
(() => {
  // Seen from the front of the cabin looking back: rows run up the screen, everyone faces us.
  // Two seats, an aisle, two seats. People are ~40 units wide, so seats are ~46 apart.
  const SX = [548, 594, 686, 732]; // left window, left aisle, right aisle, right window
  const ROWS = [372, 428, 484, 540, 596]; // feet of whoever sits there; row 1 is at the back
  const AISLE = 640;
  const CAB = { x0: 524, x1: 756, y0: 250, y1: 640 };
  const JUMP_SEAT = { x: 704, y: 296 }; // the crew seat in the rear galley
  const LAV = { x: 554, y: 262 };
  const SEAT_DEPTH = 84; // how tall a seat back looks: enough to hide the lap of whoever sits behind it, not their shoulders
  const BELT_OFF = 22, TURBULENCE = 96, BUMPS = 106;
  const SEATS = ROWS.flatMap((y, r) => SX.map((x, i) => ({ x, y, row: r + 1, side: i < 2 ? 'left' : 'right', window: i === 0 || i === 3 })));
  const PLAYER_SEAT = { x: SX[2], y: ROWS[2], face: Math.PI / 2 };
  const DOG_COVER = { id: 'scoot', label: 'scooting around in the carrier', anim: 'scoot', bubble: null };
  const seatbeltOn = (t) => t < BELT_OFF || t >= TURBULENCE;
  const nearestSeat = (p) => SEATS.reduce((a, s) => (Math.hypot(s.x - p.x, (s.y - p.y) * 1.3) < Math.hypot(a.x - p.x, (a.y - p.y) * 1.3) ? s : a), SEATS[0]);
  const inAisle = (p) => Math.abs(p.x - AISLE) < 24;

  LEVELS.plane = {
    id: 'plane', episode: 'Season 2 · Episode 1', title: 'Cruising Altitude', length: '~2.5 min',
    blurb: 'Five rows. One aisle. A seatbelt sign that decides when anyone can move. Somebody in economy has done something unforgivable.',
    mode: 'seated', npcPace: 0.7, walkSpeed: 80, stepLen: 15, gossipRate: 0.8, closeCamera: true, decals: false,
    short: 'Plane', place: 'Flight 404, economy', callWhen: 'before landing', failTitle: 'Banned from the airline', airText: 'Recycled air and coffee.',
    crew: 'marguerite', beltLine: 'Sir. SIR. The seatbelt sign is ON.',
    lateWhere: 'was in the lavatory when it happened', latePress: 'I was in the can! Ask anyone! Everyone heard!',
    tips: { late: { title: 'Out of the lavatory', text: 'Someone was in the lavatory when it happened, so they cannot be the culprit. But they might have seen something before take-off. Ask "Seen anything weird?"' } },
    zones: [
      { id: 'galley', name: 'Rear Galley', x: 524, y: 250, w: 232, h: 70, noSpawn: true },
      { id: 'backleft', name: 'Back Left Seats', x: 524, y: 320, w: 93, h: 136 },
      { id: 'backright', name: 'Back Right Seats', x: 663, y: 320, w: 93, h: 136 },
      { id: 'frontleft', name: 'Front Left Seats', x: 524, y: 456, w: 93, h: 176 },
      { id: 'frontright', name: 'Front Right Seats', x: 663, y: 456, w: 93, h: 176 },
      { id: 'aisle', name: 'Aisle', x: 617, y: 320, w: 46, h: 312, noSpawn: true },
    ],
    view: { x: 150, y: 110, w: 980, h: 551 },
    ranges: { notice: 40, overhear: 96, gossip: 100, talk: 110, search: 44, personal: 20, spacing: 50, depth: 0.45, itemOffset: null },
    bounds: { x0: 532, x1: 748, y0: 270, y1: 628 },
    // the seat rows are solid; you walk the aisle, and your own seat is open to you
    obstacles: ROWS.flatMap((y, r) => [
      { x: CAB.x0, y: y - 22, w: 93, h: 34 },
      r === 2 ? { x: SX[3] - 23, y: y - 22, w: CAB.x1 - SX[3] + 23, h: 34 } : { x: 663, y: y - 22, w: 93, h: 34 },
    ]),
    // anyone getting up goes by way of the aisle
    route(a, b) {
      if (Math.abs(a.y - b.y) < 20 || (inAisle(a) && inAisle(b))) return [b];
      const top = (p) => p.y < 320; // the galley is open floor
      if (top(a) && top(b)) return [b];
      return [{ x: AISLE, y: a.y }, { x: AISLE, y: b.y }, b];
    },
    // everyone is in a seat (the crew in the galley)
    fixSpot(p) { return p.y < 320 ? { ...JUMP_SEAT } : (({ x, y }) => ({ x, y }))(nearestSeat(p)); },
    companionSpot: (o) => ({ x: o.x < AISLE ? AISLE - 19 : AISLE + 19, y: o.y + 6 }), // the dog carrier pokes into the aisle
    itemAt(spot, c) {
      if (c.dog) return { x: spot.x, y: spot.y + 15 };
      if (spot.y < 320) return { x: spot.x + 26, y: spot.y + 4 };
      const s = nearestSeat(spot);
      return { x: s.side === 'left' ? AISLE - 21 : AISLE + 21, y: s.y + (s.window ? 8 : 18) }; // carry-ons stuffed under the seat, poking into the aisle
    },
    arrivalSpot(n, G) {
      const used = (s) => G.npcs.some((o) => o !== n && o.present && o.seat && Math.hypot(o.seat.x - s.x, o.seat.y - s.y) < 10) || (s.x === PLAYER_SEAT.x && s.y === PLAYER_SEAT.y);
      const free = SEATS.filter((s) => !used(s) && !SEATS.some((q) => q !== s && Math.abs(q.y - s.y) < 2 && q.side === s.side && used(q)));
      return { ...(free.find((s) => s.row === 1) || free[0] || SEATS[0]) };
    },
    // the crew walks the aisle while the sign is off; everyone else stays put
    roam(n, t) {
      if (n.id !== 'marguerite' || seatbeltOn(t) || t >= this.timeline.speakNow) return null;
      const leg = Math.floor((t - BELT_OFF) / 13) % 4;
      return leg === 1 ? { x: AISLE, y: ROWS[4] + 10 } : leg === 3 ? { x: AISLE, y: ROWS[1] + 10 } : null;
    },
    mustSit: seatbeltOn,
    player: { start: { x: PLAYER_SEAT.x, y: PLAYER_SEAT.y }, seat: PLAYER_SEAT, look: { body: '#f08a24', outfit: 'hoodie', pants: '#3a4a6a', shoes: '#f6efdf', skin: '#f3cfae', hair: '#2d1d10', hairStyle: 'messy', acc: 'none', scale: 1.0, voice: 300 } },
    nervous: ['brad'],
    cast: [
      { id: 'dana', name: 'Dana', role: 'Married on Saturday. HR, on holiday.', shame: 7, nose: 1.1, tol: 1.0, perception: 1.45, gossip: 1.0, trait: 'Enforcer: writes everything down',
        look: { body: '#3fa7a0', outfit: 'hawaiian', pants: '#e8dcc2', shoes: '#c9a46b', skin: '#c98e64', hair: '#2a1a12', hairStyle: 'bob', acc: 'glasses', features: ['lashes', 'earrings'], scale: 0.98, voice: 380 },
        item: { label: "Dana's carry-on tote", kind: 'tote', color: '#d9b26f' },
        stakes: 'Accusing the bride on her own honeymoon. She will write it down. In pen.' },
      { id: 'brad', name: 'Brad', role: 'Married on Saturday. Has not stopped smiling.', shame: 8, nose: 1.0, tol: 1.1, perception: 0.7, gossip: 0.8, trait: 'Too happy to notice anything',
        look: { body: '#3fa7a0', outfit: 'hawaiian', pants: '#c9b48a', shorts: true, shoes: '#6b4a2a', skin: '#f0c7a2', hair: '#3b2814', hairStyle: 'combed', acc: 'none', scale: 1.02, voice: 260 },
        item: { label: "Brad's backpack", kind: 'backpack', color: '#3a7bd5' },
        stakes: 'Accusing the groom, on the flight home from his honeymoon, with his wife one row away.' },
      { id: 'gary', name: 'Uncle Gary', role: "Groom's uncle. Nobody invited him on the honeymoon.", shame: 3, nose: 0.9, tol: 1.0, perception: 0.8, gossip: 1.2, trait: 'Was in the lavatory', late: true,
        look: { body: '#d2452f', outfit: 'hawaiian', pants: '#c9b48a', shorts: true, shoes: '#6b4a2a', skin: '#eab18d', hair: '#5c3a1c', hairStyle: 'mullet', acc: 'shades', features: ['stubble'], scale: 1.05, voice: 170 },
        item: { label: "Gary's cooler", kind: 'cooler', color: '#e8e8e8' },
        stakes: 'He was not even in his seat when it happened.' },
      { id: 'marguerite', name: 'Marguerite', role: 'Senior flight attendant. Thirty-one years.', shame: 6, nose: 1.3, tol: 1.2, perception: 1.5, gossip: 0.9, trait: 'Enforcer: sees the whole cabin',
        look: { body: '#1f3b73', outfit: 'blazer', inner: '#f3efe6', skirt: true, pants: '#1f3b73', shoes: '#1c1a1f', skin: '#a8714f', hair: '#1d1410', hairStyle: 'bun', acc: 'tie', tieColor: '#d9434f', features: ['lashes', 'earrings'], scale: 1.0, voice: 360 },
        item: { label: 'The crew bag', kind: 'satchel', color: '#1f3b73' },
        stakes: 'Accusing the crew, at thirty-six thousand feet. Bold.' },
      { id: 'lindqvist', name: 'Mr. Lindqvist', role: 'Window seat. Eye mask. Asleep?', shame: 5, nose: 0.8, tol: 1.2, perception: 0.35, gossip: 0.4, trait: 'Asleep. Probably.',
        look: { body: '#5b6b7a', outfit: 'suit', pants: '#3a4450', shoes: '#1c1a1f', skin: '#f3d9c4', hair: '#e8d6a0', hairStyle: 'combed', acc: 'sleepmask', tieColor: '#2e7d8f', features: ['stubble'], scale: 1.04, voice: 210 },
        item: { label: "Mr. Lindqvist's briefcase", kind: 'briefcase', color: '#2b2b2b' },
        stakes: 'Waking a sleeping stranger to accuse him. The whole row will take his side.' },
      { id: 'rosa', name: 'Rosa Delgado', role: 'Hotel owner. Flying in for a meeting.', shame: 6, nose: 1.0, tol: 1.0, perception: 1.1, gossip: 1.3, trait: 'Films everything out the window',
        look: { body: '#e0a33a', outfit: 'dress', shoes: '#7a3b1f', skin: '#c58c63', hair: '#3b2416', hairStyle: 'long', hold: 'phone', features: ['lashes', 'earrings'], scale: 1.0, voice: 410 },
        item: { label: "Rosa's handbag", kind: 'handbag', color: '#b5562c' },
        stakes: 'She owns the hotel you just stayed at, and she remembers faces.' },
      { id: 'biscuit', name: 'Biscuit', role: 'Has his own boarding pass.', shame: 1, nose: 2.0, tol: 2.6, dog: true, sprite: 'dog', perception: 0, gossip: 0, trait: 'Cannot testify', stayNear: 'brad',
        look: { body: '#c98d4b', scale: 0.9, voice: 700 },
        item: { label: "Biscuit's travel bag", kind: 'dogbed', color: '#c0392b' },
        stakes: 'Blaming the dog. On a plane. Where he cannot leave.' },
    ],
    foods: ['eggs', 'chili', 'broccoli', 'garlic', 'tuna'],
    // what economy calls each dish
    menu: {
      eggs: { name: 'the cheese omelette', wrapper: 'two empty foil omelette trays, stacked very neatly' },
      broccoli: { name: 'the veggie quiche', wrapper: 'a foil quiche tray with green crumbs' },
      chili: { name: 'the chili mac', wrapper: 'a chili-mac tray scraped completely clean' },
      garlic: { name: 'the garlic bread', wrapper: 'a greasy garlic-bread wrapper' },
      tuna: { name: 'the tuna sandwich', wrapper: 'a tuna sandwich wrapper, still very much a tuna sandwich wrapper' },
    },
    favoriteFood: { gary: 'chili' },
    preferredWitness: 'marguerite',
    scapegoat: {
      id: 'biscuit', food: 'cheese', cover: DOG_COVER, speaker: 'brad',
      petLabel: 'Pet Biscuit. Smell his breath.', open: 'Biscuit looks up from his carrier. He has his own boarding pass.',
      breath: (guilty) => guilty ? 'Biscuit wags. His breath smells like the cheese plate from the drinks cart. A LOT of cheese plate.' : 'Biscuit wags. His breath smells like kibble and jet fuel.',
      bedText: (guilty) => guilty ? 'a squeaky toy and the foil lid of a cheese plate.' : 'a squeaky toy, an airline blanket, and his own boarding pass.',
      witness: 'Biscuit got into the cheese plate when the cart went past. The whole plate.',
      blameLine: 'Ugh, BISCUIT! Bad dog!',
      testimony: { food: 'Biscuit only eats kibble. Special airline kibble!', zone: 'He was asleep in his carrier the whole flight!', cover: 'And he did NOT scoot. There is no room in there to scoot.' },
      outcome: { confess: '*Biscuit puts both paws over his face.*', reluctant: '*Biscuit slowly retreats into his carrier.*', unproven: '*Biscuit tilts his head. Nobody buys it.*', wrong: '*Biscuit looks deeply betrayed.*' },
      finale: (name) => `Then Biscuit squeezes out of his carrier, trots up the aisle to ${name}, sniffs once, and sits down. Oh no.`,
    },
    subjectChange: 'So! Has everyone seen the IN-FLIGHT MAGAZINE? Page forty is just SOCKS!',
    lateArrivals: ['gary'],
    photo: { source: 'item', owner: 'rosa', label: "Rosa's phone", caption: "Rosa's phone. She was filming the clouds when it happened." },

    gas: {
      rect: { x: 150, y: 110, w: 980, h: 551 }, amount: 170, diffusion: 900, swirl: 0.7,
      // cabin air comes in at the front and leaves at the back
      pushers: [{ x: AISLE, y: 640, strength: 3, falloff: 260, bias: { x: 0, y: -0.5 } }],
      vents: [{ x: 730, y: 236, pull: 4, falloff: 90, drain: 0.06, r: 26 }],
      doors: { lav: { x: LAV.x, y: LAV.y, push: 4, falloff: 50, drain: 0.25, r: 22 }, main: { x: CAB.x0 + 10, y: 650, push: 10, falloff: 70, drain: 0.6, r: 30 } },
      wall: (px, py) => px < CAB.x0 || px > CAB.x1 || py < CAB.y0 - 6 || py > 668,
    },
    pressureRate: 0.55,
    objectLabel: 'CALL IT!',
    objectSplash: { big: 'IT WAS YOU!', sub: 'The seatbelt sign dings. Every head in economy turns very slowly toward you.' },
    peaceText: 'The wheels touched down. Everyone clapped. Nobody will ever know. Except the farter.',
    music: 'muzak',

    timeline: { fart: 10, mention: 36, places: Infinity, vows: Infinity, speakNow: 140, end: 156, glanceFrom: 10 },
    loud: [
      { t: 4, dur: 4, label: 'The engines roar on the climb' },
      { t: BELT_OFF, dur: 2.5, label: 'DING. The seatbelt sign goes off.' },
      { t: 48, dur: 3, label: 'The drinks cart bangs into a seat' },
      { t: 72, dur: 3.5, label: "The captain's announcement crackles on" },
      { t: TURBULENCE, dur: 6, label: 'TURBULENCE. Everything rattles.' },
      { t: 124, dur: 3, label: 'Biscuit barks at a cloud' },
    ],
    mention: { who: 'gary', line: 'WHOA! Who opened the cheese plate back here?!', caption: 'Gary said it first, but he was in the lavatory when it happened. Playground law does not count people who were not there. Now everyone can talk about it.', exempt: true },
    speakNow: { who: 'speaker', line: 'Cabin crew, seats for landing.', caption: 'Final approach. Press O and call it before the wheels touch down.' },
    intro: 'Flight 404, climbing. The seatbelt sign is on.',

    quiet: () => false,
    phaseLabel(t) {
      const T = this.timeline;
      if (t >= T.speakNow) return this.caseDef && this.caseDef.reverse ? 'Landing. The cabin decides.' : 'Final approach. Call it now.';
      return t < BELT_OFF ? 'Climbing · Seatbelt sign on' : t < TURBULENCE ? 'Cruising · Seatbelt sign off' : t < BUMPS ? 'Turbulence · Seatbelt sign on' : 'Descending · Seatbelt sign on';
    },
    altitude(t) {
      const T = this.timeline;
      if (t < BELT_OFF) return Math.round((8000 + (t / BELT_OFF) * 28000) / 500) * 500;
      if (t < BUMPS) return 36000;
      return Math.max(0, Math.round((36000 * (1 - (t - BUMPS) / (T.speakNow + 8 - BUMPS))) / 500) * 500);
    },
    clockLabel(t) { const a = this.altitude(t); return a ? `${a.toLocaleString('en-US')} ft` : 'Landing'; },
    stampTime(t) { return `${this.altitude(t).toLocaleString('en-US')} ft`; },

    script(t, api) {
      const T = this.timeline;
      if (t >= 0) api.once('speakerActor', () => api.actor('speaker', { look: null, x: AISLE, y: 650 }));
      if (t >= 1.5) api.once('beltTip', () => api.tip('belt'));
      if (t >= BELT_OFF) api.once('beltOff', () => {
        api.caption('DING. The seatbelt sign is off. You can walk the aisle until the next bump.', 4);
        api.log('The seatbelt sign goes off.');
      });
      // Gary has been in the lavatory since before take-off
      if (t >= 30) api.once('garyOut', () => {
        api.door('lav', true); api.set('lavT', t);
        if (api.has('gary')) {
          api.caption('The lavatory door opens. Uncle Gary steps out, extremely pleased with himself.', 4);
          api.log('Uncle Gary comes out of the lavatory.');
          api.arrive('gary', { ...LAV });
        }
      });
      if (api.get('lavT') !== undefined && t >= api.get('lavT') + 4) api.once('lavShut', () => api.door('lav', false));
      if (t >= TURBULENCE) api.once('bumps', () => {
        api.caption('TURBULENCE. The seatbelt sign is back on. Get back to your seat.', 5);
        api.log('Turbulence. Seatbelt sign on.');
        api.say('marguerite', 'Everybody sit down! Seatbelts!', 3, 'shout');
      });
      if (t >= TURBULENCE && t < BUMPS && Math.sin(t * 9) > 0.7) api.shake(5);
      if (t >= BUMPS + 4) api.once('descent', () => { api.caption("We've begun our descent. The seatbelt sign stays on until landing.", 4); api.log('The descent begins.'); });
      if (t >= T.speakNow) api.once('landingMusic', () => api.music('tension'));
    },

    buildBackground: (ctx) => buildCabin(ctx),
    props(api) {
      const out = [];
      for (const s of SEATS) out.push({ y: s.y - 3, draw: (ctx) => drawSeat(ctx, s) });
      // the bulkhead in front of row five hides their knees, with the seatbelt sign on it
      const lit = seatbeltOn(api.time());
      out.push({ y: 652, draw: (ctx) => drawBulkhead(ctx, lit) });
      return out;
    },
    overlay(ctx, t, api) {
      // clouds slide past outside, the far side of the windows
      ctx.save();
      for (let i = 0; i < 9; i++) {
        const side = i % 2 ? 1 : -1, x = AISLE + side * (230 + ((i * 97) % 220)), sp = 22 + (i % 3) * 9;
        const y = 700 - (((t * sp) + i * 133) % 700);
        ctx.globalAlpha = 0.55; Art.paperEllipse(ctx, x, y, 46 + (i % 3) * 14, 16 + (i % 2) * 6, '#ffffff', 950 + i, { shadow: false, amp: 2 });
      }
      ctx.restore();
      // the lavatory sign: red while it is occupied
      const busy = api.get('lavT') === undefined;
      ctx.save(); ctx.fillStyle = busy ? '#ff4b3a' : '#4fd06a'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6;
      ctx.fillRect(LAV.x - 12, 178, 24, 6); ctx.restore();
    },

    idles: {
      dana: { bubble: '*writes in the honeymoon binder*' }, brad: { bubble: '*smiles at nothing*' }, gary: { bubble: '*opens a tiny hot sauce*' },
      marguerite: { bubble: '*counts the rows*' }, lindqvist: { bubble: '*snores, precisely*' }, rosa: { bubble: '*films a cloud*', anim: 'flash' }, biscuit: { bubble: '*sniffs the aisle*' },
    },
    bagFlavor: {
      dana: 'a binder labelled HONEYMOON INCIDENTS, sunscreen, and', brad: 'forty wedding thank-you cards, a neck pillow, and',
      gary: 'three tiny bottles of hot sauce, a snorkel, and', marguerite: 'a seating chart, a stain pen, and',
      lindqvist: 'a summit badge reading "L. LINDQVIST, CHIEF OLFACTORY OFFICER", earplugs, and', rosa: 'a contract with THORNBURY TOWER on the cover, sunglasses, and',
    },
    voices: {
      dana: {
        hello: 'Oh. Hi. Of course you are on this flight.',
        breakfast: 'I had {food}. I am on holiday. I am not documenting it.',
        where: 'In my seat, by the {zone}. I booked the cheapest fare. It does not let you sit together.',
        smell: '{Smell}. On my honeymoon. I am writing this down.',
        gossip: 'Off the record? Nothing is off the record, even on holiday. {fact}',
        gossipNone: 'Brad bought Biscuit his own seat. I found out at the gate. It is in the binder.',
        confront: 'I need to ask you about an incident in this cabin.',
        guilty: 'Fine. It was me. I will be filing a complaint against myself. On holiday.',
        reluctant: 'I am not able to confirm or deny that at this altitude.',
        innocent: 'I am on my HONEYMOON.',
        rumor: '{name}. Noted. Even on holiday, noted.',
      },
      brad: {
        hello: 'Hey! Hi! Best week of my life! I am fine! Everything is great!',
        breakfast: 'Just {food}! I eat healthy now. I am a husband.',
        where: 'In my seat! By the {zone}. Next to Biscuit. He has his own boarding pass.',
        smell: 'Oh no. Yes. {Smell}. Is that a bad omen? On a plane? That is a bad omen.',
        gossip: 'I am not supposed to notice anything this week, but {fact}',
        gossipNone: 'Mom texted me thirty times. She wants to know if Dana is "settling in".',
        confront: 'Dude. Was that you? On my honeymoon?',
        guilty: 'It was me. Please do not tell Dana. She is RIGHT THERE.',
        reluctant: 'I mean... maybe? Honeymoon food is very rich.',
        innocent: 'Me? I am a newlywed! Newlyweds do not do that!',
        rumor: '{name}? No way. Wait. Actually, yeah, way.',
      },
      gary: {
        hello: 'Hey hey! The elevator kid! You came on the honeymoon too? Me too! Nobody invited me either!',
        breakfast: '{food}, baby! Two of them! Airline food is underrated!',
        where: 'Wasn\'t even in my seat, pal! I was in the can the whole climb. Best seat on the plane.',
        smell: 'WHOO! {Smell}! At thirty-six thousand feet! Somebody\'s showing off!',
        gossip: 'Okay, real talk. {fact}',
        gossipNone: 'I snuck the cooler through security. Don\'t ask me how. I don\'t know how.',
        confront: 'Buddy. Pal. Was that you? You can tell Uncle Gary.',
        guilty: 'HA! Yeah, it was me! Gary does what Gary wants!',
        reluctant: 'Okay, MAYBE. Allegedly. I was mostly in the can.',
        innocent: 'I was IN THE BATHROOM, pal! I have an alibi! A loud one!',
        rumor: '{name}?! Ha! I KNEW it wasn\'t just me this time!',
      },
      marguerite: {
        hello: 'Can I help you, sweetheart? Thirty-one years. I see everything in this cabin.',
        breakfast: '{food}. Crew meal. In the galley. Standing up, like a professional.',
        where: 'In the {zone}. Where I always am, unless somebody needs something. Somebody always needs something.',
        smell: '{Smell}. Row by row, I will find out who.',
        gossip: 'I do not gossip. I report. {fact}',
        gossipNone: 'The man in the eye mask has been asleep since the gate. Or he wants us to think so.',
        confront: 'Sweetheart. I need to ask you something about the air in this cabin.',
        guilty: 'Fine. It was me. Thirty-one years, and the first one I could not hold.',
        reluctant: 'Crew do not discuss operational matters.',
        innocent: 'I have smelled everything there is to smell. That was not me.',
        rumor: '{name}. I had a feeling about row {name}.',
      },
      lindqvist: {
        hello: 'Mm? I was asleep. I am always asleep on planes. It is the only place nobody asks me to smell anything.',
        breakfast: '{food}. I think. I ate it with my eyes closed.',
        where: 'In the {zone}, with the mask on. Nothing to see, nothing to smell.',
        smell: '{Smell}. Hydrogen sulfide, maybe forty parts per billion. Not my problem. I am on holiday.',
        gossip: 'I sleep. I do not see. But I hear. {fact}',
        gossipNone: 'I gave the keynote at the summit. You asked a question about elevators. It was a good question. I hated it.',
        confront: 'Excuse me. I smell for a living. Was that you?',
        guilty: 'It was me. I would like this to remain off the record. I have a reputation.',
        reluctant: 'Scientifically, I cannot rule myself out.',
        innocent: 'I was ASLEEP. Asleep people cannot be blamed. That is the law, I think.',
        rumor: '{name}. Interesting. I will note it. Professionally.',
      },
      rosa: {
        hello: 'Hola! Wait. You are the Nose! From the video! You stayed at my hotel. Room 212. You opened every window.',
        breakfast: '{food}. Airline food is a crime. I run a hotel. I would know.',
        where: 'In the {zone}, filming the clouds. My guests love a cloud.',
        smell: '{Smell}. If this happened in my hotel, somebody would be fired.',
        gossip: 'In my business you notice everything. {fact}',
        gossipNone: 'I am flying in to buy a building on Monday. I cannot say which. Big. Old. Smells a little.',
        confront: 'Be honest with me. Was that you?',
        guilty: 'It was me. Do NOT tell my staff. I have a five-star rating.',
        reluctant: 'In hospitality we say: the guest is always right. Today I am the guest.',
        innocent: 'Me? I own a hotel. I have standards.',
        rumor: '{name}? I would never have them back at my hotel.',
      },
    },
  };

  // ---------------- art ----------------
  function buildCabin(ctx) {
    const { paper, paperRect, paperEllipse, INK } = Art;
    // sky below the plane, and the wings
    const sky = ctx.createLinearGradient(0, 110, 0, 661); sky.addColorStop(0, '#8cc3ea'); sky.addColorStop(1, '#bfe0f6');
    ctx.fillStyle = sky; ctx.fillRect(150, 110, 980, 551);
    for (let i = 0; i < 14; i++) paperEllipse(ctx, 170 + ((i * 173) % 940), 130 + ((i * 89) % 520), 40 + (i % 4) * 12, 12 + (i % 3) * 4, 'rgba(255,255,255,0.55)', 900 + i, { shadow: false, amp: 2 });
    for (const side of [-1, 1]) {
      const root = side < 0 ? CAB.x0 - 14 : CAB.x1 + 14, tip = AISLE + side * 470;
      paper(ctx, [[root, 430], [tip, 520], [tip, 548], [root, 600]], '#c9ced8', 930 + side, { stroke: INK, lw: 1.5, amp: 2 });
      paperRect(ctx, (root + tip) / 2 - 24, 548, 48, 34, '#9aa1ae', 935 + side, { stroke: INK, lw: 1.2, amp: 1 }); // engine
    }
    // the fuselage, cut away to show the cabin
    paperRect(ctx, CAB.x0 - 22, 134, CAB.x1 - CAB.x0 + 44, 570, '#eef0f4', 940, { stroke: INK, lw: 2, amp: 1.5 });
    // back wall of the cabin: the lavatory and the galley
    paperRect(ctx, CAB.x0, 150, CAB.x1 - CAB.x0, CAB.y0 - 150, '#d9cfbd', 941, { stroke: INK, lw: 1.2, amp: 1 });
    paperRect(ctx, LAV.x - 22, 168, 44, CAB.y0 - 170, '#b9ad97', 942, { stroke: INK, lw: 1.2, amp: 0.8 });
    ctx.fillStyle = INK; ctx.font = '700 7px "Lexend", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('LAVATORY', LAV.x, 196);
    paperEllipse(ctx, LAV.x + 14, 222, 2.5, 2.5, '#8a7f6a', 943, { shadow: false });
    paperRect(ctx, 600, 190, 150, 50, '#c4c8d0', 944, { stroke: INK, lw: 1.2, amp: 0.8 }); // galley counter
    for (let i = 0; i < 5; i++) paperRect(ctx, 606 + i * 29, 164, 24, 22, i % 2 ? '#aeb4bf' : '#9aa1ae', 945 + i, { stroke: INK, lw: 0.8, amp: 0.4 });
    paperRect(ctx, 612, 208, 34, 30, '#5f6878', 951, { stroke: INK, lw: 1, amp: 0.5 }); // the drinks cart, parked
    paperRect(ctx, 662, 206, 14, 18, '#7b4a2a', 952, { amp: 0.3, shadow: false }); // coffee pot
    // floor: carpet, and the lights down the aisle
    paperRect(ctx, CAB.x0, CAB.y0, CAB.x1 - CAB.x0, 420, '#4b5a7a', 953, { amp: 1 });
    ctx.save(); ctx.beginPath(); ctx.rect(CAB.x0, CAB.y0, CAB.x1 - CAB.x0, 420); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    for (let k = 0; k < 40; k++) { ctx.beginPath(); ctx.moveTo(CAB.x0, CAB.y0 + k * 12); ctx.lineTo(CAB.x1, CAB.y0 + k * 12 + 30); ctx.stroke(); }
    ctx.restore();
    paperRect(ctx, AISLE - 22, 320, 44, 340, '#55658a', 954, { amp: 0.6, shadow: false });
    for (let y = 330; y < 650; y += 22) for (const dx of [-19, 19]) { ctx.fillStyle = 'rgba(255,236,160,0.75)'; ctx.fillRect(AISLE + dx - 1, y, 2, 4); }
    // side walls with a window beside every row, and the row numbers above the aisle seats
    for (const [x0, x1] of [[CAB.x0 - 10, CAB.x0], [CAB.x1, CAB.x1 + 10]]) paperRect(ctx, x0, CAB.y0, x1 - x0, 410, '#cfd3db', 955 + x0, { amp: 0.4, stroke: INK, lw: 1 });
    ROWS.forEach((y, r) => {
      for (const x of [CAB.x0 - 16, CAB.x1 + 16]) { paperEllipse(ctx, x, y - 44, 6, 11, '#9cc9ec', 960 + r * 2 + (x > AISLE ? 1 : 0), { stroke: INK, lw: 1, amp: 0.4 }); }
      ctx.fillStyle = 'rgba(28,26,31,0.75)'; ctx.font = '700 9px "Lexend", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(r + 1), CAB.x0 - 16, y - 62); ctx.fillText(String(r + 1), CAB.x1 + 16, y - 62);
    });
    // front galley floor past the bulkhead, and the forward door
    paperRect(ctx, CAB.x0, 640, CAB.x1 - CAB.x0, 30, '#9aa1ae', 970, { amp: 0.6 });
    paperRect(ctx, CAB.x0 - 22, 630, 16, 46, '#c9ced8', 971, { stroke: INK, lw: 1.2, amp: 0.4 });
  }

  function drawSeat(ctx, s) {
    const { paper, paperRect, INK } = Art, x = s.x, y = s.y, top = y - SEAT_DEPTH, seed = 1000 + s.row * 10 + SX.indexOf(x);
    const hw = 18, r = 7; // a slim back with rounded shoulders, so the person in it reads first
    const back = [[x - hw, y - 12], [x - hw, top + r], [x - hw + r * 0.3, top + r * 0.3], [x - hw + r, top], [x + hw - r, top], [x + hw - r * 0.3, top + r * 0.3], [x + hw, top + r], [x + hw, y - 12]];
    paper(ctx, back, '#5d73a3', seed, { stroke: INK, lw: 1.2, amp: 0.5 });
    paperRect(ctx, x - 13, top + 3, 26, 10, '#efe9dc', seed + 1, { amp: 0.3, shadow: false }); // headrest cover
    paperRect(ctx, x - 20, y - 16, 40, 18, '#4d6293', seed + 2, { stroke: INK, lw: 1, amp: 0.4 }); // the cushion
  }

  function drawBulkhead(ctx, lit) {
    const { paperRect, INK } = Art, top = 652 - SEAT_DEPTH;
    for (const [x0, x1] of [[CAB.x0, AISLE - 23], [AISLE + 23, CAB.x1]]) paperRect(ctx, x0, top, x1 - x0, SEAT_DEPTH - 4, '#d9cfbd', 980 + x0, { stroke: INK, lw: 1.5, amp: 0.8 });
    // the seatbelt sign
    for (const cx of [CAB.x0 + 46, CAB.x1 - 46]) {
      paperRect(ctx, cx - 16, top + 10, 32, 18, '#26262c', 990 + cx, { amp: 0.3, stroke: INK, lw: 1 });
      ctx.save(); ctx.strokeStyle = lit ? '#ffcf4a' : '#55555c'; ctx.lineWidth = 2; if (lit) { ctx.shadowColor = '#ffcf4a'; ctx.shadowBlur = 6; }
      ctx.beginPath(); ctx.moveTo(cx - 9, top + 19); ctx.lineTo(cx - 3, top + 19); ctx.moveTo(cx + 3, top + 19); ctx.lineTo(cx + 9, top + 19);
      ctx.moveTo(cx - 3, top + 15); ctx.lineTo(cx + 3, top + 23); ctx.moveTo(cx - 3, top + 23); ctx.lineTo(cx + 3, top + 15); ctx.stroke(); ctx.restore();
    }
  }
})();
