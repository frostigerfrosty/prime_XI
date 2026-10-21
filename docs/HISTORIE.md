# Etappe 8 — Turnierarchiv und Statistiken (Version 0.9)

Nach dem tatsächlich ausgespielten Finale wird ein Turnier automatisch und genau
einmal archiviert. Auch ein bereits aus Version 0.8 gespeicherter vollständiger
Abschluss wird beim Laden übernommen. Ein neues Turnier ersetzt weiterhin den
aktuellen Spielstand erst nach Bestätigung; sein vorheriger Abschluss bleibt im
Archiv. Es werden keine laufenden Turniere oder Testspiele als Erfolge verbucht.

## Historie und Rückblicke

Die Historie enthält die letzten **50** abgeschlossenen Turniere, absteigend nach
Abschlusszeit. Bei Überschreiten der zentralen `historyLimit`-Vorgabe entfällt der
älteste Eintrag. Gleichzeitige Abschlüsse werden anhand ihrer stabilen ID sortiert.
Neuladen oder erneutes Übernehmen desselben Turniers erzeugt kein Duplikat und
ändert keine vorhandenen Snapshots.

Jeder Rückblick bewahrt:

- die tatsächlich angetretene Elf mit elf Karten, Coach, Captain, Formation,
  Taktik und damaliger Matchstärke;
- Turniercode, Start-/Abschlusszeit sowie Datensatz- und Regelversion;
- den tatsächlichen Champion und den erreichten Turnierabschnitt;
- den endgültigen **Ligaplatz** und die Ligapunkte;
- alle eigenen Liga- und K.-o.-Partien, einschließlich Verlängerung und separat
  angezeigtem Elfmeterschießen;
- Spiele, Siege, Remis, Niederlagen, Tore und Gegentore.

Ligaplätze werden ausdrücklich als Ligaplätze bezeichnet. Es gibt keine
erfundenen Gesamtplätze für Teams, die in derselben K.-o.-Runde ausscheiden.
Spielbilanz und Tore verwenden den Stand nach 90 beziehungsweise 120 Minuten;
ein Sieg im Elfmeterschießen zählt bei ausgeglichenem Spielstand als Remis in
der Spielbilanz. Das Weiterkommen und der Titel werden dadurch nicht verändert.
Ein Rückspielsieg und das Weiterkommen im Aggregat bleiben verschiedene Dinge.

Die Übersicht zeigt die Bilanz aller enthaltenen Turniere und erlaubt eine Suche
nach Team, Turniercode oder Champion sowie einen Filter auf eigene Titel.
Rückblicke besitzen eigene Hash-Routen unter `/history/:entryId` und überstehen
Neuladen unabhängig vom aktuellen Turnier. Unbekannte IDs bieten einen Weg zurück.

Das Archiv enthält eigene Partien und die dafür erforderlichen Gegnernamen und
Matchstärken. Es dupliziert weder die 35 vollständigen Gegnerkader noch alle 189
Partien jedes Turniers. Die vollständige Turnieransicht bleibt beim aktuellen
Turnier. Änderungen am heutigen Draft, Team oder Katalog schreiben alte
Archivkarten und Ergebnisse nicht um.

## Speicherung und Migration

`prime-xi:completed-tournaments:v1` verwendet den Umschlag
`{ schemaVersion: 1, entries: HistoryEntry[] }`. Der bisher unbenutzte Schlüssel
wird erst für einen echten Abschluss geschrieben. Es gibt keine erfundene
Migration eines früheren Archivformats, da ältere Versionen keine Archive
gespeichert haben.

Der bestehende aktuelle Turnierumschlag und dessen Schlüssel bleiben unverändert.
Die Übernahme eines vollständigen Version-0.8-Abschlusses liest diesen Spielstand,
prüft ihn mit dem bestehenden Turniercontroller und erzeugt einen unabhängigen
Archiveintrag. Sie verändert den ursprünglichen Turnierstand nicht. Bekannte
Phase-6-Ligastände mit Gesamtregeln 1.3.0 bleiben spielbar und werden weiterhin
erst bei der ersten K.-o.-Auslosung auf 1.4.0 erweitert. Spielregeln und
Simulationsversionen ändern sich durch diese Etappe nicht.

Beim Lesen des Archivs werden die gespeicherte Elf, Versionsangaben, Reihenfolge
und Vollständigkeit der eigenen Runden, Heim-/Auswärtszuordnung, Ligapunkte und
Statistiken geprüft. Eigene Matchresultate werden aus den eingefrorenen
Matchstärken und Seeds mit dem richtigen Hinspiel-Aggregat nachgerechnet.
Ungerundete xG verwenden dieselbe begrenzte Laufzeittoleranz wie Turnierstände;
Tore und Elfmeterschüsse werden exakt verglichen. Die kompakten Rückblicke
rekonstruieren nicht die vollständigen Auslosungen oder fremde K.-o.-Partien.

Fehlerhaftes JSON, unbekannte Formate, ungültige Einträge und übergroße Archive
bleiben als Rohdaten erhalten und werden nicht automatisch überschrieben.
Die Historie bietet dafür ein ausdrücklich zu bestätigendes Zurücksetzen an;
Abbrechen erhält die Rohdaten. Draft, gespeicherte Elf und aktuelles Turnier
werden dabei nicht gelöscht.

Ein gesperrter Lesezugriff wird getrennt von beschädigten Daten behandelt. In
diesem Fall wird kein Löschen angeboten; nach Anpassung der Browsereinstellungen
kann das Archiv durch Neuladen erneut eingelesen werden.

Bei einem Schreib- oder Quota-Fehler bleiben das bisherige dauerhafte Archiv und
der neue Abschluss erhalten. Neue Einträge sind für diese Sitzung sichtbar und
als nicht dauerhaft gespeichert gekennzeichnet. Ein abgeschlossenes aktuelles
Turnier darf erst durch ein neues ersetzt werden, wenn sein Archiv gespeichert
werden konnte. Der nächste Startversuch wiederholt die Speicherung. So kann nach
Freigabe von Browserspeicher weitergespielt werden, ohne den Abschluss zu verlieren.
Ohne verfügbaren Browserspeicher kann die Anwendung weiterhin in einer Sitzung
verwendet werden; dauerhafte Archivierung kann sie dann nicht garantieren.

## Module und Prüfungen

- `src/engine/history.ts`: Snapshots, Bilanz, Ergebnisprüfung, Deduplizierung und Limit.
- `src/utils/history-storage.ts`: versionierter, defensiver Speicheradapter.
- `src/app/HistoryProvider.tsx`: Archivzustand, Speicherung, Wiederholung und Reset.
- `src/app/TournamentProvider.tsx`: Archivierung nach Finale, Übernahme alter Abschlüsse
  und Schutz vor dem Ersetzen eines ungesicherten Abschlusses.
- `src/pages/HistoryPage.tsx`: Übersicht, Suche, Titel-Filter und unabhängige Rückblicke.

Node-Tests prüfen echte abgeschlossene Turniere und Siegerpfade, isolierte
Snapshots, Statistiken, manipulierte Daten, Deduplizierung, Sortierung, das Limit
und Speicherfehler. Desktop-/Mobile-Browsertests prüfen zwei Turniere nacheinander,
alte Spielstände, Neuladen, Filter, Aufstellungsdetails, Quota-Wiederholung,
geschützte fremde Formate, bestätigtes Zurücksetzen, Tastaturbedienung, schmale
Ansichten und WCAG-A-/AA-Kriterien. Die bisherigen Turnierprüfungen erwarten jetzt
den echten Archiveintrag nach dem Finale.

```sh
npm run check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Es sind keine neuen Abhängigkeiten, Zugangsdaten oder externen Dienste erforderlich.

Prüfstand: **147 Node-Tests und 92 Chromium-Browsertests** bestanden. Datenabgleich,
TypeScript, Produktionsbuild und Formatprüfung sind erfolgreich. Archivübersicht
und mobiler Rückblick wurden zusätzlich visuell geprüft. Der bekannte
Größenhinweis für den eingebetteten Katalog bleibt bestehen.
