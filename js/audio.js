'use strict';
// Every sound is synthesized. Signal flow:
//   music / sfx / voice / ambience buses -> master -> compressor -> speakers
//   each bus also sends to a generated reverb sized for the current room (tiny elevator, big chapel).
// Music is adaptive: each theme has layers that come in as tension rises (calm, investigating,
// tension), it ducks under dialogue, and the cross-examination has its own driving theme.
const Sfx = (() => {
  let ac = null, master = null, comp = null, verb = null, verbIn = null;
  const buses = {};
  let muted = false, vol = 0.8, musicVol = 0.5, ducked = false, paused = false;
  let organNodes = [], murmur = null, amb = null, meterNode = null;

  // ---------------- setup ----------------
  function init() {
    if (ac) { if (ac.state === 'suspended' && !paused) ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      comp = ac.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.2;
      master = ac.createGain(); master.gain.value = vol;
      master.connect(comp); comp.connect(ac.destination);
      meterNode = ac.createAnalyser(); meterNode.fftSize = 2048; comp.connect(meterNode);
      verbIn = ac.createGain();
      verb = ac.createConvolver(); verbIn.connect(verb);
      const verbOut = ac.createGain(); verbOut.gain.value = 0.9; verb.connect(verbOut); verbOut.connect(master);
      for (const [id, g, send] of [['music', musicVol, 0.22], ['sfx', 1, 0.18], ['voice', 0.9, 0.12], ['amb', 0.8, 0.3]]) {
        const bus = ac.createGain(); bus.gain.value = g; bus.connect(master);
        const s = ac.createGain(); s.gain.value = send; bus.connect(s); s.connect(verbIn);
        buses[id] = bus;
      }
      setRoom(1.2, 0.5);
    } catch (e) { ac = null; }
  }
  function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : vol; }
  function setVolumes(m, mu) { vol = m; musicVol = mu; if (master) { master.gain.setTargetAtTime(muted ? 0 : vol, ac.currentTime, 0.05); applyMusicGain(); } }
  function setPaused(p) { paused = p; if (!ac) return; if (p) ac.suspend(); else ac.resume(); }
  const ok = () => ac && !muted && vol > 0;
  const now = () => ac.currentTime;

  // A generated impulse response: decaying stereo noise. Small and bright for the elevator, long for the chapel.
  function setRoom(seconds, brightness) {
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * seconds), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len, n = Math.random() * 2 - 1;
        lp += (n - lp) * (0.05 + brightness * 0.9);
        d[i] = lp * Math.pow(1 - k, 2.4) * (i < ac.sampleRate * 0.004 ? 0.2 : 1);
      }
    }
    verb.buffer = ir;
  }

  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true; return src;
  }
  function panTo(x, out) {
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (!p) return out;
    let v = 0;
    if (typeof x === 'number') v = (typeof L !== 'undefined' && L && L.view) ? ((x - L.view.x) / L.view.w) * 2 - 1 : (x / 640) - 1;
    p.pan.value = Math.max(-1, Math.min(1, v)) * 0.85; p.connect(out); return p;
  }
  function env(g, t, a, peak, d, sustain = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
  }
  function osc(type, f, t, stop, out) { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(out); o.start(t); o.stop(stop); return o; }
  function tone(freq, t, dur, { type = 'sine', vol: v = 0.15, out = buses.sfx, attack = 0.01 } = {}) {
    const g = ac.createGain(); g.connect(out); env(g, t, attack, v, Math.max(0.02, dur - attack));
    osc(type, freq, t, t + dur + 0.05, g);
  }
  function burst(t, dur, { type = 'bandpass', freq = 1000, q = 1, vol: v = 0.2, out = buses.sfx, sweepTo = null, attack = 0.003 } = {}) {
    const n = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    env(g, t, attack, v, Math.max(0.01, dur - attack));
    n.connect(f); f.connect(g); g.connect(out); n.start(t, Math.random()); n.stop(t + dur + 0.05);
  }

  // ---------------- instruments ----------------
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const INST = {
    // FM electric piano for the elevator bossa
    epiano(f, t, dur, v, out) {
      const g = ac.createGain(); g.connect(out); env(g, t, 0.006, v, dur * 0.9 + 0.3, v * 0.02);
      const car = osc('sine', f, t, t + dur + 0.6, g);
      const mod = ac.createOscillator(), mg = ac.createGain(); mod.frequency.value = f;
      mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.5);
      mod.connect(mg); mg.connect(car.frequency); mod.start(t); mod.stop(t + dur + 0.6);
    },
    vibes(f, t, dur, v, out) {
      const g = ac.createGain(); g.connect(out); env(g, t, 0.004, v, 1.4);
      const trem = ac.createOscillator(), tg = ac.createGain(); trem.frequency.value = 5.5; tg.gain.value = v * 0.35;
      trem.connect(tg); tg.connect(g.gain); trem.start(t); trem.stop(t + 1.6);
      osc('sine', f, t, t + 1.6, g);
      const g2 = ac.createGain(); g2.gain.value = 0.18; g2.connect(g); osc('sine', f * 4, t, t + 0.4, g2);
    },
    pizz(f, t, dur, v, out) {
      const g = ac.createGain(); g.connect(out); env(g, t, 0.003, v, 0.22);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.2); lp.connect(g);
      osc('triangle', f, t, t + 0.3, lp); osc('sawtooth', f * 1.002, t, t + 0.3, lp);
    },
    bassoon(f, t, dur, v, out) {
      const g = ac.createGain(); g.connect(out); env(g, t, 0.03, v, dur * 0.85, v * 0.5);
      g.gain.setTargetAtTime(0.0001, t + dur * 0.9, 0.05);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(1400, f * 4); lp.Q.value = 3; lp.connect(g);
      const o = osc('sawtooth', f, t, t + dur + 0.3, lp);
      const vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = 5; vg.gain.value = f * 0.008; vib.connect(vg); vg.connect(o.frequency); vib.start(t + 0.1); vib.stop(t + dur + 0.3);
    },
    clarinet(f, t, dur, v, out) {
      const g = ac.createGain(); g.connect(out); env(g, t, 0.04, v, dur * 0.8, v * 0.6);
      g.gain.setTargetAtTime(0.0001, t + dur * 0.92, 0.04);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f * 3.5; lp.connect(g);
      osc('square', f, t, t + dur + 0.3, lp);
    },
    harpsi(f, t, dur, v, out) {
      const g = ac.createGain(); g.connect(out); env(g, t, 0.002, v, 0.6);
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 280; hp.connect(g);
      osc('sawtooth', f, t, t + 0.7, hp); const g2 = ac.createGain(); g2.gain.value = 0.4; g2.connect(hp); osc('square', f * 2, t, t + 0.3, g2);
    },
    upright(f, t, dur, v, out) {
      const g = ac.createGain(); g.connect(out); env(g, t, 0.008, v, Math.min(0.9, dur + 0.2), v * 0.05);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(240, t + 0.3); lp.connect(g);
      osc('triangle', f, t, t + dur + 0.5, lp); const g2 = ac.createGain(); g2.gain.value = 0.5; g2.connect(lp); osc('sine', f / 2, t, t + dur + 0.5, g2);
    },
    synbass(f, t, dur, v, out) {
      const g = ac.createGain(); g.connect(out); env(g, t, 0.005, v, dur * 0.9, v * 0.3); g.gain.setTargetAtTime(0.0001, t + dur, 0.03);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(1200, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.18); lp.connect(g);
      osc('sawtooth', f, t, t + dur + 0.2, lp); osc('square', f * 0.5, t, t + dur + 0.2, lp);
    },
    strings(f, t, dur, v, out) {
      const g = ac.createGain(); g.connect(out); env(g, t, 0.35, v, dur, v * 0.7); g.gain.setTargetAtTime(0.0001, t + dur, 0.25);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; lp.connect(g);
      for (const d of [-7, 0, 6]) { const o = osc('sawtooth', f, t, t + dur + 1.2, lp); o.detune.value = d; }
    },
    brass(f, t, dur, v, out) {
      const g = ac.createGain(); g.connect(out); env(g, t, 0.02, v, dur * 0.8, v * 0.4); g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.06); lp.frequency.exponentialRampToValueAtTime(900, t + 0.4); lp.connect(g);
      for (const d of [-5, 5]) { const o = osc('sawtooth', f, t, t + dur + 0.3, lp); o.detune.value = d; }
    },
    organ(f, t, dur, v, out) {
      const g = ac.createGain(); g.connect(out); env(g, t, 0.05, v, dur, v * 0.85); g.gain.setTargetAtTime(0.0001, t + dur, 0.12);
      [[1, 1], [2, 0.6], [3, 0.35], [4, 0.3], [8, 0.12], [0.5, 0.5]].forEach(([m, lvl]) => { const gg = ac.createGain(); gg.gain.value = lvl * 0.3; gg.connect(g); osc('sine', f * m, t, t + dur + 0.6, gg); });
    },
    // percussion (frequency ignored unless noted)
    shaker(f, t, d, v, out) { burst(t, 0.06, { type: 'highpass', freq: 6500, vol: v, out }); },
    hat(f, t, d, v, out) { burst(t, 0.035, { type: 'highpass', freq: 8500, vol: v, out }); },
    rim(f, t, d, v, out) { tone(1650, t, 0.035, { type: 'triangle', vol: v, out }); burst(t, 0.02, { freq: 3000, q: 3, vol: v * 0.6, out }); },
    wood(f, t, d, v, out) { tone(f || 820, t, 0.06, { type: 'sine', vol: v, out }); },
    kick(f, t, d, v, out) { const g = ac.createGain(); g.connect(out); env(g, t, 0.003, v, 0.28); const o = osc('sine', 130, t, t + 0.35, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.25); },
    snare(f, t, d, v, out) { burst(t, 0.16, { type: 'bandpass', freq: 1800, q: 0.7, vol: v, out }); tone(190, t, 0.08, { vol: v * 0.6, out }); },
    tri(f, t, d, v, out) { tone(2800, t, 1.2, { vol: v, out, attack: 0.002 }); tone(4100, t, 0.6, { vol: v * 0.4, out, attack: 0.002 }); },
    timp(f, t, d, v, out) { const g = ac.createGain(); g.connect(out); env(g, t, 0.005, v, 0.9); const o = osc('sine', f * 1.3, t, t + 1, g); o.frequency.exponentialRampToValueAtTime(f, t + 0.15); burst(t, 0.08, { type: 'lowpass', freq: 400, vol: v * 0.5, out }); },
  };

  // ---------------- music ----------------
  const QUAL = { maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10], m7b5: [0, 3, 6, 10], maj: [0, 4, 7], m: [0, 3, 7], dim7: [0, 3, 6, 9], sus: [0, 5, 7] };
  const chordNotes = ([root, q], oct = 4) => QUAL[q].map((s) => root + s + 12 * (oct - 4));
  // melodies as { step: [midi, lengthInSteps, velocity] } per bar
  const mel = (...pairs) => Object.fromEntries(pairs.map(([s, n, d]) => [s, [n, d, 1]]));
  const MUZAK_MEL = [
    mel([0, 69, 4], [4, 72, 2], [6, 76, 4], [12, 74, 4]), mel([0, 72, 6], [8, 69, 2], [10, 67, 2], [12, 69, 4]),
    mel([0, 70, 4], [4, 74, 2], [6, 77, 4], [12, 76, 2], [14, 74, 2]), mel([0, 76, 6], [8, 72, 4], [12, 70, 4]),
    mel([0, 72, 4], [4, 69, 2], [6, 72, 2], [8, 76, 6], [14, 74, 2]), mel([0, 66, 4], [4, 69, 2], [6, 72, 4], [12, 74, 4]),
    mel([0, 74, 6], [8, 70, 2], [10, 69, 2], [12, 67, 4]), mel([0, 64, 4], [4, 67, 2], [6, 70, 2], [8, 72, 8]),
  ];
  const CHAPEL_MEL = [
    mel([0, 74, 4], [4, 71, 4], [8, 67, 4]), mel([0, 69, 2], [2, 71, 2], [4, 72, 4], [8, 74, 4]),
    mel([0, 76, 6], [6, 74, 2], [8, 72, 4]), mel([0, 69, 8], [8, 66, 4]),
    mel([0, 67, 4], [4, 71, 4], [8, 76, 4]), mel([0, 76, 2], [2, 74, 2], [4, 72, 4], [8, 67, 4]),
    mel([0, 69, 4], [4, 73, 4], [8, 76, 4]), mel([0, 74, 8], [8, 72, 2], [10, 69, 2]),
  ];
  const TRIAL_MEL = [mel([0, 74, 3], [3, 77, 3], [6, 81, 4], [12, 79, 4]), mel([0, 77, 6], [8, 74, 4], [12, 70, 4]), mel([0, 70, 3], [3, 74, 3], [6, 79, 6], [12, 77, 4]), mel([0, 76, 6], [8, 73, 4], [12, 69, 4])];
  const walk = (b, s, c) => ({ 0: [[c[0] - 24, 5, 1]], 6: [[c[0] - 17, 2, 0.8]], 8: [[c[0] - 24, 5, 0.9]], 14: [[c[0] - 17, 2, 0.8]] }[s]);
  const bossaComp = (b, s, c) => [0, 3, 6, 10, 12].includes(s) ? chordNotes(c, 4).map((n) => [n, 2, s === 0 ? 1 : 0.7]) : null;
  // Each theme: tempo, steps per bar, chords per bar, and layers with the intensity range they play in.
  const THEMES = {
    // Elevator bossa in F. Calm at first; a sneaky pizzicato and a bassoon join once something has happened.
    muzak: { bpm: 104, steps: 16, swing: 0.1, chords: [[65, 'maj7'], [65, 'maj7'], [67, 'm7'], [60, '7'], [69, 'm7'], [62, '7'], [67, 'm7'], [60, '7']],
      layers: [
        { inst: 'upright', min: 0, vol: 0.12, pat: walk },
        { inst: 'epiano', min: 0, vol: 0.045, pat: bossaComp },
        { inst: 'vibes', min: 0, max: 1, vol: 0.05, pat: (b, s) => MUZAK_MEL[b % 8][s] ? [MUZAK_MEL[b % 8][s]] : null },
        { inst: 'pizz', min: 1, vol: 0.07, pat: (b, s, c) => (b % 2 === 0 && [0, 2, 4, 6].includes(s)) || (b % 2 === 1 && [8, 10, 12, 14].includes(s)) ? [[chordNotes(c, 4)[(s / 2) % 4], 1, 0.9]] : null },
        { inst: 'bassoon', min: 1, vol: 0.06, pat: (b, s, c) => (b % 4 === 3 && [8, 10, 12].includes(s)) ? [[c[0] - 12 + [0, -1, -2][(s - 8) / 2], 2, 1]] : null },
        { inst: 'shaker', min: 0, vol: 0.022, pat: (b, s) => s % 2 === 0 ? [[0, 1, s % 4 === 0 ? 1 : 0.6]] : null },
        { inst: 'rim', min: 0, vol: 0.03, pat: (b, s) => [3, 6, 10, 13].includes(s) ? [[0, 1, 1]] : null },
        { inst: 'strings', min: 2, vol: 0.03, pat: (b, s, c) => s === 0 ? chordNotes(c, 3).map((n) => [n, 16, 1]) : null },
        { inst: 'wood', min: 2, vol: 0.05, freq: true, pat: (b, s) => s % 4 === 0 ? [[s % 8 === 0 ? 880 : 660, 1, 1]] : null },
        { inst: 'kick', min: 2, vol: 0.12, pat: (b, s) => [0, 8].includes(s) ? [[0, 1, 1]] : null },
      ] },
    // Chapel waltz in G: harpsichord oom-pah-pah, a pizzicato bass, and a clarinet tune that gets sneakier.
    mingle: { bpm: 132, steps: 12, chords: [[67, 'maj'], [67, 'maj'], [60, 'maj'], [62, 'maj'], [64, 'm'], [60, 'maj'], [69, '7'], [62, '7']],
      layers: [
        { inst: 'pizz', min: 0, vol: 0.11, pat: (b, s, c) => s === 0 ? [[c[0] - 24, 3, 1]] : null },
        { inst: 'harpsi', min: 0, vol: 0.035, pat: (b, s, c) => (s === 4 || s === 8) ? chordNotes(c, 4).map((n) => [n, 2, 0.8]) : null },
        { inst: 'clarinet', min: 0, max: 1, vol: 0.05, pat: (b, s) => CHAPEL_MEL[b % 8][s] ? [CHAPEL_MEL[b % 8][s]] : null },
        { inst: 'bassoon', min: 1, vol: 0.065, pat: (b, s) => CHAPEL_MEL[b % 8][s] ? [[CHAPEL_MEL[b % 8][s][0] - 12, CHAPEL_MEL[b % 8][s][1], 0.9]] : null },
        { inst: 'pizz', min: 1, vol: 0.05, pat: (b, s, c) => [2, 6, 10].includes(s) ? [[chordNotes(c, 5)[(s / 4) | 0], 1, 0.7]] : null },
        { inst: 'tri', min: 1, vol: 0.02, pat: (b, s) => (b % 2 === 0 && s === 0) ? [[0, 1, 1]] : null },
        { inst: 'strings', min: 2, vol: 0.03, pat: (b, s, c) => s === 0 ? chordNotes(c, 3).map((n) => [n, 12, 1]) : null },
        { inst: 'timp', min: 2, vol: 0.12, pat: (b, s, c) => s === 0 ? [[c[0] - 24, 1, 1]] : null },
      ] },
    // Silence with teeth: the vows. Low strings, a heartbeat and a clock.
    tension: { bpm: 72, steps: 16, chords: [[64, 'm'], [60, 'maj'], [57, 'm'], [59, '7']],
      layers: [
        { inst: 'strings', min: 0, vol: 0.035, pat: (b, s, c) => s === 0 ? chordNotes(c, 3).map((n) => [n, 16, 1]) : null },
        { inst: 'kick', min: 0, vol: 0.1, pat: (b, s) => [0, 3].includes(s) ? [[0, 1, s ? 0.6 : 1]] : null },
        { inst: 'wood', min: 0, vol: 0.035, freq: true, pat: (b, s) => s % 4 === 0 ? [[s % 8 ? 600 : 760, 1, 1]] : null },
        { inst: 'pizz', min: 1, vol: 0.05, pat: (b, s, c) => [6, 14].includes(s) ? [[c[0], 1, 1]] : null },
      ] },
    // Cross-examination: a driving D minor ostinato and brass stabs, with more layers as testimony breaks.
    trial: { bpm: 128, steps: 16, chords: [[62, 'm'], [58, 'maj'], [55, 'm'], [57, '7']],
      layers: [
        { inst: 'synbass', min: 0, vol: 0.09, pat: (b, s, c) => s % 2 === 0 ? [[c[0] - 24 + (s % 8 === 6 ? 7 : 0), 2, s % 4 === 0 ? 1 : 0.7]] : null },
        { inst: 'hat', min: 0, vol: 0.03, pat: (b, s) => s % 2 === 0 ? [[0, 1, s % 4 ? 0.6 : 1]] : null },
        { inst: 'kick', min: 0, vol: 0.13, pat: (b, s) => [0, 6, 8].includes(s) ? [[0, 1, 1]] : null },
        { inst: 'brass', min: 0, vol: 0.05, pat: (b, s, c) => s === 0 ? chordNotes(c, 4).slice(0, 3).map((n) => [n, 3, 1]) : null },
        { inst: 'snare', min: 1, vol: 0.06, pat: (b, s) => [4, 12].includes(s) ? [[0, 1, 1]] : null },
        { inst: 'strings', min: 1, vol: 0.03, pat: (b, s, c) => s === 0 ? chordNotes(c, 4).map((n) => [n, 16, 1]) : null },
        { inst: 'brass', min: 2, vol: 0.05, pat: (b, s) => TRIAL_MEL[b % 4][s] ? [TRIAL_MEL[b % 4][s]] : null },
        { inst: 'timp', min: 3, vol: 0.12, pat: (b, s, c) => [0, 10].includes(s) ? [[c[0] - 24, 1, 1]] : null },
      ] },
    // The title screen: the bossa, slow and lazy.
    title: { bpm: 92, steps: 16, swing: 0.12, chords: [[65, 'maj7'], [62, 'm7'], [67, 'm7'], [60, '7']],
      layers: [
        { inst: 'upright', min: 0, vol: 0.11, pat: walk },
        { inst: 'epiano', min: 0, vol: 0.04, pat: bossaComp },
        { inst: 'shaker', min: 0, vol: 0.018, pat: (b, s) => s % 2 === 0 ? [[0, 1, 1]] : null },
        { inst: 'vibes', min: 0, vol: 0.045, pat: (b, s) => MUZAK_MEL[(b * 2) % 8][s] ? [MUZAK_MEL[(b * 2) % 8][s]] : null },
      ] },
  };

  let music = { id: null, timer: null, step: 0, bar: 0, next: 0, out: null, intensity: 0 };
  function applyMusicGain() { if (buses.music) buses.music.gain.setTargetAtTime(musicVol * (ducked ? 0.42 : 1), ac.currentTime, 0.15); }
  function setMusic(id) {
    if (!ac) return;
    if (music.id === id) return;
    if (music.timer) clearInterval(music.timer);
    if (music.out) { const o = music.out; o.gain.setTargetAtTime(0, ac.currentTime, 0.35); setTimeout(() => { try { o.disconnect(); } catch (e) {} }, 2500); }
    music = { id, timer: null, step: 0, bar: 0, next: ac.currentTime + 0.12, out: null, intensity: 0 };
    if (!id || !THEMES[id]) return;
    const th = THEMES[id], out = ac.createGain();
    out.gain.value = 1; out.connect(buses.music); music.out = out;
    const stepDur = 60 / th.bpm / 4;
    music.timer = setInterval(() => {
      if (paused) return;
      while (music.next < ac.currentTime + 0.3) {
        const s = music.step % th.steps, bar = music.bar, chord = th.chords[bar % th.chords.length];
        const t = music.next + (s % 2 ? (th.swing || 0) * stepDur : 0);
        if (!muted && vol > 0) for (const ly of th.layers) {
          if (music.intensity < ly.min || (ly.max !== undefined && music.intensity > ly.max)) continue;
          const notes = ly.pat(bar, s, chord);
          if (!notes) continue;
          for (const [n, len, vel] of notes) INST[ly.inst](ly.freq ? n : NOTE(n), t, len * stepDur, ly.vol * vel, out);
        }
        music.next += stepDur; music.step++;
        if (music.step % th.steps === 0) music.bar++;
      }
    }, 50);
  }
  // 0 calm, 1 something has happened, 2 time is running out, 3 (trial) about to win
  function setIntensity(n) { music.intensity = n; }
  function duck(on) { ducked = on; if (ac) applyMusicGain(); }

  // ---------------- ambience ----------------
  // Each room has a bed of sound: the elevator hums and creaks; the chapel breathes and its pews groan;
  // the plane is a wall of engine noise with the odd chime.
  function setScene(id) {
    if (!ac) return;
    stopAmbience();
    if (!id) return;
    setRoom(id === 'elevator' ? 0.45 : id === 'plane' ? 0.6 : 2.6, id === 'elevator' ? 0.7 : id === 'plane' ? 0.5 : 0.35);
    const out = ac.createGain(); out.gain.value = 0.0001; out.connect(buses.amb); out.gain.setTargetAtTime(1, ac.currentTime, 1.2);
    const nodes = [], t = ac.currentTime;
    if (id === 'elevator') {
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.connect(out);
      const hg = ac.createGain(); hg.gain.value = 0.032; hg.connect(lp);
      nodes.push(osc('sawtooth', 55, t, t + 3600, hg), osc('sawtooth', 110.6, t, t + 3600, hg));
      const wob = ac.createOscillator(), wg = ac.createGain(); wob.frequency.value = 0.3; wg.gain.value = 0.015; wob.connect(wg); wg.connect(hg.gain); wob.start(); nodes.push(wob);
      const n = noise(), bp = ac.createBiquadFilter(), ng = ac.createGain(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6; ng.gain.value = 0.012;
      n.connect(bp); bp.connect(ng); ng.connect(out); n.start(); nodes.push(n);
    } else if (id === 'plane') {
      const n = noise(), lp = ac.createBiquadFilter(), ng = ac.createGain(); lp.type = 'lowpass'; lp.frequency.value = 320; ng.gain.value = 0.16;
      n.connect(lp); lp.connect(ng); ng.connect(out); n.start(); nodes.push(n);
      const hg = ac.createGain(); hg.gain.value = 0.018; hg.connect(out);
      nodes.push(osc('sine', 82, t, t + 3600, hg), osc('sine', 123.5, t, t + 3600, hg));
    } else {
      const n = noise(), lp = ac.createBiquadFilter(), ng = ac.createGain(); lp.type = 'lowpass'; lp.frequency.value = 520; ng.gain.value = 0.06;
      n.connect(lp); lp.connect(ng); ng.connect(out); n.start(); nodes.push(n);
    }
    amb = { out, nodes, timer: setInterval(() => ambientEvent(id, out), 1000) };
  }
  function ambientEvent(id, out) {
    if (paused || !ok()) return;
    const t = now();
    if (id === 'elevator') { if (Math.random() < 0.09) creak(t, out, 0.04); return; }
    if (id === 'plane') { if (Math.random() < 0.025) INST.vibes(988, t, 0.8, 0.05, out); else if (Math.random() < 0.05) creak(t, out, 0.025); return; }
    if (Math.random() < 0.07) creak(t, out, 0.05);
    // a bird outside the stained glass
    if (Math.random() < 0.04) [0, 0.12, 0.2].forEach((d, i) => { const g = ac.createGain(); g.connect(out); env(g, t + d, 0.01, 0.012, 0.08); const o = osc('sine', 3200 + i * 400, t + d, t + d + 0.12, g); o.frequency.exponentialRampToValueAtTime(4200 + i * 300, t + d + 0.08); });
  }
  // a resonant sweep: cables in the shaft, or an old pew
  function creak(t, out, v) {
    const n = noise(), bp = ac.createBiquadFilter(), g = ac.createGain();
    bp.type = 'bandpass'; bp.Q.value = 18; const f0 = 300 + Math.random() * 500;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.linearRampToValueAtTime(f0 * (0.7 + Math.random() * 0.6), t + 0.6);
    env(g, t, 0.15, v, 0.6); n.connect(bp); bp.connect(g); g.connect(out || buses.amb); n.start(t); n.stop(t + 0.9);
  }
  function stopAmbience() {
    if (!amb) return;
    clearInterval(amb.timer);
    const a = amb; amb = null;
    a.out.gain.setTargetAtTime(0.0001, ac.currentTime, 0.4);
    setTimeout(() => { a.nodes.forEach((n) => { try { n.stop(); } catch (e) {} }); try { a.out.disconnect(); } catch (e) {} }, 2500);
  }
  function floorTick() { if (!ok()) return; tone(1900, now(), 0.05, { vol: 0.025, out: buses.amb }); }

  // ---------------- the main event ----------------
  // A fart has a pitched body that flutters, turbulent noise shaped by a moving formant,
  // and sometimes a sputtering tail. Size comes from what they ate.
  function fart(type, x, v = 1, { size = 1 } = {}) {
    if (!ok()) return;
    const t = now() + 0.02, out = panTo(x, buses.sfx);
    const r = (a, b) => a + Math.random() * (b - a);
    const dur = type === 'trumpet' ? r(0.9, 1.5) * size : type === 'squeaker' ? r(0.35, 0.6) : type === 'puff' ? 0.3 : r(0.6, 0.9);
    const base = type === 'trumpet' ? r(68, 95) : type === 'squeaker' ? r(260, 380) : type === 'puff' ? 160 : 120;
    const g = ac.createGain(); g.connect(out);
    const peak = (type === 'sbd' ? 0.06 : type === 'puff' ? 0.12 : 0.5) * v;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.03);
    g.gain.setValueAtTime(peak * 0.9, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (type !== 'sbd') {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      const pts = new Float32Array(24);
      for (let i = 0; i < pts.length; i++) { const k = i / (pts.length - 1); pts[i] = base * (1.15 - 0.4 * k) * r(0.88, 1.12) * (type === 'squeaker' ? 1 + Math.sin(k * 9) * 0.12 : 1); }
      o.frequency.setValueCurveAtTime(pts, t, dur);
      const flut = ac.createOscillator(), fg = ac.createGain(), am = ac.createGain();
      flut.type = 'square'; flut.frequency.setValueAtTime(r(18, 30), t); flut.frequency.linearRampToValueAtTime(r(28, 42), t + dur);
      fg.gain.value = 0.45; am.gain.value = 0.55; flut.connect(fg); fg.connect(am.gain);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 7;
      lp.frequency.setValueAtTime(type === 'squeaker' ? 2200 : 900, t); lp.frequency.exponentialRampToValueAtTime(type === 'squeaker' ? 1200 : 380, t + dur);
      o.connect(lp); lp.connect(am); am.connect(g);
      o.start(t); flut.start(t); o.stop(t + dur + 0.05); flut.stop(t + dur + 0.05);
    }
    const n = noise(), bp = ac.createBiquadFilter(), ng = ac.createGain();
    bp.type = 'bandpass'; bp.Q.value = type === 'sbd' ? 0.8 : 2.2;
    bp.frequency.setValueAtTime(type === 'sbd' ? 2600 : r(300, 600), t); bp.frequency.exponentialRampToValueAtTime(type === 'sbd' ? 1800 : r(180, 300), t + dur);
    ng.gain.value = type === 'sbd' ? 0.7 : 0.32; n.connect(bp); bp.connect(ng); ng.connect(g); n.start(t); n.stop(t + dur + 0.05);
    if (type === 'trumpet' && Math.random() < 0.8) for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) {
      const tt = t + dur + 0.06 + i * r(0.07, 0.13), gg = ac.createGain(); gg.connect(out); env(gg, tt, 0.005, peak * 0.5, 0.06);
      const oo = osc('sawtooth', base * r(1.1, 1.6), tt, tt + 0.08, gg); oo.frequency.exponentialRampToValueAtTime(base, tt + 0.07);
    }
  }

  // ---------------- voices ----------------
  // Each character's blip has a timbre: a low square for the CEO, a bright triangle for the intern.
  function blip(pitch = 300, ch = 'a', at = 0, bus = null) {
    if (!ok()) return;
    const t = now() + at, vowel = /[aeiouy]/i.test(ch), q = /[?!]/.test(ch);
    const f = pitch * (vowel ? 1.12 : 0.94) * (0.94 + Math.random() * 0.12) * (q ? 1.2 : 1);
    const wave = pitch < 260 ? 'square' : pitch < 450 ? 'sawtooth' : 'triangle';
    const g = ac.createGain(); g.connect(bus || buses.voice); env(g, t, 0.006, wave === 'triangle' ? 0.32 : 0.2, 0.055);
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = pitch * (vowel ? 2 : 1.5); bp.Q.value = 0.7; bp.connect(g);
    const o = osc(wave, f, t, t + 0.08, bp);
    o.frequency.linearRampToValueAtTime(f * (q ? 1.15 : 0.97), t + 0.06);
  }

  // Someone in the room says something: a few quiet syllables in their voice, from where they stand.
  function chatter(pitch, x, text = '', vol = 0.4) {
    if (!ok()) return;
    const out = ac.createGain(); out.gain.value = vol; out.connect(panTo(x, buses.voice));
    const letters = text.replace(/[^a-z?!]/gi, ''), n = Math.min(7, 2 + Math.floor(letters.length / 14));
    for (let i = 0; i < n; i++) blip(pitch, letters[i * 3] || 'a', i * 0.085 + Math.random() * 0.02, out);
  }

  // ---------------- interface and foley ----------------
  function ui(kind = 'tick') {
    if (!ok()) return;
    const t = now(), out = buses.sfx;
    if (kind === 'tick') { burst(t, 0.03, { type: 'highpass', freq: 2500, vol: 0.06, out }); tone(1100, t, 0.04, { type: 'triangle', vol: 0.03, out }); }
    if (kind === 'clue') {
      for (let i = 0; i < 4; i++) burst(t + i * 0.045, 0.035, { freq: 2600 + Math.random() * 1500, q: 2, vol: 0.05, out });
      tone(988, t + 0.18, 0.25, { type: 'triangle', vol: 0.06, out }); tone(1319, t + 0.26, 0.35, { type: 'triangle', vol: 0.05, out });
    }
    if (kind === 'bad') { const g = ac.createGain(); g.connect(out); env(g, t, 0.02, 0.09, 0.45); const o = osc('sawtooth', 196, t, t + 0.5, g); o.frequency.exponentialRampToValueAtTime(110, t + 0.45); }
    if (kind === 'good') [659, 880].forEach((f, i) => tone(f, t + i * 0.08, 0.3, { type: 'triangle', vol: 0.07, out }));
    if (kind === 'lock') [523, 659, 784, 1047].forEach((f, i) => INST.vibes(f, t + i * 0.08, 0.3, 0.06, out));
    if (kind === 'page') burst(t, 0.22, { freq: 900, q: 0.7, vol: 0.1, out, sweepTo: 3200, attack: 0.04 });
    if (kind === 'tip') [1047, 1568].forEach((f, i) => INST.vibes(f, t + i * 0.1, 0.4, 0.04, out));
  }
  function stamp() {
    if (!ok()) return;
    const t = now();
    burst(t, 0.25, { type: 'lowpass', freq: 320, vol: 0.9 });
    INST.kick(0, t, 0, 0.5, buses.sfx);
    [261, 311, 370].forEach((fr) => INST.brass(fr, t + 0.04, 0.35, 0.035, buses.sfx));
  }
  function whoosh(up = true) { if (!ok()) return; burst(now(), 0.55, { freq: up ? 300 : 2000, sweepTo: up ? 2600 : 250, q: 3, vol: 0.3, attack: 0.1 }); }
  function sniff() { if (!ok()) return; const t = now(); for (let i = 0; i < 2; i++) burst(t + i * 0.17, 0.13, { type: 'highpass', freq: 2400, vol: 0.22, attack: 0.04 }); }
  function step(surface) {
    if (!ok()) return;
    const t = now();
    if (surface === 'elevator') burst(t, 0.06, { type: 'lowpass', freq: 260, vol: 0.06 });
    else { tone(170 + Math.random() * 30, t, 0.05, { vol: 0.05 }); burst(t, 0.03, { freq: 1100, q: 2, vol: 0.03 }); }
  }
  function gag(x) { if (!ok()) return; burst(now(), 0.18, { freq: 700, q: 4, vol: 0.06, out: panTo(x, buses.voice), sweepTo: 350 }); }
  function gurgle(v = 0.5) {
    if (!ok()) return;
    const t = now(), o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(55, t);
    for (let i = 0; i < 7; i++) o.frequency.linearRampToValueAtTime(40 + Math.random() * 70, t + 0.1 + i * 0.11);
    f.type = 'lowpass'; f.frequency.value = 260; f.Q.value = 9;
    env(g, t, 0.05, 0.42 * v, 0.8); o.connect(f); f.connect(g); g.connect(buses.sfx); o.start(t); o.stop(t + 0.95);
    for (let i = 0; i < 3; i++) tone(90 + Math.random() * 60, t + 0.2 + i * 0.18, 0.08, { vol: 0.08 * v });
  }
  function ding() { if (!ok()) return; const t = now(); INST.vibes(1319, t, 1, 0.12, buses.sfx); INST.vibes(1047, t + 0.35, 1, 0.12, buses.sfx); }
  function ringtone() {
    if (!ok()) return;
    const t = now();
    for (let k = 0; k < 3; k++) [1568, 1318, 1568, 1318].forEach((f, i) => tone(f, t + k * 1 + i * 0.09, 0.08, { type: 'square', vol: 0.05 }));
  }
  function loudEvent(label) {
    if (!ok()) return;
    const t = now();
    if (/DING/.test(label)) return ding();
    if (/engines|TURBULENCE/i.test(label)) { burst(t, /TURB/.test(label) ? 5.5 : 3.5, { type: 'lowpass', freq: 180, vol: 1.2, attack: 0.4 }); if (/TURB/.test(label)) for (let i = 0; i < 8; i++) INST.wood(300 + Math.random() * 200, t + i * 0.55 + Math.random() * 0.2, 0, 0.06, buses.sfx); return; }
    if (/bark/i.test(label)) { [0, 0.22].forEach((d) => burst(t + d, 0.14, { freq: 700, q: 3, vol: 0.5, sweepTo: 380, attack: 0.01 })); return; }
    if (/announcement/i.test(label)) { ding(); burst(t + 0.6, 2.4, { freq: 1300, q: 1.2, vol: 0.12 }); return; }
    if (/phone/i.test(label)) return ringtone();
    if (/key change/i.test(label)) { [65, 69, 72, 77].forEach((n, i) => INST.epiano(NOTE(n + 1), t + i * 0.1, 0.4, 0.08, buses.sfx)); return; }
    if (/sneez/i.test(label)) { tone(700, t, 0.3, { type: 'triangle', vol: 0.08 }); burst(t + 0.32, 0.5, { freq: 1800, vol: 0.7, sweepTo: 900 }); return; }
    if (/hearing/i.test(label)) { tone(3200, t, 2.6, { vol: 0.06, attack: 0.2 }); return; }
    if (/shaker/i.test(label)) { for (let i = 0; i < 4; i++) INST.wood(500 - i * 60, t + i * 0.12, 0, 0.12 / (i + 1), buses.sfx); return; }
    burst(t, 0.7, { type: 'lowpass', freq: /door/i.test(label) ? 250 : 1600, vol: 1 });
    INST.kick(0, t, 0, 0.5, buses.sfx);
  }
  function sting(kind = 'title') {
    if (!ok()) return;
    const t = now(), out = buses.sfx;
    if (kind === 'title') [[60, 0], [64, 0.1], [67, 0.2], [72, 0.3]].forEach(([n, d]) => INST.brass(NOTE(n), t + d, 0.3, 0.05, out));
    if (kind === 'objection') { [55, 58, 62].forEach((n) => INST.brass(NOTE(n), t, 0.6, 0.06, out)); INST.timp(NOTE(43), t, 0, 0.3, out); }
    if (kind === 'break') { INST.brass(NOTE(74), t, 0.12, 0.07, out); INST.brass(NOTE(81), t + 0.1, 0.35, 0.07, out); INST.kick(0, t, 0, 0.35, out); }
    if (kind === 'reveal') { [74, 73, 72, 71].forEach((n, i) => INST.bassoon(NOTE(n - 24), t + i * 0.12, 0.12, 0.08, out)); }
  }
  // the end-of-case jingle: a fanfare, a shrug, or the sad trombone
  function jingle(rank) {
    if (!ok()) return;
    const t = now() + 0.15, out = buses.music;
    if (rank === 'S' || rank === 'A') {
      [[72, 0, 0.2], [76, 0.18, 0.2], [79, 0.36, 0.2], [84, 0.54, 0.7]].forEach(([n, d, len]) => INST.brass(NOTE(n), t + d, len, 0.07, out));
      INST.timp(NOTE(48), t + 0.54, 0, 0.25, out); INST.tri(0, t + 0.54, 0, 0.04, out);
    } else if (rank === 'B' || rank === 'C') {
      [[67, 0, 0.2], [72, 0.2, 0.2], [71, 0.4, 0.5]].forEach(([n, d, len]) => INST.clarinet(NOTE(n), t + d, len, 0.07, out));
    } else {
      // wah, wah, wah, waaah
      [[63, 0, 0.45], [62, 0.5, 0.45], [61, 1.0, 0.45], [60, 1.5, 1.2]].forEach(([n, d, len], i) => {
        const g = ac.createGain(); g.connect(out); env(g, t + d, 0.04, 0.08, len, 0.02); g.gain.setTargetAtTime(0.0001, t + d + len, 0.1);
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t + d); lp.frequency.linearRampToValueAtTime(1400, t + d + 0.2); lp.frequency.linearRampToValueAtTime(600, t + d + len); lp.connect(g);
        const o = osc('sawtooth', NOTE(n - 12), t + d, t + d + len + 0.3, lp);
        if (i === 3) { const vb = ac.createOscillator(), vg = ac.createGain(); vb.frequency.value = 6; vg.gain.value = 4; vb.connect(vg); vg.connect(o.frequency); vb.start(t + d + 0.3); vb.stop(t + d + len + 0.3); }
      });
    }
  }

  // Wagner's Bridal Chorus on a pipe organ, with the chapel's long reverb.
  function organ(seconds = 22) {
    if (!ok()) return;
    stopOrgan();
    const t0 = now() + 0.1, out = ac.createGain();
    out.gain.value = 1; out.connect(buses.music); organNodes.push(out);
    const N = { G4: 67, C5: 72, D5: 74, B4: 71, E5: 76, F5: 77 };
    const tune = [['G4', 1], ['C5', 0.75], ['C5', 0.25], ['C5', 2], ['G4', 1], ['D5', 0.75], ['B4', 0.25], ['C5', 2],
      ['G4', 1], ['C5', 0.75], ['F5', 0.25], ['F5', 1.5], ['E5', 0.5], ['D5', 0.75], ['C5', 0.25], ['B4', 0.75], ['C5', 0.25], ['D5', 2]];
    const beat = 0.62;
    let t = t0;
    while (t < t0 + seconds - 1) {
      for (const [n, d] of tune) {
        if (t > t0 + seconds - 1) break;
        INST.organ(NOTE(N[n]), t, d * beat * 0.95, 0.09, out);
        t += d * beat;
      }
    }
    [48, 55].forEach((n) => INST.organ(NOTE(n), t0, seconds, 0.04, out));
  }
  function stopOrgan() {
    if (!ac) return;
    organNodes.forEach((n) => { try { n.gain.setTargetAtTime(0, ac.currentTime, 0.2); } catch (e) {} });
    organNodes = [];
  }

  // A room full of people talking quietly.
  function startMurmur() {
    if (!ok() || murmur) return;
    const n = noise(), f = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.9;
    f2.type = 'peaking'; f2.frequency.value = 900; f2.gain.value = 6;
    g.gain.value = 0.04; lfo.frequency.value = 0.6; lg.gain.value = 0.018;
    lfo.connect(lg); lg.connect(g.gain);
    n.connect(f); f.connect(f2); f2.connect(g); g.connect(buses.amb); n.start(); lfo.start();
    murmur = { n, g, lfo };
  }
  function stopMurmur() {
    if (!murmur) return;
    murmur.g.gain.setTargetAtTime(0, ac.currentTime, 0.6);
    const m = murmur; murmur = null;
    setTimeout(() => { try { m.n.stop(); m.lfo.stop(); } catch (e) {} }, 2500);
  }

  // Output level, for the playtest tools and automated checks: peak and RMS of the last ~40 ms.
  function meter() {
    if (!meterNode) return { peak: 0, rms: 0 };
    const a = new Float32Array(meterNode.fftSize); meterNode.getFloatTimeDomainData(a);
    let p = 0, r = 0; for (const v of a) { p = Math.max(p, Math.abs(v)); r += v * v; }
    return { peak: p, rms: Math.sqrt(r / a.length), state: ac.state };
  }
  const debugState = () => ({ music: music.id, intensity: music.intensity, ducked, scene: !!amb });

  return {
    meter, debugState,
    init, setMuted, setVolumes, setPaused, get muted() { return muted; }, setScene, setMusic, setIntensity, duck, floorTick,
    fart, blip, chatter, ui, stamp, whoosh, sniff, step, gag, gurgle, ding, ringtone, loudEvent, sting, jingle, organ, stopOrgan, startMurmur, stopMurmur,
  };
})();
