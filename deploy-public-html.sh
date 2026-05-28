#!/usr/bin/env bash
set -euo pipefail

bun run build
rm -rf dist/public_html
mkdir -p dist/public_html
cp -R dist/client/. dist/public_html/

if [[ -f dist/public_html/index.html ]]; then
  cp dist/public_html/index.html dist/public_html/404.html
else
  echo "WARNING: index.html tidak ditemukan di dist/client (build TanStack Start saat ini belum menghasilkan HTML statis)." >&2
fi

echo "Bundle client tersedia di dist/public_html"
