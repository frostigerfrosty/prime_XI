# Playoffs und K.-o.-Runden — Version 0.8

Die Ligaphase geht in Playoffs, Achtelfinale, Viertelfinale, Halbfinale und Finale
über. Jede Runde wird ausdrücklich ausgelost. Hin- und Rückspiele werden jeweils
als vollständiger Runden-Spieltag simuliert; alternativ spielt **Bis zum Finale
simulieren** nach Bestätigung alle verbleibenden K.-o.-Spiele aus. Ein bereits
gespieltes Ergebnis wird dabei nicht verändert. Auch nach dem Ausscheiden der
eigenen Elf kann der Rest des Turniers verfolgt werden.

## Qualifikanten und Auslosung

| Runde         | Teilnehmer und Paarungen                                       | Heimrecht                                |
| ------------- | -------------------------------------------------------------- | ---------------------------------------- |
| Playoffs      | Plätze 9–16 gegen zufällig zugeordnete Plätze 17–24            | Plätze 9–16 haben das Rückspiel zu Hause |
| Achtelfinale  | Plätze 1–8 gegen die acht zufällig zugeordneten Playoff-Sieger | Plätze 1–8 haben das Rückspiel zu Hause  |
| Viertelfinale | Acht verbliebene Sieger, frei neu ausgelost                    | Per seedbasierter Auslosung              |
| Halbfinale    | Vier verbliebene Sieger, frei neu ausgelost                    | Per seedbasierter Auslosung              |
| Finale        | Die zwei Halbfinalsieger                                       | Ein einzelnes neutrales Spiel            |

Dies ist eine eigene, explizite V1-Paarungsregel. Sie behauptet keine vollständige
Kopie der UEFA-Auslosung. Es gibt keine Länder- oder Vereinsverbote. Ab dem
Viertelfinale wird neu ausgelost; die Oberfläche zeigt deshalb die Runden als
getrennte Stationen und keine falschen festen Verbindungslinien zwischen Paarungen.

Gleicher Turniercode, gleiche Teilnehmer-Snapshots und Spielregeln reproduzieren
Auslosungen und Ergebnisse. Die K.-o.-Zufallsströme haben eigene Namensräume und
verändern die bereits simulierte Ligaphase nicht. `drawPolicy` und Format stehen
zentral in `data/editorial/game-rules.json`.

## Hinspiel, Rückspiel und Gesamttore

Eine Paarung besitzt stabile Team-A-/Team-B-IDs. In gesetzten Runden ist Team A
das gesetzte Team. Das Hinspiel wird bei B, das Rückspiel bei A ausgetragen.
Hinspiele verwenden den regulären 90-Minuten-Modus und dürfen unentschieden enden.
Sie entscheiden die Paarung noch nicht.

Vor dem Rückspiel werden die Hinspieltore anhand der Teilnehmer-IDs auf die
Heim-/Gastzuordnung des Rückspiels gedreht. Die Matchengine erhält genau diese
bereits erzielten Gesamttore als `aggregateBefore`. Ein Rückspielsieg alleine
garantiert kein Weiterkommen; umgekehrt kann der Gesamtsieger das Rückspiel verlieren.
Es gibt keine Auswärtstorregel. Auch ein Remis im Rückspiel benötigt keine
Verlängerung, wenn das Aggregat bereits einen Sieger hat.

Nur ein ausgeglichener Gesamtstand nach 90 Minuten im Rückspiel führt zu 30 Minuten
Verlängerung und gegebenenfalls Elfmetern. `afterExtraTime` ist der kumulative
Spielstand dieser Partie nach 120 Minuten. Die Paarung summiert die Hinspieltore
und genau diesen Rückspielstand. Die einzelnen Schüsse des Shootouts stehen
getrennt in `shootoutKicks`; `penalties` wird nie zu normalen Toren addiert.
Die Anzeige weist die Elfmeter getrennt aus und erlaubt das Aufklappen aller Schüsse.

Im Rückspiel bezeichnet `winnerParticipantId` den **Gesamtsieger**, im Hinspiel
den Sieger der einzelnen Partie. Für das Weiterkommen verwendet der Controller
ausschließlich den Sieger des entscheidenden Rückspiels beziehungsweise Finales.

## Runden und Turnierabschluss

Ein Schritt spielt alle Hinspiele oder alle Rückspiele der aktuellen Runde aus.
Nach vollständiger Entscheidung aller Paarungen wird die nächste Auslosung
freigegeben. Nur deren Sieger sowie die vorgesehenen Direktqualifikanten dürfen
die nächste Runde erreichen. Ausgeschiedene Teams kehren nicht zurück.

Das neutrale Finale hat nur eine Partie und wird bei Bedarf ebenfalls durch
Verlängerung und Elfmeter entschieden. Nach dem Finale enthält der Spielstand:

- 144 Liga- und 45 K.-o.-Spiele, insgesamt **189 gespielte Partien**;
- 23 entschiedene Paarungen: 8 Playoffs, 8 Achtel-, 4 Viertel-, 2 Halbfinals, 1 Finale;
- genau einen `championParticipantId`, `phase: 'completed'` und einen Abschlusszeitpunkt;
- die unveränderte endgültige Ligatabelle.

Die eigene Anzeige unterscheidet direkten Achtelfinaleinzug, Ausscheiden nach der
Liga oder einer bestimmten K.-o.-Runde, Finalist und Turniersieger. Es werden keine
willkürlichen Gesamtplätze für gemeinsam ausgeschiedene Teams erfunden. Das
Dashboard zeigt die aktuelle Runde oder den Turnierabschluss. Die Archivseite
verweist bei einem beendeten Turnier ehrlich auf dessen gespeicherte Turnieransicht.

## Speichern und bestehende Ligastände

Die Speicherung verwendet weiterhin `prime-xi:current-tournament:v1` und denselben
Umschlag `{ schemaVersion: 1, tournament }`. Sie erfolgt nach jeder Auslosung und
jedem gespielten Hin-/Rückspieltag sowie nach dem Finale. Bei Schreibfehlern bleibt
der Sitzungsstand spielbar, und die UI weist auf einen möglichen Rücksprung zum
letzten gespeicherten Stand nach Neuladen hin.

Die Gesamtregeln haben Version **1.4.0**, das Stärkemodell bleibt 1.1.0 und
Match-/Liga-/K.-o.-Engine haben jeweils Version 1.0.0. Neue Turniere führen
`knockoutVersion: '1.0.0'`. Bekannte Phase-6-Ligastände mit Gesamtregeln 1.3.0,
Liga-/Matchengine 1.0.0, ohne K.-o.-Paarungen und ohne `knockoutVersion` bleiben
lesbar. Sie werden beim Lesen nicht umgeschrieben. Erst eine K.-o.-Auslosung
ergänzt das Feld und setzt die Gesamtregelversion auf 1.4.0. Teilnehmer, Karten,
Matchstärken, Seed und alle Ligaergebnisse bleiben dabei erhalten.

Beim Einlesen werden zusätzlich zum bestehenden Liga-Validator sämtliche
K.-o.-Auslosungen und bereits gespielten Schritte aus Seed, Tabelle und Snapshots
rekonstruiert. Geprüft werden Paarungen, Heimrechte, chronologische vollständige
Spielrunden, Gesamttore, Siege, Elfmeterdetails und der endgültige Champion.
Unbekannte oder beschädigte Stände bleiben als Rohdaten erhalten. Nur ungerundete
xG erlauben eine Toleranz von 1e-10 zwischen JavaScript-Laufzeiten; Tore,
Gesamtstände, Schüsse und Metadaten werden exakt verglichen.

Die Abschlusszeit ist ein Metadatum und beeinflusst keine Simulation. Sie muss ein
gültiger Zeitpunkt ab Turnierstart sein. Sie wird nur bei einem tatsächlich
gespielten Finale gesetzt. Die Einzel- und Gesamtsimulation liefern bei gleicher
Abschlusszeit identische Spielstände.

## Grenze dieser Etappe

Das aktuelle beziehungsweise zuletzt beendete Turnier bleibt vollständig unter
**Turnier** gespeichert. Das Starten eines neuen Turniers fragt vor dem Ersetzen
dieses Stands nach. Ein Archiv für mehrere abgeschlossene Turniere, dessen
Statistiken und weitergehende Speicher-Migrationen folgen in Etappe 8. Es werden
noch keine History-Einträge in `completedTournaments` angelegt.

## Module und Prüfung

- `src/engine/knockout.ts`: Auslosung, Rückspiele, Gesamttore, Finale und Replay-Validierung.
- `src/engine/tournament.ts`: gemeinsame Kontrolle, Liga-Kompatibilität und Übergänge.
- `src/engine/comparison.ts`: strikte Struktur-/Ergebnisvergleiche mit begrenzter xG-Toleranz.
- `src/components/KnockoutPanel.tsx`: Runden, Sieger, Spielstände und Elfmeterschüsse.
- `src/components/TournamentTeams.tsx`: gemeinsame Team-/Partiedarstellung.

Die Tests prüfen gesetzte Gruppen, direktes Weiterkommen, Heim-/Auswärtswechsel,
unabhängig summierte Gesamttore, Verlängerung, Elfmeter ohne Toraddition,
Teilrunden, Ausscheiden, 189 Partien bis zum Champion, alte Liga-Spielstände,
Neuladen sowie manipulierte Tore, Gewinner und Zeitangaben. Browsertests bedienen
alle Runden bis zum Finale, getrennte Schussergebnisse, Nutzer-Sieg und Ausscheiden,
Dialoge, Quota-Fehler, Tastatur, mobile Breiten und axe-Prüfungen.

Prüfstand: **140 Node-Tests und 76 Chromium-Browsertests** bestanden. Datenabgleich,
TypeScript und Produktionsbuild sind erfolgreich. Die Ansichten für Paarungen
und Champion wurden auf Desktop und Handy zusätzlich visuell geprüft. Nach der
Ergänzung der Saisonangabe beim Paarungssieger wurden die Accessibility-/Mobile-
Prüfungen nochmals gezielt ausgeführt. Es sind keine neuen Pakete oder
Zugangsdaten nötig. Der bekannte Größenhinweis für den eingebetteten Katalog
bleibt bestehen.
