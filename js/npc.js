'use strict';
// Guests: they mingle (or stand facing the elevator doors), smell, react, glance around,
// form their own theories, whisper what they know, gossip about you, and the culprit keeps
// doing the one thing that gives them away.
const NPC = (() => {
  const VIEW_RANGE = 330, VIEW_HALF = 0.95, NOTICE_RANGE = 72, OVERHEAR_RANGE = 220;
  const REACTIONS_PRE = ['*gags*', '*sniff sniff*... ?', '*eyes water*', '*holds breath*', '*fans face*'];
  const REACTIONS_POST = ['Ugh! Again?!', 'Oh, come ON.', 'My eyes!', 'Is someone dying?'];

  function create(def, cs) {
    const p = cs.spots[def.id] || { x: -100, y: -100 };
    const elevator = L.mode === 'elevator';
    const n = {
      id: def.id, def, x: p.x, y: p.y, face: Math.PI / 2, target: null, speed: def.dog ? 70 : 52,
      wait: 3 + Math.random() * 4, lookT: 1 + Math.random() * 2, baseFace: Math.PI / 2,
      expo: 0, reacted: false, reactT: null, reactZone: null,
      sus: 0, op: {}, bubble: null, anim: null, animT: 0, expr: 'neutral', exprT: 0,
      nextIdle: 25 + Math.random() * 30, nextCover: TIMELINE.fart + 9 + Math.random() * 6, nextWhisper: TIMELINE.fart + 18 + Math.random() * 20,
      confronted: false, confronting: false, asked: {}, seated: elevator, glanceT: 4 + Math.random() * 8, glancing: 0,
      walking: false, isCulprit: def.id === cs.culprit, present: !(L.lateArrivals || []).includes(def.id),
      seat: elevator ? { x: p.x, y: p.y, face: Math.PI / 2 } : def.seat,
    };
    if (elevator) { n.face = n.baseFace = Math.PI / 2 + (Math.random() - 0.5) * 0.3; }
    return n;
  }

  function say(n, text, dur = 3.2, tone = 'speech') { n.bubble = { text, t: dur, tone }; }
  const busy = (n) => n.anim || n.expr === 'disgust';
  const range = (n) => (busy(n) ? VIEW_RANGE * 0.35 : VIEW_RANGE) * (n.def.perception ?? 1);

  function sees(n, p) {
    if (n.def.dog || !n.present) return false;
    const dx = p.x - n.x, dy = p.y - n.y, d = Math.hypot(dx, dy);
    if (d < NOTICE_RANGE * Math.max(0.7, n.def.perception ?? 1)) return true;
    if (d > range(n)) return false;
    return Math.abs(U.angDiff(n.face, Math.atan2(dy, dx))) < VIEW_HALF;
  }

  function randomSpot() {
    const z = U.pick(Math.random, ZONES);
    return { x: z.x + 40 + Math.random() * (z.w - 80), y: z.y + 55 + Math.random() * (z.h - 70) };
  }
  function suspect(n, id, amount) { if (id && id !== n.id) n.op[id] = Math.min(100, (n.op[id] || 0) + amount); }

  function update(n, dt, G) {
    if (!n.present) return;
    const t = G.t;
    if (n.bubble) { n.bubble.t -= dt; if (n.bubble.t <= 0) n.bubble = null; }
    if (n.anim) { n.animT += dt; if (n.animT > 2.6) { n.anim = null; n.animT = 0; } }
    if (n.exprT > 0) { n.exprT -= dt; if (n.exprT <= 0) n.expr = 'neutral'; }

    // ---- where to be ----
    const ceremony = t >= TIMELINE.places || n.seatNow;
    if (L.mode === 'elevator') {
      if (n.target) { /* walking in from the doors */ }
      else if (U.dist(n, n.seat) > 3) n.target = { x: n.seat.x, y: n.seat.y };
    } else if (ceremony) {
      const s = n.seat;
      if (!n.seated) {
        n.target = { x: s.x, y: s.y };
        if (U.dist(n, s) < 4) { n.seated = true; n.target = null; n.baseFace = s.face; n.face = s.face; }
      }
    } else if (n.confronting) {
      n.target = { x: G.player.x + (n.x < G.player.x ? -46 : 46), y: G.player.y };
      if (U.dist(n, G.player) < 62) { n.target = null; n.confronting = false; G.startConfront(n); }
    } else if (t > TIMELINE.fart + 10) {
      if (!n.target) {
        n.wait -= dt;
        if (n.wait <= 0) { n.target = randomSpot(); n.wait = 5 + Math.random() * 7; }
      }
    }
    n.walking = false;
    if (n.target && !n.anim) {
      const dx = n.target.x - n.x, dy = n.target.y - n.y, d = Math.hypot(dx, dy);
      const sp = (ceremony && !n.seated ? 95 : n.speed) * dt;
      if (d <= sp) {
        n.x = n.target.x; n.y = n.target.y; n.target = null;
        n.baseFace = L.mode === 'elevator' ? Math.PI / 2 : Math.random() * Math.PI * 2;
        if (L.mode === 'elevator') n.face = n.baseFace;
      } else { n.x += (dx / d) * sp; n.y += (dy / d) * sp; n.face = Math.atan2(dy, dx); n.walking = true; }
    }

    // ---- where to look ----
    if (!n.walking) {
      n.lookT -= dt;
      if (n.seated) {
        // seated guests / elevator riders face forward, but now and then someone turns around
        n.glanceT -= dt;
        if (n.glancing > 0) { n.glancing -= dt; if (n.glancing <= 0) n.face = n.baseFace; }
        else if (n.glanceT <= 0 && t > TIMELINE.glanceFrom) {
          n.glanceT = 6 + Math.random() * 9; n.glancing = 1.6;
          n.face = L.mode === 'elevator' ? n.baseFace + (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 0.9) : n.baseFace + Math.PI + (Math.random() - 0.5) * 0.8;
        } else n.face = n.baseFace;
        if (n.sus > 55 && Math.random() < dt * 0.25) { n.glancing = 1.4; n.face = Math.atan2(G.player.y - n.y, G.player.x - n.x); }
      } else if (n.lookT <= 0) {
        n.lookT = 1.5 + Math.random() * 2.5;
        if (n.sus > 50 && Math.random() < 0.6) n.face = Math.atan2(G.player.y - n.y, G.player.x - n.x);
        else {
          const buddy = nearestOther(n, G);
          n.face = buddy && Math.random() < 0.55 ? Math.atan2(buddy.y - n.y, buddy.x - n.x) : n.baseFace + (Math.random() - 0.5) * 2.4;
        }
      }
    }

    // ---- smelling ----
    if (G.t >= TIMELINE.fart) {
      const c = Gas.sample(n.x, n.y);
      n.expo += Math.min(0.5, Math.max(0, c - 0.03)) * n.def.nose * dt;
      const need = n.def.tol * 1.5 + (n.isCulprit ? 0.8 : 0);
      if (!n.reacted && n.expo >= need) {
        n.reacted = true; n.reactT = G.t; n.reactZone = zoneAt(n).id;
        n.expr = 'disgust'; n.exprT = 3;
        say(n, n.def.dog ? (n.def.sprite === 'baby' ? '*wails*' : '*whimpers*') : U.pick(Math.random, G.mentioned ? REACTIONS_POST : REACTIONS_PRE), 2.6, 'thought');
        // whoever was standing close when it hit you becomes your first suspect
        for (const o of G.npcs) if (o !== n && o.present && U.dist(o, n) < 130) suspect(n, o.id, 12);
        if (U.dist(G.player, n) < 130) n.sus = Math.min(100, n.sus + 6);
        G.onReaction(n);
      } else if (n.reacted && c > 0.35 && Math.random() < dt * 0.08 && !n.bubble) {
        n.expr = 'disgust'; n.exprT = 2;
      }
    }

    // ---- the culprit's tell ----
    if (n.isCulprit && t >= n.nextCover && t < TIMELINE.speakNow && !n.walking) {
      n.nextCover = t + 22 + Math.random() * 10;
      const cv = G.cs.cover;
      n.anim = cv.anim; n.animT = 0;
      const line = cv.id === 'blamedog' ? L.scapegoat.blameLine : cv.id === 'arms' ? L.subjectChange : cv.bubble;
      if (line) say(n, line, 2.6, 'shout');
      // other people can notice the tell too
      for (const o of G.npcs) if (o !== n && sees(o, n)) suspect(o, n.id, 15);
      G.onCover(n);
    }
    // ---- harmless odd behaviour ----
    if (t >= n.nextIdle && !n.bubble && !n.anim) {
      n.nextIdle = t + 22 + Math.random() * 26;
      const idle = IDLES[n.id];
      if (idle) { say(n, idle.bubble, 2.2, 'thought'); if (idle.anim === 'flash') G.flash(n); G.onIdle(n); }
    }
    // ---- whispering what they know (overheard if you are close) ----
    const fact = G.cs.facts[n.id];
    if (fact && !n.def.dog && t >= n.nextWhisper && !n.bubble && !n.anim && !(L.quiet(t) && L.mode !== 'elevator') && !G.know.facts[n.id]) {
      const buddy = nearestOther(n, G);
      if (buddy && U.dist(buddy, n) < 170) {
        n.nextWhisper = t + 24 + Math.random() * 14;
        const close = U.dist(G.player, n) < OVERHEAR_RANGE;
        say(n, close ? `(whispering) ${fact.text}` : '*whisper whisper*', 4.5, 'whisper');
        n.face = Math.atan2(buddy.y - n.y, buddy.x - n.x);
        if (fact.about) suspect(buddy, fact.about, 10);
        if (close) G.onOverhear(n, fact);
      } else n.nextWhisper = t + 6;
    }

    // ---- confronting the player ----
    if (!n.def.dog && L.mode !== 'elevator' && n.sus >= 72 && !n.confronted && !ceremony && G.state === 'play' && !G.anyConfronting() && t >= (G.nextConfrontT || 0)) {
      n.confronted = true; n.confronting = true; G.nextConfrontT = t + 45;
    }
    if (!n.def.dog && L.mode === 'elevator' && n.sus >= 72 && !n.confronted && G.state === 'play' && t >= (G.nextConfrontT || 0) && U.dist(n, G.player) < 160) {
      n.confronted = true; G.nextConfrontT = t + 40; G.startConfront(n);
    }
    n.sus = Math.max(0, n.sus - dt * 0.15);
  }

  function nearestOther(n, G) {
    let best = null, bd = 180;
    for (const o of G.npcs) if (o !== n && o.present && !o.def.dog) { const d = U.dist(o, n); if (d < bd) { bd = d; best = o; } }
    return best;
  }

  return { create, update, sees, say, suspect, range, VIEW_RANGE, VIEW_HALF };
})();
