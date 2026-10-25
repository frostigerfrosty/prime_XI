# Deutsch, Englisch und Italienisch

Unter **Einstellungen → Sprache** stehen Deutsch, English und Italiano zur Wahl.
Deutsch bleibt der Standard. Die gewählte Sprache wird im Browser gespeichert
und in die Spielstandsicherung aufgenommen. Nach einer Wiederherstellung wird
auch die Sprache der Sicherung wiederhergestellt.

Navigation, Katalog, Draft, Teamvergleich, Ratings, Testspiele, Turniere, Archive,
Dialoge, Zugänglichkeitsbeschriftungen und Fehlermeldungen verwenden zentrale
Sprachkataloge. Namen, IDs, Formationen, Spielcodes und Ergebnisse werden nicht
umgeschrieben. Zahlen und Datumsanzeigen verwenden das passende Gebietsschema.

Die Implementierung in `src/i18n/` verwendet deutsche Ausgangstexte als stabile
Nachrichtenschlüssel und Platzhalter für dynamische Angaben. React rendert die
Übersetzungen als Text; es werden keine nachträglichen DOM-Umschreibungen oder
HTML-Übersetzungen eingesetzt. Die beiden zusätzlichen Sprachpakete werden erst
bei Bedarf geladen und halten den deutschen Erststart klein.

Der letzte Sprachwunsch gewinnt auch bei unterschiedlich schnell geladenen Paketen.
Ein Ladefehler bleibt sichtbar. Bei blockiertem Browserspeicher funktioniert die
Auswahl für die Sitzung und meldet die fehlende dauerhafte Speicherung.

`npm run translations:check` prüft identische Schlüssel, vollständige Platzhalter
und statische UI-Nachrichten. Die Browserprüfungen wechseln die Sprache während
eines bestätigten Drafts und während eines laufenden Turniers, laden erneut,
stellen eine Sicherung wieder her und prüfen Tastatur, axe und mobile Breiten.
