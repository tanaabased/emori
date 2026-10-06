# Setup

This scenario verifies EMORI's full setup and repeat convergence. Keeping both
runs together proves idempotence against the state the first run created.
Cross-agent plugin reuse is covered separately by [shared](../shared/README.md).

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
# should start without EMORI setup effects and record host dependency readiness
cd "$GITHUB_WORKSPACE"
test ! -e "$HOME/tanaab/canon"
test ! -e "$HOME/tanaab/openclaw-agent-system"
openclaw plugins list --json | jq -e 'all(.plugins[]; .id != "codex")'
! openclaw plugins inspect tanaab --json >/dev/null 2>&1
! openclaw plugins inspect imessage --json >/dev/null 2>&1
if node scripts/setup-brew-dependencies-task.js check; then
  printf unchanged > "${TMPDIR}/brew-expected-status"
else
  test "$?" -eq 1
  printf updated > "${TMPDIR}/brew-expected-status"
fi
openclaw config set skills.load.extraDirs "[\"$HOME/tanaab/canon/skills\"]" --strict-json

# should start with collaboration-managed session visibility
openclaw config set tools.sessions.visibility '"all"' --strict-json

# should install Codex before host setup and then reconcile agent setup
openclaw agent-system validate
openclaw agents add emori --workspace "$GITHUB_WORKSPACE" --non-interactive --json
openclaw config set agents.entries.emori.model '{"primary":"openai/gpt-6-luna","fallbacks":["openai/gpt-6-luna"]}' --strict-json
openclaw agent-system install --json | tee "${TMPDIR}/setup-install.json"
jq -e '.outcomes[0].component == "codex-plugin" and .outcomes[0].code == "codex-plugin-installed" and .outcomes[0].status == "created" and .outcomes[1].stepId == "brew-dependencies"' "${TMPDIR}/setup-install.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "workspace-memory", "canon-checkout", "canon-plugin", "imessage-plugin", "openclaw-config"]' "${TMPDIR}/setup-install.json"
jq -e --arg brew "$(cat "${TMPDIR}/brew-expected-status")" '[.outcomes[] | select(.component == "setup") | .status] == [$brew, "updated", "updated", "updated", "updated", "updated"]' "${TMPDIR}/setup-install.json"
test -d "$GITHUB_WORKSPACE/memory"
test -f "$GITHUB_WORKSPACE/MEMORY.md"
grep -Fx '# Memory' "$GITHUB_WORKSPACE/MEMORY.md"
printf '\nPreserved setup example note.\n' >> "$GITHUB_WORKSPACE/MEMORY.md"
cp "$GITHUB_WORKSPACE/MEMORY.md" "${TMPDIR}/memory-before-repeat.md"

# should satisfy EMORI's Brewfile dependencies
HOMEBREW_NO_AUTO_UPDATE=1 brew bundle check --verbose --file "$GITHUB_WORKSPACE/Brewfile"
gog --version

# should clone Canon over SSH and admit it with EMORI's managed Git identity
test -d "$HOME/tanaab/canon/.git"
cd "$HOME/tanaab/canon"
openclaw agent-system tool git --agent emori -- remote get-url origin | grep -Fx 'git@github.com:tanaabased/canon.git'
openclaw agent-system tool git --agent emori -- var GIT_AUTHOR_IDENT | grep -F 'EMORI <emori@tanaab.dev>'
cd "$GITHUB_WORKSPACE"
test ! -e "$HOME/tanaab/openclaw-agent-system"

# should activate Canon as the plugin-owned source of shared skills
openclaw plugins inspect tanaab --json | jq -e '
  .plugin.id == "tanaab" and
  .plugin.enabled == true and
  .plugin.status != "error" and
  .plugin.rootDir == (env.HOME + "/tanaab/canon") and
  .install.source == "path" and
  .install.sourcePath == (env.HOME + "/tanaab/canon") and
  (.install.acceptedSurface.skills | index("./skills")) != null
'
openclaw skills info tanaab-project-optimizer --agent emori --json | jq -e '
  .name == "tanaab-project-optimizer" and
  .eligible == true and
  .disabled == false and
  (.filePath | split("/") | index("plugin-skills")) != null
'
! openclaw config get skills.load.extraDirs --json >/dev/null 2>&1

# should leave the shared Codex plugin healthy after agent setup
openclaw plugins inspect codex --json | tee "${TMPDIR}/codex-after-setup.json" | jq -e '.plugin.id == "codex" and .plugin.enabled == true and .plugin.status != "error"'
jq -S .install "${TMPDIR}/codex-after-setup.json" > "${TMPDIR}/codex-receipt-before.json"
openclaw config get plugins.entries.codex --json | jq -S . > "${TMPDIR}/codex-config-before.json"

# should select the manifest-declared default model and effort
openclaw config get agents.entries.emori.model.primary --json | jq -e '. == "openai/gpt-6-astra"'
openclaw config get agents.entries.emori.thinkingDefault --json | jq -e '. == "high"'

# should preserve existing fallbacks
openclaw config get agents.entries.emori.model.fallbacks --json | jq -e '. == ["openai/gpt-6-luna"]'

# should bind all manifest-declared models to Codex
openclaw config get agents.entries.emori --json | jq -e '
  . as $agent |
  ["openai/gpt-6-astra", "openai/gpt-6-luna", "openai/gpt-6.1-sol"] |
  all(.[]; . as $model | $agent.models[$model].agentRuntime.id == "codex")
'

# should allow selection of all manifest-declared models
openclaw config get agents --json | bun --eval '
  import { readFileSync } from "node:fs";
  import { resolveAllowedModelRef } from "openclaw/plugin-sdk/agent-runtime";
  const cfg = { agents: JSON.parse(readFileSync(0, "utf8")) };
  for (const raw of ["openai/gpt-6-astra", "openai/gpt-6-luna", "openai/gpt-6.1-sol"]) {
    const result = resolveAllowedModelRef({ cfg, agentId: "emori", catalog: [], defaultProvider: "openai", raw });
    if ("error" in result) throw new Error(result.error);
    console.log(`Allowed: ${result.key}`);
  }
'

# should install the official iMessage channel plugin without configuring the channel
openclaw plugins inspect imessage --json | jq -e '
  .plugin.id == "imessage" and
  .plugin.enabled == true and
  .plugin.status != "error" and
  .plugin.packageName == "@openclaw/imessage" and
  (.plugin.channelIds | index("imessage")) != null and
  .install.resolvedName == "@openclaw/imessage"
'

# should atomically configure EMORI's execution and messaging policy
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

# should configure Workshop proposal policy
openclaw config get skills.workshop.autonomous.mode --json | jq -e '. == "propose"'

# should preserve collaboration-managed session visibility after workspace setup
openclaw config get tools.sessions.visibility --json | jq -e '. == "all"'

# should configure EMORI's memory policy with the installed vector extension
case "$(uname -m)" in
  arm64) SQLITE_VECTOR_PACKAGE="sqlite-vec-darwin-arm64" ;;
  x86_64) SQLITE_VECTOR_PACKAGE="sqlite-vec-darwin-x64" ;;
  *) exit 1 ;;
esac
EXPECTED_VECTOR_EXTENSION="$(npm root --global)/${SQLITE_VECTOR_PACKAGE}/vec0.dylib"
test -f "$EXPECTED_VECTOR_EXTENSION"
openclaw config get agents.entries.emori.memory.search.store.vector --json | jq -e \
  --arg extension "$EXPECTED_VECTOR_EXTENSION" \
  '.enabled == true and .extensionPath == $extension'
openclaw memory status --agent emori --json | jq -e \
  --arg extension "$EXPECTED_VECTOR_EXTENSION" \
  'map(select(.agentId == "emori")) |
   length == 1 and
   .[0].status.vector.enabled == true and
   .[0].status.vector.extensionPath == $extension'

# should enable private same-agent recall without the legacy memory hook
openclaw config get agents.entries.emori.memory.search.rememberAcrossConversations --json | jq -e '. == true'
openclaw config get agents.entries.emori.memory.search.sources --json | jq -e '. == ["memory", "sessions"]'
openclaw config get agents.entries.emori.memory.search.experimental.sessionMemory --json | jq -e '. == true'
openclaw config get hooks.internal.entries.session-memory.enabled --json | jq -e '. == false'
openclaw memory status --agent emori --json | jq -e '
  map(select(.agentId == "emori")) |
  length == 1 and
  .[0].status.sources == ["memory", "sessions"]
'
openclaw hooks list --json | jq -e '
  [.hooks[] | select(.name == "session-memory")] |
  length == 1 and
  .[0].disabled == true and
  .[0].enabledByConfig == false
'
```

```bash
# should leave a converged setup unchanged on repeat installation
cd "$GITHUB_WORKSPACE"
openclaw agent-system install --json | tee "${TMPDIR}/setup-reinstall.json"
jq -e '.outcomes[0].component == "codex-plugin" and .outcomes[0].code == "codex-plugin-unchanged" and .outcomes[0].status == "unchanged"' "${TMPDIR}/setup-reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "workspace-memory", "canon-checkout", "canon-plugin", "imessage-plugin", "openclaw-config"]' "${TMPDIR}/setup-reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup" or .component == "models") | .status] | length == 7 and all(. == "unchanged")' "${TMPDIR}/setup-reinstall.json"
jq -e 'all(.outcomes[]; .status != "updated" and .status != "created")' "${TMPDIR}/setup-reinstall.json"
cmp "${TMPDIR}/memory-before-repeat.md" "$GITHUB_WORKSPACE/MEMORY.md"

# should select the manifest-declared default model and effort after repeat setup
openclaw config get agents.entries.emori.model.primary --json | jq -e '. == "openai/gpt-6-astra"'
openclaw config get agents.entries.emori.thinkingDefault --json | jq -e '. == "high"'

# should preserve existing fallbacks after repeat setup
openclaw config get agents.entries.emori.model.fallbacks --json | jq -e '. == ["openai/gpt-6-luna"]'

# should bind all manifest-declared models to Codex after repeat setup
openclaw config get agents.entries.emori --json | jq -e '
  . as $agent |
  ["openai/gpt-6-astra", "openai/gpt-6-luna", "openai/gpt-6.1-sol"] |
  all(.[]; . as $model | $agent.models[$model].agentRuntime.id == "codex")
'

# should allow selection of all manifest-declared models after repeat setup
openclaw config get agents --json | bun --eval '
  import { readFileSync } from "node:fs";
  import { resolveAllowedModelRef } from "openclaw/plugin-sdk/agent-runtime";
  const cfg = { agents: JSON.parse(readFileSync(0, "utf8")) };
  for (const raw of ["openai/gpt-6-astra", "openai/gpt-6-luna", "openai/gpt-6.1-sol"]) {
    const result = resolveAllowedModelRef({ cfg, agentId: "emori", catalog: [], defaultProvider: "openai", raw });
    if ("error" in result) throw new Error(result.error);
    console.log(`Allowed: ${result.key}`);
  }
'

# should preserve collaboration-managed session visibility after repeat setup
openclaw config get tools.sessions.visibility --json | jq -e '. == "all"'

# should preserve the shared plugin receipt and configuration after repeat setup
openclaw plugins inspect codex --json | jq -S .install > "${TMPDIR}/codex-receipt-repeat.json"
cmp "${TMPDIR}/codex-receipt-before.json" "${TMPDIR}/codex-receipt-repeat.json"
openclaw config get plugins.entries.codex --json | jq -S . > "${TMPDIR}/codex-config-repeat.json"
cmp "${TMPDIR}/codex-config-before.json" "${TMPDIR}/codex-config-repeat.json"

# should preserve EMORI's clean checkout
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
test -z "$(git -C "$HOME/tanaab/emori" status --short --untracked-files=all)"
```
