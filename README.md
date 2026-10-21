# PRIME XI — Football Simulator

React-/TypeScript-Anwendung mit Vite und einer eigenen statischen Datenbasis.
Etappe 1 und der Team Builder sind umgesetzt: responsives Grundlayout, Navigation,
Dashboard, durchsuchbarer Teamkatalog sowie Draft, Spieler-/Coach-/Captain-Auswahl,
Formationswechsel und Wiederherstellung des Drafts nach Neuladen.
Die Anwendung benötigt kein Backend, API-Abo oder geheime Schlüssel.

## Starten

Node.js 24 verwenden:

```sh
npm ci --ignore-scripts
npm run dev
```

`npm run build` erzeugt die statische Anwendung in `dist/`. `npm run preview`
startet die Vorschau dieses Builds. Die Basis ist `/prime_XI/`; Hash-Routing
unterstützt direkte Links und Neuladen auf GitHub Pages. Es wurde noch keine
Veröffentlichung eingerichtet oder ausgeführt.

Ziehe zwölf verschiedene Saisonmannschaften, wähle elf Spieler aus verschiedenen
Quellteams sowie Coach und Captain. Der Draft wird im Browser gespeichert.
Stärke-/Chemieberechnung, Simulation und Turnierablauf sind die nächsten Etappen.
Der Turnierstart bleibt bis zu deren Umsetzung gesperrt. Das sichtbare
Ø Kartenrating ersetzt keine Matchstärke.

[Umfang, Architektur, Prüfungen und Commit-Grenze von Etappe 1](docs/ETAPPE_1.md)

[Team Builder: Ablauf, Regeln und Speicherung](docs/TEAM_BUILDER.md)

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
Sie sind keine historischen Messwerte oder EA/FIFA-Ratings. Die spätere Engine
muss ihre Simulationswirkung noch kalibrieren.

## Prüfen und pflegen

Node.js 24 verwenden:

```sh
npm ci --ignore-scripts
npm run check
npm run data:report
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
  getDevelopmentTeams, getDefaultLineup, getGameRules, getClubBadgePath,
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
Die Simulationsengine ist noch nicht implementiert.

[Datenmodell und API](docs/DATENBASIS.md) ·
[Alle 60 Teams und Prüfstand](docs/DATENSTAND.md) ·
[Spielkonfiguration](docs/SPIELREGELN.md) ·
[Quellen und Zugriffsprobleme](docs/QUELLENPRUEFUNG.md)
