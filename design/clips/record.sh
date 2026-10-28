#!/bin/zsh
# Record one raw clip from the dev build on the booted simulator (iPhone 17 Pro Max, Metro on 8081).
#
#   design/clips/record.sh <name> <dev-command> <import|-> <step>...
#
#   steps, in order:  Ns            wait N seconds (tap through the app yourself in the meantime)
#                     link:URL      open a deep link (xcrun simctl openurl)
#
#   design/clips/record.sh shifts   demo   schedule  45s          # tap Add → the screenshot → review → add
#   design/clips/record.sh syllabus demo   syllabus  45s          # tap Add → A syllabus → review → add
#   design/clips/record.sh update   demo   update    40s
#   design/clips/record.sh today    list   -         8s link:semli://plan 8s
#   design/clips/record.sh plan     sample -         3s link:semli://plan 12s
#   design/clips/record.sh free     sample -         3s link:semli://paywall 16s   # prices load a few seconds after
#
# With `demo` the sample week is loaded and an import (dev-import.txt: schedule, update or
# syllabus) is answered from the samples, rows streaming in, with no API call; "A syllabus" skips
# the Files sheet and names the PDF. The taps are yours.
#
# The app is reset first (your simulator data goes; back it up if you care), the clock is pinned to
# Monday Oct 19 09:41, photo access is granted so no prompt shows, and the launch is a plain one,
# not the dev-client URL, so no dev toast shows. The first seconds are Metro serving the bundle
# (20 s or more on the first launch after an edit).
# Look at the strip in design/clips/stills/<name>.png and set the clip's `start` in compose.py
# from it. The simulator stops writing frames when the screen stops changing, so recordings end
# early; compose.py holds the last frame.
#
# Before the first shifts or update recording, put the two scheduling-app screenshots in the
# simulator's library: `python3 design/clips/fake-screenshot.py` then
# `xcrun simctl addmedia booted design/clips/shots/update.png design/clips/shots/next.png`
# (update first, so `next` is the newest).
set -e
ROOT=${0:A:h:h:h}
NAME=$1; CMD=$2; IMPORT=$3; shift 3
CLOCK="2026-10-19 09:41"
RAW=$ROOT/design/clips/raw; STILLS=$ROOT/design/clips/stills
mkdir -p "$RAW" "$STILLS"
xcrun simctl terminate booted app.semli.mobile 2>/dev/null || true
C=$(xcrun simctl get_app_container booted app.semli.mobile data)
for d in Documents "Library/Application Support" Library/Preferences Library/Caches Library/HTTPStorages tmp; do
  [ -d "$C/$d" ] && find "$C/$d" -mindepth 1 -delete
done
mkdir -p "$C/Documents"
print -n "$CLOCK" > "$C/Documents/dev-clock.txt"
print -n "$CMD" > "$C/Documents/dev-command.txt"
[ "$IMPORT" != "-" ] && print -n "$IMPORT" > "$C/Documents/dev-import.txt"
xcrun simctl privacy booted grant photos app.semli.mobile 2>/dev/null || true
xcrun simctl status_bar booted override --time 9:41 --batteryLevel 100 --cellularBars 4 --wifiBars 3 2>/dev/null || true
xcrun simctl io booted recordVideo --codec=h264 --force "$RAW/$NAME.mp4" > /dev/null 2>&1 &
REC=$!
# The recorder writes its index only when stopped with SIGINT: always stop it.
stop() { kill -INT $REC 2>/dev/null; wait $REC 2>/dev/null; }
trap stop EXIT
sleep 1
xcrun simctl launch booted app.semli.mobile > /dev/null
for step in "$@"; do
  case $step in
    *s) sleep "${step%s}" ;;
    link:*) xcrun simctl openurl booted "${step#link:}" ;;
  esac
done
stop
trap - EXIT
sleep 2
echo "$NAME $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$RAW/$NAME.mp4")s"
ffmpeg -v error -y -i "$RAW/$NAME.mp4" -vf "fps=1,scale=150:-1,tile=12x6" -frames:v 1 -update 1 "$STILLS/$NAME.png"
