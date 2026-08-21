# Malstudio – Zeichnen lernen durch Spielen

Dies ist die Projektanweisung für Claude Code. Lies sie zuerst und vollständig,
bevor du Code änderst.

## Was das ist

Eine Mal- und Zeichen-App für Kinder (Zielalter ~5–7). Eine Familie mit zwei
Töchtern (5 und 7) baut sie gemeinsam mit Claude. Sie läuft auf dem iPad als
installierte Web-App (PWA), komplett **offline**, ohne Server, ohne Konten,
ohne Tracking, ohne Werbung. Das ist ein Verkaufsargument und eine Grundregel,
kein Zufall.

Positionierung (leitet jede Entscheidung): **nicht** „noch eine Mal-App",
sondern **„Malstudio – Zeichnen lernen durch Spielen"**. Motivation, schönes
Zeichenergebnis und Präsentation sind so wichtig wie die Funktion.

Leitsatz für Qualität: *Die App soll das Kind besser aussehen lassen, nicht
umgekehrt.* Am Ende sollen Eltern sagen: „Das hat mein Kind gemalt?"

## Ganz wichtige Randbedingungen

- **Alles offline, alles im Browser.** Keine externen API-Aufrufe zur Laufzeit,
  keine KI-Dienste, keine Server. Formerkennung etc. mit klassischen
  Algorithmen. Einzige externe Ressource: Google-Fonts-Link (wird vom Service
  Worker gecacht) – der darf auch weg, wenn die Schrift lokal eingebettet wird.
- **Kein `localStorage` in Artifact-Umgebungen** war eine frühere Einschränkung;
  hier als echte PWA ist `localStorage` erlaubt und wird über die `Store`-Abstraktion
  genutzt (siehe ARCHITEKTUR.md). Nicht auf ein bestimmtes Speicher-Backend
  festnageln – immer über `Store` gehen.
- **Datenschutz:** Es werden nur Bilder, Sticker, Profile lokal gespeichert.
  Niemals Namen/Fotos an irgendwen senden. Keine Analytics.
- **iPad zuerst.** Touch, `pointer`-Events, `touch-action:none`, Safe-Area,
  Quer- und Hochformat. Immer beides bedenken.
- **Sprache der Oberfläche: Deutsch, Englisch, Italienisch.** Freundlich,
  kindgerecht. Deutsch ist die Quelle – neue Texte werden auf Deutsch
  geschrieben und dann übersetzt; fehlt eine Übersetzung, erscheint das
  deutsche Original statt einer Lücke. Umgestellt wird im Zahnrad, mit
  Flaggen, ohne Elternschranke: Kinder dürfen das selbst. Details in
  ARCHITEKTUR.md, Abschnitt „Sprachen".

## Wichtige Design-/Produktentscheidungen (bereits getroffen, bitte respektieren)

- **Pisolala wird NICHT visualisiert.** Pisolala ist eine Figur, die die Töchter
  selbst erfunden haben (ein ganz normales, besonderes Mädchen mit Kleid,
  Schleife im Haar, Handtasche mit Stift/Block/Radierer). Ein früherer Versuch,
  sie zu zeichnen, wurde bewusst verworfen: Das Festlegen nimmt ihr das
  Mythische. **Keine Pisolala-Figur in Motive einbauen.** Wenn die Kinder eine
  eigene Pisolala wollen, tun sie das über „Eigenes Motiv" selbst.
- **Keine geschützten Marken-/Comicfiguren** (Peppa Pig o. Ä.). Rechtlich und
  für einen möglichen App-Store-Weg tabu. Nur eigene Figuren im knuffigen Stil.
- **Echte handgezeichnete Illustrationen kann Code nicht liefern.** Motive sind
  SVG-Formen aus Koordinaten. Das ist die bekannte Grenze; wenn echte Illus
  nötig werden, braucht es einen menschlichen Illustrator. Nicht so tun, als
  ginge das per Code.
- **Kaputten „Download/Speichern"-Knopf gab es** – Download klappt auf iPad
  nicht zuverlässig. Der Weg ist „In die Galerie". Kein Datei-Download als
  primärer Speicherweg.

## Aktueller Stand (Ausgangspunkt für Claude Code)

`index.html` ist die App (eine große Einzeldatei, ~2000 Zeilen). Sie enthält:
- 30 Motive (Schritt-für-Schritt, plus „Familie" und eigene Motive der Kinder)
- Zwei Modi: **Nachmalen** (Schritt für Schritt mit Vorlage links) und
  **Ausmalen** (kompletter Umriss vorgezeichnet, Tap-to-fill)
- Profile pro Kind, Galerie pro Kind, Sticker-Sammelalbum (24 Sticker)
- 36 Farben (scrollbar), 4 Stiftdicken
- Reagierende deutsche Sprachausgabe (Web Speech API, gerätestimmenabhängig)
  und dezente, im Browser erzeugte Bossa-Musik
- **Phase 1 (Zeichengefühl) ist fertig:** Echtzeit-Linienglättung
  (Catmull-Rom), **Zauberpinsel** als eigenes Werkzeug (erkennt Linie/Kreis/
  Rechteck und begradigt; Krakel bleibt Freihand), verbessertes Füllwerkzeug
  mit Anti-Aliasing-Randausgleich.
- PWA: `manifest.webmanifest`, `sw.js` (Offline-Cache), Icons.

Details zur Code-Struktur stehen in **ARCHITEKTUR.md**.

## Der Fahrplan (in dieser Reihenfolge, kleine stabile Schritte)

**Phase 1 – Zeichengefühl (fertig).** Glättung, Zauberpinsel, besseres Füllen.
Nächster sinnvoller Feinschliff falls gewünscht: geschwindigkeitsabhängige
Strichbreite (dezent), magnetisches Einrasten an Vorlagenlinien, schönere
Pinseltexturen.

**Phase 2 – Motivation (V6.5).**
- Sterne: +1 pro abgeschlossenem Schritt.
- Medaille pro fertigem Bild.
- Pokale: Bronze nach 5, Silber nach 10, Gold nach 20 Bildern. **Pokalschrank**
  als eigener Screen mit sichtbarem Fortschritt.
- **Feuerwerk-Abschluss** (max. 3 Sek.): Konfetti/Feuerwerk, aufsteigende
  Ballons, Sterne, kurzer Applaus/Sound, dann „Möchtest du das nächste
  Abenteuer beginnen?".
- Sticker ausbauen: nach jedem Erfolg „Du hast einen neuen Sticker gefunden",
  Sticker aufs Profil / auf Bilder / ins Album setzbar.
- Startbildschirm persönlicher: „Hallo Emma! 🐠 Heute wartet dein nächstes
  Abenteuer. ⭐ Du hast 24 Sterne. 🏆 Noch 6 bis zum Goldpokal."
- **Sammelalbum als Herzstück**: nicht nur Galerie, sondern „Mein Meeresalbum"
  mit Status je Motiv (gefunden / Gold geschafft / noch nicht entdeckt).

**Phase 3 – Abenteuer (V7).**
- **Schatzkarte** statt Motivliste: eine Inselkarte, jedes fertige Motiv schaltet
  ein neues Feld frei.
- Freischaltbare Motivwelten / thematische Welten: Meer, Bauernhof, Weltraum,
  Dinosaurier.
- Kleine Geschichten rund um die Motive.

**Phase 4 – Kreativität (V8).**
- Eigene Farben und Stifte, Hintergründe.
- Sticker ins Bild setzen.
- Eigene Motivpakete erstellen/teilen.

**Zusatz-Alleinstellungsmerkmal (jederzeit vertiefbar): „Zauberpinsel".**
Schon als Werkzeug vorhanden. Ausbaustufe: sanft an Vorlagenlinien einrasten,
mehr Formen erkennen. **Ohne KI/Server** – klassische Geometrie. Ziel:
5-Jährige behalten das Erfolgserlebnis, 7-Jährige erleben „ich werde besser".

## Arbeitsweise (bitte einhalten)

1. **Kleine, stabile Schritte.** Ein Feature pro Iteration, lauffähig lassen.
2. **Nach jeder Änderung testen** – im Browser öffnen, auf dem iPad prüfen
   (Touch, beide Ausrichtungen), erst dann weiter.
3. **Bei jedem Release** die Cache-Version in `sw.js` erhöhen
   (`const CACHE = 'malstudio-vX-Y'`), sonst lädt das iPad die alte Fassung.
4. **Refactoring willkommen, aber vorsichtig.** Die Einzeldatei darf in Module
   aufgeteilt werden (siehe ARCHITEKTUR.md, Abschnitt „Modularisierung") –
   aber die PWA muss offline lauffähig bleiben und die Pfade in `sw.js` müssen
   mitgezogen werden.
5. **Performance:** Zeichnen läuft über ein festes 1200×900-Canvas (`art`),
   das aufs Bildschirm-Canvas skaliert wird. Nicht in Bildschirmauflösung
   speichern (Drehen/Resize zerstört sonst das Bild).
6. **Keine Über-Gamification.** Belohnungen häufig, aber ruhig; nichts, was
   Druck oder Sucht erzeugt. Kindeswohl vor Engagement.
7. Wenn etwas nur mit Server/KI/Bezahlung ginge: **sagen, nicht heimlich
   einbauen.** Offline-First ist Gesetz.

## Deployment

- Getestet wird durch Öffnen von `index.html` im Browser.
- Veröffentlicht wird als statische Seite (GitHub Pages oder Netlify Drop).
- Auf dem iPad: Adresse in **Safari** öffnen → Teilen → „Zum Home-Bildschirm".
  Erst dann echtes Vollbild/offline.
- Repo darf öffentlich sein (kein Geheimnis im Code), oder Netlify Drop nutzen,
  wenn der Quellcode nicht sichtbar sein soll.

## Ton gegenüber der Familie

Ehrlich, konkret, keine falschen Versprechen. Grenzen offen benennen (z. B.
echte Illustrationen, App-Store-Aufwand). Die Grundidee der Familie ist stark –
die Aufgabe ist, sie mit Sorgfalt bei Zeichengefühl, Motivation und Präsentation
weiterzuentwickeln.
