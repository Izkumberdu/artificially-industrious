#!/bin/zsh
# Builds "Industrious Nudge.app" into ~/Applications (or $1).
# Needs the Xcode Command Line Tools: xcode-select --install
set -euo pipefail

here="${0:A:h}/../helper"
dest="${1:-$HOME/Applications}"
app="$dest/Industrious Nudge.app"

mkdir -p "$dest"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS"
cp "$here/Info.plist" "$app/Contents/Info.plist"
swiftc -O -o "$app/Contents/MacOS/IndustriousNudge" "$here/main.swift"

# Ad-hoc signature so macOS can remember the permission for this exact build.
# Rebuilding changes the signature, so you'll need to switch it on again.
codesign --force --sign - "$app"

echo "built: $app"
