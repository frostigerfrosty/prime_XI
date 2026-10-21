# Matchengine und Testspiele — Version 0.6

In **Testspiel** können zwei der 60 Katalogteams oder die gespeicherte eigene Elf
antreten. Wählbar sind 90 Minuten mit möglichem Remis und ein einzelnes K.-o.-Spiel
mit Verlängerung und Elfmeterschießen. Die eigene Elf verwendet ihren letzten
explizit gespeicherten Stand, auch wenn der Draft inzwischen bearbeitet wurde.
Testspiele erzeugen weder ein Turnier noch History-Einträge. Ergebnisse gelten für
die Sitzung; der Spielcode erlaubt eine Wiederholung mit denselben Eingaben.

## Eingangsdaten und Stärke

`createMatchEngine(rules).simulateMatch(home, away, context)` ist eine reine Funktion.
Teilnehmer benötigen unterschiedliche IDs und eine endliche Matchstärke von 0 bis 113. Sie arbeitet ohne React, localStorage, Netzwerk, Uhrzeit oder `Math.random()`.
Kataloggegner erhalten ihre Stärke aus derselben Formel wie die eigene Elf:
Standardaufstellung, Coach, tatsächlich aufgestellter Captain und die zentrale
Standardtaktik (`balanced`). Ein Captain auf der Bank erhält keinen Bonus. Der
Katalogdurchschnitt `teamRating` wird nicht als Matchstärke verwendet.

```ts
const result = engine.simulateMatch(
  { id: 'meine-elf', strength: 94 },
  { id: 'gegner', strength: 87 },
  { mode: 'knockout', neutralVenue: true, seed: 'mein-spielcode' },
);
```

Gleiche Stärken, Heim-/Gastzuordnung, Spielart, Hinspielergebnis, Platzwahl,
Engineversion, Regeln und Spielcode erzeugen das gleiche Ergebnis. Neue
Teilnehmernamen beeinflussen die Tore nicht. Eingaben und Regeln werden nicht
verändert, Ergebnisse teilen keinen veränderlichen Zustand mit späteren Spielen.
Der Seed nutzt den bestehenden deterministischen PRNG. Getrennte Zufallsströme
für Form, reguläre Tore, Verlängerung und Elfmeter sorgen dafür, dass der Wechsel
von 90 Minuten zu K.-o. das reguläre Ergebnis nicht verändert.

## Tore und Heimvorteil

Mit `d = Heimstärke − Gaststärke + Heimvorteil`:

```text
xG Heim = clamp(1,35 × exp( 0,048 × d) × FormHeim, 0,15, 4,5)
xG Gast = clamp(1,35 × exp(−0,048 × d) × FormGast, 0,15, 4,5)
```

Form ist je Team unabhängig gleichverteilt zwischen 0,92 und 1,08. Heimvorteil
beträgt 1,5 Stärkepunkte, auf neutralem Platz null. Je ein unabhängiger
Poisson-Wert liefert die regulären Tore. Die Grenzen beziehen sich auf die
erwarteten Tore, nicht auf einen künstlich gekappten Endstand. Die UI rundet xG
für die Anzeige; simuliert wird mit den ungerundeten Werten. Ein besseres Team
hat höhere eigene und niedrigere gegnerische xG, Überraschungen bleiben möglich.

## Verlängerung, Elfmeter und Rückspiele

Im regulären Modus bleibt ein Remis bestehen. Im K.-o.-Modus folgt bei Gleichstand
eine Verlängerung mit einem Drittel der 90-Minuten-xG. `afterExtraTime` ist der
kumulative Spielstand nach 120 Minuten. Ein verbleibender Gleichstand führt zu
Elfmetern: Heim beginnt, bis zu fünf Schüsse je Team, sofortiges Ende bei einer
uneinholbaren Führung, danach vollständige Sudden-Death-Paare. Beide Teams haben
dieselbe Trefferchance 0,76. Es werden keine Schützen oder individuellen
Elfmeterfähigkeiten erfunden.

Die Anzahl weiterer unentschiedener Schusspaare wird geometrisch gezogen, danach
ein entscheidendes Paar. Das entspricht wiederholten unabhängigen Elfmetern und
vermeidet eine endlose Schleife oder einen künstlichen Abbruch nach X Runden.
Jeder simulierte Schuss erscheint im Ergebnis unter `shootoutKicks`.

Für spätere Rückspiele nimmt der Kontext optional `aggregateBefore: { home, away }`
auf. Dieses Hinspielergebnis muss auf die **Heim-/Gastzuordnung des Rückspiels**
gedreht sein; der Aufrufer ordnet es anhand stabiler Teilnehmer-IDs zu. Das aktuelle
Spiel wird dazu addiert. Es gibt keine Auswärtstorregel. Nur ein ausgeglichenes
Aggregat führt zur Verlängerung – ein einzelnes Remis reicht dafür nicht.
Ein Hinspiel wird im regulären Modus gespielt.

`winnerParticipantId` bezeichnet im K.-o.-Kontext den Sieger des gesamten Vergleichs,
also bei Rückspielen den Qualifizierten, der dieses einzelne Rückspiel auch verlieren
kann. Im regulären Modus bezeichnet es den Matchsieger oder `null` beim Remis.
`aggregateScore` enthält ausschließlich Tore aus regulärer Zeit und Verlängerung.
`penalties` ist separat und darf nie zu Ligatoren, Tordifferenz oder Aggregat addiert
werden. Rückspielkontext und Aggregatlogik sind getestet; die Turnierauslosung und
K.-o.-Oberfläche folgen in eigenen Etappen.

## Kalibrierung

`npm run match:report` simuliert je Paar 100.000 neutrale Einzel-K.-o.-Spiele mit
den Codes `report-0` bis `report-99999`. Die regulären Ergebnisse derselben Spiele
werden separat gezählt. Stand für Engine 1.0.0 und Gesamtregeln 1.2.0:

| Stärke A / B | Sieg A nach 90 | Remis nach 90 | Sieg B nach 90 | Sieg A im K.-o. |
| ------------ | -------------: | ------------: | -------------: | --------------: |
| 94 / 87      |        58,92 % |       22,17 % |        18,90 % |         72,37 % |
| 94 / 93      |        39,94 % |       25,79 % |        34,28 % |         53,09 % |
| 82 / 91      |        14,90 % |       19,87 % |        65,22 % |         22,15 % |
| 90 / 90      |        36,97 % |       25,81 % |        37,22 % |         49,72 % |

Die Prozentwerte aus der Spezifikation sind ungefähre Zielgrößen. Sie werden hier
als neutrale **K.-o.-Siegchancen** gelesen, weil 52–48 keine Remisquote vorsieht.
Eine 72-%-K.-o.-Chance ist ausdrücklich keine 72-%-Siegchance nach 90 Minuten.
Der knappe Vergleich liegt rund einen Prozentpunkt von 52–48 entfernt. Ergebnisse
im Bericht sind eine feste Stichprobe; die typische statistische Unsicherheit bei
100.000 Spielen beträgt etwa ±0,3 Prozentpunkte (95-%-Intervall). Heimspiele und
geänderte Regeln haben andere Chancen. `validated_v1` belegt diese Spielbalance,
keine historischen Wettquoten oder freigegebenen Kaderangaben.

## Versionen und Prüfungen

Die Gesamtregeln sind 1.2.0, `strength.modelVersion` bleibt 1.1.0 und
`match.engineVersion` ist 1.0.0. `SavedTeam.rulesVersion` verweist auf das
Stärkemodell. Bestehende Phase-4-Teams mit Wert 1.1.0 bleiben gültig und spielbar.
Ein künftig verändertes Stärkemodell muss bewusst migriert werden; ein bloßes
Match-Update überschreibt weder Karten noch die gespeicherte Stärke.

Node-Tests prüfen feste Seeds, Verteilungs-Mittelwert und -Varianz, Formgrenzen,
Heimvorteil, beide K.-o.-Entscheidungswege, Rückspiel-Aggregate, vorzeitiges
Shootout-Ende, Sudden Death, ungültige Zahlen und unveränderte Eingaben. Eine feste
50.000er-Stichprobe je Stärkepaar prüft die Kalibrierungsbereiche. Browsertests
decken Katalogspiele, gespeicherte Teams, Replays, Steuerelementwechsel,
120-Minuten-Anzeige, separate Elfmeter, Tastatur, axe-Prüfungen und kleine Breiten ab.

Prüfstand: 92 Node-Tests und 46 Chromium-Browsertests auf Desktop und Mobile
bestanden. Die acht neuen Match-Browsertests wurden nach der abschließenden
Fokusverbesserung nochmals erfolgreich ausgeführt. Datenabgleich, TypeScript und
Produktionsbuild sind erfolgreich; Desktop- und Handyansicht wurden zusätzlich
als Screenshots angesehen. Der bekannte Größenhinweis für den vollständig
eingebetteten Katalog bleibt bestehen (rund 172 KB gzip für den Einstiegschunk).
Es sind keine neuen Pakete, API-Schlüssel oder externen Dienste erforderlich.
