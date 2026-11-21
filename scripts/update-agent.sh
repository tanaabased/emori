#!/usr/bin/env bash
set -euo pipefail

"${AGENT_SYSTEM_GIT:?}" pull --ff-only
bun install --frozen-lockfile --ignore-scripts
openclaw agent-system install --skip-setup
