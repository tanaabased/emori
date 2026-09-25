# Setup

This scenario installs EMORI from her checked-out workspace in an isolated
OpenClaw profile and runs the currently verified setup prefix.

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
# should start without setup effects and converge every declared concern
cd "$GITHUB_WORKSPACE"
test ! -e "$HOME/tanaab/canon"
test ! -e "$HOME/tanaab/openclaw-agent-system"
! openclaw plugins inspect tanaab --json >/dev/null 2>&1
! openclaw plugins inspect codex --json >/dev/null 2>&1
! openclaw plugins inspect imessage --json >/dev/null 2>&1
openclaw config set skills.load.extraDirs "[\"$HOME/tanaab/canon/skills\"]" --strict-json

# should run the verified setup prefix through Agent System
openclaw agent-system validate
openclaw agent-system install --json | tee "${TMPDIR}/setup-install.json"
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "canon-checkout", "canon-plugin", "codex-plugin", "imessage-plugin", "execution-policy", "messaging-policy", "imessage-routing", "workshop-policy", "memory-vector-store", "memory-recall"]' "${TMPDIR}/setup-install.json"
jq -e '[.outcomes[] | select(.component == "setup") | .status] | all(. == "updated")' "${TMPDIR}/setup-install.json"

# should satisfy EMORI's Brewfile dependencies
HOMEBREW_NO_AUTO_UPDATE=1 brew bundle check --verbose --file "$GITHUB_WORKSPACE/Brewfile"

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

# should install the Codex plugin
openclaw plugins inspect codex --json | jq -e '.plugin.id == "codex"'

# should install the official iMessage channel plugin without configuring the channel
openclaw plugins inspect imessage --json | jq -e '
  .plugin.id == "imessage" and
  .plugin.enabled == true and
  .plugin.status != "error" and
  .plugin.packageName == "@openclaw/imessage" and
  (.plugin.channelIds | index("imessage")) != null and
  .install.resolvedName == "@openclaw/imessage"
'

# should configure only EMORI's coding and automatic execution policy
openclaw config get agents.entries.emori.tools --json | jq -e '
  .profile == "coding" and
  .exec.mode == "auto" and
  (.alsoAllow | index("agent_system_git")) != null and
  (.alsoAllow | index("agent_system_github")) != null and
  (.exec.pathPrepend | length) > 0
'

# should allow only message sends and inherit OpenClaw routing and attribution defaults
openclaw config get agents.entries.emori.tools --json | jq -e '
  (.alsoAllow | index("message")) != null and
  .message.actions.allow == ["send"] and
  (.message | has("crossContext") | not)
'

# should route EMORI's enabled default iMessage account without changing session scope
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

# should allow Workshop to draft proposals without autonomous publication or application
openclaw config get skills.workshop.autonomous.mode --json | jq -e '. == "propose"'

# should enable EMORI's agent-scoped SQLite vector store with the installed extension
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

# should enable private same-agent full-transcript recall without duplicate hook artifacts
openclaw config get agents.entries.emori.memory.search.rememberAcrossConversations --json | jq -e '. == true'
openclaw config get agents.entries.emori.memory.search.sources --json | jq -e '. == ["memory", "sessions"]'
openclaw config get agents.entries.emori.memory.search.experimental.sessionMemory --json | jq -e '. == true'
openclaw config get tools.sessions.visibility --json | jq -e '. == "agent"'
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
jq -e '[.outcomes[] | select(.component == "setup") | .stepId] == ["brew-dependencies", "canon-checkout", "canon-plugin", "codex-plugin", "imessage-plugin", "execution-policy", "messaging-policy", "imessage-routing", "workshop-policy", "memory-vector-store", "memory-recall"]' "${TMPDIR}/setup-reinstall.json"
jq -e '[.outcomes[] | select(.component == "setup") | .status] | all(. == "unchanged")' "${TMPDIR}/setup-reinstall.json"

# should preserve EMORI's clean checkout
test -z "$(git -C "$GITHUB_WORKSPACE" status --short --untracked-files=all)"
```
