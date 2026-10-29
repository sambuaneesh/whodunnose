// Test helpers for headless scenes: T.start(caseId or 'free-plane:seed'), T.to(seconds), T.talk(id), T.opt(regex).
window.T = {
  start(ref, seed) {
    const i = CASES.findIndex((c) => c.id === ref);
    const c = i >= 0 ? { ...CASES[i] } : FREE_PLAY(ref.replace('free-', '').split(':')[0], +(ref.split(':')[1]) || 4242);
    document.querySelector('#title').hidden = true; document.querySelector('#briefing').hidden = true;
    Game.newGame(c, seed || c.seed);
    for (const k in TIPS) G.tipsShown[k] = 1;
    G.tipQueue = []; document.querySelector('#tip').hidden = true; G.state = 'play';
  },
  to(t) {
    Game.skipTo(t);
    document.querySelector('#tip').hidden = true;
    ['#dialogue', '#notebook'].forEach((s) => (document.querySelector(s).hidden = true));
    if (G.state !== 'result' && G.state !== 'accuse') G.state = 'play';
  },
  talk(id) { const n = G.npcs.find((x) => x.id === id); G.state = 'dialogue'; G.talkWith = n; UI.openDialogue(n, 'talk'); },
  opt(re) { const b = [...document.querySelectorAll('#dlgOpts .opt')].find((x) => new RegExp(re, 'i').test(x.textContent)); if (b) b.click(); return b ? b.textContent : null; },
};
1;
