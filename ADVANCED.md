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

# Inspect configured jobs and backup execution/delivery results (REPORTS → BACKUPS).
openclaw agent-system automations list
openclaw agent-system automations runs backup-agent --limit 10

# Run the synchronized backup manually (creates/uploads a backup and applies retention).
openclaw agent-system automations run backup-agent --json

# Inspect source and agent update results (REPORTS → UPDATES).
openclaw agent-system automations runs update-shared-sources --limit 10
openclaw agent-system automations runs update-agent --limit 10
```

Avoid editing the maintained checkouts while an update is running. The jobs do
not reserve them against other work.

Gateway restart is manual after shared-source sync. When the report warns of
pending activation, arrange a restart once work is idle; don't rerun updates
just to restart or resend a report.

```sh
# Read retained reports without repeating updates or claiming message delivery.
bun scripts/update-shared-sources-task.js --report-only
bun scripts/update-agent-task.js --report-only

# Recheck health only when the recorded agent configuration was fully applied.
bun scripts/update-agent-task.js --verify-only
```

Verification-only runs Doctor with normal checks, not source updates, dependency
installation, or configuration application. It refuses changed checkouts,
incomplete application, and uncertain checkpoints. The original update and its
failed health check stay in history; verification is a separate observation.
Use `--help` on the agent update command for its modes. Reporting commands emit
the [Agent System report document](https://github.com/tanaabased/openclaw-agent-system/blob/main/API.md#command-report-output)
to stdout; the shared service renders cards in scheduled chats.

A restart request or matching files on disk does not prove which build the
Gateway loaded. No supported running-build observation is currently available to
this updater, so activation stays unverified until that evidence exists.

If an agent update is interrupted, inspect `.private/update-agent/status.json`
and the native run details before recovery. Resolve any uncertain operation and
verify installed state before preserving and moving the checkpoint aside for a
new attempt. Keep the per-run records; never clear a checkpoint just to retry.

## Migrate the backup automation ID

`backup-agent` / 💾 BACKUP AGENT replaces `backup-agent-nightly`. This is a
stable-ID migration, not a display-only rename. Apply it only as an authorized
operator action in the installed checkout, while no backup or agent update is
running. Do not reset ownership records or edit scheduler storage.

1. Before applying the new declaration, inspect installed jobs with
   `openclaw agent-system automations list --json` and read old history with
   `openclaw agent-system automations runs backup-agent-nightly --limit 10 --json`.
   Record the old job's native ID, enabled state, cron/timezone, and destination.
   Stop if ownership is conflicting or inspection is incomplete; a missing job in
   a scoped view does not establish absence.
2. Temporarily remove only the old backup declaration from
   `.agent-system/automations.yml`, leaving the other jobs unchanged. Run
   `openclaw agent-system automations sync --json`. Confirm the old job is disabled
   and its mapping/history retained before adding the replacement. This staged
   sync avoids enabling a replacement before the old schedule is disabled.
3. Apply the new `backup-agent` declaration from this repository and sync again.
   Preserve the recorded enabled state: if the old job was intentionally disabled,
   set `enabled: false` on the replacement before syncing. Keep `0 4 * * *` and the
   existing timezone behavior (no explicit timezone means host-local time), command,
   reporting thread, and other settings unchanged.
4. Inspect installed jobs again. Confirm the replacement's name is
   💾 BACKUP AGENT, its settings match the snapshot, and only the intended backup
   job is active (none if intentionally disabled). The old job must remain disabled,
   with history still readable under `backup-agent-nightly`; that retained record
   is not an orphaned active schedule. Leave it in place to preserve history.
5. When a real backup run is authorized and the replacement is enabled, use
   `openclaw agent-system automations run backup-agent --json`. Check the returned
   run ID with `openclaw agent-system automations runs backup-agent --run-id <runId> --json`.
   A queued result is not completion: verify execution and delivery separately.

The rename does not change archive names, Drive destination, retention, permissions,
credentials, or backup contents. If a sync fails or has an uncertain outcome, inspect
its retained progress and installed jobs before continuing; do not create a second
job manually or clear ownership state to retry.

## Helpful links

- [Agent System installation](https://github.com/tanaabased/openclaw-agent-system#installation) and [upgrades](https://github.com/tanaabased/openclaw-agent-system/blob/main/UPGRADING.md)
- [Manifest reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md)
- [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding)
- [Automation commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-automations-list)
- [Backup configuration](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md#backup) and [backup commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-backup-create)
