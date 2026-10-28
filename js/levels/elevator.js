'use strict';
// Episode 1: thirty floors down in an office elevator. Everyone faces the doors and nobody talks,
// so the back of the car is a blind spot. Someone gets on halfway. Call it before the lobby doors open.
(() => {
  // Real proportions: people are ~40 units wide (about half a metre), so this car is ~2.0 x 1.4 m.
  const CAR = { x0: 530, x1: 750, y0: 300, y1: 455 };
  const BABY_COVER = { id: 'face', label: 'making the poop face', anim: 'face', bubble: null };
  const floorAt = (t) => Math.max(0, 30 - Math.floor(t / 4.2));

  LEVELS.elevator = {
    id: 'elevator', episode: 'Season 1 · Episode 1', title: 'Going Down', length: '~2.5 min',
    blurb: 'Thirty floors. Seven strangers. Everyone faces the doors. Nobody says a word. Then someone does.',
    mode: 'elevator',
    zones: [
      { id: 'backleft', name: 'Back Left Corner', x: 530, y: 300, w: 110, h: 55 },
      { id: 'backright', name: 'Back Right Corner', x: 640, y: 300, w: 110, h: 55 },
      { id: 'middle', name: 'Center', x: 572, y: 355, w: 136, h: 50 },
      { id: 'frontleft', name: 'Front Left Corner', x: 530, y: 405, w: 110, h: 50 },
      { id: 'buttons', name: 'Button Panel', x: 640, y: 405, w: 110, h: 50 },
    ],
    // the camera frames the car tightly: it should feel cramped
    view: { x: 344, y: 172, w: 592, h: 333 },
    ranges: { notice: 34, overhear: 80, gossip: 75, talk: 62, search: 30, personal: 14, spacing: 28, itemOffset: { x: 15, y: 3 } },
    bounds: { x0: CAR.x0 + 10, x1: CAR.x1 - 10, y0: CAR.y0 + 14, y1: CAR.y1 - 4 },
    player: { start: { x: 612, y: 446 }, seat: { x: 612, y: 446, face: Math.PI / 2 }, look: { body: '#f08a24', outfit: 'hoodie', pants: '#3a4a6a', shoes: '#f6efdf', skin: '#f3cfae', hair: '#2d1d10', hairStyle: 'messy', acc: 'none', scale: 1.0, voice: 300 } },
    itemsAtFeet: true,
    nervous: ['josh'],
    cast: [
      { id: 'thornbury', name: 'Mr. Thornbury', role: 'CEO. Owns the building.', shame: 10, nose: 0.9, tol: 1.3, perception: 1.0, gossip: 0.4, trait: 'Nobody contradicts him',
        look: { body: '#3d4250', outfit: 'suit', pants: '#2c2f3a', shoes: '#4a2c1a', skin: '#f0c8a8', hair: '#d9d9d9', hairStyle: 'combed', acc: 'tie', features: ['bushybrows', 'wrinkles'], scale: 1.06, voice: 180 },
        item: { label: "Mr. Thornbury's briefcase", kind: 'briefcase', color: '#5a3a22' },
        stakes: 'Accuse the CEO wrongly and you will be working in the basement. Forever.' },
      { id: 'dana', name: 'Dana from HR', role: 'Human Resources. Always on duty.', shame: 7, nose: 1.1, tol: 1.0, perception: 1.45, gossip: 1.0, trait: 'Enforcer: writes everything down',
        look: { body: '#b5474b', outfit: 'blazer', inner: '#f3efe6', pants: '#3a3346', shoes: '#1c1a1f', skin: '#c98e64', hair: '#2a1a12', hairStyle: 'bob', acc: 'glasses', shirt: 'lanyard', features: ['lashes', 'earrings'], scale: 0.98, voice: 380 },
        item: { label: "Dana's tote bag", kind: 'tote', color: '#d9b26f' },
        stakes: 'Accusing HR of something. Bold. She will file a report either way.' },
      { id: 'josh', name: 'Josh the Intern', role: 'Unpaid. Carrying six coffees.', shame: 2, nose: 1.0, tol: 0.9, perception: 1.0, gossip: 2.2, trait: 'Blabbermouth',
        look: { body: '#86b2e0', outfit: 'shirt', pants: '#3b4a66', shoes: '#5a4632', skin: '#f2d0b0', hair: '#e3c26a', hairStyle: 'messy', acc: 'tie', tieColor: '#2f62b8', hold: 'coffee', features: ['freckles'], scale: 0.94, voice: 470 },
        item: { label: "Josh's backpack", kind: 'backpack', color: '#3a7bd5' },
        stakes: 'Blaming the intern. Everyone does it. Nobody will be impressed.' },
      { id: 'chad', name: 'Chad', role: 'Gym bro. Just did legs.', shame: 3, nose: 0.9, tol: 1.1, perception: 0.75, gossip: 1.2, trait: 'Not very observant',
        look: { body: '#ededed', outfit: 'tank', pants: '#2b2b2b', shorts: true, shoes: '#e74c3c', skin: '#d9a06e', hair: '#3a2a1a', hairStyle: 'buzz', hold: 'shaker', features: ['stubble'], scale: 1.12, voice: 190 },
        item: { label: "Chad's gym bag", kind: 'gymbag', color: '#2b2b2b' },
        stakes: 'The protein guy. Everyone already suspects him.' },
      { id: 'sal', name: 'Sal', role: 'Pizza delivery. Got on halfway down.', shame: 4, nose: 1.0, tol: 1.0, perception: 1.0, gossip: 1.6, trait: 'Got on after it happened', late: true,
        look: { body: '#c0392b', outfit: 'tee', pants: '#2d3a5a', shoes: '#2b2b2b', skin: '#e6b48c', hair: '#c0392b', hairStyle: 'cap', hold: 'pizza', features: ['mustache'], scale: 1.0, voice: 240 },
        item: { label: "Sal's pizza bag", kind: 'pizzabag', color: '#c0392b' },
        stakes: 'He was not even here when it happened.' },
      { id: 'priya', name: 'Priya', role: 'New mom. Has not slept in weeks.', shame: 6, nose: 1.1, tol: 1.0, perception: 1.1, gossip: 1.0, trait: 'Running on no sleep',
        look: { body: '#f2a65a', outfit: 'cardigan', inner: '#f7e3c8', pants: '#4a3a5a', shoes: '#6b4a3a', skin: '#b97a52', hair: '#1d1410', hairStyle: 'long', acc: 'none', features: ['bags', 'earrings', 'lashes'], scale: 0.97, voice: 420 },
        item: { label: "Priya's diaper bag", kind: 'tote', color: '#8fc3a6' },
        stakes: 'Accusing an exhausted new mother. The whole elevator will turn on you.' },
      { id: 'leo', name: 'Baby Leo', role: 'Eight months old. In a stroller.', shame: 1, nose: 1.8, tol: 1.6, dog: true, sprite: 'baby', perception: 0, gossip: 0, trait: 'Cannot testify', stayNear: 'priya',
        look: { body: '#9fd3f0', skin: '#c08a62', hair: '#1d1410', scale: 1.0, voice: 700 },
        item: { label: "Leo's stroller basket", kind: 'basket', color: '#9fd3f0' },
        stakes: 'Blaming the baby. Technically always plausible.' },
    ],
    foods: ['eggs', 'chili', 'broccoli', 'garlic', 'tuna', 'shake'],
    favoriteFood: { chad: 'shake' },
    preferredWitness: 'sal',
    scapegoat: {
      id: 'leo', food: 'peas', cover: BABY_COVER, speaker: 'priya',
      petLabel: 'Coo at Baby Leo. Discreetly sniff.', open: 'Baby Leo stares at you with enormous, judging eyes.',
      breath: (guilty) => guilty ? 'Leo giggles. The stroller smells like pureed peas. Strongly.' : 'Leo giggles. He smells like baby powder. Innocent baby powder.',
      bedText: (guilty) => guilty ? 'a rattle and an empty jar of pureed peas.' : 'a rattle, wipes, and one sock. Just the one.',
      witness: 'Baby Leo ate a whole jar of pureed peas up on thirty. Then he made a face.',
      blameLine: 'Oh no. Was that the BABY?',
      testimony: { food: 'Leo only had milk this morning! Only milk!', zone: 'He was asleep in his stroller the whole ride!', cover: 'And he did NOT make the face. He never makes the face.' },
      outcome: { confess: '*Leo makes the face again. Everyone sees it.*', reluctant: '*Leo giggles. That is basically a confession.*', unproven: '*Leo blows a raspberry. Nobody buys it.*', wrong: '*Leo starts crying. Everyone glares at you.*' },
      finale: (name) => `Then Leo points one tiny finger at ${name} and giggles. Oh no.`,
    },
    subjectChange: 'So! How about those QUARTERLY NUMBERS, everyone?!',
    lateArrivals: ['sal'],
    photo: { source: 'prop', x: 728, y: 318, label: 'Security camera', caption: 'Security camera still, the moment it happened', crop: { x: 508, y: 212, w: 264, h: 258 } },

    gas: {
      rect: { x: 344, y: 172, w: 592, h: 333 }, amount: 120, diffusion: 700, swirl: 0.6,
      pushers: [{ x: 640, y: 300, strength: 2.5, falloff: 120, bias: { x: 0, y: 0.3 } }],
      vents: [{ x: 557, y: 304, pull: 3, falloff: 70, drain: 0.05, r: 22 }],
      doors: { main: { x: 640, y: 458, push: 10, falloff: 70, drain: 0.6, r: 30 } },
      wall: (px, py) => px < CAR.x0 || px > CAR.x1 || py < CAR.y0 || py > CAR.y1,
    },
    pressureRate: 0.58,
    objectLabel: 'CALL IT!',
    objectSplash: { big: 'IT WAS YOU!', sub: 'The muzak keeps playing. Six faces turn very slowly toward you.' },
    peaceText: 'The doors opened. Everyone walked out. Nobody will ever know. Except the farter.',
    music: 'muzak',

    timeline: { fart: 8, mention: 41, places: Infinity, vows: Infinity, speakNow: 126, end: 142, glanceFrom: 8 },
    loud: [
      { t: 22, dur: 3.5, label: "Dana's phone rings. Loudly." },
      { t: 36, dur: 2.5, label: 'DING. The doors open.' },
      { t: 66, dur: 3, label: 'The muzak hits a key change' },
      { t: 92, dur: 2.5, label: 'DING. Nobody there.' },
      { t: 110, dur: 2.5, label: "Chad's shaker hits the floor" },
    ],
    mention: { who: 'sal', line: 'Oh WOW. What died in here?', caption: 'Sal said it first, but he only just got on. Playground law does not apply to people who were not there. Now everyone can talk about it.', exempt: true },
    speakNow: { who: 'speaker', line: 'Lobby. Doors opening shortly.', caption: 'Last floor. Press O and CALL IT before the doors open and everyone scatters.' },
    intro: 'Floor 30. Thirty floors down in a very small box. Everyone faces the doors.',

    quiet: () => false,
    phaseLabel(t) {
      const f = floorAt(t);
      if (t >= this.timeline.speakNow) return 'Lobby. Call it now.';
      return t < this.timeline.fart ? 'Going down' : `Going down · Floor ${f}`;
    },
    clockLabel(t) { const f = floorAt(t); return f === 0 ? 'L' : `▼ ${f}`; },
    stampTime(t) { return `Floor ${floorAt(t)}`; },

    script(t, api) {
      const T = this.timeline;
      if (t >= 0) api.once('speakerActor', () => api.actor('speaker', { look: null, x: 640, y: 300 }));
      if (api.changed('floor', floorAt(t)) && t > 1) api.floorTick();
      if (t >= 36) api.once('stop1', () => {
        api.door('main', true);
        if (api.has('sal')) {
          api.caption(`DING. Floor ${floorAt(t)}. The doors open and a pizza guy squeezes in.`, 3);
          api.log(`The doors open on floor ${floorAt(t)}. Sal gets on with a pizza.`);
          api.arrive('sal', { x: 640, y: 470 });
        } else {
          api.caption(`DING. Floor ${floorAt(t)}. Nobody gets on. Fresh air for a second.`, 3);
          api.log(`The doors open on floor ${floorAt(t)}. Nobody gets on.`);
        }
      });
      if (t >= 44) api.once('stop1close', () => api.door('main', false));
      if (t >= 92) api.once('stop2', () => {
        api.door('main', true);
        api.caption(`DING. Floor ${floorAt(t)}. Nobody is there. The doors stay open for a long, awkward moment.`, 4);
        api.log(`Floor ${floorAt(t)}: doors open, nobody gets on. Fresh air.`);
      });
      if (t >= 99) api.once('stop2close', () => api.door('main', false));
      if (t >= T.speakNow) api.once('lobbyMusic', () => api.music('tension'));
    },

    buildBackground: (ctx) => buildCar(ctx),
    props(api) {
      const open = api.doorOpen('main');
      return [{ y: CAR.y1 + 40, draw: (ctx) => drawDoors(ctx, open) }];
    },
    overlay(ctx, t, api) {
      // the floor indicator on the shaft wall, and the lit button
      const gt = api.time(), label = this.clockLabel(gt);
      Art.paperRect(ctx, 781, 280, 84, 30, '#1b1b1f', 901, { amp: 0.4, stroke: '#555', lw: 1 });
      ctx.save(); ctx.font = '400 17px "Bowlby One SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff4b3a'; ctx.shadowColor = '#ff4b3a'; ctx.shadowBlur = 6; ctx.fillText(label, 823, 296); ctx.restore();
      const f = floorAt(gt);
      ctx.save(); ctx.fillStyle = 'rgba(255,214,90,0.95)'; ctx.shadowColor = '#ffd65a'; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.arc(CAR.x1 + 7.5, 398 + (f % 6) * 7, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      const fl = Math.sin(t * 37) * Math.sin(t * 3.1);
      if (fl > 0.92) { ctx.fillStyle = 'rgba(20,20,40,0.12)'; ctx.fillRect(CAR.x0, CAR.y0, CAR.x1 - CAR.x0, CAR.y1 - CAR.y0); }
    },

    idles: {
      thornbury: { bubble: '*checks a very expensive watch*' }, dana: { bubble: '*writes something down*' },
      josh: { bubble: '*nearly drops a coffee*' }, chad: { bubble: '*flexes at the mirror*' },
      sal: { bubble: '*checks the pizza is still warm*' }, priya: { bubble: '*yawns enormously*' }, leo: { bubble: '*babbles*' },
    },
    bagFlavor: {
      thornbury: 'stock reports, a gold pen, and', dana: 'a binder labelled INCIDENTS, a stapler, and',
      josh: 'a phone charger with no phone, a lanyard, and', chad: 'resistance bands, a towel, and',
      sal: 'a receipt book, a stack of napkins, and', priya: 'wipes, a spare onesie, and',
    },
    voices: {
      thornbury: {
        hello: '...Yes? Is this about the merger? It is always about the merger.',
        breakfast: 'A working breakfast. {food}. In the boardroom. With the board.',
        where: 'I was in the {zone}. I always stand there. It is my corner.',
        smell: '{Smell}. Unacceptable. Someone is going to be restructured.',
        gossip: 'I make it my business to know things. {fact}',
        gossipNone: 'This elevator cost four million dollars. It should not smell like this.',
        confront: 'You. Mailroom? Accounts? Was that you?',
        guilty: 'Fine. It was me. This conversation is covered by your NDA.',
        reluctant: 'Let us say, hypothetically, that it was a strategic release.',
        innocent: 'Do you know who I AM?',
        rumor: '{name}. Interesting. I will be reviewing {name}\'s position.',
      },
      dana: {
        hello: "Hi! Dana, HR. Just so you know, this conversation may be documented.",
        breakfast: 'I had {food}. At my desk. As per the break policy.',
        where: 'By the {zone}. I noted the time, too.',
        smell: '{Smell}. I am opening an incident report as we speak.',
        gossip: "Off the record? Nothing is off the record. But: {fact}",
        gossipNone: 'Three people in this elevator have open complaints against them. I will not say who.',
        confront: 'I need to ask you a few questions about an incident on this elevator.',
        guilty: 'It was me. I will be filing a complaint against myself.',
        reluctant: 'I am not able to confirm or deny that at this time.',
        innocent: 'That is a serious allegation. I am writing it down.',
        rumor: '{name}. Noted. Formally noted.',
      },
      josh: {
        hello: "Oh hey! Sorry! Do you want a coffee? These are for the marketing team but they won't notice.",
        breakfast: 'I had {food}! Free leftovers from the 30th floor meeting! Best perk of the internship.',
        where: 'Uh, the {zone}? I think? I was balancing six coffees.',
        smell: 'Oh no, yeah. {Smell}. I nearly dropped everything.',
        gossip: "Oh, I hear EVERYTHING. Interns are invisible. {fact}",
        gossipNone: 'Mr. Thornbury called me Jeff this morning. My name is Josh.',
        confront: 'Hey, um, not to be weird, but... was that you?',
        guilty: "It was me. Please don't put it in my review.",
        reluctant: "I mean... maybe? I can't feel my body. I've been up since four.",
        innocent: "I'm an INTERN. I'm not allowed to fart. It's in the contract.",
        rumor: "{name}?! No way. I'm telling the group chat.",
      },
      chad: {
        hello: 'Sup. Leg day. Can\'t really bend my knees right now.',
        breakfast: '{food}, bro. Forty grams of protein. Minimum.',
        where: 'I was in the {zone}. Flexing. In the mirror. Like normal.',
        smell: 'Bro. {Smell}. That is NOT my gains.',
        gossip: "Bro, I'll be real with you. {fact}",
        gossipNone: 'I did not even notice there was a baby in here until like a minute ago.',
        confront: 'Bro. Was that you? Be honest, bro.',
        guilty: "Okay that was me, bro. It's the protein. It's science.",
        reluctant: 'Bro, I mean, it MIGHT have been the shake. The shake is strong.',
        innocent: 'Bro. BRO. My body is a temple.',
        rumor: '{name}? Bro. BRO. That tracks.',
      },
      sal: {
        hello: "Pizza for the lobby! Well, for a guy in the lobby. He's gonna love it. Who ordered pizza to the lobby?",
        breakfast: 'Me? Slice of {food} pizza. Off-menu. Do not ask.',
        where: "I wasn't even here, pal! I got on at twenty-one. Walked straight into it.",
        smell: '{Smell}. I deliver to a fish market and THIS is worse.',
        gossip: "I deliver to every floor. I see things. {fact}",
        gossipNone: "The guy in the lobby tips in coupons. I'm just saying.",
        confront: "Hey. I just got here and I already think it was you.",
        guilty: "It was... wait, I wasn't even here.",
        reluctant: "I wasn't even HERE.",
        innocent: "I got on at TWENTY-ONE! Do the math!",
        rumor: "{name}, huh? I could see that. I could totally see that.",
      },
      priya: {
        hello: "Hi. Sorry. I'm so tired. Is it still Tuesday?",
        breakfast: 'I had {food}. Standing up. With one hand. Like a raccoon.',
        where: 'I was in the {zone} with the stroller. I think. I may have been asleep standing up.',
        smell: '{Smell}. Honestly, after the diapers, I barely noticed.',
        gossip: "I haven't slept since March, but I'm not blind. {fact}",
        gossipNone: 'If anyone wakes this baby I will lose my mind.',
        confront: 'Please tell me that was you, so I know it was not the baby.',
        guilty: "It was me. I'm sorry. I don't even know what day it is.",
        reluctant: "...Can we just say it was the baby? No? Okay. It was me.",
        innocent: 'I have had four hours of sleep this WEEK.',
        rumor: '{name}? Honestly, as long as it was not the baby.',
      },
    },
  };

  function buildCar(ctx) {
    const { paper, paperRect, paperEllipse, INK } = Art;
    // the shaft around the car
    ctx.fillStyle = '#25232d'; ctx.fillRect(330, 160, 620, 360);
    ctx.strokeStyle = 'rgba(160,160,190,0.18)'; ctx.lineWidth = 1.5;
    for (const x of [400, 418, 862, 880]) { ctx.beginPath(); ctx.moveTo(x, 160); ctx.lineTo(x, 520); ctx.stroke(); }
    for (let y = 185; y < 510; y += 60) { paperRect(ctx, 350, y, 150, 6, '#3a3846', 700 + y, { amp: 0.5, shadow: false }); paperRect(ctx, 776, y + 30, 150, 6, '#3a3846', 800 + y, { amp: 0.5, shadow: false }); }
    // the car's ceiling frame
    paperRect(ctx, CAR.x0 - 15, 196, CAR.x1 - CAR.x0 + 30, 20, '#4a4a55', 599, { amp: 0.6, stroke: INK, lw: 1 });
    // back wall: wood panelling and a mirror rail
    paperRect(ctx, CAR.x0 - 15, 214, CAR.x1 - CAR.x0 + 30, 90, '#7a5638', 600, { amp: 1, stroke: INK, lw: 1 });
    paperRect(ctx, 572, 236, 136, 50, '#b9d4e6', 601, { amp: 0.6, stroke: '#7d8a99', lw: 1 });
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(584, 282); ctx.lineTo(606, 242); ctx.moveTo(596, 282); ctx.lineTo(614, 248); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(CAR.x0 + 4, 292); ctx.lineTo(CAR.x1 - 4, 292); ctx.stroke();
    // floor: carpet with a diamond pattern
    paperRect(ctx, CAR.x0, CAR.y0, CAR.x1 - CAR.x0, CAR.y1 - CAR.y0, '#3f5c63', 602, { amp: 0.8 });
    ctx.save(); ctx.beginPath(); ctx.rect(CAR.x0, CAR.y0, CAR.x1 - CAR.x0, CAR.y1 - CAR.y0); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
    for (let k = 300; k < 1000; k += 16) { ctx.beginPath(); ctx.moveTo(k, CAR.y0); ctx.lineTo(k + 160, CAR.y1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(k + 160, CAR.y0); ctx.lineTo(k, CAR.y1); ctx.stroke(); }
    ctx.restore();
    // side walls: brushed steel with handrails
    paperRect(ctx, CAR.x0 - 15, CAR.y0 - 4, 15, CAR.y1 - CAR.y0 + 8, '#a6abb5', 603, { amp: 0.5, stroke: INK, lw: 1 });
    paperRect(ctx, CAR.x1, CAR.y0 - 4, 15, CAR.y1 - CAR.y0 + 8, '#a6abb5', 604, { amp: 0.5, stroke: INK, lw: 1 });
    ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(CAR.x0 - 6, CAR.y0 + 8); ctx.lineTo(CAR.x0 - 6, CAR.y1 - 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(CAR.x1 + 6, CAR.y0 + 8); ctx.lineTo(CAR.x1 + 6, CAR.y1 - 70); ctx.stroke();
    // button panel on the right wall near the doors
    paperRect(ctx, CAR.x1 + 2, 392, 11, 52, '#c9ccd4', 605, { amp: 0.3, stroke: INK, lw: 0.8 });
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#5d6270'; ctx.beginPath(); ctx.arc(CAR.x1 + 7.5, 398 + i * 7, 2, 0, Math.PI * 2); ctx.fill(); }
    paperRect(ctx, CAR.x1 + 4, 439, 7, 3.5, '#d0393b', 606, { amp: 0.2, shadow: false });
    // ceiling vent and security camera on the back wall
    paperRect(ctx, 542, 220, 30, 10, '#555b68', 607, { amp: 0.3 });
    ctx.strokeStyle = '#8f97a8'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(545 + i * 4.5, 221.5); ctx.lineTo(545 + i * 4.5, 228.5); ctx.stroke(); }
    paperEllipse(ctx, 728, 226, 9, 7, '#2b2d36', 608, { stroke: INK, lw: 0.8, amp: 0.4 });
    paperEllipse(ctx, 728, 228, 4, 3.5, '#111', 609, { shadow: false, amp: 0.2 });
    ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(733, 222, 1.2, 0, Math.PI * 2); ctx.fill();
    // muzak speaker
    paperEllipse(ctx, 640, 223, 12, 4.5, '#2f3240', 610, { amp: 0.3 });
    // capacity sign on the shaft wall
    paperRect(ctx, 780, 330, 86, 36, '#f6efdf', 611, { stroke: INK, lw: 1, amp: 0.6 });
    ctx.fillStyle = INK; ctx.font = '700 7px "Lexend", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('CAPACITY 8', 823, 343); ctx.fillText('PLEASE FACE', 823, 352); ctx.fillText('THE DOORS', 823, 361);
  }

  function drawDoors(ctx, open) {
    const { paperRect, INK } = Art;
    const gap = open * 48;
    paperRect(ctx, 590, CAR.y1 - 2, 50 - gap, 10, '#b7bcc6', 620, { amp: 0.3, stroke: INK, lw: 0.8 });
    paperRect(ctx, 640 + gap, CAR.y1 - 2, 50 - gap, 10, '#b7bcc6', 621, { amp: 0.3, stroke: INK, lw: 0.8 });
    paperRect(ctx, 584, CAR.y1 - 4, 6, 14, '#6f7480', 622, { amp: 0.2 });
    paperRect(ctx, 690, CAR.y1 - 4, 6, 14, '#6f7480', 623, { amp: 0.2 });
    paperRect(ctx, CAR.x0 - 15, CAR.y1 - 2, 590 - (CAR.x0 - 15), 12, '#8b8f99', 624, { amp: 0.3, stroke: INK, lw: 0.8 });
    paperRect(ctx, 696, CAR.y1 - 2, CAR.x1 + 15 - 696, 12, '#8b8f99', 625, { amp: 0.3, stroke: INK, lw: 0.8 });
    if (open > 0.05) { ctx.fillStyle = 'rgba(255,240,200,0.35)'; ctx.fillRect(640 - gap, CAR.y1, gap * 2, 10); }
  }
})();
