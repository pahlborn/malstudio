# So geht es mit Claude Code weiter

Dieser Ordner ist das komplette Projekt. Alles, was Claude Code braucht, liegt
hier.

## 1. Ordner auf den Computer holen

Lade diesen Ordner (`malstudio-projekt`) herunter und entpacke ihn irgendwohin,
wo du ihn wiederfindest, z. B. `~/Projekte/malstudio-projekt`.

## 2. Claude Code im Ordner starten

Im Terminal:

```
cd ~/Projekte/malstudio-projekt
claude
```

Claude Code liest beim Start automatisch `CLAUDE.md` – darin steht der ganze
Projektkontext, die Regeln und der Phasenplan. Du musst nichts davon
wiederholen.

## 3. Erster Satz an Claude Code

Sag einfach so etwas wie:

> Lies CLAUDE.md und ARCHITEKTUR.md. Fass mir in ein paar Sätzen zusammen, wo
> das Projekt steht und was Phase 2 als Erstes bringen würde. Dann fang mit dem
> kleinsten sinnvollen Schritt von Phase 2 an – aber ändere noch nichts, bevor
> du mir den Plan gezeigt hast.

Danach arbeitet ihr in kleinen Schritten weiter: Claude Code schlägt vor,
ändert, du testest, nächster Schritt.

## 4. Testen

- App ansehen: `index.html` im Browser öffnen (Doppelklick genügt zum Testen).
- Auf dem iPad testen: den Ordner einmal veröffentlichen (GitHub Pages oder
  Netlify Drop – siehe unten), Adresse in **Safari** öffnen, über Teilen →
  „Zum Home-Bildschirm" installieren.

## 5. Veröffentlichen (wenn eine Version reif ist)

- **Netlify Drop:** app.netlify.com/drop, den Ordner ins Fenster ziehen. Fertig,
  Quellcode bleibt unsichtbar. Kein Konto nötig.
- **GitHub Pages:** Ordner ins Repo, Settings → Pages → Branch `main`, Save.
  Feste Adresse, leichtere Updates.

Wichtig nach jedem veröffentlichten Update: In `sw.js` steht `const CACHE =
'malstudio-vX-Y'`. Diese Nummer bei jeder neuen Fassung erhöhen, sonst zeigt
das iPad die alte Version. (Claude Code weiß das und macht es mit.)

## Was in diesem Ordner liegt

- `index.html` – die App
- `manifest.webmanifest`, `sw.js`, `icon-*.png` – für die Installation/Offline
- `CLAUDE.md` – Projektkontext & Regeln (für Claude Code)
- `ARCHITEKTUR.md` – technische Landkarte des Codes
- `START-HIER.md` – dieses Dokument
- `archiv/` – alte Prototypen, nur zur Referenz
