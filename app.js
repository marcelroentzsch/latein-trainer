(function () {
  'use strict';
  const VERSION = '2.5';
  const L = window.Logic, V = window.VOCAB, Ic = window.Icons, Gem = window.Gem;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const LESSONS = [...new Set(V.map(v => v.lesson))].sort((a, b) => a - b);
  const MIN = 6e4, HOUR = 36e5, DAY = 864e5;

  /* ---------- Fortschritt (Lernkartei) ---------- */
  let P; try { P = JSON.parse(localStorage.getItem('lt2')) || {}; } catch (e) { P = {}; }
  P.w = P.w || {}; P.xp = P.xp || 0; P.streak = P.streak || 0; P.memo = P.memo || {};
  const save = () => { try { localStorage.setItem('lt2', JSON.stringify(P)); } catch (e) { } };
  const W = id => P.w[id] || { b: 0, due: 0 };
  // Gewusst: eine Stufe höher, Wiederholung nach 4 Stunden, 1, 3, 7, 21 Tagen. Nicht gewusst: zurück auf Stufe 1, nach 10 Minuten wieder dran.
  const GAP = [0, 4 * HOUR, DAY, 3 * DAY, 7 * DAY, 21 * DAY];
  function grade(id, ok) { const w = W(id); if (ok) { w.b = Math.min(5, w.b + 1); w.due = Date.now() + GAP[w.b]; } else { w.b = 1; w.due = Date.now() + 10 * MIN; } P.w[id] = w; }
  const dayKey = t => new Date(t).toDateString();
  function touchStreak() { const today = dayKey(Date.now()); if (P.day === today) return; P.streak = P.day === dayKey(Date.now() - DAY) ? P.streak + 1 : 1; P.day = today; }
  const mastery = n => { const it = V.filter(v => v.lesson === n); return Math.round(it.reduce((s, v) => s + Math.min(W(v.id).b, 4) / 4, 0) / it.length * 100); };
  const dueWords = () => V.filter(v => W(v.id).b > 0 && W(v.id).due <= Date.now()).sort((a, b) => W(a.id).due - W(b.id).due);

  let screen = 'home', reloadWanted = false;
  function show(id) { screen = id; $$('.screen').forEach(s => s.classList.toggle('on', s.id === id)); window.scrollTo(0, 0); }

  /* ---------- Wörter: was wird gezeigt, was wird gesprochen ---------- */
  // Einträge mit mehreren gleichberechtigten Teilen ("neque … neque", "valē! valēte!", "ē / ex") werden vollständig gesprochen
  const parts = it => { const s = it.la.replace(/\([^)]*\)/g, ' '); if (/…|\//.test(s) || /!.*[^\s!]/.test(s)) return s.split(/…|\/|!/).map(x => x.replace(/\?/g, '').trim()).filter(Boolean); return [L.latForms(it.la)[0]]; };
  const multi = it => parts(it).length > 1;
  const twoPart = it => /…/.test(it.la);
  const sayText = it => Gem.laText(parts(it).join(', '));                 // Text für die Stimme
  const laShow = it => multi(it) ? it.la.replace(/\s*\([^)]*\)/g, '').trim() : L.latDisplayFirst(it.la);
  const firstKey = it => multi(it) ? L.latKey(parts(it).join(' ')) + '#' : L.latKey(parts(it)[0]);
  const keyCount = {}; V.forEach(v => { const k = firstKey(v); keyCount[k] = (keyCount[k] || 0) + 1; });
  const ambiguous = it => !!it.q || keyCount[firstKey(it)] > 1;          // z. B. "in (+ Abl.)" / "in (+ Akk.)", "nōs (Nom.)" / "nōs (Akk.)"
  const deAsk = (it, n) => it.q || L.shortDe(it, n);
  const allTexts = [...new Set(V.map(sayText))];
  const unspell = (() => { const m = new Map(); V.forEach(v => parts(v).forEach(p => { const k = Gem.laText(p); if (k !== p) m.set(k, p); })); const keys = [...m.keys()].sort((a, b) => b.length - a.length); if (!keys.length) return t => t; const re = new RegExp('(^|[^\\p{L}])(' + keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?=$|[^\\p{L}])', 'giu'); return t => t.replace(re, (all, pre, w) => { const o = m.get(w) || m.get(w.toLowerCase()) || w; return pre + (w[0] !== w[0].toLowerCase() ? o[0].toUpperCase() + o.slice(1) : o); }); })();
  const lessonTexts = n => V.filter(v => v.lesson === n).map(sayText);

  /* ---------- Töne und Stimme ---------- */
  let ac = null;
  function tone(freqs, dur = .12) { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const t = ac.currentTime; freqs.forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.setValueAtTime(.12, t + i * dur); g.gain.exponentialRampToValueAtTime(.001, t + (i + 1) * dur); o.connect(g); g.connect(ac.destination); o.start(t + i * dur); o.stop(t + (i + 1) * dur); }); } catch (e) { } }
  const sfx = { ok: () => tone([660, 880, 1100]), bad: () => tone([240, 190], .18) };
  let toastT = 0; const toast = (t, ms = 6000) => { const e = $('#toast'); clearTimeout(toastT); e.textContent = t || ''; e.style.display = t ? 'block' : 'none'; if (t) toastT = setTimeout(() => toast(''), ms); };
  // Ohne Gemini-Schlüssel spricht die Browser-Stimme. Mit Schlüssel spricht nur Gemini, damit die Stimme nie wechselt.
  function browserSay(text) { try { const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; const v = speechSynthesis.getVoices().filter(x => /^de/i.test(x.lang)); const best = v.find(x => /natural|online/i.test(x.name)) || v.find(x => /google/i.test(x.name)) || v[0]; if (best) u.voice = best; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { } }
  function voiceProblem(r) { toast(r && r.timeout ? 'Die Stimme lädt noch. Tippe gleich noch einmal auf Anhören.' : 'Keine Stimme: ' + Gem.explain(r && r.error), 8000); }
  const late = ms => sleep(ms).then(() => ({ ok: false, timeout: true }));
  let sayTok = 0;
  async function sayLa(item, quiet) {
    const tok = ++sayTok, text = sayText(item);
    if (!Gem.hasKey()) { browserSay(parts(item).map(p => L.pron(p)).join(', ')); return; }
    await Gem.ready;
    if (await Gem.play(text) || quiet) return;
    toast('Stimme wird geladen …', 30000);
    const r = await Promise.race([Gem.want([text], 3), late(30000)]);
    if (tok !== sayTok) return;
    toast('');
    if (!(r.ok && await Gem.play(text))) voiceProblem(r);
  }
  const persona = () => Gem.female() ? { name: 'Lena', role: 'eine freundliche, geduldige Lernhelferin' } : { name: 'Leo', role: 'ein freundlicher, geduldiger Lernhelfer' };

  /* =====================================================================
     START
     ===================================================================== */
  function renderHome() {
    if (reloadWanted) { location.reload(); return; }
    $('#stStreak').textContent = '🔥 ' + (P.day === dayKey(Date.now()) || P.day === dayKey(Date.now() - DAY) ? P.streak : 0);
    $('#stXp').textContent = '⚡ ' + P.xp;
    $('#talkSub').textContent = `${persona().name} fragt dich ab, du antwortest laut`;
    const due = dueWords().length; $('#revInfo').textContent = due ? (due === 1 ? '1 Wort ist' : due + ' Wörter sind') + ' jetzt dran' : 'Gerade ist nichts fällig'; $('#goRev').style.opacity = due ? 1 : .55;
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
    $('#sheet').classList.add('on'); if (Gem.hasKey()) Gem.ready.then(() => Gem.want(lessonTexts(n), 1));
  }
  const closeSheet = () => $('#sheet').classList.remove('on');
  $('#shX').onclick = closeSheet; $('#sheet').onclick = e => { if (e.target.id === 'sheet') closeSheet(); };
  $('#shLearn').onclick = () => { closeSheet(); startLearn(sheetLesson); };
  $('#shTalk').onclick = () => { closeSheet(); startTalk(sheetLesson); };
  $('#goRev').onclick = () => { if (dueWords().length) startLearn(null); else toast('Gerade ist nichts fällig. Lerne eine neue Lektion!'); };
  $('#goTalk').onclick = () => startTalk(null);
  $('#goSet').onclick = () => openSettings();

  /* =====================================================================
     LERNEN (gemischte Übungen)
     ===================================================================== */
  const S = { steps: [], i: 0, words: [], wrong: new Set(), retried: new Set(), pool: [], cur: null, locked: false, run: 0 };
  const buildable = it => { const w = laShow(it); return !multi(it) && w.length >= 3 && w.length <= 9 && !/[\s.…?!]/.test(w); };
  const picOk = it => !/^(txt|num):/.test(it.icon) && it.type !== 'o' && !ambiguous(it);      // nur Wörter, die sich als Bild zeigen lassen
  async function startLearn(lesson) {
    const run = ++S.run; let words;
    if (lesson == null) words = dueWords().slice(0, 8);
    else { const items = V.filter(v => v.lesson === lesson), now = Date.now(); const due = items.filter(v => W(v.id).b > 0 && W(v.id).due <= now).sort((a, b) => W(a.id).b - W(b.id).b); const fresh = items.filter(v => W(v.id).b === 0); words = due.slice(0, 6).concat(fresh).slice(0, 6); if (words.length < 6) words = words.concat(items.filter(v => !words.includes(v)).sort((a, b) => W(a.id).b - W(b.id).b)).slice(0, 6); }
    const lessons = new Set(words.map(w => w.lesson)); S.pool = V.filter(v => lessons.has(v.lesson)); if (S.pool.length < 6) S.pool = V;
    const steps = [];
    for (let c = 0; c < words.length; c += 3) { const ch = words.slice(c, c + 3); ch.filter(w => W(w.id).b === 0).forEach(w => steps.push({ type: 'intro', w })); L.shuffle(ch).forEach(w => steps.push({ type: picOk(w) && Math.random() < .4 ? 'pic' : 'mc_l2d', w })); }
    if (words.length >= 4) steps.push({ type: 'pairs', ws: L.shuffle(words).slice(0, 4) });
    L.shuffle(words).forEach(w => { let t = pick(['mc_d2l', 'listen', 'build']); if (t === 'build' && !buildable(w)) t = 'mc_d2l'; if (t === 'listen' && ambiguous(w)) t = 'mc_l2d'; steps.push({ type: t, w }); });
    S.steps = steps; S.i = 0; S.words = words; S.wrong = new Set(); S.retried = new Set();
    show('learn'); $('#fbar').className = 'fbar'; $('#lBar').style.width = '0';
    if (Gem.hasKey()) {                                   // erst die Stimme für genau diese Wörter holen, dann beginnen
      await Gem.ready; if (run !== S.run) return;
      const texts = words.map(sayText);
      if (!texts.every(t => Gem.hasNow(t))) {
        $('#ex').innerHTML = '<div class="loading"><div class="spin"></div><b>Stimme wird vorbereitet …</b></div>';
        const r = await Promise.race([Gem.want(texts, 2), late(25000)]);
        if (run !== S.run) return;
        if (!r.ok) voiceProblem(r);
      }
      if (lesson != null) Gem.want(lessonTexts(lesson), 0);     // Rest der Lektion im Hintergrund
    }
    renderStep();
  }
  function renderStep() {
    S.locked = false; $('#fbar').className = 'fbar'; $('#lBar').style.width = (S.i / S.steps.length * 100) + '%';
    if (S.i >= S.steps.length) return finishLearn();
    const st = S.cur = S.steps[S.i], ex = $('#ex'); ex.innerHTML = '';
    if (st.type === 'listen' && Gem.hasKey() && !Gem.hasNow(sayText(st.w))) st.type = 'mc_l2d';      // ohne Aufnahme keine Hör-Übung
    const head = t => ex.appendChild(el('div', 'task', t));
    const card = (it, o = {}) => { const c = el('div', 'qcard', (o.noPic ? '' : `<div class="ico">${Ic.svg(it.icon)}</div>`) + `<div class="qword">${esc(o.word)}</div>` + (o.sub ? `<div class="qsub">${esc(o.sub)}</div>` : '')); if (o.speak) { const b = el('button', 'spk', '🔊 Anhören'); b.onclick = () => sayLa(it); c.appendChild(b); } ex.appendChild(c); return c; };
    const options = (opts, cls) => { const box = el('div', 'opts ' + (cls || '')); opts.forEach(o => { const b = el('button', 'opt', o.html || esc(o.text)); b.dataset.ok = o.ok ? '1' : ''; b.onclick = () => { if (S.locked) return; box.querySelectorAll('.opt').forEach(x => x.classList.add(x.dataset.ok ? 'ok' : x === b ? 'bad' : 'dim')); answer(o.ok, st.w); }; box.appendChild(b); }); ex.appendChild(box); };
    const mk = dir => { let o = L.makeOptions(st.w, dir, S.pool); if (o.length < 3) o = L.makeOptions(st.w, dir, V); return o; };
    if (st.type === 'intro') { head('Neues Wort'); card(st.w, { word: st.w.la, sub: st.w.de, speak: true }); sayLa(st.w); const b = el('button', 'btn', 'Weiter'); b.onclick = () => { S.i++; renderStep(); }; ex.appendChild(b); }
    else if (st.type === 'mc_l2d') { head('Was heißt das auf Deutsch?'); card(st.w, { word: st.w.la, speak: true }); sayLa(st.w); options(mk('l2d')); }
    else if (st.type === 'mc_d2l') { head('Wie heißt das auf Latein?'); card(st.w, { word: deAsk(st.w, 2) }); options(mk('d2l')); }
    else if (st.type === 'listen') { head('Was hörst du?'); const b = el('button', 'spk big', '🔊'); b.onclick = () => sayLa(st.w); ex.appendChild(b); sayLa(st.w); options(mk('l2d')); }
    else if (st.type === 'pic') { head('Welches Bild passt?'); card(st.w, { word: st.w.la, speak: true, noPic: true }); sayLa(st.w); let others = L.shuffle(S.pool.filter(o => o.id !== st.w.id && picOk(o) && o.icon !== st.w.icon)).filter((o, i, a) => a.findIndex(x => x.icon === o.icon) === i).slice(0, 2); if (others.length < 2) others = L.shuffle(V.filter(o => o.id !== st.w.id && picOk(o) && o.icon !== st.w.icon)).filter((o, i, a) => a.findIndex(x => x.icon === o.icon) === i).slice(0, 2); options(L.shuffle([{ item: st.w, ok: true }].concat(others.map(o => ({ item: o, ok: false })))).map(o => Object.assign(o, { html: Ic.svg(o.item.icon) })), 'pics'); }
    else if (st.type === 'pairs') renderPairs(st, ex, head);
    else if (st.type === 'build') renderBuild(st, ex, head, card);
  }
  function renderPairs(st, ex, head) {
    head('Finde die Paare'); const box = el('div', 'opts pairs'); let sel = null, left = st.ws.length;
    const laL = w => ambiguous(w) ? w.la : laShow(w), deL = w => deAsk(w, 1); const same = (x, y) => x.id === y.id || (laL(x) === laL(y) && deL(x) === deL(y));
    const A = L.shuffle(st.ws).map(w => ({ w, side: 'la', text: laL(w) })), B = L.shuffle(st.ws).map(w => ({ w, side: 'de', text: deL(w) }));
    A.forEach((a, i) => [a, B[i]].forEach(c => { const b = el('button', 'opt', esc(c.text)); b.dataset.id = c.w.id; b.dataset.side = c.side; b.onclick = () => {
      if (b.classList.contains('ok') || S.locked) return; if (c.side === 'la') sayLa(c.w, true);
      if (!sel || sel.c.side === c.side) { if (sel) sel.b.classList.remove('sel'); sel = { b, c }; b.classList.add('sel'); return; }
      const o = sel; sel = null; o.b.classList.remove('sel');
      if (same(o.c.w, c.w)) { [b, o.b].forEach(x => x.classList.add('ok')); sfx.ok(); if (--left === 0) { S.locked = true; setTimeout(() => { S.i++; renderStep(); }, 600); } }
      else { S.wrong.add(c.w.id); S.wrong.add(o.c.w.id); [b, o.b].forEach(x => x.classList.add('bad')); sfx.bad(); setTimeout(() => [b, o.b].forEach(x => x.classList.remove('bad')), 500); }
    }; box.appendChild(b); })); ex.appendChild(box);
  }
  function renderBuild(st, ex, head, card) {
    head('Setze das lateinische Wort zusammen'); card(st.w, { word: deAsk(st.w, 2) });
    const target = laShow(st.w), slots = el('div', 'slots'), tiles = el('div', 'tiles'); let cur = [];
    const check = () => { if (cur.length < [...target].length) return; const ok = cur.map(x => x.ch).join('') === target; S.locked = true; answer(ok, st.w); };
    L.shuffle([...target].map(ch => ({ ch }))).forEach(t => { const b = el('button', 'tile', esc(t.ch)); t.b = b; b.onclick = () => { if (S.locked) return; b.classList.add('used'); const s = el('button', 'tile', esc(t.ch)); t.s = s; cur.push(t); s.onclick = () => { if (S.locked) return; cur = cur.filter(x => x !== t); s.remove(); b.classList.remove('used'); }; slots.appendChild(s); check(); }; tiles.appendChild(b); });
    ex.appendChild(slots); ex.appendChild(tiles);
  }
  function answer(ok, w) {
    S.locked = true; const fb = $('#fbar'), pair = `${w.la} = ${L.deVariantsRaw(w.de).slice(0, 2).join(', ')}`;
    if (ok) { sfx.ok(); fb.className = 'fbar ok'; $('#fbT').textContent = pick(['Super!', 'Richtig!', 'Genau!', 'Sehr gut!', 'Stark!']); }
    else { sfx.bad(); fb.className = 'fbar bad'; $('#fbT').textContent = 'Nicht ganz'; S.wrong.add(w.id); if (!S.retried.has(w.id)) { S.retried.add(w.id); S.steps.push({ type: 'mc_l2d', w }); } const run = S.run, i = S.i; setTimeout(() => { if (run === S.run && i === S.i) sayLa(w, true); }, 500); }
    $('#fbS').textContent = pair; fb.scrollIntoView({ block: 'end' });
  }
  $('#fbNext').onclick = () => { S.i++; renderStep(); };
  $('#lClose').onclick = () => { S.run++; sayTok++; toast(''); Gem.stopAudio(); renderHome(); };
  function finishLearn() {
    const n = S.words.length, good = S.words.filter(w => !S.wrong.has(w.id)).length;
    S.words.forEach(w => grade(w.id, !S.wrong.has(w.id))); const xp = n * 5 + good * 5; P.xp += xp; touchStreak(); save();
    endScreen(good, n, `+${xp} ⚡ · Serie: ${P.streak} ${P.streak === 1 ? 'Tag' : 'Tage'}`);
  }
  function endScreen(good, n, sub) { const r = n ? good / n : 0; $('#eStars').textContent = r >= .9 ? '⭐⭐⭐' : r >= .6 ? '⭐⭐' : '⭐'; $('#eMain').textContent = `${good} von ${n} gleich richtig`; $('#eSub').textContent = sub; show('end'); tone([523, 659, 784, 1047], .14); }
  $('#eHome').onclick = renderHome;

  /* =====================================================================
     SPRECH-TRAINING (Gemini Live)
     Die App führt die Abfrage (Reihenfolge, Richtung, Tipps, Punkte). Gemini hört zu, spricht und bewertet die Antworten.
     Google berechnet bei jeder Antwort den ganzen bisherigen Gesprächsverlauf neu. Deshalb beginnt die App alle paar
     Wörter unbemerkt eine frische Sitzung und pausiert, wenn länger niemand spricht.
     ===================================================================== */
  const CFG = { rotateAfter: 4, rotateTokens: 4500, idleMs: 75000 };
  const SYSTEM = () => `Du bist ${persona().name}, ${persona().role}. Du übst mit einem Kind (5. Klasse Gymnasium) lateinische Vokabeln im Gespräch.

SPRACHE
- Sprich immer Deutsch. ANTWORTE UNMISSVERSTÄNDLICH AUF DEUTSCH.
- Lateinische Wörter sprichst du in deutscher Schulaussprache: c immer wie k, v wie deutsches w, qu wie kw, Vokale mit Strich (ā ē ī ō ū) lang, Betonung nach der lateinischen Regel.
- Fasse dich sehr kurz: höchstens ein kurzer Satz. Keine Erklärungen, kein Smalltalk.

ABLAUF
1. Nachrichten, die mit "App:" beginnen, kommen von der App und nicht vom Kind. Sie enthalten wie eine Werkzeug-Antwort eine "anweisung" und manchmal eine "frage". Befolge sie genau und sprich nicht über sie.
2. Sobald das Kind Lektionen nennt, rufst du lektionen_waehlen auf. Frage nicht nach, ob das stimmt.
3. Du tust immer genau das, was in der letzten Werkzeug-Antwort oder App-Nachricht unter "anweisung" steht.
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
- Werte nur, was das Kind deutlich und direkt zu dir sagt. Geräusche, Musik, Fernseher, andere Personen im Hintergrund und Reste deiner eigenen Stimme ignorierst du vollständig und rufst deswegen nichts auf.
- Wenn das Kind etwas gesagt hat, du es aber nicht sicher verstanden hast, rufst du antwort_melden mit art "nochmal" auf.

VERBOTEN
- Verrate nie selbst die Lösung. Du sagst sie nur, wenn die Werkzeug-Antwort es aufträgt.
- Denke dir nie selbst Vokabeln oder Fragen aus.`;
  const TOOLS = [{ functionDeclarations: [
    { name: 'lektionen_waehlen', behavior: 'BLOCKING', description: 'Aufrufen, sobald das Kind gesagt hat, welche Lektionen es lernen möchte.', parameters: { type: 'OBJECT', properties: { lektionen: { type: 'ARRAY', items: { type: 'INTEGER' }, description: 'Alle gewünschten Lektionsnummern von 1 bis 20. Beispiele: "eins bis vier" = [1,2,3,4]; "alles bis sieben" = [1,2,3,4,5,6,7]; "drei und fünf" = [3,5]; "alle" = 1 bis 20.' } }, required: ['lektionen'] } },
    { name: 'reihenfolge_waehlen', behavior: 'BLOCKING', description: 'Aufrufen, sobald das Kind gesagt hat, ob die Lektionen nacheinander oder gemischt abgefragt werden sollen.', parameters: { type: 'OBJECT', properties: { reihenfolge: { type: 'STRING', enum: ['nacheinander', 'gemischt'] } }, required: ['reihenfolge'] } },
    { name: 'antwort_melden', behavior: 'BLOCKING', description: 'In der Abfrage nach JEDER Äußerung des Kindes aufrufen.', parameters: { type: 'OBJECT', properties: { art: { type: 'STRING', enum: ['richtig', 'falsch', 'tipp', 'weiss_nicht', 'nochmal', 'stopp'] }, gehoert: { type: 'STRING', description: 'Was das Kind gesagt hat.' } }, required: ['art', 'gehoert'] } }] }];
  const SAY_WORD = 'nur das Wort unter "sage" und warte auf die Antwort.';
  const appMsg = o => 'App: ' + JSON.stringify(o);

  const T = { live: null, nextLive: null, active: false, paused: false };
  const tui = {
    state(t) { $('#tState').textContent = t; },
    orb(c) { $('#orb').className = 'orb ' + c; $('#orb').textContent = c === 'speak' ? '🔊' : '🎤'; $('#orb').style.transform = ''; },
    notice(t) { const n = $('#tNotice'); n.textContent = t || ''; n.style.display = t ? 'block' : 'none'; },
    resume(on) { $('#tResume').style.display = on ? 'block' : 'none'; },
    prog() { $('#tBar').style.width = (T.total ? T.done / T.total * 100 : 0) + '%'; $('#tCnt').textContent = T.total ? T.done + '/' + T.total : ''; }
  };
  const deAll = it => { const k = firstKey(it); const out = []; V.filter(v => v.id === it.id || (keyCount[k] > 1 && firstKey(v) === k)).forEach(v => L.deVariantsRaw(v.de).concat(v.alt || []).forEach(x => { if (!out.includes(x)) out.push(x); })); return out; };
  const question = () => { const it = T.cur, d = T.dir; const q = { nummer: T.done + 1, von: T.total, richtung: d === 'l2d' ? 'Latein → Deutsch' : 'Deutsch → Latein', sage: d === 'l2d' ? sayText(it) : deAsk(it, 2), richtige_antworten: d === 'l2d' ? deAll(it) : (twoPart(it) ? [parts(it).join(' … ')] : L.latAccepted(it, V)) }; if (multi(it) && d === 'l2d') q.hinweis = 'Dieser Eintrag hat zwei Teile. Sprich beide Teile.'; return q; };
  function tShowSolved(it) { $('#tPrompt').textContent = it.la; $('#tHint').textContent = L.deVariantsRaw(it.de).slice(0, 2).join(', '); $('#tPic').innerHTML = Ic.svg(it.icon); }
  function tApply() { clearTimeout(T.pendT); const f = T.pending; T.pending = null; if (f) f(); }
  // Nächstes Wort bestimmen. Liefert { pre, lesson, frage } oder am Ende { pre, ende }.
  function tAdvance(pre, solved, defer) {
    clearTimeout(T.pendT); T.pending = null;
    if (solved) tShowSolved(solved); else if (!defer) { $('#tHint').textContent = ''; $('#tPic').innerHTML = ''; }
    if (!T.queue.length) { T.ending = true; T.cur = null; if (!solved) $('#tPrompt').textContent = ''; tui.prog(); return { pre: `${pre} Sage dann: "Geschafft! Du hast ${T.total} Wörter geübt und ${T.first} davon gleich beim ersten Mal gewusst." Verabschiede dich kurz.`, ende: true }; }
    const it = T.cur = T.queue.shift(); T.dir = L.nextDir(P.memo, it.id); save(); T.hints = 0; T.wrong = 0;
    const lesson = T.order === 'seq' && T.lessons.length > 1 && it.lesson !== T.lastLesson ? it.lesson : null; T.lastLesson = it.lesson;
    const q = question(), dir = T.dir; tui.prog();
    const showNew = () => { $('#tHint').textContent = ''; $('#tPic').innerHTML = ''; $('#tPrompt').textContent = dir === 'l2d' ? it.la : q.sage; };
    if (solved || defer) { T.pending = showNew; T.pendT = setTimeout(tApply, 15000); } else showNew();
    return { pre, lesson, frage: q };
  }
  const asResponse = a => a.ende ? { anweisung: a.pre, ende: true } : { anweisung: `${a.pre}${a.lesson ? ` Sage dann: "Lektion ${a.lesson}."` : ''} Sage dann ${SAY_WORD}`, frage: a.frage };
  const kickFor = a => ({ anweisung: (a.lesson ? `Sage: "Lektion ${a.lesson}." Sage dann ` : 'Sage ') + SAY_WORD, frage: a.frage });
  // Nach einem gelösten Wort: normal weiter oder, wenn die Sitzung lang genug lief, in einer frischen Sitzung
  function respondAdvance(pre, solved) {
    const a = tAdvance(pre, solved); (T.sess = T.sess || { answers: 0 }).answers++;
    if (a.ende || !T.live || !(T.sess.answers >= CFG.rotateAfter || T.live.promptTokens > CFG.rotateTokens || T.forceRotate)) return asResponse(a);
    T.forceRotate = false; T.handing = true; T.kick = kickFor(a); Gem.mic.sink = null; T.nextLive = openLive();
    clearTimeout(T.handT); T.handT = setTimeout(() => { if (T.active && T.handing) swap(); }, 12000);
    return { anweisung: `${a.pre} Sage danach nichts mehr.` };
  }
  function tReveal() {
    const it = T.cur; markTried(it); save();
    T.reveals[it.id] = (T.reveals[it.id] || 0) + 1; if (T.reveals[it.id] < 2) L.requeue(T.queue, it); else T.done++;
    return respondAdvance(`Sage genau zweimal hintereinander: "${sayText(it)} – ${L.deVariantsRaw(it.de).slice(0, 2).join(', ')}."`, it);
  }
  function markTried(it) { if (T.tried.has(it.id)) return; T.tried.add(it.id); T.missed.add(it.id); grade(it.id, false); }
  function tBegin(order, pre, defer) { T.order = order; const items = V.filter(v => T.lessons.includes(v.lesson)); T.queue = L.buildQueue(items, order); T.total = items.length; T.done = 0; T.first = 0; T.lastLesson = T.lessons.length > 1 ? null : T.lessons[0]; return tAdvance(pre, null, defer); }
  function onTool(name, a) {
    idleReset();
    if (name === 'lektionen_waehlen') {
      if (T.cur) return { anweisung: `Sage noch einmal ${SAY_WORD}`, frage: question() };
      const ls = [...new Set((a.lektionen || []).map(Number).filter(n => LESSONS.includes(n)))].sort((x, y) => x - y);
      if (!ls.length) return { anweisung: 'Sage, dass es die Lektionen 1 bis 20 gibt, und frage noch einmal, welche das Kind lernen möchte.' };
      T.lessons = ls; const d = L.describeLessons(ls); $('#tPrompt').textContent = d;
      return ls.length === 1 ? asResponse(tBegin('seq', `Sage: "${d}. Los geht's!"`, true)) : { anweisung: `Sage: "${d}. Nacheinander oder gemischt?" Rufe nach der Antwort des Kindes reihenfolge_waehlen auf.` };
    }
    if (name === 'reihenfolge_waehlen') { if (!T.lessons) return { anweisung: 'Frage zuerst, welche Lektionen das Kind lernen möchte.' }; if (T.cur) return { anweisung: `Sage noch einmal ${SAY_WORD}`, frage: question() }; return asResponse(tBegin(a.reihenfolge === 'gemischt' ? 'mix' : 'seq', 'Sage: "Los geht\'s!"', true)); }
    if (T.ending) return { anweisung: 'Verabschiede dich kurz.', ende: true };
    if (!T.cur) return { anweisung: 'Frage, welche Lektionen das Kind lernen möchte, und rufe dann lektionen_waehlen auf.' };
    const it = T.cur;
    switch (a.art) {
      case 'richtig': if (!T.tried.has(it.id)) { T.first++; grade(it.id, true); P.xp += 2; } T.done++; save(); sfx.ok(); return respondAdvance('Lobe mit ein bis zwei Wörtern.', it);
      case 'falsch': markTried(it); save(); T.wrong++; sfx.bad(); if (T.wrong >= 3) return tReveal(); return { anweisung: 'Sage kurz, dass das nicht stimmt und das Kind es noch einmal versuchen soll. Verrate die Lösung nicht. Warte dann auf die Antwort.' };
      case 'tipp': { markTried(it); save(); T.hints++; const h = L.hint(it, T.dir, T.hints); $('#tHint').textContent = h.shown; return { anweisung: `Sage genau: "${h.said}" Warte dann auf die Antwort. Wiederhole die Frage nicht.` }; }
      case 'weiss_nicht': return tReveal();
      case 'nochmal': return { anweisung: `Sage noch einmal ${SAY_WORD}`, frage: question() };
      default: T.ending = true; return { anweisung: 'Verabschiede dich mit einem kurzen Satz.', ende: true };
    }
  }
  // Auftrag für eine neue Sitzung, passend zum Stand der Abfrage
  function resumeKick() {
    if (T.cur) return { anweisung: `Sage noch einmal ${SAY_WORD}`, frage: question() };
    if (T.lessons) return { anweisung: 'Frage: "Nacheinander oder gemischt?" Rufe nach der Antwort des Kindes reihenfolge_waehlen auf.' };
    return { anweisung: 'Sage nur: "Welche Lektionen möchtest du lernen?" Rufe lektionen_waehlen auf, sobald das Kind Lektionen nennt.' };
  }
  function openLive() {
    const live = Gem.live({ system: SYSTEM(), tools: TOOLS, bargeIn: Gem.bargeIn,
      onTool: (n, a) => live === T.live ? onTool(n, a) : { anweisung: 'Sage nichts.' },
      onReady: () => { if (live === T.live && T.active && !T.handing) activate(); },
      onSpeak: on => { if (live !== T.live) return; idleReset(); if (!on) tApply(); tui.orb(on ? 'speak' : 'listen'); tui.state(on ? `${persona().name} spricht …` : 'Ich höre zu …'); },
      onCaption: t => { if (live === T.live) $('#tCap').textContent = unspell(t); },
      onTurn: info => { if (live === T.live && T.active) onTurn(info); },
      onGoAway: () => { if (live === T.live) T.forceRotate = true; },
      onClose: (kind, reason) => onLiveClose(live, kind, reason) });
    return live;
  }
  function connect(kick) { T.kick = kick; tui.orb('wait'); tui.state('Verbinde …'); T.live = openLive(); }
  // Die aktive Sitzung ist bereit: Mikrofon anschließen und den Auftrag schicken
  function activate() {
    const live = T.live; T.retries = 0; T.sess = { answers: 0 }; T.loose = 0;
    Gem.gate.reset(); Gem.gate.bargeIn = Gem.bargeIn;
    Gem.mic.sink = c => { for (const x of Gem.gate.pass(c, Gem.echoRisk() || live.speaking)) live.audio(x); };
    tui.orb('listen'); tui.state('Ich höre zu …');
    if (T.kick) { live.text(appMsg(T.kick)); T.kick = null; T.expectSpeech = true; }
    idleReset();
  }
  function swap() {
    clearTimeout(T.handT); const old = T.live; T.handing = false; T.live = T.nextLive && !T.nextLive.closed ? T.nextLive : openLive(); T.nextLive = null; if (old) old.close();
    if (T.live.ready) activate(); else { tui.orb('wait'); tui.state(''); }
  }
  function onTurn(info) {
    tApply();
    if (T.ending) return finishTalk();
    if (T.handing) return swap();
    // Spricht Gemini zweimal hintereinander, ohne die Antwort zu melden, obwohl eine Frage offen ist, erinnert die App daran
    if (T.cur && !info.tool && !T.expectSpeech) { if (++T.loose >= 2) { T.loose = 0; T.live.text(appMsg({ anweisung: 'Bewerte jetzt die letzte Antwort des Kindes mit antwort_melden. Wenn du unsicher bist, nimm die Art "nochmal".' })); } } else T.loose = 0;
    T.expectSpeech = false; idleReset();
  }
  function onLiveClose(live, kind, reason) {
    if (live === T.nextLive) { T.nextLive = null; return; }            // vorbereitete Sitzung verloren: wird beim Wechsel neu geöffnet
    if (live !== T.live || !T.active || T.paused) return;
    if (T.ending) return finishTalk();
    if (T.handing) return swap();
    if (kind === 'credit' || kind === 'key' || T.retries >= 3) return talkError(Gem.explain({ kind }));
    T.retries = (T.retries || 0) + 1; tui.orb('wait'); tui.state('Verbinde neu …'); Gem.mic.sink = null;
    setTimeout(() => { if (T.active && !T.paused && T.live === live) connect(resumeKick()); }, 500 * T.retries);
  }
  function talkError(text) { clearTimeout(T.idleT); closeLive(); Gem.mic.stop(); Gem.stopAudio(); tui.orb(''); tui.state(''); tui.notice(text); T.paused = true; tui.resume(true); }
  function closeLive() { clearTimeout(T.handT); T.handing = false; const a = T.live, b = T.nextLive; T.live = null; T.nextLive = null; if (a) a.close(); if (b) b.close(); Gem.mic.sink = null; }
  function idleReset() { clearTimeout(T.idleT); if (T.active && !T.paused) T.idleT = setTimeout(() => pauseTalk('Pause, weil gerade niemand spricht.'), CFG.idleMs); }
  // Pause: Verbindung und Mikrofon aus, der Stand der Abfrage bleibt erhalten
  function pauseTalk(why) {
    if (!T.active || T.paused) return;
    if (T.ending) return finishTalk();
    T.paused = true; clearTimeout(T.idleT); closeLive(); Gem.mic.stop(); Gem.stopAudio(); tApply();
    tui.orb(''); tui.state('Pause'); tui.notice(why || ''); tui.resume(true); try { T.wake && T.wake.release(); } catch (e) { }
  }
  async function resumeTalk() {
    if (!T.active || !T.paused) return;
    tui.resume(false); tui.notice(''); T.paused = false; T.retries = 0; Gem.ctx();
    if (!(await micOn())) return;
    try { T.wake = await navigator.wakeLock.request('screen'); } catch (e) { }
    connect(resumeKick());
  }
  async function micOn() { try { await Gem.mic.start(); return true; } catch (e) { tui.orb(''); tui.state(''); tui.notice('Das Mikrofon ist nicht erlaubt. Bitte im Browser beim Schloss-Symbol das Mikrofon erlauben.'); T.paused = true; tui.resume(true); return false; } }
  async function startTalk(preLesson) {
    show('talk'); tui.notice(''); tui.resume(false); $('#tPrompt').textContent = ''; $('#tHint').textContent = ''; $('#tPic').innerHTML = ''; $('#tCap').textContent = '';
    closeLive(); clearTimeout(T.idleT); clearTimeout(T.pendT);
    Object.assign(T, { active: true, paused: false, lessons: null, cur: null, queue: [], total: 0, done: 0, first: 0, tried: new Set(), missed: new Set(), reveals: {}, ending: false, retries: 0, pending: null, handing: false, forceRotate: false, kick: null, sess: { answers: 0 }, loose: 0, expectSpeech: false }); tui.prog();
    Gem.mic.onLevel = v => { if (T.live && !T.live.speaking && !Gem.echoRisk() && !T.paused && Gem.gate.hang > 0) $('#orb').style.transform = `scale(${1 + Math.min(.25, v * 4)})`; };
    if (!Gem.hasKey()) { tui.orb(''); tui.state(''); tui.notice('Für das Sprech-Training fehlt noch der Gemini-Schlüssel. Bitte im Elternbereich (⚙️) eintragen.'); return; }
    Gem.ctx(); tui.orb('wait'); tui.state('Verbinde …');
    if (!(await micOn())) return;
    if (!T.active) { Gem.mic.stop(); return; }
    try { T.wake = await navigator.wakeLock.request('screen'); } catch (e) { }
    let kick;
    if (preLesson) { T.lessons = [preLesson]; $('#tPrompt').textContent = 'Lektion ' + preLesson; kick = asResponse(tBegin('seq', `Sage: "Hallo! Lektion ${preLesson}. Los geht's!"`, true)); }
    else kick = { anweisung: 'Sage nur: "Hallo! Welche Lektionen möchtest du lernen?" Rufe lektionen_waehlen auf, sobald das Kind Lektionen nennt.' };
    connect(kick);
  }
  function stopTalk() { T.active = false; T.paused = false; clearTimeout(T.idleT); clearTimeout(T.pendT); closeLive(); Gem.mic.stop(); Gem.mic.onLevel = null; Gem.stopAudio(); try { T.wake && T.wake.release(); } catch (e) { } }
  function finishTalk() { const had = T.total > 0 && T.done > 0; const good = T.first, n = T.done, miss = T.missed.size; stopTalk(); if (!had) return renderHome(); touchStreak(); save(); endScreen(good, n, miss ? `${miss} ${miss === 1 ? 'Wort üben' : 'Wörter üben'} wir bald wieder.` : 'Alles auf Anhieb gewusst!'); }
  $('#tClose').onclick = finishTalk;
  $('#tResume').onclick = resumeTalk;
  const sayAs = t => { if (T.live && T.live.ready && T.cur && !T.handing && !T.paused) { Gem.stopAudio(); T.live.text(t); idleReset(); } };
  $('#bHint').onclick = () => sayAs('Gib mir einen Tipp.'); $('#bRepeat').onclick = () => sayAs('Sag das Wort bitte nochmal.'); $('#bGive').onclick = () => sayAs('Das weiß ich nicht.');
  document.addEventListener('visibilitychange', () => { if (document.hidden && T.active) pauseTalk('Pause. Tippe auf Weiter, wenn du wieder da bist.'); });

  /* =====================================================================
     ELTERNBEREICH
     ===================================================================== */
  async function clipInfo() { await Gem.ready; const n = Gem.count(allTexts); $('#sClips').textContent = `${n} von ${allTexts.length} Aufnahmen sind mit dieser Stimme gespeichert.` + (n < allTexts.length ? ' Fehlende lädt die App beim Lernen automatisch.' : ''); }
  function useInfo() { const u = Gem.usage(), f = x => x.toFixed(2).replace('.', ','); $('#sUse').textContent = `Geschätzte Kosten bei Google: heute ${f(u.today)} $, insgesamt ${f(u.total)} $. Das ist ein Richtwert. Maßgeblich ist die Abrechnung in Google AI Studio.`; }
  function openSettings() { $('#sKey').value = Gem.key; $('#sBarge').checked = Gem.bargeIn; const sv = $('#sVoice'); sv.innerHTML = ''; Gem.VOICES.forEach(([v, t]) => { const o = el('option', '', t); o.value = v; o.selected = v === Gem.voice; sv.appendChild(o); }); $('#sMsg').textContent = ''; clipInfo(); useInfo(); show('settings'); }
  const sMsg = (t, bad) => { $('#sMsg').textContent = t; $('#sMsg').style.color = bad ? 'var(--bad)' : 'var(--ok2)'; };
  const needKey = () => { Gem.setKey($('#sKey').value); if (Gem.key) return true; sMsg('Bitte zuerst den Schlüssel eintragen.', true); return false; };
  $('#sBack').onclick = () => { Gem.setKey($('#sKey').value); Gem.onProgress = null; renderHome(); };
  $('#sKey').onchange = () => Gem.setKey($('#sKey').value);
  $('#sVoice').onchange = () => { Gem.setVoice($('#sVoice').value); clipInfo(); };
  $('#sBarge').onchange = () => Gem.setBargeIn($('#sBarge').checked);
  // Prüft mit einer echten kleinen Anfrage, ob Schlüssel und Guthaben in Ordnung sind
  $('#sTest').onclick = async () => { if (!needKey()) return; sMsg('Teste …'); try { Gem.ctx(); const pcm = await Gem.tts('Hallo!', false); Gem.blockedUntil = 0; Gem.stopAudio(); Gem.queue(pcm); sMsg('Funktioniert! Du solltest ein „Hallo" hören.'); } catch (e) { sMsg(Gem.explain(e), true); } useInfo(); };
  $('#sProbe').onclick = async () => { if (!needKey()) return; sMsg('Lade Probe …'); try { Gem.ctx(); const pcm = await Gem.tts(['puella', 'vīkus', 'dolēre', 'agrikola'].join(' <long pause> ')); Gem.stopAudio(); Gem.queue(pcm); sMsg('puella, vīcus, dolēre, agricola'); } catch (e) { sMsg(Gem.explain(e), true); } useInfo(); };
  $('#sLoad').onclick = async () => { if (!needKey()) return; const b = $('#sLoad'); b.disabled = true; b.textContent = 'Lade Aufnahmen …'; sMsg(''); await Gem.ready; Gem.onProgress = clipInfo; const r = await Gem.want(allTexts, 0); Gem.onProgress = null; b.disabled = false; b.textContent = 'Alle Aufnahmen laden'; clipInfo(); useInfo(); if (r.ok) sMsg('Alle Aufnahmen sind geladen.'); else sMsg(Gem.explain(r.error), true); };
  $('#sReset').onclick = () => { if (confirm('Wirklich den gesamten Lernfortschritt löschen?')) { P = { w: {}, xp: 0, streak: 0, memo: {} }; save(); renderHome(); } };

  /* ---------- Start ---------- */
  // Alte Aufnahmen waren nach Wortnummer abgelegt. Sie werden übernommen, wenn sich der gesprochene Text nicht geändert hat.
  const idToText = {}; V.forEach(v => { if (!multi(v)) idToText[String(v.id)] = sayText(v); });
  Gem.init(idToText);
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => { });
    // Neue Version: sofort neu laden, wenn gerade nicht gelernt wird, sonst beim nächsten Besuch der Startseite
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!had) return; if (screen === 'home') location.reload(); else reloadWanted = true; });
  }
  window.__lt = { unspell, S, T, P: () => P, Gem, L, V, onTool, startLearn, startTalk, renderHome, grade, dueWords, sayText, parts, allTexts, pauseTalk, CFG, multi, laShow };
  renderHome();
})();
