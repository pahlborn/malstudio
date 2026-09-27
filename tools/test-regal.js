'use strict';

/* ============================================================================
   Das Regal prüfen.

     node tools/test-regal.js

   Eine eingefrorene Fassung ist nur dann harmlos, wenn dreierlei zutrifft.
   Alles wird im echten Browser nachgemessen, über HTTP statt file:// — über
   file:// liesse sich ein Service Worker ohnehin nicht anmelden, und dann
   prüfte der Lauf an der wichtigsten Stelle nichts.

   1. Sie LÄUFT. Klingt selbstverständlich, war es nicht: Der erste Anlauf
      legte die Worker-Anmeldung mit einem Versprechen still, das nie
      eingelöst wird. Da sie hier mit await im Startlauf steht, fror das den
      ganzen Start ein — lautlos, ohne Fehler in der Konsole. Deshalb prüft
      dieser Lauf zuerst, dass die Profilseite wirklich dasteht.
   2. Sie meldet KEINEN Service Worker an. Sonst löschte dessen activate den
      Offline-Vorrat der laufenden App: sw.js wirft jeden fremden Cache raus.
   3. Sie schreibt NICHT in die Schlüssel der laufenden App. Dort liegen die
      Bilder der Kinder (pic:<Profil>:<Nr>) und die Profile selbst.

   Und die Gegenprobe: Die laufende App darf den Stempel NICHT tragen.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { launch } = require('./browser.js');

const ROOT = path.join(__dirname, '..');
const TYPEN = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };

function server() {
  return new Promise(function (ok) {
    const s = http.createServer(function (req, res) {
      const rein = decodeURIComponent(req.url.split('?')[0]);
      const p = path.join(ROOT, path.normalize(rein).replace(/^(\.\.[/\\])+/, ''));
      const datei = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
      if (!fs.existsSync(datei)) { res.writeHead(404); return res.end('weg'); }
      res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' });
      res.end(fs.readFileSync(datei));
    });
    s.listen(0, '127.0.0.1', function () { ok({ s: s, port: s.address().port }); });
  });
}

function fassungen() {
  const regal = path.join(ROOT, 'v');
  if (!fs.existsSync(regal)) return [];
  return fs.readdirSync(regal)
    .filter(n => fs.existsSync(path.join(regal, n, 'index.html'))).sort();
}

/* Jeder umgebogene Verweis muss auch etwas treffen. Gelesen wird aus der
   Datei, nicht aus dem, was der Browser zufällig angefordert hat: Die
   meisten Fotos lädt die App erst tief drinnen. */
function verweisePruefen(nr) {
  const html = fs.readFileSync(path.join(ROOT, 'v', nr, 'index.html'), 'utf8');
  const namen = new Set();
  const re = /['"]\.\.\/\.\.\/([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(html)) !== null) namen.add(m[1]);
  const fehlend = [...namen].filter(n => !fs.existsSync(path.join(ROOT, n)));
  return { gesamt: namen.size, fehlend: fehlend };
}

(async () => {
  const liste = fassungen();
  console.log('\nDas Regal unter v/\n');
  if (!liste.length) { console.log('  Leer. Erst `npm run einfrieren`.\n'); process.exit(1); }

  const { s, port } = await server();
  const b = await launch();
  const befunde = [];

  async function laden(url) {
    const seite = await (await b.newContext()).newPage();
    const fehler = [], vierNullVier = [];
    seite.on('pageerror', e => fehler.push(e.message));
    seite.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
    seite.on('response', r => { if (r.status() >= 400) vierNullVier.push(r.status() + ' ' + r.url()); });
    await seite.goto('http://127.0.0.1:' + port + url, { waitUntil: 'load' });
    await seite.waitForTimeout(1800);
    const r = await seite.evaluate(async function () {
      const reg = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
      const p = document.getElementById('profiles');
      return {
        worker: reg.length,
        laeuft: !!(p && getComputedStyle(p).display !== 'none' && p.textContent.trim().length > 0),
        schluessel: Object.keys(localStorage).sort()
      };
    });
    await seite.close();
    return Object.assign(r, { fehler: fehler, vierNullVier: vierNullVier });
  }

  for (const nr of liste) {
    const r = await laden('/v/' + nr + '/');
    const v = verweisePruefen(nr);
    const offen = r.schluessel.filter(k => k.indexOf('regal-' + nr + ':') !== 0);
    const ok = {
      laeuft:   r.laeuft,
      worker:   r.worker === 0,
      /* Es muss auch wirklich etwas geschrieben worden sein - sonst wäre
         „keine fremden Schlüssel" nur deshalb wahr, weil nichts da ist. */
      speicher: r.schluessel.length > 0 && offen.length === 0,
      verweise: v.fehlend.length === 0,
      sauber:   r.fehler.length === 0 && r.vierNullVier.length === 0
    };
    console.log('  ' + nr);
    console.log('    läuft              ' + (ok.laeuft   ? 'ja' : 'NEIN - Profilseite leer oder verborgen'));
    console.log('    Service Worker     ' + (ok.worker   ? 'keiner' : 'ANGEMELDET (' + r.worker + ')'));
    console.log('    Speicher           ' + (ok.speicher ? r.schluessel.length + ' Schlüssel, alle gestempelt (' + r.schluessel[0] + ')'
                                                         : 'OFFEN: ' + (r.schluessel.length ? offen.join(', ') : 'gar nichts geschrieben')));
    console.log('    Verweise nach oben ' + (ok.verweise ? v.gesamt + ', alle vorhanden' : v.fehlend.length + ' TREFFEN INS LEERE: ' + v.fehlend.join(', ')));
    console.log('    Konsole            ' + (ok.sauber   ? 'still' : r.fehler.concat(r.vierNullVier).slice(0, 2).join(' | ')));
    Object.keys(ok).forEach(k => { if (!ok[k]) befunde.push(nr + '/' + k); });
  }

  const l = await laden('/');
  const gestempelt = l.schluessel.filter(k => k.indexOf('regal-') === 0);
  const liveOk = l.laeuft && l.schluessel.length > 0 && gestempelt.length === 0;
  console.log('\n  laufende App');
  console.log('    läuft              ' + (l.laeuft ? 'ja' : 'NEIN'));
  console.log('    Speicher           ' + (gestempelt.length ? 'TRÄGT DEN REGAL-STEMPEL: ' + gestempelt.join(', ')
                                                             : l.schluessel.join(', ') + ' - ungestempelt, wie sie soll'));
  if (!liveOk) befunde.push('live');

  await b.close(); s.close();
  console.log('\n' + (befunde.length ? '  ' + befunde.length + ' Befund(e): ' + befunde.join(', ')
                                     : '  Regal in Ordnung.') + '\n');
  process.exit(befunde.length ? 1 : 0);
})();
