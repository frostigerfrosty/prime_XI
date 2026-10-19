# PRIME XI in der Cloud starten

Das vorhandene Checkout unter `/workspace/prime_XI` verwenden. Keinen zusätzlichen
Git-Worktree anlegen. Persönliche Änderungen erhalten.

Node.js 24 verwenden. Wenn Pakete fehlen oder das Lockfile geändert wurde:

```sh
cd /workspace/prime_XI
bash scripts/setup.sh
```

Das getestete Setup installiert über `npm ci --ignore-scripts` mit einem
beschreibbaren Cache unter `/workspace/.cache/prime-xi/npm` und prüft Daten,
TypeScript, Node-Tests sowie den Produktionsbuild. Keine Zugangsdaten nötig.

Für die Entwicklung im Repository einen laufenden Terminalprozess starten:

```sh
cd /workspace/prime_XI
npm run dev -- --host 127.0.0.1
```

Vite verwendet Port 5173 mit `strictPort`. Bei einem belegten Port zuerst den
vorhandenen Prozess prüfen und wiederverwenden, falls es dieselbe Anwendung ist.
Nur selbst gestartete Prozesse beenden. Prozesse überleben neue Cloud-Aufgaben
nicht zuverlässig und müssen gegebenenfalls neu gestartet werden.

Interne Bereitschaftsprüfung:

```sh
curl --fail --silent --show-error http://127.0.0.1:5173/prime_XI/
curl --fail --silent --show-error http://127.0.0.1:5173/prime_XI/src/main.tsx
```

Die erste Antwort muss die HTML-Seite mit `id="root"` und dem Verweis auf
`src/main.tsx` enthalten. Die zweite muss das transformierte React-Einstiegsmodul
enthalten. Für funktionelle Änderungen außerdem die betroffenen Seiten in Chromium
prüfen oder die vorhandenen Browsertests gegen den Produktionsbuild ausführen:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Dieser Befehl baut die Anwendung und startet selbst einen Preview-Server auf
Port 4173. Außerhalb dieser Cloud kann der Browserpfad entfallen, wenn zuvor
`npx playwright install chromium` ausgeführt wurde.

Keine nutzerseitigen Vorschau-Links auf localhost oder Loopback-Adressen erzeugen;
die Onboarding-Oberfläche unterstützt sie nicht. Lokale HTTP-Anfragen nur intern
zur Prüfung verwenden und Ergebnisse in Text berichten.

Die historische Katalogfreigabe ist weiterhin offen. `data:release-check` prüft
diesen separaten Inhaltsstatus; die Entwicklung verwendet ausdrücklich den
redaktionellen Katalog. Statusmarkierungen nicht zum Erzwingen einer Freigabe ändern.
