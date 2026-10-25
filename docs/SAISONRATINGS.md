# Positionsgerechte Saisonratings

Version 0.16, Katalog 0.3.0, Modell `prime-xi-season-rubric-v3`.

Eine Zahl hat über alle Positionen und Jahrgänge denselben Anspruch. Bewertet wird
die tatsächliche **Vereinssaison**, einschließlich Umfang und Rolle, unabhängig
von Karriere-Ruhm, Alter, künftigem Potenzial oder Nationalmannschaftsturnieren.
Ein Mannschaftstitel erzeugt keinen pauschalen Aufschlag für seine Spieler.

## Fünf gemeinsame Kriterien

| Kriterium              | Gewicht | Maßstab                                                       |
| ---------------------- | ------: | ------------------------------------------------------------- |
| Positionsleistung      |    35 % | Qualität in den tatsächlichen Aufgaben der Position und Rolle |
| Einfluss               |    25 % | Individuelle Spielprägung und Bedeutung für die Mannschaft    |
| Konstanz               |    20 % | Leistungsniveau und Abdeckung der gesamten Saison             |
| Große Spiele           |    10 % | Leistungen gegen starke Gegner und in wichtigen Partien       |
| Historischer Vergleich |    10 % | Einordnung gegenüber Referenzsaisons derselben Rolle          |

Die Teilnoten sind explizite redaktionelle Urteile von 0 bis 99. Die Gewichtung
ist auf jeder Position identisch. Sie wandelt keine Torsumme oder Anzahl an
Tacklings automatisch in eine Gesamtbewertung um. Tore werden auch nicht nochmals
als Titel- oder Karrierebonus addiert.

Die zentral hinterlegten Merkmale unterscheiden alle 14 Rollen. Bei Torhütern
zählen beispielsweise Torverhinderung, Raumkontrolle, Fehlervermeidung und Aufbau;
bei Innenverteidigern Stellungsspiel, Absicherung, Duelle und Aufbau. Wenige nötige
Tacklings sind kein negatives Qualitätsmerkmal. Defensive Rollen brauchen keine
Tore, um dieselbe historische Qualität zu erreichen.

## Skala und zusätzliche Hürden

| Rating   | Bedeutung                                          |
| -------- | -------------------------------------------------- |
| 98–99    | Historische Ausnahmesaison                         |
| 95–97    | Historisch herausragende Positionssaison           |
| 90–94    | Weltklasse-Saison                                  |
| 85–89    | Internationale Spitzenklasse                       |
| 80–84    | Sehr starke Saison                                 |
| 75–79    | Gute Profisaison                                   |
| Unter 75 | Begrenzter Saisonbeitrag, Reserve oder Entwicklung |

Der gewichtete Wert wird auf eine ganze Zahl gerundet und anschließend durch
zusätzliche Grenzen geprüft:

- 90+ verlangt mindestens 90 im historischen Rollenvergleich.
- 95+ verlangt mindestens 95 dort und eine einzeln begründete Referenzbewertung.
- 98/99 verlangen zusätzlich eine explizite historische Ausnahmeentscheidung mit
  gelesenen Quellen sowie mindestens 98 bei Positionsleistung, Einfluss und
  historischem Vergleich und mindestens 95 bei Konstanz.
- Bei ausdrücklich begrenzter leistungsbezogener Beleglage gilt vorläufig höchstens 89. Das ist separat markiert; Quellenumfang ist kein versteckter Leistungsbonus.

Die höchste Teilnote oder die beste Saison eines Spielers vergibt keine automatische 99. Positionen erhalten keine vorgeschriebene Anzahl an Spitzenkarten. Die Hürden
sind konservative Spielentscheidungen, keine statistisch bewiesenen Naturgesetze.

## Überarbeitung des Katalogs

Alle **1.080 Karten** haben eine explizite Saisonzuordnung in
`data/editorial/rating-calibration.json`. Wiederverwendbare Urteilsprofile halten
die Skala konsistent; individuelle Referenzbegründungen ergänzen historische
Spitzensaisons, Verletzungsfälle und die besprochenen Vergleiche. Die alten
Gesamtratings sind keine Eingabe für die neuen Gesamtratings.

Die fünf Scores, Begründung, Quellen und Bewertungsgrundlage werden je Karte
exportiert. Im Teamdetail öffnet **Bewertung erklären** diese Angaben. Der Bericht
`data/research/rating-calibration-report.json` zeigt die tatsächliche Verteilung:

- 5 Karten mit 98, keine spielbare 99.
- 29 Karten mit 95–97.
- Insgesamt 250 Karten mit mindestens 90, zuvor 594.
- Yamal 2024/25: 92; Messi 2010/11 und 2014/15: jeweils 98.

Messis 73 Vereinspflichtspieltore 2011/12 sind als externer 99er-Referenzfall
hinterlegt. Barcelona 2011/12 gehört nicht zu den bestehenden 60 ausgewählten
Mannschaften und wird dadurch nicht zusätzlich in den Spielkatalog eingefügt.

## Quellen und Grenzen

Der [Quellenlauf](https://github.com/frostigerfrosty/prime_XI/tree/a860e59f9996133b6e2897c2a377455867680db7/review-results)
hat 72 Referenzen abgerufen. Zusätzliche Personen- und Saisonreferenzen sowie
Auszüge zu den Benchmarkfällen stehen in `data/research/rating-benchmarks.json`.
Wikipedia-Autoren und verlinkte Versionsgeschichten, CC BY-SA; die Bewertungen
selbst sind eigene redaktionelle Spielurteile.

Eine gelesene Kaderquelle bestätigt nicht automatisch jede Leistungsnote. Die
Teilurteile sind keine vollständige statistische oder unabhängige Fachbegutachtung
aller Spiele. Begrenzte Einzelbelege bleiben ausdrücklich als solche markiert;
54 Karten besitzen derzeit diesen vorläufigen Status. Die historischen
Mannschaftsfreigaben bleiben unverändert offen. Auch die Kartenratings sind als
redaktionell vorläufig erfasst, statt die neue Einordnung als historische Tatsache
pauschal freizugeben.

Individuelle technische Attributprofile bleiben Spielwerte. Bei der Umstellung
werden ihre bestehenden individuellen Abstände zum Gesamtrating mitgeführt und
auf den gültigen Wertebereich begrenzt; sie werden nicht als neu gemessene
historische Einzelstatistiken ausgegeben.

## Spielstände und Berechnung

Neue Drafts und Katalogvergleiche verwenden die neue Skala. Bekannte Drafts aus
0.2.0/0.2.1 behalten ihre IDs, Reihenfolge und gesperrten Picks, verwenden aber die
aktuellen Kartenwerte; ein Hinweis erklärt die Änderung. Gespeicherte Teams,
laufende Turniere, Gegner und Archive behalten ihre eingebetteten damaligen Werte.
Ein echter alter Attributbestand wird in den Kompatibilitätstests mitgeführt.

Teamrating und Matchstärke werden aus den neuen Karten neu berechnet. Die
Stärke-, Bonus- und Matchformeln ändern sich nicht. Teamstärke ist kein zusätzlich
frei vergebenes Prestige-Rating. Testspiellinks mit älterem Katalogstand werden
weiterhin abgewiesen, da sie die damaligen Werte nicht einfrieren.

```sh
npm run ratings:build
npm run data:build
npm run ratings:report
npm run check
npm run test:e2e
```

Die Kontrollen verhindern fehlende Saisonzuordnungen, unregistrierte oder ungelesene
Referenzen, unzulässige Scores und Abweichungen zwischen Bewertung und Export.
