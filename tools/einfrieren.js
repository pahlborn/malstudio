'use strict';

/* ============================================================================
   Eine Fassung ins Regal stellen.

     node tools/einfrieren.js

   Sie landet unter /v/<nummer>/ und bleibt dort für immer erreichbar. Damit
   ist „zurück auf v7-48" ein Link statt eines Auftrags: Wenn eine neue
   Fassung im Urlaub etwas kaputt macht, malen die Kinder weiter.

   ZWEI KOLLISIONEN, und beide würden Schaden anrichten, wenn man einfach
   Dateien kopierte. Nachgesehen, nicht vermutet:

   1. Der Service Worker. sw.js Zeile 56 lautet
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      — JEDER fremde Cache fliegt raus, nicht nur die eigenen älteren. Eine
      eingefrorene Fassung mit eigenem Worker würde also den Offline-Vorrat
      der laufenden App vollständig löschen. Ein Regal, das die Wohnung
      anzündet. Deshalb: eingefrorene Fassungen bekommen GAR KEINEN Worker.
      Sie laufen nur online. Das ist kein Mangel, sondern ihr Zweck.

   2. Der Speicher. Die Bilder der Kinder liegen unter pic:<Profil>:<Nr> im
      localStorage, dazu profiles, motif:, motifpic:, lang, mode und die
      Schatzsuche-Schlüssel — alle ohne Präfix, alle auf demselben Origin.
      Eine alte Fassung läse und ÜBERSCHRIEBE dieselben Schlüssel; beim
      Löschen eines Profils nähme sie gemalte Bilder mit. Deshalb bekommt
      jede eingefrorene Fassung ihren eigenen Speichernamen.

   Wie 2 gelöst ist: NICHT durch Umschreiben einzelner Schlüsselnamen. Die
   werden zur Laufzeit zusammengesetzt ('pic:'+p.id+':'), da trifft ein
   regulärer Ausdruck nur die Hälfte. Stattdessen wird `Store` selbst
   umschlossen — die eine Stelle, durch die jeder Schlüssel muss. Was
   Store.keys() zurückgibt, wird wieder entstempelt, denn die Aufrufer
   reichen diese Schlüssel an Store.get() und Store.del() weiter.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT  = path.join(__dirname, '..');
const REGAL = path.join(ROOT, 'v');

/* Die Fassungsnummer steht an zwei Stellen. Stimmen sie nicht überein, wird
   nichts eingefroren: Dann ist unklar, welche Fassung das hier überhaupt
   wäre, und eine falsch beschriftete Fassung im Regal ist schlimmer als
   keine. */
function nummer() {
  const sw   = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const a = sw.match(/const CACHE\s*=\s*'malstudio-(v\d+-\d+)'/);
  const b = html.match(/const APP_VERSION\s*=\s*'(v\d+-\d+)'/);
  if (!a) throw new Error('sw.js: keine Cache-Nummer gefunden');
  if (!b) throw new Error('index.html: kein APP_VERSION gefunden');
  if (a[1] !== b[1]) {
    throw new Error('Die Nummern gehen auseinander: sw.js sagt ' + a[1] +
                    ', index.html sagt ' + b[1] + '.');
  }
  return a[1];
}

/* Schriften, Fotos, Sprites und Symbole bleiben oben liegen: zusammen 2,5 MB,
   und sie ändern sich fast nie. Ein Regal, das zwanzigmal dieselben Bytes
   trägt, ist ein schlechtes Regal. Umgebogen wird nur, was es als Datei
   wirklich gibt — dadurch kann kein Verweis still danebengehen, und was
   nicht gefunden wurde, steht unten im Bericht. */
function dateienOben() {
  return fs.readdirSync(ROOT)
    .filter(n => /\.(jpg|jpeg|png|css|webmanifest)$/i.test(n))
    .sort((a, b) => b.length - a.length);      // längste zuerst, sonst frisst
}                                              // 'icon-192.png' Teile von sich

function biegeVerweise(html, bericht) {
  dateienOben().forEach(function (name) {
    const roh = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    ['"', "'"].forEach(function (q) {
      const re = new RegExp(q + roh + q, 'g');
      const treffer = (html.match(re) || []).length;
      if (treffer) {
        html = html.replace(re, q + '../../' + name + q);
        bericht.gebogen += treffer;
      }
    });
  });
  /* Kein Manifest: Eine Fassung aus dem Regal soll sich nicht auf den
     Homescreen legen lassen. Sie ist zum Nachsehen da, nicht zum Wohnen. */
  html = html.replace(/\s*<link rel="manifest"[^>]*>/, '');
  return html;
}

/* Der Worker wird nicht mitgenommen, also darf ihn auch niemand anmelden.
   Nicht herausgeschnitten, sondern stillgelegt: Die Anmeldung steht in einer
   async-Funktion mit try/catch drumherum, und ein regulärer Ausdruck träfe
   die schließende Klammer nicht zuverlässig. Stillgelegt wird deshalb an der
   einzigen Stelle, die sich nie ändert — der Schnittstelle des Browsers. */
const STILLGELEGT =
  '\n/* Im Regal ohne Service Worker - siehe tools/einfrieren.js. Eine\n' +
  '   eingefrorene Fassung darf keinen anmelden: Ihr activate löscht JEDEN\n' +
  '   fremden Cache und damit den Offline-Vorrat der laufenden App.\n' +
  '\n' +
  '   Die Attrappe LEHNT AB, sie hängt nicht. Das Atelier gibt an dieser\n' +
  '   Stelle ein Versprechen zurück, das nie eingelöst wird - dort wird die\n' +
  '   Anmeldung nebenbei abgeschickt, das genügt. Hier steht ein await davor,\n' +
  '   mitten im Startlauf (index.html, "const reg=await ...register"). Ein\n' +
  '   hängendes Versprechen fror den ganzen Start ein, und zwar lautlos: Die\n' +
  '   Seite zeigte nur das Regalband, kein Fehler in der Konsole, weil das\n' +
  '   umgebende catch gar nicht erst erreicht wurde. Eine Ablehnung fängt\n' +
  '   genau dieses catch - der Code ist auf eine gescheiterte Anmeldung\n' +
  '   ohnehin vorbereitet. */\n' +
  "if (typeof navigator !== 'undefined' && navigator.serviceWorker) {\n" +
  '  navigator.serviceWorker.register = function () {\n' +
  "    return Promise.reject(new Error('Regalfassung: ohne Service Worker'));\n" +
  '  };\n' +
  '}\n';

function legeWorkerStill(html) {
  const i = html.indexOf('<script');
  if (i < 0) throw new Error('index.html: kein <script> gefunden');
  const j = html.indexOf('>', i) + 1;
  return html.slice(0, j) + STILLGELEGT + html.slice(j);
}

/* Der Speicher bekommt einen eigenen Namen. Umschlossen wird Store als
   Ganzes, nicht seine einzelnen Schlüssel. */
function stempleSpeicher(html, nr, bericht) {
  const anfang = html.indexOf('const Store=(function(){');
  if (anfang < 0) {
    throw new Error('index.html: Store nicht gefunden. Wurde er umgebaut? ' +
                    'Dann muss dieses Werkzeug nachgezogen werden — ohne ' +
                    'Stempel schreibt die Regalfassung in die Bilder der Kinder.');
  }
  const ende = html.indexOf('\n})();', anfang);
  if (ende < 0) throw new Error('index.html: Ende von Store nicht gefunden');
  const nach = ende + '\n})();'.length;

  const huelle =
    '\n\n/* Regal: eigener Speicher. Jeder Schlüssel dieser Fassung trägt ihre\n' +
    '   Nummer, damit sie der laufenden App nicht in die Galerie schreibt.\n' +
    '   Was keys() zurückgibt, wird wieder entstempelt - die Aufrufer reichen\n' +
    '   diese Schlüssel an get() und del() weiter. */\n' +
    'Store = (function (echt, marke) {\n' +
    '  return {\n' +
    '    get:  function (k)    { return echt.get(marke + k); },\n' +
    '    set:  function (k, v) { return echt.set(marke + k, v); },\n' +
    '    del:  function (k)    { return echt.del(marke + k); },\n' +
    '    keys: function (p)    { return Promise.resolve(echt.keys(marke + p))\n' +
    '            .then(function (l) { return l.map(function (k) {\n' +
    '              return k.slice(marke.length); }); }); }\n' +
    '  };\n' +
    "})(Store, 'regal-" + nr + ":');\n";

  /* const lässt sich nicht neu binden, let schon. */
  const vorn = html.slice(0, anfang) + 'let Store=(function(){' +
               html.slice(anfang + 'const Store=(function(){'.length, nach);
  bericht.gestempelt = true;
  return vorn + huelle + html.slice(nach);
}

/* Ein Band oben, damit nach zwei Minuten noch klar ist, was da läuft. Genau
   diese Verwechslung war im Atelier der Anlass für das ganze Regal. */
function stempleBand(html, nr) {
  const band =
    '<div style="position:fixed;left:0;right:0;top:0;z-index:99999;' +
    'padding:3px 10px;font:11px/1.4 system-ui,sans-serif;text-align:center;' +
    'color:#4a4236;background:rgba(255,228,150,.96);' +
    'padding-top:calc(3px + env(safe-area-inset-top))">' +
    'Malstudio ' + nr + ' &middot; Fassung aus dem Regal, nur zum Nachsehen ' +
    '&middot; <a href="../../index.html" style="color:inherit">zur heutigen App</a></div>\n';
  return html.replace(/<body([^>]*)>/, '<body$1>\n' + band);
}

function einfrieren() {
  const nr = nummer();
  const ziel = path.join(REGAL, nr);
  if (fs.existsSync(ziel)) {
    console.log('  ' + nr + ': steht schon im Regal');
    return { nr: nr, neu: false };
  }
  const bericht = { gebogen: 0, gestempelt: false };
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = biegeVerweise(html, bericht);
  html = stempleSpeicher(html, nr, bericht);
  html = legeWorkerStill(html);
  html = stempleBand(html, nr);

  fs.mkdirSync(ziel, { recursive: true });
  fs.writeFileSync(path.join(ziel, 'index.html'), html);
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  console.log('  ' + nr + ' → v/' + nr + '/index.html  (' + kb + ' kB, ' +
              bericht.gebogen + ' Verweise umgebogen, Speicher gestempelt)');
  return { nr: nr, neu: true };
}

if (require.main === module) {
  console.log('\nEinfrieren\n');
  try { einfrieren(); }
  catch (err) { console.log('  ABBRUCH: ' + err.message + '\n'); process.exit(1); }
  console.log('');
}

module.exports = { einfrieren, nummer };
