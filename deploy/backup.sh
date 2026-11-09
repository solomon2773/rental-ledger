#!/usr/bin/env bash
# Snapshot the server's data volume (SQLite metadata + not-yet-committed uploads) to ./backups.
# The real ledger lives in Google Sheets/Drive; this only protects the app's own bookkeeping.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
stamp=$(date +%Y%m%d-%H%M%S)
docker run --rm -v rental-ledger_ledger-data:/data:ro -v "$PWD/backups":/backup alpine \
  tar czf "/backup/ledger-data-$stamp.tgz" -C /data .
echo "backups/ledger-data-$stamp.tgz"
