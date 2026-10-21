# Team Builder — nächste Entwicklungsetappe

Die Datenbasis wurde vor Etappe 1 erstellt. Dieser Schritt setzt nun den
Team Builder um, fachlich Phase 3 der Master-Spezifikation. Stärkeberechnung,
Matchengine und Turnierablauf bleiben die folgenden Etappen.

## Fertiger Ablauf

1. Eine der sieben Formationen ansehen und zwölf verschiedene Saisonmannschaften ziehen.
2. Eine Position auf dem Spielfeld oder im Positionsmenü auswählen.
3. Aus dem zugehörigen Teamkader einen passenden Spieler wählen. Haupt- und
   Nebenpositionen sind erlaubt; ungeeignete Karten erhalten eine sichtbare Erklärung.
4. Elf verschiedene Personen aus elf verschiedenen Saisonmannschaften aufstellen.
   Mehrere Saisons desselben Vereins dürfen im Pool liegen. Die gleiche Person
   darf unabhängig von Saison oder Verein nur einmal aufgestellt werden.
5. Einen Coach aus den zwölf Teams wählen. Dieser Pick verbraucht keinen Spielerplatz
   und darf aus einem bereits für Spieler verwendeten Saisonteam stammen.
6. Einen Captain aus der eigenen Elf wählen. Der erste aufgestellte Natural Captain
   wird vorgeschlagen, solange kein anderer Captain gewählt wurde. Wird der Captain
   entfernt, wird ein verbliebener Natural Captain vorgeschlagen, sonst die Wahl geleert.
7. Die vollständige Aufstellung im Browser speichern. Bereits jeder Zwischenstand
   wird automatisch gespeichert und auf Dashboard und Builder gemeinsam angezeigt.

Alle zwölf Teams bleiben sichtbar. Ihre Karten zeigen den tatsächlich gewählten
Spieler. Einzelne Picks lassen sich ersetzen oder entfernen. Die Taktikwahl wird
ebenfalls gespeichert, ihre Wirkung noch nicht berechnet.

## Regeln und Schutz vor Sackgassen

Der Draft verwendet einen gespeicherten Seed und Fisher–Yates mit deterministischem
Pseudozufall. Derselbe Katalog, Seed und dieselbe Formation ergeben denselben Pool.
Ratings bleiben unverändert. Aus einem Katalog mit weniger als zwölf technisch
geeigneten Teams wird kein Draft erzeugt; Teams werden nicht doppelt aufgefüllt.

Eine begrenzte Suche prüft, ob sich aus dem Pool elf legale Picks zusammenstellen
lassen. Unbrauchbare Zufallsziehungen werden mit demselben Zufallsstrom neu gezogen
(höchstens 64 Versuche). Ein Pick, der alle erlaubten Vervollständigungen verhindert,
wird mit einer Erklärung gesperrt. Das ist keine automatische Auswahl der besten Elf.
Die Suchgrenze liegt bei 25.000 Knoten je Prüfung; nach Ausschöpfen wird keine
ungeprüfte Vervollständigbarkeit behauptet.

Bei Formationswechseln ordnet ein maximales Matching die bisherigen Spieler neu
gültigen Slots zu. Wenn Spieler keinen Platz mehr finden, werden ihre Namen vorab
in einem Bestätigungsdialog angezeigt. Abbrechen erhält die Aufstellung unverändert.
Falls die remappte Auswahl nicht vervollständigt werden kann, bleibt die bisherige
Formation bestehen; der Nutzer kann Spieler entfernen oder einen neuen Draft ziehen.
Ein neuer Draft mit vorhandenen Picks oder Coach muss ebenfalls bestätigt werden.

## Speicherung und Datenstand

Der versionierte Schlüssel aus `rules.storage.keys.currentDraft` enthält:

```ts
{ schemaVersion: 1, datasetVersion: string, draft: DraftState }
```

Beim Einlesen werden Datensatzversion, Struktur, Zeitangaben, zwölf eindeutige
Team-IDs, Positionen, Personenidentitäten, Picks pro Quelle, Coach, Captain, Taktik
und Vervollständigbarkeit geprüft. Unbrauchbare Daten werden beim Lesen nicht
überschrieben. Die Oberfläche erklärt den Zustand und erlaubt einen neuen Draft.
Schreibfehler (z. B. Browserquoten oder gesperrter Speicher) erhalten die aktuelle
Sitzung und zeigen, dass der Draft einen Reload nicht sicher übersteht. Andere
Speicherschlüssel bleiben erhalten.

Die Oberfläche verwendet ausdrücklich den redaktionellen Entwicklungskatalog.
Historische Prüfmarkierungen und die separate Release-Prüfung wurden nicht verändert.

## Grenze zur nächsten Etappe

Der angezeigte Durchschnitt ist **Ø Kartenrating der gewählten Spieler**, keine
berechnete Matchstärke. Es werden keine Chemie-, Positions-, Coach- oder Captain-Boni
erfunden. `SavedTeam` mit `StrengthBreakdown` und `currentTournament` bleiben leer;
die gesicherte Aufstellung liegt in `currentDraft`.

„Aufstellung speichern“ ist erst mit elf legalen Spielern, Coach und Captain aktiv.
„Team speichern & Turnier starten“ bleibt mit erklärtem Verfügbarkeitsstatus gesperrt,
bis die nächsten Etappen Stärke und Turnier tatsächlich implementieren. Es wird
kein falsches Turnier oder Ergebnis erstellt. Die Turnierseite erkennt eine
vollständige Aufstellung und erklärt diesen Stand.

## Technische Trennung und Prüfen

- `src/engine/random.ts`: reproduzierbarer Zufall ohne UI oder Speicher.
- `src/engine/builder.ts`: Pool, Identitäten, Positionspassung, Vervollständigung,
  Formationswechsel und Abschlussprüfung, unabhängig von React.
- `src/utils/draft-storage.ts`: versionierter, defensiver Browseradapter.
- `src/app/DraftProvider.tsx`: gemeinsamer Zustand und Speicherung nach Änderungen.
- `src/pages/BuilderPage.tsx` und `src/components/Pitch.tsx`: bedienbare Oberfläche.

```sh
npm run check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Die Node-Tests prüfen reproduzierbare Pools für jede Formation, Identität über
Saisons hinweg, Quelle/Position, Ersetzen/Entfernen, Coach, Captain, Formationswechsel,
unveränderte Ausgangsdaten, beschädigte Speicherung und Quotenfehler.
Die Browsertests wählen eine gesamte Elf über die Oberfläche, speichern und laden
sie neu, prüfen Dashboard, Bestätigungsdialoge, Versions-/Speicherfehler sowie
Barrierefreiheit und kleine Bildschirmbreiten.

Validiert für diesen Stand: Daten-/Typprüfung, 63 Node-Tests, Produktionsbuild und
28 Chromium-Browsertests auf Desktop und Mobile. Darunter sind vollständige Drafts,
das Scrollen der Kartenliste per Tastatur und axe-Prüfungen der aktiven Aufstellung
und des Bestätigungsdialogs. Die fertigen Ansichten wurden zusätzlich visuell geprüft.
