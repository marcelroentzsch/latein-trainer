/* KI-Spracherkennung über die Gemini-API.
   Der Schlüssel wird nur im Browser des Geräts gespeichert (localStorage) und steht NICHT im Code. */
(function (root) {
  'use strict';
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

  const LLM = {
    DEFAULT_MODEL,
    key: get('gemKey', ''), model: get('gemModel', DEFAULT_MODEL), on: get('gemOn', false), failed: false, lastError: '',
    setKey(k) { this.key = (k || '').trim(); set('gemKey', this.key); },
    setModel(m) { this.model = (m || '').trim() || DEFAULT_MODEL; set('gemModel', this.model); },
    setOn(v) { this.on = !!v; set('gemOn', this.on); },
    active() { return this.on && !!this.key && !this.failed; },
    poolText: '',

    /* ---------- Mikrofon + Sprechpausen-Erkennung ---------- */
    stream: null, ctx: null, an: null, cur: null,
    async openMic() {
      if (this.stream && this.stream.active) return;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const AC = window.AudioContext || window.webkitAudioContext; this.ctx = this.ctx || new AC();
      try { await this.ctx.resume(); } catch (e) { }
      const src = this.ctx.createMediaStreamSource(this.stream); this.an = this.ctx.createAnalyser(); this.an.fftSize = 1024; src.connect(this.an);
    },
    closeMic() { this.cancelListen(); try { this.stream && this.stream.getTracks().forEach(t => t.stop()); } catch (e) { } this.stream = null; this.an = null; try { this.ctx && this.ctx.close(); } catch (e) { } this.ctx = null; },
    cancelListen() { if (this.cur) { const c = this.cur; this.cur = null; c(null); } },

    // Nimmt auf, bis eine Sprechpause nach einer Äußerung kommt. Liefert { blob, mime } oder null (nichts gesagt / abgebrochen).
    // opts.strict: höhere Schwelle (während die App selbst spricht)
    listen(ms = 9000, opts = {}) {
      return new Promise(async (resolve) => {
        try { await this.openMic(); } catch (e) { this.lastError = 'mic'; resolve({ error: 'mic' }); return; }
        this.cancelListen();
        const mime = (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) ? 'audio/webm;codecs=opus' : '';
        let rec; try { rec = mime ? new MediaRecorder(this.stream, { mimeType: mime }) : new MediaRecorder(this.stream); } catch (e) { resolve({ error: 'rec' }); return; }
        const chunks = []; let finished = false, speechStart = 0, lastLoud = 0, loudRun = 0, floor = 0.01, frames = 0, cancelled = false;
        const buf = new Float32Array(this.an.fftSize);
        const t0 = performance.now(); const mult = opts.strict ? 1.9 : 1;
        const finish = (send) => {
          if (finished) return; finished = true; clearInterval(iv); this.cur = null;
          rec.onstop = () => { if (!send || cancelled) { resolve(null); return; } resolve({ blob: new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), mime: (rec.mimeType || 'audio/webm').split(';')[0] }); };
          try { rec.state !== 'inactive' ? rec.stop() : rec.onstop(); } catch (e) { resolve(null); }
        };
        this.cur = () => { cancelled = true; finish(false); };
        rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        try { rec.start(250); } catch (e) { resolve({ error: 'rec' }); return; }
        const iv = setInterval(() => {
          if (!this.an) { finish(false); return; }
          this.an.getFloatTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length), now = performance.now(); frames++;
          if (!speechStart) floor = frames < 4 ? Math.max(floor, rms) : Math.min(floor * 1.02 + 1e-4, Math.max(rms, 0.002)) ;
          const thr = Math.max(0.02, floor * 3) * mult;
          if (rms > thr) { loudRun++; lastLoud = now; if (!speechStart && loudRun >= 3) speechStart = now - 150; } else loudRun = 0;
          if (speechStart) {
            const dur = now - speechStart;
            if ((now - lastLoud > 850 && dur > 350) || dur > 12000) finish(true);
          } else if (now - t0 > ms) finish(false);
        }, 50);
        if (opts.onSpeech) { const w = setInterval(() => { if (finished) clearInterval(w); else if (speechStart) { clearInterval(w); opts.onSpeech(); } }, 80); }
      });
    },

    /* ---------- Gemini ---------- */
    toB64(blob) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); }); },
    system() {
      return 'Du bist das "Ohr" eines Latein-Vokabeltrainers für ein deutsches Kind (5. Klasse Gymnasium, Bayern). ' +
        'Du bekommst eine kurze Audioaufnahme der Stimme des Kindes. Lateinische Wörter spricht das Kind mit deutscher Schulaussprache (v=w, c=k, ae=ä, qu=kw, ie lange Vokale). ' +
        'Die synthetische Stimme der App kann leise im Hintergrund zu hören sein: ignoriere sie. Wenn nur Rauschen, Stille oder die App-Stimme zu hören ist, gib leere Werte zurück. ' +
        'Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne weiteren Text. ' + (this.poolText ? 'Lateinische Wörter der aktuell geübten Lektionen: ' + this.poolText : '');
    },
    async call(contextText, blob, mime) {
      const parts = [{ text: contextText }];
      if (blob) parts.push({ inline_data: { mime_type: mime || 'audio/webm', data: await this.toB64(blob) } });
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(this.model) + ':generateContent';
      const body = { systemInstruction: { parts: [{ text: this.system() }] }, contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 300 } };
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 15000);
      let r; try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key }, body: JSON.stringify(body), signal: ctl.signal }); } finally { clearTimeout(to); }
      if (!r.ok) { let m = ''; try { m = (await r.json()).error.message; } catch (e) { } const err = new Error('HTTP ' + r.status + (m ? ': ' + m : '')); err.status = r.status; throw err; }
      const j = await r.json(); const txt = (((j.candidates || [])[0] || {}).content || {}).parts; const raw = (txt || []).map(p => p.text || '').join('');
      const m = raw.match(/\{[\s\S]*\}/); if (!m) throw new Error('Keine JSON-Antwort');
      return JSON.parse(m[0]);
    },
    // Aufgaben
    ctxFor(task) {
      if (task.kind === 'lessons') return 'AUFGABE lessons: Die App hat gefragt, welche Lektionen (1 bis ' + task.max + ') geübt werden sollen. Das Kind antwortet frei, z. B. "eins bis sieben", "die ersten fünf", "alles", "ich möchte Lektion 4 und 6". ' +
        'Gib {"transcript": "...", "lessons": [Zahlen] oder null, "stop": true/false} zurück. "alle" = alle Lektionen. Wenn keine Lektion genannt wurde: lessons null.' + (task.said ? ' Die App sagt gerade: "' + task.said + '".' : '');
      if (task.kind === 'order') return 'AUFGABE order: Die App hat gefragt, ob die Lektionen nacheinander (eine Lektion nach der anderen) oder gemischt (alle Wörter durcheinander) abgefragt werden sollen. ' +
        'Gib {"transcript": "...", "order": "seq" oder "mix" oder null, "stop": true/false} zurück.';
      if (task.kind === 'answer') return 'AUFGABE answer: Die App hat dem Kind ' + (task.dir === 'l2d' ? 'das lateinische Wort "' + task.prompt + '" genannt; das Kind soll die deutsche Bedeutung sagen.' : 'das deutsche Wort "' + task.prompt + '" genannt; das Kind soll das lateinische Wort sagen.') +
        ' Akzeptierte Antworten: ' + JSON.stringify(task.accepted) + '. ' +
        'Gib {"transcript": "was das Kind gesagt hat", "intent": "answer" | "hint" | "repeat" | "giveup" | "stop" | "none", "correct": true/false} zurück. ' +
        'intent=hint wenn das Kind einen Tipp/Hilfe/den Anfangsbuchstaben will; repeat bei "nochmal/wiederholen"; giveup bei "weiß ich nicht"; stop bei "aufhören/stopp"; none wenn nichts Verständliches gesagt wurde. ' +
        'Bei intent=answer ist correct nur dann true, wenn die Antwort dasselbe Wort bedeutet wie eine akzeptierte Antwort (Artikel egal, kleine Aussprachefehler bei lateinischen Wörtern sind in Ordnung, aber ein anderes Wort ist falsch).' + (task.said ? ' Die App sagt gerade: "' + task.said + '".' : '');
      return '';
    },
    async interpret(task, rec) {
      const j = await this.call(this.ctxFor(task), rec.blob, rec.mime);
      const tr = String(j.transcript || '').trim();
      const out = { transcript: tr, raw: j };
      if (task.kind === 'lessons') { out.lessons = Array.isArray(j.lessons) ? j.lessons.map(Number).filter(n => n >= 1 && n <= task.max) : null; if (out.lessons && !out.lessons.length) out.lessons = null; out.stop = !!j.stop; out.silent = !tr && !out.lessons && !out.stop; }
      else if (task.kind === 'order') { out.order = j.order === 'seq' || j.order === 'mix' ? j.order : null; out.stop = !!j.stop; out.silent = !tr && !out.order && !out.stop; }
      else { out.intent = ['answer', 'hint', 'repeat', 'giveup', 'stop', 'none'].includes(j.intent) ? j.intent : 'none'; out.correct = j.correct === true; out.silent = out.intent === 'none' && !tr; }
      return out;
    },
    async test() { const j = await this.call('Antworte mit {"ok": true}.', null); return j.ok === true; }
  };
  root.LLM = LLM;
})(typeof window !== 'undefined' ? window : globalThis);
