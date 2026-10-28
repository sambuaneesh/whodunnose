'use strict';
// People: they mingle (or face the elevator doors), smell, react, glance around, form theories,
// whisper what they know, gossip about you, and the culprit actively covers their tracks.
// Every behaviour that the current case has not taught yet is switched off by RULES.
const NPC = (() => {
  const VIEW_RANGE = 330, VIEW_HALF = 0.95;
  const REACTIONS_PRE = ['*gags*', '*sniff sniff*... ?', '*eyes water*', '*holds breath*', '*fans face*'];
  const REACTIONS_POST = ['Ugh! Again?!', 'Oh, come ON.', 'My eyes!', 'Is someone dying?'];

  function create(def, cs) {
    const p = cs.spots[def.id] || { x: -100, y: -100 };
    const elevator = L.mode === 'elevator';
    const n = {
      id: def.id, def, x: p.x, y: p.y, face: Math.PI / 2, target: null, path: [], speed: def.dog ? 70 : 52,
      wait: 3 + Math.random() * 4, lookT: 1 + Math.random() * 2, baseFace: Math.PI / 2,
      expo: 0, reacted: false, reactT: null, reactZone: null, reactOrder: 0,
      sus: 0, op: {}, bubble: null, anim: null, animT: 0, expr: 'neutral', exprT: 0,
      nextIdle: 25 + Math.random() * 30, nextCover: TIMELINE.fart + 9 + Math.random() * 6,
      nextWhisper: TIMELINE.fart + 18 + Math.random() * 20, nextDeflect: TIMELINE.fart + 16 + Math.random() * 8,
      confronted: false, confronting: false, asked: {}, seated: elevator, glanceT: 4 + Math.random() * 8, glancing: 0,
      walking: false, isCulprit: def.id === cs.culprit, present: !(L.lateArrivals || []).includes(def.id),
      seat: elevator ? { x: p.x, y: p.y, face: Math.PI / 2 } : def.seat,
    };
    if (elevator) n.face = n.baseFace = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    return n;
  }

  function say(n, text, dur = 3.2, tone = 'speech') { n.bubble = { text, t: dur, tone }; }
  const busy = (n) => n.anim || n.expr === 'disgust';
  const range = (n) => (busy(n) ? VIEW_RANGE * 0.35 : VIEW_RANGE) * (n.def.perception ?? 1);

  function sees(n, p) {
    if (n.def.dog || !n.present) return false;
    const dx = p.x - n.x, dy = p.y - n.y, d = Math.hypot(dx, dy);
    if (d < L.ranges.notice * Math.max(0.7, n.def.perception ?? 1)) return true;
    if (d > range(n)) return false;
    return Math.abs(U.angDiff(n.face, Math.atan2(dy, dx))) < VIEW_HALF;
  }

  function goTo(n, dest) {
    n.path = L.route ? L.route(n, dest) : [dest];
    n.target = n.path.shift();
  }
  function randomSpot() {
    const p = spotIn(U.pick(Math.random, ZONES), Math.random);
    return L.fixSpot ? L.fixSpot(p) : p;
  }
  function suspect(n, id, amount) { if (id && id !== n.id) n.op[id] = Math.min(100, (n.op[id] || 0) + amount); }

  function update(n, dt, G) {
    if (!n.present) return;
    const t = G.t;
    if (n.bubble) { n.bubble.t -= dt; if (n.bubble.t <= 0) n.bubble = null; }
    if (n.anim) { n.animT += dt; if (n.animT > 2.6) { n.anim = null; n.animT = 0; } }
    if (n.exprT > 0) { n.exprT -= dt; if (n.exprT <= 0) n.expr = 'neutral'; }

    // ---- where to be ----
    const ceremony = t >= TIMELINE.places;
    if (L.mode === 'elevator') {
      if (!n.target && U.dist(n, n.seat) > 3) goTo(n, { x: n.seat.x, y: n.seat.y });
    } else if (ceremony) {
      const s = n.seat;
      if (!n.seated && !n.target) goTo(n, { x: s.x, y: s.y });
      if (!n.seated && U.dist(n, s) < 4) { n.seated = true; n.target = null; n.path = []; n.baseFace = s.face; n.face = s.face; }
    } else if (n.confronting) {
      n.target = { x: G.player.x + (n.x < G.player.x ? -40 : 40), y: G.player.y }; n.path = [];
      if (U.dist(n, G.player) < 58) { n.target = null; n.confronting = false; G.startConfront(n); }
    } else if (t > TIMELINE.fart + 10) {
      if (!n.target) {
        n.wait -= dt;
        if (n.wait <= 0) { goTo(n, randomSpot()); n.wait = 5 + Math.random() * 7; }
      }
    }
    n.walking = false;
    if (n.target && !n.anim) {
      const dx = n.target.x - n.x, dy = n.target.y - n.y, d = Math.hypot(dx, dy);
      const sp = (ceremony && !n.seated ? 95 : n.speed) * (L.mode === 'elevator' ? 0.5 : 1) * dt;
      if (d <= sp) {
        n.x = n.target.x; n.y = n.target.y;
        n.target = n.path.length ? n.path.shift() : null;
        if (!n.target) {
          n.baseFace = L.mode === 'elevator' ? Math.PI / 2 : Math.random() * Math.PI * 2;
          if (L.mode === 'elevator') n.face = n.baseFace;
        }
      } else { n.x += (dx / d) * sp; n.y += (dy / d) * sp; n.face = Math.atan2(dy, dx); n.walking = true; }
    }

    // ---- where to look ----
    if (!n.walking) {
      n.lookT -= dt;
      if (n.seated) {
        n.glanceT -= dt;
        if (n.glancing > 0) { n.glancing -= dt; if (n.glancing <= 0) n.face = n.baseFace; }
        else if (n.glanceT <= 0 && t > TIMELINE.glanceFrom) {
          n.glanceT = 6 + Math.random() * 9; n.glancing = 1.6;
          n.face = L.mode === 'elevator' ? n.baseFace + (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 0.9) : n.baseFace + Math.PI + (Math.random() - 0.5) * 0.8;
        } else n.face = n.baseFace;
        if (RULES.aura && n.sus > 55 && Math.random() < dt * 0.25) { n.glancing = 1.4; n.face = Math.atan2(G.player.y - n.y, G.player.x - n.x); }
      } else if (n.lookT <= 0) {
        n.lookT = 1.5 + Math.random() * 2.5;
        if (RULES.aura && n.sus > 50 && Math.random() < 0.6) n.face = Math.atan2(G.player.y - n.y, G.player.x - n.x);
        else {
          const buddy = nearestOther(n, G);
          n.face = buddy && Math.random() < 0.55 ? Math.atan2(buddy.y - n.y, buddy.x - n.x) : n.baseFace + (Math.random() - 0.5) * 2.4;
        }
      }
    }

    // ---- smelling ----
    if (G.flags.fart) {
      const c = Gas.sample(n.x, n.y);
      n.expo += Math.min(0.5, Math.max(0, c - 0.03)) * n.def.nose * dt;
      const need = n.def.tol * 1.5 + (n.isCulprit ? 0.8 : 0);
      if (!n.reacted && n.expo >= need) {
        n.reacted = true; n.reactT = G.t; n.reactZone = zoneAt(n).id;
        n.expr = 'disgust'; n.exprT = 3;
        say(n, n.def.dog ? (n.def.sprite === 'baby' ? '*wails*' : '*whimpers*') : U.pick(Math.random, G.mentioned ? REACTIONS_POST : REACTIONS_PRE), 2.6, 'thought');
        for (const o of G.npcs) if (o !== n && o.present && U.dist(o, n) < L.ranges.gossip * 0.85) suspect(n, o.id, 12);
        if (RULES.aura && U.dist(G.player, n) < L.ranges.gossip * 0.85) n.sus = Math.min(100, n.sus + 4);
        G.onReaction(n);
      } else if (n.reacted && c > 0.35 && Math.random() < dt * 0.08 && !n.bubble) {
        n.expr = 'disgust'; n.exprT = 2;
      }
    }

    // ---- the culprit's tell ----
    if (RULES.tells && n.isCulprit && t >= n.nextCover && t < TIMELINE.speakNow && !n.walking) {
      n.nextCover = t + 22 + Math.random() * 10;
      const cv = G.cs.cover;
      n.anim = cv.anim; n.animT = 0;
      const line = cv.id === 'blamedog' ? L.scapegoat.blameLine : cv.id === 'arms' ? L.subjectChange : cv.bubble;
      if (line) say(n, line, 2.6, 'shout');
      for (const o of G.npcs) if (o !== n && sees(o, n)) suspect(o, n.id, 15);
      G.onCover(n);
    }
    // ---- the culprit quietly blames someone else (or you, once you look suspicious) ----
    if (RULES.deflect && n.isCulprit && !n.def.dog && t >= n.nextDeflect && t < TIMELINE.speakNow && !n.bubble && !n.anim && !(L.quiet(t))) {
      n.nextDeflect = t + 26 + Math.random() * 10;
      const avgSus = G.npcs.filter((o) => !o.def.dog && o.present).reduce((a, o) => a + o.sus, 0) / Math.max(1, G.npcs.length);
      const st = G.caseDef && G.caseDef.story;
      const target = (st && st.fix.framesYou) || avgSus > 25 ? 'player' : G.cs.roles.nearDecoy;
      // you do not tell someone it was them: whisper to the nearest person who is not the target
      const buddy = nearestOther(n, G, target);
      if (buddy) {
        if (target === 'player') buddy.sus = Math.min(100, buddy.sus + 10); else suspect(buddy, target, 18);
        const name = target === 'player' ? (st && st.youAre) || 'the one in orange' : castById(target).name;
        const close = U.dist(G.player, n) < L.ranges.overhear;
        say(n, close ? `(whispering) Honestly? Pretty sure it was ${name}.` : '*whisper whisper*', 4, 'whisper');
        n.face = Math.atan2(buddy.y - n.y, buddy.x - n.x);
        if (close) G.onDeflect(n, buddy, target);
      }
    }
    // ---- harmless odd behaviour ----
    if (t >= n.nextIdle && !n.bubble && !n.anim) {
      n.nextIdle = t + 22 + Math.random() * 26;
      const idle = IDLES[n.id];
      if (idle) { say(n, idle.bubble, 2.2, 'thought'); if (idle.anim === 'flash') G.flash(n); G.onIdle(n); }
    }
    // ---- whispering what they know (overheard if you are close) ----
    const fact = G.cs.facts[n.id];
    if (RULES.whispers && fact && !n.def.dog && t >= n.nextWhisper && !n.bubble && !n.anim && !L.quiet(t) && !G.know.facts[n.id]) {
      const buddy = nearestOther(n, G);
      if (buddy && U.dist(buddy, n) < L.ranges.gossip * 1.1) {
        n.nextWhisper = t + 24 + Math.random() * 14;
        const close = U.dist(G.player, n) < L.ranges.overhear;
        say(n, close ? `(whispering) ${fact.text}` : '*whisper whisper*', 4.5, 'whisper');
        n.face = Math.atan2(buddy.y - n.y, buddy.x - n.x);
        if (fact.about) suspect(buddy, fact.about, 10);
        if (close) G.onOverhear(n, fact);
      } else n.nextWhisper = t + 6;
    }

    // ---- confronting the player ----
    if (RULES.confront && !n.def.dog && n.sus >= 72 && !n.confronted && G.state === 'play' && t >= (G.nextConfrontT || 0)) {
      if (L.mode === 'elevator') {
        if (U.dist(n, G.player) < L.ranges.talk * 1.6) { n.confronted = true; G.nextConfrontT = t + 40; G.startConfront(n); }
      } else if (!ceremony && !G.anyConfronting()) { n.confronted = true; n.confronting = true; G.nextConfrontT = t + 45; }
    }
  }

  // Personal space: people standing on top of each other drift apart.
  function separate(G, dt) {
    const ps = G.npcs.filter((n) => n.present), r = L.ranges.personal * 2;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j], dx = b.x - a.x, dy = (b.y - a.y) * 1.6, d = Math.hypot(dx, dy) || 0.01;
      if (d >= r) continue;
      const push = Math.min(20 * dt, (r - d) / 2), ux = dx / d, uy = dy / d / 1.6;
      // in the elevator people shuffle their standing spot too, so they do not walk back into each other
      const el = L.mode === 'elevator';
      if (!a.seated || el) { a.x -= ux * push; a.y -= uy * push; if (el && a.seat) { a.seat.x -= ux * push; a.seat.y -= uy * push; } }
      if (!b.seated || el) { b.x += ux * push; b.y += uy * push; if (el && b.seat) { b.seat.x += ux * push; b.seat.y += uy * push; } }
    }
  }

  function nearestOther(n, G, exclude = null) {
    let best = null, bd = L.ranges.gossip * 1.2;
    for (const o of G.npcs) if (o !== n && o.id !== exclude && o.present && !o.def.dog) { const d = U.dist(o, n); if (d < bd) { bd = d; best = o; } }
    return best;
  }

  return { create, update, separate, sees, say, suspect, range, VIEW_RANGE, VIEW_HALF };
})();
