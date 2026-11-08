/* Einfache, einheitliche Illustrationen (SVG, 100x100). Gleicher Stil: dicke dunkle Kontur, flache Farben. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.Icons = f(); })(this, function () {
  const K = { ink: '#2b2d42', red: '#ef476f', yel: '#ffd166', grn: '#06d6a0', blu: '#118ab2', nav: '#1d3557', brn: '#a47148', gry: '#adb5bd', wht: '#ffffff', sk: '#f6c9a0', pur: '#8e7dff', org: '#ff9f1c', lbl: '#a8dadc', dgn: '#2a9d8f', pnk: '#ffafcc', sand: '#e9c46a' };
  const Ci = (x, y, r, c, x2 = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${x2}/>`;
  const R = (x, y, w, h, c, rx = 3, x2 = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${c}" ${x2}/>`;
  const Pa = (d, c, x2 = '') => `<path d="${d}" fill="${c}" ${x2}/>`;
  const Pg = (p, c, x2 = '') => `<polygon points="${p}" fill="${c}" ${x2}/>`;
  const Li = (x1, y1, x2, y2, c = K.ink, w = 3, x3 = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" ${x3}/>`;
  const E = (x, y, rx, ry, c, x2 = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" ${x2}/>`;
  const T = (t, x, y, s = 24, c = K.ink) => `<text x="${x}" y="${y}" font-size="${s}" font-weight="800" text-anchor="middle" fill="${c}" stroke="none" font-family="system-ui,Arial,sans-serif">${t}</text>`;
  const G = (tr, inner) => `<g transform="${tr}">${inner}</g>`;
  const NS = 'stroke="none"';
  const heart = (x, y, s = 1, c = K.red) => G(`translate(${x} ${y}) scale(${s})`, Pa('M0 12C-22 -4 -12 -22 0 -10C12 -22 22 -4 0 12Z', c));
  const star = (x, y, r = 10, c = K.yel, n = 5, k = .45) => { const p = []; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * k : r; p.push((x + rr * Math.cos(a)).toFixed(1) + ',' + (y + rr * Math.sin(a)).toFixed(1)); } return Pg(p.join(' '), c); };
  const arrow = (x1, y1, x2, y2, c = K.red, w = 5) => { const a = Math.atan2(y2 - y1, x2 - x1), h = 11; const bx = x2 - h * Math.cos(a), by = y2 - h * Math.sin(a), px = -Math.sin(a) * h * .75, py = Math.cos(a) * h * .75; return `<line x1="${x1}" y1="${y1}" x2="${bx}" y2="${by}" stroke="${c}" stroke-width="${w}"/><polygon points="${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}" fill="${c}" stroke="${c}" stroke-width="2"/>`; };
  const face = (x, y, r = 14, m = 'smile', c = K.sk) => {
    const ex = r * .38, ey = y - r * .15, er = m === 'scared' ? r * .17 : r * .1, my = y + r * .35;
    let s = Ci(x, y, r, c) + Ci(x - ex, ey, er, K.ink, NS) + Ci(x + ex, ey, er, K.ink, NS);
    if (m === 'smile') s += `<path d="M${x - r * .4} ${my}Q${x} ${my + r * .45} ${x + r * .4} ${my}" fill="none" stroke-width="2.5"/>`;
    else if (m === 'laugh') s += `<path d="M${x - r * .5} ${my - r * .1}H${x + r * .5}Q${x + r * .4} ${my + r * .55} ${x} ${my + r * .55}Q${x - r * .4} ${my + r * .55} ${x - r * .5} ${my - r * .1}Z" fill="${K.red}" stroke-width="2.5"/>`;
    else if (m === 'sad' || m === 'cry') s += `<path d="M${x - r * .4} ${my + r * .3}Q${x} ${my - r * .25} ${x + r * .4} ${my + r * .3}" fill="none" stroke-width="2.5"/>`;
    else if (m === 'scared') s += Ci(x, my + r * .1, r * .2, K.ink, NS);
    else s += `<line x1="${x - r * .3}" y1="${my}" x2="${x + r * .3}" y2="${my}" stroke-width="2.5"/>`;
    if (m === 'cry') s += Ci(x - ex, ey + r * .5, r * .12, K.lbl, NS) + Ci(x + ex, ey + r * .5, r * .12, K.lbl, NS) + Ci(x - ex, ey + r * .85, r * .1, K.lbl, NS) + Ci(x + ex, ey + r * .85, r * .1, K.lbl, NS);
    return s;
  };
  const man = (x, y, c = K.blu, s = 1, m = 'smile', hair = null) => {
    let pre = '', post = '';
    if (hair) { const [st, col] = hair.split(':'); if (st === 'long') { pre = E(0, -29, 13, 14, col); post = Pa('M-10 -36Q0 -46 10 -36Q0 -39 -10 -36Z', col, NS); } else { post = Pa('M-10 -33Q-9 -45 0 -44Q9 -45 10 -33Q0 -38 -10 -33Z', col); } }
    return G(`translate(${x} ${y}) scale(${s})`, pre + Pa('M-13 0V-10A13 13 0 0 1 13 -10V0Z', c) + face(0, -32, 10, m) + post);
  };
  const grpAt = (cx, n, y = 90, s = 1.1, cols = [K.blu, K.org, K.grn, K.pur, K.red]) => { let o = ''; const gap = Math.min(22 * s, (86 - 26 * s) / Math.max(n - 1, 1)); for (let i = 0; i < n; i++) o += man(cx + (i - (n - 1) / 2) * gap, y, cols[i % cols.length], s); return o; };
  const grp = (n, y = 90, s = 1.1, cols) => grpAt(50, n, y, s, cols);
  const tree = (x, y, s = 1) => R(x - 3 * s, y - 16 * s, 6 * s, 16 * s, K.brn, 1) + Ci(x, y - 26 * s, 15 * s, K.grn);
  const houseF = (x, y, s = 1, wall = '#f4a261', roof = K.red) => R(x - 20 * s, y - 26 * s, 40 * s, 26 * s, wall, 2) + Pg(`${x - 25 * s},${y - 26 * s} ${x},${y - 48 * s} ${x + 25 * s},${y - 26 * s}`, roof) + R(x - 5 * s, y - 15 * s, 10 * s, 15 * s, K.brn, 1) + R(x + 9 * s, y - 22 * s, 8 * s, 8 * s, K.lbl, 1) + R(x - 17 * s, y - 22 * s, 8 * s, 8 * s, K.lbl, 1);
  const temple = (x, y, s = 1, c = '#f1faee') => Pg(`${x - 28 * s},${y - 34 * s} ${x},${y - 52 * s} ${x + 28 * s},${y - 34 * s}`, K.red) + R(x - 28 * s, y - 34 * s, 56 * s, 6 * s, c, 1) + [-22, -8, 6, 20].map(dx => R(x + dx * s - 3 * s, y - 28 * s, 6 * s, 24 * s, c, 1)).join('') + R(x - 30 * s, y - 4 * s, 60 * s, 6 * s, c, 1);
  const clock = (x = 50, y = 50, r = 36) => Ci(x, y, r, K.wht) + Li(x, y, x, y - r * .6, K.ink, 4) + Li(x, y, x + r * .4, y + r * .2, K.ink, 4) + Ci(x, y, 3, K.ink) + [0, 90, 180, 270].map(a => { const q = a * Math.PI / 180; return Li(x + (r - 8) * Math.sin(q), y - (r - 8) * Math.cos(q), x + (r - 3) * Math.sin(q), y - (r - 3) * Math.cos(q), K.ink, 2.5); }).join('');
  const bubble = (x, y, w, h, c = K.wht, tail = 'l') => R(x, y, w, h, c, 8) + (tail === 'l' ? Pg(`${x + 8},${y + h - 1} ${x + 6},${y + h + 12} ${x + 22},${y + h - 1}`, c, 'stroke-linejoin="round"') : Pg(`${x + w - 8},${y + h - 1} ${x + w - 6},${y + h + 12} ${x + w - 22},${y + h - 1}`, c));
  const glass = (fill = K.lbl, level = 46) => Pa('M28 12H72L66 90H34Z', K.wht) + Pa(`M${28 + (level - 12) * 0.075} ${level}H${72 - (level - 12) * 0.075}L66 90H34Z`, fill, NS) + Pa('M28 12H72L66 90H34Z', 'none');
  const volcano = () => Pg('8,90 38,36 62,36 92,90', K.brn) + Pa('M38 36H62L58 42Q50 48 42 42Z', K.org) + Pa('M46 42Q44 60 36 76', 'none', `stroke="${K.red}" stroke-width="5"`) + Pa('M54 44Q58 62 66 80', 'none', `stroke="${K.red}" stroke-width="5"`) + Pg('44,38 50,16 56,38', K.org) + Ci(40, 14, 8, '#dee2e6') + Ci(60, 10, 10, '#ced4da');
  const cycle = (c = K.blu) => `<path d="M22 46A30 30 0 0 1 74 26" fill="none" stroke="${c}" stroke-width="7"/>` + Pg('80,16 82,40 60,32', c, `stroke="${c}"`) + `<path d="M78 54A30 30 0 0 1 26 74" fill="none" stroke="${c}" stroke-width="7"/>` + Pg('20,84 18,60 40,68', c, `stroke="${c}"`);
  const globe = (hl) => { const land = { eu: 'M36 20L50 14L58 24L52 34L42 36L33 30Z', as: 'M58 18L86 24L88 46L74 54L62 42L56 28Z', af: 'M40 42L58 44L62 62L54 82L44 76L36 56Z', am: 'M12 26L28 22L30 46L20 58L12 44Z' }; let s = Ci(50, 50, 40, K.lbl); ['eu', 'as', 'af', 'am'].forEach(k => { s += Pa(land[k], k === hl ? K.red : '#95d5b2'); }); return s; };
  const envelope = (x = 14, y = 30, w = 72, h = 46) => R(x, y, w, h, K.wht, 4) + `<path d="M${x} ${y + 3}L${x + w / 2} ${y + h * .6}L${x + w} ${y + 3}" fill="none"/>`;
  const sparkle = (x, y, r = 8) => star(x, y, r, K.yel, 4, .35);
  const ownBall = (c, n = 1, ballc = K.red) => (n === 1 ? man(28, 92, c, 1.7) : grpAt(34, 3, 92, .8, [c, K.org, K.grn])) + Li(n === 1 ? 44 : 60, 58, 72, 68, K.ink, 2.5, 'stroke-dasharray="4 4"') + Ci(80, 74, 12, ballc);
  const giftTo = (n, c) => R(6, 42, 22, 20, K.red, 3) + Li(17, 42, 17, 62, K.yel, 4) + arrow(32, 52, 46, 52, K.dgn, 5) + (n === 1 ? man(76, 92, c, 1.7) : grpAt(70, 3, 92, .85, [c, K.org, K.grn]));
  const star8 = (x, y, r, c) => star(x, y, r, c, 8, .6);

  const I = {
    girl: () => man(50, 92, K.pnk, 2.1, 'smile', 'long:' + K.brn), maid: () => man(38, 92, K.pur, 1.9, 'smile', 'long:' + K.brn) + R(62, 56, 30, 6, K.gry, 2) + Ci(77, 50, 8, K.red),
    forest: () => tree(24, 88, 1.1) + tree(74, 88, 1.1) + tree(50, 94, 1.5), road: () => R(4, 38, 92, 56, '#95d5b2', 6) + Pg('42,38 58,38 92,94 8,94', K.gry) + [48, 62, 78].map((y, i) => R(48 - i, y, 4 + i * 2, 8, K.wht, 1, NS)).join(''),
    house: () => houseF(50, 90, 1.6), grandpa: () => man(50, 92, K.nav, 2.1, 'smile') + Pa('M38 44Q50 68 62 44Q50 50 38 44Z', '#f1f3f5') + Pa('M38 28Q50 8 62 28Q50 20 38 28Z', '#f1f3f5', NS),
    field: () => R(6, 40, 88, 52, '#95d5b2', 6) + [54, 66, 78].map(y => Li(14, y, 86, y, '#52b788', 4)).join('') + [24, 44, 64, 82].map(x => Pa(`M${x} 52V38`, 'none', `stroke="${K.dgn}" stroke-width="3"`) + Ci(x, 36, 4, K.yel)).join(''),
    horse: () => Li(22, 52, 10, 76, K.brn, 7) + E(48, 56, 26, 14, K.brn) + Pa('M66 52L76 26L90 32L84 58Z', K.brn) + Pa('M76 26L96 32L97 44L84 44Z', K.brn) + Pg('76,26 78,14 84,28', K.brn) + Ci(88, 34, 2.5, K.ink, NS) + [30, 40, 56, 66].map(x => R(x - 3, 64, 6, 26, K.brn, 2)).join('') + Pa('M68 30Q62 40 66 52', 'none', `stroke="${K.ink}" stroke-width="4"`),
    wall: () => R(8, 22, 84, 66, '#e76f51', 3) + [38, 54, 70].map(y => Li(8, y, 92, y, K.wht, 2)).join('') + [30, 56, 80, 18, 44, 68].map((x, i) => Li(x, i < 3 ? 22 : 38, x, i < 3 ? 38 : 54, K.wht, 2)).join('') + [8, 32, 56, 78].map(x => R(x, 12, 14, 12, '#e76f51', 2)).join(''),
    servant: () => man(36, 92, K.grn, 1.9) + R(58, 56, 32, 6, K.gry, 2) + Ci(66, 50, 7, K.red) + Ci(82, 50, 7, K.yel), village: () => houseF(26, 80, .8) + houseF(74, 80, .8, '#e9c46a', K.blu) + houseF(50, 92, 1, '#f4a261', K.pur),
    plus: () => Ci(50, 50, 38, K.grn) + Li(50, 28, 50, 72, K.wht, 10) + Li(28, 50, 72, 50, K.wht, 10), equals: () => Ci(50, 50, 38, K.blu) + Li(30, 40, 70, 40, K.wht, 9) + Li(30, 60, 70, 60, K.wht, 9),
    is1: () => man(38, 92, K.blu, 2) + Ci(80, 30, 16, K.grn) + `<path d="M72 30L78 37L89 24" fill="none" stroke="#fff" stroke-width="5"/>`, is3: () => grp(3, 92, 1.3) + Ci(84, 22, 13, K.grn) + `<path d="M77 22L82 28L91 17" fill="none" stroke="#fff" stroke-width="4"/>`,
    laugh: () => face(50, 52, 38, 'laugh', K.yel) + Ci(14, 70, 4, K.lbl, NS) + Ci(86, 70, 4, K.lbl, NS) + Pa('M10 30Q4 22 12 16', 'none', 'stroke-width="3"') + Pa('M90 30Q96 22 88 16', 'none', 'stroke-width="3"'),
    no: () => Ci(50, 50, 38, K.red) + Li(32, 32, 68, 68, K.wht, 10) + Li(68, 32, 32, 68, K.wht, 10), why: () => bubble(10, 12, 80, 58, K.wht) + T('?', 50, 58, 52, K.pur),
    obey: () => man(26, 92, K.nav, 1.6) + bubble(34, 8, 36, 26, K.yel, 'l') + T('!', 52, 30, 24, K.red) + man(76, 92, K.grn, 1.4) + `<path d="M64 52L70 58L84 42" fill="none" stroke="${K.grn}" stroke-width="5"/>`,
    warn: () => Pg('50,10 92,86 8,86', K.yel, 'stroke-linejoin="round"') + T('!', 50, 76, 54, K.ink), must: () => Ci(50, 50, 38, K.blu) + T('!', 50, 70, 62, K.wht), what: () => Ci(50, 50, 38, K.pur) + T('?', 50, 70, 62, K.wht),
    afraid: () => face(50, 54, 36, 'scared') + Pa('M82 22C88 32 90 36 90 40A8 8 0 0 1 74 40C74 36 78 32 82 22Z', K.lbl) + Li(26, 16, 30, 26, K.ink, 3) + Li(50, 10, 50, 20, K.ink, 3) + Li(74, 16, 70, 26, K.ink, 3),
    eye: () => Pa('M6 50Q50 10 94 50Q50 90 6 50Z', K.wht) + Ci(50, 50, 18, K.blu) + Ci(50, 50, 8, K.ink, NS) + Ci(44, 44, 4, K.wht, NS),
    pain: () => face(50, 56, 34, 'sad') + G('rotate(-25 50 30)', R(30, 22, 40, 12, '#ffe5b4', 3) + Ci(42, 28, 1.5, K.brn, NS) + Ci(58, 28, 1.5, K.brn, NS)) + star8(86, 22, 10, K.red) + star8(14, 24, 8, K.red),
    clock: () => clock(), silent: () => face(50, 52, 36, 'neutral') + R(45, 58, 10, 32, K.sk, 5),
    here: () => Pa('M50 92C30 62 22 52 22 38A28 28 0 0 1 78 38C78 52 70 62 50 92Z', K.red) + Ci(50, 38, 11, K.wht) + E(50, 94, 18, 4, '#adb5bd', NS), there: () => man(18, 92, K.blu, 1.1) + arrow(30, 56, 64, 56, K.org, 5) + G('translate(60 26) scale(.55)', Pa('M50 92C30 62 22 52 22 38A28 28 0 0 1 78 38C78 52 70 62 50 92Z', K.red) + Ci(50, 38, 11, K.wht)),
    lord: () => man(50, 92, '#f1faee', 2.1) + R(41, 70, 18, 22, K.red, 1, NS) + Pg('38,20 42,6 50,14 58,6 62,20', K.yel), sit: () => R(28, 12, 9, 52, K.brn, 3) + R(28, 52, 46, 10, K.brn, 3) + R(30, 62, 8, 30, K.brn, 2) + R(64, 62, 8, 30, K.brn, 2),
    but: () => arrow(14, 36, 86, 36, K.blu, 7) + arrow(86, 66, 14, 66, K.red, 7), answer: () => bubble(6, 10, 50, 34, K.lbl, 'l') + T('?', 31, 36, 28) + bubble(44, 52, 50, 34, K.grn, 'r') + T('!', 69, 78, 28, K.wht),
    who: () => man(34, 92, K.gry, 1.8, 'neutral') + T('?', 78, 58, 60, K.pur), grow: () => R(14, 62, 18, 28, K.lbl, 3) + R(40, 46, 18, 44, K.blu, 3) + R(66, 26, 18, 64, K.nav, 3) + arrow(18, 50, 76, 12, K.grn, 5),
    nor: () => Ci(50, 50, 34, '#e9ecef') + Li(30, 50, 70, 50, K.ink, 7) + Li(50, 30, 50, 70, K.ink, 7) + Li(20, 80, 80, 20, K.red, 8), neithernor: () => Ci(26, 50, 20, '#e9ecef') + Ci(74, 50, 20, '#e9ecef') + Li(14, 38, 38, 62, K.red, 6) + Li(86, 38, 62, 62, K.red, 6) + Li(40, 50, 60, 50, K.ink, 4),
    scare: () => face(50, 62, 30, 'scared') + Li(34, 22, 30, 36, K.ink, 4) + Li(50, 16, 50, 30, K.ink, 4) + Li(66, 22, 70, 36, K.ink, 4) + T('!', 14, 40, 36, K.red) + T('!', 86, 40, 36, K.red),
    speech: () => bubble(8, 14, 84, 54, K.wht) + Li(22, 32, 78, 32, K.ink, 4) + Li(22, 44, 66, 44, K.ink, 4) + Li(22, 56, 52, 56, K.ink, 4),
    because: () => R(6, 32, 32, 36, K.lbl, 6) + T('?', 22, 60, 30) + arrow(40, 50, 60, 50, K.ink, 5) + R(62, 32, 32, 36, K.yel, 6) + T('!', 78, 60, 30),
    joy: () => face(50, 54, 34, 'smile', K.yel) + sparkle(16, 22, 10) + sparkle(86, 26, 9) + sparkle(84, 80, 7), friends: () => man(30, 90, K.blu, 1.5) + man(70, 90, K.org, 1.5) + heart(50, 22, .8),
    teach: () => R(34, 8, 62, 42, K.dgn, 3) + Li(42, 20, 84, 20, K.wht, 3) + Li(42, 30, 72, 30, K.wht, 3) + Li(42, 40, 80, 40, K.wht, 3) + man(24, 92, K.nav, 1.5) + Li(34, 66, 52, 46, K.brn, 3),
    study: () => Pa('M50 28Q30 18 8 26V78Q30 70 50 80Z', K.wht) + Pa('M50 28Q70 18 92 26V78Q70 70 50 80Z', K.wht) + [38, 48, 58].map(y => Li(16, y - 6, 42, y, K.lbl, 3) + Li(84, y - 6, 58, y, K.lbl, 3)).join(''),
    board: () => R(14, 14, 72, 54, K.sand, 3) + R(20, 20, 60, 42, K.lbl, 1) + Pg('20,62 40,36 56,54 66,44 80,62', K.dgn) + Ci(68, 30, 6, K.yel) + Li(30, 68, 22, 94, K.brn, 5) + Li(70, 68, 78, 94, K.brn, 5),
    hold: () => Ci(50, 38, 20, K.red) + Pa('M18 58Q50 84 82 58L86 92H14Z', K.sk) + [26, 38, 50, 62].map(x => R(x, 44, 10, 26, K.sk, 5)).join(''),
    give: () => R(32, 8, 36, 28, K.red, 3) + R(46, 8, 8, 28, K.yel, 1) + Pa('M10 78Q40 62 66 74L88 68L90 80L66 92H10Z', K.sk) + Li(40, 40, 40, 62, K.ink, 3, 'stroke-dasharray="3 4"'),
    already: () => clock(46, 52, 34) + Ci(80, 24, 14, K.grn) + `<path d="M73 24L78 30L88 17" fill="none" stroke="#fff" stroke-width="4"/>`, then: () => Ci(24, 50, 18, K.lbl) + T('1', 24, 60, 28) + arrow(44, 50, 56, 50, K.ink, 5) + Ci(76, 50, 18, K.blu) + T('2', 76, 60, 28, K.wht),
    first: () => Pg('34,60 24,94 40,86 48,94 54,62', K.red) + Pg('66,60 76,94 60,86 52,94 46,62', K.blu) + Ci(50, 40, 30, K.yel) + T('1', 50, 54, 40),
    right: () => Ci(50, 50, 38, K.grn) + `<path d="M28 52L44 68L74 34" fill="none" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>`, nomore: () => clock(50, 50, 34) + Li(18, 82, 82, 18, K.red, 8),
    often: () => cycle(K.blu) + T('×', 50, 62, 40, K.ink), never: () => T('∞', 50, 68, 84, K.gry) + Ci(50, 50, 40, 'none', `stroke="${K.red}" stroke-width="8"`) + Li(22, 78, 78, 22, K.red, 8),
    sound: () => Pa('M10 38H28L50 18V82L28 62H10Z', K.blu) + ['M60 36Q68 50 60 64', 'M70 26Q86 50 70 74', 'M80 18Q98 50 80 82'].map(d => Pa(d, 'none', `stroke="${K.org}" stroke-width="5"`)).join(''),
    hide: () => Ci(26, 72, 20, K.grn) + Ci(50, 66, 26, K.dgn) + Ci(76, 74, 20, K.grn) + Ci(40, 54, 9, K.wht) + Ci(40, 54, 4, K.ink, NS) + Ci(62, 54, 9, K.wht) + Ci(62, 54, 4, K.ink, NS),
    sudden: () => Pg('58,6 22,56 46,56 38,94 80,38 56,38', K.yel, 'stroke-linejoin="round"'), sword: () => Pg('45,8 55,8 57,66 43,66', K.gry) + R(30, 66, 40, 9, K.brn, 3) + R(45, 75, 10, 16, K.brn, 2) + Ci(50, 94, 5, K.yel),
    twist: () => `<path d="M50 50m0 0a5 5 0 0 1 10 0a14 14 0 0 1-28 0a24 24 0 0 1 48 0a34 34 0 0 1-68 0" fill="none" stroke="${K.pur}" stroke-width="7"/>`,
    criminal: () => man(36, 92, K.nav, 1.9, 'neutral') + R(21, 52, 30, 10, K.ink, 5) + Pa('M62 62Q58 94 78 94Q96 94 92 62Z', K.brn) + T('€', 77, 88, 24, K.yel),
    cry: () => face(50, 52, 38, 'cry') + Pa('M80 20C86 30 88 34 88 38A8 8 0 0 1 72 38C72 34 76 30 80 20Z', K.lbl, NS),
    like: () => R(8, 46, 20, 44, K.blu, 3) + Pa('M32 50L48 12Q62 10 60 28L58 40H84Q94 42 92 54L87 80Q85 90 76 90H32Z', K.sk),
    whom: () => arrow(8, 52, 54, 52, K.org, 6) + man(76, 92, K.blu, 1.7) + T('?', 30, 38, 34, K.pur), immediately: () => Ci(50, 56, 32, K.wht) + R(42, 10, 16, 10, K.gry, 2) + Li(50, 56, 50, 36, K.ink, 4) + Li(50, 56, 64, 62, K.ink, 4) + Pg('84,12 76,32 84,30 80,46 92,24 84,26', K.yel, NS),
    also: () => star(28, 52, 22, K.yel) + Li(48, 52, 56, 52, K.ink, 5) + Li(52, 48, 52, 56, K.ink, 5) + star(76, 52, 18, K.org), again: () => cycle(K.dgn) + T('2', 50, 62, 34, K.ink),
    therefore: () => T('∴', 50, 40, 36, K.ink) + arrow(12, 66, 88, 66, K.dgn, 10), only: () => [[18, 50], [82, 50], [34, 22], [66, 22], [34, 78], [66, 78]].map(([x, y]) => Ci(x, y, 8, '#e9ecef', 'stroke-dasharray="3 3"')).join('') + Ci(50, 50, 16, K.org),
    food: () => Ci(34, 62, 22, K.red) + Pa('M34 40Q36 28 44 26', 'none', `stroke="${K.brn}" stroke-width="4"`) + Pa('M34 38Q46 30 50 38Q40 44 34 38Z', K.grn) + Pa('M50 44Q74 28 94 48Q96 70 84 78H58Q44 66 50 44Z', K.sand),
    chest: () => R(12, 40, 76, 48, K.brn, 4) + R(12, 40, 76, 18, '#c08552', 6) + R(42, 52, 16, 14, K.yel, 3) + Li(12, 58, 88, 58, K.ink, 3),
    fill: () => glass(K.lbl, 44) + Pa('M46 6V28', 'none', `stroke="${K.blu}" stroke-width="5"`) + Ci(46, 30, 4, K.blu, NS),
    pile: () => [[30, 84], [50, 84], [70, 84], [40, 66], [60, 66], [50, 48]].map(([x, y]) => Ci(x, y, 11, K.yel) + T('€', x, y + 5, 12)).join(''),
    water: () => Pa('M50 8C70 36 82 50 82 64A32 32 0 0 1 18 64C18 50 30 36 50 8Z', K.blu) + Pa('M34 60Q36 74 46 78', 'none', 'stroke="#fff" stroke-width="5" stroke-linecap="round"'),
    wind: () => ['M10 34H62A10 10 0 1 0 52 24', 'M10 52H78A10 10 0 1 1 68 62', 'M10 70H50A9 9 0 1 1 41 79'].map(d => Pa(d, 'none', `stroke="${K.blu}" stroke-width="6"`)).join(''),
    destroy: () => star8(50, 50, 44, K.org) + star8(50, 50, 26, K.yel) + T('!', 50, 62, 34, K.red), untilnow: () => arrow(8, 60, 66, 60, K.dgn, 7) + Ci(78, 60, 10, K.red) + Li(78, 28, 78, 44, K.ink, 4) + Ci(78, 22, 4, K.ink, NS),
    people: () => man(28, 92, K.blu, 1.3) + man(72, 92, K.org, 1.3) + man(50, 84, K.grn, 1.3) + star(50, 14, 10), crowd: () => grp(5, 92, 1) + grp(4, 62, .8),
    aeolus: () => man(30, 92, K.dgn, 1.9, 'neutral') + ['M52 34H88', 'M54 46H80', 'M52 58H90'].map(d => Pa(d, 'none', `stroke="${K.blu}" stroke-width="5"`)).join('') + Ci(46, 40, 3, K.ink, NS),
    god: () => man(50, 94, '#f1faee', 2) + E(50, 14, 16, 5, 'none', `stroke="${K.yel}" stroke-width="5"`) + [20, 50, 80].map(x => Li(x, 6, x + (x - 50) * .3, 0, K.yel, 3)).join(''),
    goddess: () => man(50, 94, K.pnk, 2, 'smile', 'long:' + K.brn) + E(50, 14, 16, 5, 'none', `stroke="${K.yel}" stroke-width="5"`),
    certain: () => Pa('M50 8L88 22V50C88 72 70 86 50 94C30 86 12 72 12 50V22Z', K.grn) + `<path d="M32 50L45 63L70 34" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round"/>`,
    thanks: () => heart(50, 34, 1.8) + Pa('M10 80Q40 64 66 76L88 70L90 82L66 94H10Z', K.sk),
    health: () => R(38, 14, 24, 72, K.red, 4) + R(14, 38, 72, 24, K.red, 4), wave: () => R(30, 44, 36, 46, K.sk, 12) + [30, 42, 54, 64].map((x, i) => R(x - 2, 16 + (i % 3 === 1 ? -4 : 2), 10, 36, K.sk, 5)).join('') + Pa('M12 30Q6 44 12 58', 'none', `stroke="${K.blu}" stroke-width="5"`) + Pa('M88 30Q94 44 88 58', 'none', `stroke="${K.blu}" stroke-width="5"`),
    tear: () => Pa('M50 6C68 34 80 48 80 64A30 30 0 0 1 20 64C20 48 32 34 50 6Z', K.lbl) + Pa('M34 62Q36 74 46 78', 'none', 'stroke="#fff" stroke-width="5" stroke-linecap="round"'),
    move: () => [[50, 50, 50, 10], [50, 50, 50, 90], [50, 50, 10, 50], [50, 50, 90, 50]].map(([a, b, c, d]) => arrow(a, b, c, d, K.blu, 7)).join('') + Ci(50, 50, 8, K.org),
    finally: () => Li(28, 10, 28, 94, K.brn, 5) + R(28, 12, 52, 36, K.wht, 1) + [[28, 12], [54, 12], [41, 30], [67, 30]].map(([x, y]) => R(x, y, 13, 9, K.ink, 0, NS)).join('') + [[41, 12], [67, 12], [28, 30], [54, 30]].map(([x, y]) => R(x, y, 13, 9, K.ink, 0, NS)).join('').replace(/./g, c => c).slice(0, 0),
    soon: () => clock(42, 54, 30) + arrow(66, 20, 92, 20, K.red, 6), open: () => R(20, 8, 60, 84, '#2b2d42', 2) + R(26, 14, 48, 78, K.yel, 0, NS) + Pg('26,14 54,22 54,86 26,92', K.org),
    island: () => E(50, 82, 40, 12, K.lbl) + E(50, 74, 28, 9, K.sand) + Pa('M52 74Q50 50 54 28', 'none', `stroke="${K.brn}" stroke-width="6"`) + Pa('M54 28Q36 20 26 32Q42 28 54 28Z', K.grn) + Pa('M54 28Q72 18 82 32Q66 28 54 28Z', K.grn) + Pa('M54 28Q54 14 44 10Q52 18 54 28Z', K.grn),
    rome: () => R(8, 34, 84, 54, K.sand, 3) + [0, 1, 2, 3, 4].map(i => Pa(`M${15 + i * 16} 50V44A5 5 0 0 1 ${25 + i * 16} 44V50Z`, K.brn) + Pa(`M${15 + i * 16} 76V70A5 5 0 0 1 ${25 + i * 16} 70V76Z`, K.brn)).join('') + Li(8, 58, 92, 58, K.ink, 2),
    girlfriends: () => man(32, 90, K.pnk, 1.5, 'smile', 'long:' + K.brn) + man(68, 90, K.pur, 1.5, 'smile', 'long:#e9c46a') + heart(50, 22, .8), sunny: () => Ci(50, 50, 22, K.yel) + [0, 45, 90, 135, 180, 225, 270, 315].map(a => { const q = a * Math.PI / 180; return Li(50 + 28 * Math.sin(q), 50 - 28 * Math.cos(q), 50 + 40 * Math.sin(q), 50 - 40 * Math.cos(q), K.org, 5); }).join('') + face(50, 50, 14, 'smile', K.yel),
    lady: () => man(50, 92, K.pur, 2.1, 'smile', 'long:' + K.brn) + Pg('38,20 42,8 50,16 58,8 62,20', K.yel), ask: () => man(34, 92, K.blu, 1.8) + R(56, 50, 8, 22, K.sk, 4) + T('?', 78, 46, 56, K.pur),
    love: () => heart(50, 54, 2.3) + heart(18, 24, .6, K.pnk) + heart(84, 28, .5, K.pnk), checklist: () => R(20, 10, 60, 80, K.wht, 5) + [28, 46, 64].map(y => `<path d="M28 ${y}L33 ${y + 5}L41 ${y - 6}" fill="none" stroke="${K.grn}" stroke-width="4"/>` + Li(48, y, 70, y, K.ink, 3)).join(''),
    work: () => G('rotate(-35 50 50)', R(46, 28, 8, 60, K.brn, 2) + R(26, 14, 48, 22, K.gry, 4)) + sparkle(78, 22, 9), call: () => man(30, 92, K.blu, 1.8) + bubble(52, 12, 42, 30, K.yel, 'l') + T('Hey!', 73, 33, 18),
    hurry: () => G('rotate(14 50 60)', man(54, 92, K.red, 1.8)) + Li(6, 40, 24, 40, K.ink, 4) + Li(2, 54, 20, 54, K.ink, 4) + Li(8, 68, 24, 68, K.ink, 4),
    meal: () => Ci(50, 50, 30, K.wht) + Ci(50, 50, 20, '#f8f9fa') + Ci(44, 46, 7, K.org) + Ci(56, 54, 6, K.grn) + Li(10, 24, 10, 76, K.gry, 5) + Li(90, 24, 90, 76, K.gry, 5),
    daughter: () => man(34, 92, K.pur, 1.8, 'smile', 'long:' + K.brn) + man(72, 92, K.pnk, 1.1, 'smile', 'long:#e9c46a') + heart(54, 28, .5), enter: () => R(46, 12, 46, 80, K.brn, 3) + R(52, 18, 34, 74, K.yel, 0, NS) + Ci(80, 56, 3, K.ink, NS) + arrow(6, 56, 44, 56, K.dgn, 7),
    table: () => R(8, 40, 84, 10, K.brn, 3) + R(16, 50, 8, 40, K.brn, 2) + R(76, 50, 8, 40, K.brn, 2) + Ci(34, 34, 8, K.red) + R(56, 24, 14, 16, K.lbl, 2),
    decorate: () => `<path d="M6 22Q50 80 94 22" fill="none" stroke="${K.ink}" stroke-width="3"/>` + [[20, 46, K.red], [38, 60, K.yel], [56, 62, K.blu], [74, 50, K.grn]].map(([x, y, c]) => Pg(`${x - 7},${y - 6} ${x + 7},${y - 6} ${x},${y + 10}`, c)).join(''),
    party: () => Li(30, 50, 34, 90, K.ink, 2) + Li(52, 42, 50, 90, K.ink, 2) + Li(72, 52, 66, 90, K.ink, 2) + Ci(30, 36, 16, K.red) + Ci(52, 28, 16, K.yel) + Ci(72, 38, 16, K.blu) + sparkle(12, 18, 8) + sparkle(90, 16, 8),
    family: () => man(24, 92, K.blu, 1.5) + man(52, 92, K.pnk, 1.5, 'smile', 'long:' + K.brn) + man(80, 92, K.grn, 1), thumb: () => I.like(),
    binoc: () => R(38, 36, 24, 18, K.nav, 3) + Ci(30, 62, 22, K.nav) + Ci(70, 62, 22, K.nav) + Ci(30, 62, 13, K.lbl) + Ci(70, 62, 13, K.lbl) + Ci(26, 58, 4, K.wht, NS) + Ci(66, 58, 4, K.wht, NS),
    from: () => Pa('M24 66C14 50 10 44 10 36A14 14 0 0 1 38 36C38 44 34 50 24 66Z', K.red) + Ci(24, 36, 5, K.wht) + arrow(40, 42, 92, 62, K.org, 6) + T('?', 70, 40, 30, K.pur),
    hourglass: () => Pg('26,8 74,8 54,50 74,92 26,92 46,50', K.wht) + Pg('36,14 64,14 50,40', K.yel, NS) + Pg('34,88 66,88 50,66', K.yel, NS) + R(20, 4, 60, 6, K.brn, 2) + R(20, 90, 60, 6, K.brn, 2),
    doubt: () => man(32, 92, K.blu, 1.8, 'neutral') + Ci(62, 40, 5, K.wht) + Ci(72, 26, 8, K.wht) + R(60, 6, 36, 22, K.wht, 11) + T('?', 78, 24, 20, K.pur),
    roman: () => Ci(50, 58, 24, K.sk) + Pa('M24 58A26 26 0 0 1 76 58H66V48H34V58Z', K.gry) + R(46, 18, 8, 20, K.red, 3) + Pa('M30 36Q50 4 70 36', K.red, NS).replace('fill="#ef476f"', 'fill="none"') + Ci(41, 62, 3, K.ink, NS) + Ci(59, 62, 3, K.ink, NS) + `<path d="M43 72Q50 77 57 72" fill="none" stroke-width="2.5"/>` + Li(50, 66, 50, 70, K.ink, 0.1),
    fight: () => G('rotate(40 50 50)', Pg('46,4 54,4 55,58 45,58', K.gry) + R(36, 58, 28, 7, K.brn, 3) + R(46, 65, 8, 22, K.brn, 2)) + G('rotate(-40 50 50)', Pg('46,4 54,4 55,58 45,58', K.gry) + R(36, 58, 28, 7, K.brn, 3) + R(46, 65, 8, 22, K.brn, 2)),
    trophy: () => Pa('M28 12H72V40A22 22 0 0 1 28 40Z', K.yel) + Pa('M28 20H14Q12 40 30 44M72 20H86Q88 40 70 44', 'none', `stroke="${K.yel}" stroke-width="6"`) + R(44, 60, 12, 16, K.yel, 2) + R(30, 76, 40, 12, K.brn, 3) + star(50, 32, 9, K.wht),
    syria: () => Pa('M12 28L48 14L84 22L90 50L66 58L72 86L36 86L26 60L10 48Z', '#95d5b2') + Pa('M52 64C44 52 42 48 42 44A10 10 0 0 1 62 44C62 48 60 52 52 64Z', K.red) + Ci(52, 44, 4, K.wht),
    homeland: () => houseF(50, 94, 1.6) + heart(50, 14, .8), province: () => Pa('M10 36L40 14L88 24L84 62L50 86L16 70Z', '#95d5b2') + Li(52, 20, 52, 54, K.ink, 3) + Pg('52,20 76,28 52,38', K.red),
    europe: () => globe('eu'), asia: () => globe('as'), africa: () => globe('af'),
    fox: () => Pg('22,44 22,8 46,28', K.org) + Pg('78,44 78,8 54,28', K.org) + Pa('M18 40Q50 12 82 40Q82 78 50 90Q18 78 18 40Z', K.org) + Pa('M32 62Q50 92 68 62Q50 68 32 62Z', K.wht) + Ci(50, 72, 5, K.ink, NS) + Ci(38, 50, 3.5, K.ink, NS) + Ci(62, 50, 3.5, K.ink, NS),
    unjust: () => Li(50, 14, 50, 86, K.ink, 5) + Li(16, 40, 84, 22, K.ink, 5) + Pa('M6 52H30L26 64H10Z', K.sand) + Pa('M70 34H96L90 48H76Z', K.sand) + R(30, 86, 40, 8, K.brn, 3) + T('!', 80, 78, 30, K.red),
    captive: () => man(50, 90, K.gry, 2, 'sad') + [18, 34, 50, 66, 82].map(x => R(x - 3, 8, 6, 86, K.nav, 2)).join(''), son: () => man(50, 92, K.blu, 2.1, 'smile', 'short:' + K.brn),
    come: () => arrow(8, 50, 52, 50, K.dgn, 8) + man(76, 92, K.blu, 1.7), ear: () => Pa('M32 76Q14 62 20 38Q30 8 58 12Q88 18 80 52Q76 66 64 70Q60 90 44 90Q34 88 32 76Z', K.sk) + Pa('M44 36Q58 28 62 44Q64 56 52 58', 'none', 'stroke-width="4"'),
    zero: () => Ci(50, 50, 38, '#f1f3f5') + T('0', 50, 70, 60, K.gry), bulb: () => Ci(50, 40, 26, K.yel) + R(40, 62, 20, 16, K.gry, 3) + R(42, 78, 16, 8, K.gry, 3) + [[16, 14, 26, 24], [50, 4, 50, 12], [84, 14, 74, 24]].map(([a, b, c, d]) => Li(a, b, c, d, K.org, 4)).join(''),
    school: () => R(10, 42, 80, 48, '#e76f51', 3) + Pg('6,42 50,14 94,42', K.brn) + R(42, 62, 16, 28, K.yel, 2) + R(18, 52, 14, 14, K.lbl, 2) + R(68, 52, 14, 14, K.lbl, 2) + Li(50, 14, 50, 2, K.ink, 3) + Pg('50,2 66,6 50,10', K.red),
    longing: () => man(24, 92, K.blu, 1.6, 'sad') + houseF(76, 92, .8) + heart(50, 24, .7, K.pnk), where: () => Pa('M50 92C30 62 22 52 22 38A28 28 0 0 1 78 38C78 52 70 62 50 92Z', K.red) + T('?', 50, 50, 40, K.wht),
    dontknow: () => man(40, 92, K.gry, 1.9, 'neutral') + T('?', 78, 34, 36, K.pur) + T('?', 90, 62, 24, K.pur) + T('?', 66, 16, 20, K.pur),
    crete: () => Ci(50, 50, 40, K.lbl) + Pa('M14 54Q30 40 48 48Q66 44 86 52Q70 62 50 58Q28 64 14 54Z', K.sand), sicily: () => Ci(50, 50, 40, K.lbl) + Pg('26,30 74,26 62,50 44,72', K.sand),
    volcano: () => volcano(), anvil: () => Pa('M12 34H80L72 52H60L64 68H72V82H28V68H36L40 52H26Z', K.nav) + star8(86, 26, 10, K.org) + Pa('M60 28Q64 14 72 8Q70 22 64 28Z', K.red, NS),
    live: () => houseF(42, 92, 1.5) + man(84, 92, K.blu, .9), pupil: () => R(60, 54, 22, 30, K.red, 5) + man(44, 92, K.org, 2, 'smile', 'short:' + K.brn),
    gladly: () => face(50, 52, 36, 'smile', K.yel) + heart(36, 40, .4) + heart(64, 40, .4), talent: () => star(72, 30, 22, K.yel) + man(34, 92, K.blu, 1.8) + sparkle(14, 18, 8),
    advice: () => man(20, 92, K.blu, 1.3) + man(80, 92, K.org, 1.3) + Ci(50, 30, 18, K.yel) + R(44, 44, 12, 8, K.gry, 2) + Li(38, 8, 42, 14, K.org, 3) + Li(62, 8, 58, 14, K.org, 3),
    capitol: () => Pa('M4 94Q50 30 96 94Z', '#95d5b2') + temple(50, 62, .8), columns: () => R(6, 20, 88, 12, '#f1faee', 2) + [16, 38, 62, 84].map(x => R(x - 6, 32, 12, 52, '#f1faee', 2)).join('') + R(2, 84, 96, 8, K.sand, 2),
    building: () => R(22, 14, 56, 78, K.sand, 3) + [0, 1, 2].flatMap(r => [0, 1].map(c => R(30 + c * 24, 22 + r * 18, 14, 11, K.lbl, 2))).join('') + R(42, 74, 16, 18, K.brn, 2), curia: () => R(14, 36, 72, 56, K.org, 3) + Pg('10,36 50,14 90,36', K.brn) + Pa('M40 92V68A10 10 0 0 1 60 68V92Z', K.brn) + R(20, 48, 14, 14, K.yel, 2) + R(66, 48, 14, 14, K.yel, 2),
    temple: () => temple(50, 92, 1.5), sickle: () => Pa('M62 10Q16 16 18 58Q22 86 62 90Q34 76 38 52Q42 26 62 10Z', K.gry) + G('rotate(-30 70 80)', R(66, 56, 8, 38, K.brn, 3)),
    handshake: () => R(4, 38, 36, 22, K.blu, 4) + R(60, 38, 36, 22, K.red, 4) + R(32, 40, 36, 18, K.sk, 8) + [36, 46, 56].map(x => Li(x, 40, x, 58, K.ink, 2)).join('') + heart(50, 20, .6),
    bricks: () => [[10, 70, 38], [52, 70, 38], [28, 52, 38], [70, 52, 24], [10, 34, 38], [52, 34, 38]].map(([x, y, w]) => R(x, y, w - 2, 16, '#e76f51', 2)).join('') + R(24, 8, 28, 10, K.yel, 4) + R(20, 16, 36, 5, K.yel, 2),
    gate: () => Pa('M16 92V42A34 34 0 0 1 84 42V92Z', K.brn) + Pa('M30 92V46A20 20 0 0 1 70 46V92Z', K.nav) + [38, 46, 54, 62].map(x => Li(x, 38, x, 92, K.gry, 3)).join(''),
    goodgift: () => R(26, 40, 48, 44, K.red, 4) + R(20, 30, 60, 14, K.red, 3) + R(46, 30, 8, 54, K.yel, 1) + heart(50, 18, .7, K.pnk),
    grain: () => [28, 50, 72].map((x, i) => Li(x, 94, x, 40 - i % 2 * 6, K.brn, 4) + [0, 1, 2, 3].map(j => E(x - 6 + (j % 2) * 12, 36 - i % 2 * 6 - j * 8, 5, 8, K.yel)).join('')).join(''),
    gift: () => R(20, 46, 60, 42, K.red, 4) + R(14, 32, 72, 16, K.pur, 3) + R(46, 32, 8, 56, K.yel, 1) + Pa('M50 32Q30 6 28 24Q28 34 50 32Q72 34 72 24Q70 6 50 32Z', K.yel),
    wordbub: () => bubble(8, 14, 84, 56, K.wht) + T('Aa', 50, 52, 36, K.blu), hall: () => Pg('6,40 50,10 94,40', K.brn) + R(10, 40, 80, 50, K.sand, 2) + [0, 1, 2, 3].map(i => Pa(`M${18 + i * 18} 90V62A8 8 0 0 1 ${34 + i * 18} 62V90Z`, K.brn)).join(''),
    to: () => arrow(6, 70, 52, 56, K.org, 7) + houseF(76, 90, .9), before: () => houseF(66, 90, 1.3) + man(24, 92, K.blu, 1.7), after: () => man(30, 92, K.blu, 1.7) + houseF(44, 92, 1.4), shade: () => E(50, 88, 38, 7, 'rgba(0,0,0,.25)', NS) + tree(40, 86, 1.7),
    jewel: () => Ci(50, 66, 26, 'none', `stroke="${K.yel}" stroke-width="8"`) + Pg('36,30 64,30 72,40 50,58 28,40', K.blu), together: () => man(30, 92, K.blu, 1.5) + man(70, 92, K.org, 1.5) + Li(44, 66, 56, 66, K.ink, 5),
    test: () => Ci(42, 42, 28, '#e0fbfc') + Li(63, 63, 90, 90, K.brn, 11) + `<path d="M30 42L39 52L56 32" fill="none" stroke="${K.grn}" stroke-width="7"/>`, price: () => Pa('M10 46V12H44L92 60L60 92Z', K.yel) + Ci(26, 28, 6, K.wht) + G('rotate(45 56 56)', T('€', 56, 66, 32)),
    bell: () => Pa('M50 10Q26 14 26 48V64L16 76H84L74 64V48Q74 14 50 10Z', K.yel) + Ci(50, 86, 8, K.brn) + Ci(76, 22, 10, K.red),
    without: () => man(28, 92, K.blu, 1.6) + Pa('M60 86V58A16 16 0 0 1 92 58V86Z', 'none', `stroke="${K.gry}" stroke-width="4" stroke-dasharray="5 4"`) + Li(58, 30, 94, 66, K.red, 7),
    out: () => R(8, 24, 48, 56, 'none', `stroke="${K.ink}" stroke-width="4" stroke-dasharray="6 4"`) + Ci(30, 52, 12, K.red) + arrow(34, 52, 92, 52, K.dgn, 7), inside: () => R(14, 22, 72, 58, K.lbl, 6) + Ci(50, 54, 16, K.red),
    into: () => R(52, 20, 40, 60, K.lbl, 6) + arrow(6, 52, 62, 52, K.dgn, 8) + Ci(80, 50, 8, K.red), anchor: () => Ci(50, 20, 9, 'none', `stroke="${K.nav}" stroke-width="6"`) + Li(50, 30, 50, 86, K.nav, 7) + Li(34, 42, 66, 42, K.nav, 6) + `<path d="M16 62Q20 90 50 90Q80 90 84 62" fill="none" stroke="${K.nav}" stroke-width="7"/>`,
    me: () => man(46, 92, K.blu, 2.1) + arrow(94, 66, 66, 66, K.red, 6), you: () => man(22, 92, K.gry, 1.2) + arrow(34, 58, 58, 58, K.org, 6) + man(78, 92, K.blu, 1.9),
    youpl: () => man(14, 92, K.gry, 1.1) + arrow(28, 60, 42, 60, K.org, 6) + grpAt(72, 3, 92, .9, [K.blu, K.org, K.grn]), tome: () => giftTo(1, K.blu), withyou: () => man(30, 92, K.blu, 1.5) + man(70, 92, K.org, 1.5) + Li(40, 60, 60, 60, K.ink, 4),
    we: () => grp(3, 92, 1.4), withyoupl: () => grp(3, 92, 1.3) + Li(30, 64, 70, 64, K.ink, 4), us: () => arrow(6, 60, 26, 60, K.red, 6) + grpAt(64, 3, 92, 1, [K.blu, K.org, K.grn]), toyou: () => giftTo(1, K.org),
    tous: () => giftTo(3, K.blu), toyoupl: () => giftTo(3, K.org),
    shout: () => Pg('22,40 56,24 56,76 22,60', K.red) + R(10, 40, 14, 20, K.nav, 3) + ['M64 38Q72 50 64 62', 'M74 28Q90 50 74 72'].map(d => Pa(d, 'none', `stroke="${K.org}" stroke-width="5"`)).join(''),
    lost: () => Li(50, 14, 50, 94, K.brn, 6) + Pg('50,18 90,26 90,42 50,46', K.org) + Pg('50,52 10,60 10,76 50,80', K.lbl) + T('?', 70, 40, 18) + T('?', 30, 74, 18),
    find: () => Ci(42, 42, 28, '#e0fbfc') + Li(63, 63, 90, 90, K.brn, 11) + star(42, 42, 14, K.yel), empire: () => Ci(50, 66, 28, K.blu) + Pa('M30 62Q50 52 70 66', 'none', `stroke="${K.grn}" stroke-width="6"`) + Pg('26,42 30,14 42,30 50,10 58,30 70,14 74,42', K.yel),
    new: () => star8(50, 50, 44, K.red) + T('NEU', 50, 58, 24, K.wht), many: () => [[20, 22], [44, 18], [70, 24], [30, 48], [58, 46], [82, 52], [18, 74], [44, 76], [68, 78], [86, 22]].map(([x, y], i) => Ci(x, y, 9, [K.blu, K.org, K.grn, K.red, K.pur][i % 5])).join(''),
    all: () => Ci(50, 50, 40, 'none', `stroke="${K.ink}" stroke-width="4" stroke-dasharray="6 4"`) + [[34, 36], [60, 34], [48, 56], [30, 66], [66, 62]].map(([x, y], i) => Ci(x, y, 8, [K.blu, K.org, K.grn, K.red, K.pur][i])).join(''),
    big: () => Ci(40, 54, 32, K.blu) + Ci(84, 82, 8, K.org), as: () => R(8, 34, 30, 32, K.lbl, 5) + T('=', 50, 62, 40) + R(62, 34, 30, 32, K.lbl, 5),
    medal: () => Pg('34,52 22,94 40,84 50,94 56,52', K.red) + Pg('66,52 78,94 60,84 50,94 44,52', K.blu) + Ci(50, 36, 28, K.yel) + star(50, 36, 16, K.org),
    yours: () => ownBall(K.gry), mine: () => ownBall(K.blu), ours: () => ownBall(K.blu, 3, K.grn), yourspl: () => ownBall(K.gry, 3, K.org),
    story: () => man(26, 92, K.blu, 1.7) + bubble(44, 10, 50, 46, K.wht) + Li(52, 24, 86, 24, K.ink, 3) + Li(52, 34, 78, 34, K.ink, 3) + Li(52, 44, 70, 44, K.ink, 3),
    down: () => Ci(50, 16, 12, K.red) + arrow(50, 32, 50, 92, K.dgn, 9), small: () => Ci(34, 70, 9, K.org) + Ci(68, 38, 26, '#f1f3f5', `stroke-dasharray="4 4"`),
    man: () => man(50, 92, K.blu, 2.1) + Pa('M41 44Q50 48 59 44Q50 52 41 44Z', K.brn, NS), boy: () => man(50, 92, K.grn, 2.1, 'smile', 'short:' + K.brn),
    teacher: () => man(40, 92, K.nav, 1.9) + Ci(30, 59, 5, 'none') + Ci(50, 59, 5, 'none') + Li(35, 59, 45, 59, K.ink, 2) + Li(52, 70, 90, 40, K.brn, 4),
    command: () => man(32, 92, K.pur, 1.9) + Pg('20,26 24,14 32,22 40,14 44,26', K.yel) + R(54, 56, 34, 9, K.sk, 4) + bubble(62, 14, 30, 24, K.yel, 'l') + T('!', 77, 34, 22, K.red),
    black: () => Ci(50, 50, 38, '#2b2d42') + Pa('M24 40Q30 26 44 22', 'none', 'stroke="#fff" stroke-width="5" stroke-linecap="round"'),
    flower: () => Li(50, 52, 50, 92, K.dgn, 5) + Pa('M50 80Q30 76 28 64Q44 66 50 80Z', K.grn) + [0, 72, 144, 216, 288].map(a => G(`rotate(${a} 50 36)`, E(50, 20, 10, 15, K.pnk))).join('') + Ci(50, 36, 9, K.yel),
    bird: () => R(10, 34, 40, 56, 'none', `stroke="${K.ink}" stroke-width="3" stroke-dasharray="5 4"`) + E(66, 40, 16, 10, K.blu) + Ci(82, 34, 8, K.blu) + Pg('88,32 98,36 88,40', K.org) + Pa('M60 38Q54 20 70 22Q72 34 64 40Z', K.lbl) + Ci(84, 32, 2, K.ink, NS),
    sad: () => Ci(34, 28, 16, K.gry) + Ci(52, 24, 18, '#ced4da') + Ci(68, 30, 14, K.gry) + face(50, 66, 22, 'sad') + [[30, 52], [52, 54], [72, 52]].map(([x, y]) => Li(x, y, x - 4, y + 8, K.blu, 3)).join(''),
    sprout: () => Li(50, 92, 50, 44, K.dgn, 6) + Pa('M50 60Q20 60 16 32Q44 30 50 60Z', K.grn) + Pa('M50 48Q80 48 84 20Q56 18 50 48Z', K.grn) + E(50, 90, 30, 6, K.brn, NS) + heart(50, 14, .5),
    wagon: () => R(14, 36, 62, 30, K.brn, 3) + Ci(30, 74, 14, K.gry) + Ci(30, 74, 4, K.ink, NS) + Ci(62, 74, 14, K.gry) + Ci(62, 74, 4, K.ink, NS) + Li(76, 52, 94, 46, K.brn, 5),
    stand: () => man(50, 90, K.nav, 2.2) + Li(14, 92, 86, 92, K.ink, 3), say: () => man(30, 92, K.blu, 1.8) + bubble(50, 14, 44, 32, K.wht, 'l') + T('“ ”', 72, 40, 26, K.blu),
    messenger: () => G('rotate(10 40 60)', man(36, 92, K.red, 1.8)) + R(60, 46, 32, 22, K.wht, 3) + Pa('M60 49L76 60L92 49', 'none') , send: () => R(8, 34, 52, 34, K.wht, 3) + Pa('M8 37L34 56L60 37', 'none') + arrow(56, 70, 92, 40, K.dgn, 7),
    write: () => R(20, 14, 52, 74, K.wht, 3) + [30, 42, 54].map(y => Li(28, y, 64, y, K.lbl, 3)).join('') + G('rotate(40 66 64)', R(60, 30, 12, 44, K.yel, 2) + Pg('60,74 72,74 66,88', K.sk) + Pg('64,82 68,82 66,88', K.ink)),
    leave: () => R(6, 12, 40, 80, K.brn, 3) + R(12, 18, 28, 74, K.yel, 0, NS) + arrow(36, 56, 92, 56, K.red, 8) + man(70, 90, K.blu, .9), lead: () => man(26, 92, K.gry, 1.2) + Li(36, 66, 56, 66, K.brn, 3) + man(68, 92, K.blu, 1.6) + arrow(78, 22, 94, 22, K.dgn, 6),
    pull: () => R(54, 56, 38, 30, K.brn, 3) + Li(54, 66, 14, 66, K.ink, 4) + arrow(32, 40, 8, 40, K.red, 6) + Ci(12, 66, 4, K.ink), show: () => R(8, 44, 38, 38, K.sk, 8) + R(40, 50, 52, 13, K.sk, 6) + arrow(66, 28, 66, 44, K.red, 5),
    town: () => R(6, 54, 88, 38, '#adb5bd', 2) + [8, 30, 52, 74].map(x => R(x, 44, 14, 12, '#adb5bd', 1)).join('') + houseF(34, 54, .8) + houseF(66, 54, .8, K.sand, K.blu) + Pa('M42 92V76A8 8 0 0 1 58 76V92Z', K.brn),
    from2: () => R(8, 24, 48, 56, 'none', `stroke="${K.ink}" stroke-width="4" stroke-dasharray="6 4"`) + Ci(30, 52, 12, K.red) + arrow(40, 52, 92, 52, K.org, 7),
    through: () => Pa('M14 90V40A36 36 0 0 1 86 40V90Z', K.gry) + Pa('M28 90V46A22 22 0 0 1 72 46V90Z', K.nav) + arrow(2, 70, 98, 70, K.org, 7),
    hills: () => Ci(76, 24, 14, K.yel) + Pa('M0 90V60Q24 30 50 60Q74 36 100 62V90Z', '#52b788') + Pa('M0 90V74Q30 52 60 78Q80 64 100 76V90Z', K.dgn),
    grapes: () => Pa('M50 28Q44 10 58 8', 'none', `stroke="${K.brn}" stroke-width="5"`) + Pa('M56 14Q76 4 82 22Q64 28 56 14Z', K.grn) + [[34, 36], [50, 36], [66, 36], [42, 52], [58, 52], [34, 52], [66, 52], [50, 68], [42, 84], [58, 84]].slice(0, 9).map(([x, y]) => Ci(x, y, 9, K.pur)).join(''),
    leadout: () => R(6, 20, 50, 60, 'none', `stroke="${K.ink}" stroke-width="4" stroke-dasharray="6 4"`) + man(30, 76, K.blu, 1) + arrow(44, 50, 94, 50, K.dgn, 7),
    stop: () => Pg('32,8 68,8 92,32 92,68 68,92 32,92 8,68 8,32', K.red) + R(24, 42, 52, 16, K.wht, 3, NS), leadaway: () => man(24, 92, K.blu, 1.4) + arrow(44, 50, 96, 50, K.dgn, 7) + Ci(88, 74, 3, K.gry) + Ci(76, 78, 3, K.gry),
    leadto: () => man(20, 92, K.blu, 1.4) + arrow(32, 56, 62, 56, K.dgn, 7) + houseF(80, 90, .8) , cup: () => R(22, 34, 44, 52, K.wht, 6) + R(26, 52, 36, 30, K.red, 3, NS) + Pa('M66 44H80Q90 44 90 58Q90 72 76 72H66', 'none', `stroke="${K.ink}" stroke-width="5"`) + Pa('M34 24Q40 12 34 4M50 24Q56 12 50 4', 'none', `stroke="${K.gry}" stroke-width="4"`),
    carry: () => man(50, 92, K.blu, 1.8) + R(26, 6, 48, 26, K.brn, 3) + Li(26, 18, 74, 18, K.sand, 3), wine: () => Pa('M20 92V46Q20 36 26 28V8H40V28Q46 36 46 46V92Z', '#7b2d43') + R(24, 8, 12, 8, K.sand, 2) + Pa('M62 30H92Q92 56 77 62Q62 56 62 30Z', K.wht) + Pa('M64 38H90Q88 54 77 58Q66 54 64 38Z', '#7b2d43', NS) + Li(77, 62, 77, 88, K.ink, 4) + Li(66, 88, 88, 88, K.ink, 4),
    lifebuoy: () => Ci(50, 50, 40, K.wht) + [0, 90, 180, 270].map(a => G(`rotate(${a} 50 50)`, Pa('M50 10A40 40 0 0 1 78 22L66 34A24 24 0 0 0 50 26Z', K.red))).join('') + Ci(50, 50, 20, K.lbl) + Ci(50, 50, 20, 'none'),
    present: () => man(40, 92, K.blu, 1.9) + Ci(80, 30, 16, K.grn) + `<path d="M72 30L78 37L89 24" fill="none" stroke="#fff" stroke-width="5"/>`, absent: () => Pa('M24 90V60A26 26 0 0 1 76 60V90Z', 'none', `stroke="${K.gry}" stroke-width="4" stroke-dasharray="6 4"`) + Ci(50, 38, 14, 'none', `stroke="${K.gry}" stroke-width="4" stroke-dasharray="5 4"`) + T('?', 50, 72, 34, K.pur),
    grave: () => Pa('M22 92V42A28 28 0 0 1 78 42V92Z', K.gry) + Li(50, 28, 50, 62, K.ink, 5) + Li(38, 40, 62, 40, K.ink, 5) + E(50, 92, 36, 4, K.dgn, NS), fullglass: () => glass(K.lbl, 20) + Ci(44, 12, 3, K.wht, NS),
    strong: () => man(50, 92, K.red, 1.9) + Li(22, 28, 78, 28, K.ink, 5) + Ci(18, 28, 9, K.gry) + Ci(82, 28, 9, K.gry),
    gears: () => star(50, 50, 38, K.gry, 8, .8) + Ci(50, 50, 14, K.wht) + Ci(50, 50, 38, 'none'), altar: () => R(18, 62, 64, 30, K.gry, 3) + R(12, 54, 76, 12, '#ced4da', 3) + Pa('M50 54Q32 40 44 20Q46 32 54 32Q58 24 52 10Q76 30 66 46Q62 52 50 54Z', K.org) + Pa('M50 54Q42 46 48 38Q56 44 56 50Z', K.yel, NS),
    stairs: () => Pg('10,90 10,70 30,70 30,50 50,50 50,30 70,30 70,90', K.gry) + arrow(74, 14, 40, 14, K.red, 6) + '', isntit: () => Ci(50, 50, 38, K.lbl) + T('?', 38, 66, 52, K.pur) + `<path d="M58 46L68 58L88 32" fill="none" stroke="${K.grn}" stroke-width="7" stroke-linejoin="round"/>`,
    more: () => R(10, 62, 24, 28, K.lbl, 4) + R(38, 44, 24, 46, K.blu, 4) + R(66, 20, 24, 70, K.nav, 4) + T('+', 22, 52, 28, K.grn), hold2: () => I.hold(), peak: () => Pg('6,92 50,16 94,92', K.gry) + Pg('34,46 50,16 66,46 58,42 50,50 42,42', K.wht, NS) + Li(50, 16, 50, 2, K.ink, 3) + Pg('50,2 70,7 50,12', K.red),
    senator: () => man(50, 92, '#f1faee', 2.1) + R(41, 70, 18, 22, K.red, 1, NS) + Pa('M38 44Q50 68 62 44Q50 50 38 44Z', '#f1f3f5') + Pa('M34 24Q50 2 66 24', 'none', `stroke="${K.grn}" stroke-width="5"`),
    merchant: () => R(14, 50, 72, 40, K.brn, 3) + Pg('8,50 20,22 80,22 92,50', K.red) + [20, 36, 52, 68].map(x => Pg(`${x},22 ${x + 8},22 ${x + 12},50 ${x + 4},50`, K.wht)).join('') + Ci(34, 66, 10, K.yel) + T('€', 34, 71, 12) + Ci(62, 66, 10, K.org),
    trade: () => R(6, 36, 28, 28, K.red, 4) + Li(20, 36, 20, 64, K.yel, 4) + Ci(80, 50, 15, K.yel) + T('€', 80, 57, 18) + arrow(38, 40, 62, 40, K.dgn, 5) + arrow(62, 62, 38, 62, K.blu, 5),
    famous: () => star8(50, 50, 44, K.yel) + star(50, 50, 22, K.org), emperor: () => man(50, 92, K.pur, 2.1) + Pg('36,22 40,6 50,16 60,6 64,22', K.yel) + R(41, 70, 18, 22, K.yel, 1, NS), today: () => R(10, 18, 80, 72, K.wht, 5) + R(10, 18, 80, 18, K.red, 5) + Ci(50, 62, 16, K.yel) + [0, 60, 120, 180, 240, 300].map(a => { const q = a * Math.PI / 180; return Li(50 + 20 * Math.sin(q), 62 - 20 * Math.cos(q), 50 + 26 * Math.sin(q), 62 - 26 * Math.cos(q), K.org, 3); }).join(''),
    bigarrow: () => Ci(50, 50, 28, K.lbl) + arrow(50, 80, 94, 80, K.blu, 5) + arrow(50, 80, 6, 80, K.blu, 5), wand: () => Li(18, 86, 62, 42, K.brn, 8) + star(70, 30, 22, K.yel) + sparkle(24, 24, 8) + sparkle(88, 70, 7),
    magn: () => Ci(42, 42, 28, '#e0fbfc') + Li(63, 63, 90, 90, K.brn, 11) + T('?', 42, 54, 34, K.pur), wife: () => man(40, 92, K.pnk, 1.9, 'smile', 'long:' + K.brn) + Ci(82, 60, 12, 'none', `stroke="${K.yel}" stroke-width="6"`) + Pg('76,44 88,44 90,50 82,56 74,50', K.blu),
    woman: () => man(50, 92, K.pnk, 2.1, 'smile', 'long:' + K.brn), self: () => man(36, 92, K.blu, 1.9) + `<path d="M62 50Q88 40 82 70Q78 86 62 70" fill="none" stroke="${K.red}" stroke-width="6"/>` + Pg('60,64 72,72 58,78', K.red),
    parallel: () => arrow(8, 34, 92, 34, K.blu, 7) + arrow(8, 66, 92, 66, K.org, 7), lion: () => star(50, 50, 44, K.org, 12, .8) + Ci(50, 52, 26, K.yel) + Ci(40, 46, 3.5, K.ink, NS) + Ci(60, 46, 3.5, K.ink, NS) + Pa('M44 58H56L50 66Z', K.ink) + `<path d="M50 66Q42 74 36 68M50 66Q58 74 64 68" fill="none" stroke-width="2.5"/>`,
    prefer: () => Ci(22, 60, 14, '#dee2e6') + Ci(78, 52, 22, K.org) + heart(78, 22, .8) + arrow(40, 58, 52, 54, K.ink, 4), want: () => man(32, 92, K.blu, 1.8) + Ci(62, 40, 5, K.wht) + R(56, 6, 38, 26, K.wht, 12) + star(75, 19, 9),
    sisters: () => man(32, 90, K.pnk, 1.5, 'smile', 'long:' + K.brn) + man(70, 90, K.pur, 1.3, 'smile', 'long:#e9c46a') + heart(52, 24, .8), fork: () => `<path d="M50 94V54L22 18M50 54L78 18" fill="none" stroke="${K.gry}" stroke-width="12" stroke-linecap="round"/>` + T('?', 22, 14, 22, K.pur) + T('?', 78, 14, 22, K.pur),
    thief: () => man(34, 92, K.nav, 1.9, 'neutral') + R(19, 52, 30, 10, K.ink, 5) + Pa('M60 62Q56 94 76 94Q94 94 90 62Z', K.brn) + T('$', 75, 88, 24, K.yel),
    noise: () => star(50, 50, 46, K.yel, 12, .65) + T('!!', 50, 62, 40, K.red), money: () => [[28, 78], [50, 80], [72, 78], [38, 60], [62, 60], [50, 42]].map(([x, y]) => Ci(x, y, 12, K.yel) + T('€', x, y + 5, 14)).join(''),
    although: () => Ci(34, 34, 16, K.yel) + Ci(50, 40, 18, K.gry) + Ci(70, 44, 14, K.gry) + [[34, 60], [52, 64], [70, 60]].map(([x, y]) => Li(x, y, x - 4, y + 12, K.blu, 4)).join('') + Ci(20, 24, 0.1, K.yel),
    unchain: () => R(6, 36, 30, 24, 'none', `stroke="${K.gry}" stroke-width="7"`) + R(64, 40, 30, 24, 'none', `stroke="${K.gry}" stroke-width="7"`) + sparkle(50, 50, 12) + Li(36, 30, 44, 22, K.red, 4),
    always: () => T('∞', 50, 70, 90, K.grn), whynot: () => Ci(50, 50, 38, K.lbl) + T('?', 44, 66, 52, K.pur) + Li(62, 30, 82, 50, K.red, 7) + Li(82, 30, 62, 50, K.red, 7),
    notwant: () => star(50, 50, 18, K.gry) + Ci(50, 50, 38, 'none', `stroke="${K.red}" stroke-width="8"`) + Li(24, 76, 76, 24, K.red, 8)
  };

  const PASTEL = ['#e0fbfc', '#fde2e4', '#e2ece9', '#fff1e6', '#e4e7ff', '#f0efeb', '#ffeedd', '#dff6ff'];
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function inner(key) {
    if (key && key.startsWith('num:')) { const n = +key.slice(4); const cols = [K.blu, K.org, K.grn, K.pur, K.red]; let dots = ''; const row = n > 10 ? 10 : n; for (let i = 0; i < Math.min(n, 10); i++) dots += Ci(50 - (Math.min(n, 10) - 1) * 4.5 + i * 9, 86, 3.6, K.ink, NS); return Ci(50, 46, 34, cols[n % 5]) + T(String(n), 50, 62, n > 9 ? 44 : 52, K.wht) + dots; }
    if (key && key.startsWith('txt:')) return Ci(50, 50, 38, K.pur) + T(key.slice(4).toUpperCase(), 50, 62, 34, K.wht);
    return I[key] ? I[key]() : null;
  }
  function svg(key, opts = {}) {
    let body = inner(key);
    if (body === null) body = Ci(50, 50, 38, K.lbl) + R(30, 30, 40, 40, K.wht, 4) + Li(36, 42, 64, 42, K.ink, 3) + Li(36, 52, 64, 52, K.ink, 3) + Li(36, 62, 54, 62, K.ink, 3);
    const bg = opts.bg === false ? '' : `<circle cx="50" cy="50" r="49" fill="${PASTEL[hash(key || '') % PASTEL.length]}" stroke="none"/>`;
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="ico" role="img" aria-hidden="true">${bg}<g stroke="${K.ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  }
  return { svg, keys: Object.keys(I), has: k => !!(I[k] || (k && (k.startsWith('num:') || k.startsWith('txt:')))) };
});
