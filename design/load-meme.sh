#!/bin/zsh
# Load a temporary meme schedule on the booted simulator. Saved planner records are untouched.
# Usage: zsh design/load-meme.sh <preset>|off [tomorrow] [YYYY-MM-DD]
# List all presets: zsh design/load-meme.sh --list
set -euo pipefail
ROOT=${0:A:h:h}
presets=$ROOT/apps/mobile/src/lib/meme-presets.json
mode=${1:-cooked}
python3 - "$presets" "$mode" <<'PY'
import json, sys
presets = json.load(open(sys.argv[1]))
modes = ['cooked', 'comeback', 'busy'] + [p['id'] for p in presets]
if sys.argv[2] == '--list':
    print('\n'.join(modes))
elif sys.argv[2] not in modes + ['off']:
    sys.exit('Unknown preset. Run design/load-meme.sh --list')
PY
[[ "$mode" = --list ]] && exit 0
view=${2:-today}
case "$mode:$view" in
  comeback:tomorrow|*:today) ;;
  *) print -u2 'The tomorrow view is available with: comeback tomorrow'; exit 1 ;;
esac
container=$(xcrun simctl get_app_container "${SIMULATOR_ID:-booted}" app.semli.mobile data)
python3 - "$container/Documents" "$mode" "$view" "${3:-}" <<'PY'
import json
import sys
from datetime import date
from pathlib import Path

folder, mode = Path(sys.argv[1]), sys.argv[2]
view = sys.argv[3]
folder.mkdir(parents=True, exist_ok=True)
backup = folder / 'dev-meme-backup.json'
names = ['dev-command.txt', 'dev-clock.txt']
if mode == 'off':
    if backup.exists():
        for name, text in json.loads(backup.read_text()).items():
            path = folder / name
            if text is None:
                path.unlink(missing_ok=True)
            else:
                path.write_text(text)
        backup.unlink()
else:
    if not backup.exists():
        backup.write_text(json.dumps({name: (folder / name).read_text() if (folder / name).exists() else None for name in names}))
    (folder / 'dev-command.txt').write_text(f'meme-{mode}' + ('-tomorrow' if view == 'tomorrow' else ''))
    day = date.fromisoformat(sys.argv[4]) if sys.argv[4] else date.today()
    (folder / 'dev-clock.txt').write_text(f'{day.isoformat()} 09:41')
PY
xcrun simctl terminate "${SIMULATOR_ID:-booted}" app.semli.mobile 2>/dev/null || true
xcrun simctl launch "${SIMULATOR_ID:-booted}" app.semli.mobile
print "Loaded $mode. Switch versions in You → Your data → Meme screenshots."
