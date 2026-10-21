# Zentrale Spielkonfiguration

Die Werte stehen in `data/editorial/game-rules.json` und werden mit dem Datensatz
exportiert. Teamstärke und Matchsimulation verwenden diese zentralen Parameter.
Eigene Entscheidungen stehen zusätzlich unter
`designDecisions`; die Spezifikationswerte sind von kalibrierbaren Startwerten
unterschieden. Die Gesamtregeln haben Version 1.4.0, das unveränderte Stärkemodell
Version 1.1.0, Match-, Liga- und K.-o.-Engine jeweils Version 1.0.0. Bestehende Team-Snapshots bleiben
gültig: `SavedTeam.rulesVersion` bezeichnet die Version des Stärkemodells.
[Formeln und Snapshot-Verhalten](TEAMSTAERKE.md) sind separat dokumentiert.

## Team Builder

Zwölf verschiedene Saisonmannschaften ziehen. Exakt elf verschiedene Personen
aufstellen und einen Trainer aus dem gezogenen Pool wählen. Als dokumentierter
V1-Standard gilt höchstens ein Spieler pro Saisonmannschaft. Der Trainer ist ein
separater Pick und darf aus einem bereits für einen Spieler verwendeten Team stammen.
Der Einstieg unterstützt 4-3-3; die sieben gespeicherten Formationen erlauben weitere
Layouts und historische Gegneraufstellungen.

## Stärke und Boni

Die positionsgewichtete Basis verwendet 8 % Torwart, 27 % Verteidigung, 30 % Mittelfeld
und 35 % Angriff. Innerhalb jeder Gruppe auf die tatsächlich zugewiesenen Slots
normalisieren. Eine Hauptposition hat Faktor 1, eine Nebenposition als eigener
V1-Startwert Faktor 0,95. Ungültige Positionen sind unzulässig.

| Bonus           | Obergrenze |
| --------------- | ---------- |
| Chemie          | +7         |
| Taktik          | +3         |
| Trainer         | +2         |
| Natural Captain | +2         |

Der Matchwert addiert die begrenzten Boni zur Basis. Die Ratingskala 0–99 betrifft
Spielerwerte; die Engine verarbeitet addierte Matchwerte bis 113 ohne 99er-Kappung.
Der Katalogdurchschnitt `teamRating` ersetzt keine
dieser Berechnungen.

Für die Chemie hat ein Paar gleicher Länder-/Verbandszuordnung Gewicht 1, gleicher
Vereinsidentität Gewicht 0,5. Verschiedene Saisons desselben Vereins zählen zum
gleichen Verein. Über alle möglichen Paare auf das theoretische Maximum normieren
und mit der Chemiegrenze multiplizieren. Taktik bewertet die Spieler-Stil-Tags gegen
die gewählte Taktik. Beim Trainer entfallen 60 % auf die Formation und 40 % auf
Stilpassung. Der Traineranteil wird zusätzlich mit `tacticalRating / ratingMax`
gewichtet. Beim Taktikbonus zählt der Anteil der elf Spieler mit mindestens einem
passenden Taktik-Tag. Das sind eigene, begrenzte und zentral änderbare V1-Startwerte.

## Matchparameter

Poisson-Torverteilung mit Basis-xG 1,35, Stärkeempfindlichkeit 0,048, optionalem
Heimvorteil von 1,5 Ratingpunkten und höchstens 8 % Matchvarianz. xG-Bereich 0,15–4,5.
Neutraler Platz hat keinen Heimvorteil. Regulär 90 Minuten, gegebenenfalls 30 Minuten
Verlängerung und bis zu fünf erste Elfmeter je Team, anschließend Sudden Death.
Ein entschiedener Shootout endet sofort. Elfmeter-Trefferchance ist für beide
Teams 0,76; die Teamstärke wirkt zuvor über 90 beziehungsweise 120 Minuten.

Die Engine ist unabhängig von React und mit einem Spielcode reproduzierbar.
`calibrationStatus` ist `validated_v1`: Ein reproduzierbarer Bericht mit jeweils
100.000 neutralen Spielen weist für 94/87 rund 72 % K.-o.-Siege, für 94/93 rund 53 %
aus. Die Zielwerte der Spezifikation werden als ungefähre K.-o.-Siegchancen
interpretiert; die separaten 90-Minuten-Chancen enthalten ausdrücklich Remis.
Das ist keine historische Datenfreigabe. Formel, vollständige Tabelle und Grenzen:
[Matchengine](MATCHENGINE.md).

## Turnierformat

36 Teilnehmer: ein eigenes Team und 35 verschiedene Saisonmannschaften. Verschiedene
Saisons desselben Vereins bleiben erlaubt. Je acht Ligaspiele mit vier Heim- und vier
Auswärtsspielen ergeben 144 Ligaspiele. Punkte: Sieg 3, Remis 1, Niederlage 0.

Die V1-Reihenfolge ist Punkte, Tordifferenz, erzielte Tore, Siege und schließlich die
stabile Teilnehmer-ID. Plätze 1–8 gehen direkt ins Achtelfinale, 9–24 spielen Playoffs,
25–36 scheiden aus. Das Spielformat bildet die 36-Team-Idee nach; es behauptet keine
vollständige Kopie aller UEFA-Auslosungs- und Tie-Breaker-Bestimmungen.

Seit Version 0.7 ist diese Ligaphase spielbar. Ein Turniercode zieht 35 verschiedene
Saisonteams und acht vollständige Runden eines Round-Robin-Plans. Geschlossene Wege
im geraden Spielgraphen verteilen das Heimrecht auf exakt vier Heim- und vier
Auswärtsspiele pro Team. Es gibt keine Wiederholungspaarungen, Freilose, Töpfe oder
Länderverbote. Ein Schritt simuliert einen vollständigen Spieltag mit 18 Spielen.
Die Tabelle wird aus den gespeicherten Ergebnissen neu aufgebaut. Ihre Zonen
bleiben bis zum achten Spieltag vorläufig. Details: [Ligaphase](LIGAPHASE.md).

Playoffs mit 16 Teams liefern acht Sieger für die acht Direktqualifizierten.
Danach Achtelfinale mit 16, Viertelfinale mit 8, Halbfinale mit 4 und Finale mit 2 Teams.
Außer dem einzelnen neutralen Finale haben die K.-o.-Runden Hin- und Rückspiel.
Keine Auswärtstorregel; ein ungelöster Gleichstand wird durch Verlängerung und
gegebenenfalls Elfmeterschießen aufgelöst.

Seit Version 0.8 sind diese Runden bis zu einem eindeutigen Turniersieger spielbar.
Die Plätze 9–16 werden den Plätzen 17–24 zufällig zugeordnet. Im Achtelfinale
treffen die Plätze 1–8 auf die acht Playoff-Sieger. Gesetzte Teams haben jeweils
das Rückspiel zu Hause. Ab dem Viertelfinale werden die verbliebenen Teams frei
neu ausgelost. Diese eigene V1-Paarungsregel ist unter
`tournament.knockout.drawPolicy` zentral festgelegt.

Hinspiele enden nach 90 Minuten. Im Rückspiel entscheidet die Summe beider
Partien; nur ein ausgeglichenes Aggregat führt zu Verlängerung und Elfmetern.
Elfmeter werden weder zu Gesamttoren noch zu Ligatoren addiert. Die Ligatabelle
bleibt nach ihrem Abschluss unverändert. Details: [K.-o.-Runden](KNOCKOUT.md).

## Speichern

Eigene versionierte Schlüssel sind für Draft, Team, laufendes Turnier, abgeschlossene
Turniere und Einstellungen festgelegt. Die Anwendungszustände besitzen passende
TypeScript-Verträge. Einstellungen, Draft, Team und das vollständige laufende oder
zuletzt beendete Turnier werden defensiv im Browser gespeichert. Bekannte
Liga-Spielstände mit Gesamtregeln 1.3.0 bleiben lesbar und werden beim ersten
K.-o.-Schritt verlustfrei auf 1.4.0 erweitert. Das Archiv mehrerer Turniere und
weitere Migrationen folgen in Etappe 8. Die statische Datenbasis selbst führt keine
Speicherzugriffe aus.
