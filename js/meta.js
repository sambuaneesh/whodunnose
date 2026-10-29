'use strict';
// Things that live outside a single case: the daily case (same case for everyone on a given date, with a
// streak and a spoiler-free result to share) and achievements. Both are stored in this browser only.
// Playtest runs never count.
const Meta = (() => {
  const pad = (n) => String(n).padStart(2, '0');
  const EPOCH = Date.UTC(2026, 9, 29); // daily case #1

  // ---------------- daily case ----------------
  function today() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function dayIndex(key) { const [y, m, d] = key.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000); }
  function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function dailyCase(key = today()) {
    const n = dayIndex(key) + 1, setting = ['plane', 'elevator', 'wedding'][n % 3];
    return {
      ...FREE_PLAY(setting, 1000 + (hash('whodunnose' + key) % 9000)), id: 'daily', daily: key, dailyNum: n,
      title: `Daily Case #${n}`, goal: 'Everyone gets this exact case today. Everything is on, difficulty is Normal, and the first finish of the day is the one that counts for your streak.',
    };
  }
  function recordDaily(key, result) {
    const all = Store.bag('daily'), d = all[key] || { best: null, plays: 0, first: null };
    d.plays++;
    if (!d.first) d.first = { rank: result.rank, score: result.score, aura: Math.round(G.aura), hints: G.hintsUsed };
    if (!d.best || Store.RANKS.indexOf(result.rank) > Store.RANKS.indexOf(d.best)) d.best = result.rank;
    all[key] = d; Store.commit();
    return { done: true, best: d.best, plays: d.plays };
  }
  function streak() {
    const all = Store.bag('daily'); let n = 0;
    const d = new Date(); if (!all[today()]) d.setDate(d.getDate() - 1); // today not played yet: count up to yesterday
    for (;;) { const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; if (!all[k]) break; n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function shareText(r) {
    const c = G.caseDef, marks = c.objectives.map((id) => ({ done: '🟩', fail: '🟥' }[G.objState[id]] || '⬜')).join('');
    return `Whodunnose · Daily #${c.dailyNum} (${LEVELS[c.setting].short})\nRank ${r.rank} · Aura ${Math.round(G.aura)}% · ${G.hintsUsed} hint${G.hintsUsed === 1 ? '' : 's'}\n${marks}`;
  }

  // ---------------- achievements ----------------
  // `live` ones are checked during play; the rest when a case ends (r is the result).
  const ACH = [
    { id: 'first', title: 'Going Down', desc: 'Finish your first case.', test: () => true },
    { id: 'srank', title: 'Nose of God', desc: 'Get an S rank.', test: (r) => r.rank === 'S' },
    { id: 'season', title: 'Head of Air Quality', desc: 'Finish all six cases of season one.', test: () => CASES.filter((c) => !c.bonus && !c.season).every((c) => (Store.progress(c.id) || {}).done) },
    { id: 'perfect', title: 'The Perfect Crime', desc: 'Get an S rank in You Dealt It.', test: (r) => r.kind === 'reverse' && r.rank === 'S' },
    { id: 'patsy', title: 'Patsy', desc: 'Get somebody else named in You Dealt It.', test: (r) => r.kind === 'reverse' && r.acc.named && r.acc.named !== 'player' },
    { id: 'baby', title: 'It Really Was the Baby', desc: 'Correctly name a baby or a dog as the culprit.', test: (r) => r.kind === 'accuse' && r.acc.correct && G.cs.isDog },
    { id: 'wrong', title: 'Wrong Nose', desc: 'Accuse the wrong person. Everyone does it once.', test: (r) => r.kind === 'accuse' && !r.acc.correct },
    { id: 'objection', title: 'Objection!', desc: 'Break all three statements in a cross-examination.', test: (r) => r.kind === 'accuse' && r.acc.mode === 'cross' && r.acc.broken === 3 },
    { id: 'nohint', title: 'No Help Needed', desc: 'Prove a case without using a hint.', test: (r) => r.kind === 'accuse' && r.acc.correct && r.acc.proof === 'full' && !G.hintsUsed && r.acc.mode !== 'point' },
    { id: 'untouchable', title: 'Untouchable', desc: 'Finish a case without losing any Aura.', test: (r) => RULES.aura && G.aura >= 99.5 && r.rank !== 'F' && r.rank !== 'D' },
    { id: 'lawyer', title: 'Playground Lawyer', desc: 'Win a case with playground law on, without ever mentioning the smell first.', test: (r) => RULES.folklore && G.mentioned && G.mentionBy !== 'player' && r.rank !== 'F' && r.rank !== 'D' },
    { id: 'liar', title: 'Lie Detector', desc: 'Catch a liar out with their own bag.', live: true, test: () => G.clues.some((c) => c.kind === 'contradiction' && c.text.includes('their bag')) },
    { id: 'gotcha', title: 'Gotcha', desc: 'Show a liar the evidence and watch them crack.', live: true, test: () => G.clues.some((c) => c.key.startsWith('admit-')) },
    { id: 'ninja', title: 'Bag Ninja', desc: 'Search three bags in one case without being seen.', live: true, test: () => (G.stats.unseenBags || 0) >= 3 },
    { id: 'ears', title: 'Walls Have Ears', desc: 'Overhear three whispers in one case.', live: true, test: () => (G.stats.overheard || 0) >= 3 },
    { id: 'iron', title: 'Iron Gut', desc: 'Clench through three rumbles in one case.', live: true, test: () => (G.stats.clenches || 0) >= 3 },
    { id: 'timed', title: 'Perfectly Timed', desc: 'Let one go under something loud.', live: true, test: () => !!G.flags.releasedLoud },
    { id: 'board', title: 'Case Closed', desc: 'Lock in a perfect Smell Board.', live: true, test: () => !!(G.board && G.board.locked) },
    { id: 'daily3', title: 'Daily Driver', desc: 'Finish daily cases on three different days.', test: () => Object.keys(Store.bag('daily')).length >= 3 },
    { id: 'streak7', title: 'Regular', desc: 'Keep a seven-day daily streak.', test: () => streak() >= 7 },
  ];
  const unlocked = () => Store.bag('achievements');
  function award(a) {
    if (unlocked()[a.id]) return;
    unlocked()[a.id] = today(); Store.commit();
    UI.achievement(a);
  }
  let tickT = 0;
  function tick(dt) {
    if (Playtest.active || !G.cs || (tickT -= dt) > 0) return;
    tickT = 1;
    for (const a of ACH) if (a.live && !unlocked()[a.id]) { try { if (a.test()) award(a); } catch (e) { /* state not ready */ } }
  }
  function onFinish(r) {
    if (Playtest.active) return;
    for (const a of ACH) if (!unlocked()[a.id]) { try { if (a.test(r)) award(a); } catch (e) { /* not applicable */ } }
  }

  return { today, dailyCase, recordDaily, streak, shareText, ACH, unlocked, tick, onFinish };
})();
