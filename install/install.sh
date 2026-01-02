#!/usr/bin/env bash
set -e

REPO="purshottam-jain24/ghx"
BASE_URL="https://github.com/$REPO/releases/latest/download"
INSTALL_DIR="$HOME/.ghx/bin"
BINARY="$INSTALL_DIR/ghx"

OS="$(uname | tr '[:upper:]' '[:lower:]')"

if [[ "$OS" == "darwin" ]]; then
  BIN_NAME="ghx-macos"
else
  BIN_NAME="ghx-linux"
fi

mkdir -p "$INSTALL_DIR"

echo "⬇️ Downloading GHX..."
curl -fsSL "$BASE_URL/$BIN_NAME" -o "$BINARY"
chmod +x "$BINARY"

echo "✅ GHX installed!"
echo "🚀 Launching GHX..."
"$BINARY"
