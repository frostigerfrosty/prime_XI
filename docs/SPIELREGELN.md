# Zentrale Spielkonfiguration

Die Werte stehen in `data/editorial/game-rules.json` und werden mit dem Datensatz
exportiert. Sie sind konkrete V1-Eingangsdaten für die spätere Engine, keine bereits
implementierte Matchsimulation. Eigene Entscheidungen stehen zusätzlich unter
`designDecisions`; die Spezifikationswerte sind von kalibrierbaren Startwerten
unterschieden. Teamstärke und Boni sind in Regelversion 1.1.0 umgesetzt;
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

| Bonus | Obergrenze |
| --- | --- |
| Chemie | +7 |
| Taktik | +3 |
| Trainer | +2 |
| Natural Captain | +2 |

Der Matchwert addiert die begrenzten Boni zur Basis. Die Ratingskala 0–99 betrifft
Spielerwerte; die spätere Engine soll einen addierten Matchwert nicht stillschweigend
als neuen Spielerwert behandeln. Der Katalogdurchschnitt `teamRating` ersetzt keine
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

Poisson-Torverteilung mit Basis-xG 1,35, Stärkeempfindlichkeit 0,08, optionalem
Heimvorteil von 1,5 Ratingpunkten und höchstens 8 % Matchvarianz. xG-Bereich 0,15–4,5.
Neutraler Platz hat keinen Heimvorteil. Regulär 90 Minuten, gegebenenfalls 30 Minuten
Verlängerung und fünf erste Elfmeter je Team, anschließend Sudden Death.

Diese Parameter müssen von einer zentralen, seedfähigen Engine umgesetzt und anhand
der Ziel-Siegchancen der Spezifikation getestet werden. `calibrationStatus` bleibt
deshalb `requires_engine_validation`. Datenprüfungen oder Draft-Tests belegen keine
bereits funktionierende Matchsimulation.

## Turnierformat

36 Teilnehmer: ein eigenes Team und 35 verschiedene Saisonmannschaften. Verschiedene
Saisons desselben Vereins bleiben erlaubt. Je acht Ligaspiele mit vier Heim- und vier
Auswärtsspielen ergeben 144 Ligaspiele. Punkte: Sieg 3, Remis 1, Niederlage 0.

Die V1-Reihenfolge ist Punkte, Tordifferenz, erzielte Tore, Siege und schließlich die
stabile Teilnehmer-ID. Plätze 1–8 gehen direkt ins Achtelfinale, 9–24 spielen Playoffs,
25–36 scheiden aus. Das Spielformat bildet die 36-Team-Idee nach; es behauptet keine
vollständige Kopie aller UEFA-Auslosungs- und Tie-Breaker-Bestimmungen.

Playoffs mit 16 Teams liefern acht Sieger für die acht Direktqualifizierten.
Danach Achtelfinale mit 16, Viertelfinale mit 8, Halbfinale mit 4 und Finale mit 2 Teams.
Außer dem einzelnen neutralen Finale haben die K.-o.-Runden Hin- und Rückspiel.
Keine Auswärtstorregel; ein ungelöster Gleichstand wird durch Verlängerung und
gegebenenfalls Elfmeterschießen aufgelöst.

## Speichern

Eigene versionierte Schlüssel sind für Draft, Team, laufendes Turnier, abgeschlossene
Turniere und Einstellungen festgelegt. Die Anwendungszustände besitzen passende
TypeScript-Verträge. Die Datenbasis führt noch keine Speicherzugriffe oder
Zustandsänderungen selbst aus.
