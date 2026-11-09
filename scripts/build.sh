#!/usr/bin/env bash
# Builds and signs dist/NIfty.wgt with your Samsung certificate profile.
source "$(dirname "$0")/common.sh"
need CERT_PROFILE; need TIZEN_PACKAGE_ID; need TIZEN_APP_ID
[[ -n "$TIZEN" ]] || { echo "Tizen CLI not found. Set TIZEN_STUDIO in .local/tv.env." >&2; exit 1; }

if [[ ! "$TIZEN_PACKAGE_ID" =~ ^[A-Za-z0-9]{10}$ ]]; then
    echo "TIZEN_PACKAGE_ID must be exactly 10 letters/digits." >&2; exit 1
fi
if [[ "$TIZEN_APP_ID" != "$TIZEN_PACKAGE_ID".* ]]; then
    echo "TIZEN_APP_ID must start with '$TIZEN_PACKAGE_ID.'" >&2; exit 1
fi

STAGE="$DIST/stage"
rm -rf "$STAGE" && mkdir -p "$STAGE"
cp -R "$ROOT/app/." "$STAGE/"

# Put your own IDs into the manifest.
sed -i.bak \
    -e "s|id=\"NIftyHome0.NIfty\"|id=\"$TIZEN_APP_ID\"|" \
    -e "s|package=\"NIftyHome0\"|package=\"$TIZEN_PACKAGE_ID\"|" \
    "$STAGE/config.xml"
rm -f "$STAGE/config.xml.bak"

"$TIZEN" build-web -- "$(native_path "$STAGE")"
"$TIZEN" package -t wgt -s "$CERT_PROFILE" -- "$(native_path "$STAGE/.buildResult")"

BUILT="$(ls -t "$STAGE/.buildResult"/*.wgt | head -n1)"
cp "$BUILT" "$WGT"
echo "Built $WGT"
