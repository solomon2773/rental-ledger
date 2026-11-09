#!/usr/bin/env bash
# Pull the latest code and rebuild/restart the stack. Run from anywhere on the host.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build --remove-orphans
docker compose -f deploy/docker-compose.yml --env-file deploy/.env ps
