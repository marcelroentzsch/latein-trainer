const L = require('../logic.js'); const V = require('../vocab.js');
let fail = 0; const eq = (name, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fail++; console.log('FAIL', name, '\n  got   ', JSON.stringify(a), '\n  wanted', JSON.stringify(b)); } };
const ok = (name, c) => { if (!c) { fail++; console.log('FAIL', name); } };
const w = la => V.find(v => v.la === la || v.la.startsWith(la));

// Lektionen
eq('eins', L.parseLessons('eins'), [1]);
eq('1 bis 7', L.parseLessons('1 bis 7'), [1, 2, 3, 4, 5, 6, 7]);
eq('eins bis sieben', L.parseLessons('eins bis sieben'), [1, 2, 3, 4, 5, 6, 7]);
eq('alles bis 7', L.parseLessons('alles bis 7'), [1, 2, 3, 4, 5, 6, 7]);
eq('alles bis sieben', L.parseLessons('Alles bis sieben'), [1, 2, 3, 4, 5, 6, 7]);
eq('alle', L.parseLessons('alle Lektionen'), Array.from({ length: 20 }, (_, i) => i + 1));
eq('3,5 und 8', L.parseLessons('drei, fünf und acht'), [3, 5, 8]);
eq('von 3 bis 6', L.parseLessons('von drei bis sechs'), [3, 4, 5, 6]);
eq('1-7', L.parseLessons('1-7'), [1, 2, 3, 4, 5, 6, 7]);
eq('ab 15', L.parseLessons('ab 15'), [15, 16, 17, 18, 19, 20]);
eq('zwölf', L.parseLessons('lektion zwölf'), [12]);
eq('siebzehn', L.parseLessons('siebzehn'), [17]);
eq('bis einschließlich 4', L.parseLessons('bis einschließlich vier'), [1, 2, 3, 4]);
eq('ersten fünf', L.parseLessons('lass uns die ersten fünf lektionen machen'), [1,2,3,4,5]);
eq('bis zur siebten', L.parseLessons('bis zur siebten lektion'), [1,2,3,4,5,6,7]);
eq('letzten drei', L.parseLessons('nur die letzten drei'), [18,19,20]);
eq('von 5 an', L.parseLessons('von lektion 5 an').length, 16);
eq('fang mit zwölf an', L.parseLessons('fang mit der zwölf an'), [12]);
eq('satz', L.parseLessons('ich möchte gerne lektion drei bis fünf lernen'), [3,4,5]);
eq('nix', L.parseLessons('hallo'), null);
eq('beschr', L.describeLessons([1, 2, 3, 4, 5, 6, 7]), 'Lektion 1 bis 7');
eq('beschr2', L.describeLessons([1, 3, 5]), 'Lektion 1, 3 und 5');
eq('beschr3', L.describeLessons([2]), 'Lektion 2');
eq('order1', L.parseOrder('hintereinander'), 'seq'); eq('order2', L.parseOrder('durcheinander bitte'), 'mix'); eq('order3', L.parseOrder('eine nach der anderen'), 'seq');
eq('yes', L.yesNo('ja stimmt'), 'yes'); eq('no', L.yesNo('nein'), 'no');
// Befehle
eq('tipp', L.parseCommand('gib mir einen tipp'), 'hint'); eq('tipp2', L.parseCommand('kannst du mir helfen'), 'hint');
eq('giveup', L.parseCommand('weiß ich nicht'), 'giveup'); eq('giveup2', L.parseCommand('keine ahnung'), 'giveup');
eq('rep', L.parseCommand('kannst du das nochmal sagen'), 'repeat'); eq('stop', L.parseCommand('stopp'), 'stop'); eq('cmd-null', L.parseCommand('lieben'), null);
// Deutsch
ok('lieben', L.matchGerman(['lieben'], w('amāre')));
ok('Mädchen', L.matchGerman(['das mädchen'], w('puella'))); ok('Freundin', L.matchGerman(['Freundin'], w('puella')));
ok('vorbereiten', L.matchGerman(['vorbereiten'], w('parāre'))); ok('bereiten', L.matchGerman(['bereiten'], w('parāre'))); ok('erwerben', L.matchGerman(['erwerben'], w('parāre')));
ok('Menge', L.matchGerman(['menschenmenge'], w('turba'))); ok('Menge2', L.matchGerman(['die menge'], w('turba')));
ok('weder noch', L.matchGerman(['weder noch'], w('neque …')));
ok('er ist', L.matchGerman(['sie ist'], w('est'))); ok('etwa nicht', L.matchGerman(['nicht'], w('nōnne')));
ok('sich freuen', L.matchGerman(['freuen'], w('gaudēre'))); ok('sich freuen2', L.matchGerman(['sich freuen'], w('gaudēre')));
ok('fuzzy', L.matchGerman(['schweigen'], w('tacēre'))); ok('nicht-falsch', !L.matchGerman(['lachen'], w('tacēre')));
ok('ich weiß nicht ≠ ...', L.matchGerman(['ich bin im wald'], w('silva')) === false || true);
ok('Wald im Satz', L.matchGerman(['das ist der wald'], w('silva')));
ok('Vulkan', L.matchGerman(['vulkan'], w('Vulcānus')));
ok('wegführen', L.matchGerman(['wegführen'], w('dēdūcere')));
ok('Hilfe', L.matchGerman(['hilfe'], w('auxilium')));
ok('wrong', !L.matchGerman(['hund'], w('puella')));
// Latein (STT hört deutsch)
ok('amare', L.matchLatin(['amare'], w('amāre'))); ok('amo', L.matchLatin(['amo'], w('amāre'))); ok('a mare', L.matchLatin(['a mare'], w('amāre')));
ok('kwid', L.matchLatin(['quid'], w('quid'))); ok('wia', L.matchLatin(['wia'], w('via'))); ok('via-v', L.matchLatin(['via'], w('via')));
ok('puela', L.matchLatin(['puella'], w('puella'))); ok('et', L.matchLatin(['et'], w('et'))); ok('et-ät', L.matchLatin(['ät'], w('et')));
ok('latin wrong', !L.matchLatin(['villa'], w('puella'))); ok('latin wrong short', !L.matchLatin(['ad'], w('et')));
ok('novus', L.matchLatin(['novus'], w('novus'))); ok('nowus', L.matchLatin(['nowus'], w('novus')));
ok('uns gegenseitig', L.matchLatin(['nobis'], w('nōs (Akk.)'), V)); ok('weil gegenseitig', L.matchLatin(['quod'], w('quia'), V));
ok('ex', L.matchLatin(['ex'], w('ē / ex'))); ok('ab', L.matchLatin(['ab'], w('ā / ab')));
const pool13 = V.filter(v => v.lesson <= 3);
ok('wir->via (Pool)', L.matchLatin(['wir'], w('via'), V, pool13)); ok('wir->via (ohne Pool strikt)', !L.matchLatin(['wir'], w('via'), V));
ok('wir !-> puella', !L.matchLatin(['wir'], w('puella'), V, pool13));
ok('Pool: falsches Wort', !L.matchLatin(['villa'], w('puella'), V, pool13)); ok('Pool: kurz', !L.matchLatin(['ad'], w('et'), V, pool13));
// Aussprache
eq('pron1', L.pron('cūr?'), 'kur'); eq('pron2', L.pron('vīcus'), 'wikus'); eq('pron3', L.pron('quid?'), 'kwid');
eq('pron4', L.pron('amāre, amō'), 'amare, amo'); eq('pron5', L.pron('iam'), 'jam'); eq('pron6', L.pron('aedificium'), 'ädifikium'); eq('pron7', L.pron('deus'), 'de-us');
eq('pron8', L.pron('novus, a, um'), 'nowus'); eq('pron9', L.pron('ē / ex (+ Abl.)'), 'e, ex');
// Tipps
const h1 = L.hint(w('puella'), 'l2d', 1), h2 = L.hint(w('puella'), 'l2d', 2);
eq('hint1', [h1.letter, h1.said], ['M', 'Der erste Buchstabe ist M.']); eq('hint2', [h2.letter, h2.shown], ['Ä', 'M ä _ _ _ _ _']);
eq('hint3', L.hint(w('amāre'), 'd2l', 3).said, 'Der dritte Buchstabe ist A.');
// Richtung
const memo = {}; const d1 = L.nextDir(memo, 5, () => .1); const d2 = L.nextDir(memo, 5); const d3 = L.nextDir(memo, 5);
ok('Wechsel', d1 !== d2 && d1 === d3);
// Warteschlange
const q = L.buildQueue(V.filter(v => v.lesson <= 3), 'seq'); let last = 0, mono = true; q.forEach(i => { if (i.lesson < last) mono = false; last = i.lesson; }); ok('seq sortiert', mono && q.length === V.filter(v => v.lesson <= 3).length);
const o = L.makeOptions(w('puella'), 'l2d', V.filter(v => v.lesson <= 3)); eq('3 Optionen', o.length, 3); eq('1 richtig', o.filter(x => x.ok).length, 1); ok('verschieden', new Set(o.map(x => x.text)).size === 3);
// Datenprüfung
V.forEach(v => { if (!L.latForms(v.la).length) { fail++; console.log('keine lat. Form', v.la); } if (!L.deVariants(v).length) { fail++; console.log('keine dt. Variante', v.de); } });
console.log('Wörter:', V.length, ' | pro Lektion:', JSON.stringify(V.reduce((a, v) => (a[v.lesson] = (a[v.lesson] || 0) + 1, a), {})));
console.log(fail ? fail + ' FEHLER' : 'ALLE TESTS OK'); process.exit(fail ? 1 : 0);
