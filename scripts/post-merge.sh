#!/bin/bash
set -e

npm install --legacy-peer-deps

if [ -f "server/db.ts" ]; then
  npm run db:push --force 2>/dev/null || true
fi
