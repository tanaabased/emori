# Install

## What this example does

Installs and reconciles EMORI's checked-out workspace in an isolated OpenClaw
profile using her declared credentials. It runs host dependency setup, verifies
managed Git and GitHub identity, and checks intake activation. A repeat
installation checks host setup convergence, intake retention, and preservation
of private memory.

The `--yes` consent applies only to this isolated CI profile. Automatic cron
execution is disabled so registered schedules cannot start model turns during
installation checks.

## What it doesn't do

It skips agent setup, which belongs to [setup](../setup/README.md), and does not
exercise ongoing intake polling, feedback handling, model execution, or live
Google operations. Shared plugin reuse belongs to [shared](../shared/README.md).

## Setup

```bash
# should store EMORI's 1Password service account credential in the isolated profile
test -n "${OP_SERVICE_ACCOUNT_TOKEN:-}"
openclaw agent-system credentials set op --from-env

# should prepare EMORI's checked-out workspace
mkdir -p "$HOME/tanaab"
git clone --no-local "$GITHUB_WORKSPACE" "$HOME/tanaab/emori"

# should start the isolated gateway for session dispatch enrollment
openclaw config set cron.enabled false --strict-json
openclaw config set logging.consoleStyle '"json"' --strict-json
openclaw-gateway start --debug
```

## Testing

```bash
# should validate and install EMORI with host dependencies but without agent setup
set -euo pipefail
cd "$GITHUB_WORKSPACE"
test ! -e "$HOME/tanaab/canon"
test ! -e "$HOME/tanaab/openclaw-agent-system"
openclaw plugins list --json | jq -e 'all(.plugins[]; .id != "codex")'
openclaw agent-system validate --json | jq -e '.status == "valid" and all(.diagnostics[]; .code != "github-notification-runtime-unsupported")'
install_status=0
openclaw agent-system install --yes --skip-setup-agent --json | tee "${TMPDIR}/install.json" || install_status=$?
openclaw-gateway diagnostics --debug > "${TMPDIR}/first-install-gateway.log" 2>&1 || true
if gateway_log=$(openclaw-gateway log-path); then
  gateway_redactor="$(dirname "$(command -v openclaw-gateway)")/lib/redact-stream.mjs"
  if ! node "$gateway_redactor" < "$gateway_log" > "${TMPDIR}/first-install-gateway-full.log"; then
    printf 'Full Gateway trace unavailable\n' > "${TMPDIR}/first-install-gateway-full.log"
  fi
fi
test "$install_status" -eq 0
jq -e 'all(.warnings[]; .code != "github-notification-runtime-unsupported") and any(.outcomes[]; .component == "github-intake" and .code == "intake-activated" and .status == "updated")' "${TMPDIR}/install.json"
jq -e 'any(.outcomes[]; .component == "codex-plugin" and .code == "codex-plugin-installed" and .status == "created")' "${TMPDIR}/install.json"
jq -e '.outcomes | any(.component == "agent" and .status == "created")' "${TMPDIR}/install.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "workspace-memory"]' "${TMPDIR}/install.json"
test -d "$GITHUB_WORKSPACE/memory"
test -f "$GITHUB_WORKSPACE/MEMORY.md"
grep -Fx '# Memory' "$GITHUB_WORKSPACE/MEMORY.md"
printf '\nPreserved setup example note.\n' >> "$GITHUB_WORKSPACE/MEMORY.md"
cp "$GITHUB_WORKSPACE/MEMORY.md" "${TMPDIR}/memory-before-repeat.md"
gog --version
openclaw agents list --json | grep -F '"id": "emori"'
test ! -e "$HOME/tanaab/canon"
test ! -e "$HOME/tanaab/openclaw-agent-system"
```

```bash
# should leave EMORI's repeated installation converged
set -euo pipefail
cd "$GITHUB_WORKSPACE"
test -f "${TMPDIR}/memory-before-repeat.md"
openclaw agent-system install --yes --skip-setup-agent --json | tee "${TMPDIR}/reinstall.json"
jq -e 'all(.warnings[]; .code != "github-notification-runtime-unsupported") and any(.outcomes[]; .component == "github-intake" and .code == "intake-retained" and .status == "unchanged")' "${TMPDIR}/reinstall.json"
jq -e 'any(.outcomes[]; .component == "codex-plugin" and .code == "codex-plugin-unchanged" and .status == "unchanged")' "${TMPDIR}/reinstall.json"
jq -e '.outcomes | any(.component == "agent" and .status == "unchanged")' "${TMPDIR}/reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "workspace-memory"]' "${TMPDIR}/reinstall.json"
jq -e 'all(.outcomes[] | select(.component == "setup"); .status == "unchanged")' "${TMPDIR}/reinstall.json"
cmp "${TMPDIR}/memory-before-repeat.md" "$GITHUB_WORKSPACE/MEMORY.md"

# should use EMORI's managed git identity in her own workspace
cd "$GITHUB_WORKSPACE"
openclaw agent-system tool git --agent emori -- var GIT_AUTHOR_IDENT | grep -F 'EMORI <emori@tanaab.dev>'

# should use EMORI's installed GitHub credential
openclaw agent-system tool gh -- api user --jq .login | grep -Fx emoriwan

# should leave EMORI's checkout clean
git -C "$GITHUB_WORKSPACE" diff --exit-code
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
