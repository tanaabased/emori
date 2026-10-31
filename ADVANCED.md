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

# Inspect shared-source results (REPORTS → UPDATES).
openclaw agent-system automations runs update-shared-sources --limit 10
```

The shared-source job uses the existing Canon and Agent System checkouts in
`git.worktrees.repositories.local`. It skips dirty, non-main, ahead/diverged,
linked or unexpected checkouts without discarding work. It does not reserve
checkouts against concurrent use; avoid editing them during the 23:00 run.
Eligible sources receive a frozen Bun install even when unchanged, then Agent
System sync runs. Agent repositories and the backup job are unaffected.

**Gateway restart is manual in this version.** A successful sync reports
“restart pending,” exits nonzero to flag the unfinished step, and leaves active
work alone. Arrange a restart when work is idle; don't rerun source updates just
to restart. Source results do not gate separate agent updates.

After interruption, the next run inspects current checkout state before updating;
it does not assume unfinished commands succeeded or roll changes back. To read
the last private checkpoint without repeating maintenance, run
`bun scripts/update-shared-sources-task.js --report-only` from the installed
checkout. Agent System retains execution and report-delivery outcomes separately;
don't rerun maintenance solely to resend a report. Installing the declaration
enables the schedule; repository validation alone does not verify live delivery.

## Helpful links

- [Agent System installation](https://github.com/tanaabased/openclaw-agent-system#installation) and [upgrades](https://github.com/tanaabased/openclaw-agent-system/blob/main/UPGRADING.md)
- [Manifest reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md)
- [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding)
- [Automation commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-automations-list)
- [Backup configuration](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md#backup) and [backup commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-backup-create)
