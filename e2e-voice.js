const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => {
    window.__spoken = []; window.__heard = []; window.__plan = null; let sp = 0;
    class U { constructor(t) { this.text = t; } }
    window.SpeechSynthesisUtterance = U;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ lang: 'de-DE', name: 'mock' }], speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 5); }, cancel() { }, onvoiceschanged: null } });
    const SRM = class { start() { setTimeout(() => { const r = window.__responder ? window.__responder() : null; if (r === null) { this.onend && this.onend(); return; } window.__heard.push(r[0]); this.onresult && this.onresult({ results: [r.map(t => ({ transcript: t }))] }); }, 15); } abort() { } stop() { } };
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: SRM }); Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: SRM });
  });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#goVoice');
  await p.screenshot({ path: 'tests/shot-home.png' });
  // Antwortlogik der "Schülerin"
  await p.evaluate(() => {
    const A = window.__latein; const L = A.L, V = A.V; let stage = 0; const log = window.__log = [];
    const seen = {}; let silenceOnce = true;
    window.__responder = () => {
      const cap = document.querySelector('#sCap').textContent, prompt = document.querySelector('#sPrompt').textContent;
      const sp = window.__spoken[window.__spoken.length - 1] || '';
      if (/Welche Lektionen/.test(sp) && !window.__lessonDone) { window.__lessonDone = 1; return ['Eins bis drei']; }
      if (/Stimmt das/.test(sp)) return ['ja'];
      if (/hintereinander/.test(sp) && !window.__orderDone) { window.__orderDone = 1; return ['hintereinander']; }
      if (/Los geht/.test(sp) && !window.__go) { window.__go = 1; }
      const cur = A.Sp.cur; if (!cur || !A.Bus.gate) return null; const item = cur.item, dir = cur.dir; const k = item.id; seen[k] = (seen[k] || 0) + 1; const n = seen[k];
      if (!window.__first) window.__first = k;
      if (k === window.__first) { if (n === 1) return ['gib mir einen tipp']; if (n === 2) return ['noch ein tipp']; if (n === 3) return ['weiß ich nicht']; }
      if (!window.__second && k !== window.__first) window.__second = k;
      if (k === window.__second && n <= 2) return [dir === 'l2d' ? 'Hund' : 'xyz'];
      if (silenceOnce) { silenceOnce = false; return null; }
      return dir === 'l2d' ? [L.deVariantsRaw(item.de)[0]] : [L.latForms(item.la)[0]];
    };
  });
  await p.click('#goVoice');
  try { await p.waitForSelector('#end.on', { timeout: 40000 }); } catch (e) { console.log('TIMEOUT. gesprochen:', JSON.stringify(await p.evaluate(() => window.__spoken.slice(-12)), null, 1)); console.log('gehört:', JSON.stringify(await p.evaluate(() => window.__heard.slice(-8)))); console.log(await p.evaluate(() => ({ gate: __latein.Bus.gate, pending: !!__latein.Bus.pending, prompt: document.querySelector('#sPrompt').textContent, cap: document.querySelector('#sCap').textContent }))); console.log('Fehler:', errs); await b.close(); process.exit(1); }
  await p.screenshot({ path: 'tests/shot-end.png' });
  const spoken = await p.evaluate(() => window.__spoken), heard = await p.evaluate(() => window.__heard);
  console.log('--- gesprochen (Auszug) ---'); spoken.slice(0, 40).forEach((t, i) => console.log(i, t));
  console.log('... insgesamt', spoken.length, 'Sätze; zuletzt:', spoken[spoken.length - 1]);
  console.log('Ende:', await p.textContent('#eMain'), '|', await p.textContent('#eSub'), '|', await p.textContent('#eStars'));
  console.log('Fehler:', errs);
  await b.close();
})();
