'use strict';

/* ============================================================================
   fassung.json schreiben — die Datei, die eine eingerichtete App abruft, um
   zu erfahren, dass es eine neuere gibt.

     npm run fassung-datei

   Sie enthält drei Angaben und sonst nichts: die Nummer, das Datum und einen
   Satz dazu, was die Fassung gebracht hat. Kein Zähler, keine Kennung, nichts,
   was ein Kind beträfe — die Datei ist für alle dieselbe und weiß nicht, wer
   sie holt.

   Der Satz kommt aus der Git-Geschichte, nicht aus der Hand: aus dem Commit,
   der die Nummer eingeführt hat. Von Hand gepflegt veraltet er beim zweiten
   Mal.

   Nebenbei prüft der Lauf, dass die Nummer in sw.js und in index.html dieselbe
   ist, und bricht sonst ab. Gingen sie auseinander, meldete die Datei eine
   Fassung, die es so nicht gibt — und jedes iPad lüde ewig im Kreis, weil die
   geholte Fassung immer noch kleiner wäre als die angekündigte.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MUSTER_SW   = /const CACHE *= *'malstudio-(v[\d-]+)'/;
const MUSTER_HTML = /const APP_VERSION *= *'(v[\d-]+)'/;

function git(args) {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 }); }
  catch (e) { return ''; }
}

function nummer() {
  const sw   = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const a = sw.match(MUSTER_SW);
  const b = html.match(MUSTER_HTML);
  if (!a) throw new Error('keine Cache-Nummer in sw.js');
  if (!b) throw new Error('kein APP_VERSION in index.html');
  if (a[1] !== b[1]) {
    throw new Error('die Nummern gehen auseinander — sw.js sagt ' + a[1] +
                    ', index.html sagt ' + b[1] + '.');
  }
  return b[1];
}

/* Datum und Satz aus dem Commit, der diese Nummer eingeführt hat. Wurde sie
   noch nicht committet, gilt heute und kein Satz. Genau deshalb steht dieser
   Lauf in der Anleitung NACH dem Commit. */
function woher(nr) {
  const zeilen = git(['log', '--format=%H|%ad|%s', '--date=short', '--', 'sw.js'])
    .trim().split('\n').filter(Boolean);
  for (const z of zeilen) {
    const [hash, datum, betreff] = z.split('|');
    const m = git(['show', hash + ':sw.js']).match(MUSTER_SW);
    if (m && m[1] === nr) return { seit: datum, was: betreff };
  }
  return { seit: new Date().toISOString().slice(0, 10), was: '' };
}

function schreiben() {
  const nr = nummer();
  const w  = woher(nr);
  const datei = path.join(ROOT, 'fassung.json');
  fs.writeFileSync(datei, JSON.stringify({ fassung: nr, seit: w.seit, was: w.was }, null, 2) + '\n');
  return { nr: nr, datei: 'fassung.json', seit: w.seit, was: w.was };
}

if (require.main === module) {
  console.log('\nfassung.json\n');
  try {
    const r = schreiben();
    console.log('  ' + r.nr.padEnd(9) + r.datei + '   ' + r.seit);
    if (r.was) console.log('  ' + ' '.repeat(9) + r.was);
    else console.log('  ' + ' '.repeat(9) + '(noch kein Commit zu dieser Nummer — nach dem Commit noch einmal laufen lassen)');
  } catch (err) {
    console.log('  ABBRUCH: ' + err.message + '\n');
    process.exit(1);
  }
  console.log('');
}

module.exports = { schreiben, nummer };
