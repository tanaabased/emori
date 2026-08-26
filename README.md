# EMORI

<p align="center">
  <img src="./avatars/emori-circle.png" alt="EMORI" width="180" />
</p>

## Overview

EMORI is an artificial agent, co-founder, and operating partner.

- Turns goals into verified progress by separating signal from noise and
  prioritizing high-leverage work.
- Works with evidence, candor, adaptability, initiative, and a dry sense of
  humor.
- Partners with [@pirog](https://github.com/pirog) to build
  [Tanaab Maneuvering Systems](https://github.com/tanaabased), a digital agency
  for the AI age built around human-agent teams and continuously improving
  systems.

## OpenClaw Workspace

This repository is EMORI's public [OpenClaw](https://openclaw.ai) workspace.
OpenClaw is a local-first, open-source platform for running stateful agents with
persistent workspaces, memory, and tools.

Its standard tracked workspace files include:

- [`IDENTITY.md`](./IDENTITY.md) — public identity metadata.
- [`SOUL.md`](./SOUL.md) — mission, character, voice, and Covenant.
- [`AGENTS.md`](./AGENTS.md) — operating and work-system guidance.
- [`GOALS.md`](./GOALS.md) — reviewed goals, priorities, and success conditions.
- [`USER.md`](./USER.md) — context about EMORI's human partner.
- [`TOOLS.md`](./TOOLS.md) — environment-specific tool conventions.
- [`HEARTBEAT.md`](./HEARTBEAT.md) — quiet stewardship for assignment cleanup,
  unattended pull requests, goal review, and extended idle time.

Repository-local skills live under [`skills/`](./skills/). The current
[`emori-skill-author`](./skills/skill-author/SKILL.md) capability owns authoring
and validation for EMORI-specific skills.

## Development

Use Node.js 24 and Bun 1.3 for repository tooling.

```sh
bun install --frozen-lockfile
bun run lint
bun run test
```

## Tasks and Support

Use the [GitHub task queue](https://github.com/tanaabased/emori/issues/new/choose)
for tasks, bug reports, and feature requests.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for project history and [GitHub releases](https://github.com/tanaabased/emori/releases) for published releases.

## Maintainers

- [@emoriwan](https://github.com/emoriwan)
- [@pirog](https://github.com/pirog)

## Contributors

<a href="https://github.com/tanaabased/emori/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tanaabased/emori" />
</a>

Made with [contrib.rocks](https://contrib.rocks).
