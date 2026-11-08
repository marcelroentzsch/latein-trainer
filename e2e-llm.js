// Testet den KI-Modus mit einer nachgebauten Gemini-Antwort (kein echter Schlüssel nötig)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, permissions: ['microphone'] });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const calls = []; let lessonCalls = 0;
  await p.route('**/generativelanguage.googleapis.com/**', async route => {
    const req = route.request(); const body = JSON.parse(req.postData()); const txt = body.contents[0].parts[0].text; const hasAudio = body.contents[0].parts.length > 1;
    calls.push({ url: req.url(), key: req.headers()['x-goog-api-key'], audio: hasAudio, task: (txt.match(/AUFGABE (\w+)/) || [])[1] || 'ping' });
    let out;
    if (/AUFGABE lessons/.test(txt)) out = { transcript: 'ich möchte gerne die ersten drei lektionen', lessons: [1, 2, 3], stop: false };
    else if (/AUFGABE order/.test(txt)) out = { transcript: 'durcheinander', order: 'mix', stop: false };
    else if (/AUFGABE answer/.test(txt)) {
      const acc = JSON.parse(txt.match(/Akzeptierte Antworten: (\[.*?\])\./)[1]);
      if (acc.length && calls.filter(c => c.task === 'answer').length % 4 === 1) out = { transcript: 'tipp bitte', intent: 'hint', correct: false };
      else out = { transcript: acc[0], intent: 'answer', correct: true };
    } else out = { ok: true };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] }) });
  });
  await p.addInitScript(() => {
    class U { constructor(t) { this.text = t; } } window.SpeechSynthesisUtterance = U; window.__spoken = [];
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ lang: 'de-DE', name: 'mock' }], speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 60); }, cancel() { }, onvoiceschanged: null } });
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: undefined }); Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: undefined });
    navigator.mediaDevices.getUserMedia = async () => { const ac = new AudioContext(); const o = ac.createOscillator(), g = ac.createGain(), d = ac.createMediaStreamDestination(); o.frequency.value = 220; o.connect(g); g.connect(d); g.gain.value = 0; o.start();
      setInterval(() => { g.gain.setValueAtTime(0.5, ac.currentTime); g.gain.setValueAtTime(0, ac.currentTime + 0.7); }, 2500); return d.stream; };
    localStorage.setItem('gemKey', JSON.stringify('TESTKEY')); localStorage.setItem('gemOn', 'true');
  });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#goVoice');
  // Verbindungstest über die Einstellungen
  await p.click('summary'); await p.click('#llmTest'); await p.waitForFunction(() => /Funktioniert/.test(document.querySelector('#llmMsg').textContent), null, { timeout: 5000 });
  console.log('Test-Knopf:', await p.textContent('#llmMsg'));
  await p.click('#goVoice');
  try { await p.waitForSelector('#end.on', { timeout: 50000 }); } catch (e) { console.log('TIMEOUT', JSON.stringify(await p.evaluate(() => window.__spoken.slice(-6))), calls.slice(-4)); }
  const spoken = await p.evaluate(() => window.__spoken);
  console.log('gesprochen (Anfang):', spoken.slice(0, 6));
  console.log('Ende:', await p.textContent('#eMain'), '|', await p.textContent('#eSub'));
  const by = {}; calls.forEach(c => by[c.task] = (by[c.task] || 0) + 1); console.log('API-Aufrufe:', by, '| mit Audio:', calls.filter(c => c.audio).length, '| Schlüssel ok:', calls.every(c => c.key === 'TESTKEY'), '| Modell in URL:', calls[0].url.split('/models/')[1].split(':')[0]);
  console.log('Fehler:', errs); await b.close();
})();
