# Agent System Example

This scenario installs Agent System from source in an isolated OpenClaw profile,
then validates and reconciles EMORI's checked-out workspace using her declared
credentials.

## Setup

```bash
# should store EMORI's 1Password service account credential in the isolated profile
test -n "${OP_SERVICE_ACCOUNT_TOKEN:-}"
openclaw agent-system credentials set op --from-env
```

## Testing

```bash
# should validate and install EMORI from the checked-out workspace
cd "$GITHUB_WORKSPACE"
openclaw agent-system validate
openclaw agent-system install --json | jq -e '.outcomes | any(.component == "agent" and .status == "created")'
openclaw agents list --json | grep -F '"id": "emori"'
```

```bash
# should leave EMORI's repeated installation converged
cd "$GITHUB_WORKSPACE"
openclaw agent-system install --json | jq -e '.outcomes | any(.component == "agent" and .status == "unchanged")'

# should allow only the Gateway-dependent notification access finding in CI
openclaw agent-system doctor --json > "$TMPDIR/doctor.json" || true
jq -e 'all(.findings[]; .status != "blocked" or .code == "github-operator-loaded-access-unverified")' "$TMPDIR/doctor.json"
openclaw agent-system tool gh -- api user --jq .login | grep -Fx emoriwan

# should leave EMORI's checkout clean
git -C "$GITHUB_WORKSPACE" diff --exit-code
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
