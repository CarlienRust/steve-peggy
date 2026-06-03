#!/usr/bin/env bash
# Download Qdrant binary for macOS (no Homebrew formula, no Docker required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_DIR="${ROOT}/tools/qdrant"
BIN="${INSTALL_DIR}/qdrant"
VERSION="${QDRANT_VERSION:-v1.18.1}"

arch="$(uname -m)"
case "$arch" in
  arm64|aarch64) ASSET="qdrant-aarch64-apple-darwin.tar.gz" ;;
  x86_64) ASSET="qdrant-x86_64-apple-darwin.tar.gz" ;;
  *)
    echo "Unsupported macOS arch: $arch"
    exit 1
    ;;
esac

if [[ -x "$BIN" ]]; then
  echo "Qdrant already installed: $BIN"
  "$BIN" --version 2>/dev/null || true
  exit 0
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer supports macOS only."
  echo "On Linux, use: https://qdrant.tech/documentation/guides/installation/"
  exit 1
fi

URL="https://github.com/qdrant/qdrant/releases/download/${VERSION}/${ASSET}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading Qdrant ${VERSION} (${ASSET})..."
curl -fsSL "$URL" -o "${TMP}/${ASSET}"
mkdir -p "$INSTALL_DIR"
tar -xzf "${TMP}/${ASSET}" -C "$INSTALL_DIR"
chmod +x "$BIN"

echo "Installed: $BIN"
"$BIN" --version 2>/dev/null || echo "Run: ./scripts/start-qdrant.sh"
