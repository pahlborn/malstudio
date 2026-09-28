'use strict';

/* ============================================================================
   Die Fassungsmeldung prüfen.

     npm run test:fassung

   Alles im echten Browser über HTTP gemessen — über file:// ginge kein fetch
   und der Lauf prüfte nichts. Elf Haken:

   1. AB WERK STILL. Ohne Zutun der Eltern geht KEIN Abruf hinaus. Das ist der
      Haken, an dem die ganze Sache hängt: „alles offline" bleibt die Regel,
      und diese Ausnahme muss man einschalten.
   2. Angeschaltet wird genau EINE Adresse geholt, und es ist fassung.json.
   3. Ist die gemeldete Nummer neuer, erscheint das Band. Ist sie gleich oder
      älter, erscheint es nicht.
   4. Ohne Netz passiert nichts und es erscheint kein Fehler.
   5. ?fassung=aus schaltet alles ab.
   6. Beim allerersten Start wird EINMAL gefragt. Danach nie wieder.
   7. Still gestellt wird beim Fund nur GEMERKT, nicht geladen — sonst wäre
      das Bild eines Kindes mitten im Malen weg.
   8. Beim nächsten Start wird das Gemerkte angewendet, danach sagt ein Toast,
      dass es geklappt hat — und er schweigt, wenn nicht.
   9. Die Regalfassung ist stillgelegt. Das ist kein Schönheitsfehler: Ihr
      Knopf „Jetzt laden" räumte den Vorrat unter DERSELBEN Adresse mit
      DENSELBEN Vorratsnamen — den der laufenden App, mit allen Bildern
      offline dahinter.

   Jeder Haken ist so gebaut, dass er auch anschlagen KANN; ein Prüflauf, der
   das nicht tut, ist wertlos.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { launch } = require('./browser.js');

const ROOT = path.join(__dirname, '..');
const NEUER = { fassung: 'v9-99', seit: '2099-01-01', was: 'Probefassung' };
const TYPEN = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp' };

/* Der Server darf die Fassungsdatei unterwegs ersetzen — so lässt sich eine
   neuere Fassung vortäuschen, ohne eine Datei anzufassen. */
let gefaelscht = null;
/* „kein Netz" wird NICHT über setOffline nachgestellt: Das greift bei
   localhost nicht durch, der Abruf ging trotzdem hinaus und der Lauf bestand
   falsch. Stattdessen verweigert der Server die Datei — aus Sicht der App ist
   das derselbe Fall, und er ist verlässlich herstellbar. */
let kaputt = false;

function server() {
  return new Promise(function (ok) {
    const s = http.createServer(function (req, res) {
      const rein = decodeURIComponent(req.url.split('?')[0]);
      if (/\/fassung\.json$/.test(rein)) {
        if (kaputt) { res.writeHead(503); return res.end('kein Netz'); }
        if (gefaelscht) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(gefaelscht));
        }
      }
      const p = path.join(ROOT, path.normalize(rein).replace(/^(\.\.[/\\])+/, ''));
      const datei = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
      if (!fs.existsSync(datei)) { res.writeHead(404); return res.end('weg'); }
      res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' });
      res.end(fs.readFileSync(datei));
    });
    s.listen(0, '127.0.0.1', function () { ok({ s: s, port: s.address().port }); });
  });
}

/* Die Schlüssel stehen roh im localStorage, ohne Präfix — so hält Store sie.
   Gesetzt wird hier von außen, damit der Lauf nicht die Oberfläche
   nachklicken muss. */
function setz(o) {
  if (o.an) localStorage.setItem('fassung.sehen', '1');
  if (o.still) localStorage.setItem('fassung.still', '1');
  if (o.gefragt !== false) localStorage.setItem('fassung.gefragt', '1');
  if (o.bereit) localStorage.setItem('fassung.bereit', o.bereit);
  if (o.getan) localStorage.setItem('fassung.getan', o.getan);
}

(async () => {
  const { s, port } = await server();
  const basis = 'http://127.0.0.1:' + port + '/';
  const b = await launch();
  const befunde = [];

  /* Ein Durchgang: frischer Browserzustand, Schalter nach Wunsch, dann zählen,
     was hinausgeht und was zu sehen ist. */
  async function lauf(name, opt) {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    const raus = [], fehler = [];
    p.on('request', function (r) {
      const u = r.url();
      if (u.indexOf('http://127.0.0.1:' + port) !== 0) raus.push('FREMD ' + u);
      else if (/fassung\.json/.test(u)) raus.push(u.replace('http://127.0.0.1:' + port, ''));
    });
    p.on('pageerror', e => fehler.push(e.message));
    p.on('console', function (m) {
      /* „Failed to load resource" meldet der Browser selbst, wenn eine Anfrage
         scheitert — das ist nicht unsere Fehlermeldung und für ein Kind
         unsichtbar. Gezählt wird nur, was aus dem Code kommt. */
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fehler.push(m.text());
    });

    if (!opt.offline) {
      /* Der Vorbereitungslauf MUSS abgeschaltet sein. Sonst fährt die App auch
         dort hoch, ihr start() verbraucht die eben gesetzten Merker — etwa
         „getan" für den Toast — und der eigentliche Lauf findet nichts mehr
         vor. */
      await p.goto(basis + '?fassung=aus', { waitUntil: 'load' });
      await p.evaluate(new Function('o', '(' + setz.toString() + ')(o)'),
                       { an: opt.an, still: opt.still, gefragt: opt.gefragt,
                         bereit: opt.bereit, getan: opt.getan });
    }
    await p.goto(basis + (opt.zusatz || ''), { waitUntil: 'load' });
    if (opt.offline) {
      /* Erst laden, dann das Netz kappen, dann anschalten: schalten() prüft
         sofort. Stünde der Schalter schon beim Laden auf an, prüfte die App
         noch mit Netz, das Band stünde da, und der Lauf meldete es hinterher
         als „Band ohne Netz". */
      await p.waitForTimeout(2600);
      raus.length = 0;
      kaputt = true;
      await p.evaluate(function () { window.__fassung.schalten(true); });
    }
    await p.waitForTimeout(4200);
    const sicht = await p.evaluate(function () {
      const t = function (id) {
        const d = document.getElementById(id);
        return d ? d.textContent.replace(/\s+/g, ' ').trim() : null;
      };
      return { band: t('fassungsband'), frage: t('fassungsfrage'), toast: t('fassungstoast'),
               bereit: localStorage.getItem('fassung.bereit'),
               fassung: window.__fassung ? window.__fassung.nummer() : null };
    }).catch(function () { return {}; });
    await ctx.close();
    return { name: name, abrufe: raus.filter(u => /fassung\.json/.test(u)),
             fremd: raus.filter(u => u.indexOf('FREMD') === 0),
             band: sicht.band, frage: sicht.frage, toast: sicht.toast,
             bereit: sicht.bereit, fassung: sicht.fassung, fehler: fehler };
  }

  /* Die Wahrheit ist, was die App SAGT, nicht was in fassung.json steht. Ein
     Prüflauf, der bei einem Versionssprung von selbst rot wird, erzieht nur
     dazu, ihn zu ignorieren. */
  gefaelscht = null;
  let r = await lauf('ab Werk', { an: false });
  const HIER = r.fassung;
  console.log('\nFassungsmeldung — Malstudio ' + HIER + '\n');

  function haken(text, ok, gut, schlecht) {
    console.log('  ' + text.padEnd(21) + (ok ? gut : schlecht));
    if (!ok) befunde.push(text.trim());
  }

  /* 1 — ab Werk still. */
  haken('ab Werk aus', r.abrufe.length === 0 && r.fremd.length === 0 && !r.band,
    'kein Abruf, kein Band',
    'ABRUF TROTZ AUS: ' + r.abrufe.concat(r.fremd).join(', '));

  /* 2+3 — angeschaltet, neuere Fassung vorgetäuscht. */
  gefaelscht = NEUER;
  r = await lauf('neuer', { an: true });
  haken('angeschaltet', r.abrufe.length === 1 && r.fremd.length === 0,
    'genau ein Abruf: ' + (r.abrufe[0] || '').split('?')[0],
    r.abrufe.length + ' ABRUFE' + (r.fremd.length ? ' + FREMD' : ''));
  haken('neuere Fassung', !!r.band && r.band.indexOf('v9-99') >= 0,
    'Band da: „' + r.band + '"', 'KEIN BAND');

  /* 3b — gleiche Nummer: kein Band. */
  gefaelscht = { fassung: HIER, seit: '2026-01-01', was: 'dieselbe' };
  r = await lauf('gleich', { an: true });
  haken('gleiche Fassung', !r.band, 'kein Band, richtig', 'BAND OBWOHL GLEICH');

  /* 3c — ältere Nummer: auch kein Band. Ohne diesen Haken bestünde ein
     Vergleich, der einfach immer „neuer" sagt. */
  gefaelscht = { fassung: 'v1-1', seit: '2020-01-01', was: 'uralt' };
  r = await lauf('aelter', { an: true });
  haken('ältere Fassung', !r.band, 'kein Band, richtig', 'BAND OBWOHL ÄLTER');

  /* 4 — ohne Netz. */
  gefaelscht = NEUER;
  r = await lauf('offline', { an: true, offline: true });
  kaputt = false;
  haken('Abruf scheitert', !r.band && r.fehler.length === 0 && r.abrufe.length === 1,
    'versucht, gescheitert, nichts passiert',
    r.band ? 'BAND TROTZ FEHLSCHLAG'
           : (r.abrufe.length !== 1 ? 'gar nicht erst versucht (' + r.abrufe.length + ')'
                                    : 'FEHLERMELDUNG: ' + r.fehler[0]));

  /* 5 — der Abschalter. */
  r = await lauf('abgeschaltet', { an: true, zusatz: '?fassung=aus' });
  haken('?fassung=aus', r.abrufe.length === 0 && !r.band, 'kein Abruf, kein Band', 'GREIFT NICHT');

  /* 6 — die einmalige Frage beim ersten Start. */
  gefaelscht = null;
  r = await lauf('erster Start', { an: false, gefragt: false });
  haken('erster Start', !!r.frage && r.abrufe.length === 0,
    'fragt einmal, und holt vorher nichts',
    r.frage ? 'FRAGT, ABER HOLT SCHON: ' + r.abrufe.length : 'FRAGT NICHT');

  /* 6b — schon gefragt: nie wieder fragen. */
  r = await lauf('schon gefragt', { an: true });
  haken('schon gefragt', !r.frage, 'fragt nicht noch einmal', 'FRAGT WIEDER');

  /* 7 — still gestellt: merken statt laden. Daran hängt das Bild eines
     Kindes. */
  gefaelscht = NEUER;
  r = await lauf('still', { an: true, still: true });
  haken('still gestellt', r.bereit === 'v9-99' && !r.band && r.fassung === HIER,
    'gemerkt (v9-99), kein Band, nicht geladen',
    'gemerkt: ' + r.bereit + ', Band: ' + !!r.band + ', Fassung: ' + r.fassung);

  /* 8 — beim nächsten Start anwenden: Vorrat räumen, neu laden, und den Merker
     wieder vergessen. Dass die Fassung danach dieselbe ist, liegt daran, dass
     es keine neuere Datei gibt — genau deshalb schweigt der Toast hier. */
  gefaelscht = null;
  r = await lauf('anwenden', { an: true, bereit: 'v9-99' });
  haken('Gemerktes anwenden', r.bereit === null && r.fassung === HIER && !r.band,
    'angewendet und wieder vergessen — kein Kreisen',
    'bereit danach: ' + r.bereit + ', Fassung: ' + r.fassung);

  /* 8b — der Toast nach gelungenem Update. */
  r = await lauf('toast', { an: true, getan: 'v0-1' });
  haken('Toast danach', !!r.toast && r.toast.indexOf(HIER) >= 0,
    'sagt: „' + r.toast + '"',
    r.toast ? 'TOAST OHNE NUMMER: ' + r.toast : 'KEIN TOAST');

  /* 8c — und er schweigt, wenn es NICHT geklappt hat. */
  r = await lauf('toast still', { an: true, getan: 'v9-99' });
  haken('Toast bei Fehlschlag', !r.toast, 'schweigt, richtig', 'MELDET ERFOLG OBWOHL NICHT');

  /* 9 — die Regalfassung. Geprüft wird die neueste eingefrorene, denn nur die
     trägt den Block überhaupt. */
  const regal = path.join(ROOT, 'v');
  const nr = (fs.existsSync(regal) ? fs.readdirSync(regal) : [])
    .filter(function (n) {
      const f = path.join(regal, n, 'index.html');
      return fs.existsSync(f) && fs.readFileSync(f, 'utf8').indexOf('FASSUNGSMELDUNG') >= 0;
    })
    .sort(function (a, c) {
      const z = x => (String(x).match(/\d+/g) || []).map(Number);
      const A = z(a), C = z(c);
      for (let i = 0; i < Math.max(A.length, C.length); i++)
        if ((A[i] || 0) !== (C[i] || 0)) return (A[i] || 0) - (C[i] || 0);
      return 0;
    }).pop();

  if (!nr) {
    haken('Regalfassung', false, '', 'keine mit Block vorhanden — npm run einfrieren?');
  } else {
    gefaelscht = NEUER;
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    const raus = [];
    p.on('request', function (q) { if (/fassung\.json/.test(q.url())) raus.push(q.url()); });
    await p.goto(basis + 'v/' + nr + '/', { waitUntil: 'load' });
    const zustand = await p.evaluate(async function () {
      const M = window.__fassung;
      if (!M) return { hatModul: false };
      /* Anschalten VERSUCHEN — genau so, wie der Schalter in den
         Einstellungen es täte. */
      await M.schalten(true);
      await M.sehen(true);
      M.start();
      return { hatModul: true, erlaubt: await M.erlaubt() };
    });
    await p.waitForTimeout(2600);
    const band = await p.evaluate(function () {
      return !!document.getElementById('fassungsband') || !!document.getElementById('fassungsfrage');
    });
    await ctx.close();
    haken('Regalfassung ' + nr,
      zustand.hatModul && zustand.erlaubt === false && raus.length === 0 && !band,
      'stillgelegt: kein Abruf, kein Band, erlaubt() falsch',
      'NICHT STILLGELEGT — Modul: ' + zustand.hatModul + ', Abrufe: ' + raus.length +
      ', Band: ' + band + ', erlaubt: ' + zustand.erlaubt);
  }

  await b.close(); s.close();
  console.log('\n' + (befunde.length ? '  ' + befunde.length + ' Befund(e): ' + befunde.join(', ')
                                     : '  Fassungsmeldung in Ordnung.') + '\n');
  process.exit(befunde.length ? 1 : 0);
})();
