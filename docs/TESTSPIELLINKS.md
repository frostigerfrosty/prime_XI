# Etappe 12: Testspiele teilen und wiederholen

Version 0.13 ergänzt vollständige Testspiellinks. Unter **Diese Begegnung teilen**
kannst du den Link für zwei Katalogteams kopieren. Er enthält Heim- und Gastteam,
Spielmodus, Platzwahl und Spielcode sowie den verwendeten Katalog- und Regelstand.
Das funktioniert vor und nach dem Anpfiff. Der Link enthält keine gespeicherten
Teams, Turniere oder anderen persönlichen Spielstände.

## Öffnen und wiederholen

Ein Link belegt die Begegnung vor, simuliert aber kein Spiel automatisch.
Erst **Anpfiff** erzeugt das Ergebnis. Bei gleichem Katalog- und Regelstand werden
Tore, erwartete Tore, Verlängerung und gegebenenfalls alle Elfmeterschüsse identisch
wiederholt. Auch Sonderzeichen, Umlaute und Emoji im Spielcode werden korrekt
als URL-Parameter übertragen. Führende und abschließende Leerzeichen werden vor
der Simulation weiterhin entfernt.

Wenn das automatische Kopieren vom Browser verweigert wird oder die
Zwischenablage nicht verfügbar ist, wird der Link zum manuellen Kopieren markiert.
Eine Erfolgsmeldung erscheint nur nach erfolgreichem Kopieren. Änderst du die
Begegnung während eines ausstehenden Kopiervorgangs, kann eine spätere Antwort
keine Erfolgsmeldung für den neuen Link anzeigen.

## Auswahl, Eingabe und Verlauf

Jede Änderung am Formular ersetzt die aktuelle Testspiel-URL durch die komplette
Auswahl. Neuladen übernimmt Teams, Modus, Platz und Code erneut, zeigt zunächst
aber wieder **VS**. **Neuer Code** erzeugt einen neuen Code und erhält die übrigen
Einstellungen. Ohne Auswahl gelten weiterhin gespeicherte Elf oder Real Madrid
2016/17 als Heimteam und Barcelona 2010/11 als Gastteam; der erste Spielcode wird
für die Sitzung neu erzeugt. Nach dem ersten Anpfiff steht auch diese komplette
Auswahl in der URL.

Formulareingaben werden sofort übernommen, unabhängig von der verzögerten
Router-Aktualisierung. Das erhält Zeichen, Cursorposition und Fokus beim schnellen
Tippen und beim Einfügen mitten im Code. Unmittelbar aufeinanderfolgende
Team- und Moduswechsel erhalten alle zuletzt eingegebenen Werte. Die URL wird
ersetzt, damit einzelne Tastendrücke keine Verlaufseinträge erzeugen.

Andere Links sowie Browser-Zurück und -Vor initialisieren die jeweils gewählte
Begegnung neu. Ergebnisse und Kopiermeldungen einer vorherigen Auswahl erscheinen
dabei nicht erneut. Ein geänderter Spielcode oder eine andere Einstellung entfernt
das bisherige Ergebnis sofort.

Ein Code darf bis zu 100 Zeichen ohne Steuerzeichen enthalten. Während der Eingabe
bleibt auch ein leerer Code bearbeitbar und wird über die URL erhalten; ein leerer
oder nur aus Leerzeichen bestehender Code kann nicht gespielt oder geteilt werden.

## Gültigkeit und Kompatibilität

Der Hash-Link verwendet diese Parameter:

| Parameter      | Inhalt                                |
| -------------- | ------------------------------------- |
| `v`            | Linkformat, aktuell `1`               |
| `home`, `away` | Zwei verschiedene verfügbare Team-IDs |
| `mode`         | `regular` oder `knockout`             |
| `neutral`      | `1` für neutralen Platz, sonst `0`    |
| `seed`         | Spielcode                             |
| `dataset`      | Katalogversion                        |
| `engine`       | Matchengine-Version                   |
| `strength`     | Stärkemodell-Version                  |

Alle Felder eines versionierten Links müssen vorhanden und eindeutig sein.
Fehlende Teams, doppelte Teilnehmer, doppelte Parameter, unbekannte Formate,
ungültige Einstellungen, zu lange Codes und Steuerzeichen führen zu einer
Erklärung mit **Teams neu wählen**. Eine Ersatzpaarung wird nicht gespielt.

Ein abweichender Katalog- oder Regelstand wird ausdrücklich abgelehnt: Eine neue
Version darf kein möglicherweise anderes Ergebnis als Wiederholung ausgeben.
Versionen müssen deshalb bei Änderungen an Daten oder Simulationsregeln weiterhin
gepflegt werden. Die reine Matchengine und ihre bestehenden Zufallsströme wurden
in dieser Etappe nicht verändert.

Die alten Links aus Etappe 11 mit ausschließlich `home` und `away` funktionieren
weiterhin. Sie verwenden einen neuen Spielcode sowie den regulären Modus auf
neutralem Platz. Nach einer Änderung oder dem Anpfiff ist die URL vollständig.

## Eigene Elf und Spielstände

Begegnungen mit der eigenen gespeicherten Elf behalten ihre Auswahl im selben
Browser ebenfalls über die URL. Eine solche URL benötigt die passende Elf im
lokalen Spielstand und wird nicht als teilbarer Kataloglink angeboten. Die
Oberfläche verweist stattdessen auf die Spielstandsicherung unter **Einstellungen**.
Ohne die passende Elf wird der Link erklärt und keine andere Mannschaft eingesetzt.
Die URL enthält keine Spieler- oder Stärkesnapshots der eigenen Elf. Nach erneutem
Speichern gelten deren zuletzt gespeicherte Werte; einen früheren Stand erhältst
du über die entsprechende Sicherungsdatei.

Testspiele und Linkfunktionen verändern weder Draft, Elf, laufendes Turnier,
Archiv noch Einstellungen. Es gibt keine zusätzlichen Local-Storage-Einträge und
keine Änderung am Backupformat. Gesperrter Speicher verhindert das Spielen und
Teilen von Katalogbegegnungen nicht. Die historische Kaderfreigabe bleibt offen;
die Anwendung verwendet weiterhin den gekennzeichneten Entwicklungskatalog.

## Prüfungen

```sh
npm run check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Node-Tests prüfen Parser und Serialisierung, beide Modi und Platzvarianten,
Sonderzeichen, Grenzfälle und Versionskonflikte sowie identische Ergebnisse nach
dem Link-Rundlauf. Die Browsertests prüfen Desktop und Mobile: Neuladen und
Wiederholung im zweiten Tab, Elfmeterschießen, reale Texteingabe samt Cursor,
schnelle Folgeaktionen und Verlauf, Kopiererfolg und manuelles Kopieren,
verspätete Zwischenablageantworten, ungültige Links und die lokale eigene Elf.
Ein vollständiger bestehender Spielstand bleibt bytegenau erhalten. Axe-Prüfungen,
Tastaturfokus, Breiten ab 320 Pixeln und gesperrter Speicher sind abgedeckt.
