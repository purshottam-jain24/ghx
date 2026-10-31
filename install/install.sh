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
  # uname -m reports x86_64 under Rosetta, so also ask the hardware
  if [[ "$ARCH" == "arm64" ]] || [[ "$(sysctl -n hw.optional.arm64 2>/dev/null)" == "1" ]]; then
    BIN_NAME="ghx-tool-macos-arm64"
  else
    BIN_NAME="ghx-tool-macos"
  fi
else
  BIN_NAME="ghx-tool-linux"
fi

mkdir -p "$INSTALL_DIR"

TMP_BINARY="$(mktemp)"
trap 'rm -f "$TMP_BINARY"' EXIT

echo "⬇️ Downloading GHX ($BIN_NAME)..."
if ! curl --progress-bar -fL "$BASE_URL/$BIN_NAME" -o "$TMP_BINARY"; then
    echo "❌ Download failed. Does '$BIN_NAME' exist in the GitHub Release?"
    exit 1
fi

# Verify the download against the release's published SHA-256
EXPECTED="$(curl -fsSL "$BASE_URL/$BIN_NAME.sha256" 2>/dev/null | awk '{print $1}')"
if [[ -n "$EXPECTED" ]]; then
  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL="$(sha256sum "$TMP_BINARY" | awk '{print $1}')"
  else
    ACTUAL="$(shasum -a 256 "$TMP_BINARY" | awk '{print $1}')"
  fi
  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "❌ Checksum mismatch: the download may be corrupted or tampered with."
    echo "   expected $EXPECTED"
    echo "   got      $ACTUAL"
    exit 1
  fi
  echo "🔒 Checksum verified (SHA-256)."
else
  echo "⚠️  No checksum published for this release; skipping verification."
fi

mv "$TMP_BINARY" "$BINARY"
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
