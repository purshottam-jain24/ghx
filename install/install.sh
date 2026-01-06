#!/usr/bin/env bash
set -e

REPO="purshottam-jain24/ghx"
BASE_URL="https://github.com/$REPO/releases/latest/download"
# BASE_URL="http://192.168.1.8:8000/dist"
INSTALL_DIR="$HOME/.ghx/bin"
BINARY="$INSTALL_DIR/ghx"

OS="$(uname | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

if [[ "$OS" == "darwin" ]]; then
  BIN_NAME="ghx-tool-macos"
  # if [[ "$ARCH" == "arm64" ]]; then
  #   BIN_NAME="ghx-macos-arm64"
  # else
  #   BIN_NAME="ghx-macos-x64"
  # fi
else
  BIN_NAME="ghx-tool-linux"
fi

mkdir -p "$INSTALL_DIR"

echo "⬇️ Downloading GHX ($BIN_NAME)..."
if ! curl --progress-bar -fL "$BASE_URL/$BIN_NAME" -o "$BINARY"; then
    echo "❌ Download failed. Does '$BIN_NAME' exist in the GitHub Release?"
    exit 1
fi
chmod +x "$BINARY"

SHELL_CONFIG=""
case "$SHELL" in
  */zsh) SHELL_CONFIG="$HOME/.zshrc" ;;
  */bash) SHELL_CONFIG="$HOME/.bashrc" ;;
  *) SHELL_CONFIG="$HOME/.profile" ;;
esac

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    if [ -f "$SHELL_CONFIG" ]; then
        echo "🔧 Adding to PATH in $SHELL_CONFIG..."
        echo "" >> "$SHELL_CONFIG"
        echo "# ghx" >> "$SHELL_CONFIG"
        echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$SHELL_CONFIG"
        echo "✅ PATH updated. Please restart your terminal or run: source $SHELL_CONFIG"
    else
        echo "⚠️  Could not determine shell config. Please add this manually:"
        echo "   export PATH=\"\$PATH:$INSTALL_DIR\""
    fi
fi

if [[ "$OS" == "darwin" ]]; then
  xattr -d com.apple.quarantine "$BINARY" 2>/dev/null || true
fi

export PATH="$PATH:$INSTALL_DIR"

echo "✅ GHX installed!"
echo "🚀 Launching GHX..."

if [ -t 0 ]; then
    ghx
elif [ -e /dev/tty ]; then
    ghx < /dev/tty
else
    echo "⚠️  Cannot launch interactively (no TTY). Please run 'ghx' manually."
fi
if [ -e /dev/tty ]; then
    echo "🔄 Refreshing terminal session..."
    exec "${SHELL:-/bin/bash}" < /dev/tty
fi
