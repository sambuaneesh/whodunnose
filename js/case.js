'use strict';
// Builds a solvable mystery from a case number for the current level. Three independent
// evidence chains always converge on the culprit:
//   1. Location  - only the culprit and one innocent ("near decoy") were at the origin
//                  (plus, at most, the culprit's stay-near companion such as a baby's stroller).
//   2. The lie   - the culprit lies about breakfast; their bag and a witness contradict it.
//                  A "food decoy" really did eat the matching food, but was across the room.
//   3. The tell  - only the culprit performs a cover-up behaviour.
// What they ate decides the fart: beans are loud, eggs are silent and deadly.
// Campaign cases are authored: their story (js/story.js) fixes the culprit, meal, lie, roles, where
// people stood and what witnesses say, so the evidence matches the writing. Free Play leaves it all to the seed.
const Case = (() => {
  function fartTypeFor(food, r) {
    const w = { trumpet: food.loud * 1.2, squeaker: 0.35, sbd: (1 - food.loud) * 1.3 };
    let x = r() * (w.trumpet + w.squeaker + w.sbd);
    for (const k of ['trumpet', 'squeaker', 'sbd']) { x -= w[k]; if (x <= 0) return k; }
    return 'sbd';
  }

  // The bonus case: the player did it. Nothing has happened yet; the player decides when and where (see
  // Game.release). One other person ate the same thing (the obvious patsy), and one person saw the player eat.
  function generateReverse(seed) {
    const r = U.rng(seed), fix = (L.caseDef.story && L.caseDef.story.fix) || {}, pin = fix.pins || {};
    const late = new Set(L.lateArrivals || []);
    const food = foodById(fix.food || 'chili');
    const present = HUMANS.filter((id) => !late.has(id));
    const patsy = present.includes(fix.patsy) ? fix.patsy : U.pick(r, present);
    const witness = HUMANS.includes(fix.witness) && fix.witness !== patsy ? fix.witness : U.pick(r, present.filter((id) => id !== patsy));
    const others = HUMAN_FOODS().filter((f) => f.id !== food.id);
    const meals = {}, claims = {};
    for (const id of HUMANS) {
      meals[id] = id === patsy ? food.id : fix.meals && fix.meals[id] && fix.meals[id] !== food.id ? fix.meals[id] : U.pick(r, others).id;
      claims[id] = meals[id];
    }
    meals[L.scapegoat.id] = null;
    // everyone spread around the car (or room); stroller next to its parent
    const spots = {}, taken = [{ ...L.player.start }], gap = L.ranges.spacing;
    const count = (z) => taken.filter((q) => zoneAt(q).id === z.id).length;
    const place = (z, near) => {
      for (let tries = 0; tries < 60; tries++) {
        const p = near ? { x: U.clamp(near.x + (r() - 0.5) * gap * 2.4, z.x + 6, z.x + z.w - 6), y: U.clamp(near.y + (r() - 0.5) * gap, z.y + z.h * 0.3, z.y + z.h - 2) } : spotIn(z, r);
        if (taken.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > gap) || tries === 59) { taken.push(p); return L.fixSpot ? L.fixSpot(p) : p; }
      }
    };
    for (const c of CAST) {
      if (late.has(c.id) || c.stayNear) continue;
      const z = pin[c.id] ? zoneById(pin[c.id]) : U.pick(r, ZONES.filter((q) => count(q) === Math.min(...ZONES.map(count))));
      spots[c.id] = place(z);
    }
    for (const c of CAST) if (c.stayNear && spots[c.stayNear]) spots[c.id] = place(zoneAt(spots[c.stayNear]), spots[c.stayNear]);
    const facts = { [witness]: { text: fix.witnessText || `You ate ${food.name} this morning. I saw it.`, implicates: ['player'], weight: 2, kind: 'witness', food: food.id, about: 'player', short: `...the ${food.name}...` } };
    const bags = {};
    for (const c of CAST) {
      if (c.dog) { bags[c.id] = { text: L.scapegoat.bedText(false), food: null, implicates: [], weight: 0 }; continue; }
      const f = foodById(meals[c.id]);
      bags[c.id] = { text: `${L.bagFlavor[c.id]} ${f.wrapper}.`, food: f.id, implicates: f.id === food.id ? [c.id] : [], weight: 2 };
    }
    return {
      seed, level: L.id, reverse: true, culprit: 'player', isDog: false, food, fartType: null, cover: null, origin: null,
      spots, fartZone: {}, meals, claims, facts, bags, alibiZone: null, companion: null,
      roles: { patsy, witness, nearDecoy: null, foodDecoy: patsy }, answer: {},
    };
  }

  function generate(seed) {
    if (L.caseDef && L.caseDef.reverse) return generateReverse(seed);
    const r = U.rng(seed);
    const fix = (L.caseDef && L.caseDef.story && L.caseDef.story.fix) || {};
    const pin = fix.pins || {};
    const late = new Set(L.lateArrivals || []);
    const sg = L.scapegoat;
    const candidates = CAST.filter((c) => !late.has(c.id));
    const weights = candidates.map((c) => (c.dog ? 0.45 : 1));
    let x = r() * weights.reduce((a, b) => a + b, 0), culprit = candidates[0].id;
    for (let i = 0; i < candidates.length; i++) { x -= weights[i]; if (x <= 0) { culprit = candidates[i].id; break; } }
    if (fix.culprit) culprit = fix.culprit;
    const isDog = culprit === sg.id;
    const food = fix.food ? foodById(fix.food) : isDog ? foodById(sg.food) : U.pick(r, HUMAN_FOODS());
    const fartType = fix.fartType || fartTypeFor(food, r);
    const cover = fix.cover ? COVERS.find((c) => c.id === fix.cover) : isDog ? sg.cover : U.pick(r, COVERS);
    const rolledOrigin = U.pick(r, spawnZones()), origin = fix.origin ? zoneById(fix.origin) : rolledOrigin;
    const companion = CAST.find((c) => c.stayNear === culprit) || (castById(culprit).stayNear ? castById(castById(culprit).stayNear) : null);

    const present = HUMANS.filter((id) => !late.has(id));
    const pool = U.shuffle(r, present.filter((id) => id !== culprit && (!companion || id !== companion.id)));
    const take = (id) => (id && pool.includes(id) ? pool.splice(pool.indexOf(id), 1)[0] : null);
    const nearDecoy = take(fix.nearDecoy) || pool.shift(), foodDecoy = take(fix.foodDecoy) || pool.shift();
    const witnessPool = U.shuffle(r, HUMANS.filter((id) => id !== culprit && id !== nearDecoy && id !== foodDecoy));
    const pref = fix.witness || L.preferredWitness;
    const witness = pref && witnessPool.includes(pref) ? pref : witnessPool[0] || nearDecoy;
    const rest = U.shuffle(r, present.filter((id) => ![culprit, nearDecoy, foodDecoy, witness].includes(id)));
    const positionalWitness = rest[0], mealWitness = rest[1], culpritPosWitness = rest[2];

    // meals (truth) and claims (what they say)
    const others = HUMAN_FOODS().filter((f) => f.id !== food.id);
    const fav = L.favoriteFood || {};
    const meals = {}, claims = {};
    for (const id of HUMANS) {
      if (id === culprit || (id === foodDecoy && !fix.soleEater)) meals[id] = food.id;
      else if (fix.meals && fix.meals[id] && fix.meals[id] !== food.id) meals[id] = fix.meals[id];
      else if (fav[id] && fav[id] !== food.id) meals[id] = fav[id];
      else meals[id] = U.pick(r, others).id;
      claims[id] = meals[id];
    }
    if (!isDog && RULES.lies) claims[culprit] = fix.claim || U.pick(r, others.filter((f) => f.id !== meals[culprit])).id;
    meals[sg.id] = isDog ? sg.food : null;

    // where everyone stands when it happens
    const spots = {}, taken = [{ ...L.player.start }]; // nobody starts on top of you
    const gap = L.ranges.spacing, fixSpot = L.fixSpot ? (p) => L.fixSpot(p) : (p) => p;
    function place(z, near = null) {
      for (let tries = 0; tries < 80; tries++) {
        let p;
        if (near) {
          const a = r() * Math.PI * 2, d = gap * (1.05 + r() * 0.5);
          p = { x: near.x + Math.cos(a) * d, y: near.y + Math.sin(a) * d * 0.6 };
          p.x = U.clamp(p.x, z.x + z.w * 0.1, z.x + z.w * 0.9); p.y = U.clamp(p.y, z.y + z.h * 0.3, z.y + z.h * 0.92);
        } else p = spotIn(z, r);
        p = fixSpot(p);
        if (taken.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > gap) || tries === 79) { taken.push(p); return p; }
      }
    }
    spots[culprit] = place(origin);
    const tagAlong = new Set(); // companions a level seats exactly (see L.companionSpot); the shuffle leaves them be
    const beside = (c) => { const o = spots[c.stayNear]; if (L.companionSpot) { tagAlong.add(c.id); const p = L.companionSpot(o); taken.push(p); return p; } return place(zoneAt(o), o); };
    if (companion) spots[companion.id] = companion.stayNear === culprit ? beside(companion) : place(origin, spots[culprit]);
    spots[nearDecoy] = place(origin, spots[culprit]);
    const emptiest = (zs) => {
      const count = (z) => taken.filter((q) => zoneAt(q).id === z.id).length;
      const min = Math.min(...zs.map(count));
      return U.pick(r, zs.filter((z) => count(z) === min));
    };
    const oc = zoneCenter(origin);
    const elsewhere = spawnZones().filter((z) => z.id !== origin.id);
    const far = elsewhere.slice().sort((a, b) => U.dist(zoneCenter(b), oc) - U.dist(zoneCenter(a), oc))[0];
    const zoneFor = (id) => (pin[id] && pin[id] !== origin.id ? zoneById(pin[id]) : null); // nobody else is ever pinned to the origin
    spots[foodDecoy] = place(zoneFor(foodDecoy) || far);
    for (const c of CAST) {
      if (spots[c.id] || late.has(c.id)) continue;
      if (c.stayNear && spots[c.stayNear]) continue; // placed after their partner
      spots[c.id] = place(zoneFor(c.id) || emptiest(elsewhere));
    }
    // a companion (stroller, dog carrier) goes beside its owner
    for (const c of CAST) if (!spots[c.id] && c.stayNear && spots[c.stayNear]) spots[c.id] = beside(c);
    for (const c of CAST) if (!spots[c.id] && c.stayNear === undefined && !late.has(c.id)) spots[c.id] = place(emptiest(elsewhere));
    for (const c of CAST) if (!spots[c.id] && CAST.some((k) => k.stayNear === c.id) && !late.has(c.id)) spots[c.id] = place(emptiest(elsewhere));
    // shuffle apart anyone standing on top of someone else, without leaving their zone
    const home = Object.fromEntries(Object.entries(spots).map(([id, p]) => [id, zoneAt(p)]));
    const ids = Object.keys(spots), dk = L.ranges.depth ?? 1.6; // same staggering rule as NPC.separate
    spots.player = { ...L.player.start }; ids.push('player'); home.player = zoneAt(spots.player); // you are in the crowd too
    for (let it = 0; it < 60; it++) {
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        if (tagAlong.has(ids[i]) || tagAlong.has(ids[j])) continue;
        const a = spots[ids[i]], b = spots[ids[j]], dx = b.x - a.x, dy = (b.y - a.y) * dk, d = Math.hypot(dx, dy) || 0.01;
        if (d >= gap) continue;
        const push = (gap - d) / 2, ux = dx / d, uy = dy / d / dk;
        a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push;
      }
      spots.player.x = L.player.start.x; spots.player.y = L.player.start.y; // ...but you do not move
      for (const id of ids) {
        if (id === 'player' || tagAlong.has(id)) continue;
        const z = home[id], p = spots[id];
        p.x = U.clamp(p.x, z.x + 6, z.x + z.w - 6); p.y = U.clamp(p.y, z.y + z.h * 0.25, z.y + z.h - 2);
        spots[id] = fixSpot(p);
      }
    }
    delete spots.player;
    const fartZone = {};
    for (const id in spots) fartZone[id] = zoneAt(spots[id]).id;

    const nm = (id) => castById(id).name;
    const ft = fix.facts || {};
    const facts = {};
    facts[witness] = isDog
      ? { text: sg.witness, implicates: [sg.id], weight: 2, kind: 'witness', food: sg.food, about: sg.id, short: `${nm(sg.id)} ate ${food.name}...` }
      : { text: ft.witness || `${nm(culprit)} was scarfing ${food.name} before this. I saw it.`, implicates: [culprit], weight: 2, kind: 'witness', food: food.id, about: culprit, short: `...${nm(culprit)} and the ${food.name}...` };
    if (positionalWitness) facts[positionalWitness] = { text: ft.zone || `${nm(nearDecoy)} was right by the ${origin.name} when it started.`, implicates: [nearDecoy], weight: 1, kind: 'zone', about: nearDecoy, zone: origin.id, short: `...${nm(nearDecoy)}, by the ${origin.name}...` };
    if (mealWitness && !fix.soleEater) facts[mealWitness] = { text: ft.meal || `${nm(foodDecoy)} went back for seconds of the ${food.name}. Thirds, actually.`, implicates: [foodDecoy], weight: 1, kind: 'meal', about: foodDecoy, food: food.id, short: `...${nm(foodDecoy)} had thirds...` };
    if (culpritPosWitness) facts[culpritPosWitness] = { text: ft.culpritZone || `${nm(culprit)} was over by the ${origin.name} earlier. Kind of lurking.`, implicates: [culprit], weight: 1, kind: 'zone', about: culprit, zone: origin.id, short: `...${nm(culprit)} lurking by the ${origin.name}...` };

    const bags = {};
    for (const c of CAST) {
      if (c.dog) {
        bags[c.id] = { text: sg.bedText(isDog), food: isDog ? sg.food : null, implicates: isDog ? [sg.id] : [], weight: isDog ? 2 : 0 };
      } else {
        const f = foodById(meals[c.id]);
        bags[c.id] = { text: (fix.bags && fix.bags[c.id]) || `${L.bagFlavor[c.id]} ${f.wrapper}.`, food: f.id, implicates: f.id === food.id ? [c.id] : [], weight: 2 };
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
