# Sicherheitsprüfung und Schutzmaßnahmen

Stand: 27. Oktober 2026. Geltungsbereich: statische React-Anwendung, lokale Spielstände,
JSON-Import/Export, geteilte Matchlinks, Katalogerzeugung und GitHub-Actions-Veröffentlichung.
Die Zuordnung nutzt OWASP Top 10 **2021** und konkrete CWE-Kategorien. Sie ist eine
nachvollziehbare technische Prüfung, keine Zertifizierung der vollständigen OWASP ASVS
und keine Garantie, dass jede mögliche CWE ausgeschlossen ist.

## Bedrohungsmodell

Spielstanddateien, URL-Parameter und Browser-Speicher sind nicht vertrauenswürdig.
Ein Angreifer könnte eine manipulierte Sicherung oder einen Link verschicken, lokale Daten
verändern oder eine Abhängigkeit bzw. veränderbare Action-Version kompromittieren.
Schutzgüter sind die Ausführung im Browser, Verfügbarkeit der Oberfläche, unveränderte
vorhandene Spielstände und die Integrität der Veröffentlichung.

Es gibt keinen eigenen Server, keine Anmeldung, keine Passwörter, keine Sitzungs-Tokens,
keine Datenbank und keine serverseitigen Uploads. SQL-Injection, serverseitige
Zugriffskontrollen, Session- und Passwortmanagement sind für diese Architektur daher
nicht implementiert und wurden nicht als geprüfte Backend-Funktionen ausgegeben.
Lokale Spielstände sind vom Gerätebesitzer editierbar: Plausibilitätsprüfung und
reproduzierbare Ergebnisse sind keine kryptographische Echtheitsgarantie und kein
Schutz für eine künftig öffentliche Rangliste.

## Befunde, Maßnahmen und Nachweise

| Bereich / OWASP 2021              | CWE                                | Maßnahme und Prüfung                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eingabeverarbeitung, A04/A08      | CWE-20, CWE-400, CWE-674, CWE-1321 | Gemeinsamer iterativer JSON-Preflight: Längenlimits vor JSON.parse, höchstens 32 Verschachtelungen, 250.000 Werte und 10.000 Einträge pro Sammlung. Nicht-endliche Zahlen und Prototype-Schlüssel werden abgelehnt, bevor rekursive Spielvalidierung oder Ergebniswiederholung beginnt. Backups und alle lokalen JSON-Lesewege verwenden ihn. Angriffstests prüfen tiefe/breite Daten, zusätzliche Felder und unveränderten Speicher bei Ablehnung. |
| Ausgabe und Skripte, A03/A05      | CWE-79, CWE-95                     | React-Textausgabe bleibt escaped. Keine raw-HTML-Sinks oder dynamische Codeausführung im Anwendungscode. Produktions-CSP blockiert Inline-Skripte, eval, fremde Verbindungen, Frames, Objekte, Form-Submits und manipulierte Basis-URLs. Browsertests prüfen tatsächliche Blockaden und einen gespeicherten HTML-Angriff im Teamnamen.                                                                                                              |
| SVG-Erzeugung, A03                | CWE-79, CWE-116                    | Namen werden XML-escaped; Farben vor Einbettung auf sechsstellige Hexwerte begrenzt. Build-Eingaben waren bereits schema-validiert; die zusätzliche Prüfung schützt direkte Aufrufer.                                                                                                                                                                                                                                                               |
| Matchlinks, A03/A04               | CWE-20, CWE-400                    | Bekannte Teams, unterschiedliche Gegner, Versionen, Modus und Code werden geprüft. Mehrdeutige Felder bleiben ungültig. Zusätzlich maximal 32 Parameter und 2.048 Zeichen der serialisierten Parameter. Bestehende Matchlink-Tests und neue Grenztests sichern das Verhalten.                                                                                                                                                                       |
| Datenintegrität, A08              | CWE-20, CWE-345                    | Bestehende fachliche Validierung von Aufstellungen, Regeln, Ergebniswiederholung und Archivstatistiken bleibt aktiv. Alte eingefrorene Teams werden nicht mit aktuellen Ratings überschrieben. Wiederherstellung erfolgt nach Vorschau, Bestätigung und erneuter Validierung als atomarer Snapshot. Die Grenzen der einzelnen Speicherkomponenten gelten auch beim Backup-Import.                                                                   |
| Abhängigkeiten, A06               | CWE-1104, CWE-1333                 | AJV 8.17.1 auf 8.20.0, fast-uri 3.1.8 auf 3.1.9 aktualisiert. Die gemeldeten Advisories betreffen Entwicklungswerkzeuge, die nicht im Browser ausgeliefert werden. AJVs verwundbare $data-Option wurde nicht verwendet. npm audit prüft trotzdem den gesamten Dependency-Baum; CI und Release brechen bereits bei bekannten niedrigen Schweregraden ab. Lockdatei und npm ci --ignore-scripts bleiben erhalten.                                     |
| Lieferkette, A05/A08              | CWE-829                            | Alle externen Workflow-Actions sind auf aus den offiziellen Git-Repositories aufgelöste vollständige Commit-SHAs fixiert. Standardtoken nur contents:read, Schreibrechte nur bei benötigten Deploy-/Berichts-/CodeQL-Jobs. Lesende Checkouts persistieren keine Git-Zugangsdaten. Zeitlimits begrenzen Jobs. Dependabot aktualisiert npm und Action-Pins wöchentlich über PRs.                                                                      |
| Browserkonfiguration, A05         | CWE-693                            | Produktionsbuild prüft CSP, Referrer-Policy und Abwesenheit von Inline-Skripten/-Styles. no-referrer reduziert Datenweitergabe bei externen Quellenlinks. Vite startet standardmäßig nur auf Loopback; Cloud-Vorschauen können --host ausdrücklich setzen.                                                                                                                                                                                          |
| Dauerhafte Prüfungen, A05/A06/A08 | CWE-1104, CWE-693                  | Lokaler AST-Regressionsschutz für gefährliche Sinks und Workflow-Pins; GitHub CodeQL mit security-extended für JavaScript/TypeScript und Python bei Push/PR und wöchentlich. CodeQL-Ergebnisse stehen unter Security → Code scanning. Das ist ergänzende Analyse, kein Vollständigkeitsbeweis.                                                                                                                                                      |

CodeQL fand bei der ersten Analyse außerdem einen vorhersehbaren temporären
Standardpfad im Website-Prüfskript (CWE-377). Der Standardbericht erhält jetzt ein
mit `mkdtemp` erstelltes, zufälliges und nur dem Benutzer zugängliches Verzeichnis.
Explizite CLI-Ausgabepfade bleiben für CI-Berichte möglich. Ein Test prüft Isolation
paralleler Aufrufe und die Verzeichnisrechte.

## Browserrichtlinie und Hostinggrenzen

Die CSP wird ausschließlich beim Produktionsbuild als frühes Meta-Element eingefügt;
Vites Entwicklungsmodus benötigt andere Möglichkeiten für Hot Reload und ist kein
Produktionsserver. Skripte, Stylesheets, Fonts, Bilder und Katalogabrufe stammen von der
eigenen Origin. Nur **Style-Attribute** sind erlaubt, weil React damit die numerisch
bestimmten Spielfeldpositionen setzt. Inline-Skriptattribute und Inline-Style-Blöcke
bleiben gesperrt. JSON-Dateidownloads über Blob-URLs bleiben möglich; Inhalte werden
nicht als HTML geöffnet. Der JavaScript-freie Hinweis nutzt bedingt geladenes, lokales CSS.

GitHub Pages erlaubt keine frei definierten HTTP-Sicherheitsheader. Insbesondere
**frame-ancestors** (Clickjacking-Schutz), X-Frame-Options, X-Content-Type-Options und
Permissions-Policy können nicht zuverlässig per Meta-Element ersetzt werden.
frame-src schützt vor geladenen Frames, nicht vor Einbettung dieser Seite in fremde Frames.
Für vollständige Header-Kontrolle ist ein Host bzw. vorgeschalteter Proxy nötig, der z.B.
Content-Security-Policy einschließlich frame-ancestors 'none', X-Content-Type-Options:
nosniff und eine passende Permissions-Policy als echte Response-Header setzt.
HTTPS muss auf GitHub Pages aktiviert bleiben. Keine unwirksamen _headers-Dateien oder
frame-ancestors-Meta-Direktiven werden als gelöster Schutz ausgegeben.

Die Origin frostigerfrosty.github.io wird mit anderen Pages-Projekten desselben Kontos
geteilt. CSP 'self' und localStorage trennen solche Projekte nicht gegeneinander.
Für Isolation gegenüber anderen eigenen Projekten wäre eine eigene Origin erforderlich.
Der lokale Speicher enthält ausschließlich Spielstände/Einstellungen, keine Geheimnisse.

## Wiederholbare Prüfungen

```sh
npm ci --ignore-scripts
npm run security:audit
npm run check
python3 -m unittest discover -s tests/research
npm run test:e2e
```

npm audit benötigt Netzwerkzugriff und ist eine Momentaufnahme bekannter Advisories.
Die Tests decken Angriffsregressionen, alte Spielstände, Sicherungen, Sprachwechsel,
Team Builder, Spiele und Turniere auf Desktop und Mobilgerät ab. Neue Funktionen mit
Accounts, Backend, Ranglisten oder Online-Multiplayer benötigen ein erweitertes
Bedrohungsmodell, serverseitige Autorisierung und eine erneute Sicherheitsprüfung.
