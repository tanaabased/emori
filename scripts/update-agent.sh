#!/usr/bin/env bash
set -eu

source "${BASH_SOURCE[0]%/*}/maintenance-report.sh"

result=0
step() {
  local label=$1 detail=$2
  shift 2
  if [ "$result" -ne 0 ]; then
    rows+=("| $label | — Not run | — |")
  elif "$@" >&2; then
    rows+=("| $label | ✅ Complete | $detail |")
  else
    result=$?
    rows+=("| $label | ❌ Failed | Exit $result |")
  fi
}

rows=()
step Repository 'Fast-forward-only pull completed.' "${AGENT_SYSTEM_GIT:?}" pull --ff-only
if [ "$result" -eq 0 ]; then
  revision=$("$AGENT_SYSTEM_GIT" rev-parse --short HEAD) || revision=unknown
  if [[ "$revision" =~ ^[0-9a-f]{7,64}$ ]]; then
    rows[0]="| Repository | ✅ Complete | $revision |"
  fi
fi
step Dependencies 'Frozen dependencies installed.' bun install --frozen-lockfile --ignore-scripts
step Install 'Configuration applied; setup skipped.' openclaw agent-system install --skip-setup

maintenance_report update-agent 'UPDATE AGENT' "$result" \
  '| Step | Status | Result |' '| --- | --- | --- |' "${rows[@]}" \
  '| Doctor | — Not run | Not part of this update. |' || :
exit "$result"
