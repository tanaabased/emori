## {{ UNRELEASED_VERSION }} - [{{ UNRELEASED_DATE }}]({{ UNRELEASED_LINK }})

- Updated Git and GitHub guidance to use `@pirog` in Codex and `@emoriwan` through Agent System in OpenClaw.

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
