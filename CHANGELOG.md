## {{ UNRELEASED_VERSION }} - [{{ UNRELEASED_DATE }}]({{ UNRELEASED_LINK }})

## v1.0.0 - [October 27, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0)

### Features

- Added co-founder guidance for assessment and implementation, concise shared replies, and model routing that prefers the medium profile for routine substantive work. [#119](https://github.com/tanaabased/emori/issues/119) [#142](https://github.com/tanaabased/emori/pull/142)
- Added destination-aware iMessage styling for verified replies to pirog, reusing the shared voice and composer. [#124](https://github.com/tanaabased/emori/issues/124) [#143](https://github.com/tanaabased/emori/pull/143)
- Added nightly verified Google Drive backups with five-copy retention limited to proven, job-owned archives. [#111](https://github.com/tanaabased/emori/issues/111) [#113](https://github.com/tanaabased/emori/pull/113) [#117](https://github.com/tanaabased/emori/pull/117)
- Enabled EMORI to self-assign eligible issues within her existing repository and admission scope. [#102](https://github.com/tanaabased/emori/issues/102) [#103](https://github.com/tanaabased/emori/pull/103)

### Bug Fixes

- Fixed fresh setup to create missing private memory storage without overwriting existing notes. [#97](https://github.com/tanaabased/emori/issues/97) [#98](https://github.com/tanaabased/emori/pull/98)
- Fixed older backup failures blocking fresh captures. Cleanup failures no longer turn a confirmed delivery into a failed backup. [#122](https://github.com/tanaabased/emori/issues/122) [#123](https://github.com/tanaabased/emori/pull/123) [#138](https://github.com/tanaabased/emori/issues/138) [#139](https://github.com/tanaabased/emori/pull/139)
- Fixed setup overwriting the shared iMessage default account or collaboration-managed session visibility. [#86](https://github.com/tanaabased/emori/issues/86) [#89](https://github.com/tanaabased/emori/pull/89) [#104](https://github.com/tanaabased/emori/issues/104) [#105](https://github.com/tanaabased/emori/pull/105)
- Fixed the local skill templates rejecting `Required Reading` sections.
- Distinguished missing executables, output-buffer overflows, and other subprocess failures in setup diagnostics.
- Fixed the quickstart auth-order command to supply the required provider.

### Improvements

- Centralized model admission, runtime bindings, and effort in `agent.yaml`, with shared Codex prerequisite setup. [#91](https://github.com/tanaabased/emori/issues/91) [#92](https://github.com/tanaabased/emori/pull/92) [#93](https://github.com/tanaabased/emori/pull/93) [#107](https://github.com/tanaabased/emori/pull/107) [#109](https://github.com/tanaabased/emori/pull/109)
- Migrated GitHub intake and workflow configuration to Agent System's v3 contract. [#110](https://github.com/tanaabased/emori/issues/110) [#120](https://github.com/tanaabased/emori/pull/120) [#126](https://github.com/tanaabased/emori/pull/126)
- Renamed the nightly automation to `backup-agent-nightly`. [#132](https://github.com/tanaabased/emori/issues/132) [#136](https://github.com/tanaabased/emori/pull/136)
- Updated `emori-voice` to a candid co-founder voice with verified-colleague humor, replacing the fictional vocabulary palette. [#140](https://github.com/tanaabased/emori/issues/140) [#141](https://github.com/tanaabased/emori/pull/141)
- Updated default and medium model profiles to GPT-6.1 Sol, reserving Astra for exceptional reasoning demands. [#100](https://github.com/tanaabased/emori/issues/100) [#101](https://github.com/tanaabased/emori/pull/101) [#119](https://github.com/tanaabased/emori/issues/119) [#142](https://github.com/tanaabased/emori/pull/142)

### Developer Notes

- Simplified setup, usage, and development documentation, consolidated behavioral checks, and made EMORI’s voice the documentation house style.
- Added validation for every local skill and explicit instructions for when to read governing references.
- Moved private memory ignore checks into CI and kept executable Leia scenarios out of local pre-push validation. [#114](https://github.com/tanaabased/emori/pull/114) [#129](https://github.com/tanaabased/emori/issues/129) [#130](https://github.com/tanaabased/emori/pull/130)
- Colocated setup tests with their implementation.
- Updated Bun to `1.4.4` and made lint/format runtime selection explicit.
- Updated the OpenClaw baseline to `2026.10.6`; excluded OpenClaw from automatic dependency upgrades. [#133](https://github.com/tanaabased/emori/issues/133) [#134](https://github.com/tanaabased/emori/pull/134) [#128](https://github.com/tanaabased/emori/issues/128) [#135](https://github.com/tanaabased/emori/pull/135)

## v1.0.0-beta.13 - [September 29, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.13)

- Added backup defaults for private continuity files and required OpenClaw agent state, with archives ignored by Git. [#80](https://github.com/tanaabased/emori/issues/80) [#81](https://github.com/tanaabased/emori/pull/81)
- Added Google Workspace credential bindings through Agent System and `gog`. [#73](https://github.com/tanaabased/emori/issues/73) [#79](https://github.com/tanaabased/emori/pull/79)
- Added Leia coverage for backup creation, verification, and staged recovery of private files and the agent database. [#80](https://github.com/tanaabased/emori/issues/80) [#81](https://github.com/tanaabased/emori/pull/81)
- Configured `pirog` as EMORI's pinned pull-request reviewer. [#72](https://github.com/tanaabased/emori/issues/72) [#75](https://github.com/tanaabased/emori/pull/75)
- Included `openclaw/tap/gogcli` in `Brewfile` so setup installs the Google CLI dependency. [#77](https://github.com/tanaabased/emori/issues/77) [#78](https://github.com/tanaabased/emori/pull/78)
- Moved setup into explicit host and agent YAML files, installing host dependencies before managed-tool reconciliation. [#74](https://github.com/tanaabased/emori/issues/74) [#76](https://github.com/tanaabased/emori/pull/76) [#73](https://github.com/tanaabased/emori/issues/73) [#79](https://github.com/tanaabased/emori/pull/79)
- Updated installation coverage to use `--skip-setup-agent`, checking host dependencies and repeat-install convergence. [#73](https://github.com/tanaabased/emori/issues/73) [#79](https://github.com/tanaabased/emori/pull/79)

## v1.0.0-beta.12 - [September 26, 2026](https://github.com/tanaabased/emori/releases/tag/v1.0.0-beta.12)

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
