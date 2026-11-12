/* Gemini-Anbindung: Sprachausgabe (Aufnahmen) und Live-Gespräch.
   Der Schlüssel liegt nur im Browser dieses Geräts (localStorage), nie im Code. */
(function (root) {
  'use strict';
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const WS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const b64ToBytes = b => { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const bytesToB64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

  const Gem = {
    key: get('gemKey', ''), voice: get('gemVoice', 'Kore'),
    TTS_MODEL: 'gemini-3.8-flash-tts', LIVE_MODEL: 'gemini-3.8-live',
    VOICES: [['Kore', 'Kore (klar)'], ['Sulafat', 'Sulafat (warm)'], ['Leda', 'Leda (jung)'], ['Aoede', 'Aoede (locker)'], ['Achird', 'Achird (freundlich)'], ['Puck', 'Puck (munter)'], ['Charon', 'Charon (ruhig)']],
    setKey(k) { this.key = (k || '').trim(); set('gemKey', this.key); },
    setVoice(v) { this.voice = v; set('gemVoice', v); },
    hasKey() { return !!this.key; },
    hdr() { return { 'Content-Type': 'application/json', 'x-goog-api-key': this.key }; },
    async test() { const r = await fetch(BASE + '/models/' + this.LIVE_MODEL, { headers: this.hdr() }); if (!r.ok) { let m = ''; try { m = (await r.json()).error.message; } catch (e) { } throw new Error(r.status + (m ? ': ' + m : '')); } return true; },

    /* Latein so schreiben, dass die Stimme es wie in der Schule liest: c immer als k, Längenstriche bleiben */
    laText(first) { return String(first).replace(/c/g, 'k').replace(/C/g, 'K'); },
    STYLE: 'Lateinisches Vokabelwort, gesprochen von einer deutschen Lateinlehrerin in klassischer Schulaussprache: c immer wie k, v wie deutsches w, Vokale mit Längenstrich lang. Klar und deutlich.',

    /* ---------- Speicher für Aufnahmen (IndexedDB) ---------- */
    _db: null,
    db() { if (this._db) return this._db; return this._db = new Promise((res, rej) => { const q = indexedDB.open('latein-audio', 1); q.onupgradeneeded = () => q.result.createObjectStore('clips'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
    async idb(mode, fn) { const db = await this.db(); return new Promise((res, rej) => { const tx = db.transaction('clips', mode); const rq = fn(tx.objectStore('clips')); tx.oncomplete = () => res(rq && rq.result); tx.onerror = () => rej(tx.error); }); },
    ck(id) { return this.voice + '|' + id; },
    async getClip(id) { try { return await this.idb('readonly', s => s.get(this.ck(id))); } catch (e) { return null; } },
    async putClip(id, pcm) { try { await this.idb('readwrite', s => s.put(pcm, this.ck(id))); } catch (e) { } },
    async haveIds() { try { const keys = await this.idb('readonly', s => s.getAllKeys()); const p = this.voice + '|'; return new Set(keys.filter(k => String(k).startsWith(p)).map(k => String(k).slice(p.length))); } catch (e) { return new Set(); } },

    /* ---------- Sprachausgabe ---------- */
    async tts(text, style) {
      const part = { type: 'text', text }; if (style) part.annotations = [{ type: 'speech_metadata', style }];
      const body = { model: this.TTS_MODEL, input: [{ type: 'user_input', content: [part] }], response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 }, generation_config: { speech_config: [{ voice: this.voice }] } };
      for (let attempt = 0; attempt < 5; attempt++) {
        const r = await fetch(BASE + '/interactions', { method: 'POST', headers: this.hdr(), body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        if (r.status === 429) { const m = /retry in (\d+)/i.exec((j.error && j.error.message) || ''); await sleep(((m ? +m[1] : 20) + 2) * 1000); continue; }
        if (!r.ok) { const e = new Error(r.status + ': ' + ((j.error && j.error.message) || '')); e.status = r.status; throw e; }
        const a = (j.steps || []).filter(s => s.type === 'model_output').flatMap(s => s.content || []).filter(c => c.type === 'audio').pop();
        if (!a) throw new Error('Keine Audiodaten');
        return this.wavPcm(b64ToBytes(a.data));
      }
      throw new Error('Zu viele Anfragen, bitte später noch einmal.');
    },
    wavPcm(w) { const dv = new DataView(w.buffer, w.byteOffset, w.byteLength); let off = 12; while (off < w.length - 8) { const id = String.fromCharCode(w[off], w[off + 1], w[off + 2], w[off + 3]); const sz = dv.getUint32(off + 4, true); if (id === 'data') { const n = Math.min(sz, w.length - off - 8) >> 1; const s = new Int16Array(n); for (let i = 0; i < n; i++) s[i] = dv.getInt16(off + 8 + i * 2, true); return s; } off += 8 + sz + (sz & 1); } return new Int16Array(0); },
    // Zerlegt eine Aufnahme mit mehreren Wörtern an den Sprechpausen
    split(pcm, minGapMs = 500) { const rate = 24000, win = 240, n = Math.floor(pcm.length / win), env = new Float32Array(n); let peak = 0; for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < win; j++) { const v = pcm[i * win + j] / 32768; s += v * v; } env[i] = Math.sqrt(s / win); if (env[i] > peak) peak = env[i]; } const t = Math.max(0.012, peak * 0.04), out = []; let st = -1, last = -1; const gap = minGapMs / 10; for (let i = 0; i < n; i++) { if (env[i] > t) { if (st < 0) st = i; last = i; } else if (st >= 0 && i - last >= gap) { out.push([st, last + 1]); st = -1; } } if (st >= 0) out.push([st, last + 1]); return out.map(([a, b]) => pcm.slice(Math.max(0, (a - 8) * win), Math.min(pcm.length, (b + 14) * win))); },
    // items: [{id, text}] -> speichert Aufnahmen; liefert Anzahl
    async makeClips(items) {
      let done = 0;
      const run = async (group) => { const pcm = await this.tts(group.map(g => g.text).join(' <long pause> '), this.STYLE); const parts = this.split(pcm); if (parts.length !== group.length) return false; for (let i = 0; i < group.length; i++) await this.putClip(group[i].id, parts[i]); done += group.length; return true; };
      for (let i = 0; i < items.length; i += 8) { const g = items.slice(i, i + 8); if (!(await run(g))) for (let k = 0; k < g.length; k++) { try { await run(g.slice(k, k + 1)); } catch (e) { if (e.status) throw e; } } if (this.onProgress) this.onProgress(done); }
      return done;
    },
    _loading: {},
    loadLesson(lesson, items) { if (!this.hasKey() || this._loading[lesson]) return this._loading[lesson] || Promise.resolve(0); return this._loading[lesson] = (async () => { try { const have = await this.haveIds(); const miss = items.filter(x => !have.has(String(x.id))); return miss.length ? await this.makeClips(miss) : 0; } catch (e) { this.lastError = e.message; return 0; } finally { delete this._loading[lesson]; } })(); },

    /* ---------- Wiedergabe ---------- */
    out: null, srcs: [], playHead: 0,
    ctx() { if (!this.out || this.out.state === 'closed') { const AC = window.AudioContext || window.webkitAudioContext; this.out = new AC({ sampleRate: 24000 }); } if (this.out.state === 'suspended') this.out.resume().catch(() => { }); return this.out; },
    queue(pcm) { const c = this.ctx(); const buf = c.createBuffer(1, pcm.length, 24000); const ch = buf.getChannelData(0); for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768; const s = c.createBufferSource(); s.buffer = buf; s.connect(c.destination); const at = Math.max(c.currentTime + 0.03, this.playHead); s.start(at); this.playHead = at + buf.duration; this.srcs.push(s); s.onended = () => { this.srcs = this.srcs.filter(x => x !== s); }; return this.playHead - c.currentTime; },
    stopAudio() { this.srcs.forEach(s => { try { s.stop(); } catch (e) { } }); this.srcs = []; this.playHead = 0; },
    playing() { return this.out && this.playHead > this.out.currentTime + 0.05; },
    async playClip(id) { const pcm = await this.getClip(id); if (!pcm) return false; this.stopAudio(); const d = this.queue(pcm); await sleep(d * 1000); return true; },

    /* ---------- Live-Gespräch ---------- */
    live(opts) {
      const S = { ws: null, ready: false, closed: false, speaking: false, outText: '', inText: '' };
      const emit = (n, ...a) => { try { opts[n] && opts[n](...a); } catch (e) { console.error(e); } };
      const setup = { model: 'models/' + this.LIVE_MODEL, generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voice } } } }, systemInstruction: { parts: [{ text: opts.system }] }, tools: opts.tools, outputAudioTranscription: {}, inputAudioTranscription: {}, contextWindowCompression: { slidingWindow: {} } };
      const ws = S.ws = new WebSocket(WS + '?key=' + encodeURIComponent(this.key)); ws.binaryType = 'arraybuffer';
      ws.onopen = () => ws.send(JSON.stringify({ setup }));
      ws.onerror = () => { };
      ws.onclose = e => { const was = S.closed; S.closed = true; S.ready = false; S.stopMic(); if (!was) emit('onClose', e.code, e.reason || ''); };
      ws.onmessage = ev => {
        let t = ev.data; if (typeof t !== 'string') t = new TextDecoder().decode(t); let m; try { m = JSON.parse(t); } catch (e) { return; }
        if (m.setupComplete) { S.ready = true; emit('onReady'); }
        const sc = m.serverContent;
        if (sc) {
          if (sc.modelTurn) for (const p of sc.modelTurn.parts || []) if (p.inlineData && p.inlineData.data) { const b = b64ToBytes(p.inlineData.data); this.queue(new Int16Array(b.buffer, 0, b.length >> 1)); if (!S.speaking) { S.speaking = true; emit('onSpeak', true); } }
          if (sc.outputTranscription && sc.outputTranscription.text) { S.outText += sc.outputTranscription.text; emit('onCaption', S.outText); }
          if (sc.inputTranscription && sc.inputTranscription.text) { S.inText += sc.inputTranscription.text; emit('onHeard', S.inText); }
          if (sc.interrupted) { this.stopAudio(); S.speaking = false; S.outText = ''; emit('onSpeak', false); }
          if (sc.turnComplete) { const wait = Math.max(0, (this.playHead - this.ctx().currentTime) * 1000); S.outText = ''; S.inText = ''; setTimeout(() => { if (S.speaking && !this.playing()) { S.speaking = false; emit('onSpeak', false); } emit('onTurn'); }, wait + 50); }
        }
        if (m.toolCall) for (const c of m.toolCall.functionCalls || []) { let r; try { r = opts.onTool(c.name, c.args || {}); } catch (e) { console.error(e); r = { fehler: String(e) }; } if (!S.closed) ws.send(JSON.stringify({ toolResponse: { functionResponses: [{ id: c.id, name: c.name, response: r }] } })); S.inText = ''; }
      };
      S.text = t => { if (S.ready && ws.readyState === 1) ws.send(JSON.stringify({ realtimeInput: { text: t } })); };
      S.startMic = async () => {
        S.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
        const AC = window.AudioContext || window.webkitAudioContext; const c = S.mctx = new AC({ sampleRate: 16000 });
        const code = 'class P extends AudioWorkletProcessor{constructor(){super();this.b=new Int16Array(800);this.n=0}process(i){const x=i[0][0];if(x){for(let k=0;k<x.length;k++){const v=Math.max(-1,Math.min(1,x[k]));this.b[this.n++]=v*32767;if(this.n===800){this.port.postMessage(this.b.slice(0));this.n=0}}}return true}}registerProcessor("cap",P)';
        await c.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
        const src = c.createMediaStreamSource(S.stream); const node = S.node = new AudioWorkletNode(c, 'cap'); const mute = c.createGain(); mute.gain.value = 0; src.connect(node); node.connect(mute); mute.connect(c.destination);
        node.port.onmessage = e => { if (S.ready && !S.muted && ws.readyState === 1) { ws.send(JSON.stringify({ realtimeInput: { audio: { data: bytesToB64(new Uint8Array(e.data.buffer)), mimeType: 'audio/pcm;rate=16000' } } })); let s = 0; for (let i = 0; i < e.data.length; i += 8) s += Math.abs(e.data[i]); emit('onLevel', s / (e.data.length / 8) / 32768); } };
      };
      S.stopMic = () => { try { S.stream && S.stream.getTracks().forEach(t => t.stop()); } catch (e) { } try { S.mctx && S.mctx.close(); } catch (e) { } S.stream = null; S.mctx = null; };
      S.close = () => { S.closed = true; S.stopMic(); this.stopAudio(); try { ws.close(); } catch (e) { } };
      return S;
    }
  };
  root.Gem = Gem;
})(window);
