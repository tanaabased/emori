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

# Inspect source and agent update results (REPORTS → UPDATES).
openclaw agent-system automations runs update-shared-sources --limit 10
openclaw agent-system automations runs update-agent --limit 10
```

Avoid editing the maintained checkouts while an update is running. The jobs do
not reserve them against other work.

Gateway restart is manual after shared-source sync. When the report warns of
pending activation, arrange a restart once work is idle; don't rerun maintenance
just to restart or resend a report.

```sh
# Read the last shared-source report without repeating maintenance.
bun scripts/update-shared-sources-task.js --report-only
```

If an agent update is interrupted, inspect `.private/update-agent/status.json`
and the native run details before recovery. Resolve any uncertain operation and
verify installed state before preserving and moving the checkpoint aside for a
new attempt. Keep the per-run records; never clear a checkpoint just to retry.

## Helpful links

- [Agent System installation](https://github.com/tanaabased/openclaw-agent-system#installation) and [upgrades](https://github.com/tanaabased/openclaw-agent-system/blob/main/UPGRADING.md)
- [Manifest reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md)
- [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding)
- [Automation commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-automations-list)
- [Backup configuration](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md#backup) and [backup commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-backup-create)
