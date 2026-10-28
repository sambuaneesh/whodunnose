'use strict';
// Every sound is synthesized: farts (stereo-panned to where they happened), the organ,
// crowd murmur, sneezes and Animal Crossing-style talk blips. No audio files.
const Sfx = (() => {
  let ac = null, master = null, muted = false, murmur = null, organNodes = [];

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
    } catch (e) { ac = null; }
  }
  function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.7; }
  const ok = () => ac && !muted;

  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true; return src;
  }
  function panner(x) {
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (p) { p.pan.value = U.clamp((x / W) * 2 - 1, -1, 1) * 0.9; p.connect(master); return p; }
    return master;
  }

  // type: squeaker | trumpet | sbd | wet
  function fart(type, x = W / 2, vol = 1) {
    if (!ok()) return;
    const t = ac.currentTime, out = panner(x);
    const dur = type === 'trumpet' ? 1.3 : type === 'squeaker' ? 0.5 : type === 'sbd' ? 0.7 : 0.9;
    const base = type === 'trumpet' ? 72 : type === 'squeaker' ? 260 : 110;
    const g = ac.createGain(); g.connect(out);
    const peak = (type === 'sbd' ? 0.05 : 0.5) * vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.04);
    g.gain.setValueAtTime(peak, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (type !== 'sbd') {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 1.15, t);
      o.frequency.exponentialRampToValueAtTime(base * 0.75, t + dur);
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = type === 'squeaker' ? 34 : 22; lg.gain.value = base * 0.35;
      lfo.connect(lg); lg.connect(o.frequency);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = type === 'squeaker' ? 1800 : 700; f.Q.value = 6;
      o.connect(f); f.connect(g);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    }
    const n = noise(), nf = ac.createBiquadFilter(), ng = ac.createGain();
    nf.type = 'bandpass'; nf.frequency.value = type === 'sbd' ? 3000 : 400; nf.Q.value = 1.2;
    ng.gain.value = type === 'sbd' ? 0.6 : 0.35;
    n.connect(nf); nf.connect(ng); ng.connect(g); n.start(t); n.stop(t + dur + 0.05);
  }

  function tone(freq, t, dur, { type = 'sine', vol = 0.15, out = master, attack = 0.01 } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
    return o;
  }

  function blip(pitch = 300) {
    if (!ok()) return;
    tone(pitch * (0.9 + Math.random() * 0.25), ac.currentTime, 0.06, { type: 'square', vol: 0.035 });
  }
  function ui(kind = 'tick') {
    if (!ok()) return;
    const t = ac.currentTime;
    if (kind === 'tick') tone(880, t, 0.05, { type: 'triangle', vol: 0.06 });
    if (kind === 'clue') { tone(660, t, 0.12, { type: 'triangle', vol: 0.1 }); tone(990, t + 0.08, 0.18, { type: 'triangle', vol: 0.1 }); }
    if (kind === 'bad') { tone(220, t, 0.25, { type: 'sawtooth', vol: 0.06 }); tone(165, t + 0.12, 0.3, { type: 'sawtooth', vol: 0.06 }); }
    if (kind === 'good') [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.07, 0.25, { type: 'triangle', vol: 0.09 }));
    if (kind === 'lock') [392, 523, 659, 1046].forEach((f, i) => tone(f, t + i * 0.09, 0.4, { type: 'triangle', vol: 0.1 }));
  }
  function stamp() {
    if (!ok()) return;
    const t = ac.currentTime, n = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'lowpass'; f.frequency.value = 300; g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 0.3);
    tone(55, t, 0.4, { type: 'sine', vol: 0.5 });
    [261, 311, 370].forEach((fr) => tone(fr, t + 0.05, 0.6, { type: 'sawtooth', vol: 0.04 }));
  }
  function whoosh(up = true) {
    if (!ok()) return;
    const t = ac.currentTime, n = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(up ? 300 : 2000, t); f.frequency.exponentialRampToValueAtTime(up ? 2400 : 250, t + 0.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 0.6);
  }
  function sniff() {
    if (!ok()) return;
    const t = ac.currentTime;
    for (let i = 0; i < 2; i++) {
      const n = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = 'highpass'; f.frequency.value = 2500;
      g.gain.setValueAtTime(0.0001, t + i * 0.18); g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.15);
      n.connect(f); f.connect(g); g.connect(master); n.start(t + i * 0.18); n.stop(t + i * 0.18 + 0.2);
    }
  }
  function loudEvent(label) {
    if (!ok()) return;
    const t = ac.currentTime;
    if (/DING/.test(label)) { ding(); return; }
    if (/phone/i.test(label)) { ringtone(); return; }
    if (/key change/i.test(label)) { [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.12, 0.4, { type: 'sine', vol: 0.06 })); return; }
    if (/sneez/i.test(label)) {
      tone(700, t, 0.25, { type: 'triangle', vol: 0.08 });
      const n = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = 'bandpass'; f.frequency.value = 1800; g.gain.setValueAtTime(0.0001, t + 0.3); g.gain.exponentialRampToValueAtTime(0.7, t + 0.33); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      n.connect(f); f.connect(g); g.connect(master); n.start(t + 0.3); n.stop(t + 0.85);
    } else if (/hearing/i.test(label)) {
      tone(3200, t, 2.6, { type: 'sine', vol: 0.06, attack: 0.2 });
    } else {
      const n = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = 'lowpass'; f.frequency.value = /door/i.test(label) ? 250 : 1600;
      g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 0.8);
      tone(70, t, 0.4, { vol: 0.5 });
    }
  }

  // Wagner's Bridal Chorus, close enough to be recognised by everyone at the wedding.
  function organ(seconds = 22) {
    if (!ok()) return;
    stopOrgan();
    const t0 = ac.currentTime + 0.1, out = ac.createGain();
    out.gain.value = 0.9; out.connect(master); organNodes.push(out);
    const N = { G4: 392, C5: 523.3, D5: 587.3, B4: 493.9, E5: 659.3, F5: 698.5, A4: 440, G5: 784 };
    const tune = [['G4', 1], ['C5', 0.75], ['C5', 0.25], ['C5', 2], ['G4', 1], ['D5', 0.75], ['B4', 0.25], ['C5', 2],
      ['G4', 1], ['C5', 0.75], ['F5', 0.25], ['F5', 1.5], ['E5', 0.5], ['D5', 0.75], ['C5', 0.25], ['B4', 0.75], ['C5', 0.25], ['D5', 2]];
    const beat = 0.62;
    let t = t0;
    while (t < t0 + seconds - 1) {
      for (const [n, d] of tune) {
        if (t > t0 + seconds - 1) break;
        const f = N[n];
        [1, 2, 0.5].forEach((m, i) => tone(f * m, t, d * beat * 0.95, { type: i === 1 ? 'square' : 'sine', vol: i === 1 ? 0.02 : 0.06, out, attack: 0.04 }));
        t += d * beat;
      }
    }
    // pedal drone
    [130.8, 196].forEach((f) => tone(f, t0, seconds, { type: 'sawtooth', vol: 0.025, out, attack: 0.5 }));
  }
  function stopOrgan() {
    if (!ac) return;
    organNodes.forEach((n) => { try { n.gain.setTargetAtTime(0, ac.currentTime, 0.2); } catch (e) {} });
    organNodes = [];
  }

  function startMurmur() {
    if (!ok() || murmur) return;
    const n = noise(), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    f.type = 'bandpass'; f.frequency.value = 450; f.Q.value = 0.8;
    g.gain.value = 0.035; lfo.frequency.value = 0.7; lg.gain.value = 0.015;
    lfo.connect(lg); lg.connect(g.gain);
    n.connect(f); f.connect(g); g.connect(master); n.start(); lfo.start();
    murmur = { n, g, lfo };
  }
  function stopMurmur() {
    if (!murmur) return;
    murmur.g.gain.setTargetAtTime(0, ac.currentTime, 0.6);
    const m = murmur; murmur = null;
    setTimeout(() => { try { m.n.stop(); m.lfo.stop(); } catch (e) {} }, 2500);
  }

  function gurgle(vol = 0.5) {
    if (!ok()) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(55, t);
    for (let i = 0; i < 6; i++) o.frequency.linearRampToValueAtTime(45 + Math.random() * 60, t + 0.1 + i * 0.12);
    f.type = 'lowpass'; f.frequency.value = 260; f.Q.value = 8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4 * vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.9);
  }
  function ding() {
    if (!ok()) return;
    const t = ac.currentTime;
    tone(1318, t, 1.2, { type: 'sine', vol: 0.12 }); tone(1046, t + 0.35, 1.4, { type: 'sine', vol: 0.12 });
  }
  function ringtone() {
    if (!ok()) return;
    const t = ac.currentTime;
    for (let k = 0; k < 3; k++) [1568, 1318, 1568, 1318].forEach((f, i) => tone(f, t + k * 1 + i * 0.09, 0.08, { type: 'square', vol: 0.05 }));
  }
  function sting(kind = 'title') {
    if (!ok()) return;
    const t = ac.currentTime;
    if (kind === 'title') [[262, 0], [330, 0.12], [392, 0.24], [523, 0.36], [392, 0.6], [523, 0.72]].forEach(([f, d]) => tone(f, t + d, 0.3, { type: 'square', vol: 0.05 }));
    if (kind === 'objection') { [[196, 0], [233, 0.08], [262, 0.16]].forEach(([f, d]) => tone(f, t + d, 0.5, { type: 'sawtooth', vol: 0.07 })); tone(98, t, 0.8, { vol: 0.3 }); }
    if (kind === 'break') { tone(880, t, 0.1, { type: 'square', vol: 0.06 }); tone(660, t + 0.08, 0.3, { type: 'square', vol: 0.06 }); tone(110, t, 0.4, { vol: 0.3 }); }
  }

  // ---------------- music ----------------
  // A tiny step sequencer. Each track: tempo, bass line, melody line (null = rest), and voices.
  const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const TRACKS = {
    // a bouncy, slightly sneaky bassoon-and-pizzicato theme for mingling
    mingle: { bpm: 112, steps: 16, bass: [48, null, 55, null, 57, null, 55, null, 53, null, 55, null, 52, null, 55, null],
      mel: [72, null, 74, 76, null, 79, 76, null, 77, null, 76, 74, null, 72, null, null], bassType: 'square', melType: 'triangle', bassVol: 0.035, melVol: 0.03, swing: 0.1 },
    // elevator bossa: soft chords and a walking bass
    muzak: { bpm: 96, steps: 16, bass: [45, null, 52, null, 50, null, 57, null, 43, null, 50, null, 48, null, 55, null],
      mel: [76, null, null, 74, null, 72, null, 69, 71, null, null, 72, null, 74, null, null], chords: [[57, 60, 64, 67], [50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59]],
      bassType: 'sine', melType: 'sine', bassVol: 0.05, melVol: 0.03, swing: 0.15 },
    // low drone and a ticking clock for silence and trials
    tension: { bpm: 84, steps: 16, bass: [40, null, null, null, null, null, null, null, 41, null, null, null, null, null, null, null],
      mel: [null, null, null, null, null, null, 64, null, null, null, null, null, null, null, 63, null], tick: true, bassType: 'sawtooth', melType: 'sine', bassVol: 0.03, melVol: 0.02 },
    trial: { bpm: 132, steps: 16, bass: [40, null, 40, null, 43, null, 40, null, 38, null, 38, null, 41, null, 43, null],
      mel: [64, null, null, 67, null, null, 69, null, 70, null, 69, null, 67, null, 64, null], tick: true, bassType: 'square', melType: 'square', bassVol: 0.03, melVol: 0.018 },
  };
  let music = { id: null, timer: null, step: 0, next: 0, out: null };
  function setMusic(id) {
    if (!ac) return;
    if (music.id === id) return;
    if (music.timer) clearInterval(music.timer);
    if (music.out) { const o = music.out; o.gain.setTargetAtTime(0, ac.currentTime, 0.4); setTimeout(() => o.disconnect(), 2000); }
    music = { id, timer: null, step: 0, next: ac.currentTime + 0.1, out: null };
    if (!id) return;
    const tr = TRACKS[id], out = ac.createGain();
    out.gain.value = 1; out.connect(master); music.out = out;
    const stepDur = 60 / tr.bpm / 4;
    music.timer = setInterval(() => {
      while (music.next < ac.currentTime + 0.25) {
        const i = music.step % tr.steps, t = music.next + (i % 2 ? (tr.swing || 0) * stepDur : 0);
        if (tr.bass[i] != null) tone(N(tr.bass[i]), t, stepDur * 1.8, { type: tr.bassType, vol: tr.bassVol, out });
        if (tr.mel[i] != null) tone(N(tr.mel[i]), t, stepDur * 1.2, { type: tr.melType, vol: tr.melVol, out });
        if (tr.chords && i % 4 === 0) tr.chords[Math.floor(i / 4) % tr.chords.length].forEach((n) => tone(N(n), t, stepDur * 3, { type: 'sine', vol: 0.012, out, attack: 0.03 }));
        if (tr.tick && i % 2 === 0) { const n = noise(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'highpass'; f.frequency.value = 6000; g.gain.setValueAtTime(i % 4 ? 0.02 : 0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.06); }
        music.next += stepDur; music.step++;
      }
    }, 60);
  }

  return { init, setMuted, get muted() { return muted; }, fart, blip, ui, stamp, whoosh, sniff, loudEvent, organ, stopOrgan, startMurmur, stopMurmur, gurgle, ding, ringtone, sting, setMusic };
})();
