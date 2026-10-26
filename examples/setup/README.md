# Setup

## What this example does

Runs EMORI's full setup and repeat reconciliation in an isolated OpenClaw profile. It checks an eligible
Canon skill, manifest-declared model configuration, iMessage routing and
send-only messaging, SQLite vector loading, Workshop background learning disabled,
and preservation of host session visibility and clean checkouts. It verifies the
managed Codex dependency pair against Agent System's requirement, not an EMORI pin.

The `--yes` consent applies only to this isolated CI profile. Automatic cron
execution is disabled so registered schedules cannot start model turns during
setup checks.

## What it doesn't do

It does not send messages, execute skills or model turns,
or test memory indexing and recall. Credential and intake lifecycle checks belong to
[install](../install/README.md); shared plugin reuse belongs to
[shared](../shared/README.md). Setup and model expectations come from the manifest.

## Setup

```bash
# should store EMORI's 1Password service account credential in the isolated profile
test -n "${OP_SERVICE_ACCOUNT_TOKEN:-}"
openclaw agent-system credentials set op --from-env

# should prepare EMORI's checked-out workspace
mkdir -p "$HOME/tanaab"
git clone --no-local "$GITHUB_WORKSPACE" "$HOME/tanaab/emori"

# should read expected setup and model declarations from the workspace
cd "$GITHUB_WORKSPACE"
bun --eval '
  import { readFileSync } from "node:fs";
  import { resolve } from "node:path";
  const directory = resolve(".agent-system");
  const yaml = (file) => Bun.YAML.parse(readFileSync(file, "utf8"));
  const manifest = yaml(resolve(directory, "agent.yaml"));
  const setup = ["setup-host", "setup-agent"].flatMap((key) => yaml(resolve(directory, manifest[key].file)).steps.map(({ id }) => id));
  console.log(JSON.stringify({ setup, models: manifest.models, runtime: manifest.agent.runtime }));
' > "${TMPDIR}/setup-expected.json"

# should start the isolated gateway for session dispatch enrollment
openclaw config set cron.enabled false --strict-json
openclaw config set logging.consoleStyle '"json"' --strict-json
openclaw-gateway start --debug

# should prepare a fresh setup with existing host session visibility
cd "$GITHUB_WORKSPACE"
test ! -e "$HOME/tanaab/canon"
openclaw plugins list --json | jq -e 'all(.plugins[]; .id != "codex")'
openclaw config set skills.load.extraDirs "[\"$HOME/tanaab/canon/skills\"]" --strict-json
openclaw config set tools.sessions.visibility '"all"' --strict-json
```

## Testing

```bash
# should complete all declared setup tasks with codex available before host setup
set -euo pipefail
cd "$GITHUB_WORKSPACE"
install_status=0
openclaw agent-system install --yes --json | tee "${TMPDIR}/setup-install.json" || install_status=$?
openclaw-gateway diagnostics --debug > "${TMPDIR}/first-install-gateway.log" 2>&1 || true
if gateway_log=$(openclaw-gateway log-path); then
  gateway_redactor="$(dirname "$(command -v openclaw-gateway)")/lib/redact-stream.mjs"
  if ! node "$gateway_redactor" < "$gateway_log" > "${TMPDIR}/first-install-gateway-full.log"; then
    printf 'Full Gateway trace unavailable\n' > "${TMPDIR}/first-install-gateway-full.log"
  fi
fi
test "$install_status" -eq 0
jq -e --slurpfile expected "${TMPDIR}/setup-expected.json" '
  .agentId == "emori" and
  (.blocked == null) and ((.unattempted // []) | length == 0) and
  (.outcomes as $outcomes |
    ([$outcomes | to_entries[] | select(.value.component == "codex-plugin" and .value.code == "codex-plugin-installed" and .value.status == "created") | .key] | first) as $plugin |
    ([$outcomes | to_entries[] | select(.value.component == "setup") | .key] | first) as $setup |
    $plugin != null and $setup != null and $plugin < $setup) and
  ([.outcomes[] | select(.component == "setup") | .stepId] == $expected[0].setup) and
  all(.outcomes[] | select(.component == "setup"); .status == "updated" or .status == "unchanged")
' "${TMPDIR}/setup-install.json"
test -d "$GITHUB_WORKSPACE/memory"
test -f "$GITHUB_WORKSPACE/MEMORY.md"

# should expose an eligible canon skill from the shared ssh checkout
git -C "$HOME/tanaab/canon" remote get-url origin | grep -Fx 'git@github.com:tanaabased/canon.git'
openclaw skills info tanaab-project-optimizer --agent emori --json | jq -e '
  .name == "tanaab-project-optimizer" and
  .eligible == true and
  .disabled == false and
  (.filePath | split("/") | index("plugin-skills")) != null
'

# should resolve the Codex dependency pair owned by Agent System
openclaw plugins inspect agent-system --json > "${TMPDIR}/agent-system.json"
openclaw plugins inspect codex --json > "${TMPDIR}/codex.json"
node "$GITHUB_WORKSPACE/examples/setup/codex-dependencies.mjs" "${TMPDIR}/agent-system.json" "${TMPDIR}/codex.json"

# should select and bind the manifest-declared models and effort
openclaw config get agents.entries.emori --json | jq -e --slurpfile expected "${TMPDIR}/setup-expected.json" '
  . as $agent |
  .model.primary == $expected[0].models.default.model and
  .thinkingDefault == $expected[0].models.default.effort and
  ([$expected[0].models | .default.model, .low.model, .medium.model, .high.model] | unique |
    all(.[]; . as $model | $agent.models[$model].agentRuntime.id == $expected[0].runtime))
'

# should install the official imessage channel plugin
openclaw plugins inspect imessage --json | jq -e '
  .plugin.id == "imessage" and
  .plugin.enabled == true and
  .plugin.status != "error" and
  .plugin.packageName == "@openclaw/imessage" and
  (.plugin.channelIds | index("imessage")) != null and
  .install.resolvedName == "@openclaw/imessage"
'

# should configure EMORI's execution policy
openclaw config get agents.entries.emori.tools --json | jq -e '
  .profile == "coding" and
  .exec.mode == "auto" and
  (.alsoAllow | index("agent_system_git")) != null and
  (.alsoAllow | index("agent_system_github")) != null and
  (.exec.pathPrepend | length) > 0
'

# should preserve Agent System grants while allowing only message sends
openclaw config get agents.entries.emori.tools --json | jq -e '
  (.alsoAllow | index("message")) != null and
  .message.actions.allow == ["send"] and
  (.message | has("crossContext") | not)
'

# should configure EMORI's iMessage route without changing session scope
openclaw config get channels.imessage --json | jq -e '
  .enabled == true and
  .defaultAccount == "emori" and
  .dmPolicy == "pairing" and
  .groupPolicy == "allowlist" and
  .accounts.emori == {"enabled": true} and
  (has("defaultTo") | not) and
  (has("allowFrom") | not) and
  (.accounts.emori | has("cliPath") | not) and
  (.accounts.emori | has("dbPath") | not)
'
openclaw config get bindings --json | jq -e '
  [.[] | select(.type == "route" and .match.channel == "imessage" and .match.accountId == "emori")] == [{
    "type": "route",
    "agentId": "emori",
    "match": {"channel": "imessage", "accountId": "emori"}
  }]
'
! openclaw config get session.dmScope --json >/dev/null 2>&1

# should disable Workshop background learning without reviving proposal staging
openclaw config get skills.workshop.autonomous.mode --json | jq -e '. == "off"'

# should validate the installed merged configuration with its plugins
openclaw config validate --json | jq -e '.valid == true'

# should reject the removed Workshop proposal mode without applying it
set -euo pipefail
if openclaw config patch --file "$GITHUB_WORKSPACE/examples/setup/unsupported-workshop.patch.json" --dry-run --json > "${TMPDIR}/unsupported-workshop.json"; then
  exit 1
fi
jq -e '.ok == false and any(.errors[]; .kind == "schema" and (.message | contains("skills.workshop.autonomous.mode")))' "${TMPDIR}/unsupported-workshop.json"
openclaw config get skills.workshop.autonomous.mode --json | jq -e '. == "off"'

# should preserve collaboration-managed session visibility after workspace setup
openclaw config get tools.sessions.visibility --json | jq -e '. == "all"'

# should report memory and session sources with the installed vector extension
case "$(uname -m)" in
  arm64) SQLITE_VECTOR_PACKAGE="sqlite-vec-darwin-arm64" ;;
  x86_64) SQLITE_VECTOR_PACKAGE="sqlite-vec-darwin-x64" ;;
  *) exit 1 ;;
esac
EXPECTED_VECTOR_EXTENSION="$(npm root --global)/${SQLITE_VECTOR_PACKAGE}/vec0.dylib"
test -f "$EXPECTED_VECTOR_EXTENSION"
node "$GITHUB_WORKSPACE/examples/setup/vector-extension.mjs" "$EXPECTED_VECTOR_EXTENSION"
openclaw memory status --agent emori --json | jq -e \
  --arg extension "$EXPECTED_VECTOR_EXTENSION" \
  'map(select(.agentId == "emori")) |
   length == 1 and
   .[0].status.vector.enabled == true and
   .[0].status.vector.extensionPath == $extension and
   .[0].status.sources == ["memory", "sessions"]'

# should enable private same-agent recall without the legacy memory hook
openclaw config get agents.entries.emori.memory.search.rememberAcrossConversations --json | jq -e '. == true'
openclaw config get agents.entries.emori.memory.search.sources --json | jq -e '. == ["memory", "sessions"]'
openclaw config get agents.entries.emori.memory.search.experimental.sessionMemory --json | jq -e '. == true'
openclaw config get hooks.internal.entries.session-memory.enabled --json | jq -e '. == false'
openclaw hooks list --json | jq -e '
  [.hooks[] | select(.name == "session-memory")] |
  length == 1 and
  .[0].disabled == true and
  .[0].enabledByConfig == false
'

# should converge on full repeat reconciliation without renewed policy or model drift
set -euo pipefail
cd "$GITHUB_WORKSPACE"
for section in agents bindings channels hooks skills tools; do
  openclaw config get "$section" --json | jq -S . > "${TMPDIR}/${section}-before.json"
done
openclaw agent-system install --yes --json | tee "${TMPDIR}/setup-reinstall.json"
jq -e --slurpfile expected "${TMPDIR}/setup-expected.json" '
  .blocked == null and ((.unattempted // []) | length == 0) and
  ([.outcomes[] | select(.component == "setup") | .stepId] == $expected[0].setup) and
  all(.outcomes[] | select(.component == "setup"); .status == "unchanged")
' "${TMPDIR}/setup-reinstall.json"
for section in agents bindings channels hooks skills tools; do
  openclaw config get "$section" --json | jq -S . > "${TMPDIR}/${section}-after.json"
  cmp "${TMPDIR}/${section}-before.json" "${TMPDIR}/${section}-after.json"
done
openclaw config validate --json | jq -e '.valid == true'

# should preserve EMORI's clean checkouts
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
test -z "$(git -C "$HOME/tanaab/emori" status --short --untracked-files=all)"
```
