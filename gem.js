/* Gemini-Anbindung: Aufnahmen der lateinischen Wörter (Sprachausgabe) und Live-Gespräch.
   Der Schlüssel liegt nur im Browser dieses Geräts (localStorage), nie im Code. */
(function (root) {
  'use strict';
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const WSURL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
  const RATE = 24000;
  // Richtpreise in US-Dollar je 1 Mio. Token. Nur für die Kostenschätzung im Elternbereich.
  const PRICE = { liveInText: 0.75, liveInAudio: 3, liveOutAudio: 12, liveOutText: 4.5, ttsIn: 1, ttsOut: 18 };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const b64ToBytes = b => { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const bytesToB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

  /* ---------- Fehler einordnen ---------- */
  function classify(status, msg) {
    const m = String(msg || '');
    if (status === 402 || /prepay|credits? (are|is) depleted|credit balance/i.test(m)) return 'credit';
    if (status === 401 || status === 403 || /api[ _]key/i.test(m)) return 'key';
    if (status === 429 || /rate limit|quota/i.test(m)) return 'rate';
    if (status === 0) return 'net';
    return 'other';
  }
  function mkErr(status, msg) { const e = new Error(msg || ('HTTP ' + status)); e.status = status; e.kind = classify(status, msg); return e; }
  const errMsg = j => { const o = Array.isArray(j) ? j[0] : j; return (o && o.error && o.error.message) || ''; };
  const EXPLAIN = {
    credit: 'Das Guthaben bei Google ist aufgebraucht. Bitte in Google AI Studio aufladen.',
    key: 'Google akzeptiert den Schlüssel nicht. Bitte im Elternbereich prüfen.',
    rate: 'Google nimmt gerade keine weiteren Anfragen an. Bitte kurz warten.',
    net: 'Keine Verbindung zum Internet.',
    other: 'Gemini ist gerade nicht erreichbar.'
  };

  const Gem = {
    key: get('gemKey', ''), voice: get('gemVoice', 'Kore'),
    TTS_MODEL: 'gemini-3.8-flash-tts', LIVE_MODEL: 'gemini-3.8-live',
    bargeIn: get('bargeIn', false),
    setBargeIn(v) { this.bargeIn = !!v; set('bargeIn', this.bargeIn); },
    VOICES: [['Kore', 'Kore (klar)', 'w'], ['Sulafat', 'Sulafat (warm)', 'w'], ['Leda', 'Leda (jung)', 'w'], ['Aoede', 'Aoede (locker)', 'w'], ['Achird', 'Achird (freundlich)', 'm'], ['Puck', 'Puck (munter)', 'm'], ['Charon', 'Charon (ruhig)', 'm']],
    SV: 's2',                                   // Fassung der Sprechvorgabe; ändert sie sich, werden die Aufnahmen neu erzeugt
    setKey(k) { k = (k || '').trim(); if (k !== this.key) { this.key = k; set('gemKey', k); this.blockedUntil = 0; } },
    setVoice(v) { if (v === this.voice) return; this.failAll(mkErr(-1, 'Stimme gewechselt')); this.voice = v; set('gemVoice', v); },
    hasKey() { return !!this.key; },
    female() { const v = this.VOICES.find(x => x[0] === this.voice); return !v || v[2] === 'w'; },
    hdr() { return { 'Content-Type': 'application/json', 'x-goog-api-key': this.key }; },
    explain(err) { return EXPLAIN[(err && err.kind) || 'other'] || EXPLAIN.other; },
    classify, mkErr,

    /* Latein so schreiben, dass die Stimme es wie in der Schule liest: c immer als k, Längenstriche bleiben */
    laText(s) { return String(s).replace(/c/g, 'k').replace(/C/g, 'K'); },
    style() { return `Lateinisches Vokabelwort, gesprochen von ${this.female() ? 'einer deutschen Lateinlehrerin' : 'einem deutschen Lateinlehrer'} in klassischer Schulaussprache: c immer wie k, v wie deutsches w, Vokale mit Längenstrich lang. Klar und deutlich.`; },

    /* ---------- Kostenschätzung ---------- */
    usage() { const u = get('gemUse', { day: '', today: 0, total: 0 }); if (u.day !== new Date().toDateString()) { u.day = new Date().toDateString(); u.today = 0; } return u; },
    addUsage(usd) { if (!(usd > 0)) return; const u = this.usage(); u.today += usd; u.total += usd; set('gemUse', u); },
    liveCost(um) {
      const det = (arr, mod) => (arr || []).filter(x => x.modality === mod).reduce((s, x) => s + (x.tokenCount || 0), 0);
      const p = um.promptTokenCount || 0, pa = det(um.promptTokensDetails, 'AUDIO'), r = um.responseTokenCount || 0, ra = det(um.responseTokensDetails, 'AUDIO'), th = um.thoughtsTokenCount || 0;
      return (Math.max(0, p - pa) * PRICE.liveInText + pa * PRICE.liveInAudio + ra * PRICE.liveOutAudio + (Math.max(0, r - ra) + th) * PRICE.liveOutText) / 1e6;
    },

    /* ---------- Speicher für Aufnahmen (IndexedDB). Schlüssel: Fassung | Stimme | gesprochener Text ---------- */
    _db: null, _keys: new Set(), ready: null,
    db() { if (this._db) return this._db; return this._db = new Promise((res, rej) => { const q = indexedDB.open('latein-audio', 1); q.onupgradeneeded = () => q.result.createObjectStore('clips'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
    async idb(mode, fn) { const db = await this.db(); return new Promise((res, rej) => { const tx = db.transaction('clips', mode); const rq = fn(tx.objectStore('clips')); tx.oncomplete = () => res(rq && rq.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); },
    ckey(text) { return this.SV + '|' + this.voice + '|' + text; },
    // Beim Start: alte Aufnahmen (früher nach Wortnummer abgelegt) übernehmen, soweit der gesprochene Text gleich geblieben ist
    init(idToText) {
      return this.ready = (async () => {
        try {
          const db = await this.db(), pre = this.SV + '|';
          await new Promise(res => { const tx = db.transaction('clips', 'readwrite'), st = tx.objectStore('clips'), rq = st.openCursor();
            rq.onsuccess = () => { const c = rq.result; if (!c) return; const k = String(c.key); if (!k.startsWith(pre)) { const i = k.indexOf('|'), voice = k.slice(0, i), text = idToText && idToText[k.slice(i + 1)]; if (i > 0 && text && !/^s\d+$/.test(voice)) st.put(c.value, pre + voice + '|' + text); c.delete(); } c.continue(); };
            tx.oncomplete = res; tx.onerror = res; tx.onabort = res; });
          (await this.idb('readonly', s => s.getAllKeys())).forEach(k => this._keys.add(String(k)));
        } catch (e) { }
      })();
    },
    hasNow(text) { return this._keys.has(this.ckey(text)); },
    count(texts) { return texts.filter(t => this.hasNow(t)).length; },
    async getClip(text) { try { return await this.idb('readonly', s => s.get(this.ckey(text))); } catch (e) { return null; } },

    /* ---------- Sprachausgabe (ein Aufruf) ---------- */
    async tts(text, styled = true) {
      const part = { type: 'text', text }; if (styled) part.annotations = [{ type: 'speech_metadata', style: this.style() }];
      const body = JSON.stringify({ model: this.TTS_MODEL, input: [{ type: 'user_input', content: [part] }], response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: RATE }, generation_config: { speech_config: [{ voice: this.voice }] } });
      for (let attempt = 0; attempt < 4; attempt++) {
        let r; try { r = await fetch(BASE + '/interactions', { method: 'POST', headers: this.hdr(), body }); } catch (e) { throw mkErr(0, 'Netzwerk'); }
        const j = await r.json().catch(() => null), msg = errMsg(j);
        if (r.status === 429 && classify(429, msg) === 'rate') { const m = /retry in (\d+)/i.exec(msg); await sleep(Math.min(65, (m ? +m[1] : 15) + 1) * 1000); continue; }
        if (!r.ok) throw mkErr(r.status, msg);
        const a = ((j && j.steps) || []).filter(s => s.type === 'model_output').flatMap(s => s.content || []).filter(c => c.type === 'audio').pop();
        if (!a || !a.data) throw mkErr(-1, 'Keine Audiodaten');
        if (j.usage) this.addUsage(((j.usage.total_input_tokens || 0) * PRICE.ttsIn + (j.usage.total_output_tokens || 0) * PRICE.ttsOut) / 1e6);
        return this.wavPcm(b64ToBytes(a.data));
      }
      throw mkErr(429, 'rate limit');
    },
    wavPcm(w) { const dv = new DataView(w.buffer, w.byteOffset, w.byteLength); let off = 12; while (off < w.length - 8) { const id = String.fromCharCode(w[off], w[off + 1], w[off + 2], w[off + 3]); const sz = dv.getUint32(off + 4, true); if (id === 'data') { const n = Math.min(sz, w.length - off - 8) >> 1; const s = new Int16Array(n); for (let i = 0; i < n; i++) s[i] = dv.getInt16(off + 8 + i * 2, true); return s; } off += 8 + sz + (sz & 1); } return new Int16Array(0); },
    // Findet die gesprochenen Abschnitte (getrennt durch Pausen). Liefert [Anfang, Ende] in Abtastwerten, mit etwas Rand.
    split(pcm, minGapMs = 450) {
      const win = 240, n = Math.floor(pcm.length / win), env = new Float32Array(n); let peak = 0;
      for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < win; j++) { const v = pcm[i * win + j] / 32768; s += v * v; } env[i] = Math.sqrt(s / win); if (env[i] > peak) peak = env[i]; }
      const t = Math.max(0.012, peak * 0.04), out = [], gap = minGapMs / 10; let st = -1, last = -1;
      for (let i = 0; i < n; i++) { if (env[i] > t) { if (st < 0) st = i; last = i; } else if (st >= 0 && i - last >= gap) { out.push([st, last + 1]); st = -1; } }
      if (st >= 0) out.push([st, last + 1]);
      return out.map(([a, b]) => [Math.max(0, (a - 8) * win), Math.min(pcm.length, (b + 14) * win)]);
    },
    isSolo(text) { return /[\s,]/.test(text); },           // mehrteilige Einträge werden einzeln vertont und nicht zerlegt
    // Passen die Längen der Abschnitte zu den Wörtern? Schützt vor vertauschten Aufnahmen.
    plausible(group, segs) {
      const d = segs.map(s => (s[1] - s[0]) / RATE), r = d.map((x, i) => x / (0.25 + 0.085 * group[i].text.length)), med = r.slice().sort((a, b) => a - b)[r.length >> 1];
      return d.every((x, i) => x >= 0.15 && x <= 3.5 && r[i] >= 0.4 * med && r[i] <= 2.4 * med);
    },

    /* ---------- Warteschlange: erzeugt fehlende Aufnahmen, Wichtiges zuerst ---------- */
    q: [], inq: new Map(), working: false, blockedUntil: 0, blockErr: null, onProgress: null,
    // Liefert { ok: true } oder { ok: false, error }, sobald alle genannten Texte vorliegen oder gescheitert sind
    want(texts, prio = 0) {
      if (!this.hasKey()) return Promise.resolve({ ok: false, error: mkErr(401, 'api key') });
      const ps = [];
      for (const text of new Set(texts)) {
        if (!text || this.hasNow(text)) continue;
        const key = this.ckey(text); let e = this.inq.get(key);
        if (!e) { e = { text, key, prio, tries: 0, solo: this.isSolo(text) }; e.p = new Promise(r => e.res = r); this.inq.set(key, e); this.q.push(e); } else if (prio > e.prio) e.prio = prio;
        ps.push(e.p);
      }
      this.pump();
      return Promise.all(ps).then(rs => { const bad = rs.find(r => r !== true); return bad ? { ok: false, error: bad } : { ok: true }; });
    },
    finish(e, result) { this.inq.delete(e.key); if (result === true) this._keys.add(e.key); e.res(result); if (this.onProgress) try { this.onProgress(); } catch (x) { } },
    failAll(err) { const all = this.q; this.q = []; all.forEach(e => this.finish(e, err)); },
    async store(e, pcm) { await this.idb('readwrite', s => s.put(pcm, e.key)); this.finish(e, true); },
    async pump() {
      if (this.working) return; this.working = true;
      try {
        while (this.q.length) {
          if (Date.now() < this.blockedUntil) { this.failAll(this.blockErr); break; }
          this.q.sort((a, b) => b.prio - a.prio);
          const first = this.q[0], group = first.solo ? [first] : this.q.filter(e => !e.solo).slice(0, 8);
          this.q = this.q.filter(e => !group.includes(e));
          try { await this.make(group); }
          catch (err) {
            const er = err && err.kind ? err : mkErr(-1, String(err)); group.forEach(e => this.finish(e, er));
            if (er.kind === 'credit' || er.kind === 'key') { this.blockedUntil = Date.now() + 45000; this.blockErr = er; }
            if (er.kind !== 'other') this.failAll(er);
          }
        }
      } finally { this.working = false; }
    },
    async make(group) {
      const voice = this.voice, pcm = await this.tts(group.map(e => e.text).join(' <long pause> ')), segs = this.split(pcm);
      if (voice !== this.voice) { group.forEach(e => this.finish(e, mkErr(-1, 'Stimme gewechselt'))); return; }
      if (group.length === 1) {
        const e = group[0], span = segs.length ? [segs[0][0], segs[segs.length - 1][1]] : null, d = span ? (span[1] - span[0]) / RATE : 0;
        if (span && d >= 0.12 && d <= 6 && (segs.length === 1 || this.isSolo(e.text))) return this.store(e, pcm.slice(span[0], span[1]));
        if (++e.tries < 2) { this.q.unshift(e); return; }
        return this.finish(e, mkErr(-1, 'Aufnahme unbrauchbar'));
      }
      if (segs.length === group.length && this.plausible(group, segs)) { for (let i = 0; i < group.length; i++) await this.store(group[i], pcm.slice(segs[i][0], segs[i][1])); return; }
      group.forEach(e => { e.solo = true; });               // Zerlegung unsicher: jedes Wort einzeln nachholen
      this.q = group.concat(this.q);
    },

    /* ---------- Wiedergabe ---------- */
    out: null, srcs: [], playHead: 0,
    ctx() { if (!this.out || this.out.state === 'closed') { const AC = window.AudioContext || window.webkitAudioContext; this.out = new AC({ latencyHint: 'playback' }); } if (this.out.state === 'suspended') this.out.resume().catch(() => { }); return this.out; },
    queue(pcm, lead = 0.03) { const c = this.ctx(); const buf = c.createBuffer(1, pcm.length, RATE); const ch = buf.getChannelData(0); for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768; const s = c.createBufferSource(); s.buffer = buf; s.connect(c.destination); const fade = Math.min(48, pcm.length >> 3); if (this.playHead < c.currentTime + 0.005) for (let i = 0; i < fade; i++) ch[i] *= i / fade; const at = Math.max(c.currentTime + lead, this.playHead); s.start(at); this.playHead = at + buf.duration; this.srcs.push(s); s.onended = () => { this.srcs = this.srcs.filter(x => x !== s); }; return this.playHead - c.currentTime; },
    stopAudio() { this.srcs.forEach(s => { try { s.stop(); } catch (e) { } }); this.srcs = []; this.playHead = 0; },
    playing() { return !!this.out && this.playHead > this.out.currentTime + 0.05; },
    // Lautsprecher aktiv oder gerade erst verstummt (Nachhall im Raum)
    echoRisk() { return !!this.out && this.playHead + 0.4 > this.out.currentTime; },
    async play(text) { const pcm = await this.getClip(text); if (!pcm || !pcm.length) return false; this.stopAudio(); this.queue(pcm); return true; },

    /* ---------- Mikrofon (eines für das ganze Sprech-Training, auch wenn die Sitzung wechselt) ---------- */
    /* Geräuschsperre: lässt nur deutliche Sprache durch, sonst Stille.
       Während die App selbst spricht, ist das Mikrofon zu (oder bei "Dazwischenreden" nur für sehr laute, nahe Sprache offen). */
    gate: {
      floor: 0.004, hang: 0, pre: [], bargeIn: false, sentSpeech: 0,
      level(c) { let s = 0; for (let i = 0; i < c.length; i++) s += c[i] * c[i]; return Math.sqrt(s / c.length) / 32768; },
      reset() { this.hang = 0; this.pre = []; },
      // liefert die Blöcke, die gesendet werden sollen (Sprache samt kurzem Vorlauf), sonst einen Stille-Block
      pass(c, echo) {
        const lvl = this.level(c), silent = new Int16Array(c.length);
        if (!echo) { const up = this.hang > 0 ? 0.002 : 0.025; this.floor = lvl < this.floor ? this.floor * 0.7 + lvl * 0.3 : this.floor * (1 - up) + lvl * up; }   // Grundgeräusch lernen: steigt langsam, fällt schnell
        let thr = Math.max(0.012, this.floor * 3.2);
        if (echo) thr = this.bargeIn ? Math.max(0.08, thr * 5) : Infinity;
        const loud = lvl > thr;
        if (loud) { const out = this.hang > 0 ? [c] : this.pre.concat([c]); this.pre = []; this.hang = 14; this.sentSpeech++; return out; }
        if (this.hang > 0) { this.hang--; return [c]; }
        this.pre.push(c); if (this.pre.length > 4) this.pre.shift();
        return [silent];
      }
    },

    mic: {
      stream: null, mctx: null, sink: null, onLevel: null,
      async start() {
        if (this.stream) return;
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
        const AC = window.AudioContext || window.webkitAudioContext, c = this.mctx = new AC({ sampleRate: 16000 });
        const code = 'class P extends AudioWorkletProcessor{constructor(){super();this.b=new Int16Array(800);this.n=0}process(i){const x=i[0][0];if(x){for(let k=0;k<x.length;k++){const v=Math.max(-1,Math.min(1,x[k]));this.b[this.n++]=v*32767;if(this.n===800){this.port.postMessage(this.b.slice(0));this.n=0}}}return true}}registerProcessor("cap",P)';
        await c.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
        const src = c.createMediaStreamSource(this.stream), node = new AudioWorkletNode(c, 'cap'), mute = c.createGain(); mute.gain.value = 0; src.connect(node); node.connect(mute); mute.connect(c.destination);
        node.port.onmessage = e => { const d = e.data; if (this.sink) this.sink(d); if (this.onLevel) { let s = 0; for (let i = 0; i < d.length; i += 8) s += Math.abs(d[i]); this.onLevel(s / (d.length / 8) / 32768); } };
      },
      stop() { try { this.stream && this.stream.getTracks().forEach(t => t.stop()); } catch (e) { } try { this.mctx && this.mctx.close(); } catch (e) { } this.stream = null; this.mctx = null; this.sink = null; }
    },

    /* ---------- Live-Gespräch: eine Sitzung ---------- */
    live(opts) {
      const S = { ws: null, ready: false, closed: false, speaking: false, outText: '', toolInTurn: false, promptTokens: 0, sent: 0 };
      const emit = (n, ...a) => { try { return opts[n] && opts[n](...a); } catch (e) { console.error(e); } };
      const setup = { model: 'models/' + this.LIVE_MODEL, generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voice } } } }, systemInstruction: { parts: [{ text: opts.system }] }, tools: opts.tools, outputAudioTranscription: {}, contextWindowCompression: { slidingWindow: {} }, realtimeInputConfig: { automaticActivityDetection: { startOfSpeechSensitivity: 'START_SENSITIVITY_LOW', prefixPaddingMs: 200, silenceDurationMs: 700 }, activityHandling: opts.bargeIn ? 'START_OF_ACTIVITY_INTERRUPTS' : 'NO_INTERRUPTION', turnCoverage: 'TURN_INCLUDES_ONLY_ACTIVITY' } };
      let ws; try { ws = S.ws = new WebSocket(WSURL + '?key=' + encodeURIComponent(this.key)); } catch (e) { setTimeout(() => emit('onClose', 'net', ''), 0); S.closed = true; S.text = S.audio = S.close = () => { }; return S; }
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => ws.send(JSON.stringify({ setup }));
      ws.onerror = () => { };
      ws.onclose = e => { const was = S.closed, wasReady = S.ready; S.closed = true; S.ready = false; if (was) return; const reason = e.reason || ''; let kind = classify(-1, reason); if (kind === 'other' && !wasReady && !navigator.onLine) kind = 'net'; emit('onClose', kind, reason, e.code); };
      ws.onmessage = ev => {
        let t = ev.data; if (typeof t !== 'string') t = new TextDecoder().decode(t); let m; try { m = JSON.parse(t); } catch (e) { return; }
        if (m.setupComplete) { S.ready = true; emit('onReady'); }
        if (m.usageMetadata) { const um = m.usageMetadata; S.promptTokens = um.promptTokenCount || S.promptTokens; this.addUsage(this.liveCost(um)); }
        if (m.goAway) emit('onGoAway');
        const sc = m.serverContent;
        if (sc) {
          if (sc.modelTurn) for (const p of sc.modelTurn.parts || []) if (p.inlineData && p.inlineData.data) { const b = b64ToBytes(p.inlineData.data); this.queue(new Int16Array(b.buffer, 0, b.length >> 1), 0.18); if (!S.speaking) { S.speaking = true; emit('onSpeak', true); } }
          if (sc.outputTranscription && sc.outputTranscription.text) { S.outText += sc.outputTranscription.text; emit('onCaption', S.outText); }
          if (sc.interrupted) { this.stopAudio(); S.speaking = false; S.outText = ''; emit('onSpeak', false); }
          if (sc.turnComplete) { const wait = Math.max(0, (this.playHead - this.ctx().currentTime) * 1000), tool = S.toolInTurn; S.toolInTurn = false; S.outText = ''; setTimeout(() => { if (S.closed) return; if (S.speaking && !this.playing()) { S.speaking = false; emit('onSpeak', false); } emit('onTurn', { tool }); }, wait + 50); }
        }
        if (m.toolCall) for (const c of m.toolCall.functionCalls || []) { S.toolInTurn = true; let r; try { r = opts.onTool(c.name, c.args || {}); } catch (e) { console.error(e); r = { fehler: String(e) }; } if (!S.closed && ws.readyState === 1) ws.send(JSON.stringify({ toolResponse: { functionResponses: [{ id: c.id, name: c.name, response: r }] } })); }
      };
      S.text = t => { if (S.ready && ws.readyState === 1) ws.send(JSON.stringify({ realtimeInput: { text: t } })); };
      S.audio = chunk => { if (S.ready && ws.readyState === 1) { ws.send(JSON.stringify({ realtimeInput: { audio: { data: bytesToB64(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)), mimeType: 'audio/pcm;rate=16000' } } })); S.sent++; } };
      S.close = () => { if (S.closed) return; S.closed = true; S.ready = false; try { ws.close(); } catch (e) { } };
      return S;
    }
  };
  root.Gem = Gem;
})(window);
