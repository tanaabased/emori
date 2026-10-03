# Shared

The two small agent manifests are disposable fixtures in one isolated OpenClaw
profile. The first install provisions Codex; the second must reuse it without
changing its receipt, configuration, or the first agent. Repeating the second
install checks convergence and preserves both agents.

Workspace setup is skipped: this scenario needs no credentials or EMORI's host
dependencies. Her full installation is covered by [setup](../setup/README.md).

## Setup

```bash
# should prepare two independent agent workspaces
mkdir -p "${TMPDIR}/shared-first" "${TMPDIR}/shared-second"
cp "$GITHUB_WORKSPACE/examples/shared/first-agent.yaml" "${TMPDIR}/shared-first/agent.yaml"
cp "$GITHUB_WORKSPACE/examples/shared/second-agent.yaml" "${TMPDIR}/shared-second/agent.yaml"
```

## Testing

```bash
# should provision the shared plugin for the first agent without workspace setup
openclaw plugins list --json | jq -e 'all(.plugins[]; .id != "codex")'
cd "${TMPDIR}/shared-first"
openclaw agent-system install --skip-setup --json | jq -e '
  .outcomes[0].component == "codex-plugin" and
  .outcomes[0].code == "codex-plugin-installed" and
  .outcomes[0].status == "created" and
  (.outcomes | any(.component == "agent" and .status == "created")) and
  (.outcomes | all(.component != "setup"))
'
openclaw plugins inspect codex --json | tee "${TMPDIR}/codex-first.json" | jq -e '.plugin.enabled == true and .plugin.status != "error" and .install != null'
jq -S .install "${TMPDIR}/codex-first.json" > "${TMPDIR}/codex-receipt-before.json"
openclaw config get plugins.entries.codex --json | jq -S . > "${TMPDIR}/codex-config-before.json"
openclaw config get agents.entries.shared-first --json | jq -S . > "${TMPDIR}/first-agent-before.json"

# should reuse the plugin for a second agent without changing the first agent
cd "${TMPDIR}/shared-second"
openclaw agent-system install --skip-setup --json | jq -e '
  .outcomes[0].component == "codex-plugin" and
  .outcomes[0].code == "codex-plugin-unchanged" and
  .outcomes[0].status == "unchanged" and
  (.outcomes | any(.component == "agent" and .status == "created")) and
  (.outcomes | all(.component != "setup"))
'
openclaw plugins inspect codex --json | jq -S .install > "${TMPDIR}/codex-receipt-after.json"
cmp "${TMPDIR}/codex-receipt-before.json" "${TMPDIR}/codex-receipt-after.json"
openclaw config get plugins.entries.codex --json | jq -S . > "${TMPDIR}/codex-config-after.json"
cmp "${TMPDIR}/codex-config-before.json" "${TMPDIR}/codex-config-after.json"
openclaw config get agents.entries.shared-first --json | jq -S . > "${TMPDIR}/first-agent-after.json"
cmp "${TMPDIR}/first-agent-before.json" "${TMPDIR}/first-agent-after.json"

# should preserve both agents and the shared install on repeat reconciliation
openclaw config get agents.entries.shared-second --json | jq -S . > "${TMPDIR}/second-agent-before.json"
cd "${TMPDIR}/shared-second"
openclaw agent-system install --skip-setup --json | jq -e '
  .outcomes[0].component == "codex-plugin" and
  .outcomes[0].code == "codex-plugin-unchanged" and
  .outcomes[0].status == "unchanged" and
  (.outcomes | any(.component == "agent" and .status == "unchanged")) and
  (.outcomes | all(.component != "setup"))
'
openclaw plugins inspect codex --json | jq -S .install > "${TMPDIR}/codex-receipt-repeat.json"
cmp "${TMPDIR}/codex-receipt-before.json" "${TMPDIR}/codex-receipt-repeat.json"
openclaw config get plugins.entries.codex --json | jq -S . > "${TMPDIR}/codex-config-repeat.json"
cmp "${TMPDIR}/codex-config-before.json" "${TMPDIR}/codex-config-repeat.json"
openclaw config get agents.entries.shared-first --json | jq -S . > "${TMPDIR}/first-agent-repeat.json"
cmp "${TMPDIR}/first-agent-before.json" "${TMPDIR}/first-agent-repeat.json"
openclaw config get agents.entries.shared-second --json | jq -S . > "${TMPDIR}/second-agent-repeat.json"
cmp "${TMPDIR}/second-agent-before.json" "${TMPDIR}/second-agent-repeat.json"
```
