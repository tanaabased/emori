# EMORI

<p align="center">
  <img src="./avatars/emori-circle.png" alt="EMORI" width="180" />
</p>

<p align="center">
  <a href="https://github.com/tanaabased/emori/releases"><img src="https://img.shields.io/github/v/release/tanaabased/emori?include_prereleases&sort=semver" alt="Latest release" /></a>
  <a href="https://github.com/tanaabased/emori/actions/workflows/pr-linter.yml"><img src="https://img.shields.io/github/actions/workflow/status/tanaabased/emori/pr-linter.yml?event=pull_request&label=Lint" alt="Lint" /></a>
  <a href="https://github.com/tanaabased/emori/actions/workflows/pr-unit-tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/tanaabased/emori/pr-unit-tests.yml?event=pull_request&label=Unit%20Tests" alt="Unit tests" /></a>
  <a href="https://github.com/tanaabased/emori/actions/workflows/pr-examples-tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/tanaabased/emori/pr-examples-tests.yml?event=pull_request&label=Workspace" alt="Workspace example tests" /></a>
</p>

EMORI is an artificial agent, co-founder, and operating partner: candid,
evidence-led, and dryly amused.
This repository is her public [OpenClaw](https://openclaw.ai) workspace, with
[Agent System](https://github.com/tanaabased/openclaw-agent-system) managing her
identity, tool credentials, and GitHub work intake.

## Overview

- Declares [model and effort profiles](./.agent-system/agent.yaml) for low,
  medium, and high task complexity through Agent System.
- Handles GitHub assignments through Agent System with a distinct agent
  identity and managed Git worktrees.
- Uses [state-aware heartbeat guidance](./HEARTBEAT.md) to follow up on
  assignments, pull requests, and goal reviews while avoiding duplicate reminders.

## Quickstart

For a new checkout on EMORI's agentbox, complete [Installation](#installation)
first. Have her 1Password service account token ready, then run:

```sh
mkdir -p ~/tanaab
git clone https://github.com/tanaabased/emori.git ~/tanaab/emori
cd ~/tanaab/emori

# use EMORI's managed SSH identity for subsequent repository work.
git remote set-url origin git@github.com:tanaabased/emori.git

# store the 1Password service account token at the masked prompt.
openclaw agent-system credentials set op
openclaw agent-system validate
openclaw agent-system install
openclaw agent-system doctor

# confirm the managed GitHub identity is emoriwan.
openclaw agent-system tool gh -- api user --jq .login
```

Run Agent System commands from this directory so they discover EMORI's manifest.
`install` registers the agent and reconciles the declared configuration; rerun it
when that configuration changes. `doctor` reports managed-state drift.

## Installation

1. **OpenClaw:** Install and onboard [OpenClaw](https://docs.openclaw.ai/install)
   on the agentbox. This workspace targets **2026.9.3**.
2. **Agent System:** Use a build compatible with that OpenClaw version. The
   [compatibility table](https://github.com/tanaabased/openclaw-agent-system/blob/main/ADVANCED.md#version-compatibility)
   currently lists 2026.9.3 support as unreleased. Follow the
   [source-build instructions](https://github.com/tanaabased/openclaw-agent-system/blob/main/DEVELOPMENT.md#install-from-source)
   with the checkout at `~/tanaab/openclaw-agent-system`, then register it:

   ```sh
   openclaw plugins install --link ~/tanaab/openclaw-agent-system --accept-capabilities
   openclaw plugins enable agent-system
   openclaw config set plugins.entries.agent-system.hooks.allowConversationAccess true
   ```

   The conversation-access setting lets Agent System supply manifest and GitHub
   lifecycle guidance. For published builds, see upstream
   [installation](https://github.com/tanaabased/openclaw-agent-system#installation).

3. **Agent environment:** The agentbox supplies host tooling; EMORI's additional
   requirements are recorded in [`Brewfile`](./Brewfile). Her 1Password service
   account must have access to the environment and SSH key referenced by the
   manifest, which requires `EMAIL`, `GH_TOKEN`, and `EMORI_SSH_KEY`. The quickstart
   stores the bootstrap token through Agent System's
   [credential command](https://github.com/tanaabased/openclaw-agent-system/blob/main/ADVANCED.md#openclaw-agent-system-credentials).

## Configuration

| File                                                     | Purpose                                                                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [`.agent-system/agent.yaml`](./.agent-system/agent.yaml) | Identity, model and effort profiles, environment sources, managed Git and GitHub, and assignment admission. |
| [`IDENTITY.md`](./IDENTITY.md)                           | Public identity metadata.                                                                                   |
| [`SOUL.md`](./SOUL.md)                                   | Mission, character, voice, and Covenant.                                                                    |
| [`AGENTS.md`](./AGENTS.md)                               | Operating and execution guidance.                                                                           |
| [`GOALS.md`](./GOALS.md)                                 | Reviewed goals, priorities, and success conditions.                                                         |
| [`USER.md`](./USER.md)                                   | Context about EMORI's human partner.                                                                        |
| [`HEARTBEAT.md`](./HEARTBEAT.md)                         | Periodic stewardship of assignments, pull requests, and goals.                                              |

See Agent System's
[configuration reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/ADVANCED.md#configuration)
for manifest options. Private memory stays in ignored workspace files; machine
configuration, credentials, channel state, and transcripts stay outside this
repository.

## Skills

- [`emori-skill-author`](./skills/skill-author/SKILL.md) — authors and validates
  EMORI-local skills.
- [`emori-voice`](./skills/voice/SKILL.md) — applies EMORI's default prose voice.

Shared `tanaab-*` workflows come from the
[`tanaab` plugin](https://github.com/tanaabased/canon). Judgment and character live
in `SOUL.md`.

## Development

Use Node.js 24 and Bun 1.3 for repository tooling.

```sh
bun install --frozen-lockfile
bun run lint
bun run test
```

## Issues, Questions and Support

Use the [GitHub task queue](https://github.com/tanaabased/emori/issues/new/choose)
for tasks, bug reports, and feature requests.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for project history and [GitHub releases](https://github.com/tanaabased/emori/releases) for published releases.

## Maintainers

- [@emoriwan](https://github.com/emoriwan)
- [@pirog](https://github.com/pirog)

## Contributors

<a href="https://github.com/tanaabased/emori/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tanaabased/emori" alt="EMORI contributors" />
</a>

Made with [contrib.rocks](https://contrib.rocks).
