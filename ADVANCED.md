# Advanced operations

commands for EMORI's installed workspace. start with the
[README quickstart](./README.md#quickstart).

## Command cheat sheet

run individual commands as needed from the installed checkout.

```sh
# validate without applying changes.
openclaw agent-system validate

# reconcile configuration and setup; apply openclaw.patch.json through this installer.
openclaw agent-system install --yes

# inspect readiness and drift without repairs.
openclaw agent-system doctor

# skip all setup checks and tasks; this does not establish full setup readiness.
openclaw agent-system install --skip-setup

# confirm the GitHub identity is emoriwan.
openclaw agent-system tool gh -- api user --jq .login

# inspect configured jobs and recent nightly execution/delivery results.
openclaw agent-system automations list
openclaw agent-system automations runs backup-agent-nightly --limit 10
```

## Helpful links

- [Agent System installation](https://github.com/tanaabased/openclaw-agent-system#installation) and [upgrades](https://github.com/tanaabased/openclaw-agent-system/blob/main/UPGRADING.md)
- [Manifest reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md)
- [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding)
- [Automation commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-automations-list)
- [Backup configuration](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md#backup) and [backup commands](https://github.com/tanaabased/openclaw-agent-system/blob/main/CLI.md#openclaw-agent-system-backup-create)
