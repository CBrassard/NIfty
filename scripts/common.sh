#!/usr/bin/env bash
# Shared setup for the build/install scripts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.local/tv.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing $ENV_FILE" >&2
    echo "Run: mkdir -p .local && cp tv.env.example .local/tv.env   then edit it." >&2
    exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

TIZEN_STUDIO="${TIZEN_STUDIO:-$HOME/tizen-studio}"
# Windows (Git Bash / MSYS): accept C:\tizen-studio or C:/tizen-studio.
if command -v cygpath >/dev/null 2>&1; then
    TIZEN_STUDIO="$(cygpath -u "$TIZEN_STUDIO")"
fi

# First existing file among the arguments, else empty.
first_file() {
    local f
    for f in "$@"; do [[ -f "$f" ]] && { echo "$f"; return; }; done
}
# On Windows the CLI is tizen.bat and sdb is sdb.exe.
TIZEN="$(first_file "$TIZEN_STUDIO/tools/ide/bin/tizen" "$TIZEN_STUDIO/tools/ide/bin/tizen.bat")"
SDB="$(first_file "$TIZEN_STUDIO/tools/sdb" "$TIZEN_STUDIO/tools/sdb.exe")"
[[ -n "$TIZEN" ]] || TIZEN="$(command -v tizen || command -v tizen.bat || true)"
[[ -n "$SDB" ]] || SDB="$(command -v sdb || command -v sdb.exe || true)"

need() {
    if [[ -z "${!1:-}" ]]; then echo "Set $1 in $ENV_FILE" >&2; exit 1; fi
}

DIST="$ROOT/dist"
WGT="$DIST/NIfty.wgt"
SERIAL="${TV_IP:-}:26101"
