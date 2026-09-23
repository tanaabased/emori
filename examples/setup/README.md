# Setup

This scenario installs EMORI from her checked-out workspace in an isolated
OpenClaw profile and runs every declared operator setup group.

## Setup

```bash
# should store EMORI's 1Password service account credential in the isolated profile
test -n "${OP_SERVICE_ACCOUNT_TOKEN:-}"
openclaw agent-system credentials set op --from-env
```

## Testing

```bash
# should start without setup effects and converge every declared group
cd "$GITHUB_WORKSPACE"
test ! -e "$HOME/tanaab/canon"
! openclaw config get plugins.entries.tanaab --json >/dev/null 2>&1

# should run every setup group through Agent System
openclaw agent-system validate
openclaw agent-system install --json | tee "${TMPDIR}/setup-install.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["dependencies", "plugins", "configuration", "memory"]' "${TMPDIR}/setup-install.json"
jq -e '[.outcomes[] | select(.component == "setup") | .status] | all(. == "updated")' "${TMPDIR}/setup-install.json"

# should satisfy EMORI's Brewfile dependencies
HOMEBREW_NO_AUTO_UPDATE=1 brew bundle check --verbose --file "$GITHUB_WORKSPACE/Brewfile"

# should create the Canon checkout
test -d "$HOME/tanaab/canon/.git"

# should activate the Canon plugin
openclaw plugins inspect tanaab --json | jq -e '.plugin.id == "tanaab"'

# should install the Codex plugin
openclaw plugins inspect codex --json | jq -e '.plugin.id == "codex"'

# should install the iMessage plugin
openclaw plugins inspect imessage --json | jq -e '.plugin.id == "imessage"'

# should expose required bundled plugins
for id in openai browser memory-core active-memory; do
  openclaw plugins inspect "$id" --json | jq -e --arg id "$id" '.plugin.id == $id'
done

# should reconcile EMORI's owned configuration
openclaw config get agents.entries.emori.heartbeat.every --json | grep -Fx '"30m"'

# should initialize private memory without restoring it
test -f "$GITHUB_WORKSPACE/MEMORY.md"
openclaw config get plugins.entries.active-memory.config.enabled --json | grep -Fx 'true'
```

```bash
# should leave a converged setup unchanged on repeat installation
cd "$GITHUB_WORKSPACE"
openclaw agent-system install --json | tee "${TMPDIR}/setup-reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["dependencies", "plugins", "configuration", "memory"]' "${TMPDIR}/setup-reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .status] | all(. == "unchanged")' "${TMPDIR}/setup-reinstall.json"

# should preserve EMORI's clean checkout
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
