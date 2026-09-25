# Setup

This scenario installs EMORI from her checked-out workspace in an isolated
OpenClaw profile and runs the currently verified setup prefix.

## Setup

```bash
# should store EMORI's 1Password service account credential in the isolated profile
test -n "${OP_SERVICE_ACCOUNT_TOKEN:-}"
openclaw agent-system credentials set op --from-env

# should prepare installation prerequisites not owned by setup
mkdir -p "$HOME/tanaab"
git clone --no-local "$GITHUB_WORKSPACE" "$HOME/tanaab/emori"
git clone https://github.com/tanaabased/openclaw-agent-system.git "$HOME/tanaab/openclaw-agent-system"
test -d "$HOME/tanaab/openclaw-agent-system/.git"
```

## Testing

```bash
# should start without setup effects and converge every declared concern
cd "$GITHUB_WORKSPACE"
test ! -e "$HOME/tanaab/canon"
! openclaw plugins inspect tanaab --json >/dev/null 2>&1
! openclaw plugins inspect codex --json >/dev/null 2>&1

# should run the verified setup prefix through Agent System
openclaw agent-system validate
openclaw agent-system install --json | tee "${TMPDIR}/setup-install.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "canon-checkout", "canon-plugin", "codex-plugin"]' "${TMPDIR}/setup-install.json"
jq -e '[.outcomes[] | select(.component == "setup") | .status] | all(. == "updated")' "${TMPDIR}/setup-install.json"

# should satisfy EMORI's Brewfile dependencies
HOMEBREW_NO_AUTO_UPDATE=1 brew bundle check --verbose --file "$GITHUB_WORKSPACE/Brewfile"

# should clone Canon over SSH and admit it with EMORI's managed Git identity
test -d "$HOME/tanaab/canon/.git"
cd "$HOME/tanaab/canon"
openclaw agent-system tool git --agent emori -- remote get-url origin | grep -Fx 'git@github.com:tanaabased/canon.git'
openclaw agent-system tool git --agent emori -- var GIT_AUTHOR_IDENT | grep -F 'EMORI <emori@tanaab.dev>'
cd "$GITHUB_WORKSPACE"

# should activate the Canon plugin
openclaw plugins inspect tanaab --json | jq -e '.plugin.id == "tanaab"'

# should install the Codex plugin
openclaw plugins inspect codex --json | jq -e '.plugin.id == "codex"'
```

```bash
# should leave a converged setup unchanged on repeat installation
cd "$GITHUB_WORKSPACE"
openclaw agent-system install --json | tee "${TMPDIR}/setup-reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "canon-checkout", "canon-plugin", "codex-plugin"]' "${TMPDIR}/setup-reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .status] | all(. == "unchanged")' "${TMPDIR}/setup-reinstall.json"

# should preserve EMORI's clean checkout
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
