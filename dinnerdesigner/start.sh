#!/bin/sh
set -e
node /app/server/index.js &
exec nginx -g 'daemon off;'
