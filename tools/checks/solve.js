// Plays every case like a thorough player (asks everyone everything, searches bags unseen), then calls it.
// Prints one line per case; any ERR or a wrong outcome is a regression.
(function () {
  const out = [], errs = [];
  window.addEventListener('error', (e) => errs.push(e.message + ' @' + e.lineno));
  const closeAll = () => { ['#dialogue', '#notebook', '#tip', '#pause'].forEach((s) => (document.querySelector(s).hidden = true)); if (G.state !== 'result' && G.state !== 'accuse') G.state = 'play'; };
  const cases = [...CASES.filter((c) => !c.reverse), FREE_PLAY('elevator', 4321), FREE_PLAY('wedding', 8765), FREE_PLAY('plane', 2468), FREE_PLAY('plane', 1357)];
  for (const c of cases) {
    try {
      G.result = null; Game.newGame(c, c.seed);
      for (const k in TIPS) G.tipsShown[k] = 1;
      let i = 0;
      while (G.state !== 'result' && G.t < TIMELINE.speakNow - 2 && i++ < 30) {
        closeAll();
        Game.sniff(); if (i === 2) Game.smellVision(); if (i === 6) Game.release();
        for (const n of G.npcs) {
          if (!n.present) continue;
          for (const o of Game.talkOptions(n)) if (!['leave', 'rumor', 'show'].includes(o.id) && !(o.id === 'smell' && !G.mentioned)) Game.talkChoose(n, o.id);
        }
        closeAll();
        // search one bag per round, standing on it while everyone looks away
        if (RULES.search && G.flags.fart) { const cc = CAST.find((k) => G.items[k.id].present && !G.know.bags[k.id]); if (cc) { const it = G.items[cc.id]; G.player.x = it.x; G.player.y = it.y + 2; for (const n of Game.humans()) n.face = -Math.PI / 2; G.eDown = { held: 0.3, done: false }; Game.skipTo(G.t + 1.2); G.eDown = null; closeAll(); } }
        for (const n of Game.humans()) n.sus = Math.min(n.sus, 30);
        Game.skipTo(G.t + 12);
      }
      if (G.state === 'result') { out.push(`${c.id}: ended early (${G.result.kind})`); continue; }
      closeAll(); Game.object();
      let res;
      if (RULES.accuse === 'point') res = Game.resolvePoint(G.cs.culprit);
      else if (RULES.accuse === 'proof') { const cl = G.clues.filter((k) => (k.implicates || []).includes(G.cs.culprit)).sort((a, b) => b.weight - a.weight)[0]; res = Game.resolveProof(G.cs.culprit, cl && cl.key); }
      else { const tr = Game.startTrial(G.cs.culprit); tr.statements.forEach((s, k) => { const cl = G.clues.find((x) => s.contra(x)); if (cl) Game.trialPresent(k, cl.key); }); res = Game.resolveTrial(); }
      document.querySelector('#accuse').hidden = true;
      Game.finish('accuse', res);
      out.push(`${c.id} (${L.id}): culprit=${G.cs.culprit} at ${G.cs.origin.id} mode=${RULES.accuse} outcome=${res.outcome} proof=${res.proof} rank=${G.result.rank} aura=${Math.round(G.aura)} clues=${G.clues.length} obj=${Object.values(G.objState).filter((s) => s === 'done').length}/${G.caseDef.objectives.length}`);
    } catch (e) { out.push(`${c.id} ERR ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
  }
  return out.join('\n') + '\nERRS: ' + errs.join(' ; ');
})()
