// Lernen mit nachgebauter Gemini-Sprachausgabe: Laden, Zwischenspeicher, Fehlerfälle, keine Browser-Stimme
const { launch, freqOf } = require('./mock');
const URL = 'http://localhost:8765/index.html';
let fails = 0; const ok = (name, cond, info) => { if (!cond) fails++; console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + (info === undefined ? '' : JSON.stringify(info)))); };

async function playSession(page, { wrongFirst } = {}) {
  const seen = {}; let wrongDone = !wrongFirst;
  for (let i = 0; i < 90; i++) {
    if (await page.isVisible('#end.on')) break;
    if (await page.isVisible('.loading')) { await page.waitForTimeout(100); continue; }
    const type = await page.evaluate(() => { const s = window.__lt.S; return s.steps[s.i] && s.steps[s.i].type; }); seen[type] = (seen[type] || 0) + 1;
    if (type === 'intro') await page.click('#ex .btn');
    else if (type === 'pairs') { const ids = await page.$$eval('.pairs .opt[data-side=la]', e => e.map(x => x.dataset.id)); for (const id of ids) { await page.click(`.pairs .opt[data-side=la][data-id="${id}"]`); await page.click(`.pairs .opt[data-side=de][data-id="${id}"]`); } await page.waitForTimeout(750); }
    else if (type === 'build') { const target = await page.evaluate(() => { const s = window.__lt.S; return window.__lt.laShow(s.steps[s.i].w); }); for (const ch of [...target]) { const t = await page.evaluateHandle(c => [...document.querySelectorAll('.tiles .tile:not(.used)')].find(x => x.textContent === c), ch); await t.click(); } await page.waitForSelector('.fbar.ok'); await page.click('#fbNext'); }
    else { const wrong = !wrongDone && type === 'mc_l2d'; if (wrong) wrongDone = true; await page.click(wrong ? '.opt:not([data-ok="1"])' : '.opt[data-ok="1"]'); await page.waitForSelector(wrong ? '.fbar.bad' : '.fbar.ok'); await page.click('#fbNext'); }
  }
  return seen;
}
// Tonhöhe einer gespeicherten Aufnahme und Anzahl der Teile
const clipInfo = (page, text) => page.evaluate(async text => { const G = window.Gem, pcm = await G.getClip(text); if (!pcm) return null; const segs = G.split(pcm, 100); let freq = 0; if (segs.length) { let a = segs[0][0], b = segs[0][1]; while (a < b && Math.abs(pcm[a]) < 3000) a++; while (b > a && Math.abs(pcm[b - 1]) < 3000) b--; let z = 0, first = -1, last = -1; for (let i = a + 1; i < b; i++) if ((pcm[i] >= 0) !== (pcm[i - 1] >= 0)) { z++; if (first < 0) first = i; last = i; } if (z > 2) freq = Math.round((z - 1) / 2 / ((last - first) / 24000)); } return { sec: +(pcm.length / 24000).toFixed(2), freq, parts: segs.length }; }, text);
const openLesson = async (page, n) => { await page.click(`.lcard:nth-child(${n})`); await page.waitForSelector('#sheet.on'); await page.click('#shLearn'); };

(async () => {
  // ---------- A: frisches Gerät mit Schlüssel, Lektion 3 ----------
  console.log('A  Lernen mit Gemini-Stimme (Lektion 3)');
  let { b, page, errs, state } = await launch();
  await page.goto(URL); await page.waitForSelector('.lcard'); await page.evaluate(() => window.Gem.ready);
  await page.evaluate(() => { const G = window.Gem, q = G.queue.bind(G); window.__played = 0; G.queue = p => { window.__played++; return q(p); }; });
  state.delay = 250;
  await openLesson(page, 3);
  ok('Ladeanzeige erscheint, solange die Stimme fehlt', await page.waitForSelector('.loading', { timeout: 3000 }).then(() => true).catch(() => false));
  await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 15000 });
  const firstWords = await page.evaluate(() => window.__lt.S.words.map(w => window.__lt.sayText(w)));
  ok('alle Wörter der Runde sind vor der ersten Übung vertont', await page.evaluate(ws => ws.every(t => window.Gem.hasNow(t)), firstWords), firstWords);
  state.delay = 0;
  const seen = await playSession(page, { wrongFirst: true });
  ok('Runde 1 endet', await page.isVisible('#end.on'), seen);
  ok('Browser-Stimme hat nie gesprochen', (await page.evaluate(() => window.__spoken.length)) === 0, await page.evaluate(() => window.__spoken));
  ok('Gemini-Aufnahmen wurden abgespielt', (await page.evaluate(() => window.__played)) >= 8, await page.evaluate(() => window.__played));
  await page.click('#eHome');
  const l3 = await page.evaluate(() => window.__lt.V.filter(v => v.lesson === 3).map(v => window.__lt.sayText(v)));
  await page.waitForFunction(ts => ts.every(t => window.Gem.hasNow(t)), l3, { timeout: 20000 });
  ok('Rest der Lektion wurde im Hintergrund geladen', true);
  ok('"neque … neque" wird als "neque, neque" vertont', l3.includes('neque, neque') && l3.includes('neque'), l3);
  const nn = await clipInfo(page, 'neque, neque'), n1 = await clipInfo(page, 'neque');
  ok('Aufnahme "neque, neque" hat zwei Teile', nn && nn.parts === 2, nn);
  ok('Aufnahme "neque" hat einen Teil', n1 && n1.parts === 1, n1);
  let wrongAssign = [];
  for (const t of l3) { const c = await clipInfo(page, t); if (!c || Math.abs(c.freq - freqOf(t)) > 8) wrongAssign.push([t, c, freqOf(t)]); }
  ok('jede Aufnahme gehört zum richtigen Wort', wrongAssign.length === 0, wrongAssign);
  ok('mehrteilige Einträge kommen einzeln, die anderen gebündelt', state.requests.some(r => r.text === 'neque, neque') && state.requests.some(r => r.text.split(' <long pause> ').length >= 4), state.requests.map(r => r.text));
  ok('Sprechvorgabe wird mitgeschickt', state.requests.every(r => /Schulaussprache/.test(r.style || '')), state.requests[0]);
  const reqBefore = state.requests.length;
  await openLesson(page, 3);
  await page.waitForTimeout(300);
  ok('zweite Runde startet ohne Ladeanzeige und ohne neue Anfragen', !(await page.isVisible('.loading')) && state.requests.length === reqBefore, state.requests.length - reqBefore);
  await playSession(page); ok('Runde 2 endet', await page.isVisible('#end.on'));
  ok('Browser-Stimme weiterhin stumm', (await page.evaluate(() => window.__spoken.length)) === 0);
  ok('keine Skriptfehler', errs.length === 0, errs);
  // Stimme wechseln: eigene Aufnahmen je Stimme
  await page.click('#eHome'); await page.click('#goSet'); await page.selectOption('#sVoice', 'Puck');
  ok('andere Stimme hat noch keine Aufnahmen', /^0 von/.test(await page.textContent('#sClips')), await page.textContent('#sClips'));
  await page.click('#sLoad'); await page.waitForFunction(() => /Alle Aufnahmen sind geladen/.test(document.querySelector('#sMsg').textContent), null, { timeout: 60000 });
  const total = await page.evaluate(() => window.__lt.allTexts.length);
  ok('"Alle Aufnahmen laden" lädt alles für die neue Stimme', (await page.textContent('#sClips')).startsWith(total + ' von ' + total), await page.textContent('#sClips'));
  ok('Anfragen nutzen die gewählte Stimme und die männliche Sprechvorgabe', state.requests.slice(-3).every(r => r.voice === 'Puck' && /Lateinlehrer /.test(r.style)), state.requests.slice(-1));
  ok('Kostenschätzung wird angezeigt', /insgesamt 0,\d\d \$/.test(await page.textContent('#sUse')), await page.textContent('#sUse'));
  await page.screenshot({ path: 'tests/v3-settings.png' });
  await b.close();

  // ---------- B: Übernahme alter Aufnahmen ----------
  console.log('B  Übernahme alter Aufnahmen (früher nach Wortnummer gespeichert)');
  ({ b, page, errs, state } = await launch());
  await page.goto(URL); await page.waitForSelector('.lcard'); await page.evaluate(() => window.Gem.ready);
  await page.evaluate(async () => { const G = window.Gem; await G.idb('readwrite', s => { s.put(new Int16Array([1, 2, 3]), 'Kore|27'); s.put(new Int16Array([4, 5]), 'Kore|36'); s.put(new Int16Array([6]), 'Puck|28'); s.put(new Int16Array([7]), 's1|Kore|alt'); return s.put(new Int16Array([8]), 'Kore|9999'); }); });
  await page.reload(); await page.waitForSelector('.lcard'); await page.evaluate(() => window.Gem.ready);
  const keys = await page.evaluate(() => window.Gem.idb('readonly', s => s.getAllKeys()));
  ok('alte Aufnahme wird unter dem gesprochenen Text weitergeführt', keys.includes('s2|Kore|hīk') && keys.includes('s2|Puck|dominus'), keys);
  ok('veraltete Aufnahme von "neque … neque" wird verworfen', !keys.some(k => /neque/.test(k)), keys);
  ok('alte Einträge sind aufgeräumt', keys.every(k => k.startsWith('s2|')) && keys.length === 2, keys);
  ok('übernommene Aufnahme ist sofort nutzbar', await page.evaluate(() => window.Gem.hasNow('hīk')));
  await b.close();

  // ---------- C: Guthaben aufgebraucht ----------
  console.log('C  Guthaben bei Google aufgebraucht');
  ({ b, page, errs, state } = await launch());
  state.mode = 'depleted';
  await page.goto(URL); await page.waitForSelector('.lcard');
  const t0 = Date.now(); await openLesson(page, 1);
  await page.waitForFunction(() => !document.querySelector('.loading') && window.__lt.S.steps.length, null, { timeout: 8000 });
  ok('Runde startet trotzdem zügig', Date.now() - t0 < 4000, Date.now() - t0);
  ok('klarer Hinweis auf das Guthaben', /Guthaben bei Google ist aufgebraucht/.test(await page.textContent('#toast')), await page.textContent('#toast'));
  await page.screenshot({ path: 'tests/v3-depleted.png' });
  const seenC = await playSession(page);
  ok('Runde läuft ohne Stimme durch, Hör-Übung entfällt', (await page.isVisible('#end.on')) && !seenC.listen, seenC);
  ok('Browser-Stimme springt nicht ein', (await page.evaluate(() => window.__spoken.length)) === 0);
  ok('nicht bei jedem Wort eine neue Anfrage', state.requests.length <= 3, state.requests.length);
  await page.click('#eHome'); await page.click('#goSet'); await page.click('#sTest');
  await page.waitForFunction(() => /Guthaben|Funktioniert/.test(document.querySelector('#sMsg').textContent));
  ok('"Verbindung testen" meldet das Guthaben', /Guthaben bei Google ist aufgebraucht/.test(await page.textContent('#sMsg')), await page.textContent('#sMsg'));
  state.mode = 'ok'; await page.click('#sTest'); await page.waitForFunction(() => /Funktioniert/.test(document.querySelector('#sMsg').textContent));
  ok('nach dem Aufladen meldet der Test Erfolg', true);
  await page.click('#sBack'); await openLesson(page, 1); await page.waitForFunction(() => !document.querySelector('.loading') && window.__lt.S.steps.length);
  ok('danach wird die Stimme wieder geladen', await page.evaluate(() => window.__lt.S.words.every(w => window.Gem.hasNow(window.__lt.sayText(w)))));
  ok('keine Skriptfehler', errs.length === 0, errs);
  await b.close();

  // ---------- D: kurz zu viele Anfragen ----------
  console.log('D  Google bremst kurz (429)');
  ({ b, page, errs, state } = await launch());
  state.rateOnce = true;
  await page.goto(URL); await page.waitForSelector('.lcard'); await openLesson(page, 2);
  await page.waitForFunction(() => !document.querySelector('.loading') && window.__lt.S.steps.length, null, { timeout: 12000 });
  ok('nach der Wartezeit ist die Stimme da', await page.evaluate(() => window.__lt.S.words.every(w => window.Gem.hasNow(window.__lt.sayText(w)))), state.requests.length);
  await b.close();

  // ---------- E: Pause zwischen zwei Wörtern fehlt ----------
  console.log('E  Aufnahme lässt sich nicht sauber trennen');
  ({ b, page, errs, state } = await launch());
  state.merge = true;
  await page.goto(URL); await page.waitForSelector('.lcard'); await openLesson(page, 1);
  await page.waitForFunction(() => !document.querySelector('.loading') && window.__lt.S.steps.length, null, { timeout: 15000 });
  const wordsE = await page.evaluate(() => window.__lt.S.words.map(w => window.__lt.sayText(w)));
  let bad = []; for (const t of wordsE) { const c = await clipInfo(page, t); if (!c || c.parts !== 1 || Math.abs(c.freq - freqOf(t)) > 8) bad.push([t, c]); }
  ok('Wörter werden einzeln nachgeholt und stimmen', bad.length === 0, bad);
  ok('dafür je Wort eine Anfrage', state.requests.filter(r => !/long pause/.test(r.text)).length >= wordsE.length, state.requests.map(r => r.text));
  await b.close();

  // ---------- F: kein Internet ----------
  console.log('F  kein Internet');
  ({ b, page, errs, state } = await launch());
  state.mode = 'offline';
  await page.goto(URL); await page.waitForSelector('.lcard'); await openLesson(page, 1);
  await page.waitForFunction(() => !document.querySelector('.loading') && window.__lt.S.steps.length, null, { timeout: 8000 });
  ok('Hinweis auf fehlende Verbindung', /Keine Verbindung zum Internet/.test(await page.textContent('#toast')), await page.textContent('#toast'));
  await b.close();

  // ---------- G: ohne Schlüssel ----------
  console.log('G  ohne Gemini-Schlüssel');
  ({ b, page, errs, state } = await launch({ key: false }));
  await page.goto(URL); await page.waitForSelector('.lcard'); await openLesson(page, 3);
  await page.waitForFunction(() => window.__lt.S.steps.length); await playSession(page); await page.click('#eHome'); await openLesson(page, 3); await playSession(page);
  const spoken = await page.evaluate(() => window.__spoken);
  ok('Browser-Stimme spricht', spoken.length > 5, spoken.length);
  ok('auch sie spricht "neque … neque" vollständig', spoken.some(t => /^nek\S*, nek/.test(t)), [...new Set(spoken)]);
  ok('keine Anfragen an Gemini', state.requests.length === 0);
  ok('keine Skriptfehler', errs.length === 0, errs);
  await b.close();

  console.log(fails ? `\n${fails} FEHLER` : '\nALLE LERN-TESTS OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ABBRUCH', e); process.exit(2); });
