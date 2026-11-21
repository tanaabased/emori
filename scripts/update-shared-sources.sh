#!/usr/bin/env bash
set -eu

git_launcher=${AGENT_SYSTEM_GIT:?}
result=0

printf 'Updating Canon\n'
(
  cd "$HOME/tanaab/canon" &&
  "$git_launcher" pull --ff-only &&
  bun install --frozen-lockfile
) || result=$?

printf 'Updating Agent System\n'
(
  cd "$HOME/tanaab/openclaw-agent-system" &&
  "$git_launcher" pull --ff-only &&
  bun install --frozen-lockfile &&
  bun run sync
) || result=$?

exit "$result"
