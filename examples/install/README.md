# Install

This scenario installs Agent System from source in an isolated OpenClaw profile,
then validates and reconciles EMORI's checked-out workspace using her declared
credentials while explicitly skipping operator-run setup.

## Setup

```bash
# should store EMORI's 1Password service account credential in the isolated profile
test -n "${OP_SERVICE_ACCOUNT_TOKEN:-}"
openclaw agent-system credentials set op --from-env

# should prepare every declared local repository before Agent System installation
mkdir -p "$HOME/tanaab"
git clone --no-local "$GITHUB_WORKSPACE" "$HOME/tanaab/emori"
cd "$GITHUB_WORKSPACE"
openclaw agent-system tool git -- clone git@github.com:tanaabased/canon.git "$HOME/tanaab/canon"
openclaw agent-system tool git -- clone git@github.com:tanaabased/openclaw-agent-system.git "$HOME/tanaab/openclaw-agent-system"
test -d "$HOME/tanaab/canon/.git"
test -d "$HOME/tanaab/openclaw-agent-system/.git"
```

## Testing

```bash
# should validate and install EMORI without running setup
cd "$GITHUB_WORKSPACE"
openclaw agent-system validate
openclaw agent-system install --skip-setup --json | tee "${TMPDIR}/install.json"
jq -e '.outcomes | any(.component == "agent" and .status == "created")' "${TMPDIR}/install.json"
jq -e '.outcomes | all(.component != "setup")' "${TMPDIR}/install.json"
openclaw agents list --json | grep -F '"id": "emori"'

# should admit the declared Canon checkout with EMORI's managed Git identity
cd "$HOME/tanaab/canon"
openclaw agent-system tool git -- var GIT_AUTHOR_IDENT | grep -F 'EMORI <emori@tanaab.dev>'
```

```bash
# should leave EMORI's repeated installation converged
cd "$GITHUB_WORKSPACE"
openclaw agent-system install --skip-setup --json | tee "${TMPDIR}/reinstall.json"
jq -e '.outcomes | any(.component == "agent" and .status == "unchanged")' "${TMPDIR}/reinstall.json"
jq -e '.outcomes | all(.component != "setup")' "${TMPDIR}/reinstall.json"

# should use EMORI's installed GitHub credential
openclaw agent-system tool gh -- api user --jq .login | grep -Fx emoriwan

# should leave EMORI's checkout clean
git -C "$GITHUB_WORKSPACE" diff --exit-code
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
