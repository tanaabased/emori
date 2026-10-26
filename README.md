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

## Prerequisites

1. provision the Mac with [Agentbox](https://github.com/tanaabased/agentbox#quickstart).
   use OpenClaw from [`devDependencies.openclaw`](./package.json) and the runtimes
   in [`.bun-version`](./.bun-version) and [`.node-version`](./.node-version).
2. install [Agent System](https://github.com/tanaabased/openclaw-agent-system#installation)
   with shared Codex prerequisite support; Agentbox does not install it yet.
3. configure the [manifest's environment sources](./.agent-system/agent.yaml)
   for EMORI's 1Password service account. follow Agent System's
   [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding)
   for OAuth consent and credential preparation.

Homebrew and Node/npm must be available to the runtime user. installation handles
EMORI's additional [Brewfile dependencies](./Brewfile).

## Quickstart

run as the OpenClaw runtime user with EMORI's 1Password service account token
ready. keep Agent System commands in this checkout.

```sh
mkdir -p ~/tanaab
git clone https://github.com/tanaabased/emori.git ~/tanaab/emori
cd ~/tanaab/emori

# install locked dependencies, including the backup runner.
bun install --frozen-lockfile --ignore-scripts

# use EMORI's managed SSH identity for subsequent repository work.
git remote set-url origin git@github.com:tanaabased/emori.git

# store the service account token at the masked prompt.
openclaw agent-system credentials set op
openclaw agent-system validate
openclaw agent-system install --yes

# authorize EMORI's OpenAI account; adapt for another provider/profile.
openclaw models auth login --provider openai --device-code --agent emori --profile-id openai:emori
openclaw models auth order set --provider openai --agent emori openai:emori

# inspect readiness and confirm the GitHub identity is emoriwan.
openclaw agent-system doctor
openclaw agent-system tool gh -- api user --jq .login
```

for later configuration changes and readiness checks, see the
[command cheat sheet](./ADVANCED.md#command-cheat-sheet).

## Usage

have an approved assigner assign a scoped GitHub issue to `@emoriwan` in an allowed
repository. include the intended outcome and acceptance criteria; Agent System
handles admission, assessment, and implementation under the configured workflow.

configure assigners (`github.issue-assignment.allowed`) and repository owners
(`github.allowed-repository-owners`) in the installed [agent.yaml](./.agent-system/agent.yaml).
see Agent System's [GitHub workflows](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md#github-workflows)
and EMORI's [authority boundaries](./AGENTS.md#authority-and-tools).

## Configuration

| Source                                                                                          | Purpose                                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [agent.yaml](./.agent-system/agent.yaml)                                                        | Identity, models, credentials, managed tools, admission, and automations. |
| [Host setup](./.agent-system/setup-host.yaml) / [agent setup](./.agent-system/setup-agent.yaml) | Ordered installation checks and tasks.                                    |
| [OpenClaw policy](./openclaw.patch.json)                                                        | Execution, messaging, and memory settings; apply through installation.    |
| [IDENTITY.md](./IDENTITY.md) / [SOUL.md](./SOUL.md) / [AGENTS.md](./AGENTS.md)                  | Identity, character, and execution guidance.                              |
| [GOALS.md](./GOALS.md) / [USER.md](./USER.md)                                                   | Reviewed direction and partner context.                                   |

see the [manifest reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md)
for options. private memory stays ignored; credentials, channel state, and transcripts
stay outside this repository.

## Skills

| Skill                                                    | Purpose                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| [emori-skill-author](./skills/skill-author/SKILL.md)     | Creates and validates local skills.                           |
| [emori-voice](./skills/voice/SKILL.md)                   | Candid co-founder voice and audience guidance.                |
| [emori-reply](./skills/reply/SKILL.md)                   | Composes concise candidate replies without sending them.      |
| [emori-imessage-style](./skills/imessage-style/SKILL.md) | Adds destination-specific style to iMessage drafts for pirog. |

shared workflows come from [Canon's Tanaab plugin](https://github.com/tanaabased/canon).

## Automations

| Automation             | Schedule                      | Purpose                                                                                |
| ---------------------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| `backup-agent-nightly` | daily, 04:00 America/New_York | Backs up workspace and agent state to Drive, verifies delivery, and applies retention. |

configured in [agent.yaml](./.agent-system/agent.yaml); inspect installed jobs and
run history with the [advanced commands](./ADVANCED.md#command-cheat-sheet).

## Development

use the pinned runtimes in [`.bun-version`](./.bun-version) and
[`.node-version`](./.node-version).

```sh
# install the locked development dependencies.
bun install --frozen-lockfile --ignore-scripts

# check code, formatting, all local skills, and Leia syntax.
bun run lint

# run local tests without installing or changing a live agent.
bun run test
```

use `bun run lint:skills` for a focused skill check and `bun run format:write`
to apply formatting. `bun run validate` combines lint and tests.
operational Leia scenarios run in [CI](./.github/workflows/pr-examples-tests.yml),
not as part of local validation.

## Support and releases

use the [task queue](https://github.com/tanaabased/emori/issues/new/choose) for bugs,
tasks, and questions. see [CHANGELOG.md](./CHANGELOG.md) and
[published releases](https://github.com/tanaabased/emori/releases) for changes.

## Maintainers

- [@emoriwan](https://github.com/emoriwan)
- [@pirog](https://github.com/pirog)

## Contributors

<a href="https://github.com/tanaabased/emori/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tanaabased/emori" alt="EMORI contributors" />
</a>

Made with [contrib.rocks](https://contrib.rocks).
