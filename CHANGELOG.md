## {{ UNRELEASED_VERSION }} - [{{ UNRELEASED_DATE }}]({{ UNRELEASED_LINK }})

### Features

- Added OpenAI memory search with `text-embedding-3-small` and the required `EMORI_MEMORY_BINDER` credential. [#55](https://github.com/tanaabased/emori/issues/55) [#56](https://github.com/tanaabased/emori/pull/56)
- Added ordered, repeatable Agent System setup for dependencies, Canon, Codex, iMessage, and EMORI's OpenClaw policy. [#65](https://github.com/tanaabased/emori/issues/65) [#66](https://github.com/tanaabased/emori/pull/66)
- Added setup for EMORI's named iMessage account and routing, with send-only messaging tools. [#65](https://github.com/tanaabased/emori/issues/65) [#66](https://github.com/tanaabased/emori/pull/66)
- Extended SQLite vector dependency support to Intel Macs alongside Apple Silicon. [#65](https://github.com/tanaabased/emori/issues/65) [#66](https://github.com/tanaabased/emori/pull/66)

### Bug Fixes

- Fixed setup to stop on failed or malformed plugin inspection instead of treating it as permission to install. [#65](https://github.com/tanaabased/emori/issues/65) [#71](https://github.com/tanaabased/emori/pull/71)

### Improvements

- Added a 50-entry fictional vocabulary and phrase palette, with meaning-first selection and loose frequency guidance. [#71](https://github.com/tanaabased/emori/pull/71)
- Configured Workshop to propose skills and restricted session visibility to the active agent. [#65](https://github.com/tanaabased/emori/issues/65) [#66](https://github.com/tanaabased/emori/pull/66)
- Configured vector-backed memory search across memory files and sessions, and disabled the legacy `session-memory` hook. [#65](https://github.com/tanaabased/emori/issues/65) [#66](https://github.com/tanaabased/emori/pull/66)
- Consolidated installation guidance into `README.md` and `ADVANCED.md`, including prerequisites and `install --yes`. [#71](https://github.com/tanaabased/emori/pull/71)
- Enabled release operations in EMORI's Agent System GitHub policy. [#70](https://github.com/tanaabased/emori/pull/70)
- Removed recurring heartbeat checks, reminders, and goal-task creation; left runtime wake-up scheduling unchanged. [#71](https://github.com/tanaabased/emori/pull/71)
- Updated EMORI's default voice to Belter Creole and Camina Drummer's cadence across private, public, and tool-sent prose. [#60](https://github.com/tanaabased/emori/issues/60) [#61](https://github.com/tanaabased/emori/pull/61) [#71](https://github.com/tanaabased/emori/pull/71)
- Updated low and medium task profiles to GPT-6 Luna and Sol, with matching model admission and Codex runtime bindings. [#70](https://github.com/tanaabased/emori/pull/70)

### Developer Notes

- Added isolated installation and full-setup scenarios, plus regression tests for plugin inspection and configuration preservation. [#62](https://github.com/tanaabased/emori/issues/62) [#63](https://github.com/tanaabased/emori/pull/63) [#65](https://github.com/tanaabased/emori/issues/65) [#66](https://github.com/tanaabased/emori/pull/66) [#71](https://github.com/tanaabased/emori/pull/71)
- Updated Bun tooling to `1.4.2` and pinned the OpenClaw test baseline to `2026.9.6`; retained Node.js 24. [#65](https://github.com/tanaabased/emori/issues/65) [#66](https://github.com/tanaabased/emori/pull/66) [#71](https://github.com/tanaabased/emori/pull/71)
- Updated Leia to `2.0.0` and ran its CLI through Bun. [#58](https://github.com/tanaabased/emori/pull/58) [#68](https://github.com/tanaabased/emori/pull/68)
- Updated release automation to validate the triggering commit and publish through shared Tanaab Actions. [#62](https://github.com/tanaabased/emori/issues/62) [#63](https://github.com/tanaabased/emori/pull/63)

## v1.0.0-beta.11 - [September 13, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.11)

- Added Agent System model and effort profiles for low, medium, and high task complexity. [#50](https://github.com/tanaabased/emori/issues/50) [#51](https://github.com/tanaabased/emori/pull/51)
- Added `emori-voice` and sharpened EMORI's guidance on evidence, tradeoffs, and candid disagreement. [#37](https://github.com/tanaabased/emori/issues/37) [#48](https://github.com/tanaabased/emori/pull/48)
- Consolidated runtime and tool guidance into `AGENTS.md`. [#42](https://github.com/tanaabased/emori/issues/42)
- Fixed failed forced skill replacements to preserve the existing skill or retain a recoverable backup. [#53](https://github.com/tanaabased/emori/pull/53)
- Fixed macOS ARM64 semantic memory support with the `sqlite-vec` runtime dependency. [#42](https://github.com/tanaabased/emori/issues/42)
- Fixed skill YAML generation and validation for punctuation, comments, escaped strings, and typed metadata. [#53](https://github.com/tanaabased/emori/pull/53)
- Preserved `EMORI` as the display name when registering the lowercase `emori` workspace. [#42](https://github.com/tanaabased/emori/issues/42)
- Restored state-aware heartbeat stewardship for cleanup, pull requests, goal review, and idle-work reminders. [#34](https://github.com/tanaabased/emori/issues/34)
- Updated Agent System policy to recognize `pirog` as EMORI's operator-owner. [aa80e6a](https://github.com/tanaabased/emori/commit/aa80e6a80260584224b0a09f7649cb70361a885d)

## v1.0.0-beta.10 - [August 24, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.10)

### Work System

- Added Canon-aligned `Task`, `Bug`, and `Feature` issue forms for low-friction intake.
- Added proactive iMessage guidance through OpenClaw's native `message` tool.
- Added trusted issue-assignment notifications scoped to approved actors and repository owners.
- Updated Agent System policy to allow managed local Git rewrites while denying force pushes, remote-ref deletion, and releases.
- Updated behavioral evaluations for Agent System lifecycle sessions and assignment isolation.
- Updated EMORI-local coding skill templates and validation coverage to match current Canon lifecycle guidance.
- Updated task-management, Git, and GitHub routing to preserve complete operations and distinct `@pirog` and `@emoriwan` principals.

### Identity and Direction

- Fixed EMORI's OpenClaw avatar to use the square asset. [#32](https://github.com/tanaabased/emori/pull/32)
- Refocused EMORI's goals on piloting Canon and Agent System through real repository work.
- Updated EMORI's public profile with a circular README avatar and Agent System emoji.
- Updated partner context and references to use `pirog`.

### Maintenance

- Fixed repository linting to ignore private workspace artifacts.
- Updated release validation to run unit tests before preparing releases.

## v1.0.0-beta.9 - [August 11, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.9)

- Added a 256×256 `avatars/emori.png` for EMORI's OpenClaw identity.
- Removed recurring heartbeat work and its obsolete behavioral evaluations.
- Updated Git and GitHub guidance to use `agent_system_git`, `agent_system_git_worktree`, and `agent_system_github`.

## v1.0.0-beta.8 - [August 11, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.8)

- Added Agent System configuration for EMORI's external credentials, signed Git worktrees, GitHub identity, and operation policies. [#24](https://github.com/tanaabased/emori/pull/24)
- Removed EMORI's temporary Stow-managed Git and SSH bridge after verifying the Agent System cutover. [#24](https://github.com/tanaabased/emori/pull/24)
- Updated EMORI's goals to prioritize Agent System and include GitHub notification routing in that workstream. [#25](https://github.com/tanaabased/emori/pull/25)

## v1.0.0-beta.7 - [July 30, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.7)

- Added credential-free `Leia` coverage that registers EMORI as an OpenClaw workspace and imports `IDENTITY.md`. [#22](https://github.com/tanaabased/emori/pull/22)
- Added EMORI-first layering and local validation for repository-local `emori-*` skills. [#22](https://github.com/tanaabased/emori/pull/22)
- Added `Mocha` contract tests for EMORI's local skill scaffolding and validation. [#22](https://github.com/tanaabased/emori/pull/22)

## v1.0.0-beta.6 - [July 22, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.6)

- Added `imsg` setup and a temporary Stow package for EMORI's Git identity, SSH signing, and GitHub access.
- Reconstituted `emori` as EMORI's public OpenClaw workspace with tracked identity, goals, operating guidance, and heartbeat. [#17](https://github.com/tanaabased/emori/pull/17)
- Removed the legacy macOS bootstrap, hosted installer, readiness checks, Codex plugin, and broad dotfile suite. [#17](https://github.com/tanaabased/emori/pull/17)

## v1.0.0-beta.5 - [June 17, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.5)

- Fixed hosted bootstrap confirmation to read from `/dev/tty` when `stdin` is piped. [#11](https://github.com/tanaabased/emori/pull/11)
- Updated README hosted and local `bootemori` usage guidance. [#11](https://github.com/tanaabased/emori/pull/11)

## v1.0.0-beta.4 - [June 17, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.4)

- Added GitHub SSH `known_hosts` seeding before SSH clones. [#9](https://github.com/tanaabased/emori/pull/9)
- Added quiet, no-sudo bootbox delegation for EMORI bootstrap. [#9](https://github.com/tanaabased/emori/pull/9)
- Updated bootbox delegation to use the `BOOTBOX_*` namespace. [#9](https://github.com/tanaabased/emori/pull/9)

## v1.0.0-beta.3 - [June 17, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.3)

- Added agentbox brewgroup remediation for Homebrew prefix failures. [#8](https://github.com/tanaabased/emori/pull/8)
- Added Homebrew cask appdir policy for `~/Applications`. [#8](https://github.com/tanaabased/emori/pull/8)
- Added Homebrew prefix access guard in `boot.sh`. [#8](https://github.com/tanaabased/emori/pull/8)
- Removed Tailscale from EMORI-owned dependencies. [#8](https://github.com/tanaabased/emori/pull/8)
- Updated desktop app readiness to prefer `~/Applications`. [#8](https://github.com/tanaabased/emori/pull/8)

## v1.0.0-beta.2 - [June 16, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.2)

- Added initial OpenClaw bootstrapping. [#6](https://github.com/tanaabased/emori/pull/6)

## v1.0.0-beta.1 - [June 6, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.1)

- Initial EMORI beta release.
