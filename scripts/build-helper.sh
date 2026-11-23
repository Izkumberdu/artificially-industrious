#!/bin/zsh
# Builds "Industrious Nudge.app" into ~/Applications (or $1).
# Needs the Xcode Command Line Tools: xcode-select --install
set -euo pipefail

here="${0:A:h}/../helper"
dest="${1:-$HOME/Applications}"
app="$dest/Industrious Nudge.app"

mkdir -p "$dest"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "$here/Info.plist" "$app/Contents/Info.plist"
# Icon source: helper/icon.png, drawn by scripts/make-icon.swift
cp "$here/AppIcon.icns" "$app/Contents/Resources/AppIcon.icns"
swiftc -O -o "$app/Contents/MacOS/IndustriousNudge" "$here/main.swift"

# Ad-hoc signature so macOS can remember the permission for this exact build.
# Rebuilding changes the signature, so you'll need to switch it on again.
codesign --force --sign - "$app"

# Tell Launch Services about this build so Notification Center and System
# Settings pick up the current icon instead of a cached blank one.
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$app"

echo "built: $app"
