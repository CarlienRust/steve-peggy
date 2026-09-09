# Shared Qdrant data directory resolution (source from other scripts).
# Keeps vector storage off iCloud Drive — WAL files fail there with Kind(WouldBlock).

peggy_qdrant_home() {
  if [[ -n "${PEGGY_QDRANT_DATA:-}" ]]; then
    printf '%s\n' "$PEGGY_QDRANT_DATA"
    return
  fi
  if [[ "$ROOT" == *"com~apple~CloudDocs"* || "$ROOT" == *"Mobile Documents"* ]]; then
    printf '%s\n' "${HOME}/.local/share/peggy-qdrant"
    return
  fi
  printf '%s\n' "${ROOT}/data/qdrant"
}
