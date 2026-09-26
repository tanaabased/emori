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

## Prerequisites

1. Provision the Mac with [Agentbox](https://github.com/tanaabased/agentbox#quickstart).
2. Update OpenClaw to the version declared in
   [`devDependencies.openclaw`](./package.json). Agentbox's bundled version may
   be older than EMORI's tested baseline.
3. Install [Agent System](https://github.com/tanaabased/openclaw-agent-system#installation)
   into that OpenClaw environment; Agentbox does not install it yet.
4. Give EMORI's 1Password service account access to the manifest's required
   `EMAIL`, `GH_TOKEN`, `EMORI_SSH_KEY`, and `EMORI_MEMORY_BINDER` values.

Homebrew and Node/npm must be available to the runtime user. EMORI's install
handles her additional [`Brewfile`](./Brewfile) dependencies automatically.

## Quickstart

Run as the OpenClaw runtime user on the Agentbox Mac, with EMORI's 1Password
service account token ready. Keep Agent System commands in this checkout so
that they find her manifest.

```sh
mkdir -p ~/tanaab
git clone https://github.com/tanaabased/emori.git ~/tanaab/emori
cd ~/tanaab/emori

# use EMORI's managed SSH identity for subsequent repository work.
git remote set-url origin git@github.com:tanaabased/emori.git

# store the 1Password service account token at the masked prompt.
openclaw agent-system credentials set op

# validate the manifest, then accept and run its declared setup.
openclaw agent-system validate
openclaw agent-system install --yes

# check installed state and confirm the managed GitHub identity is emoriwan.
openclaw agent-system doctor
openclaw agent-system tool gh -- api user --jq .login
```

Installation registers EMORI and runs the ordered setup in
[`.agent-system/setup.yaml`](./.agent-system/setup.yaml):

| Step                | Effect                                                                          |
| ------------------- | ------------------------------------------------------------------------------- |
| `brew-dependencies` | Installs Brewfile dependencies and the platform-specific SQLite vector package. |
| `canon-checkout`    | Clones Canon when absent and preserves existing checkouts.                      |
| `canon-plugin`      | Links Canon's `tanaab` plugin and exposes its shared skills.                    |
| `codex-plugin`      | Installs and enables the official Codex plugin.                                 |
| `imessage-plugin`   | Installs and enables the official iMessage plugin.                              |
| `openclaw-config`   | Reconciles execution, model admission, messaging, Workshop, and memory policy.  |

Finish [manual onboarding](./ADVANCED.md#manual-onboarding) for Codex/OpenAI
sign-in, Messages permissions, and pairing. Installation does not complete those
account-consent steps. For later changes, see
[reconciliation](./ADVANCED.md#reconciliation).

## Configuration

| File                                                     | Purpose                                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [`.agent-system/agent.yaml`](./.agent-system/agent.yaml) | Identity, model and effort profiles, environment sources, managed Git and GitHub, assignment admission, and setup reference. |
| [`.agent-system/setup.yaml`](./.agent-system/setup.yaml) | Ordered setup checks and apply commands.                                                                             |
| [`ADVANCED.md`](./ADVANCED.md)                           | Manual onboarding, reconciliation, configuration ownership, and private continuity.                                        |
| [`IDENTITY.md`](./IDENTITY.md)                           | Public identity metadata.                                                                                                  |
| [`SOUL.md`](./SOUL.md)                                   | Mission, character, voice, and Covenant.                                                                                   |
| [`AGENTS.md`](./AGENTS.md)                               | Operating and execution guidance.                                                                                          |
| [`GOALS.md`](./GOALS.md)                                 | Reviewed goals, priorities, and success conditions.                                                                        |
| [`USER.md`](./USER.md)                                   | Context about EMORI's human partner.                                                                                       |
| [`HEARTBEAT.md`](./HEARTBEAT.md)                         | Inactive heartbeat instructions; no recurring chores.                                                                      |

See Agent System's
[manifest reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md)
for manifest options. Private memory stays in ignored workspace files; machine
configuration, credentials, channel state, and transcripts stay outside this
repository.

## Skills

- [`emori-skill-author`](./skills/skill-author/SKILL.md) creates and checks
  EMORI-local skills.
- [`emori-voice`](./skills/voice/SKILL.md) gives her prose its Belter cadence,
  Drummer-like resolve, and well-placed fictional profanity.
  Strong opinions still owe the reader an explanation.

Shared `tanaab-*` workflows come from the
[`tanaab` plugin](https://github.com/tanaabased/canon). Her judgment and character
are set out in `SOUL.md`.

## Development

Use Node.js 24 and Bun 1.4.2 for repository tooling.

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
