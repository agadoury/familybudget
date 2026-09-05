#!/bin/sh
# Build for Vercel. Migrations run only when a database is configured, so the very first
# deploy (before the Storage database exists) still succeeds and shows the setup page.
set -e
DB="${DATABASE_URL:-${POSTGRES_PRISMA_URL:-${POSTGRES_URL:-}}}"
DIRECT="${DIRECT_URL:-${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$DB}}}"
if [ -z "$DB" ]; then
  echo "------------------------------------------------------------------"
  echo " No DATABASE_URL yet: skipping migrations."
  echo " Add a Postgres database from the Vercel Storage tab, then redeploy."
  echo "------------------------------------------------------------------"
else
  echo "Running migrations..."
  DATABASE_URL="$DB" DIRECT_URL="$DIRECT" npx prisma migrate deploy
fi
npx next build
