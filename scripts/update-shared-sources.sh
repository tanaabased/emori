#!/usr/bin/env bash
set -eu

source "${BASH_SOURCE[0]%/*}/maintenance-report.sh"

git_launcher=${AGENT_SYSTEM_GIT:?}

update_source() {
  local name=$1 directory=$2
  local revision=— before= detail status rc=0

  if ! cd "$directory"; then
    printf '| %s | ❌ Failed | — | Checkout unavailable. |\n' "$name"
    return 1
  fi

  before=$("$git_launcher" rev-parse --short HEAD) || before=
  if "$git_launcher" pull --ff-only >&2; then
    revision=$("$git_launcher" rev-parse --short HEAD) || revision=—
    if [[ ! "$revision" =~ ^[0-9a-f]{7,64}$ ]]; then
      revision=—
    elif [[ "$before" =~ ^[0-9a-f]{7,64}$ && "$before" != "$revision" ]]; then
      revision="$before → $revision"
    fi
    if bun install --frozen-lockfile >&2; then
      detail='Dependencies installed.'
      if [ "$name" = 'Agent System' ]; then
        if bun run sync >&2; then
          detail="$detail Build/sync completed."
        else
          rc=$?
          detail="$detail Build/sync failed (exit $rc)."
        fi
      fi
    else
      rc=$?
      detail="Dependency install failed (exit $rc)."
    fi
  else
    rc=$?
    detail="Git pull failed (exit $rc)."
  fi

  status='✅ Complete'
  if [ "$rc" -ne 0 ]; then
    status='❌ Failed'
  fi
  printf '| %s | %s | %s | %s |\n' "$name" "$status" "$revision" "$detail"
  return "$rc"
}

result=0
canon=$(update_source Canon "$HOME/tanaab/canon") || result=$?
agent_system=$(update_source 'Agent System' "$HOME/tanaab/openclaw-agent-system") || result=$?
maintenance_report update-shared-sources 'UPDATE SOURCES' "$result" \
  '| Repository | Status | Revision | Result |' '| --- | --- | --- | --- |' \
  "$canon" "$agent_system" '' \
  'Running Gateway activation was not checked. No Gateway restart was performed.' || :
exit "$result"
