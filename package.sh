#!/bin/sh
# Builds the zip to upload to the Chrome Web Store (extension files only, no demo/).
set -e
cd "$(dirname "$0")"
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
mkdir -p dist
OUT="dist/sleepytube-$VERSION.zip"
rm -f "$OUT"
zip -qr "$OUT" manifest.json settings.js content.js popup.html popup.css popup.js icons.js icons
echo "Built $OUT"
