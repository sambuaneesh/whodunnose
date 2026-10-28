'use strict';
// Builds a solvable mystery from a case number for the current level. Three independent
// evidence chains always converge on the culprit:
//   1. Location  - only the culprit and one innocent ("near decoy") were at the origin
//                  (plus, at most, the culprit's stay-near companion such as a baby's stroller).
//   2. The lie   - the culprit lies about breakfast; their bag and a witness contradict it.
//                  A "food decoy" really did eat the matching food, but was across the room.
//   3. The tell  - only the culprit performs a cover-up behaviour.
// What they ate decides the fart: beans are loud, eggs are silent and deadly.
const Case = (() => {
  function fartTypeFor(food, r) {
    const w = { trumpet: food.loud * 1.2, squeaker: 0.35, sbd: (1 - food.loud) * 1.3 };
    let x = r() * (w.trumpet + w.squeaker + w.sbd);
    for (const k of ['trumpet', 'squeaker', 'sbd']) { x -= w[k]; if (x <= 0) return k; }
    return 'sbd';
  }

  function generate(seed) {
    const r = U.rng(seed);
    const late = new Set(L.lateArrivals || []);
    const sg = L.scapegoat;
    const candidates = CAST.filter((c) => !late.has(c.id));
    const weights = candidates.map((c) => (c.dog ? 0.45 : 1));
    let x = r() * weights.reduce((a, b) => a + b, 0), culprit = candidates[0].id;
    for (let i = 0; i < candidates.length; i++) { x -= weights[i]; if (x <= 0) { culprit = candidates[i].id; break; } }
    const isDog = culprit === sg.id;
    const food = isDog ? foodById(sg.food) : U.pick(r, HUMAN_FOODS());
    const fartType = fartTypeFor(food, r);
    const cover = isDog ? sg.cover : U.pick(r, COVERS);
    const origin = U.pick(r, ZONES);
    const companion = CAST.find((c) => c.stayNear === culprit) || (castById(culprit).stayNear ? castById(castById(culprit).stayNear) : null);

    const present = HUMANS.filter((id) => !late.has(id));
    const pool = U.shuffle(r, present.filter((id) => id !== culprit && (!companion || id !== companion.id)));
    const nearDecoy = pool[0], foodDecoy = pool[1];
    const witnessPool = U.shuffle(r, HUMANS.filter((id) => id !== culprit && id !== nearDecoy && id !== foodDecoy));
    const pref = L.preferredWitness;
    const witness = pref && witnessPool.includes(pref) ? pref : witnessPool[0];
    const rest = U.shuffle(r, present.filter((id) => ![culprit, nearDecoy, foodDecoy, witness].includes(id)));
    const positionalWitness = rest[0], mealWitness = rest[1], culpritPosWitness = rest[2];

    // meals (truth) and claims (what they say)
    const others = HUMAN_FOODS().filter((f) => f.id !== food.id);
    const fav = L.favoriteFood || {};
    const meals = {}, claims = {};
    for (const id of HUMANS) {
      if (id === culprit || id === foodDecoy) meals[id] = food.id;
      else if (fav[id] && fav[id] !== food.id) meals[id] = fav[id];
      else meals[id] = U.pick(r, others).id;
      claims[id] = meals[id];
    }
    if (!isDog) claims[culprit] = U.pick(r, others.filter((f) => f.id !== meals[culprit])).id;
    meals[sg.id] = isDog ? sg.food : null;

    // where everyone stands when it happens
    const spots = {}, taken = [];
    function place(z, near = null) {
      for (let tries = 0; tries < 80; tries++) {
        let p;
        if (near) {
          const a = r() * Math.PI * 2, d = 50 + r() * 26;
          p = { x: near.x + Math.cos(a) * d, y: near.y + Math.sin(a) * d * 0.6 };
          p.x = U.clamp(p.x, z.x + 30, z.x + z.w - 30); p.y = U.clamp(p.y, z.y + 50, z.y + z.h - 12);
        } else {
          p = { x: z.x + 40 + r() * (z.w - 80), y: z.y + 60 + r() * (z.h - 75) };
        }
        if (taken.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 46) || tries === 79) { taken.push(p); return p; }
      }
    }
    spots[culprit] = place(origin);
    if (companion) spots[companion.id] = place(origin, spots[culprit]);
    spots[nearDecoy] = place(origin, spots[culprit]);
    const oc = zoneCenter(origin);
    const elsewhere = ZONES.filter((z) => z.id !== origin.id);
    const far = elsewhere.slice().sort((a, b) => U.dist(zoneCenter(b), oc) - U.dist(zoneCenter(a), oc))[0];
    spots[foodDecoy] = place(far);
    for (const c of CAST) {
      if (spots[c.id] || late.has(c.id)) continue;
      if (c.stayNear && spots[c.stayNear]) continue; // placed after their partner
      spots[c.id] = place(U.pick(r, elsewhere));
    }
    for (const c of CAST) if (!spots[c.id] && c.stayNear && spots[c.stayNear]) spots[c.id] = place(zoneAt(spots[c.stayNear]), spots[c.stayNear]);
    for (const c of CAST) if (!spots[c.id] && c.stayNear === undefined && !late.has(c.id)) spots[c.id] = place(U.pick(r, elsewhere));
    for (const c of CAST) if (!spots[c.id] && CAST.some((k) => k.stayNear === c.id) && !late.has(c.id)) spots[c.id] = place(U.pick(r, elsewhere));
    const fartZone = {};
    for (const id in spots) fartZone[id] = zoneAt(spots[id]).id;

    const nm = (id) => castById(id).name;
    const facts = {};
    facts[witness] = isDog
      ? { text: sg.witness, implicates: [sg.id], weight: 2, kind: 'witness', food: sg.food, about: sg.id, short: `${nm(sg.id)} ate ${food.name}...` }
      : { text: `${nm(culprit)} was scarfing ${food.name} before this. I saw it.`, implicates: [culprit], weight: 2, kind: 'witness', food: food.id, about: culprit, short: `...${nm(culprit)} and the ${food.name}...` };
    if (positionalWitness) facts[positionalWitness] = { text: `${nm(nearDecoy)} was right by the ${origin.name} when it started.`, implicates: [nearDecoy], weight: 1, kind: 'zone', about: nearDecoy, zone: origin.id, short: `...${nm(nearDecoy)}, by the ${origin.name}...` };
    if (mealWitness) facts[mealWitness] = { text: `${nm(foodDecoy)} went back for seconds of the ${food.name}. Thirds, actually.`, implicates: [foodDecoy], weight: 1, kind: 'meal', about: foodDecoy, food: food.id, short: `...${nm(foodDecoy)} had thirds...` };
    if (culpritPosWitness) facts[culpritPosWitness] = { text: `${nm(culprit)} was over by the ${origin.name} earlier. Kind of lurking.`, implicates: [culprit], weight: 1, kind: 'zone', about: culprit, zone: origin.id, short: `...${nm(culprit)} lurking by the ${origin.name}...` };

    const bags = {};
    for (const c of CAST) {
      if (c.dog) {
        bags[c.id] = { text: sg.bedText(isDog), food: isDog ? sg.food : null, implicates: isDog ? [sg.id] : [], weight: isDog ? 2 : 0 };
      } else {
        const f = foodById(meals[c.id]);
        bags[c.id] = { text: `${L.bagFlavor[c.id]} ${f.wrapper}.`, food: f.id, implicates: f.id === food.id ? [c.id] : [], weight: 2 };
      }
    }
    // the culprit's lie under cross-examination: a zone they were not in
    const alibiZone = U.pick(r, elsewhere).id;

    return {
      seed, level: L.id, culprit, isDog, food, fartType, cover, origin, spots, fartZone, meals, claims, facts, bags, alibiZone,
      companion: companion ? companion.id : null,
      roles: { nearDecoy, foodDecoy, witness },
      answer: { who: culprit, food: food.id, zone: origin.id, cover: cover.id },
    };
  }
  return { generate, fartTypeFor };
})();
