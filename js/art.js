'use strict';
// Construction-paper art. Every shape is a slightly wonky polygon with a drop shadow,
// characters are flat cutouts that hop between poses at 8 frames per second.
const Art = (() => {
  const INK = '#1c1a1f';

  // Deterministic wobble so paper edges don't shimmer frame to frame.
  function wob(seed) {
    let s = seed * 9301 + 49297;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
  }
  function jagPoly(ctx, pts, amp, seed) {
    const r = wob(seed);
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + r() * amp, jy = y + r() * amp;
      i ? ctx.lineTo(jx, jy) : ctx.moveTo(jx, jy);
    });
    ctx.closePath();
  }
  function rectPts(x, y, w, h, step = 40) {
    const pts = [];
    for (let i = 0; i < w; i += step) pts.push([x + i, y]);
    for (let i = 0; i < h; i += step) pts.push([x + w, y + i]);
    for (let i = w; i > 0; i -= step) pts.push([x + i, y + h]);
    for (let i = h; i > 0; i -= step) pts.push([x, y + i]);
    return pts;
  }
  function paper(ctx, pts, fill, seed, { amp = 2.2, stroke = null, lw = 2, shadow = true } = {}) {
    ctx.save();
    if (shadow) { ctx.shadowColor = 'rgba(30,20,10,0.28)'; ctx.shadowOffsetX = 1.5; ctx.shadowOffsetY = 2.5; }
    jagPoly(ctx, pts, amp, seed);
    ctx.fillStyle = fill; ctx.fill();
    ctx.restore();
    if (stroke) { jagPoly(ctx, pts, amp, seed); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  const paperRect = (ctx, x, y, w, h, fill, seed, o) => paper(ctx, rectPts(x, y, w, h, Math.max(18, Math.min(w, h) / 2)), fill, seed, o);
  function ellipsePts(cx, cy, rx, ry, n = 18) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return pts;
  }
  const paperEllipse = (ctx, cx, cy, rx, ry, fill, seed, o) => paper(ctx, ellipsePts(cx, cy, rx, ry), fill, seed, o);

  // Paper grain overlay, generated once.
  let grain = null;
  function grainPattern(ctx) {
    if (grain) return grain;
    const g = document.createElement('canvas'); g.width = g.height = 160;
    const gc = g.getContext('2d'), id = gc.createImageData(160, 160);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 90;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
    }
    gc.putImageData(id, 0, 0);
    for (let i = 0; i < 40; i++) {
      gc.strokeStyle = `rgba(${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},0.08)`;
      gc.beginPath(); const x = Math.random() * 160, y = Math.random() * 160;
      gc.moveTo(x, y); gc.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30); gc.stroke();
    }
    grain = ctx.createPattern(g, 'repeat');
    return grain;
  }

  // The level paints its own room; we add the paper grain on top.
  function buildBackground(level, pxPerUnit) {
    const v = level.view;
    const cv = document.createElement('canvas');
    cv.width = Math.round(v.w * pxPerUnit); cv.height = Math.round(v.h * pxPerUnit);
    const ctx = cv.getContext('2d');
    ctx.scale(pxPerUnit, pxPerUnit); ctx.translate(-v.x, -v.y);
    level.buildBackground(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.18; ctx.fillStyle = grainPattern(ctx); ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    return cv;
  }

  // Zone names painted on the floor, under the people standing there (world space, scaled to stay readable).
  // Zone names painted on the floor. Each takes the first corner of its zone that furniture does not cover,
  // and fades almost away while someone stands on it, so a name never peeks out from behind a person.
  const decalFade = {};
  function drawZoneDecals(ctx, zoom, people = [], furniture = []) {
    ctx.save();
    const fs = 10 / zoom * (zoom > 1.5 ? 1.25 : 1);
    ctx.font = `700 ${fs}px "Lexend", sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (const z of ZONES) {
      const label = z.name.toUpperCase(), w = ctx.measureText(label).width + fs * 1.2, h = fs * 1.7, m = fs * 0.4;
      const corners = [[z.x + m, z.y + z.h - h - m], [z.x + m, z.y + m], [z.x + z.w - w - m, z.y + z.h - h - m], [z.x + z.w - w - m, z.y + m]];
      const [x, y] = corners.find(([cx, cy]) => !furniture.some((f) => hit({ x: cx, y: cy, w, h }, f))) || corners[0];
      const r = { x, y, w, h };
      const covered = people.some((p) => hit(r, { x: p.x - 24, y: p.y - 100, w: 48, h: 108 }));
      const k = z.id + L.id, target = covered ? 0.08 : 0.5;
      decalFade[k] = decalFade[k] === undefined ? target : decalFade[k] + (target - decalFade[k]) * 0.12;
      ctx.globalAlpha = decalFade[k];
      paperRect(ctx, x, y, w, h, '#f3ead6', z.x + z.y, { amp: fs * 0.08, shadow: false });
      ctx.fillStyle = INK; ctx.fillText(label, x + fs * 0.6, y + h / 2 + fs * 0.05);
    }
    ctx.restore();
  }

  // Zone labels are drawn at screen scale so they stay readable whatever the camera zoom is.
  function drawZoneTags(ctx, strong, toScreen, place = null) {
    ctx.save();
    ctx.font = '700 11px "Lexend", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const z of ZONES) {
      const a = toScreen(z.x, z.y), b = toScreen(z.x + z.w, z.y + z.h);
      const w = ctx.measureText(z.name.toUpperCase()).width + 14;
      const at = place ? place({ x: a.x + 6, y: a.y + 3, w, h: 18 }) : { x: a.x + 6, y: a.y + 3 };
      const x = at.x, y = at.y + 9;
      ctx.globalAlpha = strong ? 0.95 : 0.5;
      paperRect(ctx, x, y - 9, w, 18, strong ? '#fff3b0' : '#f3ead6', z.x + z.y, { amp: 1, shadow: false });
      ctx.fillStyle = INK; ctx.fillText(z.name.toUpperCase(), x + 7, y + 0.5);
      if (strong) { ctx.strokeStyle = 'rgba(255,240,170,0.55)'; ctx.setLineDash([6, 6]); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.setLineDash([]); }
    }
    ctx.restore();
  }

  // An eye with a count (kept for the playtest overlay; the HUD shows the player's own watchers).
  function eyeIndicator(ctx, x, y, count, t) {
    const seen = count > 0;
    ctx.save(); ctx.translate(x, y);
    const pulse = seen ? 1 + Math.sin(t * 10) * 0.05 : 1;
    ctx.scale(pulse, pulse);
    paperRect(ctx, -34, -14, 68, 28, seen ? '#ffe2d6' : '#eef4e4', 51, { amp: 0.8, stroke: INK, lw: 1.5 });
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(-15, -11, -4, 0); ctx.quadraticCurveTo(-15, 11, -26, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = seen ? '#d9434f' : '#6b8f3a'; ctx.beginPath(); ctx.arc(-15, 0, 3.6, 0, Math.PI * 2); ctx.fill();
    if (!seen) { ctx.strokeStyle = '#6b8f3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-26, 8); ctx.lineTo(-4, -8); ctx.stroke(); }
    ctx.fillStyle = INK; ctx.font = '400 14px "Bowlby One SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(seen ? String(count) : '0', 12, 1);
    ctx.restore();
  }

  // Reaction order: 1, 2, 3... pops up over heads as people smell it.
  function badge(ctx, x, y, n, age) {
    const pop = Math.min(1, age * 4), s = 0.6 + pop * 0.4 + Math.max(0, 0.25 - age) * 1.2;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    paperEllipse(ctx, 0, 0, 14, 14, n === 1 ? '#f2c14e' : '#fffdf6', 60 + n, { amp: 0.8, stroke: INK, lw: 2 });
    ctx.fillStyle = INK; ctx.font = '400 15px "Bowlby One SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 0, 1);
    ctx.restore();
  }

  // Hold-to-search progress ring.
  function holdRing(ctx, x, y, k) {
    ctx.save();
    ctx.strokeStyle = 'rgba(28,26,31,0.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, 22, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawItem(ctx, item, x, y, glow, seen) {
    const s = item.label.length * 13, c = item.color;
    if (glow) { ctx.save(); ctx.fillStyle = 'rgba(255,240,120,0.35)'; ctx.beginPath(); ctx.ellipse(x, y - 6, 30, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    switch (item.kind) {
      case 'handbag':
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 16, 8, Math.PI, 0); ctx.stroke();
        paper(ctx, [[x - 14, y - 16], [x + 14, y - 16], [x + 17, y], [x - 17, y]], c, s, { stroke: INK, lw: 1.5 }); break;
      case 'tote':
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 8, y - 22); ctx.lineTo(x - 6, y - 32); ctx.lineTo(x + 6, y - 32); ctx.lineTo(x + 8, y - 22); ctx.stroke();
        paper(ctx, [[x - 15, y - 22], [x + 15, y - 22], [x + 13, y], [x - 13, y]], c, s, { stroke: INK, lw: 1.5 }); break;
      case 'backpack':
        paperRect(ctx, x - 12, y - 24, 24, 24, c, s, { stroke: INK, lw: 1.5 });
        paperRect(ctx, x - 8, y - 12, 16, 9, '#f2c14e', s + 1, { amp: 1 }); break;
      case 'satchel': case 'briefcase':
        paperRect(ctx, x - 16, y - 18, 32, 18, c, s, { stroke: INK, lw: 1.5 });
        if (item.kind === 'briefcase') { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x - 5, y - 23, 10, 5); paperRect(ctx, x - 2, y - 11, 4, 4, '#f2c14e', s + 5, { amp: 0.2, shadow: false }); }
        else paper(ctx, [[x - 16, y - 18], [x + 16, y - 18], [x + 12, y - 8], [x - 12, y - 8]], 'rgba(0,0,0,0.25)', s + 2, { shadow: false });
        break;
      case 'gymbag':
        paperEllipse(ctx, x, y - 10, 22, 10, c, s, { stroke: INK, lw: 1.5 });
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 18, y - 10); ctx.lineTo(x + 18, y - 10); ctx.stroke(); break;
      case 'pizzabag':
        paperRect(ctx, x - 20, y - 16, 40, 16, c, s, { stroke: INK, lw: 1.5 });
        ctx.fillStyle = '#fff'; ctx.font = '700 7px "Lexend", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('HOT', x, y - 5); break;
      case 'basket':
        paperRect(ctx, x - 14, y - 12, 28, 12, '#c9a46a', s, { stroke: INK, lw: 1.5 });
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; for (let i = -10; i <= 10; i += 5) { ctx.beginPath(); ctx.moveTo(x + i, y - 12); ctx.lineTo(x + i, y); ctx.stroke(); } break;
      case 'cooler':
        paperRect(ctx, x - 20, y - 24, 40, 24, c, s, { stroke: INK, lw: 1.5 });
        paperRect(ctx, x - 20, y - 26, 40, 8, '#d0393b', s + 1, { amp: 1 }); break;
      case 'clutch':
        paper(ctx, [[x - 12, y - 10], [x + 12, y - 10], [x + 12, y], [x - 12, y]], c, s, { stroke: INK, lw: 1.5 });
        paperEllipse(ctx, x, y - 6, 3, 3, '#f2c14e', s + 3, { shadow: false }); break;
      case 'jacket':
        paper(ctx, [[x - 18, y - 22], [x + 18, y - 22], [x + 14, y], [x - 14, y]], c, s, { stroke: '#555', lw: 1.5 });
        paper(ctx, [[x - 4, y - 22], [x + 4, y - 22], [x, y - 10]], '#f6f6f6', s + 4, { shadow: false }); break;
      case 'dogbed':
        paperEllipse(ctx, x, y - 6, 26, 10, c, s, { stroke: INK, lw: 1.5 });
        paperEllipse(ctx, x, y - 6, 18, 6, '#f1d9b5', s + 1, { shadow: false }); break;
      case 'camera':
        break;
    }
    if (glow && !seen) {
      ctx.fillStyle = INK; ctx.font = '800 16px "Bowlby One SC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', x, y - 32);
    }
  }

  // ---------- characters ----------
  // Construction: shoes, trousers or a skirt, a torso dressed by `look.outfit`, arms as sleeves ending in mitten hands,
  // a held prop, then the head. Faces are drawn so that nothing leaks: eyelids are clipped inside the eyes, tints are
  // clipped to the face, eyebrows sit just above the eyes. Everything breathes a little.
  // opts: { t, walking, faceDir (-1/1), lookX, lookY, back, expr, talking, anim, animT, blinkSeed, sweat }
  // expr: neutral | happy | disgust | shock | sus | angry | worried
  const HOLDS = ['phone', 'camera', 'coffee', 'pizza', 'shaker', 'bouquet'];
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  };
  function limb(ctx, x0, y0, x1, y1, color, w = 7) {
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = w + 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.restore();
  }

  function drawPerson(ctx, look, x, y, o) {
    const s = look.scale || 1;
    const step = Math.floor(o.t * 8);
    const bob = o.walking ? (step % 2) * -3 : 0;
    const tilt = o.walking ? (step % 2 ? 0.05 : -0.05) : (o.expr === 'shock' ? Math.sin(o.t * 40) * 0.02 : 0);
    const seed = (look.body.charCodeAt(1) || 7) * 31 + (look.hair || '').length;
    const breath = o.walking ? 0 : Math.sin(o.t * 2.2 + seed) * 0.7;
    const outfit = look.dress ? 'gown' : (look.outfit || 'tee');
    const hold = look.hold || (HOLDS.includes(look.acc) ? look.acc : null);
    const long = ['gown', 'cassock', 'dress'].includes(outfit) || look.skirt;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(25,15,5,0.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 19 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, bob); ctx.rotate(tilt);
    if (o.faceDir < 0) ctx.scale(-1, 1);
    ctx.scale(s, s);

    // ---- lower body ----
    const shoes = look.shoes || INK, pants = look.pants || shade(look.body, -0.35);
    const step2 = o.walking ? (step % 2 ? 2 : -2) : 0;
    if (long) {
      const len = outfit === 'dress' ? -12 : -3, col = outfit === 'gown' ? '#ffffff' : look.skirt ? pants : look.body;
      if (outfit === 'dress') { limb(ctx, -6, -12, -6, -4, look.skin, 5); limb(ctx, 6, -12, 6, -4, look.skin, 5); }
      paperEllipse(ctx, -7 + step2, -3, 6.5, 3.8, shoes, seed + 1, { shadow: false, amp: 0.6 });
      paperEllipse(ctx, 7 - step2, -3, 6.5, 3.8, shoes, seed + 2, { shadow: false, amp: 0.6 });
      const flare = outfit === 'gown' ? 34 : outfit === 'dress' ? 22 : 21;
      paper(ctx, [[-15, -26], [15, -26], [flare, len], [-flare, len]], col, seed + 3, { stroke: INK, lw: 2, amp: 1.2 });
      if (outfit === 'gown') for (let i = -2; i <= 2; i++) { ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(i * 5, -24); ctx.lineTo(i * 12, -4); ctx.stroke(); }
    } else {
      const shorts = look.shorts;
      for (const side of [-1, 1]) {
        const lx = side * 7 + (side < 0 ? step2 : -step2);
        paper(ctx, [[lx - 6, -16], [lx + 6, -16], [lx + 5.5, shorts ? -10 : -5], [lx - 5.5, shorts ? -10 : -5]], pants, seed + 4 + side, { stroke: INK, lw: 1.5, amp: 0.6 });
        if (shorts) limb(ctx, lx, -10, lx, -5, look.skin, 6);
        paperEllipse(ctx, lx + side * 1.5, -3, 7, 3.8, shoes, seed + 6 + side, { shadow: false, amp: 0.6 });
      }
    }

    ctx.translate(0, breath * 0.4);
    // ---- arms (behind the torso when they hang at the sides) ----
    const a = o.anim, at = o.animT || 0;
    let Lh = [-21, -19], R = [21, -19];
    if (a === 'fan') R = [27, -12 + Math.sin(at * 22) * 9];
    else if (a === 'spray') R = [22, -52];
    else if (a === 'point') R = [34, -33];
    else if (a === 'arms') { Lh = [-27, -54 + Math.sin(at * 10) * 3]; R = [27, -54 - Math.sin(at * 10) * 3]; }
    else if (a === 'cough') R = [6, -50];
    else if (hold === 'phone') R = [13, -33];
    else if (hold === 'bouquet') { Lh = [-7, -24]; R = [7, -24]; }
    else if (hold === 'coffee' || hold === 'pizza') { Lh = [-15, -23]; R = [15, -23]; }
    else if (hold === 'shaker') R = [22, -21];
    else if (hold === 'camera') { Lh = [-9, -27]; R = [9, -27]; }
    const sleeve = outfit === 'tank' ? look.skin : outfit === 'hawaiian' || outfit === 'tee' ? look.skin : look.body;
    const sleeveTop = outfit === 'hawaiian' || outfit === 'tee' ? look.body : sleeve;
    const arm = (sx, h) => {
      limb(ctx, sx, -38, h[0], h[1], sleeve, 7);
      if (sleeveTop !== sleeve) { const mx = sx + (h[0] - sx) * 0.42, my = -38 + (h[1] + 38) * 0.42; limb(ctx, sx, -38, mx, my, sleeveTop, 8); }
    };
    if (!o.back) { arm(-13, Lh); arm(13, R); }

    // ---- torso ----
    const top = -43, bot = long ? -24 : -14;
    paper(ctx, [[-15, top], [15, top], [18, bot], [-18, bot]], outfit === 'gown' ? '#ffffff' : look.body, seed + 9, { stroke: INK, lw: 2, amp: 1.2 });
    if (!o.back) drawOutfit(ctx, look, outfit, top, bot, seed);
    else if (look.hairStyle === 'long' || look.hairStyle === 'veil') { /* hair covers the back, drawn with the head */ }

    if (!o.back) {
      // hands
      const hand = (h) => paperEllipse(ctx, h[0], h[1], 5.5, 5.5, look.skin, seed + 20 + Math.round(h[0]), { stroke: INK, lw: 1.5, amp: 0.6 });
      drawHold(ctx, look, hold, a, at, seed, 'under', o.faceDir);
      hand(Lh); hand(R);
      drawHold(ctx, look, hold, a, at, seed, 'over', o.faceDir);
    } else {
      // from behind: arms hang at the sides
      limb(ctx, -14, -38, -20, -19, look.body, 7); limb(ctx, 14, -38, 20, -19, look.body, 7);
    }

    // ---- head ----
    ctx.translate(0, breath * 0.6);
    const hy = -64;
    if (!o.back) drawHairBack(ctx, look, seed);
    paperEllipse(ctx, 0, hy, 24, 21, o.back ? (['bald', 'buzz'].includes(look.hairStyle) ? look.skin : look.hair) : look.skin, seed + 50, { stroke: INK, lw: 2, amp: 1.2 });
    if (o.back) { drawHairBackView(ctx, look, seed); ctx.restore(); return; }
    drawFace(ctx, look, hy, o, seed);
    drawHairFront(ctx, look, seed, hy);
    drawBrows(ctx, look, hy, o);
    if (o.sweat) {
      for (const [sx, ph] of [[-20, 0], [19, 0.5]]) {
        const k = ((o.t * 0.9 + ph) % 1), yy = hy - 6 + k * 16;
        ctx.save(); ctx.globalAlpha = 1 - k * 0.6; ctx.fillStyle = '#7cc4f2'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(sx, yy - 6); ctx.quadraticCurveTo(sx + 4, yy, sx, yy + 3); ctx.quadraticCurveTo(sx - 4, yy, sx, yy - 6); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    ctx.restore();
  }

  // Clothes are flat shapes on the torso: lapels, buttons, collars, prints.
  function drawOutfit(ctx, look, outfit, top, bot, seed) {
    const inner = look.inner || '#f4f4f4', dark = shade(look.body, -0.3);
    switch (outfit) {
      case 'suit': case 'tux': case 'blazer':
        paper(ctx, [[-6, top], [6, top], [0, top + 16]], inner, seed + 30, { shadow: false, amp: 0.4 });
        paper(ctx, [[-15, top], [-6, top], [0, top + 18], [-4, top + 22]], dark, seed + 31, { shadow: false, amp: 0.4 });
        paper(ctx, [[15, top], [6, top], [0, top + 18], [4, top + 22]], dark, seed + 32, { shadow: false, amp: 0.4 });
        for (const by of [top + 21, top + 26]) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(1.5, by, 1.1, 0, Math.PI * 2); ctx.fill(); }
        break;
      case 'cardigan':
        paper(ctx, [[-4, top], [4, top], [3, bot], [-3, bot]], inner, seed + 33, { shadow: false, amp: 0.4 });
        for (let i = 0; i < 3; i++) { ctx.fillStyle = shade(look.body, -0.45); ctx.beginPath(); ctx.arc(-5.5, top + 7 + i * 8, 1.2, 0, Math.PI * 2); ctx.fill(); }
        break;
      case 'vest':
        paper(ctx, [[-5, top], [5, top], [3, bot], [-3, bot]], inner, seed + 34, { shadow: false, amp: 0.4 });
        for (const px of [-11, 5]) paperRect(ctx, px, top + 14, 7, 6, dark, seed + 35 + px, { amp: 0.3, shadow: false });
        break;
      case 'hawaiian':
        for (let i = 0; i < 7; i++) paperEllipse(ctx, -10 + (i % 3) * 10, top + 7 + Math.floor(i / 3) * 9, 3, 3, i % 2 ? '#ffe066' : '#5ec26a', seed + 36 + i, { shadow: false, amp: 0.8 });
        paper(ctx, [[-6, top], [0, top + 8], [6, top]], look.skin, seed + 44, { shadow: false, amp: 0.3 });
        break;
      case 'tank':
        paper(ctx, [[-15, top], [-8, top], [-11, top + 18], [-17, top + 20]], look.skin, seed + 45, { shadow: false, amp: 0.6 });
        paper(ctx, [[15, top], [8, top], [11, top + 18], [17, top + 20]], look.skin, seed + 46, { shadow: false, amp: 0.6 });
        break;
      case 'hoodie':
        paper(ctx, [[-10, top], [10, top], [6, top + 6], [-6, top + 6]], dark, seed + 47, { shadow: false, amp: 0.4 });
        paperRect(ctx, -9, bot - 11, 18, 7, dark, seed + 48, { amp: 0.4, shadow: false });
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-3, top + 6); ctx.lineTo(-3, top + 13); ctx.moveTo(3, top + 6); ctx.lineTo(3, top + 13); ctx.stroke();
        break;
      case 'cassock':
        for (let i = 0; i < 4; i++) { ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(0, top + 8 + i * 6, 1, 0, Math.PI * 2); ctx.fill(); }
        break;
      case 'shirt':
        paper(ctx, [[-6, top], [0, top + 6], [6, top]], '#fff', seed + 49, { shadow: false, amp: 0.3 });
        break;
      case 'dress':
        paper(ctx, [[-15, bot - 4], [15, bot - 4], [15, bot], [-15, bot]], dark, seed + 50, { shadow: false, amp: 0.3 });
        break;
    }
    if (look.shirt === 'lanyard') { ctx.strokeStyle = '#2f62b8'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-7, top + 1); ctx.lineTo(0, top + 16); ctx.lineTo(7, top + 1); ctx.stroke(); paperRect(ctx, -5, top + 15, 10, 11, '#fff', seed + 51, { amp: 0.3, shadow: false }); }
    const acc = look.acc;
    if (acc === 'tie') paper(ctx, [[-2.5, top + 2], [2.5, top + 2], [4, top + 20], [0, top + 25], [-4, top + 20]], look.tieColor || '#a51f2d', seed + 52, { shadow: false, amp: 0.3 });
    if (acc === 'bowtie') paper(ctx, [[-8, top - 1], [0, top + 3], [8, top - 1], [8, top + 7], [0, top + 3], [-8, top + 7]], '#c0392b', seed + 53, { amp: 0.4, shadow: false });
    if (acc === 'collar') paperRect(ctx, -4, top - 1, 8, 6, '#ffffff', seed + 54, { amp: 0.3, shadow: false });
    if (acc === 'pearls') for (let i = 0; i < 7; i++) { ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(-9 + i * 3, top + 2 + Math.sin(i / 6 * Math.PI) * 3, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }

  // Held props, split so hands can sit on top of trays and around bottles.
  function drawHold(ctx, look, hold, a, at, seed, layer, faceDir = 1) {
    if (a === 'spray' && layer === 'over') {
      paperRect(ctx, 18, -68, 8, 14, '#c86dd7', seed + 60, { amp: 0.6 });
      for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(230,180,255,0.6)'; ctx.beginPath(); ctx.arc(30 + i * 5 + Math.sin(at * 9 + i) * 3, -64 + Math.cos(at * 7 + i) * 6, 3 + i * 0.6, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    if (a && ['fan', 'point', 'arms', 'cough'].includes(a) && ['coffee', 'pizza', 'bouquet'].includes(hold)) return; // put it down while gesturing
    if (layer === 'under') {
      if (hold === 'camera') { ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-9, -42); ctx.lineTo(-6, -33); ctx.moveTo(9, -42); ctx.lineTo(6, -33); ctx.stroke(); paperRect(ctx, -11, -36, 22, 14, '#2b2b2b', seed + 61, { amp: 0.6 }); paperEllipse(ctx, 0, -29, 5, 5, '#8fb6d9', seed + 62, { shadow: false, amp: 0.4, stroke: INK, lw: 1 }); }
      if (hold === 'shaker') { paperRect(ctx, 17, -34, 10, 20, '#2b2b2b', seed + 63, { amp: 0.4, stroke: INK, lw: 1 }); paperRect(ctx, 17, -36, 10, 4, '#e74c3c', seed + 64, { amp: 0.2, shadow: false }); }
      if (hold === 'phone' && !a) paperRect(ctx, 8, -46, 10, 16, '#222', seed + 65, { amp: 0.5 });
      return;
    }
    if (hold === 'coffee') { paperRect(ctx, -20, -26, 40, 5, '#8a6a42', seed + 66, { amp: 0.4, stroke: INK, lw: 1 }); for (let i = 0; i < 4; i++) paperRect(ctx, -17 + i * 9, -37, 7, 11, i % 2 ? '#fff' : '#f3e2c4', seed + 67 + i, { amp: 0.3, shadow: false, stroke: INK, lw: 0.8 }); }
    if (hold === 'pizza') { paperRect(ctx, -22, -30, 44, 8, '#d8b07a', seed + 71, { amp: 0.4, stroke: INK, lw: 1 }); ctx.save(); if (faceDir < 0) ctx.scale(-1, 1); ctx.fillStyle = '#b03a2e'; ctx.font = '700 5px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PIZZA', 0, -24.5); ctx.restore(); } // text never mirrors
    if (hold === 'bouquet') for (let i = 0; i < 5; i++) paperEllipse(ctx, -8 + i * 4, -30 - (i % 2) * 5, 5, 5, i % 2 ? '#f6b6cf' : '#fff', seed + 72 + i, { amp: 1 });
  }

  // Eyes: white ellipses; lids are painted *inside* the eye (clipped), so nothing spills onto hair or glasses.
  // Glasses wearers get slightly smaller, wider-set eyes so each sits inside its own lens and the lenses never cross.
  const eyeSpot = (look) => (look.acc === 'glasses' ? { ex: 8.8, rx: 5.8, ry: 7.2 } : { ex: 6.8, rx: 7, ry: 8.5 });
  function drawFace(ctx, look, hy, o, seed) {
    const e = o.expr || 'neutral', f = look.features || [];
    const disgust = e === 'disgust', sus = e === 'sus', shock = e === 'shock', angry = e === 'angry', worried = e === 'worried';
    const faceClip = () => { ctx.beginPath(); ctx.ellipse(0, hy, 23, 20, 0, 0, Math.PI * 2); ctx.clip(); };
    // cheeks, stubble, freckles, wrinkles: all clipped to the face
    ctx.save(); faceClip();
    if (f.includes('blush')) { ctx.fillStyle = 'rgba(240,120,130,0.35)'; for (const cx of [-14, 14]) { ctx.beginPath(); ctx.ellipse(cx, hy + 6, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); } }
    if (f.includes('stubble')) { ctx.fillStyle = 'rgba(40,30,30,0.35)'; for (let i = 0; i < 26; i++) { const px = -14 + (i * 37 % 28), py = hy + 6 + (i * 13 % 11); ctx.fillRect(px, py, 1.2, 1.2); } }
    if (f.includes('freckles')) { ctx.fillStyle = 'rgba(150,80,40,0.55)'; for (const [px, py] of [[-14, 5], [-11, 7], [-15, 8], [11, 5], [14, 7], [12, 8]]) { ctx.beginPath(); ctx.arc(px, hy + py, 0.9, 0, Math.PI * 2); ctx.fill(); } }
    if (disgust) { ctx.fillStyle = 'rgba(120,190,60,0.45)'; ctx.fillRect(-25, hy - 22, 50, 44); }
    if (angry) { ctx.fillStyle = 'rgba(220,60,50,0.25)'; ctx.fillRect(-25, hy - 22, 50, 44); }
    ctx.restore();
    const lx = U.clamp(o.lookX || 0, -1, 1) * 2.4, ly = U.clamp(o.lookY || 0, -1, 1) * 2;
    const blink = !disgust && !shock && ((o.t * 1000 + (o.blinkSeed || seed) * 397) % 3700) < 130;
    const { ex: eyeX, rx, ry } = eyeSpot(look), ey = hy - 3, specs = look.acc === 'glasses';
    for (const ex of look.acc === 'shades' || look.acc === 'sleepmask' ? [] : [-eyeX, eyeX]) { // sunglasses and eye masks hide the eyes completely
      const side = ex < 0 ? -1 : 1;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      if (disgust || blink) {
        // closed or screwed-up eyes: a curved line, no white
        ctx.beginPath();
        if (disgust) { const inward = -side; ctx.moveTo(ex - 5 * inward, ey - 4); ctx.lineTo(ex + 4 * inward, ey); ctx.lineTo(ex - 5 * inward, ey + 4); } // squeezed shut: > <
        else { ctx.moveTo(ex - 6, ey + 1); ctx.quadraticCurveTo(ex, ey + 4, ex + 6, ey + 1); }
        ctx.lineWidth = 2; ctx.stroke();
        continue;
      }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + lx, ey + 1 + ly, shock ? 1.4 : 2.4, 0, Math.PI * 2); ctx.fill();
      // eyelids, inside the eye only
      ctx.fillStyle = look.skin;
      let lid = null;
      if (sus) lid = [[ex - rx, ey - ry], [ex + rx, ey - ry], [ex + rx, ey - 1], [ex - rx, ey - 1]];
      else if (angry) lid = [[ex - rx, ey - ry], [ex + rx, ey - ry], [ex + rx * side, ey - ry + 1], [ex - rx * side, ey - 2]];
      else if (worried) lid = [[ex - rx, ey - ry], [ex + rx, ey - ry], [ex - rx * side, ey - ry + 2], [ex + rx * side, ey - 3]];
      else if (f.includes('bags') || f.includes('tired')) lid = [[ex - rx, ey - ry], [ex + rx, ey - ry], [ex + rx, ey - 4], [ex - rx, ey - 4]];
      if (lid) { ctx.beginPath(); lid.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(lid[3][0], lid[3][1]); ctx.lineTo(lid[2][0], lid[2][1]); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      if (f.includes('lashes')) { ctx.lineWidth = 1.3; for (let k = 0; k < 2; k++) { const ang = -Math.PI / 2 + side * (0.7 + k * 0.35); ctx.beginPath(); ctx.moveTo(ex + Math.cos(ang) * rx, ey + Math.sin(ang) * ry); ctx.lineTo(ex + Math.cos(ang) * (rx + 3), ey + Math.sin(ang) * (ry + 3)); ctx.stroke(); } }
      if (f.includes('bags')) { ctx.strokeStyle = 'rgba(80,50,90,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(ex, ey + 6, 5, 0.3, Math.PI - 0.3); ctx.stroke(); }
      if (f.includes('wrinkles')) { ctx.strokeStyle = 'rgba(60,40,30,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); const wx = side * (specs ? 17.6 : 14.8); ctx.moveTo(wx, ey - 1); ctx.lineTo(wx + side * 3, ey - 3); ctx.moveTo(wx, ey + 2); ctx.lineTo(wx + side * 3, ey + 3); ctx.stroke(); }
    }
    if (specs) {
      // two separate lenses with a gap, a bridge between them and arms out to the ears
      const hw = 7.4, hh = 8.4, lens = (cx) => { ctx.beginPath(); ctx.roundRect(cx - hw, ey - hh, hw * 2, hh * 2, 4.5); };
      for (const ex of [-eyeX, eyeX]) {
        lens(ex); ctx.fillStyle = 'rgba(190,225,255,0.18)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ex + 2, ey - hh + 2.4); ctx.lineTo(ex + 4.6, ey - hh + 2.4); ctx.stroke();
        lens(ex); ctx.strokeStyle = INK; ctx.lineWidth = 1.7; ctx.stroke();
      }
      const inner = eyeX - hw, outer = eyeX + hw;
      ctx.beginPath(); ctx.moveTo(-inner, ey - 2); ctx.quadraticCurveTo(0, ey - 4.5, inner, ey - 2);
      ctx.moveTo(-outer, ey - 3); ctx.lineTo(-22, ey - 4); ctx.moveTo(outer, ey - 3); ctx.lineTo(22, ey - 4); ctx.stroke();
    }
    if (look.acc === 'sleepmask') {
      // a padded travel mask with sleepy eyes stitched on, and the strap round the head
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-23, ey - 4); ctx.lineTo(23, ey - 4); ctx.stroke();
      ctx.fillStyle = '#9fc6e8'; ctx.beginPath(); ctx.roundRect(-18, ey - 8, 36, 12, 6); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1.3;
      for (const ex of [-8.4, 8.4]) { ctx.beginPath(); ctx.moveTo(ex - 5, ey - 2.5); ctx.quadraticCurveTo(ex, ey + 1.5, ex + 5, ey - 2.5); ctx.stroke(); }
    }
    if (look.acc === 'shades') {
      // two dark lenses on a straight top bar, with a glint
      ctx.fillStyle = '#141418'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      for (const ex of [-8.4, 8.4]) { ctx.beginPath(); ctx.roundRect(ex - 8, ey - 6, 16, 11, [2, 2, 6, 6]); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-17, ey - 6); ctx.lineTo(17, ey - 6); ctx.moveTo(-16.4, ey - 4); ctx.lineTo(-22, ey - 5); ctx.moveTo(16.4, ey - 4); ctx.lineTo(22, ey - 5); ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.3;
      for (const ex of [-8.4, 8.4]) { ctx.beginPath(); ctx.moveTo(ex - 4.5, ey - 3); ctx.lineTo(ex - 1.5, ey - 3); ctx.stroke(); }
    }
    if (f.includes('earrings')) for (const sx of [-23, 23]) { ctx.fillStyle = '#f2c14e'; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, hy + 7, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    // mouth: talking cycles through three cutout mouth shapes
    ctx.strokeStyle = INK; ctx.fillStyle = '#5a1d1d'; ctx.lineWidth = 2;
    const my = hy + 12;
    if (f.includes('mustache')) paper(ctx, [[-9, my - 3], [0, my - 6], [9, my - 3], [7, my - 1], [0, my - 3], [-7, my - 1]], look.hair === '#c0392b' ? '#3a2416' : look.hair, seed + 61, { shadow: false, amp: 0.4, stroke: INK, lw: 1 });
    const shape = o.talking ? Math.floor(o.t * 11 + seed) % 3 : -1;
    if (shock || shape === 2) { ctx.beginPath(); ctx.ellipse(0, my, shock ? 4 : 5.5, shock ? 5.5 : 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    else if (shape === 1) { ctx.beginPath(); ctx.ellipse(0, my, 4.5, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    else if (disgust) { ctx.beginPath(); ctx.moveTo(-7, my); for (let i = 1; i <= 4; i++) ctx.lineTo(-7 + i * 3.5, my + (i % 2 ? -2.5 : 2.5)); ctx.stroke(); }
    else if (e === 'happy') { ctx.beginPath(); ctx.arc(0, my - 3, 5, 0.2, Math.PI - 0.2); ctx.stroke(); }
    else if (angry) { ctx.beginPath(); ctx.arc(0, my + 4, 5, Math.PI + 0.3, -0.3); ctx.stroke(); }
    else if (worried) { ctx.beginPath(); ctx.moveTo(-5, my + 1); ctx.quadraticCurveTo(-2, my - 2, 0, my + 1); ctx.quadraticCurveTo(2, my + 3, 5, my); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-4, my); ctx.lineTo(4, my); ctx.stroke(); }
  }

  // Eyebrows sit just above the eye (and above glasses), drawn last so expressions always read.
  function drawBrows(ctx, look, hy, o) {
    const e = o.expr || 'neutral', f = look.features || [], bushy = f.includes('bushybrows');
    if (e === 'neutral' && !bushy) return;
    if (e === 'disgust') return;
    const { ex: eyeX, ry } = eyeSpot(look), by = look.acc === 'shades' || look.acc === 'sleepmask' ? hy - 3 - 9.5 : hy - 3 - ry - (look.acc === 'glasses' ? 6 : 2.5); // clear of the frames even when tilted
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = bushy ? (look.hair || INK) : INK; ctx.lineWidth = bushy ? 3.6 : 2.4;
    if (bushy) { ctx.shadowColor = INK; ctx.shadowBlur = 0; }
    for (const ex of [-eyeX, eyeX]) {
      const side = ex < 0 ? -1 : 1;
      ctx.beginPath();
      if (e === 'angry') { ctx.moveTo(ex - 5 * side, by - 2); ctx.lineTo(ex + 5 * side, by + 2); }
      else if (e === 'worried') { ctx.moveTo(ex - 5 * side, by + 2); ctx.lineTo(ex + 5 * side, by - 2); }
      else if (e === 'shock') { ctx.moveTo(ex - 5, by - 2); ctx.quadraticCurveTo(ex, by - 5, ex + 5, by - 2); }
      else if (e === 'sus') { const lift = side > 0 ? -2.5 : 0.5; ctx.moveTo(ex - 5, by + lift); ctx.lineTo(ex + 5, by + lift - (side > 0 ? 1 : 0)); }
      else if (e === 'happy') { ctx.moveTo(ex - 5, by); ctx.quadraticCurveTo(ex, by - 2.5, ex + 5, by); }
      else { ctx.moveTo(ex - 5, by); ctx.lineTo(ex + 5, by); }
      if (!bushy) { const w = ctx.lineWidth; ctx.strokeStyle = look.skin || '#f3cfae'; ctx.lineWidth = w + 2.2; ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = w; } // a skin-coloured edge, so a brow still reads over a fringe
      ctx.stroke();
      if (bushy) { ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); ctx.strokeStyle = look.hair || INK; ctx.lineWidth = 3.6; }
    }
    ctx.restore();
  }

  function drawHairBack(ctx, look, seed) {
    if (look.hairStyle === 'long') paper(ctx, [[-25, -70], [25, -70], [24, -34], [-24, -34]], look.hair, seed + 70, { stroke: INK, lw: 1.5 });
    if (look.hairStyle === 'mullet') paper(ctx, [[-22, -64], [22, -64], [20, -40], [-20, -40]], look.hair, seed + 71, { stroke: INK, lw: 1.5 });
    if (look.hairStyle === 'bob') paper(ctx, [[-27, -70], [27, -70], [26, -50], [-26, -50]], look.hair, seed + 73, { stroke: INK, lw: 1.5 });
    if (look.hairStyle === 'veil') paper(ctx, [[-30, -86], [30, -86], [38, -10], [-38, -10]], 'rgba(255,255,255,0.75)', seed + 72, { stroke: '#bbb', lw: 1 });
  }
  // Fringes stop above the eyes (top of the eyes is ~12 units above head centre).
  function drawHairFront(ctx, look, seed, hy) {
    const Hc = look.hair;
    switch (look.hairStyle) {
      case 'bun': paper(ctx, [[-23, hy - 6], [-16, hy - 18], [0, hy - 22], [16, hy - 18], [23, hy - 6], [12, hy - 15], [-12, hy - 15]], Hc, seed + 80, { stroke: INK, lw: 1.5 });
        paperEllipse(ctx, 0, hy - 26, 9, 7, Hc, seed + 81, { stroke: INK, lw: 1.5 }); break;
      case 'spiky': paper(ctx, [[-22, hy - 8], [-18, hy - 26], [-10, hy - 17], [-4, hy - 30], [3, hy - 18], [10, hy - 28], [14, hy - 16], [22, hy - 22], [22, hy - 8], [0, hy - 15]], Hc, seed + 82, { stroke: INK, lw: 1.5 }); break;
      case 'bald': paperEllipse(ctx, -22, hy + 2, 5, 7, Hc, seed + 83, { shadow: false }); paperEllipse(ctx, 22, hy + 2, 5, 7, Hc, seed + 84, { shadow: false }); break;
      case 'buzz': paper(ctx, [[-23, hy - 4], [-18, hy - 17], [0, hy - 22], [18, hy - 17], [23, hy - 4], [14, hy - 14], [-14, hy - 14]], Hc, seed + 85, { shadow: false, amp: 0.8 }); break;
      case 'bob':
        paper(ctx, [[-26, hy + 4], [-22, hy - 16], [-6, hy - 23], [12, hy - 22], [24, hy - 14], [26, hy + 4], [19, hy - 6], [0, hy - 15], [-19, hy - 6]], Hc, seed + 86, { stroke: INK, lw: 1.5 }); break;
      case 'mullet': case 'combed': case 'messy': case 'long':
        paper(ctx, [[-24, hy - 2], [-20, hy - 16], [-6, hy - 23], [10, hy - 22], [22, hy - 14], [24, hy - 2], look.hairStyle === 'combed' ? [8, hy - 14] : [12, hy - 13], [-6, hy - 15]], Hc, seed + 87, { stroke: INK, lw: 1.5 });
        if (look.hairStyle === 'messy') { paper(ctx, [[-6, hy - 22], [-2, hy - 32], [4, hy - 21]], Hc, seed + 88, { shadow: false }); paper(ctx, [[6, hy - 21], [14, hy - 29], [14, hy - 18]], Hc, seed + 89, { shadow: false }); }
        break;
      case 'hat':
        paperEllipse(ctx, 0, hy - 17, 36, 7, Hc, seed + 90, { stroke: INK, lw: 1.5 });
        paper(ctx, [[-17, hy - 19], [-14, hy - 35], [14, hy - 35], [17, hy - 19]], Hc, seed + 91, { stroke: INK, lw: 1.5 });
        paper(ctx, [[12, hy - 33], [30, hy - 53], [20, hy - 31]], '#f2c14e', seed + 92, { shadow: false }); break;
      case 'beanie':
        paper(ctx, [[-24, hy - 12], [-20, hy - 24], [0, hy - 31], [20, hy - 24], [24, hy - 12]], Hc, seed + 93, { stroke: INK, lw: 1.5 });
        paperRect(ctx, -24, hy - 18, 48, 6, '#b03a2e', seed + 94, { amp: 0.6, shadow: false }); break;
      case 'cap':
        paper(ctx, [[-24, hy - 13], [-20, hy - 24], [0, hy - 30], [20, hy - 24], [24, hy - 13]], Hc, seed + 95, { stroke: INK, lw: 1.5 });
        paper(ctx, [[6, hy - 19], [36, hy - 18], [34, hy - 14], [6, hy - 15]], Hc, seed + 96, { stroke: INK, lw: 1.5 });
        paperEllipse(ctx, 0, hy - 22, 6, 4, '#fff', seed + 97, { shadow: false }); break;
      case 'veil':
        paper(ctx, [[-22, hy - 6], [-16, hy - 19], [0, hy - 23], [16, hy - 19], [22, hy - 6], [6, hy - 15], [-10, hy - 14]], Hc, seed + 98, { stroke: INK, lw: 1.5 });
        for (let i = 0; i < 5; i++) paperEllipse(ctx, -10 + i * 5, hy - 22 - (i % 2) * 3, 2.5, 2.5, '#f2c14e', seed + 99 + i, { shadow: false, amp: 0.3 }); break;
    }
  }
  function drawHairBackView(ctx, look, seed) {
    const hy = -64;
    if (look.hairStyle === 'bald') { paperEllipse(ctx, -22, hy + 2, 5, 7, look.hair, seed + 105, { shadow: false }); paperEllipse(ctx, 22, hy + 2, 5, 7, look.hair, seed + 106, { shadow: false }); }
    if (look.hairStyle === 'buzz') paper(ctx, [[-23, hy - 2], [-18, hy - 17], [0, hy - 21], [18, hy - 17], [23, hy - 2], [0, hy + 8]], look.hair, seed + 104, { shadow: false, amp: 0.8 });
    if (look.hairStyle === 'bun') paperEllipse(ctx, 0, hy - 22, 9, 7, look.hair, seed + 107, { stroke: INK, lw: 1.5 });
    if (look.hairStyle === 'hat') { paperEllipse(ctx, 0, hy - 17, 36, 7, look.hair, seed + 108, { stroke: INK, lw: 1.5 }); paper(ctx, [[-17, hy - 19], [-14, hy - 35], [14, hy - 35], [17, hy - 19]], look.hair, seed + 109, { stroke: INK, lw: 1.5 }); }
    if (look.hairStyle === 'beanie') paperRect(ctx, -24, hy - 15, 48, 6, '#b03a2e', seed + 110, { amp: 0.6, shadow: false });
    if (look.hairStyle === 'cap') paperEllipse(ctx, 0, hy - 19, 22, 8, look.hair, seed + 111, { stroke: INK, lw: 1.5 });
    if (look.hairStyle === 'long' || look.hairStyle === 'mullet') paper(ctx, [[-22, hy], [22, hy], [20, hy + 26], [-20, hy + 26]], look.hair, seed + 112, { stroke: INK, lw: 1.5 });
    if (look.hairStyle === 'bob') paper(ctx, [[-26, hy - 4], [26, hy - 4], [25, hy + 14], [-25, hy + 14]], look.hair, seed + 114, { stroke: INK, lw: 1.5 });
    if (look.hairStyle === 'veil') { // a bun with a tiara, under a veil you can see through
      paperEllipse(ctx, 0, hy - 14, 10, 7, look.hair, seed + 107, { stroke: INK, lw: 1.5 });
      for (let i = 0; i < 5; i++) paperEllipse(ctx, -10 + i * 5, hy - 22 - (i % 2) * 3, 2.5, 2.5, '#f2c14e', seed + 99 + i, { shadow: false, amp: 0.3 });
      paper(ctx, [[-13, hy - 14], [13, hy - 14], [32, hy + 46], [-32, hy + 46]], 'rgba(255,255,255,0.42)', seed + 113, { stroke: 'rgba(150,150,165,0.8)', lw: 1 });
    }
  }

  function drawDog(ctx, look, x, y, o) {
    const step = Math.floor(o.t * 8), bob = o.walking ? (step % 2) * -2 : 0;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(25,15,5,0.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, bob);
    if (o.faceDir < 0) ctx.scale(-1, 1);
    if (o.anim === 'scoot') ctx.rotate(-0.25 + Math.sin(o.animT * 20) * 0.08);
    const c = look.body;
    for (const lx of [-14, -6, 8, 15]) paperRect(ctx, lx - 3, -10, 6, 10, '#8a5a2b', 300 + lx, { amp: 0.6, shadow: false });
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-20, -18); ctx.lineTo(-30, -28 + Math.sin(o.t * 14) * 5); ctx.stroke();
    paperEllipse(ctx, 0, -17, 22, 11, c, 310, { stroke: INK, lw: 2 });
    paperEllipse(ctx, 20, -30, 13, 12, c, 311, { stroke: INK, lw: 2 });
    paperEllipse(ctx, 14, -36, 5, 9, '#7a4a20', 312, { shadow: false });
    if (o.expr === 'disgust') { ctx.fillStyle = 'rgba(120,190,60,0.45)'; ctx.beginPath(); ctx.arc(20, -30, 11, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(23, -33, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(24, -33, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(32, -28, 3, 0, Math.PI * 2); ctx.fill();
    paperRect(ctx, 6, -24, 12, 4, '#c0392b', 313, { amp: 0.4, shadow: false });
    ctx.restore();
  }

  // A baby in a stroller. The "face" anim is the unmistakable poop face.
  function drawBaby(ctx, look, x, y, o) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(25,15,5,0.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (o.faceDir < 0) ctx.scale(-1, 1);
    const roll = o.walking ? Math.sin(o.t * 12) * 1.5 : 0;
    ctx.translate(0, roll);
    for (const wx of [-16, 16]) { paperEllipse(ctx, wx, -6, 7, 7, '#2b2b2b', 330 + wx, { amp: 0.5 }); paperEllipse(ctx, wx, -6, 2.5, 2.5, '#aaa', 332 + wx, { amp: 0.2, shadow: false }); }
    paper(ctx, [[-24, -36], [24, -36], [20, -12], [-20, -12]], look.body, 334, { stroke: INK, lw: 2 });
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-22, -34); ctx.lineTo(-34, -54); ctx.stroke();
    // baby head peeking out under the canopy
    const face = o.anim === 'face' || o.expr === 'disgust';
    paperEllipse(ctx, 4, -42, 13, 11, face && o.anim === 'face' ? '#d98a6a' : look.skin, 335, { stroke: INK, lw: 1.8 });
    paper(ctx, [[0, -54], [4, -60], [7, -53]], look.hair, 336, { shadow: false, amp: 0.4 });
    if (o.expr === 'disgust') { ctx.fillStyle = 'rgba(120,190,60,0.45)'; ctx.beginPath(); ctx.ellipse(4, -42, 12, 10, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    if (face) { ctx.beginPath(); ctx.moveTo(-3, -45); ctx.lineTo(2, -44); ctx.moveTo(6, -44); ctx.lineTo(11, -45); ctx.stroke(); ctx.beginPath(); ctx.arc(4, -36, 2.5, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(-1, -44, 1.6, 0, Math.PI * 2); ctx.arc(9, -44, 1.6, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(4, -38, 2.5, 0.2, Math.PI - 0.2); ctx.stroke(); }
    // canopy
    paper(ctx, [[-26, -36], [-20, -60], [0, -68], [-4, -50], [-10, -36]], '#5aa9d6', 337, { stroke: INK, lw: 1.8 });
    ctx.restore();
  }

  function bubble(ctx, x, y, text, { tone = 'speech', alpha = 1, belowY = null, place = null } = {}) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.font = tone === 'shout' ? '700 15px "Lexend", sans-serif' : tone === 'whisper' ? 'italic 500 13px "Lexend", sans-serif' : '500 14px "Lexend", sans-serif';
    const maxW = 230, words = text.split(' '), lines = [];
    let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
    lines.push(line);
    const lh = 18, w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 22, h = lines.length * lh + 14;
    let bx = U.clamp(x - w / 2, 6, W - w - 6), by = y - h - 16;
    const flip = by < 78 && belowY !== null;
    if (flip) by = belowY + 14;
    else if (by < 4) by = 4;
    let tether = null; // when the layout moves a bubble away from its speaker, a dotted line keeps it attached
    if (place) {
      const r = place({ x: bx, y: by - (flip ? 12 : 0), w, h: h + 12 });
      if (r.moved) tether = { from: flip ? { x: U.clamp(x, r.x + 14, r.x + w - 14), y: r.y + 12 } : { x: U.clamp(x, r.x + 14, r.x + w - 14), y: r.y + h + 12 } };
      bx = r.x; by = r.y + (flip ? 12 : 0);
    }
    const fill = tone === 'thought' ? '#eef3ff' : tone === 'shout' ? '#fff3b0' : tone === 'whisper' ? '#efe8ff' : '#fffdf6';
    paper(ctx, rectPts(bx, by, w, h, 30), fill, Math.floor(x + y), { amp: 1.4, stroke: INK, lw: tone === 'whisper' ? 1.5 : 2 });
    ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    const tx = U.clamp(x, bx + 14, bx + w - 14);
    const ey = flip ? by + 1 : by + h - 1, tip = flip ? by - 12 : by + h + 12;
    if (tether && Math.hypot(tx - x, tip - y) > 10) { ctx.save(); ctx.setLineDash([2, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tx, tip); ctx.lineTo(x, flip ? belowY + 2 : y + 2); ctx.stroke(); ctx.restore(); }
    ctx.beginPath(); ctx.moveTo(tx - 7, ey); ctx.lineTo(tx, tip); ctx.lineTo(tx + 7, ey); ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx - 7, flip ? by : by + h); ctx.lineTo(tx, tip); ctx.lineTo(tx + 7, flip ? by : by + h); ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + 11, by + 8 + i * lh));
    ctx.restore();
  }

  function stinkLines(ctx, x, y, t, strength = 1) {
    ctx.save(); ctx.strokeStyle = `rgba(110,170,40,${0.75 * strength})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) {
        const yy = y - k * 3.2, xx = x + i * 13 + Math.sin(t * 6 + k * 0.8 + i) * 4;
        k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Cartoon fart cloud: a cluster of outlined green puffs that swell and fade.
  function puff(ctx, p) {
    const k = p.t / p.life, r = 10 + k * 30 * p.size, a = 1 - k;
    ctx.save(); ctx.globalAlpha = a * 0.85;
    for (let i = 0; i < 5; i++) {
      const ang = i * 1.26 + p.seed, d = r * 0.7;
      const cx = p.x + Math.cos(ang) * d, cy = p.y - k * 40 + Math.sin(ang) * d * 0.6;
      paperEllipse(ctx, cx, cy, r * 0.6, r * 0.5, i % 2 ? '#a9d65a' : '#8bc34a', 400 + i + Math.floor(p.seed * 10), { amp: 1.5, stroke: '#4d7a1e', lw: 1.5, shadow: false });
    }
    ctx.restore();
  }

  // Small portrait for UI cards, rendered to a data URL.
  const portraitCache = {};
  function portrait(def, expr = 'neutral') {
    const key = def.id + expr + (def.look.body);
    if (portraitCache[key]) return portraitCache[key];
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 160;
    const ctx = cv.getContext('2d'); ctx.scale(2, 2);
    if (def.sprite === 'dog') drawDog(ctx, def.look, 34, 66, { t: 0, faceDir: 1, expr });
    else if (def.sprite === 'baby') { ctx.translate(-4, 6); ctx.scale(1.25, 1.25); drawBaby(ctx, def.look, 36, 56, { t: 0, faceDir: 1, expr, anim: expr === 'shock' ? 'face' : null }); }
    else drawPerson(ctx, { ...def.look, scale: 1.05 }, 40, 108, { t: 0.5, faceDir: 1, expr, blinkSeed: 1 });
    portraitCache[key] = cv.toDataURL();
    return portraitCache[key];
  }

  return { eyeIndicator, badge, holdRing, buildBackground, drawZoneTags, drawZoneDecals, drawItem, drawPerson, drawDog, drawBaby, bubble, stinkLines, puff, portrait, paper, paperRect, paperEllipse, rectPts, grainPattern, INK };
})();
