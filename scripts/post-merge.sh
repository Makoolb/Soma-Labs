#!/bin/bash
set -e

npm install --legacy-peer-deps

rm -rf node_modules/expo-auth-session/node_modules/expo-web-browser

if [ -f "server/db.ts" ]; then
  npm run db:push --force 2>/dev/null || true
fi
