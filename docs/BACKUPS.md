# Etappe 9 — Spielstände sichern und wiederherstellen (Version 0.10)

Unter **Einstellungen → Spielstand sichern & wiederherstellen** lässt sich der
geladene Spielstand als JSON-Datei herunterladen und in einem anderen Browser
wiederherstellen. Es sind kein Konto, kein Server und keine zusätzlichen Pakete
nötig. Dateien werden im Browser verarbeitet und nicht hochgeladen.

## Umfang einer Sicherung

Der Export verwendet den aktuellen Zustand der Anwendung. Er enthält auch
gültige Änderungen, die bei einem Schreibfehler nur noch in dieser Sitzung
vorliegen; es wird nicht auf einen älteren Stand im Browserspeicher zurückgegriffen.
Enthalten sind:

- Draft samt gezogenen Teams, Picks, Formation, Taktik, Coach und Captain;
- die unabhängig gespeicherte Elf mit ihren damaligen Karten und Stärkewerten;
- das aktuelle Turnier mit Teilnehmer-Snapshots, Auslosungen und Ergebnissen;
- das Archiv der bis zu 50 abgeschlossenen Turniere;
- die unterstützte Einstellung **Bewegung reduzieren** und die zentralen Defaults
  für die übrigen Einstellungsfelder.

Nicht lesbare oder unbekannte Browser-Rohdaten, die die Anwendung zuvor nicht
laden konnte, sind kein Bestandteil des geladenen Spielstands und werden nicht
als gültiger Spielstand exportiert. Die Sicherung ist eine Datei zum Aufbewahren;
sie wird nicht automatisch mit anderen Browsern synchronisiert.

Der Dateiname enthält einen UTC-Zeitpunkt. Die Vorschau zeigt den Exportzeitpunkt
in der lokalen Browserzeit an. Das maximale Dateilimit beträgt **8 MiB**; außerdem
gelten die bestehenden Größenlimits für Turnier und Archiv. Eine passende
Dateigröße garantiert keinen ausreichenden freien Browserspeicher.

## Prüfung und Bestätigung

Nach Auswahl einer Datei werden Format, Version und Inhalt vollständig geprüft.
Die Vorschau zeigt die Anzahl der Draft-Picks, die gespeicherte Elf, den
Turnierfortschritt, die Zahl der Archiveinträge und die Bewegungseinstellung.
Bis hierhin werden weder Spielstände noch Einstellungen geschrieben.

Erst **Spielstand wiederherstellen → Sicherung übernehmen** ersetzt den aktuellen
Stand. Der Dialog benennt alle betroffenen Komponenten. **Abbrechen** und Escape
erhalten den bisherigen Stand. Das Archiv wird vollständig ersetzt, nicht mit
dem vorhandenen Archiv zusammengeführt. Ein ausdrücklich bestätigter leerer
Spielstand entfernt entsprechend auch alte Drafts, Teams und Turniere.

Nach der Übernahme werden alle Anwendungsprovider aus dem gemeinsam gespeicherten
Stand neu initialisiert. Die Anwendung bleibt auf der Einstellungsseite und
meldet den Erfolg. Danach können Draft, Turnier und Archiv direkt benutzt werden;
Neuladen verwendet denselben übernommenen Stand. Ein vorhandener vollständiger
Turnierabschluss ohne Archiveintrag wird weiterhin genau einmal archiviert.

## Dateiformat und Validierung

```ts
{
  format: 'prime-xi-backup',
  version: 1,
  exportedAt: 'ISO-8601-Zeitpunkt',
  state: AppState // schemaVersion: 1
}
```

Eine Datei erhält durch ihre Endung oder ihren Namen kein Vertrauen. Die Prüfung
verwendet die bestehenden Validatoren für Draft, Karten, Stärke, Turnier und
Archiv. Sie prüft unter anderem:

- Versionsangaben, gültigen Exportzeitpunkt und vollständige Komponenten;
- aktuellen Katalogbezug und Vervollständigbarkeit eines enthaltenen Drafts;
- elf gültige Karten, Coach, Captain und berechnete Stärke der gespeicherten Elf;
- tatsächlich reproduzierbare Turnierauslosungen, Ergebnisse, Tabellen und K.-o.-Stände;
- Archivresultate, Statistiken, Snapshot-Konsistenz, Limit und doppelte Turnier-IDs;
- unterstützte Einstellungswerte und die vorhandenen Größenlimits.

Bekannte Liga-Spielstände mit Gesamtregeln 1.3.0 bleiben unverändert importierbar;
die Erweiterung auf 1.4.0 erfolgt weiterhin erst beim ersten K.-o.-Schritt. Es
werden keine heutigen Katalogkarten in historische Team- oder Turnier-Snapshots
kopiert. Spielregeln, Stärkemodell und Simulationsversionen ändern sich nicht.

Beschädigtes JSON, fremde oder unbekannte zukünftige Formate, manipulierte
Spielstände und zu große Dateien werden ohne Schreibzugriff abgewiesen. Eine
neue Dateiauswahl entfernt die vorherige Vorschau; überholte asynchrone
Leseergebnisse dürfen keine neuere Auswahl ersetzen. Unmittelbar vor dem Import
wird die ausgewählte Sicherung erneut validiert.

## Gemeinsamer Speicher nach einem Import

Vor dem ersten Import bleiben die fünf bestehenden versionierten Speicherschlüssel
und ihr bisheriges Verhalten erhalten. `getGameStorage()` stellt den bestehenden
Adaptern weiterhin `getItem`, `setItem` und `removeItem` für genau diese Schlüssel
bereit.

Ein bestätigter Import speichert alle fünf logischen Werte zusammen unter
`prime-xi:restored-state:v1` mit `{ schemaVersion: 1, records }`. Jeder Wert ist
der bisherige JSON-Umschlag oder `null` für einen fehlenden Stand. Der Austausch
erfolgt mit **einem** `localStorage.setItem`-Aufruf. Gemäß Web-Storage-Vertrag
bleibt der vorherige Wert bei Quota- oder Berechtigungsfehlern unverändert;
eine Wiederherstellung schreibt daher keine teilweise aktualisierten Komponenten.

Erst nach erfolgreichem Austausch werden die fünf überholten Einzelwerte entfernt.
Schlägt dieses Aufräumen fehl, bleibt der neue Gesamtsnapshot maßgeblich; alte
Einzelwerte dürfen nicht wieder erscheinen. Fremde Browserschlüssel werden nicht
gelesen, verändert oder entfernt.

Spätere Änderungen an Draft, Team, Turnier, Archiv oder Einstellungen lesen den
aktuellen Gesamtsnapshot und ersetzen nur ihren jeweiligen logischen Wert. So
gehen andere Komponenten bei einem regulären Speichervorgang nicht verloren.
Unbekannte oder beschädigte Gesamtsnapshots werden nicht durch eine stille
Rückkehr zu überholten Einzelwerten verdeckt. Eine bestätigte gültige Sicherung
kann sie ersetzen.

Kann der neue Gesamtsnapshot nicht gespeichert werden, bleiben Browserdaten und
laufende Anwendungszustände unverändert. Die Vorschau bleibt für einen erneuten
Versuch verfügbar. Vorhandene Daten werden nicht vorab gelöscht, um Platz für
einen Import zu schaffen.

## Module und Prüfungen

- `src/engine/backup.ts`: versioniertes Dateiformat, Prüfung und Serialisierung.
- `src/utils/game-storage.ts`: kompatibler Speicherzugriff und gemeinsamer Austausch.
- `src/components/BackupPanel.tsx`: Download, Dateiauswahl, Vorschau und Bestätigung.
- `src/app/SessionContext.ts`: erneutes Laden aller Provider nach erfolgreichem Import.

Node-Tests prüfen vollständige und leere Sicherungen, alte Liga-Spielstände,
manipulierte Daten, Größenlimits, alle Speicheradapter, Quota-Fehler, erhaltene
Fremdschlüssel, zurückbleibende Altwerte und geschützte zukünftige Formate.
Desktop-/Mobile-Browsertests laden echte Sicherungsdateien herunter, exportieren
ungespeicherte Sitzungsänderungen, prüfen Vorschau und Abbrechen, spielen nach
einem Import weiter und sichern erneut. Sie prüfen außerdem leere Importe,
ungültige Dateien, Wiederholung nach Quota-Fehlern, einmalige Archivierung,
Tastaturbedienung, mobile Breiten und automatische WCAG-A-/AA-Kriterien.

```sh
npm run check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Prüfstand: **156 Node-Tests und 108 Chromium-Browsertests** bestanden. Datenabgleich,
TypeScript, Produktionsbuild und Formatprüfung sind erfolgreich. Vorschau und
Bestätigungsdialog wurden auf Desktop und Handy zusätzlich visuell geprüft.
Der bekannte Größenhinweis für den eingebetteten Katalog bleibt bestehen.
