'use strict';
// Episode 2: the wedding of Brad & Dana (Dana from HR, in the campaign). Mingling, then a ceremony; "speak now" is the courtroom.
(() => {
  const PEW_ROWS = [340, 405, 470, 535];
  const PEW_BLOCKS = [{ x0: 80, x1: 560 }, { x0: 720, x1: 1200 }];
  const DOG_COVER = { id: 'scoot', label: 'scooting across the carpet', anim: 'scoot', bubble: null };

  LEVELS.wedding = {
    id: 'wedding', episode: 'Season 1 · Episode 2', title: 'Til Death Do Us Fart', length: '~5 min',
    blurb: 'A chapel, a ceremony, nine suspects and a priest who will eventually ask if anyone objects.',
    mode: 'mingle', walkSpeed: 165, stepLen: 30, follow: 1.25,
    short: 'Chapel', place: "St. Swithin's Chapel", callWhen: 'at "speak now"', failTitle: 'Wedding ruiner', airText: 'Lilies, floor polish, and nerves.',
    mustSit(t) { return t >= this.timeline.places && t < this.timeline.speakNow; },
    zones: [
      { id: 'flowers', name: 'Flower Stand', at: 'by the flower stand', x: 30, y: 105, w: 330, h: 170 },
      { id: 'altar', name: 'Altar', at: 'up by the altar', x: 420, y: 105, w: 440, h: 170 },
      { id: 'organ', name: 'Organ', at: 'by the organ', x: 920, y: 105, w: 330, h: 170 },
      { id: 'leftpews', name: 'Left Pews', at: 'in the left pews', x: 30, y: 290, w: 550, h: 270 },
      { id: 'rightpews', name: 'Right Pews', at: 'in the right pews', x: 700, y: 290, w: 550, h: 270 },
      { id: 'back', name: 'Back Door', at: 'by the back door', x: 30, y: 575, w: 1220, h: 140 },
    ],
    bounds: { x0: 22, x1: W - 22, y0: 114, y1: H - 8 },
    view: { x: -130, y: -80, w: W + 260, h: H + 80 }, // the walls run up behind the HUD, so the altar row is never under it
    ranges: { notice: 72, overhear: 210, gossip: 150, talk: 88, search: 50, personal: 22, spacing: 52, depth: 0.7, itemOffset: null },
    // pews are solid: their backrests block walking; people go round through the aisles
    obstacles: PEW_BLOCKS.flatMap((b) => PEW_ROWS.map((y) => ({ x: b.x0 - 8, y: y + 2, w: b.x1 - b.x0 + 16, h: 20 }))),
    route(a, b) {
      const crosses = PEW_ROWS.some((y) => Math.min(a.y, b.y) < y + 12 && Math.max(a.y, b.y) > y + 12);
      const inBlock = (x) => PEW_BLOCKS.some((k) => x > k.x0 - 10 && x < k.x1 + 10);
      if (!crosses || (!inBlock(a.x) && !inBlock(b.x) && Math.abs(a.x - b.x) < 60)) return [b];
      const mid = (a.x + b.x) / 2;
      const aisle = [50, 640, 1228].sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid))[0];
      return [{ x: aisle, y: a.y }, { x: aisle, y: b.y }, b];
    },
    // never leave someone standing inside a pew's backrest
    // ...or on top of the guest book table or the coat stand
    fixSpot(p) {
      for (const y of PEW_ROWS) if (p.y > y - 6 && p.y < y + 26 && PEW_BLOCKS.some((k) => p.x > k.x0 - 10 && p.x < k.x1 + 10)) return { x: p.x, y: y - 3 };
      if (p.x > 232 && p.x < 388 && p.y > 596 && p.y < 668) return { x: p.x, y: p.y < 632 ? 594 : 670 };
      if (p.x > 1090 && p.x < 1140 && p.y > 588 && p.y < 684) return { x: p.x < 1114 ? 1086 : 1144, y: p.y };
      return p;
    },
    // furniture painted into the floor: zone names stay clear of it
    furniture: [{ x: 250, y: 598, w: 120, h: 56 }, { x: 1092, y: 592, w: 44, h: 80 }, { x: 588, y: 268, w: 104, h: 460 }],
    player: { start: { x: 640, y: 668 }, seat: { x: 360, y: 468, face: -Math.PI / 2 }, look: { body: '#f08a24', outfit: 'hoodie', pants: '#3a4a6a', shoes: '#f6efdf', skin: '#f3cfae', hair: '#2d1d10', hairStyle: 'messy', acc: 'none', scale: 1.0, voice: 300 } },
    // nose: how strongly they pick up gas. tol: exposure before reacting. shame: stakes for accusing.
    // perception: vision range multiplier ("enforcers" notice more). gossip: how fast they spread opinions.
    cast: [
      { id: 'edna', name: 'Grandma Edna', role: "Bride's grandmother, 91", shame: 10, nose: 0.75, tol: 1.5, perception: 0.6, gossip: 1.4, trait: 'Bad eyes, LOUD voice',
        look: { body: '#8d77c2', outfit: 'cardigan', inner: '#f1ecf6', skirt: true, pants: '#6e5a99', shoes: '#3a2a4a', skin: '#f3d3b5', hair: '#ececec', hairStyle: 'bun', acc: 'glasses', features: ['wrinkles', 'blush'], scale: 0.92, voice: 330 },
        seat: { x: 470, y: 338, face: -Math.PI / 2 }, item: { x: 400, y: 330, label: "Edna's handbag", kind: 'handbag', color: '#7d5bb5' },
        stakes: 'Accuse her wrongly and you are out of the will. All the wills.' },
      { id: 'timmy', name: 'Little Timmy', role: 'Ring bearer, age 7', shame: 2, nose: 1.6, tol: 1.0, perception: 1.0, gossip: 2.2, trait: 'Blabbermouth',
        look: { body: '#2f62b8', outfit: 'suit', pants: '#2f62b8', shorts: true, shoes: '#1c1a1f', skin: '#f6d2b0', hair: '#8a5530', hairStyle: 'spiky', acc: 'bowtie', features: ['freckles', 'blush'], scale: 0.72, voice: 620 },
        seat: { x: 785, y: 228, face: Math.PI / 2 }, item: { x: 150, y: 528, label: "Timmy's backpack", kind: 'backpack', color: '#3a7bd5' },
        stakes: 'Blaming a seven-year-old. Low risk, zero glory.' },
      { id: 'mulligan', name: 'Father Mulligan', role: 'Officiant', shame: 9, nose: 1.0, tol: 1.3, perception: 1.0, gossip: 0.5, trait: 'Keeps secrets',
        look: { body: '#26262e', outfit: 'cassock', shoes: '#1c1a1f', skin: '#efc9a6', hair: '#a8a8a8', hairStyle: 'bald', acc: 'collar', features: ['wrinkles', 'bushybrows'], scale: 1.0, voice: 200 },
        seat: { x: 645, y: 168, face: Math.PI / 2 }, item: { x: 520, y: 150, label: "Father Mulligan's satchel", kind: 'satchel', color: '#7a5230' },
        stakes: 'Accusing a priest, in his own chapel, mid-ceremony.' },
      { id: 'gary', name: 'Uncle Gary', role: "Groom's uncle. Brought a cooler.", shame: 3, nose: 0.9, tol: 1.0, perception: 0.8, gossip: 1.2, trait: 'Says everything out loud',
        look: { body: '#d2452f', outfit: 'hawaiian', pants: '#c9b48a', shorts: true, shoes: '#6b4a2a', skin: '#eab18d', hair: '#5c3a1c', hairStyle: 'mullet', acc: 'shades', features: ['stubble'], scale: 1.05, voice: 170 },
        seat: { x: 905, y: 468, face: -Math.PI / 2 }, item: { x: 1060, y: 528, label: "Gary's cooler", kind: 'cooler', color: '#e8e8e8' },
        stakes: 'Everyone already thinks it was Gary. Low stakes, low credit.' },
      { id: 'brittany', name: 'Brittany', role: 'Maid of honor, influencer', shame: 6, nose: 1.0, tol: 0.8, perception: 0.9, gossip: 1.6, trait: 'Films everything',
        look: { body: '#e872b4', outfit: 'dress', shoes: '#c0306f', skin: '#f5d6bd', hair: '#f2d168', hairStyle: 'long', hold: 'phone', features: ['lashes', 'earrings'], scale: 0.98, voice: 520 },
        seat: { x: 515, y: 218, face: Math.PI / 2 }, item: { x: 250, y: 238, label: "Brittany's clutch", kind: 'clutch', color: '#ef85bf' },
        stakes: 'She has 80,000 followers and she is filming.' },
      { id: 'brad', name: 'Brad', role: 'The groom. Sweating.', shame: 8, nose: 1.0, tol: 1.1, perception: 0.7, gossip: 0.8, trait: 'Too nervous to notice anything',
        look: { body: '#222228', outfit: 'tux', pants: '#222228', shoes: '#0d0d10', skin: '#f0c7a2', hair: '#3b2814', hairStyle: 'combed', acc: 'bowtie', scale: 1.02, voice: 260 },
        seat: { x: 700, y: 212, face: Math.PI / 2 }, item: { x: 1000, y: 236, label: "Brad's jacket", kind: 'jacket', color: '#26262c' },
        stakes: 'Accusing the groom at his own wedding. Huge if you are right.' },
      { id: 'pemberton', name: 'Mrs. Pemberton', role: "Groom's mother. Judges everyone.", shame: 8, nose: 1.2, tol: 0.9, perception: 1.4, gossip: 1.0, trait: 'Enforcer: notices everything',
        look: { body: '#2e8f70', outfit: 'dress', skirt: true, pants: '#2e8f70', shoes: '#1f5a46', skin: '#f1cfb0', hair: '#7a1f2b', hairStyle: 'hat', acc: 'pearls', features: ['lashes', 'wrinkles'], scale: 0.98, voice: 400 },
        seat: { x: 790, y: 338, face: -Math.PI / 2 }, item: { x: 880, y: 330, label: "Mrs. Pemberton's handbag", kind: 'handbag', color: '#1f6e55' },
        stakes: 'She will remember this at every Thanksgiving, forever.' },
      { id: 'kevin', name: 'Kevin', role: 'Photographer. Hired off a forum.', shame: 4, nose: 1.0, tol: 1.2, perception: 1.2, gossip: 1.0, trait: 'Always taking photos',
        look: { body: '#6f7a3a', outfit: 'vest', inner: '#d8d2c0', pants: '#4a4636', shoes: '#3a2a1a', skin: '#e2b48e', hair: '#2b2b2b', hairStyle: 'beanie', hold: 'camera', features: ['stubble'], scale: 1.0, voice: 230 },
        seat: { x: 560, y: 640, face: -Math.PI / 2 }, item: { x: 900, y: 655, label: "Kevin's camera bag", kind: 'satchel', color: '#5f6470' },
        stakes: 'Nobody knows his last name. Nobody will defend him.' },
      { id: 'biscuit', name: 'Biscuit', role: 'Ring dog. Good boy?', shame: 1, nose: 2.0, tol: 2.6, dog: true, sprite: 'dog', perception: 0, gossip: 0, trait: 'Cannot testify',
        look: { body: '#c98d4b', scale: 1.0, voice: 700 },
        seat: { x: 830, y: 236, face: Math.PI / 2 }, item: { x: 90, y: 236, label: "Biscuit's dog bed", kind: 'dogbed', color: '#c0392b' },
        stakes: 'Blaming the dog. The oldest trick there is.' },
    ],
    foods: ['eggs', 'chili', 'broccoli', 'garlic', 'tuna'],
    favoriteFood: { gary: 'chili' },
    nervous: ['brad'],
    // people chatting, in Free Play (campaign cases have their own in js/story.js)
    banter: [
      ["gary", "mulligan", "Father! Chili? I blessed it myself!", "I will pray on it, Gary. From a distance."],
      ["brittany", "kevin", "Kevin, make sure you get my good side.", "Which one is that?"],
      ["timmy", "brad", "Uncle Brad, the rings are in my shoe.", "Great! Great. Please don't take off your shoe."],
      ["edna", "pemberton", "Deviled egg, dear?", "No. Thank you."],
    ],
    scapegoat: {
      id: 'biscuit', food: 'cheese', cover: DOG_COVER, speaker: 'timmy',
      petLabel: 'Pet Biscuit. Smell his breath.', open: 'Biscuit looks up at you. Biscuit always looks a little guilty.',
      breath: (guilty) => guilty ? 'Biscuit wags. His breath smells like blue cheese. A LOT of blue cheese.' : 'Biscuit wags. His breath smells like kibble and regret.',
      bedText: (guilty) => guilty ? 'a squeaky toy and a chewed rind of blue cheese.' : 'a squeaky toy and a lot of fur. Nothing else.',
      witness: 'Biscuit got into the blue cheese platter in the vestry. The whole platter.',
      blameLine: 'Ugh, BISCUIT! Bad dog!',
      testimony: { food: 'Biscuit only eats kibble. Only kibble!', zone: 'He was asleep in his bed the whole time!', cover: 'And he definitely did NOT scoot.' },
      outcome: { confess: '*Biscuit lies down and puts his paws over his face.*', reluctant: '*Biscuit slowly backs out of the chapel.*', unproven: '*Biscuit tilts his head. Nobody buys it.*', wrong: '*Biscuit looks deeply hurt.*' },
      finale: (name) => `Then Biscuit trots over to ${name}, sniffs once, and sits down. Oh no.`,
    },
    subjectChange: 'Wow! These lilies smell AMAZING, right?!',
    lateArrivals: [],
    photo: { source: 'item', owner: 'kevin', label: "Kevin's camera", caption: 'Photo from Kevin\'s camera, the moment it happened' },

    gas: {
      rect: { x: 0, y: 0, w: W, h: H }, amount: 340, diffusion: 3200, swirl: 3,
      pushers: [{ x: 30, y: 420, strength: 13, falloff: 420, bias: { x: 0.6, y: 0 } }],
      vents: [{ x: 1215, y: 112, pull: 14, falloff: 300, drain: 0.08, r: 70 }],
      doors: { main: { x: 640, y: 715, push: 45, falloff: 260, drain: 0.5, r: 70 } },
      wall: (px, py) => py < 100,
    },
    pressureRate: 0.43,
    objectLabel: 'OBJECT!',
    objectSplash: { big: 'I OBJECT!', sub: "The organ stops. Every head in St. Swithin's turns to you." },
    peaceText: 'You held your peace. So did the farter. They will get away with it forever.',
    music: 'mingle',

    timeline: { fart: 14, mention: 80, places: 150, procession: 166, vows: 190, speakNow: 268, end: 290, glanceFrom: 190 },
    loud: [
      { t: 48, dur: 3.5, label: 'Kevin knocks over a light stand' },
      { t: 112, dur: 3, label: 'The back door slams' },
      { t: 166, dur: 22, label: 'The organ plays Here Comes the Bride', organ: true },
      { t: 214, dur: 3, label: 'Timmy sneezes' },
      { t: 243, dur: 3, label: "Edna's hearing aid shrieks" },
    ],
    mention: { who: 'gary', line: 'WHOA! WHO CUT THE CHEESE?!', caption: 'Gary said it out loud first. Under playground law, he dealt it. Now everyone can talk about the smell.' },
    speakNow: { who: 'mulligan', line: 'If anyone here knows why these two should not be wed, speak now, or forever hold your peace.', caption: 'This is it. Press O to OBJECT and name the farter in front of everyone.' },
    intro: "St. Swithin's Chapel, 10:58. Brad and Dana's wedding starts any minute. Mingle.",

    quiet: (t) => t >= 190 && t < 268,
    phaseLabel(t) {
      const T = this.timeline;
      return t < T.fart ? 'Mingling' : t < T.places ? 'Mingling (something smells)' : t < T.procession ? 'Places, everyone' : t < T.vows ? 'Here comes the bride' : t < T.speakNow ? 'The vows (silence)' : 'Speak now...';
    },
    clockStart: [10, 58], // the ceremony; the campaign's rehearsal starts earlier
    clockLabel(t) { const m = this.clockStart[0] * 60 + this.clockStart[1] + Math.floor(t / 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; },
    stampTime(t) { const s = (this.clockStart[0] * 60 + this.clockStart[1]) * 60 + Math.floor(t); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; },

    // Level-specific beats. Generic beats (the fart, mention, loud moments, speak now) live in the engine.
    script(t, api) {
      const T = this.timeline;
      if (t >= T.places) api.once('places', () => {
        api.say('mulligan', 'Places, everyone! The bride is here!', 3.5, 'shout');
        api.caption('Places! Get to your seat in the left pews before the bride walks in.', 5);
        api.log('Father Mulligan calls everyone to their places.');
        api.seatEveryone();
      });
      if (t >= T.procession) api.once('procession', () => {
        api.door('main', true); api.music(null); api.organ(22);
        api.actor('bride', { look: BRIDE_LOOK, x: 640, y: 712, target: { x: 610, y: 214 }, speed: 34, face: -Math.PI / 2 });
        api.caption('The doors open. The organ plays. LOUD. This is the safest moment in the whole wedding to let one go.', 6);
        api.log('The bride enters. The organ is very loud.');
      });
      if (t >= T.procession + 22) api.once('doorShut', () => { api.door('main', false); api.music('tension'); });
      if (t >= T.vows) api.once('vows', () => {
        api.caption('The vows. Dead silence. Walking or whispering now gets noticed. Seated guests face the altar, though.', 6);
        api.log('The vows begin.');
      });
      const lines = [[T.vows + 3, 'mulligan', 'Dearly beloved, we are gathered here today...'], [T.vows + 22, 'mulligan', 'Do you, Brad, take Dana...'],
        [T.vows + 30, 'brad', 'I... I do!'], [T.vows + 44, 'mulligan', 'And do you, Dana, take Brad...'], [T.vows + 52, 'bride', 'I do.'],
        [T.vows + 64, 'mulligan', 'Wonderful. Before I pronounce you...']];
      lines.forEach(([at, who, text], i) => { if (t >= at) api.once('line' + i, () => api.say(who, text, 3.5)); });
    },

    buildBackground: (ctx) => buildChapel(ctx),
    props(api) {
      const out = [];
      for (const b of PEW_BLOCKS) PEW_ROWS.forEach((y, i) => out.push({ y: y + 22, draw: (ctx) => drawPew(ctx, b.x0, b.x1, y, 500 + i * 10 + b.x0) }));
      return out;
    },
    // Coloured light from the stained glass, drifting slowly across the floor.
    overlay(ctx, t) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      [[160, '#e2483d'], [400, '#3f8fd2'], [880, '#f2c14e'], [1110, '#5bbf6a']].forEach(([x, col], i) => {
        const sway = Math.sin(t * 0.15 + i) * 40, a = 0.07 + Math.sin(t * 0.4 + i * 2) * 0.02;
        const g = ctx.createLinearGradient(x, 100, x + 120 + sway, 560);
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = a; ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x - 30, 96); ctx.lineTo(x + 30, 96); ctx.lineTo(x + 170 + sway, 560); ctx.lineTo(x + 40 + sway, 560); ctx.closePath(); ctx.fill();
      });
      ctx.restore();
    },

    idles: {
      edna: { bubble: '*hearing aid whistles*' }, timmy: { bubble: '*picks nose*' }, mulligan: { bubble: '*mutters a prayer*' },
      gary: { bubble: '*sips from a flask*' }, brittany: { bubble: '*takes a selfie*', anim: 'flash' }, brad: { bubble: '*wipes sweat*' },
      pemberton: { bubble: 'Hmph.' }, kevin: { bubble: '*click*', anim: 'flash' }, biscuit: { bubble: '*sniffs everything*' },
    },
    bagFlavor: {
      edna: 'hard candies, a photo of her late husband, and', timmy: 'two bugs in a jar, a broken crayon, and',
      mulligan: 'a Bible with a racing form tucked inside, and', gary: 'antacids, a warm beer, and',
      brittany: 'a ring light, three lip glosses, and', brad: 'crumpled vows, a stress ball, and',
      pemberton: 'pearls, a list titled PEOPLE WHO DISAPPOINT ME, and', kevin: 'a lens cap, two energy drinks, and',
    },
    voices: {
      edna: {
        hello: "EH? Oh, hello dear. Are you Dana's friend from the pottery class? Or the prison?",
        react: 'My word. In a CHURCH',
        breakfast: 'BREAKFAST? I had {food}, dear. Same as every Saturday since 1962.',
        where: "WHERE WAS I? {at}. I'm ninety-one, I'm allowed to wander.",
        smell: '{Smell}. My nose retired in 1987 and even it came back for this one.',
        gossip: "I'LL TELL YOU WHAT I SAW, AND I'LL SAY IT LOUD: {fact}",
        gossipNone: 'The organist is wearing SNEAKERS. In a CHURCH.',
        confront: 'YOU THERE. YOUNG PERSON. WAS THAT YOU?',
        guilty: "Fine! FINE! It was me! I'm ninety-one, I've earned it!",
        reluctant: "...Maybe it was me. Maybe. Who's asking? Speak up.",
        innocent: "ME?! I knitted socks for the war effort, and THIS is my thanks?",
        rumor: "{name}?! I ALWAYS SAID THERE WAS SOMETHING OFF ABOUT {NAME}!",
      },
      timmy: {
        hello: "I'm the ring bearer. I have the rings. I'm not allowed to say where. They're in my shoe.",
        react: 'Ewwww. Somebody did a fart in church',
        breakfast: 'Mom gave me {food}. I gave half to Biscuit.',
        where: 'I was {at}. Looking for bugs. I found two.',
        smell: "IT SMELLED LIKE {SMELL}! I smelled it first. I always smell it first.",
        gossip: 'I saw something. {fact} Do I get a sticker?',
        gossipNone: 'Uncle Gary said a bad word in the parking lot. Three bad words.',
        confront: "Mom says whoever farts has to say excuse me. You didn't say excuse me.",
        guilty: "It was me... I'm sorry... am I still the ring bearer?",
        reluctant: 'Maybe it was Biscuit. ...Okay it was me.',
        innocent: "I'm SEVEN! *starts crying*",
        rumor: "{name} did it?! I'm telling EVERYONE.",
      },
      mulligan: {
        hello: 'Bless you, child. We begin shortly. Please refrain from sin until then.',
        react: 'Lord, grant me strength. And an open window',
        breakfast: 'A humble breakfast. {food}. The Lord provides.',
        where: 'I was {at}, preparing my heart. And my notes.',
        smell: '{Smell}. In a house of God. Someone will answer for it.',
        gossip: 'I repeat no confessions. But I have eyes. {fact}',
        gossipNone: "I hear many confessions and repeat none of them. Except Gary's. It was funny.",
        confront: 'Child. Is there something you wish to confess?',
        guilty: 'Forgive me, for I have sinned. Silently, but with conviction.',
        reluctant: 'The Lord works in mysterious ways. As do my bowels.',
        innocent: 'Accusing a man of the cloth? In my own chapel?',
        rumor: 'Judge not, child. ...Though {name} did look rather uncomfortable.',
      },
      gary: {
        hello: "Hey hey! Bride's side? Want a beer? I got a cooler. Don't tell the priest.",
        react: 'Whoa. And they call ME the chili guy?',
        breakfast: '{food}, baby! Breakfast of champions!',
        where: "{at}. Scoping out the open bar situation. There isn't one. Criminal.",
        smell: 'WHOO! {Smell}! Somebody needs new slacks!',
        gossip: 'Okay, real talk. {fact}',
        gossipNone: 'Between you and me, Brad cried at the rehearsal. Twice. Once at the shrimp.',
        confront: 'Buddy. Pal. Friend. Was that you? You can tell Uncle Gary.',
        guilty: 'HA! Yeah, it was me! Gary does what Gary wants!',
        reluctant: 'Okay okay, MAYBE that one was mine. Allegedly.',
        innocent: 'Everybody always assumes it was Gary! Not this time, pal!',
        rumor: '{name}?! Ha! I KNEW it wasn\'t just me this time!',
      },
      brittany: {
        hello: "Oh my god hi. Can you move? You're in my light. Thanks babe.",
        react: 'Do NOT let this get on the livestream',
        breakfast: "Literally just {food}. It's, like, a wellness thing.",
        where: 'I was {at} doing content. The lighting there is a moment.',
        smell: 'Ew, yes. {Smell}. I almost threw up on my followers.',
        gossip: "Okay so I'm not one to gossip, but: {fact}",
        gossipNone: "Dana's dress is a rental. You didn't hear it from me. You heard it from my story.",
        confront: "Okay, was that you? Be honest. I won't post it. I'll post it.",
        guilty: "Okay, fine, it was me. Please stop filming. Who's filming?",
        reluctant: "I mean... it COULD have been me. I'm not confirming. No comment.",
        innocent: "Excuse me?! I'm getting this on camera. Hashtag defamation.",
        rumor: 'Wait, {name}? Oh my god. Hold on, I need to post this.',
      },
      brad: {
        hello: "Hey! Hi! Is it time? Is it time yet? I'm fine. I'm totally fine.",
        react: 'Not today. Please, please, not today',
        breakfast: "I had {food}. I think. I don't remember. Is it hot in here?",
        where: "I was {at}, practicing my vows. 'I, Brad...' I forgot the rest.",
        smell: "Oh no. Yes. {Smell}. Is that a bad omen? That's a bad omen.",
        gossip: "I'm not supposed to notice things today. But okay. {fact}",
        gossipNone: "Dana's dad keeps looking at me like I'm a parking ticket.",
        confront: 'Dude. Was that you? Today of all days?',
        guilty: "It was me. It was nerves! I'm getting MARRIED!",
        reluctant: "Okay. It might have been me. Please don't tell Dana.",
        innocent: 'ON MY WEDDING DAY?!',
        rumor: '{name}? At my wedding? Okay. Okay. Breathing. I\'m breathing.',
      },
      pemberton: {
        hello: "And you are...? Hm. The bride's side. That explains the shoes.",
        react: "Unbelievable. The bride's side, no doubt",
        breakfast: 'I had {food}. At the club. Obviously.',
        where: '{at}. As far from Gary as is physically possible.',
        smell: '{Smell}. This is what happens when Brad marries down.',
        gossip: 'I notice everything. For instance: {fact}',
        gossipNone: 'The roses are carnations painted red. I can always tell.',
        confront: 'I saw you lurking. Was that you? Answer quickly, I have a lunch.',
        guilty: 'Fine. It was me. I will be leaving the country now.',
        reluctant: "If I did, and I'm not saying I did, it was more refined than Gary's.",
        innocent: 'How DARE you. I am a Pemberton.',
        rumor: '{name}. Of course. I could tell from the shoes.',
      },
      kevin: {
        hello: "Kevin. Photographer. Well, I own a camera. Smile. Nah, I'll get you later.",
        react: 'Do I keep shooting? I keep shooting',
        breakfast: 'Gas station {food}. Breakfast of freelancers.',
        where: '{at}, getting establishing shots. Of the establishment.',
        smell: 'Yeah, man. {Smell}. That is going to show up in the photos.',
        gossip: "I see everything through this lens, man. {fact}",
        gossipNone: "I've shot four weddings. Somebody always farts. Usually during the vows.",
        confront: "I've got like six photos of you looking weird, man. Was it you?",
        guilty: 'Ugh. Yeah. It was me. Do I still get paid?',
        reluctant: "...I'm gonna say the dog. But also maybe me.",
        innocent: "Bro, I'm the hired help! I'm basically furniture!",
        rumor: '{name}, huh? I might have that on camera, actually.',
      },
    },
  };

  const BRIDE_LOOK = { body: '#ffffff', skin: '#c98e64', hair: '#2a1a12', hairStyle: 'veil', acc: 'bouquet', scale: 1.0, dress: true };

  function drawPew(ctx, x0, x1, y, seed) {
    Art.paperRect(ctx, x0, y - 14, x1 - x0, 12, '#6e4424', seed, { amp: 1.2 });
    Art.paperRect(ctx, x0 - 4, y - 6, x1 - x0 + 8, 28, '#8b5a33', seed + 1, { amp: 1.5, stroke: Art.INK, lw: 1.5 });
    ctx.strokeStyle = 'rgba(40,20,5,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y + 4); ctx.lineTo(x1, y + 4); ctx.stroke();
    Art.paperRect(ctx, x0 - 8, y - 12, 10, 36, '#5c3a1f', seed + 2, { amp: 1 });
    Art.paperRect(ctx, x1 - 2, y - 12, 10, 36, '#5c3a1f', seed + 3, { amp: 1 });
  }

  function buildChapel(ctx) {
    const { paper, paperRect, paperEllipse, INK } = Art;
    ctx.fillStyle = '#c4935b'; ctx.fillRect(-150, -100, W + 300, H + 120);
    ctx.strokeStyle = 'rgba(90,55,25,0.35)'; ctx.lineWidth = 1.5;
    for (let y = 100; y < H; y += 26) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      for (let x = ((y / 26) % 2) * 90; x < W; x += 180) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 26); ctx.stroke(); }
    }
    // the stone wall, tall enough to sit behind the HUD, with a timber beam along the top
    // side walls, seen from above, framing the room
    for (const [x0, sd] of [[-150, 4], [W, 5]]) {
      paperRect(ctx, x0, -100, 150, H + 120, '#5c6580', sd, { amp: 2, shadow: false });
      ctx.strokeStyle = 'rgba(30,35,60,0.25)'; ctx.lineWidth = 1.5;
      for (let y = -100; y < H + 20; y += 22) for (let x = x0 + ((y + 100) % 44 ? 0 : 30); x < x0 + 150; x += 60) ctx.strokeRect(x, y, 60, 22);
      paperRect(ctx, x0 === W ? W : -8, 96, 8, H - 90, '#8a6a4a', sd + 6, { stroke: INK, lw: 1, amp: 0.8 }); // skirting where wall meets floor
      for (const y of [240, 470]) { // candle sconces
        const cx = x0 === W ? W + 40 : -40;
        paperRect(ctx, cx - 6, y, 12, 22, '#b08a3e', sd * 10 + y, { stroke: INK, lw: 1, amp: 0.4 });
        paperRect(ctx, cx - 3, y - 14, 6, 14, '#fff7d6', sd * 10 + y + 1, { amp: 0.3 });
        paperEllipse(ctx, cx, y - 18, 3, 5, '#ffb43b', sd * 10 + y + 2, { shadow: false });
      }
    }
    // the stone wall behind the altar, tall enough to sit behind the HUD, with a timber beam along the top
    paperRect(ctx, -150, -100, W + 300, 204, '#6b7591', 1, { amp: 3 });
    ctx.strokeStyle = 'rgba(30,35,60,0.25)'; ctx.lineWidth = 1.5;
    for (let y = -78; y < 100; y += 22) for (let x = ((y + 78) % 44 ? -150 : -120); x < W + 150; x += 60) ctx.strokeRect(x, y, 60, 22);
    paperRect(ctx, -150, -100, W + 300, 24, '#5a3a22', 2, { stroke: INK, lw: 1.5, amp: 1 });
    paperRect(ctx, -150, 96, W + 300, 8, '#8a6a4a', 3, { stroke: INK, lw: 1, amp: 1 });
    // tall leaded windows: a pointed arch of coloured glass held in dark lead
    [160, 400, 880, 1110].forEach((x, i) => {
      paper(ctx, [[x - 32, 92], [x - 32, -22], [x - 22, -46], [x, -62], [x + 22, -46], [x + 32, -22], [x + 32, 92]], '#2a2440', 10 + i, { amp: 1.2, stroke: INK, lw: 2 });
      const cols = ['#e2483d', '#f2c14e', '#3f8fd2', '#5bbf6a', '#b25bd6'];
      for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) {
        const px = x - 26 + c * 27, py = -20 + r * 18.5;
        paperRect(ctx, px, py, 25, 16.5, cols[(r * 2 + c + i) % 5], 20 + r * 2 + c + i * 13, { amp: 0.6, shadow: false });
      }
      paper(ctx, [[x - 25, -24], [x - 16, -42], [x, -54], [x + 16, -42], [x + 25, -24]], cols[(i + 2) % 5], 34 + i, { amp: 0.6, shadow: false });
      paperEllipse(ctx, x, -36, 7, 7, '#fbe7a1', 38 + i, { shadow: false, amp: 0.3 });
      ctx.strokeStyle = '#2a2440'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, -24); ctx.lineTo(x, 92); ctx.stroke();
      paperRect(ctx, x - 36, 88, 72, 6, '#8a6a4a', 42 + i, { stroke: INK, lw: 1, amp: 0.4 }); // the sill
    });
    ctx.save(); ctx.strokeStyle = '#3b2b1b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(470, 18); ctx.quadraticCurveTo(640, 48, 810, 18); ctx.stroke(); ctx.restore();
    const letters = 'BRAD + DANA';
    for (let i = 0; i < letters.length; i++) {
      const tt = i / (letters.length - 1), x = 482 + tt * 316, y = 22 + Math.sin(tt * Math.PI) * 15;
      paper(ctx, [[x - 10, y], [x + 10, y], [x, y + 24]], i % 2 ? '#f6f1e7' : '#f4a9c4', 40 + i, { amp: 1 });
      ctx.fillStyle = INK; ctx.font = '700 10px "Lexend", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(letters[i], x, y + 11);
    }
    paperRect(ctx, 420, 96, 440, 168, '#e7d1a8', 60, { amp: 3 });
    paperRect(ctx, 420, 258, 440, 12, '#9c7444', 61, { amp: 2 });
    for (let i = 0; i < 22; i++) {
      const a = Math.PI + (i / 21) * Math.PI, x = 645 + Math.cos(a) * 120, y = 112 + Math.sin(a) * 60;
      paperEllipse(ctx, x, y, 11, 10, ['#ffffff', '#f7c3d6', '#fbe7a1'][i % 3], 70 + i, { amp: 2 });
    }
    paperRect(ctx, 585, 112, 120, 34, '#f8f4ea', 80, { stroke: INK, lw: 1.5 });
    paperRect(ctx, 600, 108, 6, 18, '#fff7d6', 81); paperRect(ctx, 684, 108, 6, 18, '#fff7d6', 82);
    paperEllipse(ctx, 603, 104, 3, 5, '#ffb43b', 83, { shadow: false }); paperEllipse(ctx, 687, 104, 3, 5, '#ffb43b', 84, { shadow: false });
    for (let i = 0; i < 9; i++) {
      const h = 46 + Math.sin(i * 0.9) * 22 + (4 - Math.abs(i - 4)) * 6, x = 1030 + i * 20;
      paperRect(ctx, x, 100 - h, 14, h + 6, '#c9ccd4', 90 + i, { amp: 1, stroke: '#7d8290', lw: 1 });
    }
    paperRect(ctx, 1040, 108, 160, 46, '#5a3a22', 100, { stroke: INK, lw: 1.5 });
    for (let i = 0; i < 12; i++) paperRect(ctx, 1048 + i * 12.5, 118, 10, 14, i % 3 === 1 ? '#222' : '#f5f0e6', 101 + i, { amp: 0.5, shadow: false });
    paperRect(ctx, 1188, 98, 56, 22, '#3d4352', 120, { amp: 1 });
    ctx.strokeStyle = '#8f97a8'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(1194 + i * 10, 102); ctx.lineTo(1194 + i * 10, 116); ctx.stroke(); }
    paperRect(ctx, 90, 140, 170, 40, '#7d5432', 130, { stroke: INK, lw: 1.5 });
    for (let i = 0; i < 4; i++) {
      const x = 110 + i * 42;
      paperRect(ctx, x - 9, 120, 18, 24, '#6fa8c9', 131 + i, { amp: 1 });
      for (let k = 0; k < 5; k++) paperEllipse(ctx, x + (k - 2) * 7, 108 - (k % 2) * 8, 7, 6, k % 2 ? '#ffffff' : '#f6b6cf', 140 + i * 5 + k, { amp: 1.5 });
    }
    paperRect(ctx, 588, 268, 104, H - 258, '#b5303b', 150, { amp: 2.5 });
    ctx.strokeStyle = '#e7b74d'; ctx.lineWidth = 3; ctx.setLineDash([10, 6]);
    ctx.strokeRect(596, 272, 88, H - 270); ctx.setLineDash([]);
    paperRect(ctx, -6, 388, 30, 70, '#d4d8de', 160, { stroke: '#6d7380', lw: 1.5 });
    ctx.strokeStyle = '#6d7380'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(2, 396 + i * 10); ctx.lineTo(20, 396 + i * 10); ctx.stroke(); }
    ctx.fillStyle = INK; ctx.font = '700 9px "Lexend", sans-serif'; ctx.textAlign = 'left'; ctx.fillText('AC', 4, 452);
    paperRect(ctx, 250, 612, 120, 40, '#7d5432', 170, { stroke: INK, lw: 1.5 });
    paperRect(ctx, 286, 600, 48, 22, '#f8f4ea', 171, { stroke: INK, lw: 1 });
    ctx.fillStyle = INK; ctx.font = '600 8px "Lexend", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('GUESTS', 310, 614);
    paperRect(ctx, 1110, 600, 8, 70, '#5a3a22', 172);
    paperEllipse(ctx, 1114, 600, 22, 6, '#5a3a22', 173);
    paperRect(ctx, 590, H - 14, 100, 24, '#6a4526', 180, { stroke: INK, lw: 1.5 });
  }
})();
