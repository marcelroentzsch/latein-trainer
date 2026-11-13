// Geräuschsperre mit künstlichen Signalen prüfen (Rauschen, Sprache, Echo, Knall)
const { chromium } = require('playwright');
let fails = 0; const ok = (n, c, i) => { if (!c) fails++; console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : ' -> ' + JSON.stringify(i))); };
(async () => { const b = await chromium.launch(); const p = await b.newPage(); await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('.lcard');
  const r = await p.evaluate(() => { const G = window.Gem.gate; const N = 800;
    const chunk = (amp, kind) => { const c = new Int16Array(N); for (let i = 0; i < N; i++) c[i] = kind === 'noise' ? (Math.random() - .5) * 2 * amp * 32767 : amp * 32767 * Math.sin(i / 3) * (0.6 + 0.4 * Math.sin(i / 90)); return c; };
    const run = (seq, echo = false) => { let sent = 0, speech = 0, late = 0; seq.forEach(([amp, kind], idx) => { const out = G.pass(chunk(amp, kind), echo); const loud = out.filter(x => x.some(v => v !== 0)).length; sent += loud; if (kind === 'voice' && out[out.length - 1].some(v => v !== 0)) speech++; if (idx >= 40 && kind !== 'voice') late += loud; }); return { sent, speech, late }; };
    const rep = (n, a, k) => Array.from({ length: n }, () => [a, k]);
    const res = {};
    G.floor = 0.004; G.reset(); G.bargeIn = false;
    res.room = run(rep(60, 0.003, 'noise'));                                        // 3 s ruhiger Raum
    res.fan = run(rep(100, 0.02, 'noise'));                                         // 5 s Lüfter/Straße, gleichmäßig
    res.voiceInNoise = run(rep(20, 0.02, 'noise').concat(rep(16, 0.15, 'voice'), rep(30, 0.02, 'noise')));
    G.floor = 0.004; G.reset();
    res.knock = run(rep(20, 0.003, 'noise').concat([[0.5, 'noise']], rep(30, 0.003, 'noise')));
    G.floor = 0.004; G.reset();
    res.voice = run(rep(10, 0.003, 'noise').concat(rep(16, 0.12, 'voice'), rep(20, 0.003, 'noise')));
    res.echoOff = run(rep(40, 0.1, 'voice'), true);                                 // eigene Stimme aus dem Lautsprecher
    G.bargeIn = true; G.reset();
    res.echoBargeQuiet = run(rep(40, 0.05, 'voice'), true);
    res.echoBargeLoud = run(rep(16, 0.3, 'voice'), true);
    return res; });
  console.log(JSON.stringify(r));
  ok('ruhiger Raum: nichts wird gesendet', r.room.sent === 0, r.room);
  ok('gleichmäßiges Geräusch (Lüfter, Straße): nach 2 s gelernt, danach bleibt es draußen', r.fan.late === 0, r.fan);
  ok('Sprache trotz Geräusch kommt durch', r.voiceInNoise.speech === 16, r.voiceInNoise);
  ok('kurzer Knall öffnet nur kurz (höchstens 1 s)', r.knock.sent <= 20, r.knock);
  ok('normale Sprache inkl. Vorlauf kommt durch', r.voice.speech === 16 && r.voice.sent >= 16, r.voice);
  ok('eigene Stimme wird nie gesendet', r.echoOff.sent === 0, r.echoOff);
  ok('Dazwischenreden: Echo bleibt draußen', r.echoBargeQuiet.sent === 0, r.echoBargeQuiet);
  ok('Dazwischenreden: laute nahe Sprache kommt durch', r.echoBargeLoud.speech >= 15, r.echoBargeLoud);
  await b.close(); console.log(fails ? fails + ' FEHLER' : 'ALLE GATE-TESTS OK'); process.exit(fails ? 1 : 0); })();
