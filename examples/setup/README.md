# Setup

This scenario installs EMORI from her checked-out workspace in an isolated
OpenClaw profile and runs the currently verified setup prefix.

## Setup

```bash
# should store EMORI's 1Password service account credential in the isolated profile
test -n "${OP_SERVICE_ACCOUNT_TOKEN:-}"
openclaw agent-system credentials set op --from-env
```

## Testing

```bash
# should start without setup effects and converge every declared concern
cd "$GITHUB_WORKSPACE"
test ! -e "$HOME/tanaab/canon"

# should run the verified setup prefix through Agent System
openclaw agent-system validate
openclaw agent-system install --json | tee "${TMPDIR}/setup-install.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "canon-checkout"]' "${TMPDIR}/setup-install.json"
jq -e '[.outcomes[] | select(.component == "setup") | .status] | all(. == "updated")' "${TMPDIR}/setup-install.json"

# should satisfy EMORI's Brewfile dependencies
HOMEBREW_NO_AUTO_UPDATE=1 brew bundle check --verbose --file "$GITHUB_WORKSPACE/Brewfile"

# should create the Canon checkout
test -d "$HOME/tanaab/canon/.git"
```

```bash
# should leave a converged setup unchanged on repeat installation
cd "$GITHUB_WORKSPACE"
openclaw agent-system install --json | tee "${TMPDIR}/setup-reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "canon-checkout"]' "${TMPDIR}/setup-reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .status] | all(. == "unchanged")' "${TMPDIR}/setup-reinstall.json"

# should preserve EMORI's clean checkout
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
