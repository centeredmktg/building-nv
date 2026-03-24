#!/bin/sh
set -e
echo "=== Migrations ==="
npx prisma migrate deploy
echo "=== Starting Next.js on port ${PORT:-3000} ==="
exec node_modules/.bin/next start -p ${PORT:-3000} -H 0.0.0.0
