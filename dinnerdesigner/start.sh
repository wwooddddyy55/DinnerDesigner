#!/bin/sh
set -e

# The sync backend runs as the unprivileged `nginx` user (created by the
# nginx base image), so it needs to own its persistent data directory.
mkdir -p /data
chown -R nginx:nginx /data

# Supervise the sync backend: if node ever exits unexpectedly, restart it
# instead of leaving nginx up with a dead /api/ (which every client would
# silently treat as "no backend").
(
  while true; do
    su-exec nginx node /app/server/index.js || true
    echo "DinnerDesigner sync API exited; restarting in 2s" >&2
    sleep 2
  done
) &

exec nginx -g 'daemon off;'
