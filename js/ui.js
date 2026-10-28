'use strict';
// DOM layer: title + episode select, episode title cards, HUD, captions, stamps, dialogue,
// notebook (suspects, clues, timeline, Smell Board, Field Guide), the cross-examination,
// results with a comic-strip recap, and the pitch tour.
const UI = (() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let captionT = 0, stampT = 0, typeTimer = null, dlg = null, nbTab = 'suspects', acc = null, cardTimer = null;
  const hudCache = {};
  const setText = (el, key, val) => { if (hudCache[key] !== val) { hudCache[key] = val; el.textContent = val; } };
  const show = (s) => { $(s).hidden = false; };
  const hide = (s) => { $(s).hidden = true; };
  const randomCase = () => String(1000 + Math.floor(Math.random() * 9000));

  function init() {
    $('#btnStart').addEventListener('click', start);
    $('#btnDice').addEventListener('click', () => { $('#caseNum').value = randomCase(); Sfx.ui('tick'); });
    $('#caseNum').value = randomCase();
    $('#pitchToggle').addEventListener('change', (e) => { G.pitch = e.target.checked; renderTour(); });
    $('#btnPitchSheet').addEventListener('click', () => show('#pitchsheet'));
    $('#btnPitchClose').addEventListener('click', () => hide('#pitchsheet'));
    $('#btnTour').addEventListener('click', toggleTour);
    $('#btnTourClose').addEventListener('click', toggleTour);
    $('#btnMute').addEventListener('click', toggleMute);
    $('#btnCones').addEventListener('click', () => { G.showCones = !G.showCones; });
    $('#episode').addEventListener('click', beginEpisode);
    document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'notebook') return G.state === 'play' && openNotebook();
      if (a === 'clench') return;
      Sfx.init();
      Game[a] && Game[a]();
    }));
    const cl = $('#clenchBtn');
    const hold = (v) => (e) => { e.preventDefault(); G.clenchHeld = v; };
    cl.addEventListener('pointerdown', hold(true)); cl.addEventListener('pointerup', hold(false)); cl.addEventListener('pointerleave', hold(false));
    $('#dlgText').addEventListener('click', finishTyping);
    renderEpisodes();
    renderTour();
  }

  // ---------------- title, episodes ----------------
  function renderEpisodes() {
    $('#episodes').innerHTML = Object.values(LEVELS).sort((a, b) => a.episode.localeCompare(b.episode)).map((lv) =>
      `<button class="ep ${G.levelId === lv.id ? 'on' : ''}" data-lv="${lv.id}"><span class="ep-k">${esc(lv.episode)} · ${esc(lv.length)}</span><b>${esc(lv.title)}</b><span class="ep-b">${esc(lv.blurb)}</span></button>`).join('');
    document.querySelectorAll('.ep').forEach((b) => b.addEventListener('click', () => {
      G.levelId = b.dataset.lv; Sfx.ui('tick'); Game.showcase(G.levelId); renderEpisodes();
    }));
  }

  function start() {
    Sfx.init();
    const seed = parseInt($('#caseNum').value, 10) || +randomCase();
    $('#caseNum').value = seed;
    hide('#title'); hide('#results');
    Game.showcase(G.levelId);
    G.pendingSeed = seed; G.state = 'intro';
    $('#epKicker').textContent = LEVELS[G.levelId].episode;
    $('#epTitle').textContent = LEVELS[G.levelId].title;
    $('#epCase').textContent = `Case #${seed}`;
    show('#episode'); Sfx.sting('title');
    clearTimeout(cardTimer); cardTimer = setTimeout(beginEpisode, 3400);
  }
  function beginEpisode() {
    if (G.state !== 'intro') return;
    clearTimeout(cardTimer); hide('#episode');
    Game.newGame(G.levelId, G.pendingSeed);
  }

  function resetRun() {
    ['#dialogue', '#notebook', '#accuse', '#results'].forEach(hide);
    $('#toasts').innerHTML = ''; $('#clueToasts').innerHTML = '';
    speakNow(false);
    $('#hud').hidden = false; $('#actionbar').hidden = false;
    $('#caseTag').textContent = `Case #${G.seed}`;
    $('#objectLabel').textContent = L.objectLabel;
    renderTour();
  }

  // ---------------- HUD ----------------
  function hud() {
    if (!G.cs || G.state === 'title' || G.state === 'intro') return;
    G.auraShown = U.lerp(G.auraShown ?? 100, G.aura ?? 100, 0.08);
    $('#auraFill').style.width = G.auraShown.toFixed(1) + '%';
    setText($('#auraVal'), 'aura', Math.round(G.auraShown) + '');
    $('#auraMeter').classList.toggle('low', G.auraShown < 35);
    $('#tummyFill').style.width = (G.pressure ?? 0).toFixed(1) + '%';
    $('#tummyMeter').classList.toggle('danger', G.pressure > 70);
    const t = G.t || 0;
    setText($('#phase'), 'phase', L.phaseLabel(t));
    setText($('#clock'), 'clock', L.clockLabel(t));
    setText($('#loud'), 'loud', G.loud ? `LOUD: ${G.loud.label}` : '');
    $('#loud').hidden = !G.loud;
    const ps = G.state === 'play' ? Game.primeSuspect() : null;
    setText($('#roomSus'), 'room', ps ? `Room suspects: ${castById(ps).name}` : '');
    $('#roomSus').hidden = !ps;
    setText($('#svCharges'), 'sv', G.sv.t > 0 ? `${Math.ceil(G.sv.t)}s` : '●'.repeat(G.sv.charges) + '○'.repeat(3 - G.sv.charges));
    $('#svBtn').classList.toggle('active', G.sv.t > 0);
    $('#clenchBtn').classList.toggle('urgent', !!G.rumble);
    setText($('#tourCount'), 'tour', `${Object.keys(G.features).length}/${FEATURES.length}`);
    setText($('#btnCones'), 'cones', G.showCones ? 'Cones: on' : 'Cones: off');
    if (captionT > 0) { captionT -= 1 / 60; if (captionT <= 0) $('#caption').classList.remove('on'); }
    if (stampT > 0) { stampT -= 1 / 60; if (stampT <= 0) $('#stamp').classList.remove('on'); }
  }

  function caption(text, dur = 4) { const el = $('#caption'); el.textContent = text; el.classList.add('on'); captionT = dur; }
  function stamp(text, tone = 'red') {
    const el = $('#stamp'); el.textContent = text; el.className = 'stamp ' + tone;
    void el.offsetWidth; el.classList.add('on'); stampT = 2.4; Sfx.stamp();
  }
  function speakNow(on) { $('#objectBtn').classList.toggle('speak', on); }

  // ---------------- pitch tour ----------------
  function featureShown(f) {
    renderTour();
    if (!G.pitch || !f) return;
    const n = Object.keys(G.features).length;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="toast-k">System ${n} of ${FEATURES.length}</div><div class="toast-h">${esc(f.title)}</div><div class="toast-b">${esc(f.body)}</div>`;
    $('#toasts').prepend(el);
    while ($('#toasts').children.length > 2) $('#toasts').lastChild.remove();
    setTimeout(() => el.classList.add('out'), 7000);
    setTimeout(() => el.remove(), 7600);
  }
  function renderTour() {
    $('#tourList').innerHTML = FEATURES.map((f) => `<li class="${G.features[f.id] ? 'done' : ''}"><span class="tick">${G.features[f.id] ? '✓' : ''}</span><div><b>${esc(f.title)}</b><span>${esc(f.body)}</span></div></li>`).join('');
    $('#tourPct').textContent = `${Object.keys(G.features).length} of ${FEATURES.length} shown`;
  }
  function toggleTour() { $('#tour').hidden = !$('#tour').hidden; }
  function toggleMute() { Sfx.init(); Sfx.setMuted(!Sfx.muted); $('#btnMute').textContent = Sfx.muted ? 'Sound: off' : 'Sound: on'; }

  function clueToast(c) {
    const el = document.createElement('div');
    el.className = 'cluetoast k-' + c.kind;
    el.innerHTML = `<b>${c.kind === 'contradiction' ? 'Contradiction' : c.kind === 'photo' ? 'Photo' : 'New clue'}</b> ${esc(c.text)}`;
    $('#clueToasts').prepend(el);
    while ($('#clueToasts').children.length > 3) $('#clueToasts').lastChild.remove();
    setTimeout(() => el.classList.add('out'), 4200);
    setTimeout(() => el.remove(), 4800);
  }

  // ---------------- dialogue ----------------
  function typeText(text, voice) {
    clearInterval(typeTimer);
    const el = $('#dlgText'); el.textContent = ''; let i = 0;
    dlg.full = text; dlg.typing = true;
    typeTimer = setInterval(() => {
      i += 2; el.textContent = text.slice(0, i);
      if (i % 4 === 0 && text[i] && text[i] !== ' ') Sfx.blip(voice);
      if (i >= text.length) { clearInterval(typeTimer); dlg.typing = false; }
    }, 22);
  }
  function finishTyping() { if (dlg && dlg.typing) { clearInterval(typeTimer); $('#dlgText').textContent = dlg.full; dlg.typing = false; } }

  function dlgHeader(name, role, trait) {
    $('#dlgName').textContent = name;
    $('#dlgRole').textContent = role;
    $('#dlgTrait').textContent = trait || ''; $('#dlgTrait').hidden = !trait;
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
    else open = n.greeted ? U.pick(Math.random, ['Yes? Again?', 'Oh. You again.', 'Mm-hm?', 'What now?']) : v.hello;
    n.greeted = true;
    typeText(open, n.def.look.voice);
    renderOptions(); renderSus();
    show('#dialogue');
  }
  function openItem(c, it, bag, photo) {
    dlg = { n: null, mode: 'item' };
    $('#dlgPortrait').src = Art.portrait(c, 'neutral');
    dlgHeader(it.label, 'You rummage through it as fast as you can.', null);
    typeText(`Inside: ${bag.text}${photo ? ' And on the camera screen: a photo from the exact moment it happened.' : ''}`, 500);
    $('#dlgPhoto').hidden = !photo;
    if (photo) $('#dlgPhoto').innerHTML = polaroid(photo.img, photo.stamp);
    $('#dlgSus').innerHTML = '';
    singleOption('Put it back before anyone notices');
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
    if (!n || n.def.dog) { $('#dlgSus').innerHTML = ''; return; }
    const s = Math.round(n.sus);
    let top = null, tv = 15; for (const id in n.op) if (n.op[id] > tv) { tv = n.op[id]; top = id; }
    $('#dlgSus').innerHTML = `<span>How ${esc(n.def.name.split(' ').pop())} sees you</span><div class="susbar"><i style="width:${s}%"></i></div><em>${s < 25 ? 'fine' : s < 60 ? 'side-eye' : 'suspects you'}</em>${top ? `<span class="theory">Their theory: <b>${esc(castById(top).name)}</b></span>` : ''}`;
  }
  function renderOptions() {
    const { n, mode } = dlg;
    const opts = dlg.sub || (mode === 'confront' ? Game.confrontOptions() : mode === 'done' ? [{ id: 'leave', label: 'Walk away' }] : Game.talkOptions(n));
    dlg.opts = opts;
    $('#dlgOpts').innerHTML = opts.map((o, i) => `<button class="opt" data-i="${i}"><kbd>${i + 1}</kbd><span>${esc(o.label)}</span>${o.tag ? `<em class="tag t-${o.tag.replace(/\s/g, '')}">${esc(o.tag)}</em>` : ''}</button>`).join('');
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
    if (r.sub) { dlg.sub = r.sub; typeText('Who do you want them to suspect?', 300); renderOptions(); return; }
    dlg.sub = null;
    if (dlg.mode === 'confront') dlg.mode = 'done';
    $('#dlgPortrait').src = Art.portrait(n.def, r.expr || 'neutral');
    if (r.text) typeText(r.text, n.def.look.voice);
    renderOptions(); renderSus();
  }
  function closeDialogue() {
    clearInterval(typeTimer); dlg = null; hide('#dialogue');
    if (G.state === 'dialogue') G.state = 'play';
  }

  // ---------------- notebook ----------------
  function openNotebook(tab) {
    if (tab) nbTab = tab;
    G.state = 'notebook';
    renderNotebook();
    show('#notebook');
  }
  function closeNotebook() { hide('#notebook'); if (G.state === 'notebook') G.state = 'play'; }

  const KIND_LABEL = { claim: 'Said', zone: 'Where', bag: 'Bag', witness: 'Witness', gossip: 'Gossip', smell: 'Smell', sound: 'Sound', tell: 'Behaviour', contradiction: 'Lie', reaction: 'Noses', odd: 'Odd', photo: 'Photo' };

  function renderNotebook() {
    const tabs = [['suspects', 'Suspects'], ['clues', `Clues (${G.clues.filter((c) => c.kind !== 'odd').length})`], ['timeline', 'Timeline'], ['board', 'Smell Board'], ['guide', 'Field Guide']];
    $('#nbTabs').innerHTML = tabs.map(([id, l]) => `<button class="${nbTab === id ? 'on' : ''}" data-tab="${id}">${l}</button>`).join('') + '<button class="close" data-tab="close">Close (Esc)</button>';
    $('#nbTabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.tab === 'close') return closeNotebook();
      nbTab = b.dataset.tab; Sfx.ui('tick'); renderNotebook();
    }));
    const body = $('#nbBody');
    if (nbTab === 'suspects') body.innerHTML = suspectsHTML();
    if (nbTab === 'clues') body.innerHTML = cluesHTML();
    if (nbTab === 'timeline') body.innerHTML = timelineHTML();
    if (nbTab === 'board') { body.innerHTML = boardHTML(); bindBoard(); Game.feature('board'); }
    if (nbTab === 'guide') { body.innerHTML = guideHTML(); Game.feature('science'); }
  }

  function suspectsHTML() {
    const k = G.know;
    return `<p class="nb-lede">${CAST.length} suspects. One of them is lying about what they ate. ${k.smell ? `The smell: <b>${esc(G.cs.food.smell)}</b> (${esc(G.cs.food.name)}).` : 'You have not caught the smell yet.'}</p><div class="sgrid">` + CAST.map((c) => {
      const n = Game.npcById(c.id);
      const claim = k.claims[c.id] ? foodById(k.claims[c.id]).name : '—';
      const bag = k.bagFood[c.id] ? foodById(k.bagFood[c.id]).name : (k.bags[c.id] ? 'nothing to eat' : '—');
      const where = k.zones[c.id] ? zoneById(k.zones[c.id]).name : (G.clues.some((x) => x.key === 'zone-' + c.id) ? 'not here yet' : '—');
      const r = k.reactions.findIndex((x) => x.id === c.id);
      const react = r >= 0 ? `#${r + 1} by the ${zoneById(k.reactions[r].zone).name}` : (n.present ? 'not yet' : 'not here yet');
      const lied = G.clues.some((x) => x.key === 'contra-' + c.id);
      const tell = G.clues.some((x) => x.kind === 'tell' && x.who === c.id);
      const room = Math.round(Game.crowdOpinion(c.id));
      const flags = (lied ? '<span class="flag lie">Lied</span>' : '') + (tell ? '<span class="flag tell">Acting weird</span>' : '');
      return `<div class="scard"><img alt="" src="${Art.portrait(c, 'neutral')}"><div class="sc-main"><div class="sc-name">${esc(c.name)}</div><div class="sc-role">${esc(c.role)}</div><div class="sc-trait">${esc(c.trait || '')}</div>${flags}
        <dl><dt>Says they ate</dt><dd>${esc(claim)}</dd><dt>Bag holds</dt><dd>${esc(bag)}</dd><dt>Was by</dt><dd>${esc(where)}</dd><dt>Reacted</dt><dd>${esc(react)}</dd></dl>
        <div class="sc-sus"><span>Room suspects them</span><div class="susbar room"><i style="width:${room}%"></i></div></div>
        ${c.dog ? '' : `<div class="sc-sus"><span>They suspect you</span><div class="susbar"><i style="width:${Math.round(n.sus)}%"></i></div></div>`}</div></div>`;
    }).join('') + '</div>';
  }
  function cluesHTML() {
    const list = G.clues.slice().reverse();
    if (!list.length) return '<p class="nb-empty">Nothing yet. Talk to people, sniff around, stand near whisperers, and watch who does what.</p>';
    return '<ul class="clues">' + list.map((c) => `<li class="k-${c.kind}"><span class="chip">${KIND_LABEL[c.kind] || c.kind}</span><span class="ct">${esc(c.text)}${c.img ? polaroid(c.img, G.photo ? G.photo.stamp : '') : ''}</span><span class="ctime">${U.fmtTime(c.t)}</span></li>`).join('') + '</ul>';
  }
  function timelineHTML() {
    return '<ul class="tl">' + G.log.map((e) => `<li><span class="ctime">${U.fmtTime(e.t)}</span><span>${esc(e.text)}</span></li>`).join('') + '</ul><p class="nb-lede">Tip: the first people to react were closest to where it started. Kids, babies and dogs smell it soonest.</p>';
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
      <div class="board-row"><button id="bCheck" ${b.locked ? 'disabled' : ''}>Check my theory</button><span class="board-fb">${esc(b.feedback || 'The board only confirms a complete, correct theory. It will tell you when you are one blank away.')}</span></div>
      ${b.locked ? '<div class="solved">SOLVED</div>' : ''}
      <p class="nb-lede">Solving the board is optional, but it earns points. The accusation itself happens when you ${esc(L.objectLabel.replace('!', ''))}, under cross-examination.</p></div>`;
  }
  function bindBoard() {
    ['who', 'food', 'zone', 'cover'].forEach((k) => { const el = $('#b-' + k); if (el) el.addEventListener('change', () => { G.board[k] = el.value; }); });
    const btn = $('#bCheck'); if (btn) btn.addEventListener('click', () => { Game.checkBoard(); renderNotebook(); });
  }
  function guideHTML() {
    const foods = FOODS.filter((f) => (L.foods || []).includes(f.id) || f.id === L.scapegoat.food);
    const bar = (v) => `<span class="meter-mini"><i style="width:${Math.round(v * 100)}%"></i></span>`;
    return `<p class="nb-lede">Most fart gas has no smell at all. The stink is sulfur, mostly hydrogen sulfide, made when gut bacteria break down sulfur-rich protein. Volume comes from carbohydrates that bacteria turn into lots of odourless gas. So: what someone ate decides how loud it was <em>and</em> how bad it smells.</p>
      <div class="guide">${foods.map((f) => `<div class="gcard"><b>${esc(U.cap(f.name))}</b><span class="gsm">Smells like: ${esc(f.smell)}</span>
        <div class="grow"><span>Stink</span>${bar(f.stink)}</div><div class="grow"><span>Volume</span>${bar(f.loud)}</div><p>${esc(f.science)}</p></div>`).join('')}</div>
      <h3 class="g-h">Playground law</h3>
      <ul class="law"><li><b>Whoever smelt it, dealt it.</b> The first person to mention the smell becomes a suspect.</li><li><b>Whoever denied it, supplied it.</b> Protesting too hard looks guilty.</li><li><b>Whoever made the rhyme did the crime.</b> Do not quote these rules at people.</li></ul>`;
  }

  // ---------------- the call-out and cross-examination ----------------
  function openAccuse() {
    acc = { step: 'splash', accused: null };
    show('#accuse'); renderAccuse();
    setTimeout(() => { if (acc && acc.step === 'splash') { acc.step = 'suspect'; renderAccuse(); } }, 1500);
  }
  function renderAccuse() {
    const el = $('#accuseBody');
    if (acc.step === 'splash') { el.innerHTML = `<div class="objection">${esc(L.objectSplash.big)}</div><p class="obj-sub">${esc(L.objectSplash.sub)}</p>`; return; }
    if (acc.step === 'suspect') {
      const withdrawn = G.trial && G.trial.withdrawn;
      el.innerHTML = `<h2>Who dealt it?</h2><p class="acc-sub">${withdrawn ? 'You withdrew your first accusation. One more try.' : 'Accuse someone with a lot to lose and you win big if you are right. The room already leans toward whoever it suspects.'}</p><div class="agrid">` +
        CAST.map((c) => { const room = Math.round(Game.crowdOpinion(c.id)); return `<button class="acard ${acc.accused === c.id ? 'on' : ''}" data-id="${c.id}"><img alt="" src="${Art.portrait(c, 'neutral')}"><b>${esc(c.name)}</b><span class="mini-l">Stakes</span><span class="stakes"><i style="width:${c.shame * 10}%"></i></span><span class="mini-l">Room suspects</span><span class="stakes room"><i style="width:${room}%"></i></span><small>${esc(c.stakes)}</small></button>`; }).join('') +
        `</div><div class="acc-row"><button class="ghost" id="accCancel" ${withdrawn ? 'hidden' : ''}>Never mind</button><button id="accNext" ${acc.accused ? '' : 'disabled'}>Start the cross-examination</button></div>`;
      el.querySelectorAll('.acard').forEach((b) => b.addEventListener('click', () => { acc.accused = b.dataset.id; Sfx.ui('tick'); renderAccuse(); }));
      $('#accNext').addEventListener('click', () => { Game.startTrial(acc.accused); acc.step = 'trial'; acc.log = []; acc.picking = null; renderAccuse(); });
      const cancel = $('#accCancel'); if (cancel) cancel.addEventListener('click', cancelAccuse);
      return;
    }
    if (acc.step === 'trial') return renderTrial();
  }

  function renderTrial() {
    const tr = G.trial, c = castById(tr.accused), el = $('#accuseBody');
    const n = Game.npcById(tr.accused);
    const evidence = G.clues.filter((k) => k.kind !== 'odd');
    el.innerHTML = `<div class="trial-head"><img class="vport" alt="" src="${Art.portrait(c, n ? (n.expr === 'shock' ? 'shock' : n.expr === 'worried' ? 'worried' : n.expr === 'angry' ? 'angry' : 'neutral') : 'neutral')}">
        <div class="th-main"><div class="res-k">Cross-examination</div><h2>${esc(c.name)} testifies</h2>
        <div class="crowd"><span>The room believes you</span><div class="cbar"><i style="width:${Math.round(tr.belief)}%"></i></div><b>${Math.round(tr.belief)}%</b></div>
        <p class="acc-sub">Press a statement to hear more. Present the clue that breaks it. Wrong evidence costs belief and aura.</p></div></div>
      <ol class="testimony">${tr.statements.map((s, i) => `<li class="${tr.broken.has(i) ? 'broken' : ''}"><div class="st-text"><b>${esc(s.speaker)}:</b> "${esc(s.text)}"${tr.pressed.has(i) ? `<em>${esc(s.press)}</em>` : ''}</div>
        ${tr.broken.has(i) ? '<span class="st-broken">BROKEN</span>' : `<div class="st-btns"><button class="ghost" data-press="${i}">Press</button><button data-present="${i}">Present evidence</button></div>`}</li>`).join('')}</ol>
      ${acc.picking !== null && acc.picking !== undefined ? `<div class="picker"><div class="pk-h">Present against: "${esc(tr.statements[acc.picking].text)}"</div>
        <ul class="evlist">${evidence.length ? evidence.map((k) => `<li><button class="evbtn" data-clue="${k.key}"><span class="chip">${KIND_LABEL[k.kind] || k.kind}</span><span>${esc(k.text)}</span></button></li>`).join('') : '<li class="nb-empty">You have no evidence at all.</li>'}</ul>
        <div class="acc-row"><button class="ghost" id="pkCancel">Cancel</button></div></div>` : ''}
      <ul class="tlog">${(acc.log || []).map((l) => `<li class="${l.cls}">${esc(l.text)}</li>`).join('')}</ul>
      <div class="acc-row">${tr.withdrawn ? '' : '<button class="ghost" id="trWithdraw">Withdraw the accusation</button>'}<button id="trRest">Rest my case</button></div>`;
    el.querySelectorAll('[data-press]').forEach((b) => b.addEventListener('click', () => { Game.trialPress(+b.dataset.press); Sfx.ui('tick'); renderTrial(); }));
    el.querySelectorAll('[data-present]').forEach((b) => b.addEventListener('click', () => { acc.picking = +b.dataset.present; renderTrial(); }));
    el.querySelectorAll('[data-clue]').forEach((b) => b.addEventListener('click', () => {
      const i = acc.picking, r = Game.trialPresent(i, b.dataset.clue);
      acc.log.unshift(r.hit ? { cls: 'hit', text: `OBJECTION! That breaks "${tr.statements[i].text}"` } : { cls: 'miss', text: 'That does not contradict anything. The room groans.' });
      acc.picking = null;
      if (tr.broken.size === tr.statements.length) return verdict();
      renderTrial();
    }));
    const pk = $('#pkCancel'); if (pk) pk.addEventListener('click', () => { acc.picking = null; renderTrial(); });
    const wd = $('#trWithdraw'); if (wd) wd.addEventListener('click', () => { if (Game.withdraw()) { acc.step = 'suspect'; acc.accused = null; caption('You take it back. Everyone stares. Pick again.', 3); renderAccuse(); } });
    $('#trRest').addEventListener('click', verdict);
  }

  function cancelAccuse() {
    hide('#accuse'); acc = null; G.state = 'play'; G.objected = false; G.trial = null;
    G.npcs.forEach((n) => { n.expr = 'neutral'; n.exprT = 0; });
    Game.unfocus(); Sfx.setMusic(L.mode === 'elevator' ? 'muzak' : (G.t >= TIMELINE.procession ? 'tension' : 'mingle'));
    caption('You back down. Everyone is staring at you.', 3);
    for (const n of Game.humans()) n.sus = Math.min(100, n.sus + 10);
    Game.recomputeAura();
  }

  function verdict() {
    const res = Game.resolveTrial(), c = castById(res.accused), v = VOICES[c.id], sg = L.scapegoat;
    acc.step = 'verdict';
    const el = $('#accuseBody');
    el.innerHTML = `<div class="trial-head"><img class="vport" alt="" src="${Art.portrait(c, res.outcome === 'wrong' ? 'angry' : 'shock')}"><div class="th-main"><div class="res-k">The verdict</div><h2>${esc(c.name)}</h2><div class="crowd"><span>The room believes you</span><div class="cbar"><i style="width:${Math.round(res.outcome === 'wrong' ? 0 : res.outcome === 'confess' ? 100 : res.belief)}%"></i></div></div></div></div><ol id="vlines"></ol><div id="vend"></div>`;
    const finalLine = c.dog ? sg.outcome[res.outcome] : { confess: v.guilty, reluctant: v.reluctant, unproven: "That's ridiculous. You can't prove a thing.", wrong: v.innocent }[res.outcome];
    const lines = [{ who: c.dog ? castById(sg.speaker).name : c.name, text: finalLine, final: true }];
    if (res.outcome === 'wrong') lines.push({ who: 'Narrator', text: sg.finale(castById(G.cs.culprit).name) });
    if (res.outcome === 'unproven') lines.push({ who: 'Narrator', text: 'You were right. Nobody believes you. That is somehow worse.' });
    G.verdictLine = { who: lines[0].who, text: finalLine, accused: c.id, outcome: res.outcome };
    let i = 0;
    const ol = $('#vlines');
    const next = () => {
      if (!acc) return;
      if (i >= lines.length) {
        $('#vend').innerHTML = '<button id="vDone">See how you did</button>';
        $('#vDone').addEventListener('click', () => { hide('#accuse'); acc = null; Game.finish('accuse', res); });
        return;
      }
      const Ln = lines[i++], li = document.createElement('li');
      li.className = Ln.final ? 'final' : '';
      li.innerHTML = `<b>${esc(Ln.who)}</b> ${esc(Ln.text)}`;
      ol.appendChild(li);
      if (Ln.final) (res.outcome === 'wrong' || res.outcome === 'unproven' ? Sfx.ui('bad') : Sfx.ui('lock'));
      setTimeout(next, 1300);
    };
    setTimeout(next, 500);
  }

  // ---------------- results ----------------
  function showResults(r) {
    $('#hud').hidden = true; $('#actionbar').hidden = true; speakNow(false);
    const cs = G.cs, cul = castById(cs.culprit);
    const truth = `It was <b>${esc(cul.name)}</b>. They had ${esc(cs.food.name)} (${esc(cs.food.smell)}), it started by the ${esc(cs.origin.name)}${cs.fartType === 'sbd' ? ', silent but deadly' : cs.fartType === 'trumpet' ? ', and it was loud' : ''}, and they covered it up by ${esc(cs.cover.label)}.`;
    const herrings = `Red herrings this case: <b>${esc(castById(cs.roles.nearDecoy).name)}</b> was standing right next to them, and <b>${esc(castById(cs.roles.foodDecoy).name)}</b> really did eat ${esc(cs.food.name)}, but was across the room.`;
    const intro = { bankrupt: 'Your aura hit zero. Everyone has quietly agreed it was you.', peace: L.peaceText, accuse: '' }[r.kind];
    const missing = FEATURES.filter((f) => !G.features[f.id]);
    const vl = G.verdictLine;
    const panels = [
      G.snaps.fart ? { img: G.snaps.fart, cap: `${L.stampTime(TIMELINE.fart)}. It happens.` } : null,
      G.snaps.object ? { img: G.snaps.object, cap: `${esc(L.objectLabel)} You stand up.` } : null,
      vl ? { portrait: Art.portrait(castById(vl.accused), vl.outcome === 'wrong' ? 'angry' : 'shock'), cap: `${vl.who}: "${vl.text}"` } : { cap: intro || '' },
    ].filter(Boolean);
    $('#resultsBody').innerHTML = `
      <div class="res-top"><div class="rank r-${r.rank}">${r.rank}</div><div><div class="res-k">${esc(L.episode)} · ${esc(L.title)} · Case #${G.seed} · Final score ${r.score}</div><h2>${esc(r.title)}</h2>${intro ? `<p>${esc(intro)}</p>` : ''}</div></div>
      <div class="comic">${panels.map((p, i) => `<div class="panel p${i}">${p.img ? `<img alt="" src="${p.img}">` : p.portrait ? `<div class="pp"><img alt="" src="${p.portrait}"></div>` : ''}<div class="pcap">${esc(p.cap)}</div></div>`).join('')}</div>
      <div class="res-cols">
        <div><h3>Score</h3><table class="score">${r.rows.map(([l, v]) => `<tr><td>${esc(l)}</td><td>${v > 0 ? '+' : ''}${v}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td>${r.score}</td></tr></table></div>
        <div><h3>What really happened</h3><p>${truth}</p><p class="muted">${herrings}</p>
        <h3>Pitch tour</h3><p class="muted">${Object.keys(G.features).length} of ${FEATURES.length} systems shown this run.${missing.length ? ` Not seen yet: ${missing.map((f) => esc(f.title)).join(', ')}.` : ' All of them.'}</p></div>
      </div>
      <div class="acc-row"><button class="ghost" id="rTitle">Title screen</button><button class="ghost" id="rSame">Replay case #${G.seed}</button><button id="rNew">New case, new culprit</button></div>`;
    $('#rNew').addEventListener('click', () => { $('#caseNum').value = randomCase(); start(); });
    $('#rSame').addEventListener('click', () => { $('#caseNum').value = G.seed; start(); });
    $('#rTitle').addEventListener('click', () => { hide('#results'); G.state = 'title'; G.verdictLine = null; Game.showcase(G.levelId); renderEpisodes(); show('#title'); });
    G.verdictLine = null;
    show('#results');
    Sfx.ui(r.rank === 'F' || r.rank === 'D' ? 'bad' : 'lock');
  }

  // ---------------- keys ----------------
  function handleKey(k) {
    if (k === 'KeyP' && G.state !== 'title') { toggleTour(); return true; }
    if (k === 'KeyM') { toggleMute(); return true; }
    if (!$('#pitchsheet').hidden) { if (k === 'Escape') hide('#pitchsheet'); return true; }
    if (G.state === 'intro') { if (['Enter', 'Space', 'Escape', 'KeyE'].includes(k)) beginEpisode(); return true; }
    if (G.state === 'title') { if (k === 'Enter') start(); return k === 'Enter'; }
    if (G.state === 'dialogue') {
      if (k === 'Escape') { closeDialogue(); return true; }
      if (/^Digit[1-9]$/.test(k)) { finishTyping(); choose(+k.slice(5) - 1); return true; }
      if (k === 'Space' || k === 'Enter' || k === 'KeyE') { if (dlg && dlg.typing) finishTyping(); else if (dlg && dlg.mode === 'item') closeDialogue(); return true; }
      return true;
    }
    if (G.state === 'notebook') {
      if (k === 'Escape' || k === 'Tab' || k === 'KeyN') { closeNotebook(); return true; }
      return true;
    }
    if (G.state === 'accuse' || G.state === 'result') return true;
    return false;
  }

  return { init, resetRun, hud, caption, stamp, speakNow, featureShown, clueToast, openDialogue, openItem, openPhoto, openNotebook, openAccuse, showResults, handleKey, renderEpisodes };
})();
