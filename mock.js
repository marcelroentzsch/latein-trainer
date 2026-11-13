// Nachgebaute Gemini-Gegenstellen für die Tests: Sprachausgabe (HTTP) und Live-Gespräch (WebSocket).
const { chromium } = require('playwright');

// ---- Sprachausgabe: liefert je Wort einen Ton, dessen Frequenz vom Wort abhängt (damit sich Vertauschungen nachweisen lassen)
const RATE = 24000;
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; };
const freqOf = word => 300 + (hash(word) % 50) * 20;                      // 300 … 1280 Hz
function wavFor(text, state) {
  let items = text.split(' <long pause> ');
  const chunks = []; const sil = sec => chunks.push(new Int16Array(Math.round(sec * RATE)));
  const burst = (word, sec) => { const n = Math.round(sec * RATE), a = new Int16Array(n), f = freqOf(word); for (let i = 0; i < n; i++) a[i] = Math.round(9000 * Math.sin(2 * Math.PI * f * i / RATE)); chunks.push(a); };
  sil(0.3);
  items.forEach((item, idx) => {
    const partsOf = item.split(/,\s*/);
    partsOf.forEach((p, k) => { burst(item, 0.25 + 0.085 * p.length); if (k < partsOf.length - 1) sil(0.2); });
    if (idx < items.length - 1) { if (state.merge && idx === 0 && items.length > 1) sil(0.1); else sil(1.2); }       // "merge": Pause zwischen Wort 1 und 2 fehlt
  });
  sil(0.3);
  const total = chunks.reduce((s, c) => s + c.length, 0), pcm = new Int16Array(total); let o = 0; chunks.forEach(c => { pcm.set(c, o); o += c.length; });
  const b = Buffer.alloc(44 + pcm.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) b.writeInt16LE(pcm[i], 44 + i * 2);
  return b;
}
async function mockTts(page, state) {
  state.requests = []; state.mode = state.mode || 'ok';
  await page.route('**/v1beta/interactions', async route => {
    const body = JSON.parse(route.request().postData()); const text = body.input[0].content[0].text;
    state.requests.push({ text, voice: body.generation_config.speech_config[0].voice, style: ((body.input[0].content[0].annotations || [])[0] || {}).style, t: Date.now() });
    if (state.delay) await new Promise(r => setTimeout(r, state.delay));
    if (state.mode === 'depleted') return route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify([{ error: { code: 402, message: 'Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.', status: 'RESOURCE_EXHAUSTED' } }]) });
    if (state.mode === 'badkey') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }) });
    if (state.rateOnce) { state.rateOnce = false; return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify([{ error: { code: 429, message: 'Rate limit exceeded for model gemini-3.8-flash-tts (limit: 10 requests per minute on Tier 1). Please retry in 1s or upgrade your tier.', status: 'RESOURCE_EXHAUSTED' } }]) }); }
    if (state.mode === 'offline') return route.abort('internetdisconnected');
    const wav = wavFor(text, state); if (state.merge) state.merge = false;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'x', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/wav', data: wav.toString('base64') }] }], usage: { total_input_tokens: 40, total_output_tokens: Math.round(wav.length / 2 / RATE * 25) } }) });
  });
}

// ---- Live-Gespräch: Ersatz für window.WebSocket. Das "Modell" spricht, was die Anweisung verlangt, und meldet Antworten, wenn der Test es auslöst.
function fakeLiveScript() {
  const F = window.__fake = { all: [], mode: 'ok', fc: 0, speakMs: 200,
    open() { return F.all.filter(s => s.readyState === 1); },
    active() { const o = F.open(); return o.sort((a, b) => (b.lastAudio || 0) - (a.lastAudio || 0) || b.id - a.id)[0]; },
    kid(art, gehoert) { F.active()._tool('antwort_melden', { art, gehoert: gehoert || art }); },
    lessons(ls) { F.active()._tool('lektionen_waehlen', { lektionen: ls }); },
    order(o) { F.active()._tool('reihenfolge_waehlen', { reihenfolge: o }); },
    chatter(t) { F.active()._say(t || 'Wie bitte?'); },
    drop(code, reason) { F.active()._close(code || 1006, reason || ''); },
    summary() { return F.all.map(s => ({ id: s.id, state: s.readyState, audio: s.audioChunks, texts: s.texts, said: s.said, voice: s.setup && s.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName })); } };
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 0; this.id = F.all.length + 1; F.all.push(this); this.texts = []; this.said = []; this.responses = []; this.audioChunks = 0; this.tokens = 900; this.binaryType = 'blob';
      setTimeout(() => { if (this.readyState !== 0) return; this.readyState = 1; this.onopen && this.onopen({}); }, 30); }
    send(data) { const m = JSON.parse(data);
      if (m.setup) { this.setup = m.setup; if (F.mode === 'depleted') return this._close(1011, 'Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billi'); if (F.mode === 'badkey') return this._close(1007, 'API key not valid. Please pass a valid API key.'); if (F.mode === 'down') return this._close(1006, ''); setTimeout(() => this._emit({ setupComplete: {} }), 40); return; }
      if (m.realtimeInput && m.realtimeInput.audio) { this.audioChunks++; this.lastAudio = performance.now(); return; }
      if (m.realtimeInput && m.realtimeInput.text != null) { const t = m.realtimeInput.text; this.texts.push(t); if (t.startsWith('App: ')) { const o = JSON.parse(t.slice(5)); if (/antwort_melden/.test(o.anweisung) && /Bewerte/.test(o.anweisung)) return this._tool('antwort_melden', { art: 'nochmal', gehoert: '' }); this._do(o); } else { const art = /Tipp/.test(t) ? 'tipp' : /nochmal/.test(t) ? 'nochmal' : /weiß ich nicht/.test(t) ? 'weiss_nicht' : null; if (art) this._tool('antwort_melden', { art, gehoert: t }); } return; }
      if (m.toolResponse) { const r = m.toolResponse.functionResponses[0].response; this.responses.push(r); this._do(r); } }
    close() { if (this.readyState === 3) return; this.readyState = 3; setTimeout(() => this.onclose && this.onclose({ code: 1000, reason: '' }), 0); }
    _close(code, reason) { if (this.readyState === 3) return; this.readyState = 3; setTimeout(() => this.onclose && this.onclose({ code, reason }), 10); }
    _emit(o) { if (this.readyState !== 1) return; this.onmessage && this.onmessage({ data: new TextEncoder().encode(JSON.stringify(o)).buffer }); }
    _tool(name, args) { this._emit({ toolCall: { functionCalls: [{ id: 'fc' + (++F.fc), name, args }] } }); }
    _render(r) { const out = [], a = r.anweisung || '', re = /Sage genau zweimal hintereinander: "([^"]*)"|(?:Sage(?: dann| nur| genau)?|Frage): "([^"]*)"|(Lobe)|(nicht stimmt)|(Wort unter "sage")|(Verabschiede)|(Lektionen 1 bis 20 gibt)/g; let m;
      while ((m = re.exec(a))) { if (m[1] != null) out.push(m[1], m[1]); else if (m[2] != null) out.push(m[2]); else if (m[3]) out.push('Super!'); else if (m[4]) out.push('Nicht ganz.'); else if (m[5]) out.push(r.frage ? r.frage.sage : '???'); else if (m[6]) out.push('Tschüss!'); else if (m[7]) out.push('Es gibt Lektion 1 bis 20.'); }
      return out.join(' | '); }
    _do(r) { if (r.frage) this.frage = r.frage; this._say(this._render(r)); }
    _say(text) { this.said.push(text); (F.saidLog = F.saidLog || []).push(text); if (!text) { this._emit({ serverContent: { turnComplete: true } }); return; }
      const n = Math.round(24000 * F.speakMs / 1000), pcm = new Int16Array(n); for (let i = 0; i < n; i++) pcm[i] = 800 * Math.sin(i / 12);
      this._emit({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: b64(new Uint8Array(pcm.buffer)) } }] } } });
      this._emit({ serverContent: { outputTranscription: { text } } });
      this.tokens += 350; this._emit({ usageMetadata: { promptTokenCount: this.tokens, responseTokenCount: 30, totalTokenCount: this.tokens + 30, promptTokensDetails: [{ modality: 'TEXT', tokenCount: this.tokens - 200 }, { modality: 'AUDIO', tokenCount: 200 }], responseTokensDetails: [{ modality: 'AUDIO', tokenCount: 25 }], thoughtsTokenCount: 20 } });
      this._emit({ serverContent: { generationComplete: true } }); this._emit({ serverContent: { turnComplete: true } }); }
  }
  FakeWS.CONNECTING = 0; FakeWS.OPEN = 1; FakeWS.CLOSING = 2; FakeWS.CLOSED = 3;
  const Real = window.WebSocket;
  window.WebSocket = function (url, p) { return /generativelanguage/.test(url) ? new FakeWS(url) : new Real(url, p); };
  // Browser-Stimme überwachen: Mit Schlüssel darf sie nie sprechen
  window.__spoken = []; try { class U { constructor(t) { this.text = t; } } window.SpeechSynthesisUtterance = U; Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ lang: 'de-DE', name: 'mock' }], speak(u) { window.__spoken.push(u.text); }, cancel() { } } }); } catch (e) { }
}

async function launch(opts = {}) {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, permissions: ['microphone'] });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
  const state = { mode: 'ok' }; await mockTts(page, state);
  await page.addInitScript(fakeLiveScript);
  if (opts.key !== false) await page.addInitScript(() => { localStorage.setItem('gemKey', JSON.stringify('TESTKEY')); });
  if (opts.init) await page.addInitScript(opts.init);
  return { b, page, errs, state };
}
module.exports = { launch, freqOf, RATE };
