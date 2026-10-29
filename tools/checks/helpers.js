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
  // ask everyone everything (like a thorough player), then close the dialogue
  gather() { for (const n of G.npcs) if (n.present) for (const o of Game.talkOptions(n)) if (!['leave', 'rumor', 'show'].includes(o.id) && !(o.id === 'smell' && !G.mentioned)) Game.talkChoose(n, o.id); T.to(G.t); },
  // call it on someone (the culprit by default) with the best evidence, and show the results
  finish(who) {
    who = who || G.cs.culprit; Game.object(); let res;
    if (RULES.accuse === 'point') res = Game.resolvePoint(who);
    else if (RULES.accuse === 'proof') { const cl = G.clues.filter((k) => (k.implicates || []).includes(who)).sort((a, b) => b.weight - a.weight)[0]; res = Game.resolveProof(who, cl && cl.key); }
    else { const tr = Game.startTrial(who); tr.statements.forEach((s, k) => { const cl = G.clues.find((x) => s.contra(x)); if (cl) Game.trialPresent(k, cl.key); }); res = Game.resolveTrial(); }
    document.querySelector('#accuse').hidden = true; Game.finish('accuse', res);
  },
  opt(re) { const b = [...document.querySelectorAll('#dlgOpts .opt')].find((x) => new RegExp(re, 'i').test(x.textContent)); if (b) b.click(); return b ? b.textContent : null; },
};
1;
