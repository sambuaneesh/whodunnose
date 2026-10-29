'use strict';
// Season two opener: the flight home. Everyone is strapped into a seat facing the front of the plane, so the
// rows behind you are a blind spot and the seatbelt sign decides when anyone can move. Call it before landing.
(() => {
  // A cutaway of the cabin from the side: the nose is off to the left, so everyone faces left, and the rows
  // behind them (to the right) are their blind spot. Far wall at the top with the windows, near side cut away.
  // Four lanes of seats run left to right: two on the far side, the aisle, two on the near side. Each lane
  // further away sits a little to the right, so heads in the same row do not hide each other.
  const FRONT = 404, REAR = 1004; // the front bulkhead and the rear wall
  const ROW_X = [474, 558, 642, 726, 810]; // row 1 (front) to row 5 (back)
  const LANES = [376, 422, 512, 558]; // far window, far aisle, near aisle, near window (feet)
  const AISLE = 467, GALLEY_X = 870;
  const skew = (y) => (558 - y) * 0.3; // how far right a seat sits for being further away
  const JUMP_SEAT = { x: 930, y: 420 }; // the crew seat in the rear galley
  const LAV = { x: 972, y: 452 }; // just outside the lavatory door
  const BELT_OFF = 22, TURBULENCE = 96, BUMPS = 106;
  const SEATS = ROW_X.flatMap((x, r) => LANES.map((y, i) => ({ x: Math.round(x + skew(y)), y, row: r + 1, lane: i, side: i < 2 ? 'right' : 'left', window: i === 0 || i === 3 })));
  const PLAYER_SEAT = { x: SEATS[2 * 4 + 2].x, y: LANES[2], face: Math.PI };
  const DOG_COVER = { id: 'scoot', label: 'scooting around in the carrier', anim: 'scoot', bubble: null };
  const seatbeltOn = (t) => t < BELT_OFF || t >= TURBULENCE;
  const nearestSeat = (p) => SEATS.reduce((a, s) => (Math.hypot(s.x - p.x, (s.y - p.y) * 1.6) < Math.hypot(a.x - p.x, (a.y - p.y) * 1.6) ? s : a), SEATS[0]);
  const inAisle = (p) => Math.abs(p.y - AISLE) < 22;
  const inGalley = (p) => p.x > GALLEY_X - 10;
  const FAR_TOP = 360, NEAR_BOT = 572; // the far wall's foot, and the near edge of the floor

  LEVELS.plane = {
    id: 'plane', episode: 'Season 2 · Episode 1', title: 'Cruising Altitude', length: '~2.5 min',
    blurb: 'Five rows. One aisle. A seatbelt sign that decides when anyone can move. Somebody in economy has done something unforgivable.',
    mode: 'seated', seatFace: Math.PI, npcPace: 0.7, walkSpeed: 80, stepLen: 15, gossipRate: 0.8, closeCamera: true, decals: false,
    short: 'Plane', place: 'Flight 404, economy', callWhen: 'before landing', failTitle: 'Banned from the airline', airText: 'Recycled air and coffee.',
    crew: 'marguerite', beltLine: 'Sir. SIR. The seatbelt sign is ON.',
    lateWhere: 'was in the lavatory when it happened', latePress: 'I was in the can! Ask anyone! Everyone heard!',
    tips: { late: { title: 'Out of the lavatory', text: 'Someone was in the lavatory when it happened, so they cannot be the culprit. But they might have seen something before take-off. Ask "Seen anything weird?"' } },
    // seat zones are named the way passengers say it, facing the front: the far side is their right
    zones: [
      { id: 'frontright', name: 'Front Right Seats', at: 'in the front right seats', x: FRONT, y: FAR_TOP, w: 280, h: 86 },
      { id: 'backright', name: 'Back Right Seats', at: 'in the back right seats', x: FRONT + 280, y: FAR_TOP, w: GALLEY_X - FRONT - 280, h: 86 },
      { id: 'aisle', name: 'Aisle', at: 'in the aisle', x: FRONT, y: 446, w: GALLEY_X - FRONT, h: 42, noSpawn: true },
      { id: 'frontleft', name: 'Front Left Seats', at: 'in the front left seats', x: FRONT, y: 488, w: 280, h: NEAR_BOT - 488 },
      { id: 'backleft', name: 'Back Left Seats', at: 'in the back left seats', x: FRONT + 280, y: 488, w: GALLEY_X - FRONT - 280, h: NEAR_BOT - 488 },
      { id: 'galley', name: 'Rear Galley', at: 'in the rear galley', x: GALLEY_X, y: FAR_TOP, w: REAR - GALLEY_X, h: NEAR_BOT - FAR_TOP, noSpawn: true },
    ],
    view: { x: 330, y: 214, w: 752, h: 423 },
    ranges: { notice: 40, overhear: 96, gossip: 100, talk: 104, search: 44, personal: 20, spacing: 40, depth: 0.45, itemOffset: null },
    bounds: { x0: FRONT + 12, x1: REAR - 14, y0: 372, y1: 566 },
    floor: { x: FRONT, y: FAR_TOP, w: REAR - FRONT, h: NEAR_BOT - FAR_TOP },
    // only the aisle, the galley and your own seat are open floor: the rows are solid
    obstacles: [
      { x: FRONT, y: FAR_TOP, w: GALLEY_X - FRONT - 6, h: 446 - FAR_TOP },
      { x: FRONT, y: 488, w: PLAYER_SEAT.x - 22 - FRONT, h: NEAR_BOT - 488 },
      { x: PLAYER_SEAT.x + 22, y: 488, w: GALLEY_X - 6 - PLAYER_SEAT.x - 22, h: NEAR_BOT - 488 },
      { x: PLAYER_SEAT.x - 22, y: PLAYER_SEAT.y + 14, w: 44, h: NEAR_BOT - PLAYER_SEAT.y - 14 },
    ],
    // anyone getting up goes by way of the aisle
    route(a, b) {
      if ((inAisle(a) || inGalley(a)) && (inAisle(b) || inGalley(b))) return [b];
      if (Math.abs(a.x - b.x) < 14) return [b];
      return [{ x: a.x, y: AISLE }, { x: b.x, y: AISLE }, b];
    },
    // everyone is in a seat (the crew in the galley)
    // (anyone else in the galley is standing in the queue for the lavatory)
    fixSpot(p) {
      if (!inGalley(p)) return (({ x, y }) => ({ x, y }))(nearestSeat(p));
      return Math.hypot(p.x - JUMP_SEAT.x, p.y - JUMP_SEAT.y) < 24 ? { ...JUMP_SEAT } : { x: U.clamp(p.x, GALLEY_X + 22, REAR - 26), y: U.clamp(p.y, 410, 556) };
    },
    pins: { marguerite: 'galley' },
    companionSpot: (o) => ({ x: o.x - 30, y: o.y < AISLE ? AISLE - 10 : AISLE + 14 }), // the dog carrier sits in the footwell, poking into the aisle
    itemAt(spot, c) {
      if (c.dog) return { x: spot.x, y: spot.y + 12 };
      if (inGalley(spot)) return { x: spot.x - 26, y: spot.y + 6 };
      const s = nearestSeat(spot);
      return { x: s.x - 28, y: s.y + 8 }; // carry-ons stuffed under the seat in front
    },
    arrivalSpot(n, G) {
      const used = (s) => G.npcs.some((o) => o !== n && o.present && o.seat && Math.hypot(o.seat.x - s.x, o.seat.y - s.y) < 10) || (s.x === PLAYER_SEAT.x && s.y === PLAYER_SEAT.y);
      const free = SEATS.filter((s) => !used(s));
      return { ...(free.find((s) => s.row === 5 && !s.window) || free.find((s) => s.row === 5) || free[0] || SEATS[0]) };
    },
    // the crew walks the aisle while the sign is off; everyone else stays put
    roam(n, t) {
      if (n.id !== 'marguerite' || seatbeltOn(t) || t >= this.timeline.speakNow) return null;
      const leg = Math.floor((t - BELT_OFF) / 13) % 4;
      return leg === 1 ? { x: ROW_X[0] + 10, y: AISLE } : leg === 3 ? { x: ROW_X[3], y: AISLE } : null;
    },
    mustSit: seatbeltOn,
    player: { start: { x: PLAYER_SEAT.x, y: PLAYER_SEAT.y }, seat: PLAYER_SEAT, look: { body: '#f08a24', outfit: 'hoodie', pants: '#3a4a6a', shoes: '#f6efdf', skin: '#f3cfae', hair: '#2d1d10', hairStyle: 'messy', acc: 'none', scale: 1.0, voice: 300 } },
    nervous: ['brad'],
    // people chatting, in Free Play (campaign cases have their own in js/story.js)
    banter: [
      ["brad", "dana", "Babe! Best week ever, right?", "It was lovely. I have filed it under 'lovely'."],
      ["rosa", "lindqvist", "Excuse me. Did you give the keynote at the summit?", "No. I am asleep."],
      ["gary", "brad", "Bradley! Honeymoon buddy! Hot sauce?", "Uncle Gary, how are you even on this flight?"],
      ["marguerite", "rosa", "Anything to drink, sweetheart?", "Anything that is not this coffee."],
    ],
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
      eggs: { name: 'the cheese omelette', wrapper: 'an empty foil omelette tray' },
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
      rect: { x: 330, y: 214, w: 752, h: 423 }, amount: 150, diffusion: 820, swirl: 0.7,
      // cabin air comes in at the front and leaves at the back
      pushers: [{ x: FRONT + 6, y: AISLE, strength: 3, falloff: 260, bias: { x: 0.5, y: 0 } }],
      vents: [{ x: GALLEY_X + 40, y: FAR_TOP + 4, pull: 4, falloff: 90, drain: 0.06, r: 26 }],
      doors: { lav: { x: LAV.x + 10, y: LAV.y - 30, push: 4, falloff: 50, drain: 0.25, r: 22 }, main: { x: FRONT - 10, y: NEAR_BOT - 20, push: 10, falloff: 70, drain: 0.6, r: 30 } },
      wall: (px, py) => px < FRONT - 2 || px > REAR || py < FAR_TOP - 40 || py > NEAR_BOT + 6,
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
      if (t >= 0) api.once('speakerActor', () => api.actor('speaker', { look: null, x: FRONT + 20, y: FAR_TOP }));
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
      const out = [], t = api.time();
      // a seat is a back behind its passenger and a cushion in front of their knees
      for (const s of SEATS) {
        out.push({ y: s.y - 2, draw: (ctx) => drawSeatBack(ctx, s) });
        out.push({ y: s.y + 1, draw: (ctx) => drawSeatFront(ctx, s) });
      }
      const lit = seatbeltOn(t);
      out.push({ y: FAR_TOP - 60, draw: (ctx) => drawSigns(ctx, lit) });
      out.push({ y: FAR_TOP - 59, draw: (ctx) => drawLavLight(ctx, api.get('lavT') === undefined || api.doorOpen('lav') > 0.1) });
      return out;
    },
    // clouds slide past the far windows
    overlay(ctx, t) {
      for (const [i, x] of ROW_X.entries()) {
        const wx = x + skew(LANES[0]) + 6, wy = 292;
        ctx.save(); ctx.beginPath(); ctx.ellipse(wx, wy, 13, 19, 0, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#9fd0f2'; ctx.fillRect(wx - 14, wy - 20, 28, 40);
        for (let k = 0; k < 2; k++) {
          const cx = wx + 30 - (((t * 26) + i * 37 + k * 41) % 60), cy = wy - 6 + k * 13;
          Art.paperEllipse(ctx, cx, cy, 11, 5, '#ffffff', 950 + i * 3 + k, { shadow: false, amp: 1 });
        }
        ctx.restore();
      }
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
        react: 'I am writing this down. In pen',
        breakfast: 'I had {food}. I am on holiday. I am not documenting it.',
        where: 'In my seat, {at}. I booked the cheapest fare. It does not let you sit together.',
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
        react: 'Is that a bad omen? It feels like a bad omen',
        breakfast: 'Just {food}! I eat healthy now. I am a husband.',
        where: 'In my seat! {at}, next to Biscuit. He has his own boarding pass.',
        smell: 'Oh no. Yes. {Smell}. Is that a bad omen? On a plane? That is a bad omen.',
        gossip: 'I am not supposed to notice anything this week. But okay. {fact}',
        gossipNone: 'Mom texted me thirty times. She wants to know if Dana is "settling in".',
        confront: 'Dude. Was that you? On my honeymoon?',
        guilty: 'It was me. Please do not tell Dana. She is RIGHT THERE.',
        reluctant: 'I mean... maybe? Honeymoon food is very rich.',
        innocent: 'Me? I am a newlywed! Newlyweds do not do that!',
        rumor: '{name}? No way. Wait. Actually, yeah, way.',
      },
      gary: {
        hello: 'Hey hey! The elevator kid! You came on the honeymoon too? Me too! Nobody invited me either!',
        react: 'Whoa! And I only just came OUT of the can!',
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
        react: 'Thirty-one years. Never this bad',
        breakfast: '{food}. Crew meal. In the galley. Standing up, like a professional.',
        where: '{at}. Where I always am, unless somebody needs something. Somebody always needs something.',
        smell: '{Smell}. Row by row, I will find out who.',
        gossip: 'I do not gossip. I report. {fact}',
        gossipNone: 'The man in the eye mask has been asleep since the gate. Or he wants us to think so.',
        confront: 'Sweetheart. I need to ask you something about the air in this cabin.',
        guilty: 'Fine. It was me. Thirty-one years, and the first one I could not hold.',
        reluctant: 'Crew do not discuss operational matters.',
        innocent: 'I have smelled everything there is to smell. That was not me.',
        rumor: '{name}. I had a feeling about that row.',
      },
      lindqvist: {
        hello: 'Mm? I was asleep. I am always asleep on planes. It is the only place nobody asks me to smell anything.',
        react: 'Mm. Forty parts per billion. Not my problem',
        breakfast: '{food}. I think. I ate it with my eyes closed.',
        where: '{at}, with the mask on. Nothing to see, nothing to smell.',
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
        react: 'In my hotel, somebody would be FIRED',
        breakfast: '{food}. Airline food is a crime. I run a hotel. I would know.',
        where: '{at}, filming the clouds. My guests love a cloud.',
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
    // sky all round, then the fuselage
    const sky = ctx.createLinearGradient(0, 214, 0, 637); sky.addColorStop(0, '#8cc3ea'); sky.addColorStop(1, '#c8e6f8');
    ctx.fillStyle = sky; ctx.fillRect(330, 214, 752, 423);
    for (let i = 0; i < 8; i++) paperEllipse(ctx, 350 + ((i * 173) % 720), 228 + ((i * 89) % 400), 36 + (i % 4) * 10, 10 + (i % 3) * 4, 'rgba(255,255,255,0.6)', 900 + i, { shadow: false, amp: 2 });
    // the fuselage: rounded roof, the far wall, the floor, and the skin below the cutaway
    paper(ctx, [[FRONT - 60, 250], [REAR + 40, 250], [REAR + 70, 300], [REAR + 70, 600], [REAR + 40, 640], [FRONT - 60, 640], [FRONT - 90, 600], [FRONT - 90, 300]], '#e9ecf2', 940, { stroke: INK, lw: 2, amp: 1.2 });
    // overhead bins along the far wall, then the wall itself with a window beside every row
    paperRect(ctx, FRONT, 238, REAR - FRONT - 30, 30, '#d7dbe4', 941, { stroke: INK, lw: 1.2, amp: 0.6 });
    ROW_X.forEach((x, i) => { ctx.strokeStyle = 'rgba(28,26,31,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 50, 242); ctx.lineTo(x + 50, 264); ctx.stroke(); paperRect(ctx, x + 14, 258, 14, 4, '#9aa1ae', 942 + i, { amp: 0.2, shadow: false }); });
    paperRect(ctx, FRONT, 268, GALLEY_X - FRONT, FAR_TOP - 268, '#cfd5df', 945, { stroke: INK, lw: 1, amp: 0.5 });
    ROW_X.forEach((x, i) => {
      const wx = x + skew(LANES[0]) + 6;
      paperEllipse(ctx, wx, 292, 16, 22, '#b9c1cf', 946 + i, { stroke: INK, lw: 1.2, amp: 0.3 });
      ctx.fillStyle = 'rgba(28,26,31,0.7)'; ctx.font = '700 9px "Lexend", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), wx, 330);
    });
    // floor: carpet with the aisle runner and its floor lights
    paper(ctx, [[FRONT, FAR_TOP], [GALLEY_X, FAR_TOP], [GALLEY_X, NEAR_BOT], [FRONT, NEAR_BOT]], '#4b5a7a', 953, { amp: 0.8 });
    paperRect(ctx, FRONT, AISLE - 16, GALLEY_X - FRONT, 34, '#5b6c92', 954, { amp: 0.5, shadow: false });
    for (let x = FRONT + 14; x < GALLEY_X; x += 24) for (const dy of [-15, 16]) { ctx.fillStyle = 'rgba(255,236,160,0.8)'; ctx.fillRect(x, AISLE + dy - 1, 5, 2); }
    // the rear galley: counter, ovens, the drinks cart, and the lavatory door
    paperRect(ctx, GALLEY_X, 268, REAR - GALLEY_X, NEAR_BOT - 268, '#d9cfbd', 960, { stroke: INK, lw: 1.2, amp: 0.6 });
    paperRect(ctx, GALLEY_X + 4, 270, 64, 92, '#c4c8d0', 961, { stroke: INK, lw: 1, amp: 0.5 });
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) paperRect(ctx, GALLEY_X + 9 + i * 30, 276 + j * 26, 24, 20, (i + j) % 2 ? '#aeb4bf' : '#9aa1ae', 962 + i * 2 + j, { stroke: INK, lw: 0.8, amp: 0.3 });
    paperRect(ctx, GALLEY_X + 10, 330, 22, 14, '#7b4a2a', 967, { amp: 0.3, shadow: false }); // coffee pot
    paperRect(ctx, LAV.x - 26, 274, 52, 150, '#b9ad97', 968, { stroke: INK, lw: 1.2, amp: 0.6 });
    ctx.fillStyle = INK; ctx.font = '700 7px "Lexend", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('LAVATORY', LAV.x, 300);
    paperEllipse(ctx, LAV.x + 16, 360, 3, 3, '#8a7f6a', 969, { shadow: false });
    paperRect(ctx, GALLEY_X + 6, 470, 40, 56, '#5f6878', 970, { stroke: INK, lw: 1, amp: 0.5 }); // the drinks cart, parked
    paper(ctx, [[GALLEY_X, NEAR_BOT - 70], [REAR, NEAR_BOT - 70], [REAR, NEAR_BOT], [GALLEY_X, NEAR_BOT]], 'rgba(0,0,0,0.06)', 971, { amp: 0.4, shadow: false });
    // the front bulkhead (with the curtain to business class) and the forward door
    paperRect(ctx, FRONT - 34, 238, 34, NEAR_BOT - 238, '#d9cfbd', 975, { stroke: INK, lw: 1.5, amp: 0.6 });
    paperRect(ctx, FRONT - 28, 380, 22, 150, '#8a2f3a', 976, { stroke: INK, lw: 1, amp: 0.8 });
    for (let k = 0; k < 4; k++) { ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.moveTo(FRONT - 24 + k * 5, 384); ctx.lineTo(FRONT - 24 + k * 5, 526); ctx.stroke(); }
    // the cut edge of the near wall and the skin below it
    paperRect(ctx, FRONT - 90, NEAR_BOT, REAR - FRONT + 160, 14, '#c3c9d4', 978, { stroke: INK, lw: 1.5, amp: 0.5 });
  }

  // A seat seen from the front: a padded back with a white headrest cover behind the passenger, then the
  // cushion edge and two armrests in front of their knees, so they read as sitting.
  function drawSeatBack(ctx, s) {
    const { paperRect, paper, INK } = Art, x = s.x + 3, y = s.y, seed = 1000 + s.row * 10 + s.lane, top = y - 66;
    paper(ctx, [[x - 19, y - 12], [x - 19, top + 8], [x - 15, top + 2], [x - 8, top], [x + 8, top], [x + 15, top + 2], [x + 19, top + 8], [x + 19, y - 12]], '#5d73a3', seed, { stroke: INK, lw: 1.2, amp: 0.4 });
    paperRect(ctx, x - 12, top + 3, 24, 10, '#efe9dc', seed + 1, { amp: 0.3, shadow: false });
  }
  function drawSeatFront(ctx, s) {
    const { paperRect, INK } = Art, x = s.x + 3, y = s.y, seed = 1200 + s.row * 10 + s.lane;
    paperRect(ctx, x - 20, y - 24, 40, 14, '#4d6293', seed, { stroke: INK, lw: 1, amp: 0.4 });
    for (const dx of [-24, 18]) paperRect(ctx, x + dx, y - 38, 7, 26, '#41557f', seed + 2 + dx, { stroke: INK, lw: 0.8, amp: 0.3 });
  }
  function drawSigns(ctx, lit) {
    const { paperRect, INK } = Art;
    // one seatbelt sign under the bins per row, and a big one on the bulkhead
    const sign = (cx, cy, k) => {
      paperRect(ctx, cx - 11 * k, cy - 6 * k, 22 * k, 12 * k, '#26262c', 990 + cx, { amp: 0.2, stroke: INK, lw: 1 });
      ctx.save(); ctx.strokeStyle = lit ? '#ffcf4a' : '#55555c'; ctx.lineWidth = 1.6 * k; if (lit) { ctx.shadowColor = '#ffcf4a'; ctx.shadowBlur = 6; }
      ctx.beginPath(); ctx.moveTo(cx - 7 * k, cy); ctx.lineTo(cx - 2 * k, cy); ctx.moveTo(cx + 2 * k, cy); ctx.lineTo(cx + 7 * k, cy);
      ctx.moveTo(cx - 2 * k, cy - 3 * k); ctx.lineTo(cx + 2 * k, cy + 3 * k); ctx.moveTo(cx - 2 * k, cy + 3 * k); ctx.lineTo(cx + 2 * k, cy - 3 * k); ctx.stroke(); ctx.restore();
    };
    for (const x of ROW_X) sign(x + 34, 274, 0.8);
    sign(FRONT - 17, 300, 1.2);
  }
  function drawLavLight(ctx, busy) {
    ctx.save(); ctx.fillStyle = busy ? '#ff4b3a' : '#4fd06a'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6;
    ctx.fillRect(LAV.x - 10, 282, 20, 5); ctx.restore();
  }
})();
