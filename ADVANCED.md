# Advanced operations

Use these commands to inspect or reconcile the installed workspace. Start with
the [README quickstart](./README.md#quickstart) for initial setup.

## Command cheat sheet

Run individual commands as needed from the installed checkout.

```sh
# Validate without applying changes.
openclaw agent-system validate

# Apply configuration and run setup; apply openclaw.patch.json through this installer.
openclaw agent-system install --yes

# Check installed state without changing it.
openclaw agent-system doctor

# Skip all setup checks and tasks; this does not establish full setup readiness.
openclaw agent-system install --skip-setup

# Confirm the GitHub identity is emoriwan.
openclaw agent-system tool gh -- api user --jq .login

# Inspect configured jobs and nightly execution/delivery results (REPORTS → BACKUPS).
openclaw agent-system automations list
openclaw agent-system automations runs backup-agent-nightly --limit 10
openclaw agent-system automations runs update-agent --limit 10
```

## Agent update pilot

`update-agent` is a deterministic Bun command, not an agent prompt. Its declaration
requests 23:30 America/New_York with an initial 30-minute limit. **It is not ready
for activation:** the production host adapter currently returns
`maintenance-unavailable` before any Git, dependency, Install or Doctor command.
The shared-source job in [#153](https://github.com/tanaabased/emori/issues/153)
must supply supported readiness and reporting integration; checkout admission
exclusion, stable runner/tool inputs and loaded-state verification also remain
unconnected. A timestamp or an operator-written file cannot substitute for them.

The implemented core requires clean, inactive canonical `main` and the approved
upstream, advances fast-forward-only, and installs frozen dependencies even when
unchanged. It then requires verified shared readiness before Agent System Install
with `--skip-setup`, followed by Doctor's normal checks. Skipping setup does not
establish full setup readiness. Configuration drift may cause native rejection;
the updater preserves successful work and never resets or re-admits itself.
Shared Gateway restart/recovery belongs to the shared-source job.

With a supported Bun runtime, local checkpoints are stored owner-only in
`.private/update-agent/status.json` and per-run JSON files in
`.private/update-agent/runs/`. The command emits JSON and a short summary with a
nonzero exit for incomplete work. These files are not a persistent morning card;
that integration and controlled plus genuinely scheduled host proof are still
outstanding. The existing backup lock prevents local backup/update overlap,
but does not establish checkout inactivity or shared maintenance exclusion.

After an interrupted mutation or uncertain Install, inspect the recorded revision,
pending step and native results. Reconcile through the supported Agent System
Install path above, then verify the installed/loaded state. Only after resolving
the uncertainty, preserve and move `status.json` aside before another attempt;
retain the per-run evidence. Never clear a checkpoint just to retry an uncertain
operation. Malformed checkpoints are preserved for inspection. No automatic
rollback, retry, shared Gateway restart or live activation occurs here.

## Helpful links

- [Agent System installation](https://github.com/tanaabased/openclaw-agent-system#installation) and [upgrades](https://github.com/tanaabased/openclaw-agent-system/blob/main/UPGRADING.md)
- [Manifest reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md)
- [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding)
- [Automation commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-automations-list)
- [Backup configuration](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md#backup) and [backup commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-backup-create)
