#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")"
mkdir -p backups
docker compose stop app
trap 'docker compose start app' EXIT
tar -czf "backups/wandeng-$(date +%Y%m%d-%H%M%S).tar.gz" data
echo 'Backup saved under backups/. Keep it private.'
