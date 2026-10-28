'use strict';
// The engine: level timeline, player actions, aura, gossip and room opinion, evidence,
// the cross-examination, scoring, rendering and input. Levels supply content and set pieces.
const STEP = 1 / 30;
const G = { state: 'title', pitch: true, features: {}, showCones: true, levelId: 'elevator' };

const Game = (() => {
  let cv, ctx, background, gasCv, gasCtx, gasImg, dpr = 1, scale = 1;
  const keys = {};

  // ---------------- setup ----------------
  function prepareLevel(levelId) {
    G.levelId = levelId;
    loadLevel(levelId);
    background = Art.buildBackground(L, 2);
  }

  function newGame(levelId, seed) {
    prepareLevel(levelId);
    Object.assign(G, {
      state: 'play', t: 0, anim: 0, seed, cs: Case.generate(seed),
      aura: 100, auraShown: 100, pressure: 12, mentioned: false, mentionBy: null,
      clues: [], log: [], know: { claims: {}, zones: {}, bags: {}, bagFood: {}, witnessFood: {}, facts: {}, smell: false, reactions: [], tells: 0 },
      sv: { charges: 3, t: 0 }, loud: null, flags: {}, floaters: [], flashes: [], pssts: [], puffs: [], actors: {},
      board: { who: '', food: '', zone: '', cover: '', locked: false, checks: 0, feedback: '' },
      sniffCd: 0, sniffArrow: null, nextConfrontT: 0, gossipT: 1, vowMoveAcc: 0, objected: false, result: null,
      rumble: null, nextRumble: 0, photo: null, photoPending: false, snaps: {}, snapPending: null, trial: null,
      doors: {}, cam: { x: W / 2, y: H / 2, z: 1, tx: W / 2, ty: H / 2, tz: 1, shake: 0 },
      player: { x: L.player.start.x, y: L.player.start.y, face: -Math.PI / 2, target: null, walking: false, bubble: null, expr: 'neutral', exprT: 0, pending: null },
    });
    G.npcs = CAST.map((c) => NPC.create(c, G.cs));
    G.items = {};
    for (const c of CAST) {
      const spot = G.cs.spots[c.id];
      const pos = L.itemsAtFeet ? (spot ? { x: spot.x + 26, y: spot.y + 4 } : { x: -100, y: -100 }) : { x: c.item.x, y: c.item.y };
      G.items[c.id] = { ...c.item, ...pos, owner: c.id, present: !(L.lateArrivals || []).includes(c.id) };
    }
    G.props = L.photo.source === 'prop' ? [{ id: 'photo', x: L.photo.x, y: L.photo.y, label: L.photo.label }] : [];
    for (const id in (L.gas.doors || {})) G.doors[id] = { open: 0, target: 0 };
    Gas.reset(L.gas);
    UI.resetRun();
    Sfx.setMusic(L.music);
    if (L.mode === 'mingle') Sfx.startMurmur();
    logEvent(L.intro);
    UI.caption(L.intro, 6);
    feature('art'); feature('levels');
  }

  // ---------------- helpers ----------------
  const present = () => G.npcs.filter((n) => n.present);
  const humans = () => G.npcs.filter((n) => !n.def.dog && n.present);
  const npcById = (id) => G.npcs.find((n) => n.id === id);
  const quiet = () => L.quiet(G.t);

  function feature(id) {
    if (G.features[id]) return;
    G.features[id] = true;
    UI.featureShown(FEATURES.find((f) => f.id === id));
  }
  function logEvent(text) { G.log.push({ t: G.t || 0, text }); }
  function floater(x, y, text, color = '#8e5bd6') { G.floaters.push({ x, y, text, color, t: 0 }); }
  function shake(amount) { if (G.cam) G.cam.shake = Math.max(G.cam.shake, amount); }

  function addClue(c) {
    const existing = G.clues.find((k) => k.key === c.key);
    if (existing) { Object.assign(existing, c); return existing; }
    c.t = G.t; G.clues.push(c);
    if (c.kind !== 'odd') { UI.clueToast(c); Sfx.ui('clue'); }
    return c;
  }

  function recomputeAura() {
    const h = humans(), sus = h.map((n) => n.sus);
    if (!sus.length) return;
    const avg = sus.reduce((a, b) => a + b, 0) / sus.length, mx = Math.max(...sus);
    G.aura = U.clamp(100 - (0.55 * avg + 0.45 * mx) * 1.1, 0, 100);
  }

  // How much the room, on average, suspects someone.
  function crowdOpinion(id) {
    const h = humans().filter((n) => n.id !== id);
    if (!h.length) return 0;
    return h.reduce((a, n) => a + (n.op[id] || 0), 0) / h.length;
  }
  function primeSuspect() {
    let best = null, bv = 12;
    for (const c of CAST) { const v = crowdOpinion(c.id); if (v > bv) { bv = v; best = c.id; } }
    return best;
  }

  // Something the player did that people might notice.
  function act(label, amount, { owner = null, sound = 0, quiet: silent = false } = {}) {
    const before = G.aura, p = G.player, wit = [];
    for (const n of humans()) {
      const d = U.dist(n, p);
      const noticed = sound ? d < sound : NPC.sees(n, p);
      if (!noticed) continue;
      const eagle = (n.def.perception ?? 1) >= 1.3 ? 1.4 : 1;
      const a = amount * (sound ? 1 - (d / sound) * 0.6 : 1) * (n.id === owner ? 1.6 : 1) * eagle;
      n.sus = Math.min(100, n.sus + a);
      wit.push(n);
      if (eagle > 1) feature('traits');
      if (!silent) { n.expr = 'sus'; n.exprT = 2.4; if (!n.walking) n.face = Math.atan2(p.y - n.y, p.x - n.x); }
    }
    recomputeAura();
    feature('vision');
    if (wit.length) {
      feature('aura');
      const lost = Math.max(1, Math.round(before - G.aura));
      if (!silent) {
        floater(p.x, p.y - 95, `-${lost} AURA`);
        const names = wit.slice(0, 3).map((n) => n.def.name).join(', ') + (wit.length > 3 ? ` +${wit.length - 3}` : '');
        UI.caption(`${names} saw you ${label}.`, 3.2);
        Sfx.ui('bad');
      }
    } else if (!silent) {
      floater(p.x, p.y - 95, 'nobody saw', '#6b6f7a');
    }
    return wit;
  }

  // ---------------- level api ----------------
  function once(flag, fn) { if (!G.flags[flag]) { G.flags[flag] = true; fn(); } }
  const api = {
    once,
    say(id, text, dur = 3.5, tone = 'speech') {
      const n = npcById(id);
      if (n) return NPC.say(n, text, dur, tone);
      const a = G.actors[id]; if (a) a.bubble = { text, t: dur, tone };
    },
    caption: (t, d) => UI.caption(t, d),
    log: logEvent,
    seatEveryone: () => G.npcs.forEach((n) => { n.confronting = false; }),
    door(id, open) { Gas.setDoor(id, open); G.doors[id].target = open ? 1 : 0; },
    doorOpen: (id) => (G.doors && G.doors[id] ? G.doors[id].open : 0),
    time: () => G.t || 0,
    music: (id) => Sfx.setMusic(id),
    organ: (dur) => { Sfx.stopMurmur(); Sfx.organ(dur); },
    actor(id, spec) { G.actors[id] = { id, walking: false, bubble: null, face: Math.PI / 2, speed: 34, ...spec }; },
    arrive(id, from) {
      const n = npcById(id); if (!n) return;
      n.present = true; n.x = from.x; n.y = from.y;
      const spot = freeSpot(['frontleft', 'buttons', 'middle'], n);
      n.seat = { x: spot.x, y: spot.y, face: Math.PI / 2 }; n.target = { ...spot };
      G.items[id] = { ...G.items[id], x: spot.x + 26, y: spot.y + 4, present: true };
    },
  };
  function freeSpot(zoneIds, self) {
    for (let k = 0; k < 160; k++) {
      const z = zoneById(U.pick(Math.random, zoneIds)), p = { x: z.x + 40 + Math.random() * (z.w - 80), y: z.y + 60 + Math.random() * (z.h - 75) };
      if (G.npcs.every((o) => o === self || !o.present || U.dist(o.seat || o, p) > 48) && U.dist(G.player, p) > 40) return p;
    }
    return { x: 640, y: 560 };
  }

  // ---------------- the timeline ----------------
  function timeline() {
    const t = G.t, cs = G.cs, T = TIMELINE;
    if (t >= T.fart) once('fart', () => {
      const s = cs.spots[cs.culprit];
      Gas.emit(s.x, s.y, L.gas.amount * (0.7 + 0.6 * cs.food.stink), 1.4);
      logEvent('Something happened.');
      if (cs.fartType !== 'sbd') {
        Sfx.fart(cs.fartType, s.x);
        const side = s.x < 470 ? 'left side' : s.x > 810 ? 'right side' : 'middle';
        const kind = cs.fartType === 'squeaker' ? 'A high, squeaky one' : 'A long, low trumpet';
        UI.caption(`*pfrrrt* ... ${kind}, from the ${side}. Did anyone else hear that?`, 5);
        addClue({ key: 'sound', kind: 'sound', text: `${kind} came from the ${side}. ${cs.fartType === 'trumpet' ? 'That much gas means something like beans.' : 'Medium volume.'}`, implicates: [], weight: 0 });
        feature('audio');
      } else {
        Sfx.fart('sbd', s.x, 0.6);
        addClue({ key: 'sound', kind: 'sound', text: 'No sound at all. Silent but deadly usually means sulfur-rich protein: eggs, fish, a protein shake.', implicates: [], weight: 0 });
        setTimeout(() => G.state === 'play' && UI.caption('...no sound. Nothing. But give it a few seconds.', 4), 1500);
      }
      G.photoPending = true;
    });
    if (t >= 5) once('procFeat', () => feature('procedural'));
    if (t >= T.fart + 5) once('gasFeat', () => feature('gas'));
    if (t >= T.mention && !G.mentioned) {
      const m = L.mention, n = npcById(m.who);
      if (n && n.present) {
        G.mentioned = true; G.mentionBy = m.who;
        NPC.say(n, m.line, 3.5, 'shout'); n.expr = 'shock'; n.exprT = 2;
        for (const o of humans()) if (o !== n) { if (U.dist(o, n) < 320) o.face = Math.atan2(n.y - o.y, n.x - o.x); if (!m.exempt) NPC.suspect(o, n.id, 18); }
        UI.caption(m.caption, 6);
        if (!m.exempt) UI.stamp('WHOEVER SMELT IT, DEALT IT!');
        logEvent(`${n.def.name}: "${m.line}"`);
        feature('folklore');
      }
    }
    if (t >= T.speakNow) once('speakNow', () => {
      api.say(L.speakNow.who, L.speakNow.line, 9, 'shout');
      UI.speakNow(true);
      UI.caption(L.speakNow.caption, 9);
      logEvent(`"${L.speakNow.line}"`);
      feature('object');
    });
    if (t >= T.end && !G.objected) return finish('peace');
    L.script(t, api);

    G.loud = null;
    for (const e of LOUD_EVENTS) {
      if (t >= e.t && t < e.t + e.dur) {
        G.loud = e;
        once('loud' + e.t, () => {
          if (!e.organ) Sfx.loudEvent(e.label);
          logEvent(`LOUD: ${e.label}`);
          if (G.pressure > 35 && !e.organ) UI.caption(`LOUD: ${e.label} Press F now and nobody will hear you.`, 3);
        });
      }
    }
  }

  // ---------------- per-tick update ----------------
  function update(dt) {
    G.t += dt;
    timeline();
    if (G.state !== 'play') return;
    updatePlayer(dt);
    for (const n of G.npcs) NPC.update(n, dt, G);
    updateActors(dt);
    for (const id in G.doors) { const d = G.doors[id]; d.open += U.clamp(d.target - d.open, -dt * 1.5, dt * 1.5); }
    Gas.step(dt);
    gossip(dt);
    recomputeAura();
    if (G.aura <= 0.5) return finish('bankrupt');
    if (primeSuspect()) once('rumorFeat', () => feature('rumors'));

    const c = Gas.sample(G.player.x, G.player.y);
    if (c > 0.1 && G.t > TIMELINE.fart) identifySmell('nose');
    if (c > 0.3 && G.player.exprT <= 0 && Math.random() < dt * 0.3) { G.player.expr = 'disgust'; G.player.exprT = 1.5; }
    if (G.player.exprT > 0) { G.player.exprT -= dt; if (G.player.exprT <= 0) G.player.expr = 'neutral'; }

    // you need to go too
    if (G.t > 4) G.pressure = Math.min(100, G.pressure + dt * L.pressureRate);
    if (G.pressure >= 60) once('pressureWarn', () => {
      feature('pressure');
      UI.caption('Uh oh. You need to go too. Hold it, or let it out (F) under something loud.', 5);
    });
    updateRumble(dt);
    if (G.pressure >= 100) release(true);

    if (G.sniffCd > 0) G.sniffCd -= dt;
    if (G.sv.t > 0) G.sv.t -= dt;
    if (G.sniffArrow) { G.sniffArrow.t -= dt; if (G.sniffArrow.t <= 0) G.sniffArrow = null; }
    if (G.player.bubble) { G.player.bubble.t -= dt; if (G.player.bubble.t <= 0) G.player.bubble = null; }
    G.puffs = G.puffs.filter((p) => (p.t += dt) < p.life);
  }

  // Stomach rumbles: hold C to clench before anyone hears.
  function updateRumble(dt) {
    if (G.pressure < 50) return;
    if (!G.rumble && G.t >= G.nextRumble) {
      G.rumble = { left: 2.4, held: 0 }; G.nextRumble = G.t + 14 + Math.random() * 9;
      Sfx.gurgle(0.25); feature('clench');
    }
    const r = G.rumble; if (!r) return;
    if (keys.KeyC || G.clenchHeld) r.held += dt;
    r.left -= dt;
    if (r.held >= 0.8) {
      G.rumble = null; G.pressure = Math.max(0, G.pressure - 8);
      floater(G.player.x, G.player.y - 95, 'clenched', '#3c8d2f'); Sfx.ui('good');
    } else if (r.left <= 0) {
      G.rumble = null; G.pressure = Math.min(100, G.pressure + 5);
      Sfx.gurgle(1);
      act('let out a loud stomach gurgle', 9, { sound: 180 });
    }
  }

  function updatePlayer(dt) {
    const p = G.player, B = L.bounds;
    let mx = 0, my = 0;
    if (keys.ArrowLeft || keys.KeyA) mx -= 1;
    if (keys.ArrowRight || keys.KeyD) mx += 1;
    if (keys.ArrowUp || keys.KeyW) my -= 1;
    if (keys.ArrowDown || keys.KeyS) my += 1;
    if (mx || my) { p.target = null; p.pending = null; }
    else if (p.target) {
      const dx = p.target.x - p.x, dy = p.target.y - p.y, d = Math.hypot(dx, dy);
      if (d < 6) {
        p.target = null;
        if (p.pending) { const pend = p.pending; p.pending = null; interact(pend); }
      } else { mx = dx / d; my = dy / d; }
    }
    const len = Math.hypot(mx, my);
    p.walking = len > 0;
    if (len) {
      const sp = (L.mode === 'elevator' ? 120 : 165) * dt;
      p.x = U.clamp(p.x + (mx / len) * sp, B.x0, B.x1);
      p.y = U.clamp(p.y + (my / len) * sp, B.y0, B.y1);
      p.face = Math.atan2(my, mx);
      if (quiet() && G.t > 2) {
        G.vowMoveAcc += dt;
        if (G.vowMoveAcc > 1.2) { G.vowMoveAcc = 0; act(L.mode === 'elevator' ? 'shuffling around the elevator' : 'wandering around during the vows', L.moveCost); }
      }
    }
  }

  function updateActors(dt) {
    for (const id in G.actors) {
      const b = G.actors[id];
      if (b.bubble) { b.bubble.t -= dt; if (b.bubble.t <= 0) b.bubble = null; }
      if (!b.target) continue;
      const dx = b.target.x - b.x, dy = b.target.y - b.y, d = Math.hypot(dx, dy), sp = b.speed * dt;
      if (d <= sp) { b.x = b.target.x; b.y = b.target.y; b.target = null; b.walking = false; b.face = Math.PI / 2; }
      else { b.x += (dx / d) * sp; b.y += (dy / d) * sp; b.walking = true; }
    }
  }

  // Suspicion of you, and opinions about everyone else, spread between people standing together.
  function gossip(dt) {
    G.gossipT -= dt;
    G.pssts = G.pssts.filter((s) => (s.t -= dt) > 0);
    if (G.gossipT > 0) return;
    G.gossipT = 1;
    const h = humans();
    for (const a of h) for (const b of h) {
      if (a === b || U.dist(a, b) > 150) continue;
      if (quiet() && a.seated && L.mode !== 'elevator') continue; // nobody whispers during the vows (except you)
      const rate = 0.12 * (a.def.gossip ?? 1) * (L.mode === 'elevator' ? 0.6 : 1);
      for (const id in a.op) if (id !== b.id && a.op[id] > (b.op[id] || 0) + 8) b.op[id] = (b.op[id] || 0) + (a.op[id] - (b.op[id] || 0)) * rate * 0.7;
      if (a.sus < 15 || a.sus <= b.sus + 8) continue;
      const delta = (a.sus - b.sus) * rate;
      b.sus = Math.min(100, b.sus + delta);
      if (delta > 2 && (!a.lastPsst || G.t - a.lastPsst > 5)) {
        a.lastPsst = G.t;
        G.pssts.push({ a, b, t: 1.8 });
        if (!a.bubble) NPC.say(a, '*whispers about you*', 1.8, 'thought');
        feature('gossip');
        if ((a.def.gossip ?? 1) >= 1.6) feature('traits');
      }
    }
  }

  // ---------------- evidence ----------------
  function identifySmell(how) {
    if (G.know.smell) return;
    G.know.smell = true;
    const f = G.cs.food;
    addClue({ key: 'smell', kind: 'smell', text: `It smells like ${f.smell}. That's ${f.name}.`, implicates: [], weight: 0, food: f.id });
    feature('science');
    if (how === 'nose') { G.player.expr = 'disgust'; G.player.exprT = 2.5; UI.caption(`There it is. Unmistakable: ${f.smell}. Somebody had ${f.name}.`, 5); }
  }

  function checkContradictions(id) {
    const claim = G.know.claims[id];
    if (!claim) return;
    const bag = G.know.bagFood[id], wit = G.know.witnessFood[id];
    const truth = bag && bag !== claim ? { food: bag, src: 'their bag' } : wit && wit !== claim ? { food: wit, src: 'a witness' } : null;
    if (!truth || G.clues.some((c) => c.key === 'contra-' + id)) return;
    const nm = castById(id).name;
    addClue({ key: 'contra-' + id, kind: 'contradiction', who: id, food: truth.food, text: `${nm} claimed ${foodById(claim).name}, but ${truth.src} says ${foodById(truth.food).name}. ${nm} lied.`, implicates: [id], weight: 2.5 });
    UI.stamp('CONTRADICTION!', 'gold'); shake(6);
    Sfx.ui('lock');
  }

  function learnFact(n, fact, overheard) {
    if (G.know.facts[n.id]) return;
    G.know.facts[n.id] = true;
    addClue({ key: 'fact-' + n.id, kind: fact.kind === 'witness' ? 'witness' : 'gossip', who: fact.about, text: `${overheard ? 'Overheard ' : ''}${n.def.name}: "${fact.text}"`, implicates: fact.implicates, weight: fact.weight, food: fact.food, zone: fact.zone });
    if (fact.kind === 'witness') { G.know.witnessFood[fact.about] = fact.food; checkContradictions(fact.about); }
  }
  function onOverhear(n, fact) { learnFact(n, fact, true); feature('eavesdrop'); }

  function onReaction(n) {
    G.know.reactions.push({ id: n.id, t: G.t, zone: n.reactZone });
    logEvent(`${n.def.name} reacts to the smell (by the ${zoneById(n.reactZone).name}).`);
    if (G.know.reactions.length === 1) feature('noses');
    if (G.know.reactions.length === 3) {
      const first = G.know.reactions.slice(0, 3).map((r) => `${castById(r.id).name} (${zoneById(r.zone).name})`).join(', ');
      addClue({ key: 'first3', kind: 'reaction', text: `First three to react: ${first}.`, implicates: [], weight: 0 });
    }
  }

  function onCover(n) {
    if (U.dist(n, G.player) > 420) return;
    G.know.tells++;
    const cv = G.cs.cover;
    addClue({ key: 'tell', kind: 'tell', who: n.id, text: `You saw ${n.def.name} ${cv.label}${G.know.tells > 1 ? ` (${G.know.tells} times now)` : ''}.`, implicates: [n.id], weight: 1.5, cover: cv.id });
    logEvent(`${n.def.name} was ${cv.label}.`);
  }

  function onIdle(n) {
    if (U.dist(n, G.player) > 380 || G.clues.some((c) => c.key === 'odd-' + n.id)) return;
    addClue({ key: 'odd-' + n.id, kind: 'odd', who: n.id, text: `${n.def.name}: ${IDLES[n.id].bubble}`, implicates: [], weight: 0 });
  }

  function flash(n) { G.flashes.push({ x: n.x + 10, y: n.y - 70, t: 0.3 }); }

  // ---------------- photos and snapshots ----------------
  function capture(crop, width = 480) {
    const out = document.createElement('canvas');
    out.width = width; out.height = Math.round(width * crop.h / crop.w);
    out.getContext('2d').drawImage(cv, crop.x * scale, crop.y * scale, crop.w * scale, crop.h * scale, 0, 0, out.width, out.height);
    return out.toDataURL('image/jpeg', 0.82);
  }
  function takePhoto() {
    const cs = G.cs, s = cs.spots[cs.culprit];
    const crop = L.photo.crop || { x: U.clamp(s.x - 290 + (Math.random() - 0.5) * 120, 0, W - 580), y: U.clamp(s.y - 230, 0, H - 330), w: 580, h: 330 };
    const inShot = present().filter((n) => n.x > crop.x && n.x < crop.x + crop.w && n.y > crop.y + 40 && n.y < crop.y + crop.h + 40);
    G.photo = { img: capture(crop), stamp: L.stampTime(G.t), ids: inShot.map((n) => n.id), zones: Object.fromEntries(inShot.map((n) => [n.id, zoneAt(n).id])) };
    G.snaps.fart = capture({ x: 0, y: 0, w: W, h: H }, 480);
  }
  function findPhoto() {
    if (!G.photo || G.clues.some((c) => c.key === 'photo')) return;
    const ph = G.photo, origin = G.cs.origin.id;
    const names = ph.ids.map((id) => `${castById(id).name} (${zoneById(ph.zones[id]).name})`);
    const atOrigin = ph.ids.filter((id) => ph.zones[id] === origin);
    addClue({ key: 'photo', kind: 'photo', text: `${L.photo.caption} (${ph.stamp}). In shot: ${names.join(', ') || 'nobody useful'}.`, implicates: atOrigin, weight: 1, zone: origin, img: ph.img });
    feature('photo');
  }

  // ---------------- player actions ----------------
  function nearestInteractable() {
    const p = G.player;
    let best = null, bd = Infinity;
    for (const n of G.npcs) { if (!n.present) continue; const d = U.dist(n, p); if (d < 88 && d < bd) { bd = d; best = { type: 'npc', n }; } }
    for (const c of CAST) {
      const it = G.items[c.id];
      if (!it.present || G.know.bags[c.id] === 'seen') continue;
      const d = U.dist(it, p) - 14;
      if (d < 50 && d < bd) { bd = d; best = { type: 'item', c }; }
    }
    for (const pr of G.props) {
      if (G.flags['prop-' + pr.id]) continue;
      const d = U.dist(pr, p) - 10; if (d < 60 && d < bd) { bd = d; best = { type: 'prop', pr }; }
    }
    return best;
  }

  function interact(target = nearestInteractable()) {
    if (!target || G.state !== 'play') return;
    if (target.type === 'npc') {
      if (quiet()) act(L.mode === 'elevator' ? 'breaking the elevator silence' : 'whispering during the vows', L.talkCost);
      G.state = 'dialogue';
      if (target.n.def.trait) feature('traits');
      UI.openDialogue(target.n, 'talk');
    } else if (target.type === 'item') {
      snoop(target.c);
    } else {
      G.flags['prop-' + target.pr.id] = true;
      act('squinting up at the security camera', 8);
      findPhoto();
      G.state = 'dialogue';
      UI.openPhoto(G.photo);
    }
  }

  function snoop(c) {
    const it = G.items[c.id];
    act(`going through ${it.label}`, 20, { owner: c.id });
    G.know.bags[c.id] = 'seen';
    const bag = G.cs.bags[c.id];
    if (bag.food) G.know.bagFood[c.id] = bag.food;
    addClue({ key: 'bag-' + c.id, kind: 'bag', who: c.id, text: `${it.label}: ${bag.text}`, implicates: bag.implicates, weight: bag.weight, food: bag.food });
    checkContradictions(c.id);
    feature('snoop');
    const hasPhoto = L.photo.source === 'item' && L.photo.owner === c.id;
    if (hasPhoto) findPhoto();
    G.state = 'dialogue';
    UI.openItem(c, it, bag, hasPhoto ? G.photo : null);
  }

  function talkOptions(n) {
    if (n.def.dog) return [{ id: 'pet', label: L.scapegoat.petLabel, tag: 'harmless' }, { id: 'leave', label: 'Leave' }];
    const o = [], after = G.t >= TIMELINE.fart;
    if (!n.asked.breakfast) o.push({ id: 'breakfast', label: "What'd you have to eat today?", tag: 'small talk' });
    if (after && !n.asked.where) o.push({ id: 'where', label: 'Where were you standing a minute ago?', tag: 'small talk' });
    if (!n.asked.gossip && !G.know.facts[n.id]) o.push({ id: 'gossip', label: 'Seen anything weird today?', tag: 'nosy' });
    if (after && !n.asked.smell) o.push(G.mentioned
      ? { id: 'smell', label: 'What did it smell like to you?', tag: 'safe now' }
      : { id: 'smell', label: 'Did... you smell that?', tag: 'risky' });
    if (after && !n.asked.rumor) o.push({ id: 'rumor', label: 'Plant a rumour: "I bet it was..."', tag: 'scheming' });
    o.push({ id: 'leave', label: 'Leave' });
    return o;
  }
  function rumorTargets(n) {
    return CAST.filter((c) => c.id !== n.id && npcById(c.id).present).map((c) => ({ id: 'rumor:' + c.id, label: c.name, tag: c.dog ? 'scapegoat' : null }))
      .concat([{ id: 'back', label: 'Never mind' }]);
  }

  function smeltIt(n) {
    G.mentioned = true; G.mentionBy = 'player';
    n.sus = Math.min(100, n.sus + 45); recomputeAura();
    UI.stamp('WHOEVER SMELT IT, DEALT IT!'); shake(8);
    feature('folklore');
    logEvent(`You mentioned the smell first. ${n.def.name} noticed.`);
  }

  function talkChoose(n, id) {
    const v = VOICES[n.id], cs = G.cs;
    if (id.startsWith('rumor:')) return plantRumor(n, id.slice(6));
    if (id === 'rumor') return { text: null, sub: rumorTargets(n) };
    if (id === 'back') return { text: null };
    n.asked[id] = true;
    if (id !== 'leave') feature('interrogate');
    switch (id) {
      case 'breakfast': {
        const f = foodById(cs.claims[n.id]);
        G.know.claims[n.id] = f.id;
        addClue({ key: 'claim-' + n.id, kind: 'claim', who: n.id, text: `${n.def.name} says they had ${f.name}.`, implicates: f.id === cs.food.id ? [n.id] : [], weight: 1, food: f.id });
        checkContradictions(n.id);
        return { text: U.fill(v.breakfast, { food: f.name }) };
      }
      case 'where': {
        const zid = cs.fartZone[n.id];
        if (!zid) {
          addClue({ key: 'zone-' + n.id, kind: 'zone', who: n.id, text: `${n.def.name} got on after it happened. Not a suspect.`, implicates: [], weight: 0 });
          return { text: v.where };
        }
        const z = zoneById(zid);
        G.know.zones[n.id] = z.id;
        addClue({ key: 'zone-' + n.id, kind: 'zone', who: n.id, text: `${n.def.name} was by the ${z.name} when it happened.`, implicates: z.id === cs.origin.id ? [n.id] : [], weight: 1, zone: z.id });
        return { text: U.fill(v.where, { zone: z.name }) };
      }
      case 'gossip': {
        n.sus = Math.min(100, n.sus + 6); recomputeAura();
        const f = cs.facts[n.id];
        if (!f) return { text: v.gossipNone };
        learnFact(n, f, false);
        return { text: U.fill(v.gossip, { fact: f.text }) };
      }
      case 'smell': {
        if (!G.mentioned) { smeltIt(n); return { text: "...Smell WHAT? I didn't say anything. Funny that YOU noticed first.", expr: 'sus', bad: true }; }
        identifySmell('told');
        const sm = cs.food.smell;
        const rz = n.reactZone ? ` It hit me over by the ${zoneById(n.reactZone).name}.` : ' Honestly I barely caught it.';
        return { text: U.fill(v.smell, { smell: sm, Smell: U.cap(sm), SMELL: sm.toUpperCase() }) + rz, expr: 'disgust' };
      }
      case 'pet': {
        const sg = L.scapegoat;
        if (cs.isDog) addClue({ key: 'scapebreath', kind: 'witness', who: sg.id, text: sg.breath(true), implicates: [sg.id], weight: 1.5, food: sg.food });
        return { text: sg.breath(cs.isDog) };
      }
    }
    return { text: '' };
  }

  // Tell someone who you think did it. They believe you more than they should.
  function plantRumor(n, target) {
    n.asked.rumor = true;
    feature('rumors');
    const t = castById(target);
    let note = '';
    if (!G.mentioned) { smeltIt(n); note = ' (You brought it up first, though. They noticed.)'; }
    else n.sus = Math.max(0, n.sus - 8);
    const kid = (n.def.gossip ?? 1) >= 2;
    NPC.suspect(n, target, t.dog && !kid ? 10 : 26);
    recomputeAura();
    logEvent(`You told ${n.def.name} it was ${t.name}.`);
    const line = t.dog ? (kid ? `${t.name}?! I KNEW it!` : `Blaming ${t.name}? Really? ...I mean, maybe.`) : U.fill(VOICES[n.id].rumor, { name: t.name, NAME: t.name.toUpperCase() });
    return { text: line + note, expr: 'shock' };
  }

  function confrontOptions() {
    return [
      { id: 'deny', label: '"No! Absolutely not! I would NEVER!"', tag: 'deny it' },
      { id: 'rhyme', label: '"Whoever smelt it, dealt it, buddy."', tag: 'rhyme' },
      { id: 'calm', label: '"Honestly? I\'m trying to figure that out too."', tag: 'stay calm' },
    ];
  }
  function confrontChoose(n, id) {
    feature('folklore');
    if (id === 'deny') {
      n.sus = Math.min(100, n.sus + 20);
      for (const o of humans()) if (o !== n && U.dist(o, n) < 220) o.sus = Math.min(100, o.sus + 8);
      UI.stamp('WHOEVER DENIED IT, SUPPLIED IT!'); shake(8);
      recomputeAura();
      return { text: "Wow. That's a LOT of denying for someone who didn't do anything.", expr: 'sus', bad: true };
    }
    if (id === 'rhyme') {
      n.sus = Math.min(100, n.sus + 15); recomputeAura();
      UI.stamp('WHOEVER MADE THE RHYME DID THE CRIME!'); shake(8);
      return { text: "Oh, so we're doing RHYMES now? That's exactly what the farter would say.", expr: 'angry', bad: true };
    }
    n.sus = Math.max(0, n.sus - 35); recomputeAura(); Sfx.ui('good');
    return { text: '...Yeah. Okay. Fair. Let me know what you find out.', expr: 'neutral' };
  }
  function startConfront(n) {
    if (G.state !== 'play') { n.confronted = false; return; }
    G.state = 'dialogue';
    UI.openDialogue(n, 'confront');
  }
  const anyConfronting = () => G.npcs.some((n) => n.confronting);

  function sniff() {
    if (G.state !== 'play' || G.sniffCd > 0) return;
    G.sniffCd = 1.6; Sfx.sniff();
    act('sniffing the air like a bloodhound', 7);
    const p = G.player, c = Gas.sample(p.x, p.y);
    let msg;
    if (G.t < TIMELINE.fart) msg = L.mode === 'elevator' ? 'Carpet cleaner and coffee.' : 'Lilies, floor polish, and nerves.';
    else if (c < 0.03) msg = 'Nothing here. Clean air.';
    else {
      identifySmell('sniff');
      const g = Gas.gradient(p.x, p.y), a = Math.atan2(g.y, g.x);
      const tz = zoneAt({ x: U.clamp(p.x + Math.cos(a) * 200, 0, W), y: U.clamp(p.y + Math.sin(a) * 200, 0, H) });
      const strength = c > 0.5 ? 'Overwhelming' : c > 0.18 ? 'Strong' : 'Faint';
      msg = `${strength} ${G.cs.food.smell}. Stronger toward the ${tz.name}.`;
      G.sniffArrow = { a, t: 2.6 };
    }
    p.bubble = { text: msg, t: 3.4, tone: 'thought' };
  }

  function smellVision() {
    if (G.state !== 'play') return;
    if (G.sv.t > 0) return;
    if (G.sv.charges <= 0) { UI.caption('Out of Smell Vision for this case.', 2.5); return; }
    G.sv.charges--; G.sv.t = 7; Sfx.whoosh(true);
    feature('smellvision');
  }

  function release(forced = false) {
    if (G.state !== 'play') return;
    const p = G.player;
    if (!forced && G.pressure < 20) { p.bubble = { text: "Nothing to let go yet. You're fine.", t: 2, tone: 'thought' }; return; }
    const amount = (120 + G.pressure * 1.4) * (L.gas.amount / 340);
    const size = G.pressure / 60;
    G.pressure = 0; G.rumble = null;
    feature('pressure');
    Gas.emit(p.x, p.y, amount, 1);
    G.puffs.push({ x: p.x - 6, y: p.y - 18, t: 0, life: 1.6, size: 0.6 + size * 0.6, seed: Math.random() * 6 });
    if (forced) {
      Sfx.fart('trumpet', p.x, 1.2);
      act('let rip a full trumpet solo', 50, { sound: 560 });
      UI.stamp('THAT ONE WAS DEFINITELY YOU.'); shake(14);
      logEvent('You could not hold it any longer.');
    } else if (G.loud) {
      Sfx.fart('squeaker', p.x, 0.25);
      floater(p.x, p.y - 95, 'perfectly timed', '#3c8d2f');
      UI.caption(`${G.loud.label} It covered you completely. Smooth.`, 3.5);
      Sfx.ui('good');
      logEvent(`You let one go under cover of: ${G.loud.label}`);
    } else {
      Sfx.fart('squeaker', p.x, 0.8);
      act('fart. Audibly', 30, { sound: 300 });
      UI.stamp('THAT WAS AUDIBLE.'); shake(8);
      logEvent('You farted in silence. People heard.');
    }
  }

  function object() {
    if (G.state !== 'play') return;
    if (G.t < TIMELINE.fart + 3) { UI.caption('Call out what? Nothing has happened yet.', 2.5); return; }
    G.objected = true; G.state = 'accuse';
    Sfx.stopOrgan(); Sfx.stamp(); Sfx.sting('objection'); Sfx.setMusic('trial');
    feature('object');
    G.npcs.forEach((n) => { if (!n.present) return; n.face = Math.atan2(G.player.y - n.y, G.player.x - n.x); n.expr = 'shock'; n.exprT = 99; n.bubble = null; });
    focus(G.player, 1.6); shake(16);
    G.snapPending = 'object';
    UI.openAccuse();
  }
  function focus(p, z) { G.cam.tx = p.x + 300 / z; G.cam.ty = U.clamp(p.y - 50, H / (2 * z) - 60, H - H / (2 * z) + 60); G.cam.tz = z; }
  function unfocus() { if (G.cam) { G.cam.tx = W / 2; G.cam.ty = H / 2; G.cam.tz = 1; } }

  // ---------------- smell board ----------------
  function checkBoard() {
    const b = G.board, a = G.cs.answer;
    if (b.locked) return;
    if (!b.who || !b.food || !b.zone || !b.cover) { b.feedback = 'Fill in every blank first.'; return; }
    b.checks++;
    const wrong = ['who', 'food', 'zone', 'cover'].filter((k) => b[k] !== a[k]).length;
    if (wrong === 0) { b.locked = true; b.feedback = 'Locked in. That is the whole story. Now prove it when it is time to call it.'; Sfx.ui('lock'); }
    else if (wrong === 1) { b.feedback = 'So close. Exactly one blank is wrong.'; Sfx.ui('tick'); }
    else { b.feedback = `Not yet. ${wrong === 4 ? 'Nothing lines up' : 'Two or more blanks are wrong'}.`; Sfx.ui('bad'); }
  }

  // ---------------- cross-examination ----------------
  // The accused makes three statements. The culprit's are lies that specific clues break.
  function testimony(accused) {
    const cs = G.cs, def = castById(accused), guilty = accused === cs.culprit, sg = L.scapegoat;
    const cName = castById(cs.culprit).name;
    const about = (c) => c.who === accused || (c.implicates || []).includes(accused);
    if (def.dog) {
      const sp = castById(sg.speaker).name;
      return [
        { id: 'food', speaker: sp, text: sg.testimony.food, contra: (c) => guilty && about(c) && c.food === sg.food, press: guilty ? 'Okay, he MIGHT have had a little snack.' : 'Really. Ask anyone.' },
        { id: 'zone', speaker: sp, text: sg.testimony.zone, contra: (c) => guilty && about(c) && c.zone === cs.origin.id, press: guilty ? 'Mostly asleep. Some of the time.' : 'Look at that face. That is a sleeping face.' },
        { id: 'cover', speaker: sp, text: sg.testimony.cover, contra: (c) => guilty && c.kind === 'tell' && c.who === accused, press: guilty ? 'That was... stretching.' : `Unlike ${cName}, who has been ${cs.cover.label}.` },
      ];
    }
    const claim = foodById(cs.claims[accused]);
    const st = [{ id: 'food', speaker: def.name, text: `I had ${claim.name} today. That's all.`,
      contra: (c) => ['bag', 'witness', 'contradiction'].includes(c.kind) && about(c) && c.food && c.food !== claim.id,
      press: guilty ? `${U.cap(claim.name)}. Yes. Definitely. Why are you looking at me like that?` : 'Ask anyone. I had it right in front of everybody.' }];
    const z = cs.fartZone[accused];
    if (guilty) st.push({ id: 'zone', speaker: def.name, text: `I was nowhere near the ${cs.origin.name}. I was over by the ${zoneById(cs.alibiZone).name}.`,
      contra: (c) => ['zone', 'gossip', 'photo'].includes(c.kind) && about(c) && c.zone === cs.origin.id, press: `The ${zoneById(cs.alibiZone).name}. The whole time. Mostly.` });
    else if (!z) st.push({ id: 'zone', speaker: def.name, text: "I wasn't even here when it happened!", contra: () => false, press: 'I got on later. Check the floor numbers.' });
    else st.push({ id: 'zone', speaker: def.name, text: `I was by the ${zoneById(z).name} the whole time.`, contra: () => false,
      press: z === cs.origin.id ? `Yes, I was near it. But so was ${cName}, and they were acting strange.` : 'People saw me there. Ask around.' });
    st.push({ id: 'cover', speaker: def.name, text: guilty ? `And I definitely wasn't ${cs.cover.label}.` : "I've just been standing here like a normal person.",
      contra: (c) => guilty && c.kind === 'tell' && c.who === accused, press: guilty ? 'That was... unrelated. Allergies.' : `Unlike ${cName}, who has been ${cs.cover.label} all day.` });
    return st;
  }

  function startTrial(accused) {
    const base = Math.min(55, 10 + crowdOpinion(accused) * 0.45);
    G.trial = { accused, statements: testimony(accused), belief: base, broken: new Set(), pressed: new Set(), withdrawn: G.trial ? !!G.trial.withdrawn : false };
    const n = npcById(accused); focus(n, 1.7);
    feature('trial');
    return G.trial;
  }
  function trialPress(i) {
    const tr = G.trial, s = tr.statements[i];
    tr.pressed.add(i);
    const n = npcById(tr.accused); if (n) { n.expr = tr.accused === G.cs.culprit ? 'worried' : 'angry'; n.exprT = 99; }
    return s.press;
  }
  function trialPresent(i, clueKey) {
    const tr = G.trial, s = tr.statements[i], c = G.clues.find((k) => k.key === clueKey);
    const n = npcById(tr.accused);
    if (c && s.contra(c)) {
      tr.broken.add(i);
      tr.belief = Math.min(100, tr.belief + 30);
      if (n) { n.expr = 'shock'; n.exprT = 99; }
      UI.stamp('OBJECTION!', 'red'); shake(18); Sfx.sting('break');
      return { hit: true };
    }
    tr.belief = Math.max(0, tr.belief - 10);
    for (const o of humans()) o.sus = Math.min(100, o.sus + 5);
    recomputeAura(); shake(5); Sfx.ui('bad');
    return { hit: false };
  }
  function withdraw() {
    const tr = G.trial;
    if (!tr || tr.withdrawn) return false;
    for (const o of humans()) o.sus = Math.min(100, o.sus + 12);
    recomputeAura();
    G.trial = { withdrawn: true };
    focus(G.player, 1.6);
    return true;
  }
  function resolveTrial() {
    const tr = G.trial, correct = tr.accused === G.cs.culprit;
    const all = tr.broken.size === tr.statements.length;
    const outcome = !correct ? 'wrong' : (all || tr.belief >= 75) ? 'confess' : tr.belief >= 45 ? 'reluctant' : 'unproven';
    return { accused: tr.accused, correct, outcome, broken: tr.broken.size, belief: tr.belief };
  }

  // ---------------- results ----------------
  function finish(kind, acc = null) {
    if (G.result) return;
    G.state = 'result';
    Sfx.stopOrgan(); Sfx.stopMurmur(); Sfx.setMusic(null);
    unfocus();
    const shame = acc ? castById(acc.accused).shame : 0;
    const rows = [];
    let score = 0, rank, title;
    if (kind === 'accuse') {
      if (acc.correct) {
        const stakes = Math.round(shame * 30 * (acc.outcome === 'unproven' ? 0.5 : 1));
        rows.push(['Named the right culprit', 500], [`Stakes: ${castById(acc.accused).name} (shame ${shame}/10)`, stakes]);
        score += 500 + stakes;
      } else {
        const pen = -shame * 40;
        rows.push([`Wrongly accused ${castById(acc.accused).name} (shame ${shame}/10)`, pen]);
        score += pen;
      }
      const ev = acc.correct ? acc.broken * 120 : 0;
      rows.push([`Testimony broken (${acc.broken}/3)`, ev]); score += ev;
    }
    const auraPts = Math.round(G.aura * 4);
    rows.push([`Aura kept (${Math.round(G.aura)}%)`, auraPts]); score += auraPts;
    if (G.board.locked) { rows.push(['Smell Board solved', 150]); score += 150; }
    if (kind === 'bankrupt') { rank = 'F'; title = 'Aura bankrupt'; }
    else if (kind === 'peace') { rank = 'D'; title = L.mode === 'elevator' ? 'Let the doors close on it' : 'Forever held your peace'; }
    else if (!acc.correct) { rank = 'F'; title = L.mode === 'elevator' ? 'Socially fired' : 'Wedding ruiner'; }
    else if (score >= 1300) { rank = 'S'; title = 'Nose of God'; }
    else if (score >= 1050) { rank = 'A'; title = 'Certified sniffer'; }
    else if (score >= 800) { rank = 'B'; title = 'Decent detective'; }
    else if (score >= 550) { rank = 'C'; title = 'Right answer, weird vibes'; }
    else { rank = 'D'; title = 'Technically correct'; }
    G.result = { kind, acc, rows, score, rank, title };
    UI.showResults(G.result);
  }

  // ---------------- rendering ----------------
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    scale = cv.width / W;
  }

  function render() {
    const cam = G.cam || { x: W / 2, y: H / 2, z: 1, shake: 0 };
    if (G.cam) { cam.x += (cam.tx - cam.x) * 0.08; cam.y += (cam.ty - cam.y) * 0.08; cam.z += (cam.tz - cam.z) * 0.08; cam.shake *= 0.88; }
    const sx = (Math.random() - 0.5) * cam.shake, sy = (Math.random() - 0.5) * cam.shake;
    const photoFrame = G.photoPending && G.state === 'play';
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#25232d'; ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    if (background) ctx.drawImage(background, 0, 0, W, H);
    if (!G.cs || !L) return;
    const t = G.anim, sv = G.sv && G.sv.t > 0;
    if (L.overlay && !photoFrame) L.overlay(ctx, t, api);
    if (!photoFrame) Art.drawZoneTags(ctx, sv);

    if (L.mode === 'mingle' && G.t >= TIMELINE.places && G.t < TIMELINE.speakNow && U.dist(G.player, PLAYER_SEAT) > 22) {
      ctx.save(); ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.ellipse(PLAYER_SEAT.x, PLAYER_SEAT.y, 24 + Math.sin(t * 5) * 3, 9, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = '#fff3b0'; ctx.font = '700 11px "Lexend", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('YOUR SEAT', PLAYER_SEAT.x, PLAYER_SEAT.y + 24); ctx.restore();
    }

    if (G.showCones && G.state === 'play' && !photoFrame) {
      for (const n of G.npcs) {
        if (n.def.dog || !n.present) continue;
        const seeing = NPC.sees(n, G.player), rng = NPC.range(n);
        const grd = ctx.createRadialGradient(n.x, n.y - 30, 10, n.x, n.y - 30, rng);
        const col = seeing ? '255,120,60' : '255,236,150';
        grd.addColorStop(0, `rgba(${col},${seeing ? 0.32 : 0.16})`); grd.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.moveTo(n.x, n.y - 30);
        ctx.arc(n.x, n.y - 30, rng, n.face - NPC.VIEW_HALF, n.face + NPC.VIEW_HALF); ctx.closePath(); ctx.fill();
      }
    }

    if (!photoFrame) {
      Gas.paint(gasImg, sv ? 0.92 : 0.2, sv);
      gasCtx.putImageData(gasImg, 0, 0);
      if (sv) { ctx.fillStyle = 'rgba(18,24,12,0.55)'; ctx.fillRect(0, 0, W, H); }
      ctx.save(); ctx.imageSmoothingEnabled = true;
      ctx.drawImage(gasCv, 0, 0, Gas.COLS, Gas.ROWS, 0, 0, W, H); ctx.restore();
      if (sv) Art.drawZoneTags(ctx, true);
    }

    const items = [...L.props(api)];
    const near = G.state === 'play' ? nearestInteractable() : null;
    for (const c of CAST) {
      const it = G.items[c.id];
      if (!it || !it.present) continue;
      items.push({ y: it.y, draw: () => Art.drawItem(ctx, it, it.x, it.y, near && near.type === 'item' && near.c === c, G.know.bags[c.id] === 'seen') });
    }
    for (const n of G.npcs) if (n.present) items.push({ y: n.y, draw: () => drawNPC(n, t) });
    items.push({ y: G.player.y, draw: () => drawPlayer(t) });
    for (const id in G.actors) { const a = G.actors[id]; if (a.look) items.push({ y: a.y, draw: () => Art.drawPerson(ctx, a.look, a.x, a.y, { t, walking: a.walking, faceDir: 1, back: a.walking, expr: 'happy' }) }); }
    items.sort((a, b) => a.y - b.y).forEach((d) => d.draw(ctx));

    if (photoFrame) { G.photoPending = false; takePhoto(); }
    if (G.snapPending && G.state !== 'play' && G.cam && Math.abs(G.cam.z - G.cam.tz) < 0.05) { if (G.snapPending === 'object') G.snaps.object = capture({ x: 0, y: 0, w: W, h: H }, 480); G.snapPending = null; }

    for (const p of G.puffs) Art.puff(ctx, p);
    for (const n of G.npcs) if (n.present && n.expr === 'disgust') Art.stinkLines(ctx, n.x, n.y - (n.def.dog ? 60 : 92 * (n.def.look.scale || 1)), t);

    for (const s of G.pssts) {
      ctx.save(); ctx.strokeStyle = `rgba(142,91,214,${Math.min(1, s.t)})`; ctx.lineWidth = 3; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y - 70); ctx.quadraticCurveTo((s.a.x + s.b.x) / 2, Math.min(s.a.y, s.b.y) - 120, s.b.x, s.b.y - 70); ctx.stroke();
      ctx.restore();
    }

    if (G.sniffArrow) {
      const p = G.player, a = G.sniffArrow.a;
      ctx.save(); ctx.translate(p.x, p.y - 30); ctx.rotate(a); ctx.globalAlpha = Math.min(1, G.sniffArrow.t);
      ctx.fillStyle = '#9bc53d'; ctx.strokeStyle = Art.INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(30, -7); ctx.lineTo(70, -7); ctx.lineTo(70, -16); ctx.lineTo(94, 0); ctx.lineTo(70, 16); ctx.lineTo(70, 7); ctx.lineTo(30, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    G.flashes = G.flashes.filter((f) => (f.t -= 1 / 60) > 0);
    for (const f of G.flashes) { ctx.fillStyle = `rgba(255,255,240,${f.t * 2.5})`; ctx.beginPath(); ctx.arc(f.x, f.y, 40, 0, Math.PI * 2); ctx.fill(); }

    if (G.state !== 'accuse') {
      for (const n of G.npcs) if (n.present && n.bubble) Art.bubble(ctx, n.x, n.y - (n.def.dog ? 55 : 95 * (n.def.look.scale || 1)), n.bubble.text, { tone: n.bubble.tone, alpha: Math.min(1, n.bubble.t * 3), belowY: n.y });
      for (const id in G.actors) { const a = G.actors[id]; if (a.bubble) Art.bubble(ctx, a.x, a.y - (a.look ? 95 : 10), a.bubble.text, { tone: a.bubble.tone, belowY: a.y }); }
      if (G.player.bubble) Art.bubble(ctx, G.player.x, G.player.y - 100, G.player.bubble.text, { tone: G.player.bubble.tone, alpha: Math.min(1, G.player.bubble.t * 3) });
    }

    ctx.font = '700 12px "Lexend", sans-serif'; ctx.textAlign = 'center';
    if (G.state === 'play') {
      for (const n of G.npcs) {
        if (!n.present) continue;
        const show = sv || (near && near.type === 'npc' && near.n === n);
        if (!show) continue;
        const label = n.def.name + (sv && n.reacted ? '  ✓ smelled it' : '');
        const w = ctx.measureText(label).width + 12;
        Art.paperRect(ctx, n.x - w / 2, n.y + 6, w, 18, sv && n.reacted ? '#d9f2a8' : '#fffdf6', n.x, { amp: 1, stroke: Art.INK, lw: 1 });
        ctx.fillStyle = Art.INK; ctx.fillText(label, n.x, n.y + 19);
      }
      if (near) {
        const label = near.type === 'npc' ? (near.n.def.dog ? `E · ${near.n.def.sprite === 'baby' ? 'Coo at' : 'Pet'} ${near.n.def.name}` : `E · Talk to ${near.n.def.name}`)
          : near.type === 'item' ? `E · Snoop: ${G.items[near.c.id].label}` : `E · Check the ${near.pr.label.toLowerCase()}`;
        const x = near.type === 'npc' ? near.n.x : near.type === 'item' ? G.items[near.c.id].x : near.pr.x;
        const y = near.type === 'npc' ? near.n.y + 44 : near.type === 'item' ? G.items[near.c.id].y + 26 : near.pr.y + 30;
        const w = ctx.measureText(label).width + 16;
        Art.paperRect(ctx, x - w / 2, y - 12, w, 22, '#f2c14e', 77, { amp: 1, stroke: Art.INK, lw: 1.5 });
        ctx.fillStyle = Art.INK; ctx.fillText(label, x, y + 4);
      }
      if (G.rumble) {
        const p = G.player, k = G.rumble.held / 0.8, pulse = 1 + Math.sin(t * 20) * 0.06;
        ctx.save(); ctx.translate(p.x, p.y - 40);
        ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 46 * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#3c8d2f'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, 46 * pulse, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
        Art.paperRect(ctx, -70, 50, 140, 24, '#fff3b0', 999, { amp: 1, stroke: Art.INK, lw: 1.5 });
        ctx.fillStyle = Art.INK; ctx.font = '700 13px "Lexend", sans-serif'; ctx.fillText('RUMBLE! Hold C', 0, 67);
        ctx.restore();
      }
    }
    G.floaters = G.floaters.filter((f) => (f.t += 1 / 60) < 1.8);
    for (const f of G.floaters) {
      ctx.save(); ctx.globalAlpha = 1 - f.t / 1.8; ctx.font = '400 20px "Bowlby One SC", sans-serif';
      ctx.fillStyle = f.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.textAlign = 'center';
      ctx.strokeText(f.text, f.x, f.y - f.t * 30); ctx.fillText(f.text, f.x, f.y - f.t * 30); ctx.restore();
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.08; ctx.fillStyle = Art.grainPattern(ctx); ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  function drawNPC(n, t) {
    const lookX = Math.cos(n.face), lookY = Math.sin(n.face);
    const back = n.seated && Math.sin(n.face) < -0.6 && !n.anim && G.state !== 'accuse';
    const faceDir = Math.cos(n.face) < -0.15 ? -1 : 1;
    const o = { t, walking: n.walking, faceDir, expr: n.expr, anim: n.anim, animT: n.animT };
    if (n.def.sprite === 'dog') return Art.drawDog(ctx, n.def.look, n.x, n.y, o);
    if (n.def.sprite === 'baby') return Art.drawBaby(ctx, n.def.look, n.x, n.y, o);
    Art.drawPerson(ctx, n.def.look, n.x, n.y, { ...o, lookX: faceDir * lookX, lookY, back, talking: !!(n.bubble && n.bubble.tone !== 'thought'), blinkSeed: n.id.length * 7 + n.id.charCodeAt(0) });
    if (n.sus > 25 && G.state === 'play') {
      const s = n.def.look.scale || 1, y = n.y - 100 * s;
      ctx.save(); ctx.font = '400 15px "Bowlby One SC", sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = n.sus > 60 ? '#e8505b' : '#8e5bd6'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      const mark = n.sus > 60 ? '!!' : '?';
      ctx.strokeText(mark, n.x + 26, y + 8); ctx.fillText(mark, n.x + 26, y + 8); ctx.restore();
    }
  }

  function drawPlayer(t) {
    const p = G.player;
    const faceDir = Math.cos(p.face) < -0.15 ? -1 : 1;
    const expr = G.state === 'accuse' ? 'angry' : G.rumble ? 'worried' : p.expr;
    Art.drawPerson(ctx, PLAYER_LOOK, p.x, p.y, { t, walking: p.walking, faceDir, lookX: faceDir * Math.cos(p.face), lookY: Math.sin(p.face), expr, blinkSeed: 3 });
    const y = p.y - 104 + Math.sin(t * 4) * 2;
    ctx.save(); ctx.fillStyle = '#f08a24'; ctx.strokeStyle = Art.INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x - 8, y - 10); ctx.lineTo(p.x + 8, y - 10); ctx.lineTo(p.x, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.font = '700 10px "Lexend", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = Art.INK; ctx.fillText('YOU', p.x, y - 14);
    if (G.pressure > 70) { ctx.globalAlpha = 0.5 + Math.sin(t * 12) * 0.4; ctx.font = '400 14px "Bowlby One SC", sans-serif'; ctx.fillStyle = '#8a5a2b'; ctx.fillText('~ ~', p.x + 26, p.y - 30); }
    ctx.restore();
  }

  // ---------------- input ----------------
  function onKey(e, down) {
    const k = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(k) && G.state !== 'title') e.preventDefault();
    keys[k] = down;
    if (!down || e.repeat) return;
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && k !== 'Escape') return;
    if (UI.handleKey(k)) return;
    if (G.state !== 'play') return;
    if (k === 'KeyE' || k === 'Space' || k === 'Enter') interact();
    else if (k === 'KeyQ') sniff();
    else if (k === 'KeyV') smellVision();
    else if (k === 'KeyF') release(false);
    else if (k === 'KeyO') object();
    else if (k === 'Tab' || k === 'KeyN') UI.openNotebook();
    else if (k === 'KeyK') G.showCones = !G.showCones;
    else if (k === 'BracketRight') fastForward();
  }
  function fastForward() {
    UI.caption('Presenter skip: +15 seconds.', 1.5);
    for (let i = 0; i < 15 / STEP && G.state === 'play'; i++) { update(STEP); if (G.photoPending) render(); }
    G.flashes = [];
  }

  function onPointer(e) {
    if (G.state !== 'play') return;
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    let hit = null;
    for (const n of G.npcs) if (n.present && Math.abs(x - n.x) < 26 && y < n.y + 6 && y > n.y - 90) hit = { type: 'npc', n };
    if (!hit) for (const c of CAST) { const it = G.items[c.id]; if (it.present && Math.hypot(x - it.x, y - (it.y - 10)) < 26) hit = { type: 'item', c }; }
    if (!hit) for (const pr of G.props) if (Math.hypot(x - pr.x, y - pr.y) < 40) hit = { type: 'prop', pr };
    const p = G.player, B = L.bounds;
    if (hit) {
      const tgt = hit.type === 'npc' ? hit.n : hit.type === 'item' ? G.items[hit.c.id] : hit.pr;
      if (Math.hypot(tgt.x - p.x, tgt.y - p.y) < (hit.type === 'npc' ? 88 : 60)) interact(hit);
      else { p.target = { x: U.clamp(tgt.x + (p.x < tgt.x ? -44 : 44), B.x0, B.x1), y: U.clamp(tgt.y + 6, B.y0, B.y1) }; p.pending = hit; }
    } else {
      p.target = { x: U.clamp(x, B.x0, B.x1), y: U.clamp(y, B.y0, B.y1) }; p.pending = null;
    }
  }

  // ---------------- boot ----------------
  let last = 0, accT = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    G.anim = (G.anim || 0) + dt;
    if (G.state === 'play') { accT += dt; while (accT >= STEP) { update(STEP); accT -= STEP; if (G.state !== 'play') break; } } else accT = 0;
    if (G.state === 'play' && L.mode === 'mingle' && G.t >= TIMELINE.places) {
      const p = G.player; if (!p.walking && U.dist(p, PLAYER_SEAT) < 22) p.face = -Math.PI / 2;
    }
    render();
    UI.hud();
    requestAnimationFrame(frame);
  }

  // A quiet, populated room behind the title screen.
  function showcase(levelId) {
    prepareLevel(levelId);
    G.cs = Case.generate(7);
    G.npcs = CAST.map((c) => NPC.create(c, G.cs));
    G.items = {};
    for (const c of CAST) { const s = G.cs.spots[c.id]; G.items[c.id] = { ...c.item, ...(L.itemsAtFeet ? (s ? { x: s.x + 26, y: s.y + 4 } : { x: -99, y: -99 }) : { x: c.item.x, y: c.item.y }), present: !(L.lateArrivals || []).includes(c.id) }; }
    G.player = { x: L.player.start.x, y: L.player.start.y, face: -Math.PI / 2, expr: 'neutral' };
    Object.assign(G, { know: { bags: {} }, t: 0, flashes: [], floaters: [], pssts: [], puffs: [], sv: { t: 0 }, actors: {}, props: [], doors: { main: { open: 0, target: 0 } }, result: null, rumble: null,
      cam: { x: W / 2, y: H / 2, z: 1, tx: W / 2, ty: H / 2, tz: 1, shake: 0 } });
  }

  function boot() {
    cv = document.getElementById('cv'); ctx = cv.getContext('2d');
    gasCv = document.createElement('canvas'); gasCv.width = Gas.COLS; gasCv.height = Gas.ROWS;
    gasCtx = gasCv.getContext('2d'); gasImg = gasCtx.createImageData(Gas.COLS, Gas.ROWS);
    resize();
    new ResizeObserver(resize).observe(cv);
    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup', (e) => onKey(e, false));
    window.addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));
    cv.addEventListener('pointerdown', onPointer);
    UI.init();
    showcase(G.levelId);
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(() => { if (L) background = Art.buildBackground(L, 2); }).catch(() => {});
    requestAnimationFrame(frame);
  }

  return {
    boot, newGame, showcase, interact, sniff, smellVision, release, object, talkOptions, talkChoose, confrontOptions, confrontChoose,
    startConfront, anyConfronting, onReaction, onCover, onIdle, onOverhear, flash, checkBoard, finish, feature,
    npcById, humans, recomputeAura, fastForward, crowdOpinion, primeSuspect,
    testimony, startTrial, trialPress, trialPresent, withdraw, resolveTrial, unfocus, focus,
  };
})();

// NPC module calls these through G.
Object.assign(G, {
  onReaction: (n) => Game.onReaction(n), onCover: (n) => Game.onCover(n), onIdle: (n) => Game.onIdle(n), onOverhear: (n, f) => Game.onOverhear(n, f),
  flash: (n) => Game.flash(n), startConfront: (n) => Game.startConfront(n), anyConfronting: () => Game.anyConfronting(),
});
window.addEventListener('DOMContentLoaded', () => Game.boot());
