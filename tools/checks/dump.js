// Every line each person can say in every authored case, as the player would get it.
(function () {
  const out = [];
  for (const c of CASES) {
    Game.newGame({ ...c }, c.seed); for (const k in TIPS) G.tipsShown[k] = 1;
    const cs = G.cs, st = c.story;
    out.push(`\n=== ${c.id} ${c.title} (${L.id}) · ${st ? st.when + ' ' + st.time : ''} · culprit ${cs.culprit} ate ${cs.food.name} at ${cs.origin ? cs.origin.name : '-'}`);
    out.push(`intro: ${L.intro}`);
    if (L.banter) L.banter.forEach((b) => out.push(`banter ${b[0]}: ${b[2]} / ${b[1]}: ${b[3]}`));
    if (L.mention) out.push(`mention ${L.mention.who}: ${L.mention.line}`);
    for (const n of G.npcs) {
      if (n.def.dog) { out.push(`- ${n.def.name}: bag: ${cs.bags[n.id].text}`); continue; }
      const v = VOICES[n.id], f = foodById(cs.claims[n.id]), z = cs.fartZone[n.id] ? zoneById(cs.fartZone[n.id]).name : '(late)';
      out.push(`- ${n.def.name} [${n.def.role}] ate ${cs.meals[n.id]} claims ${cs.claims[n.id]} at ${z}`);
      out.push(`   hello: ${v.hello}`);
      out.push(`   ate: ${U.fill(v.breakfast, { food: f.name })}`);
      out.push(`   where: ${cs.fartZone[n.id] ? U.fill(v.where, { zone: z, at: zoneAtPhrase(zoneById(cs.fartZone[n.id])) }) : v.where}`);
      out.push(`   gossip: ${cs.facts[n.id] ? U.fill(v.gossip, { fact: cs.facts[n.id].text }) : v.gossipNone}`);
      out.push(`   smell: ${U.fill(v.smell, { smell: cs.food.smell, Smell: U.cap(cs.food.smell), SMELL: cs.food.smell.toUpperCase() })}`);
      out.push(`   react: ${v.react || '-'} | idle: ${(IDLES[n.id] || {}).bubble || '-'}`);
      out.push(`   bag: ${cs.bags[n.id].text}`);
      if (n.id === cs.culprit) out.push(`   GUILTY: ${v.guilty} | crack: ${v.crack || '(default)'}`);
      else out.push(`   innocent: ${v.innocent} | rumor: ${v.rumor}`);
    }
  }
  return out.join('\n');
})()
