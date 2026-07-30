# Workspace Registration Example

This scenario verifies that OpenClaw can register the checked-out EMORI repository as an agent workspace and import her identity without configuring a model or starting a Gateway.

## Setup

```bash
# should register the checked-out repository as the emori workspace
set -o pipefail
openclaw agents add emori --workspace "$GITHUB_WORKSPACE" --non-interactive --json | tee "$TMPDIR/agent.json"

# should import EMORI identity from the workspace
set -o pipefail
openclaw agents set-identity --agent emori --workspace "$GITHUB_WORKSPACE" --from-identity --json | tee "$TMPDIR/identity.json"
```

## Testing

```bash
# should report the registered emori workspace
grep -F '"agentId": "emori"' "$TMPDIR/agent.json"
grep -F "\"workspace\": \"$GITHUB_WORKSPACE\"" "$TMPDIR/agent.json"
openclaw agents list --json | grep -F '"id": "emori"'

# should report EMORI identity from the workspace
grep -F '"name": "EMORI"' "$TMPDIR/identity.json"
grep -F '"theme": "Sharp, evidence-led, dryly funny, and high-agency"' "$TMPDIR/identity.json"
grep -F '"avatar": "avatars/emori.png"' "$TMPDIR/identity.json"

# should validate the resulting OpenClaw configuration
openclaw config validate --json | tr -d '[:space:]' | grep -F '"valid":true'

# should leave the repository worktree clean
git -C "$GITHUB_WORKSPACE" diff --exit-code
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
