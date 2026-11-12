const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.lcard'); await p.screenshot({ path: 'tests/v2-home.png' });
  await p.click('.lcard'); await p.waitForSelector('#sheet.on'); await p.screenshot({ path: 'tests/v2-sheet.png' });
  await p.click('#shLearn'); const seen = {}; let shots = {};
  for (let i = 0; i < 80; i++) {
    if (await p.isVisible('#end.on')) break;
    const type = await p.evaluate(() => { const s = window.__lt.S; return s.steps[s.i] && s.steps[s.i].type; }); seen[type] = (seen[type] || 0) + 1;
    if (!shots[type]) { shots[type] = 1; await p.screenshot({ path: 'tests/v2-' + type + '.png' }); }
    const wrongOnce = type === 'mc_l2d' && seen[type] === 2;
    if (type === 'intro') await p.click('#ex .btn');
    else if (type === 'pairs') { const ids = await p.$$eval('.pairs .opt[data-side=la]', e => e.map(x => x.dataset.id)); for (const id of ids) { await p.click(`.pairs .opt[data-side=la][data-id="${id}"]`); await p.click(`.pairs .opt[data-side=de][data-id="${id}"]`); } await p.waitForTimeout(800); }
    else if (type === 'build') { const target = await p.evaluate(() => { const s = window.__lt.S; return window.__lt.L.latDisplayFirst(s.steps[s.i].w.la); }); for (const ch of [...target]) { const t = await p.evaluateHandle(c => [...document.querySelectorAll('.tiles .tile:not(.used)')].find(x => x.textContent === c), ch); await t.click(); } await p.waitForSelector('.fbar.ok'); await p.click('#fbNext'); }
    else { await p.click(wrongOnce ? '.opt:not([data-ok="1"])' : '.opt[data-ok="1"]'); await p.waitForSelector(wrongOnce ? '.fbar.bad' : '.fbar.ok'); if (wrongOnce) await p.screenshot({ path: 'tests/v2-wrong.png' }); await p.click('#fbNext'); }
  }
  console.log('Übungen:', JSON.stringify(seen), '| Ende:', await p.textContent('#eMain'), '|', await p.textContent('#eSub'));
  await p.screenshot({ path: 'tests/v2-end.png' }); await p.click('#eHome');
  console.log('Start danach:', await p.textContent('#stXp'), await p.textContent('#stStreak'), '| L1:', await p.textContent('.lcard small'));
  // Sprech-Training: Zustandslogik direkt (ohne Netz)
  const r = await p.evaluate(() => { const A = window.__lt, T = A.T, out = []; Object.assign(T, { lessons: null, cur: null, queue: [], total: 0, done: 0, first: 0, tried: new Set(), missed: new Set(), reveals: {}, ending: false });
    out.push(A.onTool('lektionen_waehlen', { lektionen: [1, 2, 3] }).anweisung); let x = A.onTool('reihenfolge_waehlen', { reihenfolge: 'nacheinander' }); out.push(JSON.stringify(x));
    x = A.onTool('antwort_melden', { art: 'tipp' }); out.push(x.anweisung); x = A.onTool('antwort_melden', { art: 'tipp' }); out.push(x.anweisung);
    x = A.onTool('antwort_melden', { art: 'weiss_nicht' }); out.push(x.anweisung); x = A.onTool('antwort_melden', { art: 'falsch' }); out.push(x.anweisung);
    let n = 0, lessonsSaid = 0; while (!x.ende && n++ < 200) { x = A.onTool('antwort_melden', { art: 'richtig' }); if (/Lektion \d\./.test(x.anweisung)) lessonsSaid++; } out.push('nach ' + n + ' Antworten: ' + x.anweisung + ' | Lektionswechsel angesagt: ' + lessonsSaid + ' | done=' + T.done + '/' + T.total);
    Object.assign(T, { lessons: null, cur: null, queue: [], ending: false }); out.push(JSON.stringify(A.onTool('lektionen_waehlen', { lektionen: [4] })).slice(0, 260)); out.push(A.onTool('lektionen_waehlen', { lektionen: [99] }).anweisung); return out; });
  r.forEach(x => console.log(' ·', x));
  await p.click('#goSet'); await p.screenshot({ path: 'tests/v2-settings.png' }); await p.click('#sBack'); await p.click('#goTalk'); await p.waitForTimeout(300); await p.screenshot({ path: 'tests/v2-talk.png' });
  console.log('Fehler:', errs); await b.close();
})();
