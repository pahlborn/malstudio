# Architektur – Malstudio (index.html)

Die App ist derzeit **eine einzelne HTML-Datei** (`index.html`, ~2000 Zeilen):
`<style>` im Kopf, dann Markup in Sektionen, dann ein `<script>` mit der
gesamten Logik in einem IIFE. Kein Build-Schritt, kein Framework – bewusst,
damit sie offline und ohne Werkzeuge läuft.

Die Zeilennummern unten sind ein Einstieg (Stand bei Übergabe). Nach
Änderungen verschieben sie sich – nutze sie als Wegweiser, nicht als Fixpunkt.

## Dateien

- `index.html` – die App.
- `manifest.webmanifest` – PWA-Manifest (`start_url: ./index.html`).
- `sw.js` – Service Worker, cacht die App für Offline. **Bei jedem Release
  `CACHE`-Namen hochzählen.** Die `ASSETS`-Liste muss alle ausgelieferten
  Dateien nennen – beim Aufteilen in Module hier ergänzen.
- `icon-180/192/512.png`, `icon-mask-512.png` – App-Icons.
- `archiv/` – alte Prototypen (fisch-malen, sommer-malen v1–v3, malstudio-v4).
  Nur Referenz, nicht ausgeliefert.

## Bildschirme (Sektionen im Markup)

Jeweils `<section>` mit `hidden`-Umschaltung über `showSection(sec)`:
- `#profiles` – „Wer malt heute?" (Kinderprofile anlegen/wählen)
- `#home` – Motivauswahl, Modus-Umschalter (Nachmalen/Ausmalen), Kopfleiste
  (Eigenes Motiv, Sticker, Galerie, Vollbild, Stimme)
- `#gallery` – gespeicherte Bilder pro Kind
- `#album` – Sticker-Sammelalbum
- `#creator` – „Eigenes Motiv" (Kind malt Schritte selbst)
- `#draw` – die eigentliche Malansicht (Vorlage links, Blatt Mitte,
  Werkzeuge rechts)

`showSection()` (~Z.1186) blendet um und ruft danach `layout()`.

## Zentrale Datenstrukturen

- `MOTIFS` (~Z.430): Array von `{name, emoji, level, steps:[…]}`.
  Jeder Step: `{emoji, title, text, shapes:[…]}`.
  `shapes`-Element ist entweder ein SVG-Path-String (`"M… C… Z"`) **oder**
  ein Kreis als Array `[cx, cy, r]`. Koordinatensystem: **viewBox 800×600**.
  `level` ∈ {leicht, mittel, schwer, Familie}. Eigene Motive der Kinder tragen
  `level:"von mir"` und ein `_key` (Storage-Schlüssel).
- `COLORS` (~Z.913): 36 Farben (Hex). `SIZES` (~Z.922): 4 Stiftbreiten
  (relativ zur Blatthöhe).
- `STICKERS` (~Z.1432): 24 Emoji-Sticker.

## Speicher

`Store` (~Z.930) kapselt Persistenz: nutzt `window.storage` falls vorhanden,
sonst `localStorage`, sonst In-Memory-Fallback. **Immer über `Store` gehen**,
nie direkt `localStorage`. Async API: `get/set/del/keys(prefix)`.
Schlüssel-Schema:
- `profiles` – JSON-Array aller Kinder `{id, name, emoji, count, stickers}`
- `pic:<profileId>:<timestamp>` – ein Galeriebild `{motif, emoji, img(JPEG)}`
- `motif:<profileId>:<timestamp>` – ein selbst erstelltes Motiv
- `lastProfile`, `voiceOn`, `voiceName`, `mode` – Einstellungen

## Audio / Sprache

- `Music` (~Z.944): erzeugt live eine leise Bossa-Nova + Meeresrauschen über
  die Web Audio API. `start/stop/toggle/duck`. Startet erst nach erster
  Nutzerinteraktion (Browser-Regel).
- `Voice`: Sprachausgabe über Web Speech API. Großes Satz-Repertoire nach
  Kategorien (`hello, start, step, praise, encourage, fill, undo, clear,
  finish, gallery, creator, creatorStep, magic, colorStart`), zieht zufällig
  ohne Wiederholung. Das Repertoire liegt einmal je Sprache vor (`P.de`,
  `P.en`, `P.it`). **Klang hängt vom iPad ab** – nicht per Code steuerbar, nur
  Auswahl + Rate/Pitch. `say(pool,vars,force)`, `raw(text)`, `toggle`,
  `setVoice`, `listFor(l)`, `bestFor(l)`.

  Vier Regeln, die nicht aufgeweicht werden sollten:
  1. **Die Flagge führt.** Was gesprochen wird, folgt der eingestellten
     Sprache – nicht umgekehrt. (Früher leitete sich die Sprache aus der
     gewählten Stimme ab; dann las eine deutsche Stimme englischen Text vor.)
  2. **Nur passende Stimmen zur Wahl.** Die Liste im Zahnrad zeigt
     ausschließlich Stimmen der aktuellen Sprache.
  3. **Pro Sprache gemerkt.** `voice.de`, `voice.en`, `voice.it` im `Store`.
  4. **Lieber schweigen als falsch sprechen.** Fehlt für die eingestellte
     Sprache jede Stimme, wird nichts vorgelesen und der Dialog sagt warum.
     Keine Aushilfe in einer anderen Sprache.

## Sprachen (Deutsch, Englisch, Italienisch)

Deutsch ist die Quelle. **Schlüssel ist der deutsche Satz selbst** – fehlt eine
Übersetzung, erscheint automatisch das deutsche Original statt einer Lücke.

- `EN` / `IT`: je ein Wörterbuch `{deutscher Satz: Übersetzung}`, zusammengefasst
  in `DICT={en:EN, it:IT}`. `LANGS` listet die Sprachen, `SUF={en:'En',it:'It'}`
  macht aus der Sprache das Feld-Anhängsel.
- `t(x)` übersetzt einen Satz. `tf(x, {n:…})` einen Satz **mit Lücken**: der
  ganze Satz steht im Wörterbuch, die Lücken heißen `{n}`, `{m}`, `{name}`.
  Fragmente aneinanderkleben geht schief, sobald eine Sprache die Wortstellung
  ändert – deshalb immer `tf()`, nie `t('Noch ')+n+t(' Motive')`.
- Motive, Schritte und Medaillen tragen ihre Übersetzung am Objekt:
  `nameEn/nameIt`, `titleEn/titleIt`, `textEn/textIt`, `labelEn/labelIt`.
  Zugriff über `tName(m)`, `tTitle(s)`, `tText(s)`, `tLabel(o)`.
  **Schritt-Überschriften gehören bewusst nicht ins Wörterbuch**: „Der Rumpf"
  heißt beim Boot anders als bei der Rakete. Motivnamen dagegen sind eindeutig
  und werden beim Start in die Wörterbücher eingehängt, damit Insel, Galerie
  und Medaillen sie ganz normal über `t()` bekommen.
- Statisches HTML markiert man mit Attributen, `uebersetzeSeite()` erledigt den
  Rest: `data-t` (Textinhalt), `data-th` (Inhalt **mit** Markup, z. B. eine
  Überschrift mit farbigem `<span>`), `data-tp` (placeholder), `data-ta`
  (aria-label), `data-tt` (title). Das Original wird beim ersten Mal gemerkt,
  damit mehrfaches Umschalten nichts zerstört.
- `setLang(l, nurAnzeigen)` schaltet um und zeichnet alles neu, was Text
  enthält. **Die Sprache gehört zum Kind** (`profile.lang`); der Gerätewert
  `lang` ist nur die Vorgabe für neue Profile und für den Start ohne Profil.
- Eingestellt wird die Sprache **im Zahnrad**, mit drei Flaggen. Der Dialog
  öffnet ohne Elternschranke, damit Kinder selbst umschalten können.

**Eine vierte Sprache hinzufügen:** Wörterbuch nach dem Muster von `IT` anlegen,
in `DICT`, `LANGS` und `SUF` eintragen, `MOTIF_xx` schreiben und in
`applyMotifTranslations` ergänzen, `P.xx` im `Voice`-Modul, `labelXx` an den
`TROPHIES`, die Sprachspalte in `WIKI`, eine Flagge im Zahnrad. Die Prüfskripte
im Scratchpad laufen über alle Bildschirme und melden fremdsprachige Reste.

## Zeichen-Engine (Phase 1, das Herzstück)

Ein festes Offscreen-Canvas `art` (1200×900, ~Z.1151) hält das Bild in stabiler
Auflösung. `paint()` skaliert es auf das sichtbare `pad`-Canvas. Dadurch
überstehen Drehen/Resize das Bild unbeschadet.

Ablauf eines Strichs:
- `pointerdown/move/up` sammeln Rohpunkte in `strokeObj.pts`
  (Koordinaten im `art`-System, float).
- Während des Zeichnens: `previewStroke()` (~Z.1555) zeichnet die geglättete
  Kurve live aufs `pad` (ohne `art` zu verändern).
- Beim Loslassen: `commitStroke()` (~Z.1566) bringt den Strich endgültig auf
  `art`.

Bausteine:
- `smoothPoints(raw)` (~Z.1585): dünnt aus + gleitender Mittelwert → weniger
  Zittern.
- `strokePath(ctx, pts)` (~Z.1604): zeichnet weiche Kurve (Catmull-Rom → Bézier).
- `detectShape(pts)` (~Z.1618): **Zauberpinsel**. Erkennt Linie / Kreis /
  Rechteck über Geometrie (Geradheit, Radiusstreuung, Randanteil). Gibt sonst
  `null` → Freihand bleibt (nur geglättet). Konservative Schwellen: lieber
  Freihand als falsch begradigen.
- `drawShape(ctx, shape)` (~Z.1660): zeichnet die idealisierte Form.
- `floodFill(sx,sy,hex)` (~Z.1679): Farbeimer. Scanline-Flood mit Toleranz,
  danach 2 Durchgänge **Randausgleich** (helle Anti-Aliasing-Pixel am Rand
  mitfärben, dunkle Umrisslinie nie überschreiben) → kein weißer Saum.

Werkzeuge (`tool` ∈ `pen | magic | fill | erase`), umgeschaltet über
`setTool(k)`. Radierer = zeichnen in Papierweiß.

`snapshot()` / `undoStack` (max 12) für „Zurück"; `outlineToCanvas()` (~Z.1159)
zeichnet den kompletten Motivumriss aufs Blatt für den **Ausmal-Modus**.

## Motiv-/Modus-Fluss

- `renderPicker()` baut die Motivkacheln (Tönung nach `level`).
- `openMotif(i)` (~Z.1316): startet ein Motiv. Verzweigt nach `mode`
  (`draw` = Schritt für Schritt via `show(i)`; `color` = `outlineToCanvas()` +
  Farbeimer, Schrittnavigation ausgeblendet via CSS-Klasse `mode-color`).
- `show(i, silent)` (~Z.1343): zeigt Schritt i (Vorlage links animiert den
  aktuellen Strich rot, Ghost-Vorlage optional aufs Blatt, Sprachausgabe).
- `setMode(m)` (~Z.1395): Nachmalen/Ausmalen umschalten, in `Store` gemerkt.

## Belohnung

- `awardSticker()` (~Z.1435): vergibt beim Speichern in die Galerie den nächsten
  fehlenden Sticker, zeigt `#reward`-Overlay.
- `openAlbum()` (~Z.1456): Sammelalbum (erledigt farbig, offen ausgegraut).
- **Noch NICHT vorhanden (Phase 2):** Sterne pro Schritt, Medaillen, Pokale,
  Pokalschrank, Feuerwerk-Abschluss, personalisierter Startbildschirm,
  „Meeresalbum" mit Motivstatus. Hier setzt die nächste Iteration an.

## Layout / iPad

- `layout()` (~Z.1944): passt das Blatt im Verhältnis 4:3 in den verfügbaren
  Platz ein (Pixelmaße, nicht CSS-aspect-ratio, weil das Element sonst
  kollabiert). Wird bei Resize/Orientierung/Vollbild neu gerufen.
- Safe-Area-Padding am `body`, `100dvh`, `touch-action:none` auf den
  Zeichenflächen. Quer- und Hochformat haben eigene CSS-Zweige
  (`@media (orientation:portrait)`).
- Vollbild-Knopf nutzt Fullscreen-API am Desktop; auf iPad-Safari echtes
  Vollbild nur über „Zum Home-Bildschirm" (der Knopf erklärt das dann).

## Modularisierung (empfohlener erster Refactor-Schritt für Claude Code)

Die Einzeldatei wird groß. Sinnvolle Aufteilung, ohne die Offline-PWA zu
brechen (ES-Module funktionieren lokal über http, GitHub Pages/Netlify liefern
sie korrekt aus):

```
index.html          – Markup + <link>/<script type="module">
css/styles.css       – der <style>-Block
js/data.js           – MOTIFS, COLORS, SIZES, STICKERS
js/store.js          – Store
js/audio.js          – Music, Voice
js/engine.js         – art-Canvas, smoothing, detectShape, floodFill, tools
js/screens.js        – showSection, Motivauswahl, draw-Fluss, Galerie, Album
js/main.js           – Startup/Verdrahtung
```

Beim Aufteilen: alle neuen Dateien in `sw.js` → `ASSETS` eintragen **und**
`CACHE` hochzählen, sonst lädt die installierte App die alten Teile.
Vorher/nachher im Browser testen (Netzwerk aus → muss weiter laufen).

## Testchecklist (nach jeder Änderung)

- [ ] `index.html` lädt ohne Konsolenfehler.
- [ ] Zeichnen (Stift, Zauberpinsel, Farbeimer, Radierer) funktioniert, Touch.
- [ ] Beide Ausrichtungen (quer/hoch), Blatt bleibt sichtbar und richtig groß.
- [ ] Modus Nachmalen **und** Ausmalen.
- [ ] Speichern → Galerie → Sticker; Profile getrennt.
- [ ] Offline (Netzwerk aus) weiterhin lauffähig.
- [ ] Alle drei Sprachen: keine fremdsprachigen Reste, auch nicht in
      aria-label/title (die hört ein Kind, das sich vorlesen lässt).
- [ ] `sw.js` `CACHE` **und** `APP_VERSION` in `index.html` erhöht.
