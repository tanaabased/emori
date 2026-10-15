# Install

This scenario installs Agent System from source in an isolated OpenClaw profile,
then validates and reconciles EMORI's checked-out workspace using her declared
credentials while running host dependency setup and skipping agent setup.

The `--yes` consent applies only to this isolated CI profile. The desired issue
feedback policy remains configured but unsupported: validation must warn and
Install must skip notifications while completing unrelated setup. This does not
demonstrate live assignment, feedback, or assessment execution.

## Setup

```bash
# should store EMORI's 1Password service account credential in the isolated profile
test -n "${OP_SERVICE_ACCOUNT_TOKEN:-}"
openclaw agent-system credentials set op --from-env

# should prepare EMORI's checked-out workspace
mkdir -p "$HOME/tanaab"
git clone --no-local "$GITHUB_WORKSPACE" "$HOME/tanaab/emori"
```

## Testing

```bash
# should validate and install EMORI with host dependencies but without agent setup
cd "$GITHUB_WORKSPACE"
test ! -e "$HOME/tanaab/canon"
test ! -e "$HOME/tanaab/openclaw-agent-system"
openclaw plugins list --json | jq -e 'all(.plugins[]; .id != "codex")'
openclaw agent-system validate --json | jq -e '.status == "valid" and any(.diagnostics[]; .code == "github-notification-runtime-unsupported" and .severity == "warning" and (.message | contains("issue feedback")))'
openclaw agent-system install --yes --skip-setup-agent --json | tee "${TMPDIR}/install.json"
jq -e 'any(.warnings[]; .component == "github-notifications" and .code == "github-notification-runtime-unsupported" and (.message | contains("issue feedback"))) and any(.outcomes[]; .component == "github-notifications" and .status == "skipped") and all(.outcomes[]; .code != "intake-activated")' "${TMPDIR}/install.json"
jq -e '.outcomes[0].component == "codex-plugin" and .outcomes[0].code == "codex-plugin-installed" and .outcomes[0].status == "created" and .outcomes[1].stepId == "brew-dependencies"' "${TMPDIR}/install.json"
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
cd "$GITHUB_WORKSPACE"
openclaw agent-system install --yes --skip-setup-agent --json | tee "${TMPDIR}/reinstall.json"
jq -e 'any(.warnings[]; .component == "github-notifications" and .code == "github-notification-runtime-unsupported" and (.message | contains("issue feedback"))) and any(.outcomes[]; .component == "github-notifications" and .status == "skipped") and all(.outcomes[]; .code != "intake-activated")' "${TMPDIR}/reinstall.json"
jq -e '.outcomes[0].component == "codex-plugin" and .outcomes[0].code == "codex-plugin-unchanged" and .outcomes[0].status == "unchanged"' "${TMPDIR}/reinstall.json"
jq -e '.outcomes | any(.component == "agent" and .status == "unchanged")' "${TMPDIR}/reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "workspace-memory"]' "${TMPDIR}/reinstall.json"
jq -e '[.outcomes[] | select(.stepId == "brew-dependencies" or .stepId == "workspace-memory") | .status] == ["unchanged", "unchanged"]' "${TMPDIR}/reinstall.json"
cmp "${TMPDIR}/memory-before-repeat.md" "$GITHUB_WORKSPACE/MEMORY.md"

# should use EMORI's installed GitHub credential
openclaw agent-system tool gh -- api user --jq .login | grep -Fx emoriwan

# should leave EMORI's checkout clean
git -C "$GITHUB_WORKSPACE" diff --exit-code
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
