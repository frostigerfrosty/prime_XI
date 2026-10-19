# Datenstand am 19. Oktober 2026

Der Entwicklungsbestand ist vollständig befüllt: 60 Saisonmannschaften mit 1.080
Spielerkarten, 60 Trainerkarten, 60 Standardelfen und Captain-Zuordnungen. Es gibt
keine leeren Auswahlplätze und keine fiktiven Ersatzvereine. Der Umfang ist je Team
ein ausgewählter 18er-Saisonkader, keine vollständige historische Registrierungsliste.

Der gesamte historische Daten-Release bleibt offen. 56 Trainer-Saison-Namen sind
anhand eines gelesenen Registers abgeglichen. Das bestätigt nicht gleichzeitig die
Kaderzugehörigkeit, Positionsrollen, Länder-/Verbandszuordnungen oder Captains.
Eigene feste Spielratings sind gesondert für den V1-Datenbestand festgelegt.

| Saison-Endjahr | Redaktionelle Teamauswahl | Saisonkarten |
| --- | --- | --- |
| 2007 | AC Milan, Liverpool, Manchester United | 54 |
| 2008 | Manchester United, Chelsea, Real Madrid | 54 |
| 2009 | Barcelona, Manchester United, Chelsea | 54 |
| 2010 | Inter Milan, Bayern München, Barcelona | 54 |
| 2011 | Barcelona, Manchester United, Real Madrid | 54 |
| 2012 | Chelsea, Bayern München, Real Madrid | 54 |
| 2013 | Bayern München, Borussia Dortmund, Barcelona | 54 |
| 2014 | Real Madrid, Atlético Madrid, Bayern München | 54 |
| 2015 | Barcelona, Juventus, Bayern München | 54 |
| 2016 | Real Madrid, Atlético Madrid, Barcelona | 54 |
| 2017 | Real Madrid, Juventus, Chelsea | 54 |
| 2018 | Real Madrid, Liverpool, Manchester City | 54 |
| 2019 | Liverpool, Manchester City, Ajax | 54 |
| 2020 | Bayern München, Paris Saint-Germain, Liverpool | 54 |
| 2021 | Chelsea, Manchester City, Bayern München | 54 |
| 2022 | Real Madrid, Liverpool, Manchester City | 54 |
| 2023 | Manchester City, Inter Milan, Napoli | 54 |
| 2024 | Real Madrid, Manchester City, Bayer Leverkusen | 54 |
| 2025 | Paris Saint-Germain, Inter Milan, Barcelona | 54 |
| 2026 | Paris Saint-Germain, Arsenal, Bayern München | 54 |

## Technisch geprüft

- Strenges Schema, Referenzen, dauerhafte Identitäten, Saisonzuordnung und eindeutige Karten.
- Mindestens zwei Torhüter pro Kader und elf gültig zugewiesene Standardspieler.
- Individuelle feste Attribute, Wertebereiche und eigener Ratingstatus.
- Normalisierte Positionsgewichte, begrenzte Boni und ein rechnerisch konsistentes
  36-Team-Liga-/K.-o.-Format.
- Reproduzierbare Exporte, lokale Monogramme und Pfade für GitHub Pages.
- 200 reproduzierbare Draft-Pools liefern jeweils elf verschiedene Personen aus
  elf verschiedenen gezogenen Saisonmannschaften in einer gültigen 4-3-3-Aufstellung.
  Zusätzliche Prüfungen decken stark überlappende Vereinsjahrgänge und einen ungültigen
  Pool aus zwölf Kopien desselben Teams ab.
- Eigene Datentypen für Draft, gespeichertes Team, Matchresultat, Tabelle, K.-o.-Paarung,
  Turnier und History sowie ein leerer initialer Anwendungszustand.

Diese Prüfungen betreffen das Datenpaket. Die Benutzeroberfläche, Speicherung und
Matchengine sind weitere Entwicklungsschritte.

## Historisch offen

Alle 60 Mannschaften besitzen noch eine maschinenlesbare historische Prüfaufgabe.
Insbesondere sind die konkrete Saisonzugehörigkeit jedes Kadermitglieds, Captains,
Saison-Nationalitäten und Positionsrollen vollständig zu belegen. Beim Trainerregister
bleiben PSG 2019/20, Napoli 2022/23, Arsenal 2025/26 und Bayern 2025/26 ohne passenden
gelesenen Registereintrag; deren Trainerstatus bleibt `pending`.

`npm run data:report` trennt den befüllten Entwicklungsbestand von der historischen
Freigabe. `npm run data:release-check` schlägt bis zu deren Abschluss erwartungsgemäß
fehl. Das Paket ist deshalb noch nicht als endgültig historisch geprüft freigegeben.
