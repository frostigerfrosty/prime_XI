# Datenstand am 25. Oktober 2026

Katalog 0.3.0 nutzt die neue [Saisonbewertung](SAISONRATINGS.md): 1.080 explizite
Bewertungen anhand fünf gewichteter Kriterien, 250 Karten ab 90, fünf 98er-Karten
und keine spielbare 99. Teilurteile und Quellen sind im Teamdetail einsehbar.
Die historische Freigabe wird dadurch nicht automatisch erteilt.

Der Entwicklungsbestand ist vollständig befüllt: 60 Saisonmannschaften mit 1.080
Spielerkarten, 60 Trainerkarten, 60 Standardelfen und Captain-Zuordnungen. Es gibt
keine leeren Auswahlplätze und keine fiktiven Ersatzvereine. Der Umfang ist je Team
ein ausgewählter 18er-Saisonkader, keine vollständige historische Registrierungsliste.

Der gesamte historische Daten-Release bleibt offen. Alle 60 gewählten Trainer
sind anhand tatsächlich gelesener Saisonreferenzen bestätigt; bei Trainerwechseln
ist damit der ausgewählte Trainer innerhalb der Saison gemeint. Alle 1.080
Spielerzuordnungen haben einen Namenstreffer in den jeweiligen Saisonunterlagen.
Das bestätigt nicht automatisch jede präzise Position, alle Länder-/Verbandszuordnungen
oder sämtliche übrigen Felder. Die Nachweise stehen in `data/research/`.

| Saison-Endjahr | Redaktionelle Teamauswahl                      | Saisonkarten |
| -------------- | ---------------------------------------------- | ------------ |
| 2007           | AC Milan, Liverpool, Manchester United         | 54           |
| 2008           | Manchester United, Chelsea, Real Madrid        | 54           |
| 2009           | Barcelona, Manchester United, Chelsea          | 54           |
| 2010           | Inter Milan, Bayern München, Barcelona         | 54           |
| 2011           | Barcelona, Manchester United, Real Madrid      | 54           |
| 2012           | Chelsea, Bayern München, Real Madrid           | 54           |
| 2013           | Bayern München, Borussia Dortmund, Barcelona   | 54           |
| 2014           | Real Madrid, Atlético Madrid, Bayern München   | 54           |
| 2015           | Barcelona, Juventus, Bayern München            | 54           |
| 2016           | Real Madrid, Atlético Madrid, Barcelona        | 54           |
| 2017           | Real Madrid, Juventus, Chelsea                 | 54           |
| 2018           | Real Madrid, Liverpool, Manchester City        | 54           |
| 2019           | Liverpool, Manchester City, Ajax               | 54           |
| 2020           | Bayern München, Paris Saint-Germain, Liverpool | 54           |
| 2021           | Chelsea, Manchester City, Bayern München       | 54           |
| 2022           | Real Madrid, Liverpool, Manchester City        | 54           |
| 2023           | Manchester City, Inter Milan, Napoli           | 54           |
| 2024           | Real Madrid, Manchester City, Bayer Leverkusen | 54           |
| 2025           | Paris Saint-Germain, Inter Milan, Barcelona    | 54           |
| 2026           | Paris Saint-Germain, Arsenal, Bayern München   | 54           |

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

Die Anwendung enthält inzwischen Team Builder, Matchengine, vollständiges Turnier,
Archiv, Backups, Teamvergleich und Testspiellinks. Ein durchgehender Browsertest
beginnt ohne Spielstand, erstellt eine Elf, beendet ein Turnier und stellt die
heruntergeladene Sicherung in einem frischen Browser wieder her.

## Historisch offen

Alle 60 Mannschaften besitzen noch eine maschinenlesbare historische Prüfaufgabe.
Die bisher vier offenen Trainerfälle PSG 2019/20, Napoli 2022/23, Arsenal 2025/26
und Bayern 2025/26 sind nun durch die Saisonartikel bestätigt. Der ursprüngliche
Registerabgleich mit 56 Treffern bleibt als vorheriger Nachweis erhalten.

Der reproduzierbare Kartenabgleich findet 1.080 Saisonzeilen und 1.059 passende
Länderangaben. Ein rückwirkend geändertes Länderflag ist kein historischer Beweis:
Munir bleibt für 2015/16 Spanien zugeordnet, da sein Verbandswechsel erst 2021
genehmigt wurde. Laportes drei City-Karten ab 2020/21 wurden aufgrund des belegten
Wechsels im Mai 2021 auf Spanien korrigiert; seine früheren Karten bleiben Frankreich.

282 Hauptrollen und bei 237 Karten alle hinterlegten Rollen sind in den gelesenen
Tabellen ausdrücklich aufgeführt. **843 Karten benötigen weitere präzise Rollenbelege.**
Allgemeine Angaben wie DF/MF/FW werden nicht automatisch zu CB/CM/RW umgedeutet.
Weitere Länder-/Detailprüfungen bleiben ebenfalls offen. Die 60 Team-Freigaben
bleiben deshalb `pending`; die historischen Sperren wurden nicht gelockert.

`npm run data:report` trennt den befüllten Entwicklungsbestand von der historischen
Freigabe. `npm run data:release-check` schlägt bis zu deren Abschluss erwartungsgemäß
fehl. Das Paket ist deshalb noch nicht als endgültig historisch geprüft freigegeben.
