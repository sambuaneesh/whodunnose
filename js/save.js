'use strict';
// Settings and campaign progress, kept in this browser. Storage can be blocked (private windows),
// so every read and write is wrapped and the game works without it.
const Store = (() => {
  const KEY = 'whodunnose.v3';
  const RANKS = ['F', 'D', 'C', 'B', 'A', 'S'];
  const defaults = () => ({
    settings: { master: 0.8, music: 0.5, presenter: false, playtest: false, cones: true, shake: true, textSpeed: 'normal', difficulty: 'normal' },
    progress: {}, // caseId -> { done, best, plays }
    tipsSeen: {},
    achievements: {}, // id -> date unlocked
    daily: {}, // YYYY-MM-DD -> { best, plays, first }
  });
  let data = defaults();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw), d = defaults();
        data = { ...d, ...saved, settings: { ...d.settings, ...(saved.settings || {}) }, progress: saved.progress || {}, tipsSeen: saved.tipsSeen || {},
          achievements: saved.achievements || {}, daily: saved.daily || {} };
      }
    } catch (e) { data = defaults(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage blocked: keep going */ } }

  const settings = () => data.settings;
  function set(key, value) { data.settings[key] = value; save(); }

  function record(caseId, rank) {
    const p = data.progress[caseId] || { done: false, best: null, plays: 0 };
    p.plays++;
    if (rank !== 'F' && rank !== 'D') p.done = true;
    if (!p.best || RANKS.indexOf(rank) > RANKS.indexOf(p.best)) p.best = rank;
    data.progress[caseId] = p;
    save();
    return p;
  }
  const progress = (caseId) => data.progress[caseId] || null;
  // A case is open if it is the first, the previous one is done, or the playtest tools are on.
  function unlocked(index) {
    if (index === 0 || data.settings.playtest) return true;
    const prev = CASES[index - 1];
    return !!(data.progress[prev.id] && data.progress[prev.id].done);
  }
  const campaignDone = () => CASES.every((c) => data.progress[c.id] && data.progress[c.id].done);
  const nextCase = () => CASES.find((c, i) => unlocked(i) && !(data.progress[c.id] && data.progress[c.id].done)) || CASES[CASES.length - 1];
  // resetting the campaign keeps settings, achievements and daily history
  function reset() { const { settings, achievements, daily } = data; data = { ...defaults(), settings, achievements, daily }; save(); }
  const bag = (k) => data[k];

  load();
  return { settings, set, record, progress, unlocked, campaignDone, nextCase, reset, bag, commit: save, RANKS };
})();
