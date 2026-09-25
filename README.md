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

## Prerequisites

- Set up an [Agentbox](https://github.com/tanaabased/agentbox#quickstart), which
  provisions EMORI's managed macOS host and OpenClaw.
- Use the OpenClaw version declared by
  [`devDependencies.openclaw`](./package.json). That package declaration is the
  compatibility and CI source of truth.
- Install an Agent System build containing
  [operator-run setup support](https://github.com/tanaabased/openclaw-agent-system/pull/137)
  using its [installation guide](https://github.com/tanaabased/openclaw-agent-system#installation).
  For older OpenClaw versions, see its
  [compatibility table](https://github.com/tanaabased/openclaw-agent-system/blob/main/ADVANCED.md#version-compatibility).
- Give EMORI's 1Password service account access to the environment and SSH key
  referenced by the manifest: `EMAIL`, `GH_TOKEN`, and `EMORI_SSH_KEY`.

[`Brewfile`](./Brewfile) lists EMORI's additional requirements.

## Quickstart

After meeting the prerequisites, have EMORI's 1Password service account token
ready and set up a new checkout:

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
her, applies the declared configuration, and converges the currently verified
setup prefix: Homebrew dependencies, the Canon checkout and `tanaab` plugin, and
the official Codex plugin. Canon is cloned with EMORI's managed SSH identity only
when its checkout is absent; the Agent System source checkout remains optional.
Run `install` again when that state changes. `doctor` checks whether the installed
state still matches. Use `install --skip-setup` only for installation-only
automation.

See [EMORI Setup](./SETUP.md) for ownership boundaries, manual iMessage and Codex
onboarding, optional capabilities, and the separate private continuity path.

## Configuration

| File                                                     | Purpose                                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [`.agent-system/agent.yaml`](./.agent-system/agent.yaml) | Identity, model and effort profiles, environment sources, managed Git and GitHub, assignment admission, and ordered setup. |
| [`SETUP.md`](./SETUP.md)                                 | Operator prerequisites, setup ownership, manual onboarding, and private continuity boundaries.                             |
| [`IDENTITY.md`](./IDENTITY.md)                           | Public identity metadata.                                                                                                  |
| [`SOUL.md`](./SOUL.md)                                   | Mission, character, voice, and Covenant.                                                                                   |
| [`AGENTS.md`](./AGENTS.md)                               | Operating and execution guidance.                                                                                          |
| [`GOALS.md`](./GOALS.md)                                 | Reviewed goals, priorities, and success conditions.                                                                        |
| [`USER.md`](./USER.md)                                   | Context about EMORI's human partner.                                                                                       |
| [`HEARTBEAT.md`](./HEARTBEAT.md)                         | Periodic stewardship of assignments, pull requests, and goals.                                                             |

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
