'use strict';
// The fart as a fluid: a coarse grid that diffuses, drifts on the room's air currents,
// drains into vents and open doors, and slowly fades. Where it goes is evidence.
// Each level supplies its walls, air pushers (AC, fans), vents and doors.
const Gas = (() => {
  const CELL = 20, COLS = 64, ROWS = 36, N = COLS * ROWS;
  let c = new Float32Array(N), tmp = new Float32Array(N);
  const vx = new Float32Array(N), vy = new Float32Array(N), wall = new Uint8Array(N), drain = new Float32Array(N);
  const DECAY = 0.004;
  let cfg = null, diffusion = 8, doorState = {}, emitters = [];

  const idx = (x, y) => y * COLS + x;
  const cellPos = (x, y) => [x * CELL + CELL / 2, y * CELL + CELL / 2];

  function configure(gasCfg) {
    cfg = gasCfg; diffusion = gasCfg.diffusion || 8; doorState = {};
    for (const id in (gasCfg.doors || {})) doorState[id] = false;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const [px, py] = cellPos(x, y); wall[idx(x, y)] = gasCfg.wall(px, py) ? 1 : 0; }
    rebuild();
  }

  // Air currents and drains, rebuilt whenever a door opens or closes.
  function rebuild() {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = idx(x, y), [px, py] = cellPos(x, y);
      let ux = 0, uy = 0, dr = 0;
      if (wall[i]) { vx[i] = vy[i] = drain[i] = 0; continue; }
      for (const p of cfg.pushers || []) {
        const dx = px - p.x, dy = py - p.y, d = Math.hypot(dx, dy) || 1, s = p.strength * Math.exp(-d / p.falloff);
        ux += (dx / d) * s * 0.6 + s * (p.bias ? p.bias.x : 0); uy += (dy / d) * s * 0.4 + s * (p.bias ? p.bias.y : 0);
      }
      for (const v of cfg.vents || []) {
        const dx = v.x - px, dy = v.y - py, d = Math.hypot(dx, dy) || 1, s = v.pull * Math.exp(-d / v.falloff);
        ux += (dx / d) * s; uy += (dy / d) * s;
        if (d < v.r) dr += v.drain;
      }
      for (const id in cfg.doors || {}) {
        if (!doorState[id]) continue;
        const dd = cfg.doors[id], dx = px - dd.x, dy = py - dd.y, d = Math.hypot(dx, dy) || 1, s = dd.push * Math.exp(-d / dd.falloff);
        ux += (dx / d) * s; uy += (dy / d) * s;
        if (d < dd.r) dr += dd.drain;
      }
      ux += Math.sin(py / 90 + px / 260) * 3; uy += Math.cos(px / 110) * 2;
      vx[i] = ux / CELL; vy[i] = uy / CELL; drain[i] = dr;
    }
  }

  function reset(gasCfg) { c.fill(0); emitters = []; configure(gasCfg); }
  function setDoor(id, open) { if (doorState[id] !== open) { doorState[id] = open; rebuild(); } }
  const doorOpen = (id) => !!doorState[id];

  function deposit(px, py, amount) {
    const gx = Math.round(px / CELL - 0.5), gy = Math.round(py / CELL - 0.5);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const x = gx + ox, y = gy + oy;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS || wall[idx(x, y)]) continue;
      const w = ox === 0 && oy === 0 ? 0.36 : (ox === 0 || oy === 0 ? 0.11 : 0.05);
      c[idx(x, y)] += amount * w;
    }
  }
  // A fart is a short puff, not a single dump: it keeps leaking for `dur` seconds.
  function emit(px, py, amount, dur = 1.2) { emitters.push({ x: px, y: py, rate: amount / dur, left: dur }); }

  function sampleArr(a, gx, gy) {
    gx = Math.max(0, Math.min(COLS - 1.001, gx)); gy = Math.max(0, Math.min(ROWS - 1.001, gy));
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const x1 = Math.min(COLS - 1, x0 + 1), y1 = Math.min(ROWS - 1, y0 + 1);
    return a[idx(x0, y0)] * (1 - fx) * (1 - fy) + a[idx(x1, y0)] * fx * (1 - fy) +
           a[idx(x0, y1)] * (1 - fx) * fy + a[idx(x1, y1)] * fx * fy;
  }

  function step(dt) {
    for (const e of emitters) { const d = Math.min(dt, e.left); deposit(e.x, e.y, e.rate * d); e.left -= dt; }
    emitters = emitters.filter((e) => e.left > 0);
    const sub = 2, k = diffusion * dt / sub;
    for (let s = 0; s < sub; s++) {
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const i = idx(x, y);
        if (wall[i]) { tmp[i] = 0; continue; }
        const v = c[i];
        const l = x > 0 && !wall[i - 1] ? c[i - 1] : v, r = x < COLS - 1 && !wall[i + 1] ? c[i + 1] : v;
        const u = y > 0 && !wall[i - COLS] ? c[i - COLS] : v, d = y < ROWS - 1 && !wall[i + COLS] ? c[i + COLS] : v;
        tmp[i] = v + k * (l + r + u + d - 4 * v);
      }
      [c, tmp] = [tmp, c];
    }
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = idx(x, y);
      tmp[i] = wall[i] ? 0 : sampleArr(c, x - vx[i] * dt, y - vy[i] * dt);
    }
    [c, tmp] = [tmp, c];
    const fade = 1 - DECAY * dt;
    for (let i = 0; i < N; i++) c[i] *= fade * (1 - drain[i] * dt);
  }

  const sample = (px, py) => sampleArr(c, px / CELL - 0.5, py / CELL - 0.5);
  function gradient(px, py) {
    const h = 30;
    return { x: sample(px + h, py) - sample(px - h, py), y: sample(px, py + h) - sample(px, py - h) };
  }
  function total() { let t = 0; for (let i = 0; i < N; i++) t += c[i]; return t; }

  // Paint the grid into a tiny image; the renderer scales it up smoothly into a cloud.
  // Smell Vision shows where the gas is thicker than the room's average, so the source stands out.
  function paint(imgData, strength, vision = false) {
    const d = imgData.data;
    let peak = 0, sum = 0, cnt = 0;
    for (let i = 0; i < N; i++) if (!wall[i]) { if (c[i] > peak) peak = c[i]; sum += c[i]; cnt++; }
    const mean = sum / Math.max(1, cnt), span = Math.max(0.12, peak - mean);
    for (let i = 0; i < N; i++) {
      const v = c[i], o = i * 4;
      if (vision) {
        const n = Math.max(0, Math.min(1, (v - mean) / span)), a = Math.max(0, Math.min(1, (n - 0.05) / 0.5));
        d[o] = 70 + 185 * n; d[o + 1] = 150 + 90 * n; d[o + 2] = 40 - 20 * n; d[o + 3] = a * strength * 255;
      } else {
        const hot = Math.min(1, v * 0.5);
        d[o] = 120 + 110 * hot; d[o + 1] = 190 + 40 * hot; d[o + 2] = 40; d[o + 3] = Math.min(1, v * 1.4) * strength * 255;
      }
    }
  }

  return { CELL, COLS, ROWS, reset, setDoor, doorOpen, emit, step, sample, gradient, total, paint };
})();
if (typeof module !== 'undefined') module.exports = Gas;
