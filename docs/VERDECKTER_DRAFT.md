# Verdeckter Team-Draft

Neue Runden beginnen mit einem einzelnen zufällig gezogenen Saisonteam. Die
Formation wird vor dem ersten bestätigten Pick gewählt. Der Spieler wählt eine
freie Position und eine passende Karte aus dem aktuellen Team. Die vorhandenen
Haupt-/Nebenpositionsregeln, Personenidentitäten und Stärkeberechnungen gelten
weiterhin. Ein Dialog bestätigt Spieler und Position; Abbrechen oder Escape
verändert weder den Draft noch das aktuelle Team.

Nach der Bestätigung bleiben Spieler und Position gesperrt. Auch ein
Formationswechsel darf diese Entscheidungen nicht verschieben oder entfernen.
Erst jetzt wird ein weiteres, noch nicht verwendetes Saisonteam gezogen. Nach
elf Picks endet die Teamziehung. Coach und Captain werden weiterhin separat
gewählt; Coach-Karten kommen ausschließlich aus bereits aufgedeckten Teams.
Bestätigte Teams erscheinen als nicht mehr auswählbare Historie.

`DraftState.mode = sequential` kennzeichnet diesen Ablauf. `drawnPrimeTeamIds`
enthält nur bestätigte Teams und das eine aktuelle Team, niemals einen künftigen
Pool. Die Picks stehen in Bestätigungsreihenfolge und müssen exakt zu den Teams
in dieser Historie passen. Der Zufallszug erfolgt bei Bedarf; die Suche prüft
dabei gegen die noch unbenutzten Katalogteams, dass ein aktueller Pick und eine
vollständige gültige Elf möglich bleiben. Unterschiedliche Saisons eines Vereins
sind weiterhin unterschiedliche Teams; dieselbe Person darf nur einmal vorkommen.

Die UI zeigt Fortschritt, aktuelle Karten und freie Positionen. Engine-Übergänge
weisen das Entfernen, Ersetzen und Umstellen bestätigter Picks zurück. Ein neuer
Draft braucht weiterhin eine Bestätigung und ersetzt ausschließlich den Draft;
eingebettete Team-, Turnier- und Archiv-Snapshots bleiben erhalten.

Reload, Navigation und Backup-Wiederherstellung behalten dieselbe aktuelle Runde
und dieselben gesperrten Picks. Ohne Schreibzugriff bleibt die Sitzung spielbar
und weist wie bisher auf fehlende dauerhafte Speicherung hin.

Vorhandene Pool-Drafts ohne `mode` behalten ihren bisherigen Ablauf. Neue Runden
werden ausschließlich mit `newDraft` verdeckt angelegt; `newPoolDraft` bleibt als
Kompatibilitätsgenerator für alte Integrationen und Prüfungen erhalten. Neue
gespeicherte Elfen tragen `draftMode = sequential` und elf Quellteams; bestehende
Snapshots mit zwölf Pool-Teams bleiben gültig. Match-, Stärke- und Turnierregeln
sowie der Katalogstand ändern sich dadurch nicht.

Die Prüfungen umfassen vollständige Runden in allen Formationen und verschiedene
Pick-Strategien, ungültige und fremde Karten, unveränderliche Picks, Fortschritt,
verdeckte Teams, Dialogabbruch, Reload, Tastatur, axe und mobile Breiten. Der
durchgehende Browserablauf erstellt eine neue Elf, beendet ihr Turnier und stellt
die heruntergeladene Sicherung in einem frischen Browser wieder her.

Am 24. Oktober 2026 bestanden `npm run check` mit 183 Tests, die zehn
Python-Quellenprüfungen und alle 160 Desktop-/Mobile-Browserprüfungen. Der
Veröffentlichungsworkflow kontrolliert zusätzlich auf der tatsächlichen Website,
dass ein neuer Draft nur ein Team zeigt, erst nach Bestätigung fortschreitet und
dieselbe Runde nach dem Neuladen erhält.
