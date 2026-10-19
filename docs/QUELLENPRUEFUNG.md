# Quellenprüfung und konkrete Zugriffssperren

Die gespeicherte Umgebungskonfiguration enthält bereits `en.wikipedia.org` und
`www.uefa.com`. Lesende Abrufe von Saison-/Finalreferenzen wurden in der laufenden
Instanz erneut mit Proxy-CONNECT HTTP 403 abgewiesen, einschließlich eines Versuchs
außerhalb der Dateisystem-Sandbox. Eine fehlende gespeicherte Domainfreigabe für
diese beiden Ziele wurde damit nicht festgestellt; der laufende Zugriff funktioniert
trotzdem nicht.

## Tatsächlich gelesene Referenzen

Die vollständig abgerufenen Dateien sind mit Commit, URL, Umfang und SHA-256 in
`data/research/source-audit.json` dokumentiert. Die großen Rohdateien werden nicht
mit dem Anwendungsdatensatz verteilt.

| Referenz | Tatsächlicher Prüfumfang |
| --- | --- |
| `salimt/football-datasets`, `team_competitions_seasons.csv`, Commit `da9227e…` | 56 exakte Übereinstimmungen von Trainername, Verein und Saison. Einzelheiten in `data/research/coach-audit.json`. Vier Einträge fehlen oder sind leer. |
| Gleiches Repository, `player_profiles.csv` | Ergänzende Recherche zu Namen, Positionen, aktuellen Vereinen und Beitrittsdaten jüngerer Spieler. Ein heutiges Profil ist kein vollständiger Nachweis früherer Saisonzugehörigkeit. |
| `brooksryan/arsenal-data`, `root.sqlite`, Commit `ce9591f…` | Sekundäre Recherche zur Saison 2025/26. Dessen Matchkader-Tabelle enthält nur Arsenal 2006/07 und wurde nicht als Nachweis aller ausgewählten Kader ausgegeben. |

Die vorgeschlagenen Wikipedia-Saisonlinks bleiben `not_retrieved`. Ihre bloße
Existenz im Register ist kein Quellenbeleg. Die Trainerprüfung setzt nur das konkret
bestätigte Coach-Saison-Feld auf `verified`; Personen, Mannschaften und Spielerkarten
werden dadurch nicht pauschal freigegeben. Eigene Ratings und Attribute werden nicht
als aus diesen Quellen übernommene Daten ausgegeben.

## Weitere beobachtete Blocker

Die großen öffentlichen Spielerleistungs- und Transferhistorien liegen in Git LFS.
Der normale lesende Git-Zugriff auf das Repository funktioniert. Der unterstützte
`git lfs pull` wurde jedoch mit **Resource not accessible by integration** abgewiesen.
Das ist kein Nachweis eines fehlenden persönlichen GitHub-Tokens; es wurde kein
Token angefordert oder aus der Plattformauthentifizierung extrahiert.

Direkte Abrufe der ausgelagerten Dateien wurden ebenfalls mit Proxy-403 abgewiesen:

- `media.githubusercontent.com` für die öffentlichen Git-LFS-CSV-Dateien;
- `pub-e682421888d945d684bcae8890b0ec20.r2.dev` für die öffentlichen Exporte des
  CC0-Projekts `dcaribou/transfermarkt-datasets`.

Die beiden zusätzlichen Domains wurden unter Erhalt der bestehenden Einträge im
Umgebungsentwurf gespeichert. Die Änderungen sind noch zu prüfen und zu speichern;
anschließend ist die Umgebung zu veröffentlichen. Das Speichern des Entwurfs allein
aktiviert keinen Zugriff. Nach einer tatsächlichen Laufzeitänderung müssen die
betroffenen Abrufe erneut geprüft werden. Die bestehenden Freigaben für Wikipedia
und UEFA sollen erhalten bleiben; ihr Laufzeitfehler ist weiterhin zu unterscheiden.

## Verbleibende historische Prüfung

1. Die ausgewählten Vereine und Bezugszeiträume prüfen. Die Auswahl ist redaktionell,
   keine extern belegte jährliche Top-3-Rangfolge.
2. Jeden Spieler im konkreten Saisonkader belegen. Ein heutiger Verein oder ein
   Aufenthalt in einem anderen Jahr reicht nicht.
3. Haupt-/Nebenpositionen und Saisonzuordnungen zum Land/Verband überprüfen.
4. Die vier noch nicht am Register bestätigten Trainer-Zuordnungen belegen.
5. Die tatsächlichen Saison-Captains prüfen; allgemeine Bekanntheit als Führungsspieler
   genügt für diesen historischen Status nicht.
6. Gelesene Referenzen dokumentieren, nur bestätigte Angaben auf `verified` setzen,
   Export erzeugen und technische Prüfungen wiederholen.

Die Freigabeprüfungen wurden nicht abgeschaltet. Bis zum Abschluss dieser Arbeiten
bleibt `getReleasedTeams()` leer, während `getDevelopmentTeams()` den vollständig
befüllten, ausdrücklich gekennzeichneten Entwicklungsbestand bereitstellt.
