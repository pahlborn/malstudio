'use strict';

/* Erzeugt fonts.css neu:  node tools/gen-fonts.js
   Holt die Schriften einmalig von Google Fonts und legt sie als Daten-URI
   ab. Danach braucht die App keinen externen Abruf mehr - das ist der
   einzige Zweck. Eingebettet wird nur der Schnitt "latin". */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SOURCE = 'https://fonts.googleapis.com/css2' +
  '?family=Baloo+2:wght@500;700;800' +
  '&family=Caveat:wght@600;700' +
  '&family=Grandstander:wght@700;800' +
  '&family=Nunito:wght@600;700;800;900' +
  '&display=swap';

const TARGET = path.join(__dirname, '..', 'fonts.css');

/* Ohne Browser-Kennung liefert Google eine Fassung ohne woff2. */
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
};

function fetch(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, { headers: HEADERS }, function (response) {
      if (response.statusCode !== 200) {
        reject(new Error(url + ' antwortete mit ' + response.statusCode));
        return;
      }
      const chunks = [];
      response.on('data', function (c) { chunks.push(c); });
      response.on('end', function () { resolve(Buffer.concat(chunks)); });
    }).on('error', reject);
  });
}

(async function main() {
  const css = (await fetch(SOURCE)).toString('utf8');

  const blocks = css.split('/*').slice(1)
    .map(function (b) { return '/*' + b; })
    .filter(function (b) { return /^\/\*\s*latin\s*\*\//.test(b); });

  if (!blocks.length) throw new Error('Kein Schnitt "latin" in der Antwort.');

  let out = '/* ============================================================\n' +
            '   Schriften, lokal eingebettet.\n' +
            '   Erzeugt von tools/gen-fonts.js \u2013 nicht von Hand \u00e4ndern.\n' +
            '   Quelle: Google Fonts, Schnitt latin, Lizenz SIL Open Font License.\n' +
            '   ============================================================ */\n\n';

  for (const block of blocks) {
    const url = (block.match(/url\((https:[^)]+)\)/) || [])[1];
    if (!url) continue;
    const font = await fetch(url);
    out += block
      .replace(/^\/\*[^*]*\*\/\s*/, '')
      .replace(/url\(https:[^)]+\)/,
        'url(data:font/woff2;base64,' + font.toString('base64') + ')')
      .trim() + '\n\n';
    console.log('eingebettet: ' +
      (block.match(/font-family: '([^']+)'/) || [])[1] + ' ' +
      (block.match(/font-weight: ([^;]+)/) || [])[1] +
      '  (' + Math.round(font.length / 1024) + ' kB)');
  }

  /* Genau eine Leerzeile am Ende – so bleibt ein erneuter Lauf ohne Diff. */
  fs.writeFileSync(TARGET, out.replace(/\n+$/, '\n'));
  console.log('\ngeschrieben: fonts.css  (' + Math.round(out.length / 1024) + ' kB)');
})().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
