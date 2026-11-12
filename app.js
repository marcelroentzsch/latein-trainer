(function () {
  'use strict';
  const VERSION = '2.0';
  const L = window.Logic, V = window.VOCAB, Ic = window.Icons, Gem = window.Gem;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const LESSONS = [...new Set(V.map(v => v.lesson))].sort((a, b) => a - b);
  const byId = {}; V.forEach(v => byId[v.id] = v);
  const DAY = 864e5;

  /* ---------- Fortschritt (Lernkartei) ---------- */
  let P; try { P = JSON.parse(localStorage.getItem('lt2')) || {}; } catch (e) { P = {}; }
  P.w = P.w || {}; P.xp = P.xp || 0; P.streak = P.streak || 0; P.memo = P.memo || {};
  const save = () => { try { localStorage.setItem('lt2', JSON.stringify(P)); } catch (e) { } };
  const W = id => P.w[id] || { b: 0, due: 0 };
  const GAP = [0, 0, 1, 3, 7, 21];
  function grade(id, ok) { const w = W(id); w.b = ok ? Math.min(5, w.b + 1) : 1; w.due = Date.now() + GAP[w.b] * DAY; P.w[id] = w; }
  const dayKey = t => new Date(t).toDateString();
  function touchStreak() { const today = dayKey(Date.now()); if (P.day === today) return; P.streak = P.day === dayKey(Date.now() - DAY) ? P.streak + 1 : 1; P.day = today; }
  const mastery = n => { const it = V.filter(v => v.lesson === n); return Math.round(it.reduce((s, v) => s + Math.min(W(v.id).b, 4) / 4, 0) / it.length * 100); };
  const dueWords = () => V.filter(v => W(v.id).b > 0 && W(v.id).due <= Date.now()).sort((a, b) => W(a.id).due - W(b.id).due);

  function show(id) { $$('.screen').forEach(s => s.classList.toggle('on', s.id === id)); window.scrollTo(0, 0); }

  /* ---------- Töne und Stimme ---------- */
  let ac = null;
  function tone(freqs, dur = .12) { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const t = ac.currentTime; freqs.forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.setValueAtTime(.12, t + i * dur); g.gain.exponentialRampToValueAtTime(.001, t + (i + 1) * dur); o.connect(g); g.connect(ac.destination); o.start(t + i * dur); o.stop(t + (i + 1) * dur); }); } catch (e) { } }
  const sfx = { ok: () => tone([660, 880, 1100]), bad: () => tone([240, 190], .18) };
  function browserSay(text) { try { const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; const v = speechSynthesis.getVoices().filter(x => /^de/i.test(x.lang)); const best = v.find(x => /natural|online/i.test(x.name)) || v.find(x => /google/i.test(x.name)) || v[0]; if (best) u.voice = best; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { } }
  const clipItems = items => items.map(i => ({ id: String(i.id), text: Gem.laText(L.latForms(i.la)[0]) }));
  const preload = lesson => Gem.loadLesson(lesson, clipItems(V.filter(v => v.lesson === lesson)));
  async function sayLa(item) { let ok = false; try { ok = await Gem.playClip(String(item.id)); } catch (e) { } if (!ok) { browserSay(L.pron(item.la)); if (Gem.hasKey()) preload(item.lesson); } }

  /* =====================================================================
     START
     ===================================================================== */
  function renderHome() {
    $('#stStreak').textContent = '🔥 ' + (P.day === dayKey(Date.now()) || P.day === dayKey(Date.now() - DAY) ? P.streak : 0);
    $('#stXp').textContent = '⭐ ' + P.xp;
    const due = dueWords().length; $('#revInfo').textContent = due ? due + ' Wörter sind heute dran' : 'Gerade ist nichts fällig';
    const g = $('#grid'); g.innerHTML = '';
    LESSONS.forEach(n => { const m = mastery(n), cnt = V.filter(v => v.lesson === n).length; const b = el('button', 'lcard', `<span class="ring" style="--p:${m}"><span>${n}</span></span><div><b>Lektion ${n}</b><small>${m >= 95 ? '⭐⭐⭐' : m >= 70 ? '⭐⭐' : m >= 40 ? '⭐' : cnt + ' Wörter'}</small></div>`); b.onclick = () => openSheet(n); g.appendChild(b); });
    $('#ver').textContent = `Version ${VERSION} · ${V.length} Wörter`;
    show('home');
  }
  let sheetLesson = 1;
  function openSheet(n) {
    sheetLesson = n; const items = V.filter(v => v.lesson === n);
    $('#shT').textContent = 'Lektion ' + n; $('#shInfo').textContent = `${items.length} Wörter · ${mastery(n)} % gelernt`;
    const ul = $('#shList'); ul.innerHTML = '';
    items.forEach(it => { const li = el('li', '', `<span class="ic">${Ic.svg(it.icon)}</span><div><b>${esc(it.la)}</b><small>${esc(it.de)}</small></div>`); const b = el('button', '', '🔊'); b.onclick = () => sayLa(it); li.appendChild(b); ul.appendChild(li); });
    $('#sheet').classList.add('on'); if (Gem.hasKey()) preload(n);
  }
  const closeSheet = () => $('#sheet').classList.remove('on');
  $('#shX').onclick = closeSheet; $('#sheet').onclick = e => { if (e.target.id === 'sheet') closeSheet(); };
  $('#shLearn').onclick = () => { closeSheet(); startLearn(sheetLesson); };
  $('#shTalk').onclick = () => { closeSheet(); startTalk([sheetLesson]); };
  $('#goRev').onclick = () => { if (dueWords().length) startLearn(null); };
  $('#goTalk').onclick = () => startTalk(null);
  $('#goSet').onclick = () => openSettings();

  /* =====================================================================
     LERNEN (gemischte Übungen)
     ===================================================================== */
  const S = { steps: [], i: 0, words: [], wrong: new Set(), retried: new Set(), pool: [], cur: null, locked: false };
  const laFirst = it => L.latDisplayFirst(it.la);
  const buildable = it => { const w = laFirst(it); return w.length >= 3 && w.length <= 9 && !/[\s.…?!]/.test(w); };
  const picOk = it => !/^(txt|num):/.test(it.icon);
  function startLearn(lesson) {
    let words;
    if (lesson == null) words = dueWords().slice(0, 8);
    else { const items = V.filter(v => v.lesson === lesson), now = Date.now(); const due = items.filter(v => W(v.id).b > 0 && W(v.id).due <= now).sort((a, b) => W(a.id).b - W(b.id).b); const fresh = items.filter(v => W(v.id).b === 0); words = due.slice(0, 6).concat(fresh).slice(0, 6); if (words.length < 6) words = words.concat(items.filter(v => !words.includes(v)).sort((a, b) => W(a.id).b - W(b.id).b)).slice(0, 6); if (Gem.hasKey()) preload(lesson); }
    const lessons = new Set(words.map(w => w.lesson)); S.pool = V.filter(v => lessons.has(v.lesson)); if (S.pool.length < 6) S.pool = V;
    const steps = [];
    for (let c = 0; c < words.length; c += 3) { const ch = words.slice(c, c + 3); ch.filter(w => W(w.id).b === 0).forEach(w => steps.push({ type: 'intro', w })); L.shuffle(ch).forEach(w => steps.push({ type: picOk(w) && Math.random() < .4 ? 'pic' : 'mc_l2d', w })); }
    if (words.length >= 4) steps.push({ type: 'pairs', ws: L.shuffle(words).slice(0, 4) });
    L.shuffle(words).forEach(w => { const t = pick(['mc_d2l', 'listen', 'build']); steps.push({ type: t === 'build' && !buildable(w) ? 'mc_d2l' : t, w }); });
    S.steps = steps; S.i = 0; S.words = words; S.wrong = new Set(); S.retried = new Set();
    show('learn'); renderStep();
  }
  function renderStep() {
    S.locked = false; $('#fbar').className = 'fbar'; $('#lBar').style.width = (S.i / S.steps.length * 100) + '%';
    if (S.i >= S.steps.length) return finishLearn();
    const st = S.cur = S.steps[S.i], ex = $('#ex'); ex.innerHTML = '';
    const head = t => ex.appendChild(el('div', 'task', t));
    const card = (it, o = {}) => { const c = el('div', 'qcard', (o.noPic ? '' : `<div class="ico">${Ic.svg(it.icon)}</div>`) + `<div class="qword">${esc(o.word)}</div>` + (o.sub ? `<div class="qsub">${esc(o.sub)}</div>` : '')); if (o.speak) { const b = el('button', 'spk', '🔊 Anhören'); b.onclick = () => sayLa(it); c.appendChild(b); } ex.appendChild(c); return c; };
    const options = (opts, cls) => { const box = el('div', 'opts ' + (cls || '')); opts.forEach(o => { const b = el('button', 'opt', o.html || esc(o.text)); b.dataset.ok = o.ok ? '1' : ''; b.onclick = () => { if (S.locked) return; if (st.type === 'mc_d2l' && !o.ok) sayLa(o.item); box.querySelectorAll('.opt').forEach(x => x.classList.add(x.dataset.ok ? 'ok' : x === b ? 'bad' : 'dim')); answer(o.ok, st.w); }; box.appendChild(b); }); ex.appendChild(box); };
    const mk = dir => { let o = L.makeOptions(st.w, dir, S.pool); if (o.length < 3) o = L.makeOptions(st.w, dir, V); return o; };
    if (st.type === 'intro') { head('Neues Wort'); card(st.w, { word: st.w.la, sub: st.w.de, speak: true }); sayLa(st.w); const b = el('button', 'btn', 'Weiter'); b.onclick = () => { S.i++; renderStep(); }; ex.appendChild(b); }
    else if (st.type === 'mc_l2d') { head('Was heißt das auf Deutsch?'); card(st.w, { word: st.w.la, speak: true }); sayLa(st.w); options(mk('l2d')); }
    else if (st.type === 'mc_d2l') { head('Wie heißt das auf Latein?'); card(st.w, { word: L.shortDe(st.w, 2) }); options(mk('d2l')); }
    else if (st.type === 'listen') { head('Was hörst du?'); const b = el('button', 'spk big', '🔊'); b.onclick = () => sayLa(st.w); ex.appendChild(b); sayLa(st.w); options(mk('l2d')); }
    else if (st.type === 'pic') { head('Welches Bild passt?'); card(st.w, { word: st.w.la, speak: true, noPic: true }); sayLa(st.w); const others = L.shuffle(S.pool.filter(o => o.id !== st.w.id && picOk(o) && o.icon !== st.w.icon)).filter((o, i, a) => a.findIndex(x => x.icon === o.icon) === i).slice(0, 2); options(L.shuffle([{ item: st.w, ok: true }].concat(others.map(o => ({ item: o, ok: false })))).map(o => Object.assign(o, { html: Ic.svg(o.item.icon) })), 'pics'); }
    else if (st.type === 'pairs') renderPairs(st, ex, head);
    else if (st.type === 'build') renderBuild(st, ex, head, card);
  }
  function renderPairs(st, ex, head) {
    head('Finde die Paare'); const box = el('div', 'opts pairs'); let sel = null, left = st.ws.length, miss = false;
    const A = L.shuffle(st.ws).map(w => ({ w, side: 'la', text: laFirst(w) })), B = L.shuffle(st.ws).map(w => ({ w, side: 'de', text: L.shortDe(w, 1) }));
    A.forEach((a, i) => [a, B[i]].forEach(c => { const b = el('button', 'opt', esc(c.text)); b.dataset.id = c.w.id; b.dataset.side = c.side; b.onclick = () => {
      if (b.classList.contains('ok') || S.locked) return; if (c.side === 'la') sayLa(c.w);
      if (!sel || sel.c.side === c.side) { if (sel) sel.b.classList.remove('sel'); sel = { b, c }; b.classList.add('sel'); return; }
      const o = sel; sel = null; o.b.classList.remove('sel');
      if (o.c.w.id === c.w.id) { [b, o.b].forEach(x => x.classList.add('ok')); sfx.ok(); if (--left === 0) { S.locked = true; setTimeout(() => { S.i++; renderStep(); }, 600); } }
      else { miss = true; S.wrong.add(c.w.id); S.wrong.add(o.c.w.id); [b, o.b].forEach(x => x.classList.add('bad')); sfx.bad(); setTimeout(() => [b, o.b].forEach(x => x.classList.remove('bad')), 500); }
    }; box.appendChild(b); })); ex.appendChild(box);
  }
  function renderBuild(st, ex, head, card) {
    head('Setze das lateinische Wort zusammen'); card(st.w, { word: L.shortDe(st.w, 2) });
    const target = laFirst(st.w), slots = el('div', 'slots'), tiles = el('div', 'tiles'); let cur = [];
    const check = () => { if (cur.length < [...target].length) return; const ok = cur.map(x => x.ch).join('') === target; S.locked = true; answer(ok, st.w); };
    L.shuffle([...target].map(ch => ({ ch }))).forEach(t => { const b = el('button', 'tile', esc(t.ch)); t.b = b; b.onclick = () => { if (S.locked) return; b.classList.add('used'); const s = el('button', 'tile', esc(t.ch)); t.s = s; cur.push(t); s.onclick = () => { if (S.locked) return; cur = cur.filter(x => x !== t); s.remove(); b.classList.remove('used'); }; slots.appendChild(s); check(); }; tiles.appendChild(b); });
    ex.appendChild(slots); ex.appendChild(tiles);
  }
  function answer(ok, w) {
    S.locked = true; const fb = $('#fbar'), pair = `${w.la} = ${L.deVariantsRaw(w.de).slice(0, 2).join(', ')}`;
    if (ok) { sfx.ok(); fb.className = 'fbar ok'; $('#fbT').textContent = pick(['Super!', 'Richtig!', 'Genau!', 'Sehr gut!', 'Stark!']); }
    else { sfx.bad(); fb.className = 'fbar bad'; $('#fbT').textContent = 'Nicht ganz'; S.wrong.add(w.id); if (!S.retried.has(w.id)) { S.retried.add(w.id); S.steps.push({ type: 'mc_l2d', w }); } setTimeout(() => sayLa(w), 500); }
    $('#fbS').textContent = pair; fb.scrollIntoView({ block: 'end' });
  }
  $('#fbNext').onclick = () => { S.i++; renderStep(); };
  $('#lClose').onclick = () => { Gem.stopAudio(); renderHome(); };
  function finishLearn() {
    const n = S.words.length, good = S.words.filter(w => !S.wrong.has(w.id)).length;
    S.words.forEach(w => grade(w.id, !S.wrong.has(w.id))); const xp = n * 5 + good * 5; P.xp += xp; touchStreak(); save();
    endScreen(good, n, `+${xp} ⭐ · Serie: ${P.streak} ${P.streak === 1 ? 'Tag' : 'Tage'}`);
  }
  function endScreen(good, n, sub) { const r = n ? good / n : 0; $('#eStars').textContent = r >= .9 ? '⭐⭐⭐' : r >= .6 ? '⭐⭐' : '⭐'; $('#eMain').textContent = `${good} von ${n} gleich richtig`; $('#eSub').textContent = sub; show('end'); tone([523, 659, 784, 1047], .14); }
  $('#eHome').onclick = renderHome;

  /* =====================================================================
     SPRECH-TRAINING (Gemini Live)
     ===================================================================== */
  const SYSTEM = `Du bist Lena, eine freundliche, geduldige Lernhelferin. Du übst mit einem Kind (5. Klasse Gymnasium) lateinische Vokabeln im Gespräch.

SPRACHE
- Sprich immer Deutsch. ANTWORTE UNMISSVERSTÄNDLICH AUF DEUTSCH.
- Lateinische Wörter sprichst du in deutscher Schulaussprache: c immer wie k, v wie deutsches w, qu wie kw, Vokale mit Strich (ā ē ī ō ū) lang, Betonung nach der lateinischen Regel.
- Fasse dich sehr kurz: höchstens ein kurzer Satz. Keine Erklärungen, kein Smalltalk.

ABLAUF
1. Zu Beginn sagst du nur: "Hallo! Welche Lektionen möchtest du lernen?"
2. Sobald das Kind Lektionen nennt, rufst du lektionen_waehlen auf. Frage nicht nach, ob das stimmt.
3. Danach tust du immer genau das, was in der Werkzeug-Antwort unter "anweisung" steht.
4. In der Abfrage bekommst du immer genau eine Frage. Du sprichst nur das, was unter "sage" steht, und wartest dann still auf die Antwort des Kindes.
5. Nach JEDER Äußerung des Kindes in der Abfrage rufst du antwort_melden auf. Erst die Werkzeug-Antwort sagt dir, was du als Nächstes sagst.

BEWERTUNG für antwort_melden
- "richtig": Das Kind hat eine der "richtige_antworten" gesagt, auch in einem ganzen Satz. Artikel dürfen fehlen. Bei lateinischen Antworten sind kleine Ausspracheunterschiede eines Kindes in Ordnung.
- "falsch": Das Kind hat etwas anderes geantwortet.
- "tipp": Das Kind möchte einen Tipp oder Hilfe.
- "weiss_nicht": Das Kind weiß es nicht oder möchte die Lösung hören.
- "nochmal": Das Kind möchte das Wort noch einmal hören.
- "stopp": Das Kind möchte aufhören.
Wenn du nichts Verständliches hörst, rufst du nichts auf und wartest.

VERBOTEN
- Verrate nie selbst die Lösung. Du sagst sie nur, wenn die Werkzeug-Antwort es aufträgt.
- Denke dir nie selbst Vokabeln oder Fragen aus.`;
  const TOOLS = [{ functionDeclarations: [
    { name: 'lektionen_waehlen', behavior: 'BLOCKING', description: 'Aufrufen, sobald das Kind gesagt hat, welche Lektionen es lernen möchte.', parameters: { type: 'OBJECT', properties: { lektionen: { type: 'ARRAY', items: { type: 'INTEGER' }, description: 'Alle gewünschten Lektionsnummern von 1 bis 20. Beispiele: "eins bis vier" = [1,2,3,4]; "alles bis sieben" = [1,2,3,4,5,6,7]; "drei und fünf" = [3,5]; "alle" = 1 bis 20.' } }, required: ['lektionen'] } },
    { name: 'reihenfolge_waehlen', behavior: 'BLOCKING', description: 'Aufrufen, sobald das Kind gesagt hat, ob die Lektionen nacheinander oder gemischt abgefragt werden sollen.', parameters: { type: 'OBJECT', properties: { reihenfolge: { type: 'STRING', enum: ['nacheinander', 'gemischt'] } }, required: ['reihenfolge'] } },
    { name: 'antwort_melden', behavior: 'BLOCKING', description: 'In der Abfrage nach JEDER Äußerung des Kindes aufrufen.', parameters: { type: 'OBJECT', properties: { art: { type: 'STRING', enum: ['richtig', 'falsch', 'tipp', 'weiss_nicht', 'nochmal', 'stopp'] }, gehoert: { type: 'STRING', description: 'Was das Kind gesagt hat.' } }, required: ['art', 'gehoert'] } }] }];

  const T = { live: null, active: false };
  const tui = { state(t) { $('#tState').textContent = t; }, orb(c) { $('#orb').className = 'orb ' + c; $('#orb').textContent = c === 'speak' ? '🔊' : '🎤'; $('#orb').style.transform = ''; }, notice(t) { const n = $('#tNotice'); n.textContent = t || ''; n.style.display = t ? 'block' : 'none'; },
    prog() { $('#tBar').style.width = (T.total ? T.done / T.total * 100 : 0) + '%'; $('#tCnt').textContent = T.total ? T.done + '/' + T.total : ''; } };
  const sayText = it => Gem.laText(L.latForms(it.la)[0]);
  const question = () => { const it = T.cur, d = T.dir; return { nummer: T.done + 1, von: T.total, richtung: d === 'l2d' ? 'Latein → Deutsch' : 'Deutsch → Latein', sage: d === 'l2d' ? sayText(it) : (it.q || L.shortDe(it, 2)), richtige_antworten: d === 'l2d' ? L.deVariantsRaw(it.de).concat(it.alt || []) : L.latAccepted(it, V) }; };
  function tNext(pre) {
    $('#tHint').textContent = ''; $('#tPic').innerHTML = '';
    if (!T.queue.length) { T.ending = true; T.cur = null; $('#tPrompt').textContent = ''; tui.prog(); return { anweisung: `${pre} Sage dann: "Geschafft! Du hast ${T.total} Wörter geübt und ${T.first} davon gleich beim ersten Mal gewusst." Verabschiede dich kurz.`, ende: true }; }
    const it = T.cur = T.queue.shift(); T.dir = L.nextDir(P.memo, it.id); save(); T.hints = 0; T.wrong = 0;
    let p = pre; if (T.order === 'seq' && T.lessons.length > 1 && it.lesson !== T.lastLesson) p += ` Sage dann: "Lektion ${it.lesson}."`; T.lastLesson = it.lesson;
    const q = question(); $('#tPrompt').textContent = T.dir === 'l2d' ? it.la : q.sage; tui.prog();
    return { anweisung: `${p} Sage dann nur das Wort unter "sage" und warte auf die Antwort.`, frage: q };
  }
  function tReveal() {
    const it = T.cur; T.tried.add(it.id); T.missed.add(it.id); grade(it.id, false); save();
    T.reveals[it.id] = (T.reveals[it.id] || 0) + 1; if (T.reveals[it.id] < 2) L.requeue(T.queue, it); else T.done++;
    const de = L.deVariantsRaw(it.de).slice(0, 2).join(', ');
    const r = tNext(`Sage genau zweimal hintereinander: "${sayText(it)} – ${de}."`);
    $('#tPic').innerHTML = Ic.svg(it.icon); $('#tHint').textContent = `${it.la} = ${de}`; return r;
  }
  function tBegin(order, pre) { T.order = order; const items = V.filter(v => T.lessons.includes(v.lesson)); T.queue = L.buildQueue(items, order); T.total = items.length; T.done = 0; T.first = 0; T.lastLesson = T.lessons.length > 1 ? null : T.lessons[0]; return tNext(pre); }
  function onTool(name, a) {
    if (name === 'lektionen_waehlen') {
      const ls = [...new Set((a.lektionen || []).map(Number).filter(n => LESSONS.includes(n)))].sort((x, y) => x - y);
      if (!ls.length) return { anweisung: 'Sage, dass es die Lektionen 1 bis 20 gibt, und frage noch einmal, welche das Kind lernen möchte.' };
      T.lessons = ls; const d = L.describeLessons(ls); $('#tPrompt').textContent = d;
      return ls.length === 1 ? tBegin('seq', `Sage: "${d}. Los geht's!"`) : { anweisung: `Sage: "${d}. Nacheinander oder gemischt?" Rufe nach der Antwort des Kindes reihenfolge_waehlen auf.` };
    }
    if (name === 'reihenfolge_waehlen') { if (!T.lessons) return { anweisung: 'Frage zuerst, welche Lektionen das Kind lernen möchte.' }; if (T.cur) return { anweisung: 'Wiederhole die aktuelle Frage.', frage: question() }; return tBegin(a.reihenfolge === 'gemischt' ? 'mix' : 'seq', 'Sage: "Los geht\'s!"'); }
    if (T.ending) return { anweisung: 'Verabschiede dich kurz.', ende: true };
    if (!T.cur) return { anweisung: 'Frage, welche Lektionen das Kind lernen möchte, und rufe dann lektionen_waehlen auf.' };
    const it = T.cur;
    switch (a.art) {
      case 'richtig': if (!T.tried.has(it.id)) { T.first++; grade(it.id, true); P.xp += 2; } T.done++; save(); sfx.ok(); return tNext('Lobe mit ein bis zwei Wörtern.');
      case 'falsch': T.tried.add(it.id); T.wrong++; sfx.bad(); if (T.wrong >= 3) return tReveal(); return { anweisung: 'Sage kurz, dass das nicht stimmt und das Kind es noch einmal versuchen soll. Verrate die Lösung nicht. Warte dann auf die Antwort.' };
      case 'tipp': { T.tried.add(it.id); T.hints++; const h = L.hint(it, T.dir, T.hints); $('#tHint').textContent = h.shown; return { anweisung: `Sage genau: "${h.said}" Warte dann auf die Antwort. Wiederhole die Frage nicht.` }; }
      case 'weiss_nicht': return tReveal();
      case 'nochmal': return { anweisung: 'Sage noch einmal nur das Wort unter "sage" und warte auf die Antwort.', frage: question() };
      default: T.ending = true; return { anweisung: 'Verabschiede dich mit einem kurzen Satz.', ende: true };
    }
  }
  async function startTalk(pre) {
    show('talk'); tui.notice(''); $('#tPrompt').textContent = ''; $('#tHint').textContent = ''; $('#tPic').innerHTML = ''; $('#tCap').textContent = '';
    Object.assign(T, { active: true, lessons: null, cur: null, queue: [], total: 0, done: 0, first: 0, tried: new Set(), missed: new Set(), reveals: {}, ending: false, retries: 0, pre }); tui.prog();
    if (!Gem.hasKey()) { tui.orb(''); tui.state(''); tui.notice('Für das Sprech-Training fehlt noch der Gemini-Schlüssel. Bitte im Elternbereich (⚙️) eintragen.'); return; }
    Gem.ctx(); try { T.wake = await navigator.wakeLock.request('screen'); } catch (e) { }
    connect();
  }
  function connect() {
    tui.orb('wait'); tui.state('Verbinde …');
    const live = T.live = Gem.live({ system: SYSTEM, tools: TOOLS, onTool,
      onReady: async () => { if (T.live !== live) return; try { await live.startMic(); } catch (e) { tui.orb(''); tui.state(''); tui.notice('Das Mikrofon ist nicht erlaubt. Bitte im Browser beim Schloss-Symbol das Mikrofon erlauben.'); T.active = false; live.close(); return; }
        T.retries = 0; tui.orb('listen'); tui.state('Ich höre zu …');
        live.text(T.cur ? '(Die Verbindung war kurz unterbrochen. Rufe jetzt antwort_melden mit art "nochmal" auf.)' : T.pre ? `(Das Gespräch beginnt. Das Kind hat Lektion ${T.pre[0]} schon ausgewählt. Rufe jetzt lektionen_waehlen mit [${T.pre[0]}] auf und frage nichts.)` : '(Das Gespräch beginnt jetzt.)'); },
      onSpeak: on => { if (T.live !== live) return; tui.orb(on ? 'speak' : 'listen'); tui.state(on ? 'Lena spricht …' : 'Ich höre zu …'); },
      onLevel: v => { if (!live.speaking) $('#orb').style.transform = `scale(${1 + Math.min(.25, v * 4)})`; },
      onCaption: t => { $('#tCap').textContent = t; },
      onTurn: () => { if (T.live === live && T.ending) finishTalk(); },
      onClose: (code, reason) => { if (T.live !== live || !T.active) return; if (T.ending) return finishTalk(); if (T.retries++ < 3) { tui.state('Verbinde neu …'); setTimeout(() => { if (T.active && T.live === live) connect(); }, 800); } else { tui.orb(''); tui.state(''); tui.notice('Die Verbindung zu Gemini klappt gerade nicht' + (reason ? ' (' + reason.slice(0, 140) + ')' : '') + '. Bitte später noch einmal versuchen.'); } } });
  }
  function stopTalk() { T.active = false; const l = T.live; T.live = null; if (l) l.close(); Gem.stopAudio(); try { T.wake && T.wake.release(); } catch (e) { } }
  function finishTalk() { const had = T.total > 0; const good = T.first, n = T.done; stopTalk(); if (!had) return renderHome(); touchStreak(); save(); endScreen(good, n, T.missed.size ? `${T.missed.size} Wörter üben wir bald wieder.` : 'Alles auf Anhieb gewusst!'); }
  $('#tClose').onclick = () => { const had = T.done > 0; if (had) finishTalk(); else { stopTalk(); renderHome(); } };
  const sayAs = t => { if (T.live && T.cur) { Gem.stopAudio(); T.live.text(t); } };
  $('#bHint').onclick = () => sayAs('Gib mir einen Tipp.'); $('#bRepeat').onclick = () => sayAs('Sag das Wort bitte nochmal.'); $('#bGive').onclick = () => sayAs('Das weiß ich nicht.');
  document.addEventListener('visibilitychange', () => { if (document.hidden && T.active) { const had = T.done > 0; if (had) finishTalk(); else { stopTalk(); renderHome(); } } });

  /* =====================================================================
     ELTERNBEREICH
     ===================================================================== */
  async function clipInfo() { const have = await Gem.haveIds(); $('#sClips').textContent = `${have.size} von ${V.length} Wörtern sind mit dieser Stimme vertont. Fehlende Wörter spricht solange die Browser-Stimme.`; }
  function openSettings() { $('#sKey').value = Gem.key; const sv = $('#sVoice'); sv.innerHTML = ''; Gem.VOICES.forEach(([v, t]) => { const o = el('option', '', t); o.value = v; o.selected = v === Gem.voice; sv.appendChild(o); }); $('#sMsg').textContent = ''; clipInfo(); show('settings'); }
  const sMsg = (t, bad) => { $('#sMsg').textContent = t; $('#sMsg').style.color = bad ? 'var(--bad)' : 'var(--ok2)'; };
  $('#sBack').onclick = () => { Gem.setKey($('#sKey').value); renderHome(); };
  $('#sKey').onchange = () => Gem.setKey($('#sKey').value);
  $('#sVoice').onchange = () => { Gem.setVoice($('#sVoice').value); clipInfo(); };
  $('#sTest').onclick = async () => { Gem.setKey($('#sKey').value); if (!Gem.key) return sMsg('Bitte zuerst den Schlüssel eintragen.', true); sMsg('Teste …'); try { await Gem.test(); sMsg('Funktioniert!'); } catch (e) { sMsg('Fehler ' + e.message.slice(0, 120), true); } };
  $('#sProbe').onclick = async () => { Gem.setKey($('#sKey').value); if (!Gem.key) return sMsg('Bitte zuerst den Schlüssel eintragen.', true); sMsg('Lade Probe …'); try { Gem.ctx(); const pcm = await Gem.tts(['puella', 'vīkus', 'dolēre', 'agrikola'].join(' <long pause> '), Gem.STYLE); Gem.stopAudio(); Gem.queue(pcm); sMsg('puella, vīcus, dolēre, agricola'); } catch (e) { sMsg('Fehler ' + e.message.slice(0, 120), true); } };
  $('#sLoad').onclick = async () => { Gem.setKey($('#sKey').value); if (!Gem.key) return sMsg('Bitte zuerst den Schlüssel eintragen.', true); const b = $('#sLoad'); b.disabled = true; try { for (const n of LESSONS) { b.textContent = `Lade Lektion ${n} von ${LESSONS.length} …`; await preload(n); await clipInfo(); if (Gem.lastError) { sMsg('Fehler ' + Gem.lastError.slice(0, 120), true); Gem.lastError = ''; break; } } } finally { b.disabled = false; b.textContent = 'Alle Aufnahmen laden'; clipInfo(); } };
  $('#sReset').onclick = () => { if (confirm('Wirklich den gesamten Lernfortschritt löschen?')) { P = { w: {}, xp: 0, streak: 0, memo: {} }; save(); renderHome(); } };

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  window.__lt = { S, T, P: () => P, Gem, L, V, onTool, startLearn, startTalk, renderHome, grade, dueWords };
  renderHome();
})();
