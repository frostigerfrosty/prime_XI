# Etappe 1 — Projektsetup und Oberfläche

Etappe 1 umfasst React, TypeScript, Vite, Routing, das gemeinsame Grundlayout und
das Designsystem. Die zuvor erstellte Datenbasis ist eingebunden. Der Teamkatalog
bietet bereits eine echte Möglichkeit, diese Daten in der Anwendung zu prüfen.

## Fertiger Umfang

- Dashboard mit Katalogkennzahlen, Einstieg in den Team Builder und echten
  Saisonkarten als Katalogvorschau. Es wird kein gespeichertes Team erfunden.
- Fünf Hauptseiten: Dashboard, Team Builder, Turnier, Prime-Teams und Historie.
  Dazu kommen Einstellungen, Teamdetails und eine Seite für ungültige URLs.
- Responsives Grundlayout mit Desktop-Seitenleiste und mobilem Navigationsdialog.
  Der Dialog lässt sich mit Escape schließen und gibt den Tastaturfokus zurück.
- Zentrale Designvariablen für Farben, Schriften und Abstände. Dunkle Flächen,
  grüne Akzente, lokale Schriften, Vereinsmonogramme und Spielerinitialen.
- Team Builder mit sieben anwählbaren **Formationsvorschauen**, elf leeren
  Positionen und gesperrten Spielaktionen. Die Vorschau erzeugt keinen Draft.
- Durchsuchbarer Katalog aller 60 redaktionellen Teams mit Vereins- und
  Jahrgangsfilter, Standardelf und 18er-Kader. Filter stehen in der URL und
  überstehen ein Neuladen. Browser-Zurück stellt die vorherige Katalogsuche wieder her.
- Turnier und Historie zeigen ihren leeren Anfangszustand. Es gibt keinen
  erfundenen Spielplan, Tabellenstand oder bisherigen Erfolg.
- Option für reduzierte Bewegung mit defensiver Speicherung im Browser.
  Beschädigte Einstellungen und gesperrter Speicher verhindern den Start nicht.
- Lazy Loading der Seiten, Ladezustand und Fehlergrenze mit Neustartmöglichkeit.

## Bewusst nächste Etappen

Der Draft, Spieler-/Coach-Auswahl, Captain, Stärke-/Chemieberechnung, Matchengine,
Turnierablauf und das Speichern von Teams, Turnieren und Historie folgen separat.
Die Grundansichten sind keine Umsetzung dieser Spielmechaniken. Entsprechend
bleiben „12 Teams ziehen“ und „Team speichern & Turnier starten“ deaktiviert.
Die Formationsvorschau ist aktuell nur für die geöffnete Builder-Seite gültig.

Die historische Freigabe der redaktionellen Daten bleibt offen. Die Oberfläche
verwendet ausdrücklich den Entwicklungskatalog; `getReleasedTeams()` und die
historischen Freigabeprüfungen wurden nicht gelockert. Katalog und Detailansichten
kennzeichnen den Prüfstand und die Herkunft der eigenen Spielwerte.

## Architektur und statische Auslieferung

```text
src/app/          Router, Kataloganbindung, Einstellungen
src/components/   Gemeinsame UI, Layout, Spielfeld
src/pages/        Seiten und Anfangszustände
src/styles/       Designvariablen und responsives CSS
src/utils/        Anzeigehilfen und defensiver Einstellungsadapter
src/data/         Bestehende Datenabfragen und erzeugtes JSON
src/types/        Daten- und Anwendungsverträge
tests/browser/    Browsertests gegen den Produktionsbuild
```

Das Routing verwendet Hash-URLs, beispielsweise
`/prime_XI/#/teams/barcelona-2010-2011`. Dadurch benötigen direkte Teamlinks und
Neuladen auf GitHub Pages keine serverseitigen Umleitungen. Die Vite-Basis ist
`/prime_XI/`. Für einen anderen Bereitstellungspfad kann beim Build
`VITE_BASE_PATH=/anderer-pfad/ npm run build` gesetzt werden.

Monogramme und Schriften werden lokal ausgeliefert. Die Oberfläche ruft keine
Fußball-API, kein externes Bildhosting und keinen externen Schriftendienst auf.
Der Build kann später als Inhalt von `dist/` statisch bereitgestellt werden;
eine Veröffentlichung gehört nicht zu dieser Etappe.

Der komplette JSON-Katalog wird derzeit gemeinsam mit dem Einstiegscode gebündelt.
Vite meldet deshalb einen Größenhinweis für diesen Chunk (ungefähr 1 MB bzw.
163 KB gzip in diesem Stand). Das ist kein fehlgeschlagener Build. Bei später
hinzukommenden Bildern und Funktionen sollte der Katalog separat oder nach
Jahrgängen geladen werden. Die Seitendarstellungen werden bereits separat geladen.

## Prüfungen und Entwicklung

Node.js 24, Installation über das Lockfile:

```sh
npm ci --ignore-scripts
npm run dev
```

```sh
npm run check        # Exportvergleich, TypeScript, Node-Tests
npm run build        # Datenprüfung, TypeScript, Produktionsbuild
npm run test:e2e     # Baut neu, startet Preview und prüft Desktop + Mobile
```

Für die Browsertests einmalig `npx playwright install chromium` ausführen.
In dieser Cloud-Umgebung ist Chromium bereits unter `/usr/bin/chromium` verfügbar:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Die Browsertests prüfen Navigation, ungültige Routen, Datenfilter, Kader, direkte
Detaillinks, Neuladen, Formationsvorschau, gesperrten Turnierstart, Einstellungen,
Tastaturbedienung, mobile Breiten, lokale Bilder und Schriften sowie grundlegende
WCAG-A-/AA-Kriterien mit axe. Automatische Prüfungen ersetzen keine vollständige
manuelle Barrierefreiheitsprüfung. JavaScript-
und Konsolenfehler sowie fehlgeschlagene HTTP-Anfragen lassen die Tests scheitern.
Die CI führt Daten-/Typprüfungen, Node-Tests, Build und Chromium-Browsertests aus.
Ein GitHub-Actions-Lauf ist erst nach einem Push möglich.

Im aktuellen Cloud-Stand bestanden: Exportvergleich, TypeScript, 51 Node-Tests,
Produktionsbuild und alle 16 Chromium-Browsertests für Desktop und Mobile.
Desktop- und Mobilansichten wurden zusätzlich anhand von Screenshots angesehen.

## Commit-Grenze

Nach bestandenen Prüfungen bilden Datenbasis und Etappe 1 einen sinnvollen ersten
Projekt-Commit. Damit gibt es einen reproduzierbar startbaren Ausgangspunkt vor
der eigentlichen Spiellogik. Empfohlener Titel:

```text
feat: add Prime XI data foundation and phase 1 app shell
```

Buildausgabe, installierte Pakete, Browserartefakte und persönliche Einstellungen
gehören nicht in den Commit. Das Lockfile, redaktionelle Daten, erzeugter Katalog,
Monogramme, Quellenstatus, Tests und Dokumentation gehören dazu.
