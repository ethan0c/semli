#!/bin/zsh
# Capture the raw App Store screenshots from the dev build on the booted iPhone 17 Pro Max
# simulator (Metro on 8081), one launch per shot, into design/screenshots/raw/. The steps are
# docs/launch-guide.md §2.3, scripted: reset the app, write the dev files, a plain launch, wait
# for Metro, open the deep link, screenshot. Then `python3 design/render-screenshots.py`.
#
#   design/capture-screenshots.sh            # every shot
#   design/capture-screenshots.sh plan share # some
#
# Look at every capture (the guide lists the quirks: a first launch after an install opens
# Expo's dev menu, a deep link right after launch can leave a grey overlay on the status bar).
set -e
ROOT=${0:A:h:h}
RAW=$ROOT/design/screenshots/raw
CLOCK="2026-10-19 09:41"
WAIT=${WAIT:-22}
mkdir -p "$RAW"
# name  dev-command  deep link (or -)
SHOTS=(
  "today sample -"
  "review-syllabus review-syllabus -"
  "review-update review-update -"
  "plan sample semli://plan"
  "share share -"
  "spread spread -"
  "today-hours hours -"
  "school sample semli://school"
  "item item -"
  "canvas sample semli://settings/canvas"
  # Outside the store set (render with --extras):
  "add sample semli://add"
  "review review -"
)
only=("$@")
xcrun simctl status_bar booted override --time 9:41 --batteryLevel 100 --cellularBars 4 --wifiBars 3 2>/dev/null || true
for row in $SHOTS; do
  set -- ${=row}
  name=$1; cmd=$2; link=$3
  if (( ${#only} )) && [[ ${only[(Ie)$name]} -eq 0 ]]; then continue; fi
  xcrun simctl terminate booted app.semli.mobile 2>/dev/null || true
  C=$(xcrun simctl get_app_container booted app.semli.mobile data)
  for d in Documents "Library/Application Support" Library/Preferences Library/Caches Library/HTTPStorages tmp; do
    [ -d "$C/$d" ] && find "$C/$d" -mindepth 1 -delete
  done
  mkdir -p "$C/Documents"
  print -n "$CLOCK" > "$C/Documents/dev-clock.txt"
  print -n "$cmd" > "$C/Documents/dev-command.txt"
  xcrun simctl launch booted app.semli.mobile > /dev/null
  sleep $WAIT
  if [ "$name" = spread ]; then
    # Its test fortnight loads on the first launch; the second shows the moment with the welcome cover gone.
    xcrun simctl terminate booted app.semli.mobile; sleep 1
    xcrun simctl launch booted app.semli.mobile > /dev/null; sleep 12
  fi
  if [ "$link" != "-" ]; then xcrun simctl openurl booted "$link"; sleep 5; fi
  xcrun simctl io booted screenshot "$RAW/$name.png" > /dev/null
  echo "captured $name"
done
