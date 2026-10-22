# PRIME XI — Football Simulator

React-/TypeScript-Anwendung mit Vite und einer eigenen statischen Datenbasis.
Grundlayout, Team Builder, Teamstärke, Matchengine und vollständiger Turniermodus sind umgesetzt: Navigation, Dashboard,
Teamkatalog, Draft, Spieler-/Coach-/Captain-Auswahl, Formationswechsel sowie
nachvollziehbare Basisstärke, Chemie, Taktik-, Coach- und Captain-Boni.
Draft und vollständige Teams werden getrennt im Browser gespeichert. Im Testspiel
treten deine gespeicherte Elf oder zwei Katalogteams gegeneinander an.
Im Turnier spielt deine Elf gegen 35 Saisonmannschaften. Auslosung, Spielplan,
Ergebnisse, Tabelle und K.-o.-Runden bis zum Finale bleiben beim Neuladen erhalten.
Die Anwendung benötigt kein Backend, API-Abo oder geheime Schlüssel.

## Starten

Node.js 24 verwenden:

```sh
npm ci --ignore-scripts
npm run dev
```

`npm run build` erzeugt die statische Anwendung in `dist/`. `npm run preview`
startet die Vorschau dieses Builds. Die Basis ist `/prime_XI/`; Hash-Routing
unterstützt direkte Links und Neuladen auf GitHub Pages. Ein manuell gestarteter
Workflow für eine Entwicklungsvorschau ist vorbereitet; eine Veröffentlichung
wurde nicht ausgeführt. [Start, Build-Prüfung und Veröffentlichung](docs/START_UND_BUILD.md)
beschreibt Ablauf und Voraussetzungen.

Der Browser lädt den Katalog als separate JSON-Datei. Währenddessen zeigt die
Anwendung eine Ladeanzeige; bei einem Ladefehler kannst du erneut laden.
Vorhandene Spielstände bleiben dabei erhalten.

Unter **Teamvergleich** kannst du zwei der 60 Saisonmannschaften mit ihrer
Standardelf gegenüberstellen. Die Übersicht trennt Kartenrating, Basisstärke,
Boni und die vier Positionsgruppen. Deine Auswahl steht im teilbaren Link und
bleibt beim Neuladen erhalten. **Diese Paarung spielen** übernimmt die Teams
ins Testspiel; der Anpfiff erfolgt erst auf deinen Klick.

Ziehe zwölf verschiedene Saisonmannschaften, wähle elf Spieler aus verschiedenen
Quellteams sowie Coach und Captain. Der Draft wird im Browser gespeichert.
Mit elf Spielern erscheinen die berechnete Basis und alle Boni. Vollständige Teams
speichern ihre damaligen Spielerwerte und Matchstärke als Snapshot. Das sichtbare
Ø Kartenrating bleibt davon getrennt. Öffne **Testspiel** in der Navigation:
90 Minuten mit möglichem Remis oder K.-o. mit Verlängerung und Elfmeterschießen,
wahlweise auf neutralem Platz. Derselbe Spielcode reproduziert dieselbe Begegnung.
Mit **Team speichern & Turnier starten** beginnt deine 36-Team-Ligaphase:
acht verschiedene Gegner, vier Heim- und vier Auswärtsspiele. Simuliere einen
Spieltag mit allen 18 Begegnungen oder bestätige den Abschluss der gesamten
Ligaphase. Die Tabelle zeigt die Plätze für Achtelfinale, Playoffs und Ausscheiden.
Danach folgen Playoffs, Achtel-, Viertel- und Halbfinale mit Hin- und Rückspiel
sowie ein einzelnes neutrales Finale. Lose jede Runde aus und spiele die beiden
Partien nacheinander, oder bestätige die Simulation bis zum Turniersieger.
Gesamttore entscheiden ohne Auswärtstorregel; bei Gleichstand gibt es Verlängerung
und gegebenenfalls Elfmeter. Auch nach dem Ausscheiden deiner Elf kannst du den
Rest des Turniers verfolgen. Nach dem Finale wird dein Turnier automatisch in der
**Historie** archiviert. Dort bleiben die letzten 50 Abschlüsse mit der damaligen
Elf, Ligaplatz, erreichtem Turnierabschnitt, eigenen Ergebnissen und Statistik
erhalten. Das Archiv lässt sich nach Team, Turniercode oder Sieger durchsuchen
und auf eigene Titel filtern. Ein vorhandener Abschluss aus Version 0.8 wird
beim ersten Laden automatisch übernommen, ohne den ursprünglichen Spielstand
umzuschreiben. Scheitert das Archivieren, bleibt der Abschluss vor einem neuen
Turnier geschützt und für diese Sitzung sichtbar.

Unter **Einstellungen** kannst du den geladenen Spielstand als JSON-Datei sichern
und auf einem anderen Browser wiederherstellen. Der Export enthält auch noch
nicht dauerhaft gespeicherte Änderungen dieser Sitzung. Eine ausgewählte Datei
wird lokal geprüft und als Vorschau angezeigt. Erst nach Bestätigung ersetzt sie
Draft, Elf, Turnier, Archiv und Einstellungen; Archive werden dabei nicht
zusammengeführt. Schlägt die Speicherung fehl, bleibt der bisherige Stand erhalten.

[Umfang, Architektur, Prüfungen und Commit-Grenze von Etappe 1](docs/ETAPPE_1.md)

[Team Builder: Ablauf, Regeln und Speicherung](docs/TEAM_BUILDER.md)

[Teamstärke: Formeln, Boni und gespeicherte Elf](docs/TEAMSTAERKE.md)

[Matchengine: Simulation, Spielcodes und Kalibrierung](docs/MATCHENGINE.md)

[36-Team-Turnier: Ligaphase, Tabelle und Fortsetzen](docs/LIGAPHASE.md)

[Playoffs und K.-o.-Runden: Auslosung, Gesamttore und Finale](docs/KNOCKOUT.md)

[Etappe 8: Turnierarchiv, Statistiken und bestehende Spielstände](docs/HISTORIE.md)

[Etappe 9: Spielstände exportieren und wiederherstellen](docs/BACKUPS.md)

[Etappe 10: Optimierter Start und geprüfte statische Builds](docs/START_UND_BUILD.md)

[Etappe 11: Teams vergleichen und die Paarung spielen](docs/TEAMVERGLEICH.md)

## Datenbestand

Der Bestand enthält **60 Saisonmannschaften für 2007–2026**, jeweils drei pro Endjahr,
mit **18 Spielern, Standardelf, Trainer und Captain-Zuordnung**. Das sind 1.080
Saisonkarten für 554 Spieleridentitäten. Dazu kommen sieben Formationen mit
Spielfeldkoordinaten, fünf Taktiken, Positions-/Länderlabels, eigene Vereinsmonogramme
und zentrale Daten für Stärke, Chemie, Boni, Match- und Turnierregeln.

**Der historische Daten-Release ist noch gesperrt.** 56 Trainer-Saison-Zuordnungen
wurden mit einem tatsächlich gelesenen Register abgeglichen. Die vollständige
Prüfung der Kaderzugehörigkeit, Captains und Saisonrollen bleibt offen, weil weitere
Referenzen und größere Quelldateien aus dieser Laufzeit nicht erreichbar sind.
Ungeprüfte Angaben tragen weiterhin `pending`; keine Quelle wurde bloß aufgrund
ihrer URL als gelesen markiert.

Die Ratings und individuellen Saisonattribute sind eigene, feste V1-Spielwerte.
Sie sind keine historischen Messwerte oder EA/FIFA-Ratings. Die Matchengine wurde
an den Stärke-Beispielen der Spezifikation kalibriert; der historische Prüfstand
der Kader bleibt davon unabhängig.

## Prüfen und pflegen

Node.js 24 verwenden:

```sh
npm ci --ignore-scripts
npm run check
npm run data:report
npm run match:report
npm run build
```

Die zusätzlichen Browsertests starten den Produktionsbuild und prüfen Desktop
und Mobile:

```sh
npx playwright install chromium
npm run test:e2e
```

In der Cloud kann der vorhandene Browser mit
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` verwendet
werden. Die GitHub-Actions-Konfiguration führt diese Prüfungen nach einem Push aus.
Der Build prüft außerdem Dateipfade, den separaten Katalog und feste JavaScript-
Größengrenzen. Nach erfolgreicher CI steht `dist/` als Artefakt
`prime-xi-static-build` für sieben Tage zum Herunterladen bereit.

Nach Änderungen in `data/editorial/`:

```sh
npm run data:build
npm run check
```

`data:build` erzeugt den JSON-Export und die 17 lokalen SVG-Monogramme.
`data:check` erkennt abweichende Exporte und Bilder. `scripts/setup.sh` installiert
reproduzierbar mit dem Lockfile und führt die technischen Prüfungen aus.

`npm run data:release-check` prüft die historische Freigabe separat und endet beim
aktuellen Quellenstand mit Exit-Code 1. Das ist kein fehlgeschlagener technischer
Installations- oder Datenintegritätstest. `developmentCatalogComplete` ist dagegen
wahr: Die Datenstruktur ist vollständig für die weitere Entwicklung befüllt.

## Einstieg für die Anwendung

```ts
import {
  getDevelopmentTeams,
  getDefaultLineup,
  getGameRules,
  getClubBadgePath,
} from './src/data/index.ts';
import { createInitialAppState } from './src/data/initial-state.ts';

const teams = getDevelopmentTeams(); // bewusst noch historisch ungeprüfte Kader
const milan = getDefaultLineup('milan-2006-2007'); // exakt elf Karten
const rules = getGameRules();
const state = createInitialAppState(); // kein erfundenes Team oder laufendes Turnier
const badge = getClubBadgePath('milan', '/prime_XI/');
```

`getReleasedTeams()` bleibt bis zum Abschluss der historischen Prüfung leer.
Die Entwicklung darf Entwürfe ausdrücklich über `getDevelopmentTeams()` verwenden.
Die Oberfläche nutzt diesen Entwicklungskatalog ausdrücklich zum Durchsehen.
Die reine Simulationsengine steht in `src/engine/match.ts`; sie benötigt weder
React noch Browser-APIs. Kataloggegner verwenden dieselbe Stärkeberechnung wie die
eigene Elf, mit Standardaufstellung und der ausdrücklich gewählten Standardtaktik.

[Datenmodell und API](docs/DATENBASIS.md) ·
[Alle 60 Teams und Prüfstand](docs/DATENSTAND.md) ·
[Spielkonfiguration](docs/SPIELREGELN.md) ·
[Quellen und Zugriffsprobleme](docs/QUELLENPRUEFUNG.md)
