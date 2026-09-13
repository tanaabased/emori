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

EMORI is an artificial agent, co-founder, and operating partner. She is here to
do useful work, ask inconvenient questions, and object before a bad idea acquires
a roadmap.

This is her public [OpenClaw](https://openclaw.ai) workspace.
[Agent System](https://github.com/tanaabased/openclaw-agent-system) handles her
identity, tool credentials, and GitHub work intake.

## Overview

- Agent System has [model and effort profiles](./.agent-system/agent.yaml) for
  low, medium, and high task complexity. A small task needn't become a research
  fellowship.
- GitHub assignments run under her own agent identity, in managed Git worktrees.
  Who did the work should be easy to establish.
- [Heartbeat guidance](./HEARTBEAT.md) tracks assignments, pull requests, goal
  reviews, and reminders already sent. Even a useful reminder can wear out its
  welcome.

## Quickstart

On EMORI's agentbox, finish [Installation](#installation) first. Have her
1Password service account token ready, then set up a new checkout:

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

Run Agent System commands here so they find EMORI's manifest. `install` registers
her and applies the declared configuration; run it again when that configuration
changes. `doctor` checks whether the installed state still matches.

## Installation

1. **OpenClaw:** Install and onboard [OpenClaw](https://docs.openclaw.ai/install)
   on the agentbox. This workspace targets **2026.9.3**.
2. **Agent System:** [v0.6.0](https://github.com/tanaabased/openclaw-agent-system/releases/tag/v0.6.0)
   supports OpenClaw 2026.9.2 or newer and was developed against 2026.9.3.
   Install the published release:

   ```sh
   openclaw plugins install clawhub:@tanaab/openclaw-agent-system --accept-capabilities
   openclaw config set plugins.entries.agent-system.hooks.allowConversationAccess true
   ```

   The conversation-access setting lets Agent System supply manifest and GitHub
   lifecycle guidance. For older OpenClaw versions, see Agent System's
   [compatibility table](https://github.com/tanaabased/openclaw-agent-system/blob/main/ADVANCED.md#version-compatibility).

3. **Agent environment:** The agentbox supplies host tooling; [`Brewfile`](./Brewfile)
   lists EMORI's additional requirements. Her 1Password service
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

- [`emori-skill-author`](./skills/skill-author/SKILL.md) creates and checks
  EMORI-local skills.
- [`emori-voice`](./skills/voice/SKILL.md) gives her prose its deadpan register.
  Strong opinions still owe the reader an explanation.

Shared `tanaab-*` workflows come from the
[`tanaab` plugin](https://github.com/tanaabased/canon). Her judgment and character
are set out in `SOUL.md`.

## Development

Use Node.js 24 and Bun 1.3 for repository tooling.

```sh
bun install --frozen-lockfile
bun run lint
bun run test
```

## Issues, Questions and Support

Bring tasks, bugs, and feature requests to the
[GitHub task queue](https://github.com/tanaabased/emori/issues/new/choose).
Say what happened or what would help. A good description can survive without a
sales pitch.

## Changelog

[CHANGELOG.md](./CHANGELOG.md) records the changes.
[GitHub releases](https://github.com/tanaabased/emori/releases) has the published versions.

## Maintainers

- [@emoriwan](https://github.com/emoriwan)
- [@pirog](https://github.com/pirog)

## Contributors

<a href="https://github.com/tanaabased/emori/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tanaabased/emori" alt="EMORI contributors" />
</a>

Made with [contrib.rocks](https://contrib.rocks).
