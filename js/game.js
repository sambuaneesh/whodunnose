'use strict';
// The engine: camera, case timeline, player actions, the Aura economy, gossip and room opinion,
// evidence, objectives, tips and hints, the three accusation modes, ranks, rendering and input.
// Levels supply content; the current case's RULES decide which mechanics are live.
const STEP = 1 / 30;
const G = { state: 'title', features: {}, caseDef: null };

const Game = (() => {
  let cv, ctx, background, gasCv, gasCtx, gasImg, dpr = 1, scale = 1;
  const keys = {};
  const SEARCH_HOLD = 0.85, TAP = 0.22;

  // ---------------- camera ----------------
  const baseZoom = () => W / L.view.w;
  function resetCam() {
    const v = L.view, z = baseZoom();
    G.cam = { x: v.x + v.w / 2, y: v.y + v.h / 2, z, tx: v.x + v.w / 2, ty: v.y + v.h / 2, tz: z, shake: 0 };
  }
  const toScreen = (x, y) => ({ x: (x - G.cam.x) * G.cam.z + W / 2, y: (y - G.cam.y) * G.cam.z + H / 2 });
  const toWorld = (sx, sy) => ({ x: (sx - W / 2) / G.cam.z + G.cam.x, y: (sy - H / 2) / G.cam.z + G.cam.y });
  function focus(p, mult) {
    // the elevator camera is already close; do not zoom in nearly as far there
    const z = baseZoom() * (L.mode === 'elevator' ? 1 + (mult - 1) * 0.35 : mult);
    G.cam.tx = p.x + 300 / z; G.cam.ty = p.y - 50 / mult; G.cam.tz = z;
  }
  function unfocus() { if (!G.cam || !L) return; const v = L.view; G.cam.tx = v.x + v.w / 2; G.cam.ty = v.y + v.h / 2; G.cam.tz = baseZoom(); }
  function shake(amount) { if (G.cam && Store.settings().shake) G.cam.shake = Math.max(G.cam.shake, amount); }

  // ---------------- setup ----------------
  function prepare(caseDef) {
    G.caseDef = caseDef;
    loadLevel(caseDef);
    background = Art.buildBackground(L, baseZoom() * 2);
    resetCam();
  }

  function newGame(caseDef, seed) {
    prepare(caseDef);
    const diff = caseDef.free ? DIFFICULTY[Store.settings().difficulty] : DIFFICULTY.normal;
    Object.assign(G, {
      state: 'play', t: 0, anim: 0, seed, cs: Case.generate(seed), diff,
      aura: 100, auraShown: 100, pressure: 12, mentioned: false, mentionBy: null,
      clues: [], log: [], know: { claims: {}, zones: {}, bags: {}, bagFood: {}, witnessFood: {}, facts: {}, smell: false, reactions: [], tells: 0 },
      sv: { charges: RULES.smellVision ? diff.sv : 0, t: 0 }, loud: null, flags: {}, floaters: [], flashes: [], pssts: [], puffs: [], actors: {},
      board: { who: '', food: '', zone: '', cover: '', locked: false, checks: 0, feedback: '' },
      sniffCd: 0, sniffArrow: null, nextConfrontT: 0, gossipT: 1, objected: false, result: null,
      rumble: null, nextRumble: 0, photo: null, photoPending: false, snaps: {}, snapPending: null, trial: null,
      doors: {}, watchers: 0, lastOddSeenT: -99, squeezeT: {}, eDown: null, searching: null,
      objState: {}, tipsShown: {}, tipQueue: [], hintsUsed: 0, beatT: 0, unseenClues: 0,
      player: { x: L.player.start.x, y: L.player.start.y, face: -Math.PI / 2, target: null, path: [], walking: false, bubble: null, expr: 'neutral', exprT: 0, pending: null },
    });
    G.npcs = CAST.map((c) => NPC.create(c, G.cs));
    G.items = {};
    for (const c of CAST) {
      const spot = G.cs.spots[c.id], off = L.ranges.itemOffset;
      const pos = off ? (spot ? { x: spot.x + off.x, y: spot.y + off.y } : { x: -100, y: -100 }) : { x: c.item.x, y: c.item.y };
      G.items[c.id] = { ...c.item, ...pos, owner: c.id, present: !(L.lateArrivals || []).includes(c.id) };
    }
    G.props = RULES.photo && L.photo.source === 'prop' ? [{ id: 'photo', x: L.photo.x, y: L.photo.y, label: L.photo.label }] : [];
    for (const id in (L.gas.doors || {})) G.doors[id] = { open: 0, target: 0 };
    Gas.reset(L.gas);
    UI.resetRun();
    Sfx.setMusic(L.music);
    if (L.mode === 'mingle') Sfx.startMurmur();
    logEvent(L.intro);
    UI.caption(L.intro, 5);
    feature('art'); feature('levels');
    evalObjectives(true);
  }

  // ---------------- helpers ----------------
  const present = () => G.npcs.filter((n) => n.present);
  const humans = () => G.npcs.filter((n) => !n.def.dog && n.present);
  const npcById = (id) => G.npcs.find((n) => n.id === id);
  const quiet = () => L.quiet(G.t);
  const has = (id) => !!npcById(id);

  function feature(id) {
    if (G.features[id]) return;
    G.features[id] = true;
    UI.featureShown(FEATURES.find((f) => f.id === id));
  }
  function logEvent(text) { G.log.push({ t: G.t || 0, text }); }
  function floater(x, y, text, color = '#8e5bd6') { G.floaters.push({ x, y, text, color, t: 0 }); }

  // Tips: the first time something happens in a case that teaches it, pause and explain.
  function tip(id) {
    if (!G.caseDef || !G.caseDef.tips.includes(id) || G.tipsShown[id]) return;
    G.tipsShown[id] = true;
    if (G.state === 'play') showTip(id); else G.tipQueue.push(id);
  }
  function showTip(id) {
    G.state = 'tip';
    UI.showTip(TIPS[id], () => { if (G.state === 'tip') G.state = 'play'; });
  }
  function flushTips() { if (G.state === 'play' && G.tipQueue.length && !G.tipQueue[0].startsWith('__') && !G.tipQueue.includes('__fart')) showTip(G.tipQueue.shift()); }

  function addClue(c) {
    const existing = G.clues.find((k) => k.key === c.key);
    if (existing) { Object.assign(existing, c); return existing; }
    c.t = G.t; G.clues.push(c);
    if (c.kind !== 'odd') { UI.clueToast(c); Sfx.ui('clue'); G.unseenClues++; }
    return c;
  }

  function recomputeAura() {
    const h = humans(), sus = h.map((n) => n.sus);
    if (!sus.length || !RULES.aura) { G.aura = 100; return; }
    const avg = sus.reduce((a, b) => a + b, 0) / sus.length, mx = Math.max(...sus);
    G.aura = U.clamp(100 - (0.55 * avg + 0.45 * mx) * 1.1, 0, 100);
  }

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
  const watchersNow = () => humans().filter((n) => NPC.sees(n, G.player));

  // Something odd the player did. It only costs Aura if someone sees (or hears) it.
  function act(label, base, { owner = null, sound = 0, only = null, silent = false } = {}) {
    if (!RULES.aura) return [];
    const cost = base * G.diff.aura, before = G.aura, p = G.player, wit = [];
    for (const n of humans()) {
      if (only && n !== only) continue;
      const d = U.dist(n, p);
      const noticed = only ? true : sound ? d < sound : NPC.sees(n, p);
      if (!noticed) continue;
      const eagle = (n.def.perception ?? 1) >= 1.3 ? 1.4 : 1;
      n.sus = Math.min(100, n.sus + cost * (sound ? 1 - (d / sound) * 0.6 : 1) * (n.id === owner ? 1.5 : 1) * eagle);
      wit.push(n);
      if (eagle > 1) feature('traits');
      if (!silent) { n.expr = 'sus'; n.exprT = 2.4; if (!n.walking && L.mode !== 'elevator') n.face = Math.atan2(p.y - n.y, p.x - n.x); }
    }
    recomputeAura();
    feature('vision');
    if (wit.length) {
      G.lastOddSeenT = G.t;
      feature('aura');
      if (!silent) {
        floater(p.x, p.y, `-${Math.max(1, Math.round(before - G.aura))} AURA`);
        const names = wit.slice(0, 3).map((n) => n.def.name).join(', ') + (wit.length > 3 ? ` +${wit.length - 3}` : '');
        UI.caption(`${names} saw you ${label}.`, 3);
        Sfx.ui('bad');
      }
    } else if (!silent && !only) floater(p.x, p.y, 'unseen', '#4d7a1e');
    return wit;
  }

  // ---------------- level api ----------------
  function once(flag, fn) { if (!G.flags[flag]) { G.flags[flag] = true; fn(); } }
  const api = {
    once, has,
    say(id, text, dur = 3.5, tone = 'speech') {
      const n = npcById(id);
      if (n) { if (n.present) NPC.say(n, text, dur, tone); return; }
      const a = G.actors[id]; if (a) a.bubble = { text, t: dur, tone };
    },
    caption: (t, d) => UI.caption(t, d),
    log: logEvent,
    seatEveryone: () => G.npcs.forEach((n) => { n.confronting = false; n.target = null; n.path = []; }),
    door(id, open) { Gas.setDoor(id, open); if (G.doors[id]) G.doors[id].target = open ? 1 : 0; },
    doorOpen: (id) => (G.doors && G.doors[id] ? G.doors[id].open : 0),
    time: () => G.t || 0,
    music: (id) => Sfx.setMusic(id),
    organ: (dur) => { Sfx.stopMurmur(); Sfx.organ(dur); },
    actor(id, spec) { G.actors[id] = { id, walking: false, bubble: null, face: Math.PI / 2, speed: 34, ...spec }; },
    tip,
    arrive(id, from) {
      const n = npcById(id); if (!n) return;
      n.present = true; n.x = from.x; n.y = from.y;
      const spot = freeSpot(['frontleft', 'buttons', 'middle'], n);
      n.seat = { x: spot.x, y: spot.y, face: Math.PI / 2 }; n.target = { ...spot }; n.path = [];
      const off = L.ranges.itemOffset || { x: 20, y: 4 };
      G.items[id] = { ...G.items[id], x: spot.x + off.x, y: spot.y + off.y, present: true };
      tip('late');
    },
  };
  function freeSpot(zoneIds, self) {
    const gap = L.ranges.spacing;
    for (let k = 0; k < 200; k++) {
      const p = spotIn(zoneById(U.pick(Math.random, zoneIds)), Math.random);
      if (G.npcs.every((o) => o === self || !o.present || U.dist(o.seat || o, p) > gap) && U.dist(G.player, p) > gap) return p;
    }
    return spotIn(zoneById(zoneIds[0]), Math.random);
  }

  // ---------------- the timeline ----------------
  function timeline() {
    const t = G.t, cs = G.cs, T = TIMELINE;
    if (t >= 1.5) once('startTips', () => { tip('law'); tip('badgesOff'); if (RULES.aura) tip('watched'); });
    if (t >= T.fart) once('fart', () => {
      const s = cs.spots[cs.culprit];
      Gas.emit(s.x, s.y, L.gas.amount * (0.7 + 0.6 * cs.food.stink), 1.4);
      logEvent('Something happened.');
      G.beatT = 1.1; shake(4);
      if (cs.fartType !== 'sbd') {
        Sfx.fart(cs.fartType, s.x);
        const side = s.x < L.view.x + L.view.w * 0.45 ? 'left' : s.x > L.view.x + L.view.w * 0.55 ? 'right' : 'middle';
        const kind = cs.fartType === 'squeaker' ? 'A high, squeaky one' : 'A long, low trumpet';
        UI.beat('*pfrrrt*', `${kind}, from the ${side}.`);
        addClue({ key: 'sound', kind: 'sound', text: `${kind} came from the ${side}. ${cs.fartType === 'trumpet' ? 'That much gas usually means beans.' : 'Medium volume.'}`, implicates: [], weight: 0 });
        feature('audio');
      } else {
        Sfx.fart('sbd', s.x, 0.6);
        UI.beat('...', 'No sound at all. But something is definitely happening.');
        addClue({ key: 'sound', kind: 'sound', text: 'No sound at all. Silent but deadly usually means sulfur-rich protein: eggs, fish, a protein shake.', implicates: [], weight: 0 });
      }
      G.photoPending = RULES.photo;
      G.tipQueue.push('__fart');
    });
    if (t >= 5) once('procFeat', () => feature('procedural'));
    if (t >= T.fart + 5) once('gasFeat', () => feature('gas'));
    if (RULES.smellVision && t >= T.fart + 7) once('svTip', () => tip('smellvision'));
    if (t >= T.mention && !G.mentioned) {
      const m = L.mention, n = npcById(m.who);
      if (n && n.present) {
        G.mentioned = true; G.mentionBy = m.who;
        NPC.say(n, m.line, 3.5, 'shout'); n.expr = 'shock'; n.exprT = 2;
        for (const o of humans()) if (o !== n) { if (U.dist(o, n) < 320 && L.mode !== 'elevator') o.face = Math.atan2(n.y - o.y, n.x - o.x); if (!m.exempt) NPC.suspect(o, n.id, 18); }
        if (RULES.folklore) { UI.caption(m.caption, 6); if (!m.exempt) UI.stamp('WHOEVER SMELT IT, DEALT IT!'); feature('folklore'); tip('mention'); }
        logEvent(`${n.def.name}: "${m.line}"`);
      }
    }
    if (t >= T.speakNow) once('speakNow', () => {
      api.say(L.speakNow.who, L.speakNow.line, 9, 'shout');
      UI.speakNow(true);
      UI.caption(L.speakNow.caption, 8);
      logEvent(`"${L.speakNow.line}"`);
      feature('object');
      tip(RULES.accuse === 'point' ? 'callPoint' : 'callProof');
    });
    if (t >= T.end && !G.objected) return finish('peace');
    L.script(t, api);
    if (t >= T.vows) once('vowsTip', () => tip('vows'));

    G.loud = null;
    for (const e of LOUD_EVENTS) {
      if (t >= e.t && t < e.t + e.dur) {
        G.loud = e;
        once('loud' + e.t, () => {
          if (!e.organ) Sfx.loudEvent(e.label);
          logEvent(`LOUD: ${e.label}`);
          if (RULES.tummy && G.pressure > 35 && !e.organ) UI.caption(`LOUD: ${e.label} Press F now and nobody will hear you.`, 3);
        });
      }
    }
  }

  // ---------------- objectives ----------------
  function evalObjectives(silent = false) {
    if (!G.caseDef) return;
    for (const id of G.caseDef.objectives) {
      const o = OBJECTIVES[id], prev = G.objState[id];
      let st = 'open';
      if (o.fail && o.fail(G)) st = 'fail'; else if (o.check(G)) st = 'done';
      if (st !== prev) {
        G.objState[id] = st;
        if (!silent && prev && st === 'done' && id !== 'call') { Sfx.ui('good'); UI.caption(`Case file: ${typeof o.label === 'function' ? o.label() : o.label} ✓`, 2.5); }
      }
    }
    UI.objectives();
  }
  function useHint() {
    if (G.state !== 'play') return;
    if (!G.diff.hints) { UI.caption('No hints on Hard.', 2); return; }
    const id = G.caseDef.objectives.find((k) => G.objState[k] === 'open') || 'call';
    G.hintsUsed++;
    G.state = 'tip';
    UI.showTip({ title: 'Hint', text: OBJECTIVES[id].hint }, () => { if (G.state === 'tip') G.state = 'play'; });
  }

  // ---------------- per-tick update ----------------
  function update(dt) {
    if (G.beatT > 0) { G.beatT -= dt; return; } // a short freeze-frame when it happens
    if (G.tipQueue[0] === '__fart' && G.t >= TIMELINE.fart + 1.6) { G.tipQueue.shift(); tip('fart'); }
    G.t += dt * G.diff.clock;
    timeline();
    if (G.state !== 'play') return;
    updatePlayer(dt);
    updateSearch(dt);
    for (const n of G.npcs) NPC.update(n, dt, G);
    NPC.separate(G, dt);
    updateActors(dt);
    for (const id in G.doors) { const d = G.doors[id]; d.open += U.clamp(d.target - d.open, -dt * 1.5, dt * 1.5); }
    Gas.step(dt);
    gossip(dt);
    // suspicion fades, faster once you have been acting normal for a while
    const fade = (G.t - G.lastOddSeenT > 15 ? 0.45 : 0.15) * dt;
    for (const n of humans()) n.sus = Math.max(0, n.sus - fade);
    recomputeAura();
    if (RULES.aura && G.aura <= 0.5) return finish('bankrupt');
    G.watchers = RULES.aura ? watchersNow().length : 0;
    if (RULES.rumors && primeSuspect()) once('rumorFeat', () => feature('rumors'));

    const c = Gas.sample(G.player.x, G.player.y);
    if (c > 0.1 && G.flags.fart) identifySmell('nose');
    if (c > 0.3 && G.player.exprT <= 0 && Math.random() < dt * 0.3) { G.player.expr = 'disgust'; G.player.exprT = 1.5; }
    if (G.player.exprT > 0) { G.player.exprT -= dt; if (G.player.exprT <= 0) G.player.expr = 'neutral'; }

    if (RULES.tummy) {
      if (G.t > 4) G.pressure = Math.min(100, G.pressure + dt * L.pressureRate * G.diff.clock);
      if (G.pressure >= 60) once('pressureWarn', () => { feature('pressure'); tip('tummy'); UI.caption('You need to go too. Hold it, or let it out (F) under something loud.', 5); });
      if (RULES.clench) updateRumble(dt);
      if (G.pressure >= 100) release(true);
    }
    if (RULES.search && !G.tipsShown.bag && nearestBag()) tip('bag');

    if (G.sniffCd > 0) G.sniffCd -= dt;
    if (G.sv.t > 0) G.sv.t -= dt;
    if (G.sniffArrow) { G.sniffArrow.t -= dt; if (G.sniffArrow.t <= 0) G.sniffArrow = null; }
    if (G.player.bubble) { G.player.bubble.t -= dt; if (G.player.bubble.t <= 0) G.player.bubble = null; }
    G.puffs = G.puffs.filter((p) => (p.t += dt) < p.life);
    evalObjectives();
    flushTips();
  }

  function updateRumble(dt) {
    if (G.pressure < 50) return;
    if (!G.rumble && G.t >= G.nextRumble) {
      G.rumble = { left: 2.6, held: 0 }; G.nextRumble = G.t + 15 + Math.random() * 9;
      Sfx.gurgle(0.25); feature('clench'); tip('rumble');
    }
    const r = G.rumble; if (!r) return;
    if (keys.KeyC || G.clenchHeld) r.held += dt;
    r.left -= dt;
    if (r.held >= 0.8) {
      G.rumble = null; G.pressure = Math.max(0, G.pressure - 8);
      floater(G.player.x, G.player.y, 'clenched', '#3c8d2f'); Sfx.ui('good');
    } else if (r.left <= 0) {
      G.rumble = null; G.pressure = Math.min(100, G.pressure + 5);
      Sfx.gurgle(1);
      act('let out a loud stomach gurgle', COSTS.gurgle, { sound: L.ranges.overhear * 0.9 });
    }
  }

  // Movement with pews as walls and people as soft obstacles. In the elevator, squeezing past someone is slow and noticed.
  function blocked(x, y) {
    for (const o of L.obstacles || []) if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) return true;
    return false;
  }
  function updatePlayer(dt) {
    const p = G.player, B = L.bounds;
    let mx = 0, my = 0;
    if (keys.ArrowLeft || keys.KeyA) mx -= 1;
    if (keys.ArrowRight || keys.KeyD) mx += 1;
    if (keys.ArrowUp || keys.KeyW) my -= 1;
    if (keys.ArrowDown || keys.KeyS) my += 1;
    if (mx || my) { p.target = null; p.pending = null; p.path = []; }
    else if (p.target) {
      const dx = p.target.x - p.x, dy = p.target.y - p.y, d = Math.hypot(dx, dy);
      if (d < 4) {
        p.target = p.path && p.path.length ? p.path.shift() : null;
        if (!p.target && p.pending) { const pend = p.pending; p.pending = null; interact(pend); }
      } else { mx = dx / d; my = dy / d; }
    }
    const len = Math.hypot(mx, my);
    p.walking = len > 0;
    if (!len) return;
    let speed = L.mode === 'elevator' ? 60 : 165;
    const r = L.ranges.personal * 2;
    let squeezing = null;
    for (const n of present()) {
      const dx = n.x - p.x, dy = (n.y - p.y) * 1.6;
      if (Math.hypot(dx, dy) < r && (dx * mx + dy * my) > 0) { squeezing = n; break; }
    }
    if (squeezing) {
      speed *= 0.35;
      if (L.mode === 'elevator') {
        const lastT = G.squeezeT[squeezing.id] || -99;
        if (G.t - lastT > 6) {
          G.squeezeT[squeezing.id] = G.t;
          p.bubble = { text: 'Sorry... excuse me...', t: 1.6, tone: 'thought' };
          act(`squeeze past ${squeezing.def.name}`, COSTS.squeeze, { only: squeezing, silent: true });
        }
        const side = squeezing.x - p.x > 0 ? 1 : -1;
        squeezing.x += side * 8 * dt; if (squeezing.seat) squeezing.seat.x = squeezing.x;
      }
    }
    const nx = U.clamp(p.x + (mx / len) * speed * dt, B.x0, B.x1), ny = U.clamp(p.y + (my / len) * speed * dt, B.y0, B.y1);
    if (!blocked(nx, p.y)) p.x = nx;
    if (!blocked(p.x, ny)) p.y = ny;
    p.face = Math.atan2(my, mx);
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

  function gossip(dt) {
    G.gossipT -= dt;
    G.pssts = G.pssts.filter((s) => (s.t -= dt) > 0);
    if (G.gossipT > 0) return;
    G.gossipT = 1;
    if (!RULES.gossip) return;
    const h = humans();
    for (const a of h) for (const b of h) {
      if (a === b || U.dist(a, b) > L.ranges.gossip) continue;
      if (quiet() && a.seated) continue; // nobody whispers during the vows (except you)
      const rate = 0.12 * (a.def.gossip ?? 1) * (L.mode === 'elevator' ? 0.6 : 1);
      for (const id in a.op) if (id !== b.id && a.op[id] > (b.op[id] || 0) + 8) b.op[id] = (b.op[id] || 0) + (a.op[id] - (b.op[id] || 0)) * rate * 0.7;
      if (!RULES.aura || a.sus < 15 || a.sus <= b.sus + 8) continue;
      const delta = (a.sus - b.sus) * rate;
      b.sus = Math.min(100, b.sus + delta);
      if (delta > 2 && (!a.lastPsst || G.t - a.lastPsst > 6)) {
        a.lastPsst = G.t;
        G.pssts.push({ a, b, t: 1.8 });
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
    if (how === 'nose') { G.player.expr = 'disgust'; G.player.exprT = 2.5; UI.caption(`There it is: ${f.smell}. Somebody had ${f.name}.`, 4); }
    tip('smell');
  }

  function checkContradictions(id) {
    if (!RULES.lies) return;
    const claim = G.know.claims[id];
    if (!claim) return;
    const bag = G.know.bagFood[id], wit = G.know.witnessFood[id];
    const truth = bag && bag !== claim ? { food: bag, src: 'their bag' } : wit && wit !== claim ? { food: wit, src: 'a witness' } : null;
    if (!truth || G.clues.some((c) => c.key === 'contra-' + id)) return;
    const nm = castById(id).name;
    addClue({ key: 'contra-' + id, kind: 'contradiction', who: id, food: truth.food, text: `${nm} said ${foodById(claim).name}, but ${truth.src} says ${foodById(truth.food).name}. ${nm} lied.`, implicates: [id], weight: 2.5 });
    UI.stamp('CONTRADICTION!', 'gold'); shake(6);
    Sfx.ui('lock');
    tip('contradiction');
  }

  function learnFact(n, fact, overheard) {
    if (G.know.facts[n.id]) return;
    G.know.facts[n.id] = true;
    addClue({ key: 'fact-' + n.id, kind: fact.kind === 'witness' ? 'witness' : 'gossip', who: fact.about, text: `${overheard ? 'Overheard ' : ''}${n.def.name}: "${fact.text}"`, implicates: fact.implicates, weight: fact.weight, food: fact.food, zone: fact.zone });
    if (fact.kind === 'witness') { G.know.witnessFood[fact.about] = fact.food; checkContradictions(fact.about); }
  }
  function onOverhear(n, fact) { learnFact(n, fact, true); feature('eavesdrop'); tip('whisper'); }
  function onDeflect(n, buddy, target) {
    const tname = target === 'player' ? 'you' : castById(target).name;
    addClue({ key: 'deflect', kind: 'deflect', who: n.id, text: `Overheard ${n.def.name} whispering to ${buddy.def.name} that it was ${tname}. Why push the blame?`, implicates: [n.id], weight: 1.2 });
    tip('whisper');
  }

  function onReaction(n) {
    G.know.reactions.push({ id: n.id, t: G.t, zone: n.reactZone });
    n.reactOrder = G.know.reactions.length;
    logEvent(`${n.def.name} reacts to the smell (by the ${zoneById(n.reactZone).name}).`);
    if (G.know.reactions.length === 1) feature('noses');
    if (G.know.reactions.length === 3) {
      const first = G.know.reactions.slice(0, 3).map((r) => `${castById(r.id).name} (${zoneById(r.zone).name})`).join(', ');
      addClue({ key: 'first3', kind: 'reaction', text: `First three to react: ${first}.`, implicates: [], weight: 0 });
    }
  }

  function onCover(n) {
    if (U.dist(n, G.player) > L.ranges.overhear * 2) return;
    G.know.tells++;
    const cv0 = G.cs.cover;
    addClue({ key: 'tell', kind: 'tell', who: n.id, text: `You saw ${n.def.name} ${cv0.label}${G.know.tells > 1 ? ` (${G.know.tells} times now)` : ''}.`, implicates: [n.id], weight: 1.5, cover: cv0.id });
    logEvent(`${n.def.name} was ${cv0.label}.`);
    tip('tell');
  }

  function onIdle(n) {
    if (U.dist(n, G.player) > L.ranges.overhear * 2 || G.clues.some((c) => c.key === 'odd-' + n.id)) return;
    addClue({ key: 'odd-' + n.id, kind: 'odd', who: n.id, text: `${n.def.name}: ${IDLES[n.id].bubble}`, implicates: [], weight: 0 });
  }

  function flash(n) { G.flashes.push({ x: n.x + 6, y: n.y - 70, t: 0.3 }); }

  // ---------------- photos and snapshots ----------------
  function capture(crop, width = 480) {
    const a = toScreen(crop.x, crop.y), b = toScreen(crop.x + crop.w, crop.y + crop.h);
    const out = document.createElement('canvas');
    out.width = width; out.height = Math.max(1, Math.round(width * (b.y - a.y) / (b.x - a.x)));
    out.getContext('2d').drawImage(cv, a.x * scale, a.y * scale, (b.x - a.x) * scale, (b.y - a.y) * scale, 0, 0, out.width, out.height);
    return out.toDataURL('image/jpeg', 0.82);
  }
  const captureScreen = () => { const out = document.createElement('canvas'); out.width = 480; out.height = 270; out.getContext('2d').drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, 480, 270); return out.toDataURL('image/jpeg', 0.82); };
  function takePhoto() {
    const cs = G.cs, s = cs.spots[cs.culprit];
    const crop = L.photo.crop || { x: U.clamp(s.x - 290 + (Math.random() - 0.5) * 120, 0, W - 580), y: U.clamp(s.y - 230, 0, H - 330), w: 580, h: 330 };
    const inShot = present().filter((n) => n.x > crop.x && n.x < crop.x + crop.w && n.y > crop.y + 30 && n.y < crop.y + crop.h + 30);
    G.photo = { img: capture(crop), stamp: L.stampTime(G.t), ids: inShot.map((n) => n.id), zones: Object.fromEntries(inShot.map((n) => [n.id, zoneAt(n).id])) };
  }
  function findPhoto() {
    if (!G.photo || G.clues.some((c) => c.key === 'photo')) return;
    const ph = G.photo, origin = G.cs.origin.id;
    const names = ph.ids.map((id) => `${castById(id).name} (${zoneById(ph.zones[id]).name})`);
    const atOrigin = ph.ids.filter((id) => ph.zones[id] === origin);
    addClue({ key: 'photo', kind: 'photo', text: `${L.photo.caption} (${ph.stamp}). In shot: ${names.join(', ') || 'nobody useful'}.`, implicates: atOrigin, weight: 1, zone: origin, img: ph.img });
    feature('photo'); tip('photo');
  }

  // ---------------- player actions ----------------
  function nearestPerson() {
    let best = null, bd = L.ranges.talk;
    for (const n of present()) { const d = U.dist(n, G.player); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  function nearestBag() {
    if (!RULES.search) return null;
    let best = null, bd = L.ranges.search;
    for (const c of CAST) {
      const it = G.items[c.id];
      if (!it.present || G.know.bags[c.id] === 'seen') continue;
      const d = U.dist(it, G.player); if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function nearestProp() {
    for (const pr of G.props) if (!G.flags['prop-' + pr.id] && U.dist(pr, G.player) < L.ranges.search * 1.6) return pr;
    return null;
  }

  // Tap E: talk. Hold E: search the bag at your feet. Searching is never an accident.
  function pressE() { if (G.state === 'play') G.eDown = { held: 0, done: false }; }
  function releaseE() {
    const e = G.eDown; G.eDown = null;
    const wasSearching = !!G.searching; G.searching = null;
    if (!e || e.done || G.state !== 'play' || wasSearching) return;
    if (e.held < TAP + 0.15) tapE();
  }
  function tapE() {
    if (G.state !== 'play') return;
    const n = nearestPerson();
    if (n) return talkTo(n);
    const pr = nearestProp(); if (pr) return checkProp(pr);
    if (nearestBag()) UI.caption('Hold E to search the bag.', 1.8);
  }
  function updateSearch(dt) {
    const e = G.eDown;
    if (!e || e.done) return;
    e.held += dt;
    const bag = nearestBag();
    if (e.held > TAP && bag) {
      G.searching = { c: bag, k: Math.min(1, (e.held - TAP) / SEARCH_HOLD) };
      if (G.searching.k >= 1) { e.done = true; G.searching = null; snoop(bag); }
    } else G.searching = null;
  }

  function talkTo(n) {
    if (quiet()) act('whispering during the vows', COSTS.silentTalk);
    G.state = 'dialogue';
    if (n.def.trait) feature('traits');
    if (RULES.rumors) tip('rumor');
    UI.openDialogue(n, 'talk');
  }
  function checkProp(pr) {
    G.flags['prop-' + pr.id] = true;
    act('squinting up at the security camera', COSTS.camera);
    findPhoto();
    G.state = 'dialogue';
    UI.openPhoto(G.photo);
  }
  function interact(target) {
    if (!target || G.state !== 'play') return;
    if (target.type === 'npc') talkTo(target.n);
    else if (target.type === 'item') snoop(target.c);
    else checkProp(target.pr);
  }

  function snoop(c) {
    const it = G.items[c.id];
    act(`going through ${it.label}`, COSTS.search, { owner: c.id });
    G.know.bags[c.id] = 'seen';
    const bag = G.cs.bags[c.id];
    if (bag.food) G.know.bagFood[c.id] = bag.food;
    addClue({ key: 'bag-' + c.id, kind: 'bag', who: c.id, text: `${it.label}: ${bag.text}`, implicates: bag.implicates, weight: bag.weight, food: bag.food });
    checkContradictions(c.id);
    feature('snoop');
    const hasPhoto = RULES.photo && L.photo.source === 'item' && L.photo.owner === c.id;
    if (hasPhoto) findPhoto();
    G.state = 'dialogue';
    UI.openItem(c, it, bag, hasPhoto ? G.photo : null);
  }

  function talkOptions(n) {
    if (n.def.dog) return [{ id: 'pet', label: L.scapegoat.petLabel, tag: 'free' }, { id: 'leave', label: 'Leave' }];
    const q = RULES.questions, o = [], after = !!G.flags.fart;
    if (q.includes('food') && !n.asked.breakfast) o.push({ id: 'breakfast', label: 'What did you eat today?', tag: 'free' });
    if (q.includes('where') && after && !n.asked.where) o.push({ id: 'where', label: 'Where were you standing a minute ago?', tag: 'free' });
    if (q.includes('gossip') && !n.asked.gossip && !G.know.facts[n.id]) o.push({ id: 'gossip', label: 'Seen anything weird today?', tag: 'nosy' });
    if (q.includes('smell') && after && !n.asked.smell) o.push(G.mentioned
      ? { id: 'smell', label: 'What did it smell like to you?', tag: 'safe now' }
      : { id: 'smell', label: 'Did... you smell that?', tag: 'risky' });
    if (q.includes('rumor') && after && !n.asked.rumor) o.push({ id: 'rumor', label: 'Plant a rumour: "I bet it was..."', tag: 'scheming' });
    o.push({ id: 'leave', label: 'Leave' });
    return o;
  }
  function rumorTargets(n) {
    return CAST.filter((c) => c.id !== n.id && npcById(c.id).present).map((c) => ({ id: 'rumor:' + c.id, label: c.name, tag: c.dog ? 'scapegoat' : null }))
      .concat([{ id: 'back', label: 'Never mind' }]);
  }

  function smeltIt(n) {
    G.mentioned = true; G.mentionBy = 'player';
    n.sus = Math.min(100, n.sus + COSTS.mentionFirst * G.diff.aura); recomputeAura();
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
        if (G.know.smell && f.id === cs.food.id) tip('claim');
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
        if (RULES.aura) { n.sus = Math.min(100, n.sus + COSTS.nosy * G.diff.aura); recomputeAura(); }
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

  function plantRumor(n, target) {
    n.asked.rumor = true;
    feature('rumors');
    const t = castById(target);
    let note = '';
    if (RULES.folklore && !G.mentioned) { smeltIt(n); note = ' (You brought it up first, though. They noticed.)'; }
    else n.sus = Math.max(0, n.sus - COSTS.rumorRelief);
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
      for (const o of humans()) if (o !== n && U.dist(o, n) < L.ranges.gossip * 1.5) o.sus = Math.min(100, o.sus + 8);
      UI.stamp('WHOEVER DENIED IT, SUPPLIED IT!'); shake(8);
      recomputeAura();
      return { text: "Wow. That's a LOT of denying for someone who didn't do anything.", expr: 'sus', bad: true };
    }
    if (id === 'rhyme') {
      n.sus = Math.min(100, n.sus + 15); recomputeAura();
      UI.stamp('WHOEVER MADE THE RHYME DID THE CRIME!'); shake(8);
      return { text: "Oh, so we're doing RHYMES now? That's exactly what the farter would say.", expr: 'angry', bad: true };
    }
    n.sus = Math.max(0, n.sus - COSTS.calmRelief); recomputeAura(); Sfx.ui('good');
    return { text: '...Yeah. Okay. Fair. Let me know what you find out.', expr: 'neutral' };
  }
  function startConfront(n) {
    if (G.state !== 'play') { n.confronted = false; return; }
    G.state = 'dialogue';
    tip('confront');
    UI.openDialogue(n, 'confront');
  }
  const anyConfronting = () => G.npcs.some((n) => n.confronting);

  function sniff() {
    if (G.state !== 'play' || G.sniffCd > 0) return;
    G.sniffCd = 1.6; Sfx.sniff();
    act('sniffing the air like a bloodhound', COSTS.sniff);
    const p = G.player, c = Gas.sample(p.x, p.y);
    let msg;
    if (!G.flags.fart) msg = L.mode === 'elevator' ? 'Carpet cleaner and coffee.' : 'Lilies, floor polish, and nerves.';
    else if (c < 0.03) msg = 'Nothing here. Clean air.';
    else {
      identifySmell('sniff');
      const g = Gas.gradient(p.x, p.y), a = Math.atan2(g.y, g.x), reach = L.view.w * 0.18;
      const tz = zoneAt({ x: p.x + Math.cos(a) * reach, y: p.y + Math.sin(a) * reach });
      const strength = c > 0.5 ? 'Overwhelming' : c > 0.18 ? 'Strong' : 'Faint';
      const showDir = RULES.questions.includes('where');
      msg = showDir ? `${strength} ${G.cs.food.smell}. Stronger toward the ${tz.name}.` : `${strength} ${G.cs.food.smell}.`;
      if (showDir) G.sniffArrow = { a, t: 2.6 };
    }
    p.bubble = { text: msg, t: 3.4, tone: 'thought' };
  }

  function smellVision() {
    if (G.state !== 'play' || !RULES.smellVision) return;
    if (G.sv.t > 0) return;
    if (G.sv.charges <= 0) { UI.caption('Out of Smell Vision for this case.', 2.5); return; }
    G.sv.charges--; G.sv.t = 7; Sfx.whoosh(true);
    feature('smellvision');
  }

  function release(forced = false) {
    if (G.state !== 'play' || !RULES.tummy) return;
    const p = G.player;
    if (!forced && G.pressure < 20) { p.bubble = { text: "Nothing to let go yet. You're fine.", t: 2, tone: 'thought' }; return; }
    const amount = (120 + G.pressure * 1.4) * (L.gas.amount / 340);
    const size = G.pressure / 60;
    G.pressure = 0; G.rumble = null;
    feature('pressure');
    Gas.emit(p.x, p.y, amount, 1);
    G.puffs.push({ x: p.x - 6, y: p.y - 18, t: 0, life: 1.6, size: (0.6 + size * 0.6) * (L.view.w / W), seed: Math.random() * 6 });
    const earshot = L.ranges.overhear * 1.4;
    if (forced) {
      G.flags.releasedBadly = true;
      Sfx.fart('trumpet', p.x, 1.2);
      act('let rip a full trumpet solo', COSTS.forced, { sound: earshot * 1.8 });
      UI.stamp('THAT ONE WAS DEFINITELY YOU.'); shake(14);
      logEvent('You could not hold it any longer.');
    } else if (G.loud) {
      G.flags.releasedLoud = true;
      Sfx.fart('squeaker', p.x, 0.25);
      floater(p.x, p.y, 'perfectly timed', '#3c8d2f');
      UI.caption(`${G.loud.label} It covered you completely. Smooth.`, 3.5);
      Sfx.ui('good');
      logEvent(`You let one go under cover of: ${G.loud.label}`);
    } else {
      G.flags.releasedBadly = true;
      Sfx.fart('squeaker', p.x, 0.8);
      act('fart. Audibly', COSTS.audible, { sound: earshot });
      UI.stamp('THAT WAS AUDIBLE.'); shake(8);
      logEvent('You farted in silence. People heard.');
    }
  }

  function object() {
    if (G.state !== 'play') return;
    if (!G.flags.fart || G.t < TIMELINE.fart + 3) { UI.caption('Call out what? Nothing has happened yet.', 2.5); return; }
    G.objected = true; G.state = 'accuse';
    Sfx.stopOrgan(); Sfx.stamp(); Sfx.sting('objection'); Sfx.setMusic('trial');
    feature('object');
    G.npcs.forEach((n) => { if (!n.present) return; n.face = Math.atan2(G.player.y - n.y, G.player.x - n.x); n.expr = 'shock'; n.exprT = 99; n.bubble = null; });
    focus(G.player, 1.5); shake(16);
    G.snapPending = 'object';
    UI.openAccuse();
  }

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

  // ---------------- accusations ----------------
  const about = (c, id) => c.who === id || (c.implicates || []).includes(id);
  function resolvePoint(accused) {
    const correct = accused === G.cs.culprit;
    return { mode: 'point', accused, correct, outcome: correct ? 'confess' : 'wrong', proof: correct ? 'full' : 'none', broken: 0 };
  }
  function resolveProof(accused, clueKey) {
    const correct = accused === G.cs.culprit, c = G.clues.find((k) => k.key === clueKey);
    const valid = !!(c && (c.implicates || []).includes(accused) && c.weight >= 1);
    const outcome = !correct ? 'wrong' : valid ? 'confess' : 'unproven';
    return { mode: 'proof', accused, correct, outcome, proof: correct && valid ? 'full' : 'none', broken: valid ? 1 : 0, clue: c };
  }
  // Cross-examination: three statements. The culprit's are lies that specific clues break.
  function testimony(accused) {
    const cs = G.cs, def = castById(accused), guilty = accused === cs.culprit, sg = L.scapegoat;
    const cName = castById(cs.culprit).name;
    const ab = (c) => about(c, accused);
    if (def.dog) {
      const sp = castById(sg.speaker) ? castById(sg.speaker).name : 'Owner';
      return [
        { id: 'food', topic: 'What they ate', speaker: sp, text: sg.testimony.food, contra: (c) => guilty && ab(c) && c.food === sg.food, press: guilty ? 'Okay, he MIGHT have had a little snack.' : 'Really. Ask anyone.' },
        { id: 'zone', topic: 'Where they were', speaker: sp, text: sg.testimony.zone, contra: (c) => guilty && ab(c) && c.zone === cs.origin.id, press: guilty ? 'Mostly asleep. Some of the time.' : 'Look at that face. That is a sleeping face.' },
        { id: 'cover', topic: 'What they did', speaker: sp, text: sg.testimony.cover, contra: (c) => guilty && (c.kind === 'tell' || c.kind === 'deflect') && c.who === accused, press: guilty ? 'That was... stretching.' : `Unlike ${cName}, who has been ${cs.cover.label}.` },
      ];
    }
    const claim = foodById(cs.claims[accused]);
    const st = [{ id: 'food', topic: 'What they ate', speaker: def.name, text: `I had ${claim.name} today. That's all.`,
      contra: (c) => ['bag', 'witness', 'contradiction'].includes(c.kind) && ab(c) && c.food && c.food !== claim.id,
      press: guilty ? `${U.cap(claim.name)}. Yes. Definitely. Why are you looking at me like that?` : 'Ask anyone. I had it right in front of everybody.' }];
    const z = cs.fartZone[accused];
    if (guilty) st.push({ id: 'zone', topic: 'Where they were', speaker: def.name, text: `I was nowhere near the ${cs.origin.name}. I was over by the ${zoneById(cs.alibiZone).name}.`,
      contra: (c) => ['zone', 'gossip', 'photo'].includes(c.kind) && ab(c) && c.zone === cs.origin.id, press: `The ${zoneById(cs.alibiZone).name}. The whole time. Mostly.` });
    else if (!z) st.push({ id: 'zone', topic: 'Where they were', speaker: def.name, text: "I wasn't even here when it happened!", contra: () => false, press: 'I got on later. Check the floor numbers.' });
    else st.push({ id: 'zone', topic: 'Where they were', speaker: def.name, text: `I was by the ${zoneById(z).name} the whole time.`, contra: () => false,
      press: z === cs.origin.id ? `Yes, I was near it. But so was ${cName}, and they were acting strange.` : 'People saw me there. Ask around.' });
    st.push({ id: 'cover', topic: 'What they did', speaker: def.name, text: guilty ? `And I have not been doing anything weird. I certainly wasn't ${cs.cover.label}.` : "I've just been standing here like a normal person.",
      contra: (c) => guilty && (c.kind === 'tell' || c.kind === 'deflect') && c.who === accused, press: guilty ? 'That was... unrelated. Allergies.' : `Unlike ${cName}, who has been ${cs.cover.label} all day.` });
    return st;
  }
  function startTrial(accused) {
    const base = Math.min(55, 10 + crowdOpinion(accused) * 0.45);
    G.trial = { accused, statements: testimony(accused), belief: base, broken: new Set(), pressed: new Set(), misses: {}, withdrawn: G.trial ? !!G.trial.withdrawn : false };
    const n = npcById(accused); if (n) focus(n, 1.7);
    feature('trial'); tip('cross');
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
    tr.misses[i] = (tr.misses[i] || 0) + 1;
    shake(5); Sfx.ui('bad');
    return { hit: false };
  }
  function withdraw() {
    const tr = G.trial;
    if (!tr || tr.withdrawn) return false;
    for (const o of humans()) o.sus = Math.min(100, o.sus + 12);
    recomputeAura();
    G.trial = { withdrawn: true };
    focus(G.player, 1.5);
    return true;
  }
  function resolveTrial() {
    const tr = G.trial, correct = tr.accused === G.cs.culprit;
    const all = tr.broken.size === tr.statements.length;
    const outcome = !correct ? 'wrong' : (all || tr.belief >= 75) ? 'confess' : tr.belief >= 45 ? 'reluctant' : 'unproven';
    return { mode: 'cross', accused: tr.accused, correct, outcome, broken: tr.broken.size, belief: tr.belief, proof: all ? 'full' : tr.broken.size ? 'some' : 'none' };
  }

  // ---------------- results ----------------
  // Ranks are criteria, not hidden thresholds, so players know what to aim for.
  function rankFor(kind, acc) {
    if (kind === 'bankrupt' || (acc && !acc.correct)) return 'F';
    if (kind === 'peace') return 'D';
    const aura = RULES.aura ? G.aura : 100, hints = G.hintsUsed;
    if (acc.proof === 'full' && aura >= 80 && hints === 0) return 'S';
    if (acc.proof === 'full' && aura >= 50) return 'A';
    if (acc.proof === 'full' || acc.proof === 'some') return 'B';
    return 'C';
  }
  const TITLES = { S: 'Nose of God', A: 'Certified sniffer', B: 'Decent detective', C: 'Right answer, no proof', D: 'Let it go' };

  // What evidence was out there that the player never found: the debrief that teaches.
  function missed() {
    const cs = G.cs, out = [], cul = castById(cs.culprit);
    if (!G.know.smell) out.push('You never worked out the smell. Press Q to sniff, or stand in the cloud.');
    if (RULES.questions.includes('food') && !G.know.claims[cs.culprit] && !cs.isDog) out.push(`You never asked ${cul.name} what they ate.`);
    if (RULES.lies && !cs.isDog && !G.clues.some((c) => c.kind === 'contradiction')) out.push(`${cul.name} lied about what they ate. Their bag or a witness would have shown it.`);
    if (RULES.search && !G.know.bags[cs.culprit]) out.push(`You never searched ${G.items[cs.culprit].label}.`);
    const w = cs.roles.witness;
    if ((RULES.questions.includes('gossip') || RULES.whispers) && w && cs.facts[w] && !G.know.facts[w]) out.push(`${castById(w).name} saw something. Ask "Seen anything weird?", or stand close when they whisper.`);
    if (RULES.questions.includes('where') && !G.clues.some((c) => c.zone === cs.origin.id && (c.implicates || []).length)) out.push(`It started by the ${cs.origin.name}. Asking "Where were you standing?" pins that down.`);
    if (RULES.tells && !G.clues.some((c) => c.kind === 'tell' || c.kind === 'deflect')) out.push(`${cul.name} kept ${cs.cover.label}. Stay near the people around where it started.`);
    if (RULES.photo && !G.clues.some((c) => c.kind === 'photo')) out.push(L.photo.source === 'item' ? `There was a photo of the moment in ${G.items[L.photo.owner].label}.` : 'The security camera had a still of the exact moment.');
    if (RULES.tummy && G.flags.releasedBadly) out.push('Your own fart was heard. Wait for something LOUD at the top of the screen, then press F.');
    if (G.hintsUsed) out.push(`You used ${G.hintsUsed} hint${G.hintsUsed > 1 ? 's' : ''}. An S rank needs none.`);
    return out;
  }

  function finish(kind, acc = null) {
    if (G.result) return;
    G.state = 'result';
    Sfx.stopOrgan(); Sfx.stopMurmur(); Sfx.setMusic(null);
    unfocus();
    const rank = rankFor(kind, acc);
    const rows = [];
    let score = 0;
    if (kind === 'accuse') {
      if (acc.correct) {
        const shame = castById(acc.accused).shame;
        rows.push(['Named the right culprit', 500], [`Stakes: ${castById(acc.accused).name} (${shame}/10)`, shame * 20]);
        score += 500 + shame * 20;
        if (acc.mode !== 'point') {
          const pp = acc.mode === 'cross' ? acc.broken * 120 : acc.proof === 'full' ? 300 : 0;
          rows.push([acc.mode === 'cross' ? `Testimony broken (${acc.broken}/3)` : 'Proof presented', pp]); score += pp;
        }
      } else rows.push([`Wrongly accused ${castById(acc.accused).name}`, 0]);
    }
    if (RULES.aura) { const ap = Math.round(G.aura * 4); rows.push([`Aura kept (${Math.round(G.aura)}%)`, ap]); score += ap; }
    if (G.board.locked) { rows.push(['Smell Board solved', 150]); score += 150; }
    if (G.hintsUsed) { rows.push([`Hints used (${G.hintsUsed})`, -50 * G.hintsUsed]); score -= 50 * G.hintsUsed; }
    const title = TITLES[rank] || (kind === 'bankrupt' ? 'Aura bankrupt' : L.mode === 'elevator' ? 'Socially fired' : 'Wedding ruiner');
    const prog = Store.record(G.caseDef.free ? 'free' : G.caseDef.id, rank);
    G.result = { kind, acc, rows, score: Math.max(0, score), rank, title, missed: missed(), progress: prog };
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
    if (!G.cam || !L) return;
    const cam = G.cam;
    cam.x += (cam.tx - cam.x) * 0.08; cam.y += (cam.ty - cam.y) * 0.08; cam.z += (cam.tz - cam.z) * 0.08; cam.shake *= 0.88;
    const sx = (Math.random() - 0.5) * cam.shake, sy = (Math.random() - 0.5) * cam.shake;
    const photoFrame = G.photoPending && G.state === 'play';
    const t = G.anim, sv = G.sv && G.sv.t > 0, inPlay = G.state === 'play' || G.state === 'tip';

    // ---- world pass ----
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#25232d'; ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    const v = L.view;
    if (background) ctx.drawImage(background, v.x, v.y, v.w, v.h);
    if (!G.cs) return;
    if (L.overlay && !photoFrame) L.overlay(ctx, t, api);

    if (L.mode === 'mingle' && G.t >= TIMELINE.places && G.t < TIMELINE.speakNow && U.dist(G.player, PLAYER_SEAT) > 22) {
      ctx.save(); ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.ellipse(PLAYER_SEAT.x, PLAYER_SEAT.y, 24 + Math.sin(t * 5) * 3, 9, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (RULES.aura && Store.settings().cones && inPlay && !photoFrame) {
      for (const n of G.npcs) {
        if (n.def.dog || !n.present) continue;
        const seeing = NPC.sees(n, G.player), rng = NPC.range(n);
        const grd = ctx.createRadialGradient(n.x, n.y - 30, 6, n.x, n.y - 30, rng);
        const col = seeing ? '255,120,60' : '255,236,150';
        grd.addColorStop(0, `rgba(${col},${seeing ? 0.28 : 0.12})`); grd.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.moveTo(n.x, n.y - 30); ctx.arc(n.x, n.y - 30, rng, n.face - NPC.VIEW_HALF, n.face + NPC.VIEW_HALF); ctx.closePath(); ctx.fill();
      }
    }
    if (!photoFrame) {
      Gas.paint(gasImg, sv ? 0.92 : 0.2, sv);
      gasCtx.putImageData(gasImg, 0, 0);
      const gr = Gas.rect;
      if (sv) { ctx.fillStyle = 'rgba(18,24,12,0.55)'; ctx.fillRect(v.x, v.y, v.w, v.h); }
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(gasCv, 0, 0, Gas.COLS, Gas.ROWS, gr.x, gr.y, gr.w, gr.h); ctx.restore();
    }
    const items = [...L.props(api)];
    const bagNear = inPlay ? nearestBag() : null;
    for (const c of CAST) {
      const it = G.items[c.id];
      if (!it || !it.present) continue;
      if (!RULES.search && L.ranges.itemOffset) { items.push({ y: it.y, draw: () => Art.drawItem(ctx, it, it.x, it.y, false, true) }); continue; }
      items.push({ y: it.y, draw: () => Art.drawItem(ctx, it, it.x, it.y, bagNear === c, G.know.bags[c.id] === 'seen') });
    }
    for (const n of G.npcs) if (n.present) items.push({ y: n.y, draw: () => drawNPC(n, t) });
    items.push({ y: G.player.y, draw: () => drawPlayer(t) });
    for (const id in G.actors) { const a = G.actors[id]; if (a.look) items.push({ y: a.y, draw: () => Art.drawPerson(ctx, a.look, a.x, a.y, { t, walking: a.walking, faceDir: 1, back: a.walking, expr: 'happy' }) }); }
    items.sort((a, b) => a.y - b.y).forEach((d) => d.draw(ctx));

    if (photoFrame) { G.photoPending = false; takePhoto(); G.snaps.fart = captureScreen(); }
    else if (G.flags.fart && !G.snaps.fart && G.state === 'play') G.snaps.fart = captureScreen();
    if (G.snapPending && G.state !== 'play' && Math.abs(cam.z - cam.tz) < 0.05) { if (G.snapPending === 'object') G.snaps.object = captureScreen(); G.snapPending = null; }

    for (const p of G.puffs) Art.puff(ctx, p);
    for (const n of G.npcs) if (n.present && n.expr === 'disgust') Art.stinkLines(ctx, n.x, n.y - (n.def.dog ? 60 : 92 * (n.def.look.scale || 1)), t);
    for (const s of G.pssts) {
      ctx.save(); ctx.strokeStyle = `rgba(142,91,214,${Math.min(1, s.t)})`; ctx.lineWidth = 3 * (L.view.w / W); ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y - 70); ctx.quadraticCurveTo((s.a.x + s.b.x) / 2, Math.min(s.a.y, s.b.y) - 110, s.b.x, s.b.y - 70); ctx.stroke(); ctx.restore();
    }
    if (G.sniffArrow) {
      const p = G.player, a = G.sniffArrow.a, k = L.view.w / W;
      ctx.save(); ctx.translate(p.x, p.y - 30); ctx.rotate(a); ctx.scale(k * 1.4, k * 1.4); ctx.globalAlpha = Math.min(1, G.sniffArrow.t);
      ctx.fillStyle = '#9bc53d'; ctx.strokeStyle = Art.INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(30, -7); ctx.lineTo(70, -7); ctx.lineTo(70, -16); ctx.lineTo(94, 0); ctx.lineTo(70, 16); ctx.lineTo(70, 7); ctx.lineTo(30, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    G.flashes = G.flashes.filter((f) => (f.t -= 1 / 60) > 0);
    for (const f of G.flashes) { ctx.fillStyle = `rgba(255,255,240,${f.t * 2.5})`; ctx.beginPath(); ctx.arc(f.x, f.y, 40, 0, Math.PI * 2); ctx.fill(); }

    // ---- screen pass: everything you read stays crisp at any zoom ----
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const head = (n) => toScreen(n.x, n.y - (n.def && n.def.dog ? 58 : 96 * ((n.def ? n.def.look.scale : 1) || 1)));
    if (!photoFrame && (sv || (inPlay && RULES.questions.includes('where')))) Art.drawZoneTags(ctx, sv, toScreen);
    if (RULES.badges && inPlay) for (const n of G.npcs) if (n.present && n.reactOrder) {
      const age = G.t - n.reactT; if (age > 30) continue;
      const hp = head(n); ctx.save(); ctx.globalAlpha = age > 25 ? (30 - age) / 5 : 1; Art.badge(ctx, hp.x, hp.y - 14, n.reactOrder, age); ctx.restore();
    }
    if (G.state !== 'accuse') {
      for (const n of G.npcs) if (n.present && n.bubble) { const hp = head(n); Art.bubble(ctx, hp.x, hp.y - 6, n.bubble.text, { tone: n.bubble.tone, alpha: Math.min(1, n.bubble.t * 3), belowY: toScreen(n.x, n.y).y }); }
      for (const id in G.actors) { const a = G.actors[id]; if (a.bubble) { const hp = toScreen(a.x, a.y - (a.look ? 95 : 0)); Art.bubble(ctx, hp.x, hp.y, a.bubble.text, { tone: a.bubble.tone, belowY: toScreen(a.x, a.y).y }); } }
      if (G.player.bubble) { const hp = head({ x: G.player.x, y: G.player.y, def: { look: PLAYER_LOOK } }); Art.bubble(ctx, hp.x, hp.y - 26, G.player.bubble.text, { tone: G.player.bubble.tone, alpha: Math.min(1, G.player.bubble.t * 3) }); }
    }
    ctx.font = '700 12px "Lexend", sans-serif'; ctx.textAlign = 'center';
    if (!inPlay) UI.prompt([]);
    if (inPlay) {
      const person = nearestPerson(), bag = nearestBag(), prop = nearestProp();
      for (const n of G.npcs) {
        if (!n.present || !(sv || n === person)) continue;
        const sp = toScreen(n.x, n.y), label = n.def.name + (sv && n.reacted ? '  ✓ smelled it' : '');
        const w = ctx.measureText(label).width + 12;
        Art.paperRect(ctx, sp.x - w / 2, sp.y + 4, w, 18, sv && n.reacted ? '#d9f2a8' : '#fffdf6', n.x, { amp: 1, stroke: Art.INK, lw: 1 });
        ctx.fillStyle = Art.INK; ctx.fillText(label, sp.x, sp.y + 17);
      }
      // one clear prompt, in a fixed spot above the action bar, with the cost if anyone is watching
      const lines = [];
      if (person) lines.push(['E', person.def.dog ? `${person.def.sprite === 'baby' ? 'Coo at' : 'Pet'} ${person.def.name}` : `Talk to ${person.def.name}`, '']);
      if (bag) lines.push(['Hold E', `Search ${G.items[bag.id].label}`, RULES.aura ? (G.watchers ? `${G.watchers} watching · about −${Math.round(COSTS.search * G.diff.aura)} Aura` : 'nobody watching') : '']);
      if (prop) lines.push(['E', `Check the ${prop.label.toLowerCase()}`, '']);
      UI.prompt(lines);
      if (G.searching) { const ip = toScreen(G.items[G.searching.c.id].x, G.items[G.searching.c.id].y - 12); Art.holdRing(ctx, ip.x, ip.y, G.searching.k); }
      if (RULES.aura) { const ep = head({ x: G.player.x, y: G.player.y, def: { look: PLAYER_LOOK } }); Art.eyeIndicator(ctx, ep.x, ep.y - 22, G.watchers, t); }
      if (G.rumble) {
        const k = G.rumble.held / 0.8, pulse = 1 + Math.sin(t * 20) * 0.06, rp = toScreen(G.player.x, G.player.y - 40);
        ctx.save(); ctx.translate(rp.x, rp.y);
        ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 50 * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#3c8d2f'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, 50 * pulse, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
        Art.paperRect(ctx, -76, 56, 152, 24, '#fff3b0', 999, { amp: 1, stroke: Art.INK, lw: 1.5 });
        ctx.fillStyle = Art.INK; ctx.font = '700 13px "Lexend", sans-serif'; ctx.fillText('RUMBLE! Hold C', 0, 73); ctx.restore();
      }
      if (RULES.aura) for (const n of G.npcs) if (n.present && !n.def.dog && n.sus > 25) {
        const hp = head(n); ctx.save(); ctx.font = '400 16px "Bowlby One SC", sans-serif';
        ctx.fillStyle = n.sus > 60 ? '#e8505b' : '#8e5bd6'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        const mark = n.sus > 60 ? '!!' : '?'; ctx.strokeText(mark, hp.x + 30, hp.y + 4); ctx.fillText(mark, hp.x + 30, hp.y + 4); ctx.restore();
      }
    }
    G.floaters = G.floaters.filter((f) => (f.t += 1 / 60) < 1.8);
    for (const f of G.floaters) {
      const fp = toScreen(f.x, f.y);
      ctx.save(); ctx.globalAlpha = 1 - f.t / 1.8; ctx.font = '400 20px "Bowlby One SC", sans-serif';
      ctx.fillStyle = f.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.textAlign = 'center';
      const y = fp.y - 96 * G.cam.z - 30 - f.t * 30; ctx.strokeText(f.text, fp.x, y); ctx.fillText(f.text, fp.x, y); ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.08; ctx.fillStyle = Art.grainPattern(ctx); ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  function drawNPC(n, t) {
    const lookX = Math.cos(n.face), lookY = Math.sin(n.face);
    const back = n.seated && Math.sin(n.face) < -0.6 && !n.anim && G.state !== 'accuse';
    const faceDir = Math.cos(n.face) < -0.15 ? -1 : 1;
    const o = { t, walking: n.walking, faceDir, expr: n.expr, anim: n.anim, animT: n.animT };
    if (n.def.sprite === 'dog') return Art.drawDog(ctx, n.def.look, n.x, n.y, o);
    if (n.def.sprite === 'baby') return Art.drawBaby(ctx, n.def.look, n.x, n.y, o);
    // nervous sweat: the culprit when you are close, and naturally nervous innocents
    const close = U.dist(n, G.player) < L.ranges.talk * 1.3;
    const sweat = RULES.sweat && close && G.flags.fart && (n.isCulprit || (L.nervous || []).includes(n.id)) && G.state === 'play';
    Art.drawPerson(ctx, n.def.look, n.x, n.y, { ...o, lookX: faceDir * lookX, lookY, back, sweat, talking: !!(n.bubble && n.bubble.tone !== 'thought'), blinkSeed: n.id.length * 7 + n.id.charCodeAt(0) });
  }

  function drawPlayer(t) {
    const p = G.player;
    const faceDir = Math.cos(p.face) < -0.15 ? -1 : 1;
    const expr = G.state === 'accuse' ? 'angry' : G.rumble ? 'worried' : p.expr;
    Art.drawPerson(ctx, PLAYER_LOOK, p.x, p.y, { t, walking: p.walking, faceDir, lookX: faceDir * Math.cos(p.face), lookY: Math.sin(p.face), expr, blinkSeed: 3 });
    if (!RULES.aura) {
      ctx.save(); ctx.fillStyle = '#f08a24'; ctx.strokeStyle = Art.INK; ctx.lineWidth = 2;
      const y = p.y - 104 + Math.sin(t * 4) * 2;
      ctx.beginPath(); ctx.moveTo(p.x - 8, y - 10); ctx.lineTo(p.x + 8, y - 10); ctx.lineTo(p.x, y); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  // ---------------- input ----------------
  function onKey(e, down) {
    const k = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(k) && G.state !== 'title') e.preventDefault();
    const was = keys[k];
    keys[k] = down;
    if (k === 'KeyE' && G.state === 'play') { if (down && !was) pressE(); if (!down) releaseE(); return; }
    if (k === 'KeyE' && !down) { G.eDown = null; G.searching = null; }
    if (!down || e.repeat) return;
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && k !== 'Escape') return;
    if (UI.handleKey(k)) return;
    if (G.state !== 'play') return;
    if (k === 'Space' || k === 'Enter') tapE();
    else if (k === 'KeyQ') sniff();
    else if (k === 'KeyV') smellVision();
    else if (k === 'KeyF') release(false);
    else if (k === 'KeyO') object();
    else if (k === 'KeyH') useHint();
    else if (k === 'Tab' || k === 'KeyN') UI.openNotebook();
    else if (k === 'Escape') UI.pause();
    else if (k === 'BracketRight' && Store.settings().presenter) fastForward();
  }
  function fastForward() {
    UI.caption('Presenter skip: +15 seconds.', 1.5);
    for (let i = 0; i < 15 / STEP && G.state === 'play'; i++) { G.beatT = 0; update(STEP); if (G.photoPending) render(); }
    G.flashes = [];
  }

  function onPointer(e) {
    if (G.state !== 'play') return;
    const r = cv.getBoundingClientRect();
    const s = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    const w = toWorld(s.x, s.y), p = G.player, B = L.bounds;
    let hit = null;
    for (const n of present()) { const hp = toScreen(n.x, n.y); if (Math.abs(s.x - hp.x) < 24 * G.cam.z && s.y < hp.y + 6 && s.y > hp.y - 90 * G.cam.z) hit = { type: 'npc', n }; }
    if (!hit && RULES.search) for (const c of CAST) { const it = G.items[c.id]; if (it.present && Math.hypot(w.x - it.x, w.y - (it.y - 8)) < 14) hit = { type: 'item', c }; }
    if (!hit) for (const pr of G.props) if (Math.hypot(w.x - pr.x, w.y - pr.y) < 20) hit = { type: 'prop', pr };
    const goal = (tx, ty) => { const g = { x: U.clamp(tx, B.x0, B.x1), y: U.clamp(ty, B.y0, B.y1) }; p.path = L.route ? L.route(p, g) : [g]; p.target = p.path.shift(); };
    if (hit) {
      const tgt = hit.type === 'npc' ? hit.n : hit.type === 'item' ? G.items[hit.c.id] : hit.pr;
      const reach = hit.type === 'npc' ? L.ranges.talk : L.ranges.search;
      if (Math.hypot(tgt.x - p.x, tgt.y - p.y) < reach) { if (hit.type === 'item') G.eDown = { held: TAP, done: false, mouse: true }; else interact(hit); }
      else { goal(tgt.x + (p.x < tgt.x ? -reach * 0.5 : reach * 0.5), tgt.y + 4); p.pending = hit.type === 'item' ? null : hit; }
    } else { goal(w.x, w.y); p.pending = null; }
  }
  function onPointerUp() { if (G.eDown && G.eDown.mouse && !G.eDown.done) { G.eDown = null; G.searching = null; } }

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
  function showcase(caseDef) {
    prepare(caseDef);
    G.cs = Case.generate(caseDef.seed || 7);
    G.npcs = CAST.map((c) => NPC.create(c, G.cs));
    G.items = {};
    for (const c of CAST) { const s = G.cs.spots[c.id], off = L.ranges.itemOffset; G.items[c.id] = { ...c.item, ...(off ? (s ? { x: s.x + off.x, y: s.y + off.y } : { x: -99, y: -99 }) : { x: c.item.x, y: c.item.y }), present: !(L.lateArrivals || []).includes(c.id) }; }
    G.player = { x: L.player.start.x, y: L.player.start.y, face: -Math.PI / 2, expr: 'neutral' };
    Object.assign(G, { know: { bags: {}, reactions: [], facts: {} }, t: 0, flashes: [], floaters: [], pssts: [], puffs: [], sv: { t: 0 }, actors: {}, props: [], doors: { main: { open: 0, target: 0 } }, result: null, rumble: null, flags: {}, diff: DIFFICULTY.normal, watchers: 0, searching: null });
  }

  function boot() {
    cv = document.getElementById('cv'); ctx = cv.getContext('2d');
    gasCv = document.createElement('canvas'); gasCv.width = Gas.COLS; gasCv.height = Gas.ROWS;
    gasCtx = gasCv.getContext('2d'); gasImg = gasCtx.createImageData(Gas.COLS, Gas.ROWS);
    resize();
    new ResizeObserver(resize).observe(cv);
    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup', (e) => onKey(e, false));
    window.addEventListener('blur', () => { Object.keys(keys).forEach((k) => (keys[k] = false)); G.eDown = null; G.searching = null; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') UI.pause(); });
    cv.addEventListener('pointerdown', onPointer);
    window.addEventListener('pointerup', onPointerUp);
    UI.init();
    showcase(Store.nextCase());
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(() => { if (L) background = Art.buildBackground(L, baseZoom() * 2); }).catch(() => {});
    requestAnimationFrame(frame);
  }

  return {
    boot, newGame, showcase, sniff, smellVision, release, object, useHint, tapE, talkOptions, talkChoose, confrontOptions, confrontChoose,
    startConfront, anyConfronting, onReaction, onCover, onIdle, onOverhear, onDeflect, flash, checkBoard, finish, feature,
    npcById, humans, recomputeAura, fastForward, crowdOpinion, primeSuspect, evalObjectives,
    resolvePoint, resolveProof, testimony, startTrial, trialPress, trialPresent, withdraw, resolveTrial, unfocus, focus, about,
  };
})();

// NPC module calls these through G.
Object.assign(G, {
  onReaction: (n) => Game.onReaction(n), onCover: (n) => Game.onCover(n), onIdle: (n) => Game.onIdle(n), onOverhear: (n, f) => Game.onOverhear(n, f),
  onDeflect: (n, b, t) => Game.onDeflect(n, b, t), flash: (n) => Game.flash(n), startConfront: (n) => Game.startConfront(n), anyConfronting: () => Game.anyConfronting(),
});
window.addEventListener('DOMContentLoaded', () => Game.boot());
