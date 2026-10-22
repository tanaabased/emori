# Workspace Registration Example

## What this example does

Registers the checked-out repository as EMORI's workspace and imports its
reviewed identity. It validates the resulting configuration while preserving the
identity file and clean checkout.

## What it doesn't do

It does not configure a model, start a Gateway, or prove runtime skill loading or
model behavior. Static voice-skill validation belongs to the local
[development checks](../../README.md#development). Installed Canon skill availability belongs to
[setup](../setup/README.md); credential installation belongs to
[install](../install/README.md).

## Setup

```bash
# should register the checked-out repository with lowercase machine id and reviewed display name
set -o pipefail
cp "$GITHUB_WORKSPACE/IDENTITY.md" "${TMPDIR}/IDENTITY.before.md"
openclaw agents add EMORI --workspace "$GITHUB_WORKSPACE" --non-interactive --json | tee "${TMPDIR}/agent.json"

# should import EMORI identity from the workspace
set -o pipefail
openclaw agents set-identity --agent emori --workspace "$GITHUB_WORKSPACE" --from-identity --json | tee "${TMPDIR}/identity.json"
```

## Testing

```bash
# should report the registered emori workspace and reviewed display name
grep -F '"agentId": "emori"' "${TMPDIR}/agent.json"
grep -F '"name": "EMORI"' "${TMPDIR}/agent.json"
grep -F "\"workspace\": \"$GITHUB_WORKSPACE\"" "${TMPDIR}/agent.json"
openclaw agents list --json | grep -F '"id": "emori"'

# should report EMORI identity from the workspace
grep -F '"name": "EMORI"' "${TMPDIR}/identity.json"
grep -F '"theme": "Sharp, evidence-led, dryly funny, and high-agency"' "${TMPDIR}/identity.json"
grep -F '"avatar": "avatars/emori.png"' "${TMPDIR}/identity.json"

# should validate the resulting OpenClaw configuration
openclaw config validate --json | tr -d '[:space:]' | grep -F '"valid":true'

# should preserve the reviewed identity file byte-for-byte
cmp -s "${TMPDIR}/IDENTITY.before.md" "$GITHUB_WORKSPACE/IDENTITY.md"

# should leave the repository worktree clean
git -C "$GITHUB_WORKSPACE" diff --exit-code
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
