(function () {
  'use strict';
  const L = window.Logic, V = window.VOCAB, Ic = window.Icons;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  const memo = store.get('dirMemo', {});           // merkt sich je Wort: zuletzt Latein->Deutsch (l2d) oder Deutsch->Latein (d2l)
  const saveMemo = () => store.set('dirMemo', memo);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let soundOn = store.get('soundOn', true);
  const LESSONS = [...new Set(V.map(v => v.lesson))].sort((a, b) => a - b);

  function show(id) { $$('.screen').forEach(s => s.classList.toggle('on', s.id === id)); window.scrollTo(0, 0); }
  function toast(t) { alert(t); }

  /* ---------- Töne ---------- */
  let ac = null;
  function tone(freqs, dur = .12) { if (!soundOn) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const t = ac.currentTime; freqs.forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t + i * dur); g.gain.exponentialRampToValueAtTime(.22, t + i * dur + .02); g.gain.exponentialRampToValueAtTime(.0001, t + i * dur + dur); o.connect(g); g.connect(ac.destination); o.start(t + i * dur); o.stop(t + i * dur + dur + .03); }); } catch (e) { } }
  const sfx = { ok: () => tone([660, 880, 1100]), bad: () => tone([240, 190], .18) };

  /* ---------- Sprachausgabe ---------- */
  const TTS = {
    voice: null, cancelCur: null, factor: store.get('tempo', 1.16),
    list() { return speechSynthesis.getVoices().filter(v => /^de([-_]|$)/i.test(v.lang)); },
    score(v) { const n = v.name + ' ' + v.lang; return (/natural|neural/i.test(n) ? 100 : 0) + (/online/i.test(n) ? 50 : 0) + (/google/i.test(n) ? 30 : 0) + (/de[-_]DE/i.test(v.lang) ? 10 : 0) - (/compact|espeak|hedda|hedda|stefan|katja(?!.*online)/i.test(n) && !/online|natural/i.test(n) ? 5 : 0); },
    load() { if (!('speechSynthesis' in window)) return; const p = () => { const de = this.list().sort((a, b) => this.score(b) - this.score(a)); const saved = store.get('voiceName', ''); this.voice = de.find(v => v.name === saved) || de[0] || null; fillVoices(de); }; p(); speechSynthesis.onvoiceschanged = p; },
    speak(text, rate = .95) {
      return new Promise(res => {
        if (!text || !('speechSynthesis' in window)) { res(); return; }
        let done = false; const fin = () => { if (done) return; done = true; clearTimeout(t); res(); };
        const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; if (this.voice) u.voice = this.voice; u.rate = Math.min(2, rate * this.factor); u.onend = fin; u.onerror = fin;
        const t = setTimeout(fin, 3000 + text.length * 140);
        try { speechSynthesis.cancel(); } catch (e) { }
        setTimeout(() => { try { speechSynthesis.speak(u); } catch (e) { fin(); } }, 40);
        this.cancelCur = fin;
      });
    },
    cancel() { try { speechSynthesis.cancel(); } catch (e) { } if (this.cancelCur) this.cancelCur(); }
  };
  const sayLa = (item, rate = .8) => TTS.speak(L.pron(item.la), rate);
  const sayDe = item => TTS.speak(L.deSpeak(item), .95);

  /* ---------- Spracherkennung ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const STT = {
    ok: !!SR, rec: null, denied: false,
    listen(ms = 9000) {
      return new Promise(res => {
        if (!SR || this.denied) { return; }          // ohne Mikrofon: nur Eingabe per Tipp/Tasten
        let done = false; const r = new SR(); r.lang = 'de-DE'; r.interimResults = false; r.maxAlternatives = 5; r.continuous = false;
        const fin = v => { if (done) return; done = true; clearTimeout(t); try { r.abort(); } catch (e) { } if (this.rec === r) this.rec = null; res(v); };
        r.onresult = e => { const alts = []; for (const rs of e.results) for (let i = 0; i < rs.length; i++) alts.push(rs[i].transcript); fin(alts); };
        r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { STT.denied = true; notice('Das Mikrofon ist nicht erlaubt. Du kannst unten eintippen. (Im Chrome beim Schloss-Symbol das Mikrofon erlauben.)'); } fin(null); };
        r.onend = () => fin(null);
        const t = setTimeout(() => fin(null), ms);
        try { r.start(); this.rec = r; } catch (e) { fin(null); }
      });
    },
    abort() { try { this.rec && this.rec.abort(); } catch (e) { } }
  };
  function notice(t) { const n = $('#sNotice'); n.textContent = t; n.style.display = t ? 'block' : 'none'; }

  /* ---------- Eingabe-Bus: Mikrofon, Tippen und Knöpfe laufen zusammen ---------- */
  const Bus = {
    pending: null, early: null, gate: false,
    wait(ms) {
      return new Promise(res => {
        if (this.early) { const e = this.early; this.early = null; res(e); return; }
        this.pending = res;
        STT.listen(ms).then(alts => { if (this.pending === res) { this.pending = null; res(alts ? { alts, src: 'voice' } : null); } });
        if (!SR || STT.denied) { /* wartet auf Tippen/Knöpfe */ }
      });
    },
    push(text, src = 'btn') {
      if (!this.gate) return;
      const m = { alts: [text], src };
      TTS.cancel(); STT.abort();
      if (this.pending) { const p = this.pending; this.pending = null; p(m); } else this.early = m;
    }
  };

  /* =====================================================================
     BILDMODUS
     ===================================================================== */
  const Vis = { items: [], queue: [], total: 0, done: 0, first: 0, missed: new Set(), cur: null, locked: false, lessons: [], order: 'seq' };
  let selected = new Set(store.get('selLessons', [1]));
  let visOrder = store.get('visOrder', 'seq');

  function buildChips() {
    const c = $('#chips'); c.innerHTML = '';
    LESSONS.forEach(n => { const b = document.createElement('button'); b.className = 'chip' + (selected.has(n) ? ' on' : ''); b.textContent = n; b.onclick = () => { selected.has(n) ? selected.delete(n) : selected.add(n); refreshSel(); }; c.appendChild(b); });
    refreshSel();
    $$('#orderSeg button').forEach(b => { b.classList.toggle('on', b.dataset.o === visOrder); b.onclick = () => { visOrder = b.dataset.o; store.set('visOrder', visOrder); buildChips(); }; });
  }
  function refreshSel() {
    $$('#chips .chip').forEach((b, i) => b.classList.toggle('on', selected.has(LESSONS[i])));
    const n = V.filter(v => selected.has(v.lesson)).length;
    $('#selInfo').textContent = n ? `${selected.size} Lektion(en) · ${n} Wörter` : 'Bitte mindestens eine Lektion wählen';
    $('#startVisual').disabled = !n;
    store.set('selLessons', [...selected]);
  }
  $('#selAll').onclick = () => { LESSONS.forEach(n => selected.add(n)); refreshSel(); };
  $('#selNone').onclick = () => { selected.clear(); refreshSel(); };
  $$('[data-upto]').forEach(b => b.onclick = () => { const n = +b.dataset.upto; selected = new Set(LESSONS.filter(l => l <= n)); refreshSel(); });
  $('#startVisual').onclick = () => startVisual(V.filter(v => selected.has(v.lesson)), visOrder);

  function startVisual(items, order) {
    Vis.items = items; Vis.order = order; Vis.queue = L.buildQueue(items, order); Vis.total = items.length; Vis.done = 0; Vis.first = 0; Vis.missed = new Set(); Vis.tried = new Set();
    show('vquiz'); nextCard();
  }
  function progress(bar, cnt, done, total) { $(bar).style.width = (total ? done / total * 100 : 0) + '%'; $(cnt).textContent = done + '/' + total; }
  function nextCard() {
    Vis.locked = false; $('#vFb').textContent = ''; $('#vFb').className = 'fb'; $('#vNext').style.display = 'none';
    progress('#vBar', '#vCnt', Vis.done, Vis.total);
    if (!Vis.queue.length) return endScreen('visual');
    const item = Vis.queue.shift(); Vis.cur = item;
    const dir = L.nextDir(memo, item.id); saveMemo(); Vis.dir = dir;
    let opts = L.makeOptions(item, dir, Vis.items); if (opts.length < 3) opts = L.makeOptions(item, dir, V);
    $('#vIcon').innerHTML = Ic.svg(item.icon);
    $('#vWord').textContent = dir === 'l2d' ? item.la : L.shortDe(item, 2);
    $('#vSmall').textContent = dir === 'l2d' ? 'Was heißt das auf Deutsch?' : 'Wie heißt das auf Latein?';
    const o = $('#vOpts'); o.innerHTML = '';
    opts.forEach(op => { const b = document.createElement('button'); b.className = 'opt'; b.textContent = op.text; b.onclick = () => choose(b, op); o.appendChild(b); });
    Vis.opts = opts;
    if (dir === 'l2d') sayLa(item);
  }
  function choose(btn, op) {
    if (Vis.locked) return; Vis.locked = true;
    const item = Vis.cur, fb = $('#vFb'), btns = $$('#vOpts .opt');
    const pair = `${item.la} = ${L.deVariantsRaw(item.de).slice(0, 2).join(', ')}`;
    if (Vis.dir === 'd2l') TTS.speak(L.pron(op.item.la), .8);
    if (op.ok) {
      btn.classList.add('ok'); btns.forEach(b => { if (b !== btn) b.classList.add('dim'); }); sfx.ok();
      fb.className = 'fb ok'; fb.innerHTML = `${pick(['Super!', 'Richtig!', 'Genau!', 'Sehr gut!', 'Stark!'])}<small>${pair}</small>`;
      if (!Vis.tried.has(item.id)) Vis.first++; Vis.done++; progress('#vBar', '#vCnt', Vis.done, Vis.total);
      const after = Vis.dir === 'l2d' ? sayLa(item) : sleep(1000);
      Promise.resolve(after).then(() => sleep(500)).then(() => { if ($('#vquiz').classList.contains('on') && Vis.cur === item) nextCard(); });
    } else {
      btn.classList.add('bad'); btns.forEach(b => { if (b.textContent === (Vis.opts.find(x => x.ok).text)) b.classList.add('ok'); else if (b !== btn) b.classList.add('dim'); }); sfx.bad();
      fb.className = 'fb bad'; fb.innerHTML = `Nicht ganz.<small>${pair}</small>`;
      Vis.tried.add(item.id); Vis.missed.add(item.id); L.requeue(Vis.queue, item);
      setTimeout(() => sayLa(item), 600);
      $('#vNext').style.display = 'block';
    }
  }
  $('#vNext').onclick = () => { TTS.cancel(); nextCard(); };
  $('#vSpk').onclick = () => { if (Vis.cur) sayLa(Vis.cur); };
  $('#vClose').onclick = () => { TTS.cancel(); show('home'); };
  $('#vSound').onclick = () => { soundOn = !soundOn; store.set('soundOn', soundOn); $('#vSound').textContent = soundOn ? '🔊' : '🔇'; };
  $('#vSound').textContent = soundOn ? '🔊' : '🔇';

  /* =====================================================================
     SPRACHMODUS
     ===================================================================== */
  const Sp = { run: 0, active: false, paused: null, wake: null, lastItems: null, order: 'seq' };
  const alive = id => Sp.active && Sp.run === id;
  const PRAISE = ['Richtig!', 'Genau!', 'Super!', 'Sehr gut!', 'Stimmt!', 'Prima!', 'Das war richtig!'];
  const WRONG = ['Nicht ganz. Versuch es noch einmal.', 'Fast! Probier es noch mal.', 'Das war leider nicht richtig. Noch ein Versuch.'];

  const ui = {
    status(s) { const m = $('#mic'); m.className = 'mic ' + (s === 'listening' ? 'listening' : s === 'speaking' ? 'speaking' : ''); m.textContent = s === 'speaking' ? '🔊' : '🎤'; $('#sState').textContent = { listening: 'Ich höre zu …', speaking: 'Ich spreche …', idle: ' ', paused: 'Pause' }[s] || ' '; },
    prompt(t) { $('#sPrompt').textContent = t || ''; }, hint(t) { $('#sHint').textContent = t || ''; }, cap(t) { $('#sCap').textContent = t || ''; }, heard(t) { $('#sHeard').textContent = t ? '„' + t + '“' : ''; },
    pic(item) { $('#sPic').innerHTML = item ? Ic.svg(item.icon) : ''; },
    buttons(on) { ['#bHint', '#bRepeat', '#bGive'].forEach(s => $(s).disabled = !on); }
  };
  async function say(id, text, rate) { if (!alive(id)) return; ui.cap(text); ui.status('speaking'); await TTS.speak(text, rate); if (alive(id)) ui.status('idle'); }
  async function listenFor(id, ms = 9000) {
    if (!alive(id)) return null;
    await sleep(250); if (!alive(id)) return null;
    ui.status('listening'); const r = await Bus.wait(ms); ui.status('idle');
    if (r && r.alts && r.alts[0]) ui.heard(r.alts[0]); else ui.heard('');
    return alive(id) ? r : null;
  }
  // Spricht und hört gleichzeitig zu: man darf schon während der Frage antworten.
  // Das eigene Echo (Wörter, die sie gerade selbst sagt) wird ignoriert.
  async function sayListen(id, text, ms = 9000) {
    if (!alive(id)) return null;
    ui.cap(text); ui.status('speaking'); let speaking = true, tEnd = 0, extra = 0;
    TTS.speak(text).then(() => { speaking = false; tEnd = Date.now(); if (alive(id)) ui.status('listening'); });
    const spoken = new Set(L.deNorm(text).split(/\s+/).filter(Boolean));
    while (alive(id)) {
      const r = await Bus.wait(speaking ? 15000 : ms);
      if (!alive(id)) return null;
      if (!r) { if (speaking) { await sleep(300); continue; } if (extra++ < 1 && Date.now() - tEnd < 4000) continue; ui.status('idle'); return null; }
      const echo = speaking && r.src === 'voice' && r.alts.every(a => L.deNorm(a).split(/\s+/).filter(Boolean).every(w => spoken.has(w)));
      if (echo) continue;
      TTS.cancel(); ui.status('idle'); ui.heard(r.alts[0] || ''); return r;
    }
    return null;
  }
  const firstParse = (alts, fn) => { for (const a of alts) { const v = fn(a); if (v) return v; } return null; };

  async function startVoice() {
    show('voice'); Sp.active = true; const id = ++Sp.run;
    $('#sBar').style.width = '0'; $('#sCnt').textContent = ''; ui.prompt(''); ui.hint(''); ui.pic(null); ui.heard(''); ui.cap(''); ui.buttons(false); notice('');
    if (!SR) notice('Dieses Gerät kann im Browser nicht zuhören. Bitte in Chrome auf Android öffnen. Du kannst hier unten eintippen.');
    try { Sp.wake = await navigator.wakeLock.request('screen'); } catch (e) { }
    Bus.gate = true; Bus.early = null;
    try {
      const setup = await setupDialog(id); if (!alive(id) || !setup) return;
      await quiz(id, setup.items, setup.order);
    } finally { if (Sp.run === id) { Bus.gate = false; try { Sp.wake && Sp.wake.release(); } catch (e) { } } }
  }
  function stopVoice() { Sp.active = false; Sp.run++; Bus.gate = false; Bus.pending = null; Bus.early = null; TTS.cancel(); STT.abort(); try { Sp.wake && Sp.wake.release(); } catch (e) { } }

  async function setupDialog(id) {
    Bus.gate = true; Bus.early = null;
    let lessons = null, misses = 0, r = await sayListen(id, 'Hallo! Welche Lektionen möchtest du lernen?');
    while (alive(id) && !lessons) {
      if (!alive(id)) return null;
      if (!r) { misses++; r = await sayListen(id, misses < 2 ? 'Welche Lektionen möchtest du lernen?' : 'Welche Lektionen? Du kannst die Zahlen auch unten eintippen.'); continue; }
      if (L.parseCommand(r.alts.join(' ')) === 'stop') return null;
      lessons = firstParse(r.alts, t => L.parseLessons(t));
      if (!lessons) r = await sayListen(id, 'Das habe ich nicht verstanden. Welche Lektionen möchtest du lernen?');
    }
    if (!alive(id) || !lessons) return null;
    const desc = L.describeLessons(lessons);
    ui.prompt(desc);
    let order = 'seq';
    if (lessons.length > 1) {
      await say(id, `${desc}. Nacheinander oder gemischt?`);
      order = null; misses = 0;
      while (alive(id) && !order) {
        const o = await listenFor(id);
        if (!alive(id)) return null;
        if (!o) { misses++; await say(id, misses < 2 ? 'Nacheinander oder gemischt?' : 'Nacheinander oder gemischt? Du kannst auch unten eintippen.'); continue; }
        if (L.parseCommand(o.alts.join(' ')) === 'stop') return null;
        order = firstParse(o.alts, t => L.parseOrder(t));
        if (!order) await say(id, 'Das habe ich nicht verstanden. Nacheinander oder gemischt?');
      }
    } else await say(id, `${desc}.`);
    if (!alive(id)) return null;
    const items = V.filter(v => lessons.includes(v.lesson));
    ui.prompt('');
    await say(id, "Los geht's!");
    return { items, order };
  }

  async function quiz(id, items, order) {
    Sp.lastItems = items; Sp.items = items; Sp.order = order; Bus.gate = true;
    const queue = L.buildQueue(items, order), total = items.length; let done = 0, first = 0; const missed = new Set(); const tried = new Set(); let lastLesson = null, userStop = false;
    ui.buttons(true);
    while (queue.length && alive(id)) {
      $('#sBar').style.width = (done / total * 100) + '%'; $('#sCnt').textContent = done + '/' + total;
      const item = queue.shift();
      if (order === 'seq' && item.lesson !== lastLesson) { lastLesson = item.lesson; ui.prompt(''); await say(id, 'Lektion ' + item.lesson + '.'); if (!alive(id)) break; }
      const dir = L.nextDir(memo, item.id); saveMemo();
      const res = await askWord(id, item, dir);
      if (res === 'stop') { userStop = alive(id); break; }
      if (!alive(id)) break;
      if (res === 'first') { if (!tried.has(item.id)) first++; done++; }
      else if (res === 'later') { tried.add(item.id); missed.add(item.id); done++; }
      else { tried.add(item.id); missed.add(item.id); L.requeue(queue, item); }
    }
    ui.buttons(false); Bus.gate = false;
    if (alive(id) || userStop) {
      $('#sBar').style.width = (done / total * 100) + '%'; $('#sCnt').textContent = done + '/' + total;
      const msg = userStop ? 'Okay, wir machen Schluss. Das war schon gut!' : `Geschafft! Du hast ${total} Wörter geübt. ${first} davon hast du gleich beim ersten Mal gewusst.${missed.size ? ' Die anderen üben wir bald wieder.' : ' Wow, alles auf Anhieb!'}`;
      Sp.active = false; Sp.missed = items.filter(i => missed.has(i.id));
      endScreenData('voice', userStop ? done : total, first, Sp.missed);
      await TTS.speak(msg, .95);
    }
  }

  async function askWord(id, item, dir) {
    Sp.cur = { item, dir };
    ui.pic(null); ui.hint(''); ui.heard('');
    ui.prompt(dir === 'l2d' ? item.la : L.shortDe(item, 2));
    ui.cap(dir === 'l2d' ? 'Was heißt das auf Deutsch?' : 'Wie heißt das auf Latein?');
    Bus.gate = true; Bus.early = null;
    const sayQ = () => dir === 'l2d' ? sayLa(item, .8) : TTS.speak(L.deSpeak(item), .95);
    ui.status('speaking'); await sayQ(); ui.status('idle');
    let attempts = 0, hints = 0, silent = 0;
    for (; ;) {
      if (!alive(id)) return 'stop';
      const r = await listenFor(id, 9000);
      if (!alive(id)) return 'stop';
      if (!r) { silent++; if (silent === 2) await say(id, 'Ich habe nichts gehört. Sag die Übersetzung, oder sag Tipp.'); if (silent >= 5) { await pauseWait(id); silent = 0; } continue; }
      silent = 0;
      const alts = r.alts, cmds = alts.map(L.parseCommand).filter(Boolean);
      if (cmds.includes('stop')) return 'stop';
      const correct = dir === 'l2d' ? L.matchGerman(alts, item) : L.matchLatin(alts, item, V, Sp.items);
      if (cmds.includes('giveup') && !correct) { await reveal(id, item); return 'wrong'; }
      if (correct) {
        Bus.gate = false; ui.pic(item); ui.hint('');
        ui.cap(`${item.la} = ${L.deVariantsRaw(item.de).slice(0, 2).join(', ')}`); sfx.ok();
        await TTS.speak(pick(PRAISE) + (dir === 'd2l' ? ' ' + L.pron(item.la) + '.' : ''), .95); await sleep(250);
        return attempts || hints ? 'later' : 'first';
      }
      if (cmds.includes('hint')) { hints++; const h = L.hint(item, dir, hints); ui.hint(h.shown); await say(id, h.said); continue; }
      if (cmds.includes('repeat')) { ui.status('speaking'); await sayQ(); ui.status('idle'); continue; }
      attempts++; sfx.bad();
      if (attempts >= 3) { await reveal(id, item); return 'wrong'; }
      await say(id, pick(WRONG));
    }
  }
  async function reveal(id, item) {
    Bus.gate = false; ui.pic(item); ui.hint('');
    ui.prompt(item.la); ui.cap(`${item.la} = ${L.deVariantsRaw(item.de).slice(0, 2).join(', ')}`);
    ui.status('speaking');
    await TTS.speak('Das merken wir uns.', .95);
    for (let i = 0; i < 2; i++) { if (!alive(id)) return; await sayLa(item, .8); await sleep(150); await sayDe(item); await sleep(350); }
    ui.status('idle');
  }
  function pauseWait(id) {
    return new Promise(res => { ui.status('paused'); $('#pause').classList.add('on'); Sp.paused = () => { $('#pause').classList.remove('on'); Sp.paused = null; res(); }; });
  }
  $('#resume').onclick = () => { if (Sp.paused) Sp.paused(); };

  // Knöpfe + Tippen
  $('#bHint').onclick = () => Bus.push('tipp'); $('#bGive').onclick = () => Bus.push('weiß ich nicht'); $('#bRepeat').onclick = () => Bus.push('nochmal');
  $('#typeForm').onsubmit = e => { e.preventDefault(); const v = $('#typeIn').value.trim(); if (!v) return; $('#typeIn').value = ''; ui.heard(v); Bus.push(v, 'type'); };
  $('#sClose').onclick = () => { stopVoice(); show('home'); };

  /* ---------- Ende ---------- */
  let lastRun = null;
  function endScreenData(kind, total, first, missedItems) {
    lastRun = { kind, total, first, missed: missedItems, items: kind === 'voice' ? Sp.lastItems : Vis.items, order: kind === 'voice' ? Sp.order : Vis.order };
    const pct = total ? first / total : 0;
    $('#eStars').textContent = pct >= .9 ? '⭐⭐⭐' : pct >= .6 ? '⭐⭐' : '⭐';
    $('#eMain').textContent = `${first} von ${total} gleich richtig`;
    $('#eSub').textContent = missedItems.length ? `${missedItems.length} Wörter üben wir noch.` : 'Alles auf Anhieb – klasse!';
    $('#eMiss').style.display = missedItems.length ? 'block' : 'none';
    show('end');
  }
  function endScreen(kind) { endScreenData(kind, Vis.total, Vis.first, Vis.items.filter(i => Vis.missed.has(i.id))); }
  $('#eAgain').onclick = () => { if (!lastRun) return show('home'); if (lastRun.kind === 'visual') startVisual(lastRun.items, lastRun.order); else startVoice(); };
  $('#eMiss').onclick = () => { if (!lastRun) return; if (lastRun.kind === 'visual') startVisual(lastRun.missed, 'mix'); else startVoiceWith(lastRun.missed); };
  async function startVoiceWith(items) {
    show('voice'); Sp.active = true; const id = ++Sp.run; ui.prompt(''); ui.hint(''); ui.pic(null); ui.heard(''); ui.cap(''); Bus.gate = true;
    try { await say(id, 'Los geht\'s! Wir üben die Wörter, die noch nicht so gut geklappt haben.'); if (alive(id)) await quiz(id, items, 'mix'); } finally { if (Sp.run === id) Bus.gate = false; }
  }
  $$('[data-home]').forEach(b => b.onclick = () => { stopVoice(); TTS.cancel(); show('home'); });

  /* ---------- Start ---------- */
  $('#goVoice').onclick = () => { TTS.speak(''); startVoice(); };
  $('#goVisual').onclick = () => { buildChips(); show('vsetup'); };
  function fillVoices(de) { const sel = $('#voiceSel'); if (!sel) return; sel.innerHTML = ''; de.forEach(v => { const o = document.createElement('option'); o.value = v.name; o.textContent = v.name.replace(/^Microsoft |^Google /, m => m) + (/natural|neural|online/i.test(v.name) ? ' ★' : ''); if (TTS.voice && TTS.voice.name === v.name) o.selected = true; sel.appendChild(o); }); }
  $('#voiceSel').addEventListener('change', e => { store.set('voiceName', e.target.value); TTS.voice = TTS.list().find(v => v.name === e.target.value) || TTS.voice; TTS.speak('Ich spreche so: wikus, amare, puella.', 1); });
  $('#tempoSel').value = String(TTS.factor); if ($('#tempoSel').value !== String(TTS.factor)) $('#tempoSel').value = '1.16';
  $('#tempoSel').addEventListener('change', e => { TTS.factor = parseFloat(e.target.value); store.set('tempo', TTS.factor); TTS.speak('Ich spreche jetzt so schnell.', .95); });
  $('#footInfo').textContent = `${V.length} Wörter · Lektion ${LESSONS[0]}–${LESSONS[LESSONS.length - 1]}`;
  if (!SR) $('#noSR').style.display = 'block';
  TTS.load(); buildChips();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  window.__latein = { Bus, STT, TTS, Sp, startVoice, startVisual, memo, L, V };
})();
