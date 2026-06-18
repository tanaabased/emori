# OpenClaw Example

This example keeps coverage on the OpenClaw bootstrap contract that runs after `boot.sh` applies
the `emori` Brewfile and dotpkgs. It uses CI non-interactive mode with OpenClaw's API-key auth ref
flow and verifies the installed app, CLI, generated state, and running gateway.

This scenario is intended to run in CI by default. Do not run it locally unless the task explicitly
calls for a local Leia run.

## Setup

```bash
# should remove a core formula first
brew uninstall --formula --force stow || true

# should prepare the default ssh target directory
mkdir -p "$HOME/.ssh"

# should remove an existing emori checkout target
rm -rf "$HOME/tanaab/emori"

# should remove an existing tanaab canon checkout target
rm -rf "$HOME/tanaab/canon"

# should remove any previously installed tanaab plugin link
rm -f "$HOME/.codex/plugins/tanaab"

# should remove previous OpenClaw state
rm -rf "$HOME/.openclaw"

# should have the local emori source repo available
test -d "$GITHUB_WORKSPACE/.git"

# should have the op token test secret available
test -n "$OPTOKEN"

# should have the OpenAI API key secret available for OpenClaw ref-mode auth
test -n "$OPENAI_API_KEY"

# should run boot.sh and let CI drive OpenClaw setup
EMORI_OP_TOKEN="$OPTOKEN" \
EMORI_IDENTITY='EMORI <emori-openclaw@example.test>' \
EMORI_SSH_KEY='omfsw2uztmi2xqpid5g3kiv6ba/id_test' \
EMORI_SOURCE="$GITHUB_WORKSPACE" \
EMORI_TANAAB=off \
EMORI_OPENCLAW_AUTH=openai-api-key \
boot.sh --debug > "$TMPDIR/openclaw.log" 2>&1
```

## Testing

```bash
# should clone emori from the local workspace path
test -d "$HOME/tanaab/emori/.git"

# should skip the tanaab canon checkout for this focused scenario
! test -e "$HOME/tanaab/canon"

# should install the OpenClaw app from the Brewfile
test -d "$HOME/Applications/OpenClaw.app"

# should install the OpenClaw CLI from the Brewfile
command -v openclaw >/dev/null

# should report the installed OpenClaw CLI version
openclaw --version

# should create OpenClaw state during onboarding
test -d "$HOME/.openclaw"

# should create OpenClaw config during onboarding
test -f "$HOME/.openclaw/openclaw.json"

# should pass the same OpenClaw status probe used by the wrapper
openclaw status --deep

# should report a running OpenClaw gateway with RPC readiness
openclaw gateway status --require-rpc --deep --json >/dev/null

# should not print the OpenAI API key
! grep -F -- "$OPENAI_API_KEY" "$TMPDIR/openclaw.log"
```

## Destroy tests

```bash
# should stop OpenClaw if the installed CLI supports it
openclaw gateway stop --json || true

# should uninstall OpenClaw gateway daemon if the installed CLI supports it
openclaw gateway uninstall --json || true

# should remove OpenClaw state created by onboarding
rm -rf "$HOME/.openclaw"

# should remove the installed example ssh key
rm -f "$HOME/.ssh/id_test"

# should remove the stowed tanaab plugin link
rm -f "$HOME/.codex/plugins/tanaab"

# should remove the cloned emori and tanaab canon checkouts
rm -rf "$HOME/tanaab/emori" "$HOME/tanaab/canon"
```
