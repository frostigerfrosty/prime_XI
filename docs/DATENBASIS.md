# Datenmodell und Pflege — Schema 2, Datensatz 0.2.0

Das Paket enthält Inhalte, Spielkonfiguration und Datenverträge. React-Komponenten,
Persistenzadapter und die Simulationsengine werden im nächsten Entwicklungsschritt
implementiert. Sie sollen die vorhandenen Daten verwenden und die Spielwerte nicht
beim Seitenaufruf neu erzeugen.

## Dateien und Verantwortlichkeiten

| Datei                              | Inhalt                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `data/editorial/teams.json`        | 60 ausgewählte 18er-Kader, explizite Standardelf, Saisonattribute und Trainer                     |
| `data/editorial/people.json`       | 578 dauerhafte Personenidentitäten, darunter 554 Spieler und 26 Trainer mit zwei Überschneidungen |
| `data/editorial/clubs.json`        | 17 Vereine, Kürzel und Darstellungsfarben                                                         |
| `data/editorial/formations.json`   | Sieben Formationen mit je elf Slots und normierten Koordinaten                                    |
| `data/editorial/positions.json`    | 14 Rollen und ihre Gruppen für die Stärkeberechnung                                               |
| `data/editorial/tactics.json`      | Fünf eigene Spieltaktiken und passende Formationen/Stil-Tags                                      |
| `data/editorial/countries.json`    | 66 verwendete Länder-/Verbandskennungen mit deutschen Labels                                      |
| `data/editorial/game-rules.json`   | Draft, Stärke, Boni, Turnierformat, Matchparameter und Speicherschlüssel                          |
| `data/editorial/defaults.json`     | Echte initiale Benutzereinstellungen                                                              |
| `data/editorial/sources.json`      | Vorgeschlagene und tatsächlich gelesene Referenzen getrennt                                       |
| `data/editorial/rating-model.json` | Herkunft der eigenen V1-Spielwerte und initiale Rollenprofile                                     |
| `data/research/`                   | Tatsächliche Recherchebelege, Prüfumfang und beobachtete Sperren                                  |
| `data/schema/database.schema.json` | Striktes JSON Schema für den Export                                                               |
| `src/data/database.json`           | Erzeugter Export für Browser und Tests                                                            |
| `public/assets/clubs/`             | 17 selbst erzeugte Monogramme, keine offiziellen Wappen                                           |

`year` ist das Endjahr der europäischen Vereinssaison. 2007 bedeutet 2006/07, 2026
bedeutet 2025/26. Die Auswahl ist redaktionell und umfasst CL-Finalisten, weitere
starke Europapokalteilnehmer und nationale Spitzenteams. Sie ist keine objektiv
belegte jährliche Rangliste.

## Saisonkader und Standardelf

Jedes Team enthält 18 tatsächlich benannte Spieler, darunter mindestens zwei
Torhüter. `rosterScope: curated_squad` heißt: eine ausgewählte Auswahl aus dem
Saisonkader, keine vollständige Registrierungs- oder Finalkaderliste. Ein Spieler
kann nur während eines Teils der Saison zum Verein gehört haben. Seine Zugehörigkeit
zum konkreten Zeitraum muss in der noch offenen historischen Prüfung belegt werden.

`defaultLineup` referenziert separat exakt elf Karten in der Reihenfolge der Slots
der gewählten Formation. Die sieben übrigen Karten bleiben als Auswahloptionen
verfügbar. Das `teamRating` ist ausschließlich der gerundete Durchschnitt dieser
Standardelf. Es ist nicht die positionsgewichtete Matchstärke.

Die Formation ist eine redaktionelle Spielanordnung. Sie behauptet nicht, dass
ein Verein historisch in jedem Spiel genau diese Formation benutzt hat. Die
normierten Koordinaten liegen zwischen 0 und 1; der eigene Torwart steht nahe y=1.
Die Spielengine muss Gewichte auf die zugewiesenen Slots anwenden, nicht allein
auf die Hauptpositionen der Karten.

## Identität und Doppelverwendung

Eine Person behält ihre ID über Vereine, Jahre und Rollen hinweg:

```text
personId: cristiano-ronaldo
Karte: manchester-united-2007-2008:cristiano-ronaldo
Karte: real-madrid-2016-2017:cristiano-ronaldo
```

Die Doppelauswahl-Sperre vergleicht `personId`, nicht die Karten-ID. Xabi Alonso
und Vincent Kompany können mit derselben Personen-ID als früherer Spieler und
späterer Trainer vorkommen. Alle 594 Karten-IDs aus Version 0.1.0 sind erhalten.

Jede Saisonkarte hat eine explizite Länder-/Verbandszuordnung. Im Personenprofil
sind die hier bekannten Zuordnungen als `nationalities` gespeichert; das ist kein
vollständiger Staatsangehörigkeitsnachweis. Heutige Profile dürfen die Vergangenheit
nicht überschreiben: Laportes Karten vor dem Verbandswechsel sind Frankreich
zugeordnet, Munirs damalige Barcelona-Karte Spanien. Auch diese Saisonangaben
benötigen noch eine vollständige Quellenprüfung.

`captainPersonId` benennt den ausgewählten Saison-Captain. Nur seine Karte trägt
`naturalCaptain: true`. Der Captain kann auf der Bank der Standardelf sitzen,
etwa Gary Neville 2007/08. Dann erhält die unveränderte Standardelf keinen
Natural-Captain-Bonus. Diese eindeutige V1-Zuordnung kann nach weiteren Belegen um
historische Stellvertreter erweitert werden.

## Individuelle Spielwerte

Jede Karte speichert `rating` und alle Attribute explizit. Der Generator übernimmt
sie unverändert. Es gibt keinen Zufall und keine erneute Berechnung der Werte
aus der Position beim Laden. Die im Ratingmodell erhaltenen Rollenoffsets dienten
der initialen Erstellung; sie sind keine Rechenvorschrift, die individuelle Werte
wieder überschreiben darf.

Pace, Abschluss, Passspiel, Dribbling, Defensive, Physis, Leadership und Torwartwert
sind eigene redaktionelle Spielbewertungen. Die Werte unterscheiden beispielsweise
Messis Dribbling, Pirlos Passspiel, Kantés Defensivarbeit und Neuers Spieleröffnung.
Sie sind keine importierten Messdaten oder EA/FIFA-Ratings. `goalkeeping` ist bei
Feldspielern null. `overall` entspricht dem festen Kartenrating.

`ratingStatus: approved` bezeichnet die redaktionelle Festlegung dieser eigenen
V1-Spielwerte. Es besagt nichts über die historische Quellenprüfung. Die tatsächliche
Wirkung auf Ziel-Siegchancen ist eine spätere Aufgabe der Simulationsengine.

## Abfragen

| Export aus `src/data/index.ts`                           | Zweck                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| `getDatabase()`                                          | Unabhängige Kopie des kompletten Pakets                                     |
| `findPrimeTeam(id)`                                      | Team samt gesamtem 18er-Kader                                               |
| `getDevelopmentTeams()`                                  | Alle erfassten Entwicklungskader; ungeprüfte Angaben bleiben gekennzeichnet |
| `getReleasedTeams()`                                     | Ausschließlich historisch freigegebene Kader; aktuell leer                  |
| `getDefaultLineup(teamId)`                               | Elf Karten in Slot-Reihenfolge                                              |
| `findPlayerCard(cardId)`                                 | Exakte Saisonkarte                                                          |
| `getPositionOptions(teamId, position, includeSecondary)` | Spieler für Haupt-/Nebenpositionen filtern                                  |
| `searchPrimeTeams({ year, clubId, query })`              | Filtern und akzentunabhängig suchen                                         |
| `isSamePlayer(a, b)`                                     | Dauerhafte Identitäten vergleichen                                          |
| `getGameRules()`                                         | Zentrale Spielkonfiguration                                                 |
| `getDefaultSettings()`                                   | Unabhängige Kopie der Einstellungen                                         |
| `getClubBadgePath(clubId, siteBase)`                     | Relative Monogrammpfade für GitHub Pages auflösen                           |
| `getDataReadiness()`                                     | Entwicklungsumfang und historische Freigabe getrennt auswerten              |

Die Datenabfragen liefern unabhängige Kopien; Änderungen einer UI verändern keine
gemeinsamen Ausgangsdaten. Die Abfragen erwarten den durch `data:check` technisch
validierten Export. Bilder benötigen keine externe Verbindung: Vereinsmonogramme
liegen lokal, Spielerporträts sind null und erlauben Initialen als Fallback.

## Datenverträge für den Rest der Anwendung

`src/types/application.ts` definiert Draft, SavedTeam, StrengthBreakdown,
TournamentParticipant, ScheduledMatch, MatchResult, LeagueTableRow, KnockoutTie,
TournamentState, HistoryEntry, UserSettings und AppState. Gespeicherte Teams und
Turnierteilnehmer halten Snapshots ihrer tatsächlich ausgewählten Karten samt
Datensatzversion. Spätere Ratingänderungen sollen alte Spielstände nicht umschreiben.

`afterExtraTime` ist ein kumulativer Spielstand nach 120 Minuten. Ein Elfmeterschießen
steht separat und darf nicht zu Ligatoren oder normalen Aggregattoren addiert werden.
Die Paarung verwendet Team-A-/Team-B-IDs, damit Heim-/Auswärtswechsel im Rückspiel
kein falsches Aggregatergebnis erzeugen.

`createInitialAppState()` aus `src/data/initial-state.ts` erzeugt einen leeren Zustand:
kein Team, kein Draft, kein Turnier und keine erfundene History. Die Speicherschlüssel
sind in der Spielkonfiguration versioniert. Einstellungen, aktiver Draft,
vollständige Teams und die laufende Ligaphase werden defensiv im Browser gespeichert.
Seit Version 0.8 umfasst der Turnierstand auch Playoffs, K.-o.-Runden und das
beendete Finale. Er führt eine eigene `knockoutVersion`; bei älteren bekannten
Liga-Spielständen darf dieses Feld bis zur ersten K.-o.-Auslosung fehlen.
Der Turnieradapter prüft eingebettete Kader und Matchstärken, die Auslosung des
Spielplans, Ergebnisse der gespielten Runden und die neu berechnete Tabelle.
Das Archiv mehrerer Turniere und weitere Formatmigrationen folgen in Etappe 8.
Der Draft-Adapter prüft Version,
Identitäten, Positionen und Vervollständigbarkeit. Team-Snapshots betten zusätzlich
Vereins-IDs pro Pick, Regelversion und berechnete Stärkewerte ein. Sie werden aus
ihren eigenen Karten validiert und nicht auf aktuelle Katalogratings umgeschrieben.
Details: [Team Builder](TEAM_BUILDER.md) und [Teamstärke](TEAMSTAERKE.md).
Zur laufenden Ligaphase: [Turnierablauf und Speicherung](LIGAPHASE.md).

## Pflege

1. Identitäten und Vereinsdaten in den redaktionellen Dateien bearbeiten. Bestehende
   IDs erhalten und keine zweite Person für einen Vereinswechsel anlegen.
2. Saisonkarten samt individuellen Attributen, Trainer und `startingXI` pflegen.
   Die elf Einträge von `startingXI` entsprechen den Slots der Formation.
3. Tatsächlich gelesene Referenzen mit Abrufdatum und bei Datensätzen Hash hinterlegen.
   Einzelne bestätigte Felder nicht als Nachweis für den ganzen Kader ausgeben.
4. Historische Prüfstatus erst nach den konkreten Belegen aktualisieren. Eigene
   Ratingfreigaben davon getrennt behandeln.
5. `npm run data:build`, `npm run check` und `npm run data:report` ausführen.

Der Generator überschreibt `src/data/database.json` und die eigenen Monogramme.
Diese Dateien deshalb nicht unabhängig von den Quellen pflegen. Schema 2 führt
18er-Kader, separate Standardelf, explizite Attribute und die Spielkonfiguration ein;
es ist eine bewusste Weiterentwicklung des anfänglichen Schema-1-Entwurfs.
