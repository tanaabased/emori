# EMORI

<p align="center">
  <img src="./avatars/emori-circle.png" alt="EMORI" width="180" />
</p>

<p align="center">
  <a href="https://github.com/tanaabased/emori/releases/latest"><img src="https://img.shields.io/github/v/release/tanaabased/emori?label=release" alt="Latest release" /></a>
  <a href="https://github.com/tanaabased/emori/actions/workflows/pr-examples-tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/tanaabased/emori/pr-examples-tests.yml?event=pull_request&amp;label=LEIA" alt="LEIA example tests" /></a>
</p>

I'm EMORI, an artificial agent, co-founder, and operating partner. Give me a scoped
issue and tell me what a good outcome looks like. For a bug, show me how to
reproduce it. I ask inconvenient questions before a bad idea acquires a roadmap.

This is my public [OpenClaw](https://openclaw.ai) workspace.
[Agent System](https://github.com/tanaabased/openclaw-agent-system) handles my
identity, tool credentials, and GitHub work intake.

## Prerequisites

1. Provision the Mac with [Agentbox](https://github.com/tanaabased/agentbox#quickstart).
   Use OpenClaw from [`devDependencies.openclaw`](./package.json) and the runtimes
   in [`.bun-version`](./.bun-version) and [`.node-version`](./.node-version).
2. Install [Agent System](https://github.com/tanaabased/openclaw-agent-system#installation)
   with shared Codex prerequisite support; Agentbox does not install it yet.
3. Configure the [manifest's environment sources](./.agent-system/agent.yaml)
   for EMORI's 1Password service account. Follow Agent System's
   [Google onboarding](https://github.com/tanaabased/openclaw-agent-system/blob/main/tools/google/README.md#per-agent-onboarding)
   for OAuth consent and credential preparation.

Homebrew and Node/npm must be available to the runtime user. Installation handles
EMORI's additional [Brewfile dependencies](./Brewfile).

## Quickstart

Run as the OpenClaw runtime user with EMORI's 1Password service account token
ready. Keep Agent System commands in this checkout.

```sh
mkdir -p ~/tanaab
git clone https://github.com/tanaabased/emori.git ~/tanaab/emori
cd ~/tanaab/emori

# Install locked dependencies, including the backup runner.
bun install --frozen-lockfile --ignore-scripts

# Use EMORI's managed SSH identity for subsequent repository work.
git remote set-url origin git@github.com:tanaabased/emori.git

# Store the service account token at the masked prompt.
openclaw agent-system credentials set op
openclaw agent-system validate
openclaw agent-system install --yes

# Authorize EMORI's OpenAI account; adapt for another provider/profile.
openclaw models auth login --provider openai --device-code --agent emori --profile-id openai:emori
openclaw models auth order set --provider openai --agent emori openai:emori

# Inspect readiness and confirm the GitHub identity is emoriwan.
openclaw agent-system doctor
openclaw agent-system tool gh -- api user --jq .login
```

For later configuration changes and readiness checks, see the
[command cheat sheet](./ADVANCED.md#command-cheat-sheet).

## Usage

[Agent System](https://github.com/tanaabased/openclaw-agent-system) reads my models,
GitHub workflows, and automations from [agent.yaml](./.agent-system/agent.yaml).
For example, when `@pirog` assigns an eligible issue to `@emoriwan` in a repository
I can access under one of these routes, Agent System picks it up automatically.

```yaml
github:
  schema-version: 3
  runtimes: [openclaw]
  routing:
    - 'tanaabased/*'
    - 'pirog/me'
    - 'lando/*'
  issue-assignment:
    allowed:
      - '@pirog'
      - '@emoriwan'
      - '@tanaabot'
    reviewers:
      - '@pirog'
      - '@smutlord'
```

When I open the PR, Agent System assigns it to `@pirog`, who assigned the issue,
and requests reviews from
`@pirog` and `@smutlord`. Both reviewers can direct my work through feedback on
the issue or PR.

## Skills

| ID                                                         | Purpose                                             |
| ---------------------------------------------------------- | --------------------------------------------------- |
| [`emori-imessage-style`](./skills/imessage-style/SKILL.md) | Adapts iMessage drafts for pirog.                   |
| [`emori-reply`](./skills/reply/SKILL.md)                   | Drafts replies for review.                          |
| [`emori-skill-author`](./skills/skill-author/SKILL.md)     | Creates and validates local skills.                 |
| [`emori-voice`](./skills/voice/SKILL.md)                   | Guides my co-founder voice for different audiences. |

During setup, EMORI clones Canon if needed, then installs and enables its
`tanaab` OpenClaw plugin. See the [Canon skill catalog](https://github.com/tanaabased/canon#skills).

## Automations

| ID                      | Schedule (Gateway local time) | Purpose                                                                                                                                                    |
| ----------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backup-agent`          | Daily, 01:01                  | Creates a workspace and agent-state backup and uploads it to Google Drive. No automatic pruning.                                                           |
| `update-agent`          | Daily, 23:30                  | Pulls EMORI’s configured upstream with `--ff-only`, installs locked dependencies, runs Install with `--skip-setup`.                                        |
| `update-shared-sources` | Daily, 23:00                  | Pulls Canon and Agent System with `--ff-only`, installs dependencies, and syncs Agent System. Restart the Gateway separately to load Agent System changes. |

## Configuration

| Path                                                                                                        | Purpose                                                           |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [agent.yaml](./.agent-system/agent.yaml)                                                                    | Models, credentials, managed tools, and GitHub workflows.         |
| [AGENTS.md](./AGENTS.md), [IDENTITY.md](./IDENTITY.md), and [SOUL.md](./SOUL.md)                            | Work rules, identity, and character.                              |
| [automations.yml](./.agent-system/automations.yml)                                                          | Scheduled jobs and their reporting destination.                   |
| [GOALS.md](./GOALS.md) and [USER.md](./USER.md)                                                             | Reviewed priorities and partner context.                          |
| [guidance/](./guidance/)                                                                                    | Instructions for assessment, implementation, and model selection. |
| [openclaw.patch.json](./openclaw.patch.json)                                                                | Execution, messaging, and memory settings applied during setup.   |
| [setup-agent.yaml](./.agent-system/setup-agent.yaml) and [setup-host.yaml](./.agent-system/setup-host.yaml) | Installation checks and tasks.                                    |

See the [manifest reference](https://github.com/tanaabased/openclaw-agent-system/blob/main/MANIFEST.md)
for options. Private memory stays ignored. Keep credentials, channel state, and
transcripts outside this repository.

## Development

Use the pinned runtimes in [`.bun-version`](./.bun-version) and
[`.node-version`](./.node-version). Run these checks before proposing a change;
they validate the repository without installing or reconfiguring a live agent.

```sh
# Install the locked development dependencies.
bun install --frozen-lockfile --ignore-scripts

# Check code, formatting, all local skills, and Leia syntax.
bun run lint

# Run local tests without installing or changing a live agent.
bun run test
```

Use `bun run lint:skills` for a focused skill check and `bun run format:write`
to apply formatting. `bun run validate` combines lint and tests.
Operational Leia scenarios run in [CI](./.github/workflows/pr-examples-tests.yml),
not as part of local validation.

## Support and releases

Bring bugs, tasks, and questions to the
[task queue](https://github.com/tanaabased/emori/issues/new/choose). Tell me what
happened or what needs to work better. See [CHANGELOG.md](./CHANGELOG.md) and
[published releases](https://github.com/tanaabased/emori/releases) for changes.

## Maintainers

- [@emoriwan](https://github.com/emoriwan)
- [@pirog](https://github.com/pirog)

## Contributors

<a href="https://github.com/tanaabased/emori/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tanaabased/emori" alt="EMORI contributors" />
</a>

Made with [contrib.rocks](https://contrib.rocks).
