'use strict';
// Playtest tools. Unlocked by visiting the game with ?playtest=pullmyfinger (or #pullmyfinger); turn off with
// ?playtest=off or from Settings. Gives a panel (backquote key) with god view, time control, cheats, live rules
// and a jump-to-any-case-and-seed launcher, so designers and testers can see exactly what the game is doing.
const Playtest = (() => {
  const CODE = 'pullmyfinger';
  let active = false, open = false, speed = 1, paused = false, timer = null;
  const flags = { culprit: true, gas: false, debug: true, cones: false, noTips: false };
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function init() {
    let q = null, h = '';
    try { q = new URLSearchParams(location.search).get('playtest'); h = location.hash.replace('#', ''); } catch (e) { /* no URL access */ }
    if (q === CODE || h === CODE) Store.set('playtest', true);
    if (q === 'off') Store.set('playtest', false);
    active = !!Store.settings().playtest;
    if (active) build();
  }
  function setActive(on) {
    Store.set('playtest', on); active = on;
    if (on && !$('#pt')) build();
    if (!on && $('#pt')) { $('#pt').remove(); $('#ptBadge').remove(); open = false; speed = 1; paused = false; }
  }

  function build() {
    const badge = document.createElement('button');
    badge.id = 'ptBadge'; badge.textContent = 'PLAYTEST  `'; badge.title = 'Playtest tools (backquote key)';
    badge.addEventListener('click', toggle);
    $('#stage').appendChild(badge);
    const panel = document.createElement('aside');
    panel.id = 'pt'; panel.hidden = true;
    $('#stage').appendChild(panel);
    panel.addEventListener('click', onClick);
    panel.addEventListener('change', onChange);
  }
  function toggle() {
    if (!active) return;
    open = !open; $('#pt').hidden = !open;
    if (open) { render(); timer = setInterval(() => { if (!document.activeElement || !$('#pt').contains(document.activeElement) || document.activeElement.tagName === 'BUTTON') render(); }, 500); }
    else clearInterval(timer);
  }

  // ---------------- panel ----------------
  function render() {
    const cs = G.cs, inCase = !!(cs && G.caseDef && ['play', 'dialogue', 'notebook', 'tip', 'accuse', 'paused'].includes(G.state));
    const nm = (id) => (id && castById(id) ? castById(id).name : '—');
    const m = Sfx.meter ? Sfx.meter() : { peak: 0, rms: 0 }, ds = Sfx.debugState ? Sfx.debugState() : {};
    const caseOpts = CASES.map((c, i) => `<option value="${i}">${c.num}. ${esc(c.title)}</option>`).join('') + '<option value="free-elevator">Free Play: elevator</option><option value="free-wedding">Free Play: chapel</option>';
    const rules = inCase ? Object.entries(RULES).filter(([, v]) => typeof v === 'boolean') : [];
    $('#pt').innerHTML = `
      <div class="pt-h"><b>Playtest</b><button data-pt="close">Close</button></div>
      <section><h4>Jump to</h4>
        <div class="pt-row"><select id="ptCase">${caseOpts}</select><input id="ptSeed" placeholder="seed" value="${inCase ? G.seed : ''}" inputmode="numeric"><button data-pt="go">Go</button><button data-pt="rnd">Random</button></div></section>
      ${inCase ? `
      ${cs.reverse ? `<section><h4>The truth (bonus case: you did it)</h4>
        <dl class="pt-dl">
          <dt>Case</dt><dd>${esc(G.caseDef.title)} · seed ${G.seed}</dd>
          <dt>You ate</dt><dd>${esc(cs.food.name)}</dd>
          <dt>Released</dt><dd>${G.flags.fart ? `t ${TIMELINE.fart.toFixed(1)} by the ${esc(cs.origin.name)} (${G.flags.releasedLoud ? 'under cover' : 'heard'})` : 'not yet'}</dd>
          <dt>Patsy</dt><dd>${esc(nm(cs.roles.patsy))} (also ate it)</dd>
          <dt>Witness</dt><dd>${esc(nm(cs.roles.witness))}${G.npcs.some((n) => n.hushed) ? ' (hushed)' : ''}</dd>
          <dt>Planted</dt><dd>${G.flags.planted ? esc(nm(G.flags.planted)) : 'no'}</dd>
          <dt>Room now</dt><dd>${Object.entries(Game.roomScores()).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k === 'player' ? '<b>YOU</b>' : esc(nm(k))} ${Math.round(v)}`).join(' · ')}</dd>
        </dl></section>` : `<section><h4>The truth</h4>
        <dl class="pt-dl">
          <dt>Case</dt><dd>${esc(G.caseDef.title)} · seed ${G.seed}</dd>
          <dt>Culprit</dt><dd class="hot">${esc(nm(cs.culprit))}${cs.isDog ? ' (scapegoat)' : ''}</dd>
          <dt>Ate</dt><dd>${esc(cs.food.name)} → ${esc(cs.food.smell)} · ${cs.fartType}</dd>
          <dt>Origin</dt><dd>${esc(cs.origin.name)}</dd>
          <dt>Cover-up</dt><dd>${esc(cs.cover.label)}</dd>
          <dt>Lies</dt><dd>${cs.claims[cs.culprit] && cs.claims[cs.culprit] !== cs.meals[cs.culprit] ? `says ${esc(foodById(cs.claims[cs.culprit]).name)}` : 'tells the truth'}</dd>
          <dt>Near decoy</dt><dd>${esc(nm(cs.roles.nearDecoy))}</dd>
          <dt>Food decoy</dt><dd>${esc(nm(cs.roles.foodDecoy))}</dd>
          <dt>Witness</dt><dd>${esc(nm(cs.roles.witness))}</dd>
          <dt>Facts</dt><dd>${Object.entries(cs.facts).map(([k, f]) => `${esc(nm(k))}: ${esc(f.kind)} about ${esc(nm(f.about))}`).join('<br>')}</dd>
        </dl></section>`}
      <section><h4>Now</h4>
        <div class="pt-stats">t ${G.t.toFixed(1)}s · ${G.state} · Aura ${Math.round(G.aura)} · Tummy ${Math.round(G.pressure)} · watchers ${G.watchers} · clues ${G.clues.length}</div>
        <div class="pt-row">${[0, 0.25, 0.5, 1, 2, 4].map((s) => `<button data-speed="${s}" class="${(s === 0 ? paused : !paused && speed === s) ? 'on' : ''}">${s === 0 ? 'Pause' : '×' + s}</button>`).join('')}</div>
        <div class="pt-row"><button data-pt="skip">+15 s</button>${cs.reverse ? '' : '<button data-pt="tofart">To the fart</button>'}<button data-pt="tocall">To call-out</button></div></section>
      <section><h4>God view</h4>
        ${[['culprit', 'Mark culprit, origin and where everyone stood'], ['gas', 'Always show the gas'], ['debug', 'NPC labels: suspicion, theory, knowledge'], ['cones', 'Everyone\'s vision cones'], ['noTips', 'Skip tips']].map(([k, l]) => `<label><input type="checkbox" data-flag="${k}" ${flags[k] ? 'checked' : ''}> ${l}</label>`).join('')}</section>
      <section><h4>Cheats</h4>
        <div class="pt-row"><button data-pt="reveal">Reveal all clues</button><button data-pt="aura">Refill Aura</button><button data-pt="calm">Calm everyone</button></div>
        <div class="pt-row"><button data-pt="tummy0">Empty tummy</button><button data-pt="tummy90">Tummy 90</button><button data-pt="rumble">Rumble</button></div>
        <div class="pt-row"><button data-pt="mention">Force mention</button><button data-pt="call">Call it now</button><button data-pt="win">Solve instantly</button></div>
        <p class="pt-note">Shift-click the scene to teleport.</p></section>
      <section><h4>Rules (live)</h4>
        <div class="pt-rules">${rules.map(([k, v]) => `<label><input type="checkbox" data-rule="${k}" ${v ? 'checked' : ''}> ${k}</label>`).join('')}</div>
        <div class="pt-row">Accusation: ${['point', 'proof', 'cross'].map((a) => `<button data-accuse="${a}" class="${RULES.accuse === a ? 'on' : ''}">${a}</button>`).join('')}</div></section>` : '<p class="pt-note">Start a case to see its truth, time controls and cheats.</p>'}
      <section><h4>Audio</h4><div class="pt-stats">peak ${m.peak.toFixed(2)} · rms ${m.rms.toFixed(3)} · music ${esc(ds.music || 'none')} (intensity ${ds.intensity ?? '-'}) ${ds.ducked ? '· ducked' : ''}</div></section>`;
    if (inCase) { const i = CASES.findIndex((c) => c.id === G.caseDef.id); $('#ptCase').value = i >= 0 ? String(i) : G.caseDef.id; }
  }

  function closeOverlays() { ['#title', '#briefing', '#results', '#accuse', '#dialogue', '#tip', '#pause', '#notebook'].forEach((s) => { const el = $(s); if (el) el.hidden = true; }); }
  function onClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.pt;
    if (b.dataset.speed !== undefined) { const s = +b.dataset.speed; if (s === 0) paused = !paused; else { speed = s; paused = false; } return render(); }
    if (b.dataset.accuse) { RULES.accuse = b.dataset.accuse; return render(); }
    if (a === 'close') return toggle();
    if (a === 'go' || a === 'rnd') {
      const v = $('#ptCase').value, seed = a === 'rnd' || !$('#ptSeed').value ? 1000 + Math.floor(Math.random() * 9000) : +$('#ptSeed').value;
      const c = v.startsWith('free-') ? FREE_PLAY(v.slice(5), seed) : { ...CASES[+v] };
      Sfx.init(); closeOverlays(); G.result = null; Game.newGame(c, seed); return render();
    }
    if (!G.cs) return;
    const play = () => { closeOverlays(); if (!['result'].includes(G.state)) G.state = 'play'; };
    if (a === 'skip') { play(); Game.skipTo(G.t + 15); }
    if (a === 'tofart') { play(); Game.skipTo(TIMELINE.fart + 0.5); }
    if (a === 'tocall') { play(); Game.skipTo(Math.min(TIMELINE.speakNow + 0.5, TIMELINE.end - 1)); }
    if (a === 'reveal') Game.revealAll();
    if (a === 'aura') { for (const n of Game.humans()) n.sus = 0; Game.recomputeAura(); }
    if (a === 'calm') for (const n of Game.humans()) { n.sus = 0; n.op = {}; n.confronted = true; }
    if (a === 'tummy0') G.pressure = 0;
    if (a === 'tummy90') G.pressure = 90;
    if (a === 'rumble') G.nextRumble = 0;
    if (a === 'mention') { TIMELINE.mention = Math.min(TIMELINE.mention, G.t + 0.1); }
    if (a === 'call') { play(); Game.object(); }
    if (a === 'win' && G.cs.reverse) { G.state = 'play'; closeOverlays(); if (!G.flags.fart) Game.release(); for (const n of Game.humans()) { n.op = { [G.cs.roles.patsy]: 60 }; n.sus = 0; } Game.recomputeAura(); TIMELINE.speakNow = G.t; return render(); }
    if (a === 'win') { Game.revealAll(); closeOverlays(); G.state = 'accuse'; Game.finish('accuse', { mode: RULES.accuse, accused: G.cs.culprit, correct: true, outcome: 'confess', proof: 'full', broken: 3 }); }
    render();
  }
  function onChange(e) {
    const el = e.target;
    if (el.dataset.flag) flags[el.dataset.flag] = el.checked;
    if (el.dataset.rule && RULES) RULES[el.dataset.rule] = el.checked;
  }

  // ---------------- overlays drawn by the game ----------------
  function drawWorld(ctx) {
    if (!active || !G.cs || !L) return;
    const cs = G.cs, k = L.view.w / 1280;
    if (flags.culprit && cs.origin) {
      const z = cs.origin;
      ctx.save(); ctx.strokeStyle = 'rgba(217,67,79,0.9)'; ctx.lineWidth = 2.5 * k; ctx.setLineDash([8 * k, 6 * k]);
      ctx.strokeRect(z.x, z.y, z.w, z.h); ctx.setLineDash([]);
      // where everyone stood when it happened
      for (const id in cs.spots) { const p = cs.spots[id]; if (cs.reverse && id !== 'player') continue; ctx.fillStyle = id === cs.culprit ? '#d9434f' : 'rgba(28,26,31,0.5)'; ctx.beginPath(); ctx.arc(p.x, p.y, (id === cs.culprit ? 5 : 3) * k * 1.6, 0, Math.PI * 2); ctx.fill(); }
      const n = G.npcs.find((x) => x.id === cs.culprit);
      if (n && n.present) { ctx.strokeStyle = '#d9434f'; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.ellipse(n.x, n.y, 26 * k * 1.4, 8 * k * 1.4, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
    if (flags.cones) {
      ctx.save(); ctx.lineWidth = 1.5 * k;
      for (const n of G.npcs) {
        if (n.def.dog || !n.present) continue;
        const r = NPC.range(n); ctx.strokeStyle = NPC.sees(n, G.player) ? 'rgba(255,90,40,0.9)' : 'rgba(255,240,150,0.7)';
        ctx.beginPath(); ctx.moveTo(n.x, n.y - 30); ctx.arc(n.x, n.y - 30, r, n.face - NPC.VIEW_HALF, n.face + NPC.VIEW_HALF); ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
    }
  }
  function drawScreen(ctx, toScreen) {
    if (!active || !G.cs || !flags.debug || !['play', 'tip', 'paused'].includes(G.state)) return;
    ctx.save(); ctx.font = '600 10px "Lexend", sans-serif'; ctx.textAlign = 'left';
    for (const n of G.npcs) {
      if (!n.present) continue;
      let top = null, tv = 0; for (const id in n.op) if (n.op[id] > tv) { tv = n.op[id]; top = id; }
      const fact = G.cs.facts[n.id];
      const pv = Math.round(n.op.player || 0);
      const lines = [
        `${n.def.name}${n.isCulprit ? ' ★' : ''}`,
        n.def.dog ? `reacted ${n.reacted ? '#' + n.reactOrder : 'no'}` : `sus ${Math.round(n.sus)} · ${n.reacted ? 'reacted #' + n.reactOrder : 'not yet'}`,
        top ? `thinks: ${top === 'player' ? 'YOU' : castById(top) ? castById(top).name : top} ${Math.round(tv)}` : 'thinks: nobody',
        G.cs.reverse && top !== 'player' && pv ? `you: ${pv}` : '',
        fact ? `knows: ${fact.kind} (${G.know.facts[n.id] ? 'learned' : 'hidden'})` : '',
      ].filter(Boolean);
      const p = toScreen(n.x, n.y), w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 10, h = lines.length * 12 + 6;
      ctx.fillStyle = n.isCulprit ? 'rgba(80,10,20,0.82)' : 'rgba(20,18,28,0.78)'; ctx.fillRect(p.x + 14, p.y - h - 4, w, h);
      ctx.fillStyle = '#fff'; lines.forEach((l, i) => ctx.fillText(l, p.x + 19, p.y - h + 8 + i * 12));
    }
    ctx.restore();
  }

  function handleKey(k) { if (!active) return false; if (k === 'Backquote' || k === 'F2') { toggle(); return true; } return false; }
  const timeScale = () => (active && paused ? 0 : active ? speed : 1);
  const flag = (k) => active && flags[k];

  return { init, setActive, handleKey, timeScale, flag, drawWorld, drawScreen, get active() { return active; } };
})();
