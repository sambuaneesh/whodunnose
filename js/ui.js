'use strict';
// DOM layer: title and campaign map, briefing cards, the Case File, tips, pause/settings/how to play,
// HUD and action bar (only what the case has taught), dialogue, notebook, the three accusation modes,
// results with a debrief, and the presenter's pitch tour.
const UI = (() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let captionT = 0, stampT = 0, typeTimer = null, dlg = null, nbTab = 'case', acc = null, tipDone = null, clueQ = [], clueBusy = false, overlayBack = null;
  const hudCache = {};
  const setText = (el, key, val) => { if (hudCache[key] !== val) { hudCache[key] = val; el.textContent = val; } };
  const show = (s) => { $(s).hidden = false; };
  const hide = (s) => { $(s).hidden = true; };
  const randomCase = () => 1000 + Math.floor(Math.random() * 9000);
  const S = () => Store.settings();

  function init() {
    applySettings();
    $('#btnPlay').addEventListener('click', () => openBriefing(Store.nextCase()));
    $('#btnHowto').addEventListener('click', () => openHowto());
    $('#btnSettings').addEventListener('click', () => openSettings());
    $('#btnPitchSheet').addEventListener('click', () => show('#pitchsheet'));
    $('#btnPitchClose').addEventListener('click', () => hide('#pitchsheet'));
    $('#btnTour').addEventListener('click', toggleTour);
    $('#btnTourClose').addEventListener('click', toggleTour);
    $('#btnPause').addEventListener('click', () => G.state === 'play' && pause());
    $('#btnHint').addEventListener('click', () => Game.useHint());
    $('#briefStart').addEventListener('click', beginCase);
    $('#briefBack').addEventListener('click', () => { hide('#briefing'); G.state = 'title'; show('#title'); renderMap(); });
    $('#tipOk').addEventListener('click', closeTip);
    $('#dlgText').addEventListener('click', finishTyping);
    document.querySelectorAll('[data-pause]').forEach((b) => b.addEventListener('click', () => pauseAction(b.dataset.pause)));
    $('#howtoClose').addEventListener('click', closeSub);
    $('#settingsClose').addEventListener('click', closeSub);
    bindSettings();
    const cl = $('#clenchBtn');
    const hold = (v) => (e) => { e.preventDefault(); G.clenchHeld = v; };
    cl.addEventListener('pointerdown', hold(true)); cl.addEventListener('pointerup', hold(false)); cl.addEventListener('pointerleave', hold(false));
    document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.act;
      Sfx.init();
      if (a === 'notebook') return G.state === 'play' && openNotebook();
      if (a === 'talk') return Game.tapE();
      if (a === 'search') return caption('Stand next to a bag and HOLD E.', 2);
      if (a === 'clench') return;
      Game[a] && Game[a]();
    }));
    renderMap();
    renderTour();
    // browsers only allow sound after a click: start the title music on the first one
    $('#title').addEventListener('pointerdown', () => { Sfx.init(); if (G.state === 'title') Sfx.setMusic('title'); });
  }

  // ---------------- title: campaign map ----------------
  function renderMap() {
    const next = Store.nextCase();
    $('#btnPlay').textContent = Object.keys(CASES).length && Store.progress('c1') ? `Continue: Case ${next.num}` : 'Play';
    $('#caseMap').innerHTML = CASES.map((c, i) => {
      const open = Store.unlocked(i), pr = Store.progress(c.id), setting = LEVELS[c.setting].title;
      return `<button class="case ${open ? '' : 'locked'} ${c === next ? 'next' : ''}" data-case="${i}" ${open ? '' : 'disabled'}>
        <span class="case-n">${c.num}</span><span class="case-t"><b>${esc(c.title)}</b><small>${c.bonus ? 'Bonus · ' : ''}${c.story ? esc(c.story.when) + ' · ' : ''}${c.setting === 'elevator' ? 'Elevator' : 'Chapel'} · ${open ? (pr && pr.best ? 'Best: ' + pr.best : 'New') : 'Locked'}</small></span>
        ${pr && pr.best ? `<span class="case-r r-${pr.best}">${pr.best}</span>` : ''}</button>`;
    }).join('') + `<div class="free ${Store.unlocked(3) ? '' : 'locked'}"><b>Free Play</b><small>${Store.unlocked(3) ? 'Everything on, random cases.' : 'Unlocks after Case 3.'}</small>
        <div class="free-row"><button data-free="elevator" ${Store.unlocked(3) ? '' : 'disabled'}>Elevator</button><button data-free="wedding" ${Store.unlocked(3) ? '' : 'disabled'}>Chapel</button></div></div>`;
    document.querySelectorAll('[data-case]').forEach((b) => b.addEventListener('click', () => { Sfx.init(); openBriefing(CASES[+b.dataset.case]); }));
    document.querySelectorAll('[data-free]').forEach((b) => b.addEventListener('click', () => { Sfx.init(); openBriefing(FREE_PLAY(b.dataset.free, randomCase())); }));
  }

  // ---------------- briefing ----------------
  function openBriefing(caseDef) {
    Sfx.init();
    G.pendingCase = caseDef;
    hide('#title'); hide('#results');
    Game.showcase(caseDef);
    G.state = 'briefing'; Sfx.duck(true);
    const st = caseDef.story;
    $('#briefKicker').textContent = caseDef.free ? `Free Play · ${LEVELS[caseDef.setting].title} · ${DIFFICULTY[S().difficulty].label}` : `${caseDef.bonus ? 'Bonus case' : `Case ${caseDef.num} of ${CASES.filter((c) => !c.bonus).length}`} · ${st ? `${st.when}, ${st.time} · ` : ''}${caseDef.setting === 'elevator' ? 'Thornbury Tower, the elevator' : "St. Swithin's Chapel"}`;
    $('#briefTitle').textContent = caseDef.title;
    $('#briefStory').textContent = st ? st.previously : '';
    $('#briefStory').hidden = !st;
    $('#briefGoal').textContent = caseDef.goal;
    $('#briefLearn').innerHTML = caseDef.learn.length ? `<h3>New this case</h3><ul>${caseDef.learn.map(([k, t, d]) => `<li><kbd>${esc(k)}</kbd><div><b>${esc(t)}</b><span>${esc(d)}</span></div></li>`).join('')}</ul>` : '';
    $('#briefObj').innerHTML = `<h3>Case file</h3><ul>${caseDef.objectives.map((id) => { const o = OBJECTIVES[id]; return `<li>${esc(typeof o.label === 'function' ? (L.callWhen = caseDef.callWhen, o.label()) : o.label)}</li>`; }).join('')}</ul>`;
    $('#briefDiff').hidden = !caseDef.free;
    if (caseDef.free) $('#briefDiff').innerHTML = Object.entries(DIFFICULTY).map(([k, d]) => `<button class="${S().difficulty === k ? 'on' : ''}" data-diff="${k}">${d.label}</button>`).join('');
    document.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => { Store.set('difficulty', b.dataset.diff); openBriefing({ ...caseDef }); }));
    show('#briefing');
    $('#briefStart').focus();
  }
  function beginCase() {
    if (G.state !== 'briefing') return;
    hide('#briefing'); Sfx.duck(false);
    const c = G.pendingCase;
    Game.newGame(c, c.seed);
    Sfx.sting('title');
  }

  function resetRun() {
    ['#dialogue', '#notebook', '#accuse', '#results', '#tip', '#pause'].forEach(hide);
    $('#toasts').innerHTML = ''; $('#clueToasts').innerHTML = ''; clueQ = []; clueBusy = false;
    speakNow(false);
    $('#hud').hidden = false; $('#actionbar').hidden = false;
    $('#caseTag').textContent = G.caseDef.free ? `Free Play · #${G.seed}` : G.caseDef.bonus ? `Bonus: ${G.caseDef.title}` : `Case ${G.caseDef.num}: ${G.caseDef.title}`;
    $('#objectLabel').textContent = 'Call it';
    // only show what this case has taught
    const R = RULES;
    $('#auraMeter').hidden = !R.aura; $('#tummyMeter').hidden = !R.tummy; $('#watch').hidden = !R.aura;
    $('#meters').hidden = !R.aura && !R.tummy;
    $('#roomSus').hidden = true;
    $('#btnHint').hidden = !G.diff.hints;
    const showAct = { talk: true, search: R.search, sniff: true, smellVision: R.smellVision, release: R.tummy, clench: R.clench, notebook: true, object: !R.reverse };
    $('[data-act=sniff]').innerHTML = R.reverse ? '<kbd>Q</kbd>Gag' : '<kbd>Q</kbd>Sniff';
    $('[data-act=search]').innerHTML = R.reverse ? '<kbd>Hold E</kbd>Plant' : '<kbd>Hold E</kbd>Search';
    document.querySelectorAll('[data-act]').forEach((b) => { b.hidden = !showAct[b.dataset.act]; });
    renderTour();
    objectives();
  }

  // ---------------- HUD ----------------
  function hud() {
    if (!G.cs || !['play', 'dialogue', 'notebook', 'tip', 'accuse', 'paused'].includes(G.state)) return;
    G.auraShown = U.lerp(G.auraShown ?? 100, G.aura ?? 100, 0.08);
    $('#auraFill').style.width = G.auraShown.toFixed(1) + '%';
    setText($('#auraVal'), 'aura', Math.round(G.auraShown) + '');
    $('#auraMeter').classList.toggle('low', G.auraShown < 35);
    const w = G.watchers || 0;
    setText($('#watchTxt'), 'watch', w ? `${w} watching you` : 'nobody watching');
    $('#watch').classList.toggle('seen', w > 0);
    $('#tummyFill').style.width = (G.pressure ?? 0).toFixed(1) + '%';
    $('#tummyMeter').classList.toggle('danger', G.pressure > 70);
    const t = G.t || 0;
    setText($('#phase'), 'phase', L.phaseLabel(t));
    setText($('#clock'), 'clock', L.clockLabel(t));
    const loud = RULES.tummy && G.loud ? `LOUD: ${G.loud.label}` : '';
    setText($('#loud'), 'loud', loud); $('#loud').hidden = !loud;
    const ps = RULES.rumors && G.state === 'play' ? Game.primeSuspect() : null;
    setText($('#roomSus'), 'room', ps ? `Room suspects: ${ps === 'player' ? 'YOU' : castById(ps).name}` : ''); $('#roomSus').hidden = !ps;
    $('#roomSus').classList.toggle('you', ps === 'player');
    setText($('#svCharges'), 'sv', G.sv.t > 0 ? `${Math.ceil(G.sv.t)}s` : '●'.repeat(Math.max(0, G.sv.charges)) + (G.sv.charges ? '' : ' empty'));
    $('#svBtn').classList.toggle('active', G.sv.t > 0);
    $('#clenchBtn').classList.toggle('urgent', !!G.rumble);
    setText($('#nbBadge'), 'nb', G.unseenClues ? String(G.unseenClues) : ''); $('#nbBadge').hidden = !G.unseenClues;
    setText($('#tourCount'), 'tour', `${Object.keys(G.features).length}/${FEATURES.length}`);
    $('#btnTour').hidden = !S().presenter;
    if (captionT > 0) { captionT -= 1 / 60; if (captionT <= 0) $('#caption').classList.remove('on'); }
    if (stampT > 0) { stampT -= 1 / 60; if (stampT <= 0) $('#stamp').classList.remove('on'); }
  }

  function objectives() {
    if (!G.caseDef) return;
    $('#objList').innerHTML = G.caseDef.objectives.map((id) => {
      const o = OBJECTIVES[id], st = G.objState ? G.objState[id] || 'open' : 'open';
      return `<li class="ob-${st}"><span class="ob-box">${st === 'done' ? '✓' : st === 'fail' ? '✗' : ''}</span>${esc(typeof o.label === 'function' ? o.label() : o.label)}</li>`;
    }).join('');
  }

  let lastPrompt = '';
  function prompt(lines) {
    const key = JSON.stringify(lines);
    if (key === lastPrompt) return;
    lastPrompt = key;
    $('#prompt').innerHTML = lines.map(([k, a, c]) => `<div class="pr"><kbd>${esc(k)}</kbd><span>${esc(a)}</span>${c ? `<em class="${/nobody/.test(c) ? 'safe' : 'risk'}">${esc(c)}</em>` : ''}</div>`).join('');
  }
  function caption(text, dur = 4) { const el = $('#caption'); el.textContent = text; el.classList.add('on'); captionT = dur; }
  function stamp(text, tone = 'red') {
    const el = $('#stamp'); el.textContent = text; el.className = 'stamp ' + tone;
    void el.offsetWidth; el.classList.add('on'); stampT = 2.2; Sfx.stamp();
  }
  function beat(big, small) {
    $('#caption').classList.remove('on'); captionT = 0;
    const el = $('#beat'); $('#beatBig').textContent = big; $('#beatSmall').textContent = small;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  }
  function speakNow(on) { $('#objectBtn').classList.toggle('speak', on); }

  // ---------------- tips and hints ----------------
  function showTip(tip, done) {
    tipDone = done;
    $('#tipTitle').textContent = tip.title;
    $('#tipText').textContent = tip.text;
    show('#tip'); Sfx.ui('tip');
    setTimeout(() => $('#tipOk').focus(), 30);
  }
  function closeTip() { if ($('#tip').hidden) return; hide('#tip'); const d = tipDone; tipDone = null; if (d) d(); }

  // ---------------- pause, settings, how to play ----------------
  function pause() {
    if (G.state !== 'play') return;
    G.state = 'paused'; Sfx.setPaused(true);
    show('#pause');
  }
  function resume() { hide('#pause'); if (G.state === 'paused') { G.state = 'play'; Sfx.setPaused(false); } }
  function pauseAction(a) {
    if (a === 'resume') return resume();
    if (a === 'howto') return openHowto('#pause');
    if (a === 'settings') return openSettings('#pause');
    if (a === 'restart') { hide('#pause'); Sfx.setPaused(false); return openBriefing(G.caseDef); }
    if (a === 'quit') { hide('#pause'); Sfx.setPaused(false); Sfx.setMusic(null); Sfx.stopMurmur(); Sfx.stopOrgan(); toTitle(); }
  }
  function toTitle() {
    ['#hud', '#actionbar', '#dialogue', '#notebook', '#accuse', '#results', '#tip', '#briefing'].forEach(hide);
    G.state = 'title'; Game.showcase(Store.nextCase()); renderMap(); show('#title');
    Sfx.setScene(null); Sfx.duck(false); Sfx.setMusic('title');
  }
  function openHowto(back) { overlayBack = back || null; if (back) hide(back); show('#howto'); }
  function openSettings(back) { overlayBack = back || null; if (back) hide(back); syncSettings(); show('#settings'); }
  function closeSub() { hide('#howto'); hide('#settings'); if (overlayBack) show(overlayBack); overlayBack = null; }

  function bindSettings() {
    $('#setMaster').addEventListener('input', (e) => { Store.set('master', +e.target.value / 100); applySettings(); });
    $('#setMusic').addEventListener('input', (e) => { Store.set('music', +e.target.value / 100); applySettings(); });
    $('#setText').addEventListener('change', (e) => Store.set('textSpeed', e.target.value));
    $('#setShake').addEventListener('change', (e) => Store.set('shake', e.target.checked));
    $('#setCones').addEventListener('change', (e) => Store.set('cones', e.target.checked));
    $('#setPresenter').addEventListener('change', (e) => { Store.set('presenter', e.target.checked); renderTour(); });
    $('#setPlaytest').addEventListener('change', (e) => { Playtest.setActive(e.target.checked); renderMap(); });
    $('#setReset').addEventListener('click', () => {
      const b = $('#setReset');
      if (b.dataset.confirm) { Store.reset(); b.textContent = 'Progress reset'; delete b.dataset.confirm; renderMap(); }
      else { b.dataset.confirm = '1'; b.textContent = 'Click again to confirm'; }
    });
  }
  function syncSettings() {
    const s = S();
    $('#setMaster').value = Math.round(s.master * 100); $('#setMusic').value = Math.round(s.music * 100);
    $('#setText').value = s.textSpeed; $('#setShake').checked = s.shake; $('#setCones').checked = s.cones; $('#setPresenter').checked = s.presenter;
    $('#setPlaytest').checked = !!s.playtest; $('#setPlaytestRow').hidden = !s.playtest; // only offered once unlocked by URL code
    $('#setReset').textContent = 'Reset campaign progress'; delete $('#setReset').dataset.confirm;
  }
  function applySettings() { Sfx.setVolumes(S().master, S().music); }

  // ---------------- pitch tour (presenter mode) ----------------
  function featureShown(f) {
    renderTour();
    if (!S().presenter || !f) return;
    const n = Object.keys(G.features).length;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="toast-k">System ${n} of ${FEATURES.length}</div><div class="toast-h">${esc(f.title)}</div><div class="toast-b">${esc(f.body)}</div>`;
    $('#toasts').prepend(el);
    while ($('#toasts').children.length > 1) $('#toasts').lastChild.remove();
    setTimeout(() => el.classList.add('out'), 5000);
    setTimeout(() => el.remove(), 5600);
  }
  function renderTour() {
    $('#tourList').innerHTML = FEATURES.map((f) => `<li class="${G.features[f.id] ? 'done' : ''}"><span class="tick">${G.features[f.id] ? '✓' : ''}</span><div><b>${esc(f.title)}</b><span>${esc(f.body)}</span></div></li>`).join('');
    $('#tourPct').textContent = `${Object.keys(G.features).length} of ${FEATURES.length} shown`;
  }
  function toggleTour() { $('#tour').hidden = !$('#tour').hidden; }

  // One clue toast at a time, so the screen never fills up.
  function clueToast(c) { clueQ.push(c); if (!clueBusy) nextClue(); }
  function nextClue() {
    const c = clueQ.shift();
    if (!c) { clueBusy = false; return; }
    clueBusy = true;
    const el = document.createElement('div');
    el.className = 'cluetoast k-' + c.kind;
    el.innerHTML = `<b>${c.kind === 'contradiction' ? 'Lie caught' : c.kind === 'photo' ? 'Photo' : 'Noted'}</b> ${esc(c.text)}`;
    $('#clueToasts').innerHTML = ''; $('#clueToasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), clueQ.length ? 1800 : 3200);
    setTimeout(() => { el.remove(); nextClue(); }, clueQ.length ? 2200 : 3700);
  }

  // ---------------- dialogue ----------------
  function typeText(text, voice) {
    clearInterval(typeTimer);
    const el = $('#dlgText'); el.textContent = ''; let i = 0;
    dlg.full = text; dlg.typing = true;
    const speed = { slow: 1, normal: 2, fast: 4, instant: 999 }[S().textSpeed] || 2;
    typeTimer = setInterval(() => {
      i += speed; el.textContent = text.slice(0, i);
      if (i % 4 < speed && text[i] && text[i] !== ' ') Sfx.blip(voice, text[i]);
      if (i >= text.length) { clearInterval(typeTimer); dlg.typing = false; }
    }, 22);
  }
  function finishTyping() { if (dlg && dlg.typing) { clearInterval(typeTimer); $('#dlgText').textContent = dlg.full; dlg.typing = false; } }
  function dlgHeader(name, role, trait) {
    $('#dlgName').textContent = name; $('#dlgRole').textContent = role;
    $('#dlgTrait').textContent = trait || ''; $('#dlgTrait').hidden = !trait || !RULES.aura;
  }
  function openDialogue(n, mode) {
    dlg = { n, mode, sub: null };
    $('#dlgPortrait').src = Art.portrait(n.def, mode === 'confront' ? 'sus' : 'neutral');
    $('#dlgPhoto').hidden = true;
    dlgHeader(n.def.name, n.def.role, n.def.trait);
    const v = VOICES[n.id];
    let open;
    if (mode === 'confront') open = v.confront;
    else if (n.def.dog) open = L.scapegoat.open;
    else open = n.greeted ? U.pick(Math.random, ['Yes?', 'Oh. You again.', 'Mm-hm?', 'What now?']) : v.hello;
    n.greeted = true;
    typeText(open, n.def.look.voice);
    renderOptions(); renderSus();
    show('#dialogue'); Sfx.duck(true);
  }
  function openItem(c, it, bag, photo) {
    dlg = { n: null, mode: 'item' };
    $('#dlgPortrait').src = Art.portrait(c, 'neutral');
    dlgHeader(it.label, 'You rummage through it as fast as you can.', null);
    typeText(`Inside: ${bag.text}${photo ? ' And on the camera screen: a photo from the exact moment it happened.' : ''}`, 500);
    $('#dlgPhoto').hidden = !photo;
    if (photo) $('#dlgPhoto').innerHTML = polaroid(photo.img, photo.stamp);
    $('#dlgSus').innerHTML = '';
    singleOption('Put it back');
    show('#dialogue');
  }
  function openPhoto(photo) {
    dlg = { n: null, mode: 'item' };
    $('#dlgPortrait').src = photo ? photo.img : '';
    dlgHeader(L.photo.label, 'The maintenance panel has a tiny screen.', null);
    typeText(photo ? 'A still from the moment it happened. Everyone is exactly where they were standing.' : 'Static. Nothing recorded yet.', 500);
    $('#dlgPhoto').hidden = !photo;
    if (photo) $('#dlgPhoto').innerHTML = polaroid(photo.img, photo.stamp);
    $('#dlgSus').innerHTML = '';
    singleOption('Stop staring at the camera');
    show('#dialogue');
  }
  const polaroid = (img, cap) => `<figure class="polaroid"><img alt="Photo of the room at the moment it happened" src="${img}"><figcaption>${esc(cap)}</figcaption></figure>`;
  function singleOption(label) {
    $('#dlgOpts').innerHTML = `<button class="opt" data-i="0"><kbd>1</kbd><span>${esc(label)}</span></button>`;
    $('#dlgOpts').firstChild.addEventListener('click', closeDialogue);
  }
  function renderSus() {
    const n = dlg.n;
    if (!n || n.def.dog || !RULES.aura) { $('#dlgSus').innerHTML = ''; return; }
    const s = Math.round(n.sus);
    let top = null, tv = 15; for (const id in n.op) if (n.op[id] > tv) { tv = n.op[id]; top = id; }
    $('#dlgSus').innerHTML = `<span>How they see you</span><div class="susbar"><i style="width:${s}%"></i></div><em>${s < 25 ? 'fine' : s < 60 ? 'side-eye' : 'suspects you'}</em>${RULES.rumors && top ? `<span class="theory">Their theory: <b>${esc(castById(top).name)}</b></span>` : ''}`;
  }
  function renderOptions() {
    const { n, mode } = dlg;
    const opts = dlg.sub || (mode === 'confront' ? Game.confrontOptions() : mode === 'done' ? [{ id: 'leave', label: 'Walk away' }] : Game.talkOptions(n));
    dlg.opts = opts;
    $('#dlgOpts').innerHTML = opts.map((o, i) => `<button class="opt" data-i="${i}"><kbd>${i + 1}</kbd><span>${esc(o.label)}</span>${o.tag && RULES.aura ? `<em class="tag t-${o.tag.replace(/\s/g, '')}">${esc(o.tag)}</em>` : ''}</button>`).join('');
    $('#dlgOpts').querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => choose(+b.dataset.i)));
  }
  function choose(i) {
    if (!dlg) return;
    if (dlg.mode === 'item') return closeDialogue();
    const o = dlg.opts[i]; if (!o) return;
    Sfx.ui('tick');
    if (o.id === 'leave') return closeDialogue();
    const n = dlg.n;
    if (o.id === 'back') { dlg.sub = null; renderOptions(); return; }
    const r = dlg.mode === 'confront' ? Game.confrontChoose(n, o.id) : Game.talkChoose(n, o.id);
    if (r.sub) { dlg.sub = r.sub; typeText('(Who do you want them to suspect?)', 300); renderOptions(); return; }
    dlg.sub = null;
    if (dlg.mode === 'confront') dlg.mode = 'done';
    $('#dlgPortrait').src = Art.portrait(n.def, r.expr || 'neutral');
    if (r.text) typeText(r.text.replace(/([.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase()), n.def.look.voice);
    renderOptions(); renderSus();
  }
  function closeDialogue() {
    clearInterval(typeTimer); dlg = null; hide('#dialogue'); Sfx.duck(false);
    if (G.state === 'dialogue') G.state = 'play';
  }

  // ---------------- notebook ----------------
  function openNotebook(tab) {
    if (tab) nbTab = tab;
    G.state = 'notebook'; G.unseenClues = 0;
    renderNotebook();
    show('#notebook'); Sfx.ui('page'); Sfx.duck(true);
  }
  function closeNotebook() { hide('#notebook'); Sfx.duck(false); Sfx.ui('page'); if (G.state === 'notebook') G.state = 'play'; }
  const KIND_LABEL = { claim: 'Said', zone: 'Where', bag: 'Bag', witness: 'Witness', gossip: 'Heard', smell: 'Smell', sound: 'Sound', tell: 'Behaviour', deflect: 'Behaviour', contradiction: 'Lie', reaction: 'Noses', odd: 'Odd', photo: 'Photo' };

  function renderNotebook() {
    const tabs = [['case', 'Case file'], ['suspects', 'Suspects'], ['clues', `Clues (${G.clues.filter((c) => c.kind !== 'odd').length})`], ['timeline', 'Timeline']];
    if (RULES.board) tabs.push(['board', 'Smell Board']);
    if (RULES.guide) tabs.push(['guide', 'Field Guide']);
    if (!tabs.some(([id]) => id === nbTab)) nbTab = 'case';
    $('#nbTabs').innerHTML = tabs.map(([id, l]) => `<button class="${nbTab === id ? 'on' : ''}" data-tab="${id}">${l}</button>`).join('') + '<button class="close" data-tab="close">Close (Esc)</button>';
    $('#nbTabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.tab === 'close') return closeNotebook();
      nbTab = b.dataset.tab; Sfx.ui('tick'); renderNotebook();
    }));
    const body = $('#nbBody');
    if (nbTab === 'case') body.innerHTML = caseHTML();
    if (nbTab === 'suspects') body.innerHTML = suspectsHTML();
    if (nbTab === 'clues') body.innerHTML = cluesHTML();
    if (nbTab === 'timeline') body.innerHTML = timelineHTML();
    if (nbTab === 'board') { body.innerHTML = boardHTML(); bindBoard(); Game.feature('board'); }
    if (nbTab === 'guide') { body.innerHTML = guideHTML(); Game.feature('science'); }
  }
  // The Case File: objectives with hints, and a plain summary of what you know.
  function caseHTML() {
    const k = G.know, cs = G.cs;
    const obj = G.caseDef.objectives.map((id) => {
      const o = OBJECTIVES[id], st = G.objState[id] || 'open';
      return `<li class="ob-${st}"><span class="ob-box">${st === 'done' ? '✓' : st === 'fail' ? '✗' : ''}</span><div><b>${esc(typeof o.label === 'function' ? o.label() : o.label)}</b>${st === 'open' ? `<span>${esc(o.hint)}</span>` : ''}</div></li>`;
    }).join('');
    const eaters = Object.entries(k.claims).filter(([, f]) => k.smell && f === cs.food.id).map(([id]) => castById(id).name);
    const facts = [
      k.smell ? `The smell is <b>${esc(cs.food.smell)}</b>, which means <b>${esc(cs.food.name)}</b>.` : 'You have not caught the smell yet.',
      k.reactions.length ? `First to react: ${k.reactions.slice(0, 3).map((r) => `<b>${esc(castById(r.id).name)}</b>`).join(', ')}. The first noses are closest to where it started.` : 'Nobody has reacted yet.',
      k.smell && RULES.questions.includes('food') ? (eaters.length ? `Says they ate it: ${eaters.map((e) => `<b>${esc(e)}</b>`).join(', ')}.` : 'Nobody has admitted eating it yet.') : '',
      G.clues.some((c) => c.kind === 'contradiction') ? `<b>Caught lying:</b> ${G.clues.filter((c) => c.kind === 'contradiction').map((c) => esc(castById(c.who).name)).join(', ')}.` : '',
    ].filter(Boolean);
    return `<div class="cf"><div><h3 class="g-h">${esc(G.caseDef.title)}</h3><ul class="oblist">${obj}</ul></div><div><h3 class="g-h">What you know</h3><ul class="know">${facts.map((f) => `<li>${f}</li>`).join('')}</ul></div></div>`;
  }
  function suspectsHTML() {
    const k = G.know;
    return `<div class="sgrid">` + CAST.map((c) => {
      const n = Game.npcById(c.id);
      const claim = k.claims[c.id] ? foodById(k.claims[c.id]).name : '—';
      const bag = k.bagFood[c.id] ? foodById(k.bagFood[c.id]).name : (k.bags[c.id] ? 'nothing to eat' : '—');
      const where = k.zones[c.id] ? zoneById(k.zones[c.id]).name : (G.clues.some((x) => x.key === 'zone-' + c.id) ? 'not here yet' : '—');
      const r = k.reactions.findIndex((x) => x.id === c.id);
      const react = r >= 0 ? `#${r + 1}` : (n.present ? 'not yet' : 'not here yet');
      const lied = G.clues.some((x) => x.key === 'contra-' + c.id);
      const tell = G.clues.some((x) => (x.kind === 'tell' || x.kind === 'deflect') && x.who === c.id);
      const flags = (lied ? '<span class="flag lie">Lied</span>' : '') + (tell ? '<span class="flag tell">Acting weird</span>' : '');
      const rows = [['Ate', claim]];
      if (RULES.search) rows.push(['Bag', bag]);
      if (RULES.questions.includes('where')) rows.push(['Was by', where]);
      rows.push(['Reacted', react]);
      return `<div class="scard"><img alt="" src="${Art.portrait(c, 'neutral')}"><div class="sc-main"><div class="sc-name">${esc(c.name)}</div><div class="sc-role">${esc(c.role)}</div>${RULES.aura && c.trait ? `<div class="sc-trait">${esc(c.trait)}</div>` : ''}${flags}
        <dl>${rows.map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('')}</dl>
        ${RULES.rumors ? `<div class="sc-sus"><span>Room suspects</span><div class="susbar room"><i style="width:${Math.round(Game.crowdOpinion(c.id))}%"></i></div></div>` : ''}
        ${RULES.aura && !c.dog ? `<div class="sc-sus"><span>Suspects you</span><div class="susbar"><i style="width:${Math.round(n.sus)}%"></i></div></div>` : ''}</div></div>`;
    }).join('') + '</div>';
  }
  function cluesHTML() {
    const list = G.clues.filter((c) => c.kind !== 'odd').slice().reverse();
    if (!list.length) return '<p class="nb-empty">Nothing yet. Talk to people, sniff around, and watch who reacts.</p>';
    return '<ul class="clues">' + list.map((c) => `<li class="k-${c.kind}"><span class="chip">${KIND_LABEL[c.kind] || c.kind}</span><span class="ct">${esc(c.text)}${c.img ? polaroid(c.img, G.photo ? G.photo.stamp : '') : ''}</span><span class="ctime">${U.fmtTime(c.t)}</span></li>`).join('') + '</ul>';
  }
  function timelineHTML() {
    return '<ul class="tl">' + G.log.map((e) => `<li><span class="ctime">${U.fmtTime(e.t)}</span><span>${esc(e.text)}</span></li>`).join('') + '</ul>';
  }
  function boardHTML() {
    const b = G.board;
    const sel = (key, items) => `<select id="b-${key}" ${b.locked ? 'disabled' : ''}><option value="">______</option>${items.map(([v, l]) => `<option value="${v}" ${b[key] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const foods = FOODS.filter((f) => (L.foods || []).includes(f.id) || f.id === L.scapegoat.food);
    return `<div class="board ${b.locked ? 'locked' : ''}">
      <p class="board-s">It was ${sel('who', CAST.map((c) => [c.id, c.name]))}.
      They had ${sel('food', foods.map((f) => [f.id, f.name]))},
      it started by the ${sel('zone', ZONES.map((z) => [z.id, z.name]))},
      and they covered it up by ${sel('cover', ALL_COVERS.map((c) => [c.id, c.label]))}.</p>
      <div class="board-row"><button id="bCheck" ${b.locked ? 'disabled' : ''}>Check my theory</button><span class="board-fb">${esc(b.feedback || 'Only a complete, correct theory locks in. You will be told when exactly one blank is wrong.')}</span></div>
      ${b.locked ? '<div class="solved">SOLVED</div>' : ''}</div>`;
  }
  function bindBoard() {
    ['who', 'food', 'zone', 'cover'].forEach((k) => { const el = $('#b-' + k); if (el) el.addEventListener('change', () => { G.board[k] = el.value; }); });
    const btn = $('#bCheck'); if (btn) btn.addEventListener('click', () => { Game.checkBoard(); renderNotebook(); });
  }
  function guideHTML() {
    const foods = FOODS.filter((f) => (L.foods || []).includes(f.id) || f.id === L.scapegoat.food);
    const bar = (v) => `<span class="meter-mini"><i style="width:${Math.round(v * 100)}%"></i></span>`;
    return `<p class="nb-lede">Most fart gas has no smell. The stink is sulfur, mostly hydrogen sulfide, from sulfur-rich protein. Volume comes from carbohydrates that bacteria turn into odourless gas. So what someone ate decides how loud it was and how bad it smells.</p>
      <div class="guide">${foods.map((f) => `<div class="gcard"><b>${esc(U.cap(f.name))}</b><span class="gsm">Smells like: ${esc(f.smell)}</span>
        <div class="grow"><span>Stink</span>${bar(f.stink)}</div><div class="grow"><span>Volume</span>${bar(f.loud)}</div><p>${esc(f.science)}</p></div>`).join('')}</div>
      ${RULES.folklore ? '<h3 class="g-h">Playground law</h3><ul class="law"><li><b>Whoever smelt it, dealt it.</b> The first to mention the smell becomes a suspect.</li><li><b>Whoever denied it, supplied it.</b> Protesting too hard looks guilty.</li><li><b>Whoever made the rhyme did the crime.</b> Do not quote these rules at people.</li></ul>' : ''}`;
  }

  // ---------------- calling it ----------------
  function openAccuse() {
    acc = { step: 'splash', accused: null };
    show('#accuse'); renderAccuse();
    setTimeout(() => { if (acc && acc.step === 'splash') { acc.step = 'suspect'; renderAccuse(); } }, 1300);
  }
  function renderAccuse() {
    const el = $('#accuseBody');
    if (acc.step === 'splash') { el.innerHTML = `<div class="objection">${esc(L.objectSplash.big)}</div><p class="obj-sub">${esc(L.objectSplash.sub)}</p>`; return; }
    if (acc.step === 'suspect') {
      const withdrawn = G.trial && G.trial.withdrawn;
      const mode = RULES.accuse;
      const sub = withdrawn ? 'You took back your first accusation. One more try.' : mode === 'point' ? 'Who did it? Point at them.' : mode === 'proof' ? 'Point at the culprit. Then you will need one clue that proves it.' : 'Name the culprit. Then break their testimony with evidence.';
      el.innerHTML = `<h2>Who dealt it?</h2><p class="acc-sub">${sub}</p><div class="agrid">` +
        CAST.filter((c) => Game.npcById(c.id).present).map((c) => `<button class="acard ${acc.accused === c.id ? 'on' : ''}" data-id="${c.id}"><img alt="" src="${Art.portrait(c, 'neutral')}"><b>${esc(c.name)}</b>${RULES.aura ? `<span class="mini-l">Stakes</span><span class="stakes"><i style="width:${c.shame * 10}%"></i></span>` : ''}${RULES.rumors ? `<span class="mini-l">Room suspects</span><span class="stakes room"><i style="width:${Math.round(Game.crowdOpinion(c.id))}%"></i></span>` : ''}</button>`).join('') +
        `</div><div class="acc-row"><button class="ghost" id="accCancel" ${withdrawn ? 'hidden' : ''}>Not yet</button><button id="accNext" ${acc.accused ? '' : 'disabled'}>${mode === 'point' ? 'It was them!' : mode === 'proof' ? 'Show proof' : 'Cross-examine'}</button></div>`;
      el.querySelectorAll('.acard').forEach((b) => b.addEventListener('click', () => { acc.accused = b.dataset.id; Sfx.ui('tick'); renderAccuse(); }));
      $('#accNext').addEventListener('click', () => {
        if (mode === 'point') return verdict(Game.resolvePoint(acc.accused));
        if (mode === 'proof') { acc.step = 'proof'; return renderAccuse(); }
        Game.startTrial(acc.accused); acc.step = 'trial'; acc.log = []; acc.picking = null; renderAccuse();
      });
      const cancel = $('#accCancel'); if (cancel) cancel.addEventListener('click', cancelAccuse);
      return;
    }
    if (acc.step === 'proof') {
      const c = castById(acc.accused), list = sortedEvidence(acc.accused);
      el.innerHTML = `<h2>Prove it was ${esc(c.name)}</h2><p class="acc-sub">Pick the single clue that shows it was them. Lies and witnesses are the strongest.</p>
        <ul class="evlist">${list.map((k) => `<li><button class="evbtn ${Game.about(k, acc.accused) ? 'rel' : ''}" data-clue="${k.key}"><span class="chip">${KIND_LABEL[k.kind] || k.kind}</span><span>${esc(k.text)}</span></button></li>`).join('')}
        <li><button class="evbtn none" data-clue="">I have no proof. Just trust me.</button></li></ul>
        <div class="acc-row"><button class="ghost" id="accBack">Back</button></div>`;
      el.querySelectorAll('[data-clue]').forEach((b) => b.addEventListener('click', () => verdict(Game.resolveProof(acc.accused, b.dataset.clue))));
      $('#accBack').addEventListener('click', () => { acc.step = 'suspect'; renderAccuse(); });
      return;
    }
    if (acc.step === 'trial') return renderTrial();
  }
  // Clues about this person first, then everything else.
  function sortedEvidence(id) {
    const list = G.clues.filter((k) => k.kind !== 'odd');
    return [...list.filter((k) => Game.about(k, id)), ...list.filter((k) => !Game.about(k, id))];
  }

  function renderTrial() {
    const tr = G.trial, c = castById(tr.accused), el = $('#accuseBody');
    const n = Game.npcById(tr.accused);
    const expr = n ? (['shock', 'worried', 'angry'].includes(n.expr) ? n.expr : 'neutral') : 'neutral';
    el.innerHTML = `<div class="trial-head"><img class="vport" alt="" src="${Art.portrait(c, expr)}">
        <div class="th-main"><div class="res-k">Cross-examination</div><h2>${esc(c.name)} testifies</h2>
        <div class="crowd"><span>The room believes you</span><div class="cbar"><i style="width:${Math.round(tr.belief)}%"></i></div><b>${Math.round(tr.belief)}%</b></div></div></div>
      <ol class="testimony">${tr.statements.map((s, i) => `<li class="${tr.broken.has(i) ? 'broken' : ''}"><div class="st-text"><span class="topic">${esc(s.topic)}</span><b>${esc(s.speaker)}:</b> "${esc(s.text)}"${tr.pressed.has(i) ? `<em>${esc(s.press)}</em>` : ''}${!tr.broken.has(i) && tr.misses[i] >= 2 && G.diff.hints ? `<em class="nudge">Try a clue about ${esc(s.topic.toLowerCase())}.</em>` : ''}</div>
        ${tr.broken.has(i) ? '<span class="st-broken">BROKEN</span>' : `<div class="st-btns"><button class="ghost" data-press="${i}">Press</button><button data-present="${i}">Present</button></div>`}</li>`).join('')}</ol>
      ${acc.picking !== null && acc.picking !== undefined ? `<div class="picker"><div class="pk-h">Break "${esc(tr.statements[acc.picking].text)}" with:</div>
        <ul class="evlist">${sortedEvidence(tr.accused).map((k) => `<li><button class="evbtn ${Game.about(k, tr.accused) ? 'rel' : ''}" data-clue="${k.key}"><span class="chip">${KIND_LABEL[k.kind] || k.kind}</span><span>${esc(k.text)}</span></button></li>`).join('') || '<li class="nb-empty">You have no evidence at all.</li>'}</ul>
        <div class="acc-row"><button class="ghost" id="pkCancel">Cancel</button></div></div>` : ''}
      <ul class="tlog">${(acc.log || []).slice(0, 3).map((l) => `<li class="${l.cls}">${esc(l.text)}</li>`).join('')}</ul>
      <div class="acc-row">${tr.withdrawn ? '' : '<button class="ghost" id="trWithdraw">Withdraw accusation</button>'}<button id="trRest">Rest my case</button></div>`;
    el.querySelectorAll('[data-press]').forEach((b) => b.addEventListener('click', () => { Game.trialPress(+b.dataset.press); Sfx.ui('tick'); renderTrial(); }));
    el.querySelectorAll('[data-present]').forEach((b) => b.addEventListener('click', () => { acc.picking = +b.dataset.present; renderTrial(); }));
    el.querySelectorAll('[data-clue]').forEach((b) => b.addEventListener('click', () => {
      const i = acc.picking, r = Game.trialPresent(i, b.dataset.clue);
      acc.log.unshift(r.hit ? { cls: 'hit', text: 'OBJECTION! That breaks their story.' } : { cls: 'miss', text: 'That does not contradict anything. The room groans.' });
      acc.picking = null;
      if (tr.broken.size === tr.statements.length) return verdict(Game.resolveTrial());
      renderTrial();
    }));
    const pk = $('#pkCancel'); if (pk) pk.addEventListener('click', () => { acc.picking = null; renderTrial(); });
    const wd = $('#trWithdraw'); if (wd) wd.addEventListener('click', () => { if (Game.withdraw()) { acc.step = 'suspect'; acc.accused = null; caption('You take it back. Everyone stares. Pick again.', 3); renderAccuse(); } });
    $('#trRest').addEventListener('click', () => verdict(Game.resolveTrial()));
  }

  function cancelAccuse() {
    hide('#accuse'); acc = null; G.state = 'play'; G.objected = false; G.trial = null;
    G.npcs.forEach((n) => { n.expr = 'neutral'; n.exprT = 0; });
    Game.unfocus(); Sfx.setMusic(L.mode === 'elevator' ? 'muzak' : (G.t >= TIMELINE.procession ? 'tension' : 'mingle'));
    if (RULES.aura) { caption('You back down. Everyone is staring at you.', 3); for (const n of Game.humans()) n.sus = Math.min(100, n.sus + 8); Game.recomputeAura(); }
  }

  function verdict(res) {
    const c = castById(res.accused), v = VOICES[c.id] || {}, sg = L.scapegoat;
    acc.step = 'verdict';
    const el = $('#accuseBody');
    const finalLine = c.dog ? sg.outcome[res.outcome] : { confess: v.guilty, reluctant: v.reluctant, unproven: "That's ridiculous. You can't prove a thing.", wrong: v.innocent }[res.outcome];
    const who = c.dog ? (castById(sg.speaker) ? castById(sg.speaker).name : c.name) : c.name;
    el.innerHTML = `<div class="trial-head"><img class="vport" alt="" src="${Art.portrait(c, res.outcome === 'wrong' ? 'angry' : 'shock')}"><div class="th-main"><div class="res-k">The verdict</div><h2>${esc(c.name)}</h2></div></div><ol id="vlines"></ol><div id="vend"></div>`;
    const lines = [{ who, text: finalLine, final: true }];
    if (res.mode === 'proof' && res.clue && res.correct && res.outcome === 'confess') lines.unshift({ who: 'You', text: res.clue.text });
    if (res.outcome === 'wrong') lines.push({ who: 'Narrator', text: sg.finale(castById(G.cs.culprit).name) });
    if (res.outcome === 'unproven') lines.push({ who: 'Narrator', text: 'You were right. Nobody believes you. That is somehow worse.' });
    G.verdictLine = { who, text: finalLine, accused: c.id, outcome: res.outcome };
    let i = 0;
    const ol = $('#vlines');
    const next = () => {
      if (!acc) return;
      if (i >= lines.length) {
        $('#vend').innerHTML = '<button id="vDone">See how you did</button>';
        $('#vDone').addEventListener('click', () => { hide('#accuse'); acc = null; Game.finish('accuse', res); });
        $('#vDone').focus();
        return;
      }
      const Ln = lines[i++], li = document.createElement('li');
      li.className = Ln.final ? 'final' : '';
      li.innerHTML = `<b>${esc(Ln.who)}</b> ${esc(Ln.text)}`;
      ol.appendChild(li);
      if (Ln.final) (res.outcome === 'wrong' || res.outcome === 'unproven' ? Sfx.ui('bad') : Sfx.ui('lock'));
      setTimeout(next, 1100);
    };
    setTimeout(next, 400);
  }

  // ---------------- results ----------------
  function showResults(r) {
    $('#hud').hidden = true; $('#actionbar').hidden = true; speakNow(false);
    const cs = G.cs, cul = castById(cs.culprit);
    const st = G.caseDef.story, passed = r.rank !== 'F' && r.rank !== 'D';
    const rev = cs.reverse && r.acc, ending = rev && st && st.endings ? st.endings[rev.named === 'player' ? 'caught' : rev.named ? 'framed' : 'nobody'] : null;
    const truth = ending ? esc(U.fill(ending, { name: rev.named && rev.named !== 'player' ? castById(rev.named).name : '' })) : st && st.fix.culprit === cs.culprit ? esc(st.truth) : `It was <b>${esc(cul.name)}</b>. They had ${esc(cs.food.name)} (${esc(cs.food.smell)}), it started by the ${esc(cs.origin.name)}${cs.fartType === 'sbd' ? ', silent but deadly' : cs.fartType === 'trumpet' ? ', and it was loud' : ''}${RULES.tells ? `, and they covered it up by ${esc(cs.cover.label)}` : ''}.`;
    const intro = { bankrupt: 'Your Aura hit zero. Everyone has quietly agreed it was you.', peace: L.peaceText, accuse: '' }[r.kind];
    const vl = G.verdictLine;
    const panels = [
      G.snaps.fart ? { img: G.snaps.fart, cap: 'It happens.' } : null,
      G.snaps.object ? { img: G.snaps.object, cap: 'You call it.' } : null,
      rev && G.snaps.decide ? { img: G.snaps.decide, cap: 'The room decides.' } : null,
      vl ? { portrait: Art.portrait(vl.def || castById(vl.accused), vl.outcome === 'wrong' ? 'angry' : 'shock'), cap: `${vl.who}: "${vl.text}"` } : null,
    ].filter(Boolean);
    const idx = CASES.findIndex((c) => c.id === G.caseDef.id);
    const nextCase = idx >= 0 && idx < CASES.length - 1 && Store.unlocked(idx + 1) ? CASES[idx + 1] : null;
    const criteria = cs.reverse ? 'S: someone else named by a clear margin, Aura 80+, no hints · A: clear margin, Aura 50+ · B: someone else named · C: nobody named · F: you were named.' : RULES.accuse === 'point' ? 'S: right culprit, no hints. F: wrong person.' : 'S: right culprit, full proof, Aura 80+, no hints · A: full proof, Aura 50+ · B: some proof · C: no proof · D: never called it · F: wrong person or no Aura left.';
    $('#resultsBody').innerHTML = `
      <div class="res-top"><div class="rank r-${r.rank}">${r.rank}</div><div><div class="res-k">${G.caseDef.free ? 'Free Play' : `Case ${G.caseDef.num}`} · ${esc(G.caseDef.title)} · Score ${r.score}</div><h2>${esc(r.title)}</h2>${intro ? `<p>${esc(intro)}</p>` : ''}<p class="crit">${esc(criteria)}</p></div></div>
      ${panels.length ? `<div class="comic">${panels.map((p) => `<div class="panel">${p.img ? `<img alt="" src="${p.img}">` : `<div class="pp"><img alt="" src="${p.portrait}"></div>`}<div class="pcap">${esc(p.cap)}</div></div>`).join('')}</div>` : ''}
      <div class="res-cols">
        <div><h3>What really happened</h3><p>${truth}</p>
          ${st && passed ? `<h3>${st.finale ? 'And finally' : 'What happened next'}</h3><p class="next-beat">${esc(st.next)}</p>${st.finale ? `<p class="season-end"><b>${esc(SEASON.title)}</b> · case closed.</p>` : ''}` : ''}
          ${r.missed.length ? `<h3>What you missed</h3><ul class="missed">${r.missed.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : '<h3>What you missed</h3><p class="muted">Nothing. Clean case.</p>'}</div>
        <div><h3>Score</h3><table class="score">${r.rows.map(([l, v]) => `<tr><td>${esc(l)}</td><td>${v > 0 ? '+' : ''}${v}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td>${r.score}</td></tr></table>
          ${nextCase && r.rank !== 'F' && r.rank !== 'D' ? `<div class="unlock"><b>Case ${nextCase.num} unlocked: ${esc(nextCase.title)}</b><span>New: ${nextCase.learn.map((l) => esc(l[1])).join(', ')}</span></div>` : ''}</div>
      </div>
      <div class="acc-row"><button class="ghost" id="rTitle">Case select</button><button class="ghost" id="rSame">Try again</button>${nextCase && r.rank !== 'F' && r.rank !== 'D' ? '<button id="rNext">Next case</button>' : G.caseDef.free ? '<button id="rNew">New random case</button>' : ''}</div>`;
    $('#rTitle').addEventListener('click', () => { hide('#results'); toTitle(); });
    $('#rSame').addEventListener('click', () => openBriefing(G.caseDef));
    const rn = $('#rNext'); if (rn) { rn.addEventListener('click', () => openBriefing(nextCase)); setTimeout(() => rn.focus(), 50); }
    const rr = $('#rNew'); if (rr) rr.addEventListener('click', () => openBriefing(FREE_PLAY(G.caseDef.setting, randomCase())));
    G.verdictLine = null;
    show('#results');
    Sfx.ui(r.rank === 'F' || r.rank === 'D' ? 'bad' : 'lock');
  }

  // ---------------- keys ----------------
  function handleKey(k) {
    if (!$('#tip').hidden) { if (['Space', 'Enter', 'Escape', 'KeyE'].includes(k)) closeTip(); return true; }
    if (!$('#howto').hidden || !$('#settings').hidden) { if (k === 'Escape') closeSub(); return true; }
    if (!$('#pitchsheet').hidden) { if (k === 'Escape') hide('#pitchsheet'); return true; }
    if (k === 'KeyP' && S().presenter && G.state !== 'title') { toggleTour(); return true; }
    if (k === 'KeyM') { Sfx.init(); Store.set('master', S().master > 0 ? 0 : 0.8); applySettings(); caption(S().master ? 'Sound on' : 'Sound off', 1.2); return true; }
    if (G.state === 'paused') { if (k === 'Escape') resume(); return true; }
    if (G.state === 'briefing') { if (k === 'Enter' || k === 'Space') beginCase(); if (k === 'Escape') $('#briefBack').click(); return true; }
    if (G.state === 'title') return false;
    if (G.state === 'dialogue') {
      if (k === 'Escape') { closeDialogue(); return true; }
      if (/^Digit[1-9]$/.test(k)) { finishTyping(); choose(+k.slice(5) - 1); return true; }
      if (k === 'Space' || k === 'Enter') { if (dlg && dlg.typing) finishTyping(); else if (dlg && dlg.mode === 'item') closeDialogue(); return true; }
      return true;
    }
    if (G.state === 'notebook') { if (k === 'Escape' || k === 'Tab' || k === 'KeyN') closeNotebook(); return true; }
    if (G.state === 'accuse' || G.state === 'result') return true;
    return false;
  }

  return { init, resetRun, hud, objectives, prompt, caption, stamp, beat, speakNow, showTip, featureShown, clueToast, openDialogue, openItem, openPhoto, openNotebook, openAccuse, showResults, handleKey, pause };
})();
