// Draws every character in every setting, big, in several expressions, onto one canvas for review.
(function () {
  const exprs = ['neutral', 'disgust', 'shock', 'sus', 'worried'];
  const all = [];
  for (const id of Object.keys(LEVELS)) for (const c of LEVELS[id].cast) all.push(c);
  all.push({ id: 'player', name: 'You', look: LEVELS.elevator.player.look });
  const cw = 130, ch = 170, cols = exprs.length;
  const cv = document.createElement('canvas'); cv.width = cw * cols * 2 + 20; cv.height = ch * Math.ceil(all.length / 2) + 20;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#e8dcc2'; ctx.fillRect(0, 0, cv.width, cv.height);
  all.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    exprs.forEach((e, k) => {
      ctx.save(); ctx.translate(10 + col * cw * cols + k * cw + cw / 2, 10 + row * ch + ch - 22); ctx.scale(1.35, 1.35);
      if (c.sprite === 'dog') Art.drawDog(ctx, c.look, 0, 0, { t: 0, faceDir: 1, expr: e });
      else if (c.sprite === 'baby') Art.drawBaby(ctx, c.look, 0, 0, { t: 0, faceDir: 1, expr: e });
      else Art.drawPerson(ctx, c.look, 0, 0, { t: 0.5, faceDir: k % 2 ? -1 : 1, lookX: k === 3 ? -0.8 : 0, expr: e, blinkSeed: 1 });
      ctx.restore();
    });
    ctx.fillStyle = '#1c1a1f'; ctx.font = '700 13px sans-serif'; ctx.fillText(c.name, 14 + col * cw * cols, 24 + row * ch);
  });
  document.body.innerHTML = ''; document.body.style.margin = 0; document.body.appendChild(cv);
  return [cv.width, cv.height];
})()
