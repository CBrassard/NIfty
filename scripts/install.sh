#!/usr/bin/env bash
# Connects to the TV, installs dist/NIfty.wgt and launches it.
# The TV must be in Developer Mode with this computer's IP as "Host PC IP".
source "$(dirname "$0")/common.sh"
need TV_IP; need TIZEN_APP_ID
[[ -f "$WGT" ]] || { echo "No $WGT yet. Run scripts/build.sh first." >&2; exit 1; }
[[ -n "$SDB" && -n "$TIZEN" ]] || { echo "sdb/tizen not found. Set TIZEN_STUDIO in .local/tv.env." >&2; exit 1; }

"$SDB" connect "$SERIAL"
if ! "$SDB" devices | grep -q "$SERIAL"; then
    echo "TV did not accept the connection. Check Developer Mode and Host PC IP." >&2
    exit 1
fi

OUT="$("$TIZEN" install -n "$(native_path "$WGT")" -s "$SERIAL" 2>&1 | tee /dev/stderr)"
if ! grep -qiE "install(ed|ing)? (completed|succeeded)|Installed the package" <<<"$OUT"; then
    # Some newer TVs only upload the file with `tizen install`. Ask the TV's
    # own installer to finish the job.
    echo "Falling back to vd_appinstall on the TV..." >&2
    REMOTE="/home/owner/share/tmp/sdk_tools/tmp/$(basename "$WGT")"
    "$SDB" -s "$SERIAL" push "$(native_path "$WGT")" "$REMOTE"
    OUT2="$("$SDB" -s "$SERIAL" shell 0 vd_appinstall "$TIZEN_APP_ID" "$REMOTE" 2>&1 | tee /dev/stderr)"
    grep -qi "install completed" <<<"$OUT2" || { echo "Install failed." >&2; exit 1; }
fi

"$TIZEN" run -p "$TIZEN_APP_ID" -s "$SERIAL"
echo "NIfty is running on the TV."
