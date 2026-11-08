const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 360, height: 700 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => {
    window.__spoken = []; class U { constructor(t) { this.text = t; } } window.SpeechSynthesisUtterance = U;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); }, cancel() { } } });
    try { localStorage.clear(); } catch (e) { }
  });
  await p.goto('http://localhost:8765/index.html');
  await p.screenshot({ path: 'tests/shot-home.png' });
  await p.click('#goVisual'); await p.click('#chips .chip:nth-child(2)'); await p.screenshot({ path: 'tests/shot-setup.png' });
  await p.click('#startVisual'); await p.waitForSelector('#vquiz.on');
  const info = async () => p.evaluate(() => ({ word: document.querySelector('#vWord').textContent, small: document.querySelector('#vSmall').textContent, opts: [...document.querySelectorAll('#vOpts .opt')].map(o => o.textContent) }));
  console.log('Karte 1:', JSON.stringify(await info())); await p.screenshot({ path: 'tests/shot-q1.png' });
  // erst eine falsche Antwort geben
  const A = () => p.evaluate(() => { const c = __latein.Sp; return null; });
  const okText = async () => p.evaluate(() => { const V = __latein.V, L = __latein.L; const w = document.querySelector('#vWord').textContent, small = document.querySelector('#vSmall').textContent; const l2d = /Deutsch/.test(small); const it = l2d ? V.find(v => v.la === w) : V.find(v => L.shortDe(v, 2) === w); return l2d ? L.shortDe(it, 1) : it.la; });
  let want = await okText(); const wrongIdx = (await info()).opts.findIndex(t => t !== want);
  await p.click(`#vOpts .opt:nth-child(${wrongIdx + 1})`); await p.screenshot({ path: 'tests/shot-wrong.png' });
  await p.click('#vNext');
  let n = 0;
  while (!(await p.$('#end.on')) && n++ < 80) {
    want = await okText(); const o = (await info()).opts; await p.click(`#vOpts .opt:nth-child(${o.indexOf(want) + 1})`);
    if (n === 2) await p.screenshot({ path: 'tests/shot-ok.png' });
    await p.waitForTimeout(1700);
  }
  console.log('Runden:', n, '| Ende:', await p.textContent('#eMain'), await p.textContent('#eSub'));
  await p.screenshot({ path: 'tests/shot-end2.png' });
  console.log('Fehler:', errs); await b.close();
})();
