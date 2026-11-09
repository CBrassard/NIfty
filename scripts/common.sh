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
TIZEN="$TIZEN_STUDIO/tools/ide/bin/tizen"
SDB="$TIZEN_STUDIO/tools/sdb"
[[ -x "$TIZEN" ]] || TIZEN="$(command -v tizen || true)"
[[ -x "$SDB" ]] || SDB="$(command -v sdb || true)"

need() {
    if [[ -z "${!1:-}" ]]; then echo "Set $1 in $ENV_FILE" >&2; exit 1; fi
}

DIST="$ROOT/dist"
WGT="$DIST/NIfty.wgt"
SERIAL="${TV_IP:-}:26101"
