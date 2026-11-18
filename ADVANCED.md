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

# Inspect configured jobs and run history.
openclaw agent-system automations list
openclaw agent-system automations runs backup-agent --limit 10

openclaw agent-system automations runs update-shared-sources --limit 10
openclaw agent-system automations runs update-agent --limit 10
```

Avoid editing the maintained checkouts while an update is running. The jobs do
not reserve them against other work.

The source job fast-forwards eligible clean `main` checkouts, installs locked
dependencies, and runs Agent System's build/sync. The agent job updates EMORI,
installs locked dependencies, runs Install with `--skip-setup`, then Doctor.
Neither job resets local work or switches branches. Backup and both updaters share
one exclusion lock; overlapping runs are skipped and reported.

Backup and both update jobs report in **REPORTS → SYSTEM UPDATE**. Each update has
its own results table. Green means no action is needed for the reported work;
warnings name the outstanding action, and command failures
are red. Setup being intentionally skipped is not a warning. Source/build success
does not prove the running Gateway loaded new code. Gateway restart remains an
operator action; neither updater performs it.

Use the native run-history commands above to inspect earlier results. For a fresh
health check without updating, run `openclaw agent-system doctor`. The old wrapper
`--report-only` and `--verify-only` modes have been removed. Old private updater
records are left untouched but no longer gate new runs. After an interruption,
inspect the failed step and current state before an operator retry; do not delete
a lock file to force entry. The next scheduled occurrence checks current state
again and still honors native refusals.

The declared backup schedule is 01:01 in `America/New_York`. Apply the automation
configuration through Agent System Install and inspect the installed job to verify
the schedule; changing the declaration alone does not change a running scheduler.

## Helpful links

- [Agent System installation](https://github.com/tanaabased/openclaw-agent-system#installation) and [upgrades](https://github.com/tanaabased/openclaw-agent-system/blob/main/UPGRADING.md)
- [Manifest reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md)
- [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding)
- [Automation commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-automations-list)
- [Backup configuration](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md#backup) and [backup commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-backup-create)
