// Sprech-Training gegen eine nachgebaute Live-Gegenstelle: Ablauf, Sitzungswechsel, Pause, Fehlerfälle
const { launch } = require('./mock');
const URL = 'http://localhost:8765/index.html';
let fails = 0; const ok = (name, cond, info) => { if (!cond) fails++; console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : '  -> ' + (info === undefined ? '' : JSON.stringify(info)))); };

const mk = page => {
  const snap = () => page.evaluate(() => { const A = window.__lt, T = A.T, F = window.__fake, act = F.active(), q = s => document.querySelector(s);
    return { done: T.done, total: T.total, first: T.first, cur: T.cur && T.cur.la, curLesson: T.cur && T.cur.lesson, dir: T.dir, prompt: q('#tPrompt').textContent, hint: q('#tHint').textContent, pic: !!q('#tPic').innerHTML, state: q('#tState').textContent, cap: q('#tCap').textContent, notice: q('#tNotice').style.display !== 'none' ? q('#tNotice').textContent : '', resume: q('#tResume').style.display !== 'none', sockets: F.all.length, open: F.open().length, actId: act && act.id, said: act ? act.said.slice() : [], texts: act ? act.texts.slice() : [], frage: act && act.frage, lastResp: act && act.responses[act.responses.length - 1], ending: !!T.ending, handing: !!T.handing, paused: !!T.paused, active: !!T.active, screen: q('.screen.on').id, mic: !!A.Gem.mic.stream, spoken: window.__spoken.length }; });
  const settle = async () => { await page.waitForFunction(() => { const T = window.__lt.T; return !T.active || T.paused || (!T.handing && !T.pending && T.live && T.live.ready && !T.live.speaking && !window.Gem.playing()); }, null, { timeout: 9000 }); await page.waitForTimeout(150); };
  const kid = async (art, g) => { await page.evaluate(([a, g]) => window.__fake.kid(a, g), [art, g]); await settle(); return snap(); };
  const last = s => s.said[s.said.length - 1];
  return { snap, settle, kid, last };
};
const start = async (opts) => { const x = await launch(opts); await x.page.goto(URL); await x.page.waitForSelector('.lcard'); return Object.assign(x, mk(x.page)); };

(async () => {
  // ---------- A: ganzes Gespräch, Lektion 1 und 2 nacheinander ----------
  console.log('A  ganzes Gespräch (Lektion 1 und 2, nacheinander)');
  let t = await start(); let { page, b, errs } = t;
  await page.click('#goTalk'); await t.settle(); let s = await t.snap();
  ok('Begrüßung kommt als Auftrag der App', s.texts[0] && s.texts[0].startsWith('App: ') && t.last(s) === 'Hallo! Welche Lektionen möchtest du lernen?', [s.texts, s.said]);
  ok('Mikrofon läuft, Anzeige hört zu', s.mic && s.state === 'Ich höre zu …', s.state);
  await page.evaluate(() => window.__fake.lessons([2, 1, 1])); await t.settle(); s = await t.snap();
  ok('Lektionen erkannt, Frage nach der Reihenfolge', t.last(s) === 'Lektion 1 und 2. Nacheinander oder gemischt?' && s.prompt === 'Lektion 1 und 2', [t.last(s), s.prompt]);
  await page.evaluate(() => { window.__fake.speakMs = 500; window.__fake.order('nacheinander'); });
  await page.waitForTimeout(150); let mid = await t.snap();
  ok('während der Ansage steht noch die Lektion da', mid.prompt === 'Lektion 1 und 2', mid.prompt);
  await t.settle(); s = await t.snap();
  ok('Start: Ansage, Lektion 1, erstes Wort', /^Los geht's! \| Lektion 1\. \| /.test(t.last(s)) && s.total === 27 && s.curLesson === 1, t.last(s));
  ok('Wort wird nach der Ansage angezeigt', s.prompt === (s.dir === 'l2d' ? s.cur : s.frage.sage), [s.prompt, s.cur, s.dir]);
  // Tipp, zweiter Tipp, falsch, nochmal
  s = await t.kid('tipp'); ok('erster Tipp', /^Der erste Buchstabe ist .\.$/.test(t.last(s)) && /^\S( _)+ ?$|^\S /.test(s.hint), [t.last(s), s.hint]);
  s = await t.kid('tipp'); ok('zweiter Tipp', /^Der zweite Buchstabe ist .\.$/.test(t.last(s)), t.last(s));
  s = await t.kid('falsch'); ok('falsche Antwort: neuer Versuch, Lösung bleibt geheim', t.last(s) === 'Nicht ganz.' && s.done === 0, t.last(s));
  s = await t.kid('nochmal'); ok('nochmal: Wort wird wiederholt', t.last(s) === s.frage.sage, [t.last(s), s.frage.sage]);
  // weiß nicht: Lösung zweimal, gelöstes Wort bleibt stehen, dann nächstes Wort
  const solved = s.cur; await page.evaluate(() => window.__fake.kid('weiss_nicht')); await page.waitForTimeout(200); mid = await t.snap();
  ok('weiß nicht: gelöstes Wort mit Bild bleibt stehen, solange gesprochen wird', mid.prompt === solved && mid.pic && mid.hint.length > 0, [mid.prompt, solved, mid.pic]);
  await t.settle(); s = await t.snap(); const parts = t.last(s).split(' | ');
  ok('weiß nicht: Lösung zweimal, dann nächstes Wort', parts.length === 3 && parts[0] === parts[1] && / – /.test(parts[0]) && parts[2] === s.frage.sage, parts);
  ok('danach zeigt die Anzeige das neue Wort', s.prompt === (s.dir === 'l2d' ? s.cur : s.frage.sage) && !s.pic && s.cur !== solved, [s.prompt, s.cur]);
  await page.evaluate(() => { window.__fake.speakMs = 120; });
  // richtig antworten bis zum Ende, Sitzungswechsel beobachten
  let rotations = 0, lesson2Said = false, mism = [], kicksOk = true, handoverOk = true, routeOk = true, prevSockets = s.sockets, guard = 0, threeWrong = false;
  while (guard++ < 80) {
    s = await t.snap(); if (s.screen !== 'talk' || s.ending) break;
    const beforeId = s.actId;
    if (!threeWrong && s.done === 6) { threeWrong = true; await t.kid('falsch'); await t.kid('falsch'); s = await t.kid('falsch'); const log = await page.evaluate(() => window.__fake.saidLog.slice(-3)), rev = log.map(x => x.split(' | ')).find(x => x.length >= 2 && / – /.test(x[0]) && x[0] === x[1]); ok('dreimal falsch: Lösung wird zweimal genannt', !!rev, log); prevSockets = s.sockets; continue; }
    s = await t.kid('richtig'); if (s.screen !== 'talk') break;
    if (/Lektion 2\./.test(t.last(s))) lesson2Said = true;
    if (s.sockets > prevSockets) { rotations++; prevSockets = s.sockets;
      const info = await page.evaluate(id => { const F = window.__fake, old = F.all.find(x => x.id === id), act = F.active(); return { oldState: old.readyState, oldLast: old.responses[old.responses.length - 1], kick: act.texts[0], oldAudio: old.audioChunks, newAudio: act.audioChunks }; }, beforeId);
      if (!(info.oldState === 3 && / Sage danach nichts mehr\.$/.test(info.oldLast.anweisung) && !info.oldLast.frage)) handoverOk = false;
      if (!(info.kick && info.kick.startsWith('App: ') && JSON.parse(info.kick.slice(5)).frage.sage === s.frage.sage)) kicksOk = false;
      await page.waitForTimeout(250); const later = await page.evaluate(id => { const F = window.__fake, old = F.all.find(x => x.id === id), act = F.active(); return { oldAudio: old.audioChunks, newAudio: act.audioChunks }; }, beforeId);
      if (!(later.oldAudio === info.oldAudio && later.newAudio > info.newAudio)) routeOk = false;
    }
    if (!s.ending && s.prompt !== (s.dir === 'l2d' ? s.cur : s.frage.sage)) mism.push([s.prompt, s.cur, s.dir, s.frage && s.frage.sage]);
  }
  ok('Anzeige passt immer zum abgefragten Wort', mism.length === 0, mism.slice(0, 3));
  ok('alle vier Wörter beginnt eine frische Sitzung', rotations >= 5 && rotations <= 8, rotations);
  ok('alte Sitzung lobt nur noch und wird geschlossen', handoverOk);
  ok('neue Sitzung bekommt das nächste Wort als Auftrag', kicksOk);
  ok('Mikrofon geht nur an die aktive Sitzung', routeOk);
  ok('Lektion 2 wird angesagt', lesson2Said);
  await page.waitForSelector('#end.on', { timeout: 8000 }); s = await t.snap();
  const sum = await page.evaluate(() => ({ main: document.querySelector('#eMain').textContent, sub: document.querySelector('#eSub').textContent, said: window.__fake.all.map(x => x.said).flat().filter(x => /Geschafft/.test(x)), open: window.__fake.open().length, use: window.Gem.usage(), box: Object.values(window.__lt.P().w).map(w => w.b) }));
  ok('Abschluss wird gesprochen und angezeigt', sum.said.length === 1 && /Du hast 27 Wörter geübt und \d+ davon gleich beim ersten Mal gewusst/.test(sum.said[0]) && /von 27 gleich richtig/.test(sum.main), sum);
  ok('danach ist alles geschlossen: Verbindung und Mikrofon', sum.open === 0 && !s.mic, [sum.open, s.mic]);
  ok('Verbrauch wurde mitgezählt', sum.use.total > 0, sum.use);
  ok('Lernstand wurde übernommen', sum.box.length === 27 && sum.box.every(x => x === 1), sum.box);
  ok('Browser-Stimme stumm, keine Skriptfehler', s.spoken === 0 && errs.length === 0, errs);
  await page.screenshot({ path: 'tests/v3-talk-end.png' });
  await b.close();

  // ---------- B: Lektion vorgewählt ----------
  console.log('B  "Abfragen lassen" aus einer Lektion');
  t = await start(); ({ page, b, errs } = t);
  await page.click('.lcard:nth-child(3)'); await page.waitForSelector('#sheet.on'); await page.click('#shTalk'); await t.settle(); s = await t.snap();
  ok('Start ohne Rückfrage direkt mit dem ersten Wort', /^Hallo! Lektion 3\. Los geht's! \| /.test(t.last(s)) && s.total === 13 && s.sockets === 1, t.last(s));
  ok('Anzeige zeigt das Wort', s.prompt === (s.dir === 'l2d' ? s.cur : s.frage.sage), s.prompt);
  // Knöpfe
  await page.click('#bHint'); await t.settle(); s = await t.snap(); ok('Knopf Tipp', /Buchstabe ist/.test(t.last(s)) && s.hint.length > 0, t.last(s));
  await page.click('#bRepeat'); await t.settle(); s = await t.snap(); ok('Knopf Nochmal', t.last(s) === s.frage.sage, t.last(s));
  const before = s.cur; await page.click('#bGive'); await t.settle(); s = await t.snap(); ok('Knopf Weiß nicht', / – /.test(t.last(s)) && s.cur !== before, t.last(s));
  // "neque … neque" in Lektion 3: beide Teile
  const neq = await page.evaluate(() => { const A = window.__lt, T = A.T; const it = A.V.find(v => /…/.test(v.la)); T.cur = it; T.dir = 'l2d'; const r1 = A.onTool('antwort_melden', { art: 'nochmal', gehoert: '' }); T.dir = 'd2l'; const r2 = A.onTool('antwort_melden', { art: 'nochmal', gehoert: '' }); return [r1.frage, r2.frage]; });
  ok('"neque … neque": beide Teile im Auftrag, mit Hinweis', neq[0].sage === 'neque, neque' && /beide Teile/.test(neq[0].hinweis) && /^weder/.test(neq[0].richtige_antworten.join()) && neq[0].richtige_antworten.length === 1 && neq[1].richtige_antworten.join() === 'neque … neque', neq);
  // Verbindungsabbruch mitten in der Frage
  s = await t.snap(); const q0 = s.frage.sage, n0 = s.sockets; await page.evaluate(() => window.__fake.drop()); await page.waitForFunction(n => window.__fake.all.length > n, n0); await t.settle(); s = await t.snap();
  ok('Abbruch: neue Verbindung wiederholt dieselbe Frage', s.sockets === n0 + 1 && /Sage noch einmal/.test(s.texts[0]) && s.frage.sage && t.last(s) === s.frage.sage, [s.texts[0], t.last(s)]);
  // Gemini spricht zweimal, ohne die Antwort zu melden
  await page.evaluate(() => window.__fake.chatter('Wie bitte?')); await t.settle(); await page.evaluate(() => window.__fake.chatter('Sag das noch einmal.')); await t.settle(); s = await t.snap();
  ok('Erinnerung, die Antwort zu melden', s.texts.some(x => /Bewerte jetzt die letzte Antwort/.test(x)), s.texts);
  // Pause bei Stille
  await page.evaluate(() => { window.__lt.CFG.idleMs = 500; window.__fake.kid('nochmal'); }); await page.waitForFunction(() => window.__lt.T.paused, null, { timeout: 5000 }); s = await t.snap();
  ok('Pause bei Stille: Verbindung und Mikrofon aus, Weiter-Knopf da', s.paused && s.open === 0 && !s.mic && s.resume && s.state === 'Pause', s);
  await page.evaluate(() => { window.__lt.CFG.idleMs = 75000; }); const n1 = s.sockets, q1 = s.cur; await page.click('#tResume'); await t.settle(); s = await t.snap();
  ok('Weiter: gleiche Frage geht weiter', s.sockets === n1 + 1 && s.cur === q1 && s.mic && !s.paused && !s.resume && t.last(s) === s.frage.sage, [s.sockets, n1, s.cur, q1, t.last(s)]);
  // App in den Hintergrund
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); s = await t.snap();
  ok('App im Hintergrund: Pause', s.paused && s.open === 0 && !s.mic && s.resume, s);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
  await page.click('#tResume'); await t.settle(); s = await t.kid('richtig');
  ok('danach normal weiter', s.done >= 1 && !s.paused, s.done);
  await page.click('#tClose'); await page.waitForSelector('#end.on'); s = await t.snap();
  ok('Schließen beendet sauber', s.open === 0 && !s.mic && errs.length === 0, errs);
  await b.close();

  // ---------- C: Guthaben aufgebraucht ----------
  console.log('C  Guthaben aufgebraucht');
  t = await start(); ({ page, b, errs } = t);
  await page.evaluate(() => { window.__fake.mode = 'depleted'; }); await page.click('#goTalk');
  await page.waitForFunction(() => document.querySelector('#tNotice').style.display !== 'none', null, { timeout: 6000 }); await page.waitForTimeout(1500); s = await t.snap();
  ok('klarer Hinweis statt endloser Versuche', /Guthaben bei Google ist aufgebraucht/.test(s.notice) && s.sockets === 1 && !s.mic && s.resume, s);
  await page.screenshot({ path: 'tests/v3-talk-depleted.png' });
  await page.evaluate(() => { window.__fake.mode = 'ok'; }); await page.click('#tResume'); await t.settle(); s = await t.snap();
  ok('nach dem Aufladen geht es mit Weiter los', t.last(s) === 'Welche Lektionen möchtest du lernen?' && s.notice === '', [t.last(s), s.notice]);
  await page.click('#tClose'); await page.waitForSelector('#home.on'); ok('Schließen ohne Antworten führt zum Start', true);
  await b.close();

  // ---------- D: Schlüssel falsch, Gemini nicht erreichbar, kein Schlüssel ----------
  console.log('D  weitere Fehlerfälle');
  t = await start(); ({ page, b, errs } = t);
  await page.evaluate(() => { window.__fake.mode = 'badkey'; }); await page.click('#goTalk'); await page.waitForFunction(() => document.querySelector('#tNotice').style.display !== 'none'); s = await t.snap();
  ok('falscher Schlüssel wird erklärt', /akzeptiert den Schlüssel nicht/.test(s.notice) && s.sockets === 1, s.notice);
  await page.click('#tClose'); await page.waitForSelector('#home.on');
  await page.evaluate(() => { window.__fake.mode = 'down'; }); const nBefore = (await t.snap()).sockets; await page.click('#goTalk'); await page.waitForFunction(() => document.querySelector('#tNotice').style.display !== 'none', null, { timeout: 12000 }); s = await t.snap();
  ok('nicht erreichbar: drei neue Versuche, dann Hinweis', /nicht erreichbar/.test(s.notice) && s.sockets - nBefore === 4 && s.resume, [s.notice, s.sockets - nBefore]);
  ok('keine Skriptfehler', errs.length === 0, errs);
  await b.close();
  t = await start({ key: false }); ({ page, b, errs } = t);
  await page.click('#goTalk'); await page.waitForTimeout(300); s = await t.snap();
  ok('ohne Schlüssel: Hinweis auf den Elternbereich, keine Verbindung', /fehlt noch der Gemini-Schlüssel/.test(s.notice) && s.sockets === 0 && !s.mic, s.notice);
  await b.close();

  console.log(fails ? `\n${fails} FEHLER` : '\nALLE SPRECH-TESTS OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ABBRUCH', e); process.exit(2); });
