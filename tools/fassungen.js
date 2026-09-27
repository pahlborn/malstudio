'use strict';

/* ============================================================================
   Die Fassungsliste schreiben.

     node tools/fassungen.js

   Erzeugt fassungen.html: was im Regal steht (verlinkt) und was es davor gab
   (aus der Git-Geschichte, unverlinkt). Nebenbei prüft der Lauf, dass die
   Fassungsnummer an beiden Stellen dieselbe ist — sw.js und index.html.
   Gehen sie auseinander, lädt das iPad die alte Fassung weiter, und keine
   Liste der Welt hilft dann.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { nummer } = require('./einfrieren.js');

const ROOT = path.join(__dirname, '..');

function git(args) {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 }); }
  catch (e) { return ''; }
}

/* Für jede Fassung der Commit, der sie eingeführt hat. Gelesen wird sw.js in
   jedem Stand, in dem sie angefasst wurde - dort steht die Nummer. */
function geschichte() {
  const zeilen = git(['log', '--format=%H|%ad|%s', '--date=short', '--', 'sw.js'])
    .trim().split('\n').filter(Boolean);
  const gesehen = new Set();
  const raus = [];
  zeilen.forEach(function (z) {
    const [hash, datum, betreff] = z.split('|');
    const sw = git(['show', hash + ':sw.js']);
    const m = sw.match(/malstudio-(v\d+-\d+)/);
    if (!m || gesehen.has(m[1])) return;         // nur der erste Stand je Nummer
    gesehen.add(m[1]);
    raus.push({ nr: m[1], datum: datum, betreff: betreff });
  });
  return raus;                                   // schon neu → alt
}

function imRegal() {
  const regal = path.join(ROOT, 'v');
  if (!fs.existsSync(regal)) return [];
  return fs.readdirSync(regal).filter(n => fs.existsSync(path.join(regal, n, 'index.html')));
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function seite() {
  const jetzt = nummer();                        // wirft, wenn die Nummern auseinandergehen
  const regal = new Set(imRegal());
  const alle = geschichte();
  const reihen = alle.map(function (f) {
    const drin = regal.has(f.nr);
    return '      <tr' + (f.nr === jetzt ? ' class="jetzt"' : '') + '>' +
      '<td class="nr">' + (drin ? '<a href="v/' + f.nr + '/">' + f.nr + '</a>' : f.nr) + '</td>' +
      '<td class="d">' + f.datum + '</td>' +
      '<td>' + esc(f.betreff) + (f.nr === jetzt ? ' <span class="jetztmark">läuft heute</span>' : '') + '</td>' +
      '<td class="r">' + (drin ? '<a href="v/' + f.nr + '/">ansehen</a>' : '—') + '</td></tr>';
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Malstudio — Fassungen</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Alle Fassungen von Malstudio. Was im Regal steht, lässt sich anklicken und bleibt dort für immer.">
<meta name="theme-color" content="#eaf6fa">
<link rel="icon" href="icon-192.png">
<style>
  *,*::before,*::after{box-sizing:border-box}
  :root{--room:#eaf6fa;--card:#fff;--ink:#14405a;--quiet:#5b7b8c;--edge:rgba(20,64,90,.14);--warm:#ffe496}
  @media (prefers-color-scheme:dark){
    :root{--room:#10222c;--card:#17303c;--ink:#dcecf3;--quiet:#94b0bd;--edge:rgba(0,0,0,.45)}}
  html{-webkit-text-size-adjust:100%}
  body{margin:0;padding:clamp(20px,5vw,48px) clamp(16px,4vw,32px) calc(clamp(20px,5vw,48px) + env(safe-area-inset-bottom));
    background:var(--room);color:var(--ink);
    font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  main{max-width:820px;margin:0 auto}
  h1{font-size:clamp(23px,5vw,30px);margin:0 0 .3rem;font-weight:700}
  .lede{color:var(--quiet);margin:0 0 1.5rem}
  h2{font-size:12px;margin:2.4rem 0 .8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--quiet)}
  p{margin:0 0 1rem}
  a{color:inherit}
  .hinweis{background:var(--card);border:1px solid var(--edge);border-radius:14px;padding:14px 18px;margin:0 0 1.4rem;font-size:15px}
  .hinweis>b:first-child{display:block;margin-bottom:.3rem}
  table{border-collapse:collapse;width:100%;font-size:15px;background:var(--card);border-radius:14px;overflow:hidden}
  th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--edge);vertical-align:top}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--quiet);font-weight:700}
  tr:last-child td{border-bottom:0}
  .nr{font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:600}
  .d{color:var(--quiet);white-space:nowrap;font-variant-numeric:tabular-nums}
  .r{text-align:right;white-space:nowrap}
  .jetzt{background:rgba(255,228,150,.4)}
  @media (prefers-color-scheme:dark){.jetzt{background:rgba(255,228,150,.12)}}
  .jetztmark{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--quiet)}
  footer{margin-top:2.4rem;font-size:13.5px;color:var(--quiet);border-top:1px solid var(--edge);padding-top:1.1rem}
</style>
</head>
<body>
<main>

  <h1>Malstudio — Fassungen</h1>
  <p class="lede">Was im Regal steht, lässt sich anklicken und bleibt dort für immer.</p>

  <div class="hinweis">
    <b>Wozu das gut ist.</b>
    Wenn eine neue Fassung etwas kaputt macht — im Urlaub, ohne Rechner in der
    Nähe —, ist „zurück auf die vorige" ein Link statt eines Auftrags. Die
    Kinder malen weiter. Zwei Dinge sind an einer Regalfassung anders, und
    beide mit Absicht: Sie <b>läuft nur online</b> (kein Service Worker,
    sonst löschte der den Offline-Vorrat der heutigen App), und sie hat
    <b>ihren eigenen Speicher</b> — was dort gemalt wird, erscheint nicht in
    der Galerie der heutigen App und kann ihr auch nichts wegnehmen.
  </div>

  <h2>Alle Fassungen</h2>
  <table>
    <thead><tr><th>Fassung</th><th>Datum</th><th>Was sie gebracht hat</th><th class="r">Regal</th></tr></thead>
    <tbody>
${reihen}
    </tbody>
  </table>

  <footer>
    <p>Erzeugt von <code>tools/fassungen.js</code> aus der Git-Geschichte —
      nicht von Hand gepflegt. Das Regal beginnt mit ${esc(jetzt)}; ältere
      Fassungen stehen hier der Vollständigkeit halber und lassen sich bei
      Bedarf aus der Geschichte nachstellen.
      <a href="index.html">Zur App</a></p>
  </footer>

</main>
</body>
</html>
`;
}

if (require.main === module) {
  try {
    const html = seite();
    fs.writeFileSync(path.join(ROOT, 'fassungen.html'), html);
    const n = (html.match(/<tr/g) || []).length - 1;
    console.log('\nfassungen.html: ' + n + ' Fassungen, ' + imRegal().length + ' davon im Regal\n');
  } catch (err) {
    console.log('\n  ABBRUCH: ' + err.message + '\n');
    process.exit(1);
  }
}
module.exports = { seite, geschichte };
