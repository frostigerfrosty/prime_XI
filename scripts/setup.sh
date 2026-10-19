#!/usr/bin/env bash
set -euo pipefail

cd /workspace/prime_XI
node -e 'if (Number(process.versions.node.split(".")[0]) < 24) { console.error("PRIME XI requires Node.js 24 or newer."); process.exit(1); }'
npm ci --ignore-scripts --no-audit --no-fund --cache /workspace/.cache/prime-xi/npm
npm run check
npm run build
