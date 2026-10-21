# Teamstärke, Boni und gespeicherte Elf — Version 0.5

Diese Etappe setzt Phase 4 der Master-Spezifikation um. Die Matchstärke ist ein
berechneter Eingangswert für die spätere Matchengine. Es werden noch keine Spiele
oder Siegwahrscheinlichkeiten simuliert. Die Regeln tragen Version `1.1.0` und
stehen zentral in `data/editorial/game-rules.json`.

## Basis und Positionspassung

```text
Wirksames Rating = Kartenrating × Positionsfaktor
Basis = Ø Torwart × 0,08 + Ø Abwehr × 0,27
      + Ø Mittelfeld × 0,30 + Ø Angriff × 0,35
```

Die Zuordnung erfolgt über den besetzten Formationsslot, nicht die Hauptposition
der Karte. Eine auf ST eingesetzte CM-Karte mit Nebenposition ST zählt zum Angriff.
Hauptpositionen haben Faktor 1, Nebenpositionen 0,95. Ungeeignete Positionen sind
unzulässig. Innerhalb jeder Positionsgruppe wird auf ihre tatsächlich besetzten
Slots normalisiert. Die Gruppen werden aus den gepflegten Positionsdaten gelesen;
die Berechnung unterstützt alle sieben Formationen.

Beispiel: Gruppenmittel 80 / 90 / 70 / 95 ergeben
`6,40 + 24,30 + 21,00 + 33,25 = 84,95` Basisstärke.

Für weniger als elf Spieler wird keine Basis- oder Matchstärke ausgegeben. Leere
Plätze werden nicht als erfundene Null-Rating-Spieler verwendet. Mit elf Spielern
sind bereits eine Vorschau und alle Positionsbeiträge sichtbar. Solange Coach
oder Captain fehlen, sind deren Boni null und der Stand als Vorschau gekennzeichnet.

## Begrenzte Boni

| Bestandteil | Formel                                                                                  | Obergrenze |
| ----------- | --------------------------------------------------------------------------------------- | ---------- |
| Chemie      | Gewichtete passende Spielerpaare / theoretisches Maximum × Chemiegrenze                 | +7         |
| Taktik      | Spieler mit mindestens einem passenden Stil-Tag / 11 × Taktikgrenze                     | +3         |
| Coach       | `(0,60 × Formationspassung + 0,40 × Stilabdeckung) × tacticalRating / 99 × Coachgrenze` | +2         |
| Captain     | Natural-Captain-Bonus nur für den gewählten Captain in der tatsächlichen Elf            | +2         |

Jedes ungeordnete Spielerpaar wird genau einmal geprüft. Gleiche Länder-/Verbandszuordnung
zählt mit Gewicht 1, gleiche Vereinsidentität mit 0,5. Verschiedene Saisonmannschaften
desselben Vereins verbinden sich deshalb ebenfalls. Für elf Spieler gibt es 55 Paare
und ein maximales Paargewicht von `55 × 1,5 = 82,5`. Beide Eigenschaften können für
dasselbe Paar zählen. Bei beiden Paargewichten null ist der Chemiebonus ebenfalls null.

Ein Spieler zählt beim Taktikbonus höchstens einmal, auch wenn mehrere Tags passen.
Die `preferredFormations` der Taktik bleiben Empfehlungen und erzeugen keinen
zusätzlichen, versteckten Bonus.

Beim Coach ist Formationspassung entweder 0 oder 1; die Stilabdeckung ist der Anteil
der Taktik-Tags, den der Coach besitzt. Das Coach-Rating wird durch `ratingMax`
normalisiert. Die oben genannten Zahlen kommen aus der aktuellen Konfiguration,
nicht aus verstreuten UI-Konstanten. Ein fehlender Coach ergibt null.

Ein weiterer Natural Captain auf dem Feld bringt keinen zusätzlichen Bonus. Ein
gewählter Captain ohne Natural-Captain-Flag ergibt null. Ein nicht aufgestellter
Captain wird abgewiesen. Leadership erzeugt keinen zusätzlichen, unerklärten Bonus.

```text
Matchstärke = Basis + Chemie + Taktik + Coach + Captain
```

Basis und einzelne Boni werden auf zwei Dezimalstellen gerundet, die Chemie auf
`chemistry.roundDecimals`. Der Gesamtwert ist die gerundete Summe dieser
ausgewiesenen Bestandteile. Gruppen- und Spieleranzeigen sind separat gerundet.
Kartenratings bleiben unverändert. Die Matchstärke wird nicht auf 99 begrenzt:
Die aktuelle theoretische Obergrenze ist `99 + 7 + 3 + 2 + 2 = 113`.

## Speicherung ohne nachträgliches Umschreiben

„Aufstellung speichern“ sichert jetzt zusätzlich zum Draft ein vollständiges
`SavedTeam` unter `rules.storage.keys.currentTeam`:

```ts
{ schemaVersion: 1, team: SavedTeam }
```

Das Team enthält Draft-ID und Pool, Datensatz- und Regelversion, Formation, Taktik,
Captain, Coach sowie Kopien aller elf Karten mit sämtlichen Attributen. Die
Vereinsidentität wird je Pick in `lineup[].clubId` eingebettet. Die sechs berechneten
Stärkewerte werden gemeinsam mit diesem Stand gespeichert.

Beim Laden werden die gespeicherten Karten verwendet. Spätere Änderungen an den
aktuellen Katalogratings oder eine neue Katalogversion ersetzen sie nicht. Struktur,
Positionen, Identitäten, Pool, Coach, Captain und Score werden anhand der eingebetteten
Daten und der bekannten Regelversion validiert. Ein Team mit unbekannter Regelversion
wird mit Hinweis zurückgewiesen und im Speicher erhalten; automatische Migrationen
zwischen künftigen Regelmodellen sind noch nicht implementiert.

Der aktive Draft bleibt unabhängig. Ein geänderter Captain, neue Taktik oder neuer
Draft verändern die letzte gespeicherte Elf erst beim erneuten expliziten Speichern.
Builder und Dashboard kennzeichnen diesen Unterschied. Schreibfehler behalten den
Sitzungsstand und behaupten keine dauerhafte Speicherung. Beschädigte Teamdaten
blockieren weder den Draft noch seine Bearbeitung und werden beim Lesen nicht gelöscht.

`currentTournament` und History werden nicht angelegt. Der Turnierstart bleibt bis
zur Umsetzung von Matchengine und Turniersystem gesperrt. Die historische Freigabe
des redaktionellen Entwicklungskatalogs bleibt ebenfalls unverändert offen.

## Module und Prüfung

- `src/engine/strength.ts`: reine Formeln, Validierung und nachvollziehbare Beiträge.
- `src/engine/saved-team.ts`: Erstellen, Prüfen und Vergleichen vollständiger Snapshots.
- `src/utils/team-storage.ts`: versionierter Browseradapter ohne Änderung anderer Schlüssel.
- `src/app/game.ts`: gemeinsame Konfiguration von Builder und Stärkemodell.
- `src/components/StrengthPanel.tsx`: Live-Werte, Grenzen, Gruppen und Positionsdetails.

Die Tests verwenden handgerechnete Gruppenwerte, bekannte Paarzahlen, sekundäre
Positionen, wechselnde Captains, Null-/Grenzwerte, ungültige Eingaben und unveränderte
Ausgangsdaten. Weitere Tests belegen Snapshots nach späteren Katalogänderungen,
Speicherfehler, Live-Neuberechnung, Neuladen, getrennte Draft-/Teamstände,
Tastaturbedienung, axe-Prüfungen und mobile Breiten.

Prüfstand: 81 Node-Tests bestanden. Produktionsbuild und 38 Chromium-Browsertests
decken Desktop und Mobile ab; die Stärkedarstellung wurde zusätzlich anhand von
Screenshots auf beiden Größen angesehen. Der bekannte Vite-Größenhinweis zum
vollständig eingebetteten JSON-Katalog bleibt bestehen (rund 170 KB gzip für den
Einstiegschunk). Die neue Etappe benötigt keine zusätzlichen Pakete oder Zugangsdaten.
