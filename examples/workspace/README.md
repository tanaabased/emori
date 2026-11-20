# Workspace Registration Example

## What this example does

Registers this checkout as my workspace and imports the reviewed identity.
Checks the resulting configuration while preserving the identity file and a
clean checkout.

## What it doesn't do

Registration alone does not prove that I can run. This scenario configures no
model, starts no Gateway, and does not establish runtime skill loading or model
behavior. Static voice-skill validation belongs to the local
[development checks](../../README.md#development), installed Canon skill
availability to [setup](../setup/README.md), and credential installation to
[Agent System](https://github.com/tanaabased/openclaw-agent-system).

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
jq -e --arg workspace "$GITHUB_WORKSPACE" '
  .agentId == "emori" and .name == "EMORI" and .workspace == $workspace
' "${TMPDIR}/agent.json"
openclaw agents list --json | jq -e 'any(.[]; .id == "emori")'

# should report EMORI identity from the workspace
jq -e '.agentId == "emori" and .identity.name == "EMORI" and .identity.avatar == "avatars/emori.png"' "${TMPDIR}/identity.json"

# should validate the resulting OpenClaw configuration
openclaw config validate --json | jq -e '.valid == true'

# should preserve the reviewed identity file byte-for-byte
cmp -s "${TMPDIR}/IDENTITY.before.md" "$GITHUB_WORKSPACE/IDENTITY.md"

# should leave the repository worktree clean
set -e
status="$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
test -z "$status"
```
