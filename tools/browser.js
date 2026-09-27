'use strict';

/* Browsersuche für die Werkzeuge in tools/.

   Übernommen aus dem Mandala-Atelier, damit beide Häuser denselben Weg
   gehen. playwright-core bringt selbst keinen Browser mit — genommen wird
   einer, der ohnehin auf dem Rechner liegt. */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PLAYWRIGHT_BROWSERS_PATH &&
    path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium', 'chrome-linux', 'chrome'),
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome'
];

function findeChrome() {
  for (const c of CANDIDATES) {
    if (c && fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

/* playwright-core liegt hier nicht im Projekt, sondern global unter
   playwright. Deshalb wird auch dort nachgesehen, statt ein npm install zu
   verlangen — dieses Repo hatte bis heute gar kein package.json. */
function ladeChromium() {
  const orte = [
    'playwright-core',
    'playwright',
    '/opt/node22/lib/node_modules/playwright/node_modules/playwright-core',
    '/opt/node22/lib/node_modules/playwright'
  ];
  for (const ort of orte) {
    try {
      const m = require(ort);
      if (m && m.chromium) return m.chromium;
    } catch (e) { /* weiter */ }
  }
  for (const wurzel of (Module.globalPaths || [])) {
    try {
      const m = require(path.join(wurzel, 'playwright'));
      if (m && m.chromium) return m.chromium;
    } catch (e) { /* weiter */ }
  }
  return null;
}

async function launch() {
  const chromium = ladeChromium();
  if (!chromium) throw new Error('playwright-core nicht gefunden (npm i -D playwright-core).');
  const executablePath = findeChrome();
  if (!executablePath) throw new Error('Kein Chrome/Chromium gefunden; Pfad über CHROME_PATH setzen.');
  return chromium.launch({ executablePath, args: ['--allow-file-access-from-files', '--no-sandbox'] });
}

module.exports = { launch, findeChrome };
