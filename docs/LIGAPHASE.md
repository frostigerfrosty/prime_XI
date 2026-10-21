# 36-Team-Turnier und Ligaphase — Version 0.7

Die eigene vollständige Elf spielt gegen 35 zufällig gezogene Saisonmannschaften.
**Team speichern & Turnier starten** übernimmt die aktuelle Builder-Aufstellung,
speichert sie und öffnet das Turnier. Alternativ startet die Turnierseite mit der
zuletzt gespeicherten Elf und einem frei wählbaren Turniercode. Ein bestehender
Spielplan wird erst nach Bestätigung ersetzt. Ein neuer Draft oder erneutes
Speichern im Builder verändert ein laufendes Turnier nicht.

## Teilnehmer und Werte

Die eigene Elf ist automatisch qualifiziert. Von den 60 Katalogteams werden
35 unterschiedliche Saisonteam-IDs ohne Zurücklegen gezogen. Verschiedene Saisons
desselben Vereins sind erlaubt; der gemischte Benutzerkader ist ein eigener
Teilnehmer, keine zusätzliche Kopie eines einzelnen Saisonkaders. Es gibt keine
Beschränkung, Gegner zu ziehen, aus denen der Nutzer zuvor Spieler gewählt hat.

Beim Start werden sämtliche Teilnehmer als unabhängige Snapshots übernommen:
Spieler, Attribute, Standardelf, Coach, Captain und berechnete Matchstärke. Für
Gegner gilt die zentrale Standardtaktik `balanced` und dieselbe Stärkeformel wie
für das eigene Team. Spätere Katalogänderungen ersetzen keine dieser Werte.

## Auslosung und Spielplan

Der seedbasierte Ablauf arbeitet mit getrennten Zufallsfolgen für Gegnerauswahl,
Spielplan und Matchcodes. Er wählt acht verschiedene vollständige Runden eines
Round-Robin-Plans mit 36 Teilnehmern. Jede Runde enthält 18 disjunkte Paarungen.
Damit hat jedes Team acht unterschiedliche Gegner und genau eine Begegnung je
Spieltag. Es gibt weder doppelte Paarungen noch Freilose.

Im resultierenden ungerichteten Spielgraphen hat jeder Teilnehmer Grad acht.
Geschlossene Wege orientieren seine Kanten; jeder Eintritt hat einen Austritt.
Dadurch entstehen exakt vier Heim- und vier Auswärtsspiele pro Team, ohne erneute
Auslosungsversuche oder eine Suche mit Abbruchgrenze. Die acht Spieltage ergeben
144 Spiele. Der Algorithmus unterstützt auch kleinere gerade Teilnehmerzahlen mit
einer geraden Zahl ausgeglichener Heim-/Auswärtsrunden; die Produktkonfiguration
bleibt 36/8. Er bildet keine UEFA-Töpfe, Vereins- oder Länderverbote nach.

Gleicher Turniercode, gleiche gespeicherte Elf, Katalog, Katalogreihenfolge und
Spielregeln reproduzieren Gegner, Spielplan und Resultate. Die Startzeit ist
Metadatum für die Turnier-ID und verändert die Simulation nicht. Ein Code allein
ist kein exportierter Spielstand; zum Weiterspielen werden die Snapshots benötigt.

## Simulieren und Tabelle

**Spieltag N simulieren** spielt alle 18 Begegnungen dieses Spieltags mit der
Matchengine im regulären 90-Minuten-Modus aus. Remis bleiben bestehen; es gibt
keine Verlängerung oder Elfmeter. **Restliche Ligaphase simulieren** fragt vorab
nach und erzeugt dieselben Ergebnisse wie die einzelnen Spieltage nacheinander.
Ein bereits gespieltes Match wird nie neu ausgewürfelt.

Die Tabelle wird vollständig aus den gespielten Ligaergebnissen berechnet:
Spiele, Siege, Remis, Niederlagen, Tore, Gegentore, Tordifferenz und Punkte.
Standardpunkte sind 3/1/0. Sortiert wird nach Punkten, Tordifferenz, erzielten
Toren, Siegen und stabiler Teilnehmer-ID. Die letzte Ordnung verwendet einen
festen Zeichenvergleich und hängt nicht von der Browser-Locale ab.

Bis zum ersten Spieltag wird für die eigene Platzierung „–“ angezeigt. Danach
sind die Tabellenzonen vorläufig. Nach acht Spieltagen sind sie endgültig:

| Plätze | Ergebnis                                 |
| ------ | ---------------------------------------- |
| 1–8    | Direkt für das Achtelfinale qualifiziert |
| 9–24   | Für die Playoffs qualifiziert            |
| 25–36  | Ausgeschieden                            |

Die Oberfläche zeigt die eigene nächste Partie, das letzte Ergebnis, alle acht
eigenen Paarungen und die 18 Spiele eines auswählbaren Spieltags. Auf kleinen
Bildschirmen ist die vollständige Tabelle innerhalb ihres eigenen Bereichs mit
Tastatur und Touch scrollbar. Das Dashboard zeigt Spieltag, Punkte und Platz und
führt zurück zum laufenden Turnier.

## Speichern und Validieren

`rules.storage.keys.currentTournament` (`prime-xi:current-tournament:v1`) enthält
`{ schemaVersion: 1, tournament: TournamentState }`. Es wird beim Start und nach
jedem Simulationsschritt geschrieben. Ein Schreibfehler lässt die Sitzungsdaten
spielbar und weist ausdrücklich darauf hin, dass ein Neuladen zum zuletzt
gespeicherten Spieltag zurückkehren kann. Draft, Team, Einstellungen und History
werden vom Turnieradapter nicht verändert.

Beim Laden werden insbesondere geprüft:

- bekannte Gesamtregeln, Liga- und Matchengineversion sowie gültige Metadaten;
- exakt ein Benutzerteam und 35 verschiedene Gegner mit konsistenten Karten;
- neu berechnete Matchstärken aus den eingebetteten Aufstellungen;
- ein zum Seed und den Teilnehmern passender Spielplan;
- nur vollständig gespielte Spieltage in chronologischer Reihenfolge;
- reproduzierte Ergebnisse einschließlich Gewinner, Seed und xG;
- eine aus genau diesen Ergebnissen neu berechnete Tabelle.

Beschädigte oder unbekannte Spielstände werden weder geladen noch automatisch
überschrieben. Erst ein ausdrücklich gestartetes neues Turnier ersetzt sie.
Unterschiedliche historische Datensatzversionen sind erlaubt, solange die
eingebetteten Karten und bekannten Regeln gültig bleiben. Unbekannte zukünftige
Regelmodelle benötigen eine bewusste Migration. Das V1-Limit des gespeicherten
JSON-Texts beträgt vier Millionen Zeichen.

## Grenze dieser Etappe

Die Ligaphase endet mit der endgültigen Platzierung und Qualifikationsanzeige.
`phase` bleibt `league`, `completedAt` und `championParticipantId` bleiben `null`,
`knockoutTies` bleibt leer. Das Turnier ist damit noch nicht als Ganzes abgeschlossen.
Es wird kein History-Eintrag angelegt. Playoffs, K.-o.-Runden und das Finale folgen
in Etappe 7; das vollständige Archiv und weitere Migrationen in Etappe 8.

Gesamtregeln 1.3.0, Stärkemodell 1.1.0, Matchengine 1.0.0 und Ligaengine 1.0.0 sind
separat erfasst. Bestehende gespeicherte Elf-Snapshots aus Phase 4 bleiben spielbar.
Die historische Kaderfreigabe und die redaktionellen Spielratings werden durch
eine funktionierende Simulation nicht als historisch bestätigt ausgegeben.

## Module und Prüfung

- `src/engine/league.ts`: Auslosung der Paarungen, Heimrechte, Tabelle und Zonen.
- `src/engine/tournament.ts`: Teilnehmer-Snapshots, Spieltage und Laufzeitvalidierung.
- `src/utils/tournament-storage.ts`: defensiver localStorage-Adapter.
- `src/app/TournamentProvider.tsx`: gemeinsamer Sitzungsstand über alle Seiten.
- `src/pages/TournamentPage.tsx`: Start, Spielplan, Ergebnisse und Tabelle.

Die Tests prüfen 200 Auslosungen auf sämtliche Spielplan-Invarianten,
handgerechnete Tabellen und alle Tie-Breaker, Gleichstände, Fortsetzen,
identische Einzel-/Gesamtsimulation und Summen über alle 144 Ergebnisse.
Sie verwerfen beschädigte Karten, Tabellen, Scores, Heimrechte, Teilspieltage
und unbekannte Regelversionen und prüfen Quota-/Zugriffsfehler.
Browsertests decken beide Startwege, Spieltage, Neuladen, Dashboard, Abschluss,
Bestätigungsdialoge, getrennte Builder-/Turnierstände, Tastatur und axe-Prüfungen ab.

Prüfstand: 120 Node-Tests und 60 Chromium-Browsertests bestanden, einschließlich
Desktop und Mobile. Datenabgleich, TypeScript und Produktionsbuild sind erfolgreich.
Desktopübersicht, Tabelle und Handyansicht wurden zusätzlich visuell geprüft.
Ein in Node erzeugter gespielter Turnierstand ließ sich auch in Chromium laden und
fortsetzen; ausschließlich ungerundete xG tolerieren dabei Unterschiede in der
letzten Nachkommastelle. Spielstände und Tabellen werden exakt verglichen.
Die Erweiterung benötigt keine neuen Pakete oder Zugangsdaten. Der bekannte
Größenhinweis für den eingebetteten Katalog bleibt bestehen.
