#!/bin/bash
set -e

npm install
npm run build

echo "Build complete. Run with: node dist/cli.js"
