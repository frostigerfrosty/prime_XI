# Etappen 13–15: Abschluss der Entwicklungsvorschau

Version 0.14, Katalog 0.2.1. Technische Veröffentlichung, Praxistest und historische
Prüfung werden zusammen bearbeitet. Eine Vorschau ersetzt keine Datenfreigabe.

## Veröffentlichung

**Publish PRIME XI preview** läuft nach Änderungen auf `main`, manuell oder bei
einem Tag `preview-v*`. Reine Dokumentations- und Forschungsberichte lösen keine
erneute Bereitstellung aus.
Der Workflow prüft Daten, Typen, Node- und Quellenprüfungen sowie alle Desktop-/
Mobile-Browsertests, baut die Anwendung und veröffentlicht danach das Artefakt.

Die Pages-Einrichtung wird mit dem eigenen Workflow-Token versucht. Falls der
Repository-Administrator Pages noch nicht aktiviert hat und GitHub die Aktivierung
verweigert, bleibt das als Fehler erhalten. Es wird keine funktionierende Website
behauptet und kein fremdes Token beschafft. Der Eigentümer kann unter
**Settings → Pages → Build and deployment → Source: GitHub Actions** aktivieren
und anschließend den Veröffentlichungsworkflow erneut starten.

Nach einer Bereitstellung prüft `scripts/check-site.mjs` die tatsächliche URL mit
Chromium bei 1.440 und 390 Pixeln: Dashboard, Katalogfilter, direktes Teamdetail
mit Reload, Vergleich, berechnetes Testspiel, vollständiger Testspiellink und
Wiederholung. HTTP-/JavaScriptfehler und fehlende Bilder lassen die Prüfung
scheitern. Für kurze CDN-Verzögerungen gibt es höchstens drei Versuche.

Die tatsächliche URL und das Build-/Bereitstellungsergebnis stehen in
`review-results/release.json`. Pages-Antwort und Browsernachweis werden daneben
als Artefakt sowie auf `verification/pages-<run-id>` aufbewahrt. Eine fehlende
Administrationsberechtigung ist dadurch von einem fehlerhaften Build getrennt.

## Praxistest

Der zusätzliche durchgehende Test beginnt mit einem leeren Browser. Er zieht
zwölf Teams, wählt elf verschiedene Spieler, Coach und Captain ausschließlich
über die Oberfläche, startet das Turnier, lädt es nach dem ersten Spieltag neu,
beendet Liga und K.-o.-Runden, öffnet das Archiv und lädt eine Sicherungsdatei
herunter. Ein frischer Browser stellt diese Datei über die Oberfläche wieder
her, kontrolliert Archiv und Turniersieger und spielt die importierte Elf.
Dieser Ablauf wird auf Desktop und Mobile geprüft.

Die bestehenden Prüfungen umfassen Filter-Reset, Tastatur und Fokus, kleine
Breiten, axe, lokale Schriften/Bilder, Speicherfehler, defekte Spielstände,
Archivschutz, Backups und Testspiellinks. Es wurden keine externen Nutzerreaktionen
als Testergebnisse ausgegeben.

## Quellenprüfung und Datenkorrektur

Alle 60 Saisonreferenzen und sieben ergänzende Artikel wurden abgerufen und
prüfbare Auszüge gespeichert. Die 60 Trainerzuordnungen sind bestätigt. Alle
1.080 Karten haben einen Namenstreffer in ihren Saisonunterlagen. Die
[Quellenprüfung](QUELLENPRUEFUNG.md) nennt Dateien, Methoden und Grenzen.

Laportes Verbandszuordnung für Manchester City 2020/21, 2021/22 und 2022/23 wurde
von Frankreich auf Spanien korrigiert: Der Wechsel war im Mai 2021 genehmigt.
Seine früheren City-Karten bleiben Frankreich zugeordnet. Munirs Karte 2015/16
bleibt nach Prüfung der damaligen Verbandssituation Spanien zugeordnet; ein
heutiges Marokko-Flag wird nicht rückwirkend übernommen.

**Die vollständige historische Freigabe ist noch nicht erteilt.** Bei 237 Karten
sind alle hinterlegten Rollen in den gelesenen Tabellen ausdrücklich aufgeführt;
843 benötigen weitere präzise Rollenbelege. Einzelne Länder- und weitere
Feldprüfungen sind ebenfalls offen. Keine allgemeine DF/MF/FW-Angabe wird zu
einer präzisen Spielposition umgedeutet und kein Team pauschal freigegeben.

## Vorhandene Spielstände

Die Länderänderung erzeugt Katalog 0.2.1. Die kompatible Vorversion 0.2.0 wird für
Drafts und Backups ausdrücklich zugelassen, wenn deren Struktur, Aufstellung und
Spielstände weiterhin gültig sind. Unbekannte oder künftige Versionen werden
nicht dadurch pauschal akzeptiert.

Die Auswahl eines alten Drafts bleibt erhalten. Ein Hinweis erklärt, dass aktuelle
Länderzuordnungen seine Chemie ändern können. Gespeicherte Teams, laufende Turniere
und Archive bleiben mit ihren eingebetteten damaligen Werten unverändert. Das
Fortsetzen eines alten Turniers verwendet seine bisherigen Gegnersnapshots.
Wiederherstellung und erneute Sicherung alter Dateien werden im Browser geprüft.
Alte Testspiellinks mit anderem Katalogstand bleiben gesperrt, da sie ihre
damaligen Werte nicht als Snapshot enthalten.

## Verifikation

```sh
npm run check
python3 -m unittest discover -s tests/research
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
npm run data:release-check
```

Der letzte Befehl ist die separate historische Freigabeprüfung. Ihr erwartetes
Scheitern wird nicht als erfolgreicher historischer Release ausgegeben und
verhindert nicht das Prüfen einer gekennzeichneten Entwicklungsvorschau.
