# Leia Example Guidance

This file applies to `examples/**`. Scenario README files are executable Leia specifications that run on fresh GitHub-hosted runners.

## Scenario Rules

- Keep one user-visible flow per scenario and one behavior per `# should ...` block.
- Treat blank-line-separated Leia blocks as separate scripts; do not rely on variables, functions, or working-directory changes persisting between blocks.
- Use the fresh runner's default OpenClaw profile unless profile behavior is the scenario contract.
- Run real public OpenClaw commands and keep model authentication, Gateway startup, channels, and host setup out of credential-free scenarios.
- The workspace scenario uses the checked-out repository directly. OpenClaw may create the ignored `openclaw-workspace-state.json` marker, but no tracked or unignored workspace files may change.
- Keep runtime output under the scenario's `TMPDIR` and do not commit generated OpenClaw state, sessions, configuration, or credentials.
- Do not use literal backticks, braced shell expansions, or numeric backreferences inside executable Leia blocks.
- Run these scenarios in CI by default; do not run them locally unless the user explicitly requests operational validation.
