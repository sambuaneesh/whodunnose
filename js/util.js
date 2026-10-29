'use strict';
// Small helpers shared by every module. Seeded RNG so a case number always rebuilds the same mystery.
const U = (() => {
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  function shuffle(r, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function angDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // a line that opens with a placeholder still starts with a capital ("{food}, bro." -> "A protein shake, bro.")
  const fill = (str, vars) => { const out = str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`)); return str[0] === '{' ? cap(out) : out; };
  return { rng, clamp, lerp, dist, pick, shuffle, angDiff, fmtTime, fill, cap };
})();
if (typeof module !== 'undefined') module.exports = U;
