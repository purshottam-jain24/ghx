#!/usr/bin/env bash
set -e

REPO="purshottam-jain24/ghx"
BASE_URL="https://github.com/$REPO/releases/latest/download"
INSTALL_DIR="$HOME/.ghx/bin"
BINARY="$INSTALL_DIR/ghx"

OS="$(uname | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

if [[ "$OS" == "darwin" ]]; then
  if [[ "$ARCH" == "arm64" ]]; then
    BIN_NAME="ghx-macos-arm64"
  else
    BIN_NAME="ghx-macos-x64"
  fi
else
  BIN_NAME="ghx-linux"
fi

mkdir -p "$INSTALL_DIR"

echo "⬇️ Downloading GHX ($BIN_NAME)..."
curl -fsSL "$BASE_URL/$BIN_NAME" -o "$BINARY"
chmod +x "$BINARY"

if [[ "$OS" == "darwin" ]]; then
  xattr -d com.apple.quarantine "$BINARY" 2>/dev/null || true
fi

echo "✅ GHX installed!"
echo "🚀 Launching GHX..."
"$BINARY"
