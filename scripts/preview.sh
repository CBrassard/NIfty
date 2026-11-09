#!/usr/bin/env bash
# Opens the home screen in a desktop browser at http://localhost:4800/
# (no TV needed; uses a fake app list). Arrow keys, Enter, Esc = Back.
cd "$(dirname "$0")/../app" && exec python3 -m http.server "${PORT:-4800}"
