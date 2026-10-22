# Etappe 11: Teamvergleich

Version 0.12 ergänzt den direkten Vergleich zweier Saisonmannschaften. Er ist
über **Teamvergleich** in der Navigation, den Teamkatalog und die Teamdetails
erreichbar. Alle 60 Mannschaften des Entwicklungskatalogs stehen zur Auswahl.

## Auswahl und Links

Ohne Auswahl zeigt der Vergleich AC Milan 2006/07 und Barcelona 2010/11.
Die beiden Auswahlfelder sind nach Verein und absteigendem Jahrgang sortiert.
**Teams tauschen** wechselt beide Seiten; dasselbe Team ist auf der jeweils
anderen Seite gesperrt. Verschiedene Saisons desselben Vereins sind erlaubt.

Die Auswahl wird als `left` und `right` im Hash-Link gespeichert, beispielsweise
`#/compare?left=milan-2006-2007&right=barcelona-2010-2011`. Die Adresse lässt sich
kopieren und teilen. Neuladen sowie Browser-Zurück und -Vor funktionieren mit
derselben Auswahl. Auch unmittelbar aufeinanderfolgende Auswahlaktionen erhalten
beide zuletzt gewählten Teams.

Ein Link aus den Teamdetails setzt das erste Team. Das zweite ist zunächst
Barcelona; ist Barcelona selbst das erste Team, wird Milan gewählt. Unbekannte,
leere oder doppelte IDs im Link zeigen eine Erklärung und keine Vergleichswerte
oder Spielaktion. Die Auswahlfelder und **Vergleich zurücksetzen** erlauben eine
Korrektur.

## Werte und Aufstellung

Beide Teams werden mit ihrer redaktionellen Standardelf und derselben
Standardtaktik **Ausgewogen** berechnet. Der Vergleich zeigt:

- das durchschnittliche Kartenrating der Standardelf;
- die Matchstärke und ihre Komponenten Basisstärke, Teamchemie, Taktik-Fit,
  Coach-Bonus und Captain-Bonus;
- die wirksamen Durchschnittswerte für Torwart, Abwehr, Mittelfeld und Angriff;
- Formation, Coach, Captain der Standardelf sowie beide Aufstellungen.

Unter jedem Spielfeld lässt sich die Standardelf als Liste mit vollständigen
Namen, Positionen und Kartenratings öffnen. Das funktioniert auch per Tastatur.

Höhere Werte sind hervorgehoben; die Zahlen werden mit zwei Nachkommastellen
angezeigt. Die Gruppenwerte berücksichtigen die Positionspassung. Das Kartenrating
ist ein eigener Wert und ersetzt nicht die positionsgewichtete Basisstärke.
Ein Captain außerhalb der Standardelf erhält keinen Bonus. Die Spielaufstellungen
sind redaktionell, keine Behauptung einer historischen Matchaufstellung.

`analyzePrimeTeam` in `src/engine/match-team.ts` enthält die gemeinsame
Aufbereitung von Standardelf, Coach und Captain für das bestehende Stärkemodell.
`primeMatchTeam` verwendet dieselbe Analyse für Testspiele und Turniergegner.
Die Vergleichsansicht fügt keine zweite Formel und keine neue Siegprognose hinzu.
Ein höherer Wert garantiert keinen Sieg. Die historische Datenfreigabe bleibt
separat offen.

## Die Paarung spielen

**Diese Paarung spielen** öffnet
`#/test-match?home=<erstes-team>&away=<zweites-team>`. Die Teams sind vorbelegt,
der Platz ist zunächst neutral und das Spiel startet erst nach **Anpfiff**.
Die gewählte Katalogpaarung hat Vorrang vor der üblichen Vorauswahl einer eigenen
gespeicherten Elf. Diese bleibt im Auswahlfeld weiterhin spielbar.

Neuladen des Paarungslinks übernimmt die Teams erneut; Spielcode, Modus,
Platzwahl und manuelle Änderungen im Testspielformular gelten weiterhin für die
geöffnete Sitzung. Ein Link mit einer anderen Paarung setzt die Sitzung zurück. Ungültige,
unvollständige oder doppelte Team-IDs im Testspiellink werden erklärt und erst
mit **Teams neu wählen** verlassen. Es wird keine Ersatzpaarung simuliert.

Vergleichen und Testspielen verändern weder Draft, gespeicherte Elf noch ein
laufendes Turnier oder die Historie. Für den Vergleich sind keine Schreibzugriffe
auf den Browserspeicher erforderlich. Backups und ältere Spielstände behalten ihr
Format.

## Prüfungen

```sh
npm run check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Die Node-Prüfung vergleicht für alle 60 Teams die komplette gemeinsame Analyse
mit unabhängig zusammengestellten Eingaben an das Stärkemodell. Zusätzliche
Fälle prüfen einen Captain außerhalb der Elf sowie fehlende Aufstellungsdaten.

Die Browsertests prüfen auf Desktop und Mobile Einstiege, Auswahl, Tauschen,
unmittelbare Folgeaktionen, URL und Verlauf, die dargestellten Werte und jeweils
elf echte Spieler, ungültige Links und die simulierten Ergebnisse der gewählten
Paarung. Ein vorhandener Spielstand bleibt bytegenau erhalten. Tastaturbedienung,
gesperrter Speicher, Breiten ab 320 Pixeln, lokale Bilder und axe-Prüfungen sind
ebenfalls abgedeckt. Die bestehenden Ansichts- und Navigationsprüfungen enthalten
die neue Seite. Die Build-Grenzen aus Etappe 10 gelten weiterhin.
