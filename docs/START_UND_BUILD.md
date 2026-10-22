# Etappe 10: Start und statische Auslieferung

Version 0.11 lädt den Katalog als separate, mit einem Inhaltshash benannte
JSON-Datei. Zuvor steckten die Daten in einem JavaScript-Chunk mit rund 792 kB.
Der Browser muss sie jetzt nicht mehr als JavaScript parsen. Die Daten selbst,
Filter und Spielregeln bleiben identisch; vor jedem Build werden sie vollständig
gegen die redaktionelle Quelle geprüft.

## Startverhalten

Die HTML-Seite enthält bereits eine Ladeanzeige. React übernimmt sie, während
Anwendung und Katalog laden. Der Katalog wird einmal beim Start geholt und bei
der Navigation weiterverwendet. Die Anfrage bricht nach 15 Sekunden ab.
HTTP-Fehler, ungültiges JSON und ein inkompatibles Grundformat führen zu einer
Fehleranzeige mit **Erneut laden**. Auch ein fehlender Anwendungs-Chunk wird dort
abgefangen. Ohne JavaScript erklärt die statische Seite die Voraussetzung.

Die Daten werden geladen, bevor die Spielstand-Provider starten. Ein fehlender
Katalog kann deshalb keine bestehenden Spielstände durch einen leeren Zustand
ersetzen. Ein erfolgreicher Reload verwendet wieder den bisherigen Spielstand.
Dies ist keine Offline-Funktion; ein erster Start benötigt die statischen Dateien
vom Server. Eine erneute Installation oder ein Backend ist nicht erforderlich.

`src/data/access.ts` stellt die bisherigen Abfragen aus einem übergebenen
`Database`-Objekt bereit. Vite ersetzt Browser-Importe von `src/data/index.ts`
durch `src/data/browser.ts`, das den Katalog zuerst lädt. Node-Tests und
Wartungsskripte verwenden weiterhin die synchrone API von `src/data/index.ts`.

## Build-Prüfung

```sh
npm run check
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

`build` umfasst Datenprüfung, TypeScript, Vite und `build:check`.
`scripts/check-build.mjs` prüft das erzeugte Manifest und die Dateien:

- initial geladene JavaScript-Dateien zusammen höchstens 300 KiB bzw. 90 KiB gzip;
- jede einzelne JavaScript-Datei höchstens 400 KiB;
- Katalog als separate JSON-Datei mit unverändertem Inhalt;
- vorhandene HTML-Assets unter der konfigurierten URL-Basis;
- statische Ladeanzeige, JavaScript-Hinweis und `.nojekyll` für statisches Hosting.

Im geprüften Standardbuild umfasst der initiale statische JavaScript-Importbaum
rund **218 KiB bzw. 68 KiB gzip**. Das ist keine Messung der gesamten Übertragung:
nachgeladene Ansichten, JSON, CSS, Schriften und Bilder kommen hinzu. Der separate
Katalog hat rund 1,37 MB unkomprimiert bzw. 96 kB gzip. Die tatsächliche
Komprimierung hängt vom Server ab. Die bisherige Vite-Chunkwarnung tritt nicht
mehr auf; die Warngrenze wurde nicht angehoben.

Die zusätzlichen Tests prüfen langsames Laden, fehlende Anwendungs- und
Katalogdateien, defektes JSON, Reload mit erhaltenem Spielstand sowie den Hinweis
ohne JavaScript auf Desktop und Mobile. Die bestehenden Ansichtsprüfungen warten
auf den jeweiligen Seitentitel, bevor sie Schriften und Barrierefreiheit prüfen.

## Andere URL-Basis prüfen

Standard ist `/prime_XI/`. Für ein anderes Unterverzeichnis muss dieselbe Basis
bei Build, Prüfung und Vorschau verwendet werden:

```sh
VITE_BASE_PATH=/static-preview/ npx vite build --outDir /tmp/prime-xi-stage10-custom
VITE_BASE_PATH=/static-preview/ node scripts/check-build.mjs /tmp/prime-xi-stage10-custom
VITE_BASE_PATH=/static-preview/ npm run preview -- --host 127.0.0.1 --port 4273 --outDir /tmp/prime-xi-stage10-custom
```

Dieser zusätzliche Build wurde samt Katalog, Teamdetail und Neuladen unter dem
anderen Unterpfad in Chromium geprüft. Für reguläre Builds `npm run build`
verwenden, damit auch Daten und TypeScript geprüft werden.

## Manuelle GitHub-Pages-Vorschau

Der bestehende CI-Workflow führt nach einem Push die technischen Prüfungen aus
und legt anschließend `dist/` als Artefakt `prime-xi-static-build` für sieben Tage
ab. Dieses Artefakt enthält auch die versteckten Build-Dateien.

`.github/workflows/pages.yml` wird ausschließlich manuell gestartet. Er prüft
Node-Tests und sämtliche Desktop-/Mobile-Browsertests, baut die Anwendung und
übergibt erst danach das Ergebnis an GitHub Pages.

1. Im Repository unter **Settings → Pages → Build and deployment** als Quelle
   **GitHub Actions** auswählen.
2. Unter **Actions → Publish PRIME XI preview → Run workflow** den gewünschten
   Stand von `main` auswählen und starten.
3. Die erfolgreiche Bereitstellung und ihre URL in der Umgebung **github-pages**
   prüfen. Direkte Ansichtslinks verwenden weiterhin Hash-Routing.

Dieser Workflow wurde vorbereitet, aber nicht gestartet. Es wurde keine Website
veröffentlicht. Die Vorschau verwendet ausdrücklich den Entwicklungskatalog;
die historische Kaderfreigabe bleibt offen. `data:release-check` ist weiterhin
die separate Inhaltsprüfung und wird durch eine technische Bereitstellung
nicht umgangen.
