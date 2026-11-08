/* Reine Logik (ohne Browser-Abhängigkeiten): Parser, Vergleich, Aussprache, Tipps, Warteschlange */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.Logic = f(); })(this, function () {
  'use strict';
  const MACRON = { 'ā': 'a', 'ē': 'e', 'ī': 'i', 'ō': 'o', 'ū': 'u', 'Ā': 'A', 'Ē': 'E', 'Ī': 'I', 'Ō': 'O', 'Ū': 'U', 'ȳ': 'y' };
  const stripMacron = s => s.replace(/[āēīōūĀĒĪŌŪȳ]/g, c => MACRON[c]);

  /* ---------- Normalisierung ---------- */
  function deNorm(s) {
    return String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  // Latein so normalisieren, wie ein deutscher Spracherkenner es "hören" würde
  function latKey(s) {
    let t = stripMacron(String(s).toLowerCase()).replace(/ä/g, 'e').replace(/ö/g, 'e').replace(/ü/g, 'i').replace(/ß/g, 's');
    t = t.replace(/[^a-z]/g, '');
    t = t.replace(/qu/g, 'kw').replace(/ph/g, 'f').replace(/th/g, 't').replace(/ch/g, 'k').replace(/ae/g, 'e').replace(/oe/g, 'e')
      .replace(/c/g, 'k').replace(/v/g, 'w').replace(/y/g, 'i').replace(/z/g, 'ts').replace(/j/g, 'i').replace(/x/g, 'ks').replace(/h/g, '');
    return t.replace(/(.)\1+/g, '$1');
  }
  const tolFor = n => n <= 3 ? 0 : n <= 6 ? 1 : n <= 10 ? 2 : 3;

  /* ---------- Lateinische Formen ---------- */
  function latForms(la) {
    const base = String(la).replace(/\([^)]*\)/g, ' ').replace(/[?]/g, '');
    const parts = base.split(/[,\/!…]|\.\.\./).map(x => x.trim()).filter(Boolean);
    const out = [];
    parts.forEach((p, i) => { if (i > 0 && ['a', 'um', 'ae'].includes(stripMacron(p))) return; if (!out.includes(p)) out.push(p); });
    return out;
  }
  const latDisplayFirst = la => latForms(la)[0] || la;

  /* ---------- Deutsche Antwortvarianten ---------- */
  const ARTICLES = /^(der|die|das|ein|eine|einen|einem|dem|den|des|sich|zu)\s+/;
  function expandParens(seg) {
    // "(vor)bereiten" -> ["bereiten","vorbereiten"]; "Vulkan(us)"; "(Menschen-)Menge"; " (Erklärung)" -> weg; "(etwa) nicht" -> beide
    let variants = [seg];
    const re = /\(([^)]*)\)/;
    let guard = 0;
    while (variants.some(v => re.test(v)) && guard++ < 5) {
      const next = [];
      variants.forEach(v => {
        const m = re.exec(v); if (!m) { next.push(v); return; }
        const before = v.slice(0, m.index), after = v.slice(m.index + m[0].length), inner = m[1].replace(/-$/, '');
        const glued = (before && !/\s$/.test(before)) || (after && !/^\s/.test(after));
        if (glued) { next.push((before + after).trim(), (before + inner + after).trim()); }
        else if (!before.trim() && after.trim()) { next.push(after.trim(), (inner + ' ' + after).trim()); } // optionales Wort vorn
        else { next.push((before + after).trim()); }                                                          // reine Erklärung
      });
      variants = next;
    }
    return variants;
  }
  function deVariantsRaw(de) {
    // Klammern mit Komma (z. B. "er (sie, es) ist") zuerst entschärfen
    let s = String(de).replace(/\(([^)]*)\)/g, m => m.replace(/,/g, '§'));
    const out = [];
    s.split(/[,;]/).forEach(seg => {
      seg = seg.replace(/§/g, ',').trim();
      if (!seg) return;
      expandParens(seg).forEach(v => {
        v = v.replace(/\(.*?\)/g, ' ').replace(/[?!]/g, '').replace(/…/g, ' ').replace(/\s+/g, ' ').trim();
        if (v && !out.includes(v)) out.push(v);
      });
    });
    return out;
  }
  const stripArticle = s => s.replace(ARTICLES, '').trim();
  function deVariants(item) {
    const v = deVariantsRaw(item.de).concat(item.alt || []);
    return v.map(x => deNorm(stripArticle(x.toLowerCase()))).filter(Boolean);
  }
  const primaryDe = item => stripArticle(deVariantsRaw(item.de)[0] || item.de);
  const shortDe = (item, n = 2) => item.q || deVariantsRaw(item.de).slice(0, n).join(', ');
  // Text für die Sprachausgabe (Klammern aufgelöst)
  function deSpeak(item, n = 2) {
    if (item.q) return item.q.replace(/\(.*?\)/g, m => /Akk|Dat|Nom/.test(m) ? m.replace(/[()]/g, '') : m.replace(/[()]/g, ''));
    return deVariantsRaw(item.de).slice(0, n).join(', ').replace(/\s+/g, ' ');
  }

  /* ---------- Vergleich Antwort <-> Wort ---------- */
  function tokenEq(a, b) {
    if (a === b) return true;
    const n = Math.max(a.length, b.length);
    const tol = n <= 4 ? 0 : n <= 8 ? 1 : 2;
    return lev(a, b) <= tol;
  }
  function containsSeq(tokens, vt) {
    for (let i = 0; i + vt.length <= tokens.length; i++) {
      let ok = true;
      for (let j = 0; j < vt.length; j++) if (!tokenEq(tokens[i + j], vt[j])) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }
  function matchGerman(alts, item) {
    const vars = deVariants(item).map(v => v.split(' '));
    for (const alt of alts) {
      const tokens = deNorm(alt).split(' ').filter(Boolean);
      if (!tokens.length) continue;
      for (const vt of vars) {
        if (containsSeq(tokens, vt)) return true;
        // "weder noch": alle Wörter irgendwo
        if (vt.length > 1 && vt.every(w => tokens.some(t => tokenEq(t, w)))) return true;
      }
      // Spracherkenner schreibt manchmal zusammen/getrennt: Vergleich ohne Leerzeichen
      const joined = tokens.join('');
      for (const vt of vars) { const vj = vt.join(''); if (vj.length >= 5 && lev(joined, vj) <= tolFor(vj.length) - 0) return true; }
    }
    return false;
  }
  function latAccepted(item, all) {
    let forms = latForms(item.la).concat(item.lat || []);
    if (all) { // Wörter mit gleicher deutscher Hauptbedeutung ("uns", "euch", "weil") gelten gegenseitig
      const mine = deVariantsRaw(item.de).slice(0, 1).map(x => deNorm(stripArticle(x)))[0];
      all.forEach(o => { if (o.id !== item.id && deNorm(stripArticle(deVariantsRaw(o.de)[0] || '')) === mine && o.type === item.type) forms = forms.concat(latForms(o.la)); });
    }
    return forms;
  }
  function matchLatin(alts, item, all) {
    const forms = latAccepted(item, all).map(latKey).filter(Boolean);
    for (const alt of alts) {
      const cands = new Set([latKey(alt)]);
      String(alt).split(/\s+/).forEach(w => cands.add(latKey(w)));
      for (const c of cands) {
        if (!c) continue;
        for (const fk of forms) { if (lev(c, fk) <= tolFor(Math.max(fk.length, 1))) return true; }
      }
    }
    return false;
  }

  /* ---------- Aussprache (deutsche Schulaussprache über deutsche Stimme) ---------- */
  const PRON_OVR = { deus: 'de-us', europa: 'e-uropa', aeolus: 'ä-olus', mortuus: 'mortu-us', deesse: 'de-esse', desum: 'de-sum', ei: 'ei', ibi: 'ibi', sui: 'sui' };
  function pronWord(w) {
    let s = stripMacron(w.toLowerCase());
    if (PRON_OVR[s]) return PRON_OVR[s];
    s = s.replace(/^i(?=[aeiou])/, 'j').replace(/qu/g, 'kw').replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/eu/g, 'e-u')
      .replace(/c/g, 'k').replace(/v/g, 'w').replace(/y/g, 'ü');
    return s;
  }
  function pron(la) { return latForms(la).map(f => f.split(/\s+/).map(pronWord).join(' ')).join(', '); }

  /* ---------- Zahlen / Lektionen ---------- */
  const NUMW = { ein: 1, eins: 1, eine: 1, einen: 1, erste: 1, erster: 1, zwei: 2, zwo: 2, zweite: 2, drei: 3, dritte: 3, vier: 4, vierte: 4, fuenf: 5, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwoelf: 12, zwölf: 12, dreizehn: 13, vierzehn: 14, fuenfzehn: 15, fünfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19, zwanzig: 20 };
  const range = (a, b) => { const r = []; for (let i = Math.min(a, b); i <= Math.max(a, b); i++) r.push(i); return r; };
  function parseLessons(text, max = 20) {
    let t = String(text).toLowerCase().replace(/ß/g, 'ss').replace(/einschliesslich|inklusive|einschließlich/g, ' ')
      .replace(/(\d+)\s*[-–—]\s*(\d+)/g, '$1 bis $2').replace(/[.,;:!?]/g, ' ');
    const toks = t.split(/\s+/).filter(Boolean);
    const seq = [];
    for (const k of toks) {
      if (/^\d+$/.test(k)) seq.push({ n: parseInt(k, 10) });
      else if (NUMW[k] !== undefined) seq.push({ n: NUMW[k] });
      else if (k === 'bis') seq.push({ op: 'bis' });
      else if (k === 'ab') seq.push({ op: 'ab' });
      else if (/^(alle|alles|komplett|saemtliche|sämtliche|ganze|gesamte)/.test(k)) seq.push({ all: true });
    }
    const out = new Set(); let all = false;
    for (let i = 0; i < seq.length; i++) {
      const s = seq[i];
      if (s.all) { all = true; continue; }
      if (s.n !== undefined) {
        if (seq[i + 1] && seq[i + 1].op === 'bis' && seq[i + 2] && seq[i + 2].n !== undefined) { range(s.n, seq[i + 2].n).forEach(x => out.add(x)); i += 2; }
        else out.add(s.n);
      } else if (s.op === 'bis' && seq[i + 1] && seq[i + 1].n !== undefined) { range(1, seq[i + 1].n).forEach(x => out.add(x)); i += 1; }
      else if (s.op === 'ab' && seq[i + 1] && seq[i + 1].n !== undefined) { range(seq[i + 1].n, max).forEach(x => out.add(x)); i += 1; }
    }
    if (!out.size && all) range(1, max).forEach(x => out.add(x));
    const res = [...out].filter(x => x >= 1 && x <= max).sort((a, b) => a - b);
    return res.length ? res : null;
  }
  function describeLessons(ls) {
    if (!ls.length) return '';
    const runs = []; let s = ls[0], p = ls[0];
    for (let i = 1; i <= ls.length; i++) { if (ls[i] === p + 1) { p = ls[i]; continue; } runs.push([s, p]); s = ls[i]; p = ls[i]; }
    const parts = runs.map(([a, b]) => a === b ? String(a) : b === a + 1 ? a + ' und ' + b : a + ' bis ' + b);
    if (ls.length === 1) return 'Lektion ' + ls[0];
    if (runs.length === 1) return 'Lektion ' + parts[0];
    return 'Lektion ' + parts.slice(0, -1).join(', ') + ' und ' + parts[parts.length - 1];
  }
  function parseOrder(text) {
    const t = String(text).toLowerCase();
    if (/(durcheinander|gemischt|mischen|zufall|zufällig|zufaellig|bunt|alle zusammen|gemeinsam|alles zusammen|wild)/.test(t)) return 'mix';
    if (/(hintereinander|nacheinander|der reihe nach|eine nach der anderen|nach lektion|reihenfolge|einzeln|lektionsweise|nacheinander|eins nach dem anderen|erst|erste)/.test(t)) return 'seq';
    return null;
  }
  function yesNo(text) {
    const t = deNorm(text);
    if (/\b(nein|nee|falsch|nicht richtig|stimmt nicht|anders)\b/.test(t)) return 'no';
    if (/\b(ja|jo|jawohl|genau|richtig|stimmt|okay|ok|passt|klar|gerne|yes|sicher|na klar|los|weiter)\b/.test(t)) return 'yes';
    return null;
  }
  // Befehle während der Abfrage
  function parseCommand(text) {
    const t = deNorm(text);
    if (/\b(stopp|stop|beenden|aufhoeren|schluss|ende|abbrechen|ich will nicht mehr|pause)\b/.test(t)) return 'stop';
    if (/(weiss ich nicht|weiss nicht|keine ahnung|kein plan|ich weiss es nicht|weiss es nicht|ueberspringen|naechste|naechstes|aufgeben|ich kann das nicht|keine idee)/.test(t)) return 'giveup';
    if (/(tipp|tip |hinweis|hilf|helf|buchstabe|anfangsbuchstabe|hilfe)/.test(t + ' ')) return 'hint';
    if (/(wiederhol|nochmal|noch mal|noch einmal|wie bitte|was hast du gesagt|nochmals)/.test(t)) return 'repeat';
    return null;
  }

  /* ---------- Tipps ---------- */
  function hintAnswer(item, dir) {
    return dir === 'l2d' ? stripMacron(primaryDe(item)) : stripMacron(latDisplayFirst(item.la));
  }
  // n = wievieltes Zeichen (1-basiert) wird verraten
  function hint(item, dir, n) {
    const ans = hintAnswer(item, dir).replace(/\s+/g, ' ');
    const letters = [...ans];
    const chars = letters.filter(c => c !== ' ').length;
    let shown = '', count = 0;
    for (const c of letters) { if (c === ' ') { shown += '  '; continue; } count++; shown += (count <= n ? c : '_') + ' '; }
    const idx = Math.min(n, chars);
    const letter = letters.filter(c => c !== ' ')[idx - 1] || '';
    const ordinals = ['', 'erste', 'zweite', 'dritte', 'vierte', 'fünfte', 'sechste', 'siebte', 'achte', 'neunte', 'zehnte'];
    const ord = idx <= 10 ? ordinals[idx] : idx + '.';
    return { letter: letter.toUpperCase(), index: idx, ordinal: ord, shown: shown.trim(), done: idx >= chars, said: idx === 1 ? `Der erste Buchstabe ist ${letter.toUpperCase()}.` : `Der ${ord} Buchstabe ist ${letter.toUpperCase()}.` };
  }

  /* ---------- Warteschlange / Richtung ---------- */
  function shuffle(a, rnd = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function buildQueue(items, order, rnd = Math.random) {
    if (order === 'mix') return shuffle(items, rnd);
    const by = {}; items.forEach(i => (by[i.lesson] = by[i.lesson] || []).push(i));
    return Object.keys(by).map(Number).sort((a, b) => a - b).flatMap(l => shuffle(by[l], rnd));
  }
  function requeue(queue, item, rnd = Math.random) { queue.splice(Math.min(queue.length, 3 + Math.floor(rnd() * 4)), 0, item); }
  // Wechsel: Wort, das zuletzt Latein->Deutsch gefragt wurde, kommt als nächstes Deutsch->Latein (und umgekehrt)
  function nextDir(memo, id, rnd = Math.random) {
    const last = memo[id];
    const d = last === 'l2d' ? 'd2l' : last === 'd2l' ? 'l2d' : (rnd() < .5 ? 'l2d' : 'd2l');
    memo[id] = d; return d;
  }
  // Auswahlmöglichkeiten (Bildmodus)
  function makeOptions(item, dir, pool, rnd = Math.random) {
    const label = (it, d) => d === 'l2d' ? shortDe(it, 1) : it.la;
    const correct = label(item, dir);
    const same = pool.filter(o => o.id !== item.id && label(o, dir) !== correct);
    const sameType = shuffle(same.filter(o => o.type === item.type), rnd);
    const rest = shuffle(same.filter(o => o.type !== item.type), rnd);
    const picks = []; const seen = new Set([correct]);
    for (const o of sameType.concat(rest)) { const l = label(o, dir); if (!seen.has(l)) { seen.add(l); picks.push(o); } if (picks.length === 2) break; }
    return shuffle([{ item, text: correct, ok: true }].concat(picks.map(o => ({ item: o, text: label(o, dir), ok: false }))), rnd);
  }

  return { stripMacron, deNorm, lev, latKey, latForms, latDisplayFirst, deVariantsRaw, deVariants, primaryDe, shortDe, deSpeak, matchGerman, matchLatin, latAccepted, pron, parseLessons, describeLessons, parseOrder, yesNo, parseCommand, hint, shuffle, buildQueue, requeue, nextDir, makeOptions };
});
