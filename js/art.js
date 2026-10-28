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

  // Zone labels are drawn at screen scale so they stay readable whatever the camera zoom is.
  function drawZoneTags(ctx, strong, toScreen) {
    ctx.save();
    ctx.font = '700 11px "Lexend", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const z of ZONES) {
      const a = toScreen(z.x, z.y), b = toScreen(z.x + z.w, z.y + z.h);
      const x = a.x + 6, y = a.y + 12, w = ctx.measureText(z.name.toUpperCase()).width + 14;
      ctx.globalAlpha = strong ? 0.95 : 0.5;
      paperRect(ctx, x, y - 9, w, 18, strong ? '#fff3b0' : '#f3ead6', z.x + z.y, { amp: 1, shadow: false });
      ctx.fillStyle = INK; ctx.fillText(z.name.toUpperCase(), x + 7, y + 0.5);
      if (strong) { ctx.strokeStyle = 'rgba(255,240,170,0.55)'; ctx.setLineDash([6, 6]); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.setLineDash([]); }
    }
    ctx.restore();
  }

  // The eye over your head: how many people can see you right now.
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
  // opts: { t, walking, faceDir (-1/1), lookX, lookY, back, expr, talking, anim, animT, blinkSeed }
  // expr: neutral | happy | disgust | shock | sus | angry | worried
  function drawPerson(ctx, look, x, y, o) {
    const s = look.scale || 1;
    const step = Math.floor(o.t * 8);
    const bob = o.walking ? (step % 2) * -3 : 0;
    const tilt = o.walking ? (step % 2 ? 0.05 : -0.05) : (o.expr === 'shock' ? Math.sin(o.t * 40) * 0.02 : 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(25,15,5,0.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 19 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, bob); ctx.rotate(tilt);
    if (o.faceDir < 0) ctx.scale(-1, 1);
    ctx.scale(s, s);
    const seed = (look.body.charCodeAt(1) || 7) * 31 + (look.hair || '').length;

    if (look.dress) {
      paper(ctx, [[-10, -44], [10, -44], [34, -2], [-34, -2]], '#ffffff', seed, { stroke: INK, lw: 2 });
    } else {
      paperEllipse(ctx, -8, -4, 7, 5, INK, seed + 1, { shadow: false, amp: 1 });
      paperEllipse(ctx, 8, -4, 7, 5, INK, seed + 2, { shadow: false, amp: 1 });
      paper(ctx, [[-15, -42], [15, -42], [19, -6], [-19, -6]], look.body, seed + 3, { stroke: INK, lw: 2, amp: 1.5 });
      if (look.shirt === 'hawaiian') for (let i = 0; i < 6; i++) paperEllipse(ctx, -10 + (i % 3) * 10, -34 + Math.floor(i / 3) * 14, 3.5, 3.5, i % 2 ? '#ffe066' : '#5ec26a', seed + 10 + i, { shadow: false, amp: 1 });
      if (look.shirt === 'tank') { paper(ctx, [[-15, -42], [-8, -42], [-12, -24], [-18, -22]], look.skin, seed + 16, { shadow: false, amp: 0.8 }); paper(ctx, [[15, -42], [8, -42], [12, -24], [18, -22]], look.skin, seed + 17, { shadow: false, amp: 0.8 }); }
      if (look.shirt === 'lanyard') { ctx.strokeStyle = '#2f62b8'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-7, -42); ctx.lineTo(0, -24); ctx.lineTo(7, -42); ctx.stroke(); paperRect(ctx, -5, -25, 10, 12, '#fff', seed + 18, { amp: 0.4, shadow: false }); }
      if (look.body === '#222228' || look.body === '#26262e' || look.body === '#3d4250') paper(ctx, [[-5, -42], [5, -42], [0, -18]], '#f4f4f4', seed + 5, { shadow: false, amp: 0.6 });
      if (look.acc === 'tie') paper(ctx, [[-2.5, -40], [2.5, -40], [4, -20], [0, -15], [-4, -20]], '#a51f2d', seed + 19, { shadow: false, amp: 0.4 });
    }
    if (!o.back) drawHairBack(ctx, look, seed);
    const hand = (hx, hy) => paperEllipse(ctx, hx, hy, 6, 6, look.skin, seed + 20 + hx, { stroke: INK, lw: 1.5, amp: 0.8 });
    const a = o.anim, at = o.animT || 0;
    let Lh = [-21, -20], R = [21, -20];
    if (a === 'fan') R = [26, -12 + Math.sin(at * 22) * 9];
    else if (a === 'spray') R = [22, -50];
    else if (a === 'point') R = [32, -32];
    else if (a === 'arms') { Lh = [-26, -52 + Math.sin(at * 10) * 3]; R = [26, -52 - Math.sin(at * 10) * 3]; }
    else if (a === 'cough') R = [6, -46];
    else if (look.acc === 'phone') R = [14, -32];
    else if (look.acc === 'bouquet') { Lh = [-8, -26]; R = [8, -26]; }
    else if (look.acc === 'coffee' || look.acc === 'pizza') { Lh = [-14, -28]; R = [14, -28]; }
    else if (look.acc === 'shaker') R = [20, -30];
    if (!o.back) {
      hand(Lh[0], Lh[1]); hand(R[0], R[1]);
      if (a === 'spray') {
        paperRect(ctx, 18, -66, 8, 14, '#c86dd7', seed + 30, { amp: 0.6 });
        for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(230,180,255,0.6)'; ctx.beginPath(); ctx.arc(30 + i * 5 + Math.sin(at * 9 + i) * 3, -62 + Math.cos(at * 7 + i) * 6, 3 + i * 0.6, 0, Math.PI * 2); ctx.fill(); }
      }
      if (look.acc === 'phone' && !a) paperRect(ctx, 9, -44, 10, 16, '#222', seed + 31, { amp: 0.5 });
      if (look.acc === 'bouquet') for (let i = 0; i < 5; i++) paperEllipse(ctx, -8 + i * 4, -30 - (i % 2) * 5, 5, 5, i % 2 ? '#f6b6cf' : '#fff', seed + 40 + i, { amp: 1 });
      if (look.acc === 'camera') { paperRect(ctx, -10, -36, 20, 13, '#2b2b2b', seed + 32, { amp: 0.6 }); paperEllipse(ctx, 0, -29, 4.5, 4.5, '#8fb6d9', seed + 33, { shadow: false, amp: 0.4 }); }
      if (look.acc === 'collar') paperRect(ctx, -4, -44, 8, 6, '#ffffff', seed + 34, { amp: 0.5, shadow: false });
      if (look.acc === 'bowtie') paper(ctx, [[-8, -46], [0, -42], [8, -46], [8, -38], [0, -42], [-8, -38]], '#c0392b', seed + 35, { amp: 0.5, shadow: false });
      if (look.acc === 'pearls') for (let i = 0; i < 7; i++) { ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(-9 + i * 3, -41 + Math.sin(i / 6 * Math.PI) * 3, 1.8, 0, Math.PI * 2); ctx.fill(); }
      if (look.acc === 'coffee') { paperRect(ctx, -18, -36, 36, 6, '#8a6a42', seed + 36, { amp: 0.4 }); for (let i = 0; i < 4; i++) paperRect(ctx, -16 + i * 9, -48, 7, 12, i % 2 ? '#fff' : '#f3e2c4', seed + 37 + i, { amp: 0.3, shadow: false }); }
      if (look.acc === 'pizza') { paperRect(ctx, -22, -40, 44, 9, '#d8b07a', seed + 41, { amp: 0.4, stroke: INK, lw: 1 }); }
      if (look.acc === 'shaker' && a !== 'spray') { paperRect(ctx, 15, -48, 10, 20, '#2b2b2b', seed + 42, { amp: 0.4 }); paperRect(ctx, 15, -50, 10, 4, '#e74c3c', seed + 43, { amp: 0.2, shadow: false }); }
    }
    const hy = -64;
    paperEllipse(ctx, 0, hy, 24, 21, o.back ? (['bald', 'buzz'].includes(look.hairStyle) ? look.skin : look.hair) : look.skin, seed + 50, { stroke: INK, lw: 2, amp: 1.2 });
    if (o.back) { drawHairBackView(ctx, look, seed); ctx.restore(); return; }
    drawFace(ctx, look, hy, o, seed);
    drawHairFront(ctx, look, seed, hy);
    if (o.sweat) {
      // nervous sweat: two drops sliding down the temples
      for (const [sx, ph] of [[-20, 0], [19, 0.5]]) {
        const k = ((o.t * 0.9 + ph) % 1), yy = hy - 10 + k * 16;
        ctx.save(); ctx.globalAlpha = 1 - k * 0.6; ctx.fillStyle = '#7cc4f2'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(sx, yy - 6); ctx.quadraticCurveTo(sx + 4, yy, sx, yy + 3); ctx.quadraticCurveTo(sx - 4, yy, sx, yy - 6); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawFace(ctx, look, hy, o, seed) {
    const e = o.expr || 'neutral';
    const disgust = e === 'disgust', sus = e === 'sus', shock = e === 'shock', angry = e === 'angry', worried = e === 'worried';
    if (disgust) { ctx.fillStyle = 'rgba(120,190,60,0.45)'; ctx.beginPath(); ctx.ellipse(0, hy + 2, 22, 18, 0, 0, Math.PI * 2); ctx.fill(); }
    if (angry) { ctx.fillStyle = 'rgba(220,60,50,0.25)'; ctx.beginPath(); ctx.ellipse(0, hy + 2, 22, 18, 0, 0, Math.PI * 2); ctx.fill(); }
    if (worried) { ctx.fillStyle = 'rgba(120,170,230,0.6)'; ctx.beginPath(); ctx.ellipse(17, hy - 8, 2.5, 4, 0.3, 0, Math.PI * 2); ctx.fill(); }
    const lx = U.clamp(o.lookX || 0, -1, 1) * 2.4, ly = U.clamp(o.lookY || 0, -1, 1) * 2;
    // blink every few seconds, offset per character
    const blink = !disgust && !shock && ((o.t * 1000 + (o.blinkSeed || seed) * 397) % 3700) < 130;
    for (const ex of [-6.8, 6.8]) {
      const side = ex < 0 ? -1 : 1;
      if (disgust || blink) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, hy - 2, 7, blink ? 1.6 : 3.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      } else {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, hy - 3, 7, 8.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + lx, hy - 2 + ly, shock ? 1.4 : 2.3, 0, Math.PI * 2); ctx.fill();
        if (sus || angry) { ctx.fillStyle = look.skin; ctx.fillRect(ex - 8, hy - 13, 16, sus ? 7 : 4); ctx.beginPath(); ctx.moveTo(ex - 8, hy - (sus ? 6 : 9)); ctx.lineTo(ex + 8, hy - (sus ? 6 : 9)); ctx.stroke(); }
      }
      // eyebrows do most of the acting
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath();
      if (angry) { ctx.moveTo(ex - 6 * side, hy - 15); ctx.lineTo(ex + 5 * side, hy - 10); }
      else if (worried) { ctx.moveTo(ex - 6 * side, hy - 11); ctx.lineTo(ex + 5 * side, hy - 16); }
      else if (shock) { ctx.moveTo(ex - 5, hy - 18); ctx.quadraticCurveTo(ex, hy - 21, ex + 5, hy - 18); }
      else if (sus) { ctx.moveTo(ex - 5, hy - 12 - (side > 0 ? 3 : 0)); ctx.lineTo(ex + 5, hy - 12 - (side > 0 ? 4 : 0)); }
      else if (disgust) { ctx.moveTo(ex - 6 * side, hy - 9); ctx.lineTo(ex + 5 * side, hy - 8); }
      ctx.stroke();
    }
    if (look.acc === 'glasses') { ctx.strokeStyle = INK; ctx.lineWidth = 1.5; for (const ex of [-6.8, 6.8]) { ctx.beginPath(); ctx.arc(ex, hy - 3, 9, 0, Math.PI * 2); ctx.stroke(); } }
    if (look.acc === 'shades') paperRect(ctx, -16, hy - 10, 32, 11, '#111', seed + 60, { amp: 0.6, shadow: false });
    // mouth: talking cycles through three cutout mouth shapes
    ctx.strokeStyle = INK; ctx.fillStyle = '#5a1d1d'; ctx.lineWidth = 2;
    const my = hy + 12;
    const shape = o.talking ? Math.floor(o.t * 11 + seed) % 3 : -1;
    if (shock || shape === 2) { ctx.beginPath(); ctx.ellipse(0, my, shock ? 4 : 5.5, shock ? 5.5 : 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    else if (shape === 1) { ctx.beginPath(); ctx.ellipse(0, my, 4.5, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    else if (disgust) { ctx.beginPath(); ctx.moveTo(-7, my); for (let i = 1; i <= 4; i++) ctx.lineTo(-7 + i * 3.5, my + (i % 2 ? -2.5 : 2.5)); ctx.stroke(); }
    else if (e === 'happy') { ctx.beginPath(); ctx.arc(0, my - 3, 5, 0.2, Math.PI - 0.2); ctx.stroke(); }
    else if (angry) { ctx.beginPath(); ctx.arc(0, my + 4, 5, Math.PI + 0.3, -0.3); ctx.stroke(); }
    else if (worried) { ctx.beginPath(); ctx.moveTo(-5, my + 1); ctx.quadraticCurveTo(-2, my - 2, 0, my + 1); ctx.quadraticCurveTo(2, my + 3, 5, my); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-4, my); ctx.lineTo(4, my); ctx.stroke(); }
  }

  function drawHairBack(ctx, look, seed) {
    if (look.hairStyle === 'long') paper(ctx, [[-25, -70], [25, -70], [24, -34], [-24, -34]], look.hair, seed + 70, { stroke: INK, lw: 1.5 });
    if (look.hairStyle === 'mullet') paper(ctx, [[-22, -64], [22, -64], [20, -40], [-20, -40]], look.hair, seed + 71, { stroke: INK, lw: 1.5 });
    if (look.hairStyle === 'bob') paper(ctx, [[-27, -70], [27, -70], [26, -50], [-26, -50]], look.hair, seed + 73, { stroke: INK, lw: 1.5 });
    if (look.hairStyle === 'veil') paper(ctx, [[-30, -86], [30, -86], [38, -10], [-38, -10]], 'rgba(255,255,255,0.75)', seed + 72, { stroke: '#bbb', lw: 1 });
  }
  function drawHairFront(ctx, look, seed, hy) {
    const Hc = look.hair;
    switch (look.hairStyle) {
      case 'bun': paper(ctx, [[-23, hy - 6], [-16, hy - 18], [0, hy - 22], [16, hy - 18], [23, hy - 6], [12, hy - 14], [-12, hy - 14]], Hc, seed + 80, { stroke: INK, lw: 1.5 });
        paperEllipse(ctx, 0, hy - 26, 9, 7, Hc, seed + 81, { stroke: INK, lw: 1.5 }); break;
      case 'spiky': paper(ctx, [[-22, hy - 8], [-18, hy - 26], [-10, hy - 16], [-4, hy - 30], [3, hy - 17], [10, hy - 28], [14, hy - 15], [22, hy - 22], [22, hy - 8], [0, hy - 14]], Hc, seed + 82, { stroke: INK, lw: 1.5 }); break;
      case 'bald': paperEllipse(ctx, -22, hy + 2, 5, 7, Hc, seed + 83, { shadow: false }); paperEllipse(ctx, 22, hy + 2, 5, 7, Hc, seed + 84, { shadow: false }); break;
      case 'buzz': paper(ctx, [[-23, hy - 4], [-18, hy - 17], [0, hy - 22], [18, hy - 17], [23, hy - 4], [14, hy - 13], [-14, hy - 13]], Hc, seed + 85, { shadow: false, amp: 0.8 }); break;
      case 'bob':
        paper(ctx, [[-26, hy + 4], [-22, hy - 16], [-6, hy - 23], [12, hy - 22], [24, hy - 14], [26, hy + 4], [18, hy - 8], [0, hy - 14], [-18, hy - 8]], Hc, seed + 86, { stroke: INK, lw: 1.5 }); break;
      case 'mullet': case 'combed': case 'messy': case 'long':
        paper(ctx, [[-24, hy - 2], [-20, hy - 16], [-6, hy - 23], [10, hy - 22], [22, hy - 14], [24, hy - 2], look.hairStyle === 'combed' ? [8, hy - 12] : [12, hy - 10], [-6, hy - 13]], Hc, seed + 87, { stroke: INK, lw: 1.5 });
        if (look.hairStyle === 'messy') { paper(ctx, [[-6, hy - 22], [-2, hy - 32], [4, hy - 21]], Hc, seed + 88, { shadow: false }); paper(ctx, [[6, hy - 21], [14, hy - 29], [14, hy - 18]], Hc, seed + 89, { shadow: false }); }
        break;
      case 'hat':
        paperEllipse(ctx, 0, hy - 16, 36, 7, Hc, seed + 90, { stroke: INK, lw: 1.5 });
        paper(ctx, [[-17, hy - 18], [-14, hy - 34], [14, hy - 34], [17, hy - 18]], Hc, seed + 91, { stroke: INK, lw: 1.5 });
        paper(ctx, [[12, hy - 32], [30, hy - 52], [20, hy - 30]], '#f2c14e', seed + 92, { shadow: false }); break;
      case 'beanie':
        paper(ctx, [[-24, hy - 6], [-20, hy - 20], [0, hy - 27], [20, hy - 20], [24, hy - 6]], Hc, seed + 93, { stroke: INK, lw: 1.5 });
        paperRect(ctx, -24, hy - 10, 48, 6, '#b03a2e', seed + 94, { amp: 0.6, shadow: false }); break;
      case 'cap':
        paper(ctx, [[-24, hy - 6], [-20, hy - 20], [0, hy - 26], [20, hy - 20], [24, hy - 6]], Hc, seed + 95, { stroke: INK, lw: 1.5 });
        paper(ctx, [[8, hy - 8], [36, hy - 6], [34, hy - 1], [8, hy - 3]], Hc, seed + 96, { stroke: INK, lw: 1.5 });
        paperEllipse(ctx, 0, hy - 16, 6, 4, '#fff', seed + 97, { shadow: false }); break;
      case 'veil':
        paper(ctx, [[-22, hy - 6], [-16, hy - 19], [0, hy - 23], [16, hy - 19], [22, hy - 6], [6, hy - 14], [-10, hy - 12]], Hc, seed + 98, { stroke: INK, lw: 1.5 });
        for (let i = 0; i < 5; i++) paperEllipse(ctx, -10 + i * 5, hy - 22 - (i % 2) * 3, 2.5, 2.5, '#f2c14e', seed + 99 + i, { shadow: false, amp: 0.3 }); break;
    }
  }
  function drawHairBackView(ctx, look, seed) {
    const hy = -64;
    if (look.hairStyle === 'bald') { paperEllipse(ctx, -22, hy + 2, 5, 7, look.hair, seed + 105, { shadow: false }); paperEllipse(ctx, 22, hy + 2, 5, 7, look.hair, seed + 106, { shadow: false }); }
    if (look.hairStyle === 'buzz') paper(ctx, [[-23, hy - 2], [-18, hy - 17], [0, hy - 21], [18, hy - 17], [23, hy - 2], [0, hy + 8]], look.hair, seed + 104, { shadow: false, amp: 0.8 });
    if (look.hairStyle === 'bun') paperEllipse(ctx, 0, hy - 22, 9, 7, look.hair, seed + 107, { stroke: INK, lw: 1.5 });
    if (look.hairStyle === 'hat') { paperEllipse(ctx, 0, hy - 16, 36, 7, look.hair, seed + 108, { stroke: INK, lw: 1.5 }); paper(ctx, [[-17, hy - 18], [-14, hy - 34], [14, hy - 34], [17, hy - 18]], look.hair, seed + 109, { stroke: INK, lw: 1.5 }); }
    if (look.hairStyle === 'beanie') paperRect(ctx, -24, hy - 10, 48, 6, '#b03a2e', seed + 110, { amp: 0.6, shadow: false });
    if (look.hairStyle === 'cap') paperEllipse(ctx, 0, hy - 18, 22, 8, look.hair, seed + 111, { stroke: INK, lw: 1.5 });
    if (look.hairStyle === 'long' || look.hairStyle === 'mullet') paper(ctx, [[-22, hy], [22, hy], [20, hy + 26], [-20, hy + 26]], look.hair, seed + 112, { stroke: INK, lw: 1.5 });
    if (look.hairStyle === 'bob') paper(ctx, [[-26, hy - 4], [26, hy - 4], [25, hy + 14], [-25, hy + 14]], look.hair, seed + 114, { stroke: INK, lw: 1.5 });
    if (look.hairStyle === 'veil') paper(ctx, [[-28, hy - 18], [28, hy - 18], [34, hy + 52], [-34, hy + 52]], 'rgba(255,255,255,0.8)', seed + 113, { stroke: '#bbb', lw: 1 });
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

  function bubble(ctx, x, y, text, { tone = 'speech', alpha = 1, belowY = null } = {}) {
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
    const fill = tone === 'thought' ? '#eef3ff' : tone === 'shout' ? '#fff3b0' : tone === 'whisper' ? '#efe8ff' : '#fffdf6';
    paper(ctx, rectPts(bx, by, w, h, 30), fill, Math.floor(x + y), { amp: 1.4, stroke: INK, lw: tone === 'whisper' ? 1.5 : 2 });
    ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    const tx = U.clamp(x, bx + 14, bx + w - 14);
    const ey = flip ? by + 1 : by + h - 1, tip = flip ? by - 12 : by + h + 12;
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

  return { eyeIndicator, badge, holdRing, buildBackground, drawZoneTags, drawItem, drawPerson, drawDog, drawBaby, bubble, stinkLines, puff, portrait, paper, paperRect, paperEllipse, rectPts, grainPattern, INK };
})();
