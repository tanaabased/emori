# EMORI

<p align="center">
  <img src="./assets/icon-large-circle.png" alt="EMORI" width="180" />
</p>

<p align="center">
  <a href="https://github.com/tanaabased/emori/releases"><img src="https://img.shields.io/github/v/release/tanaabased/emori?include_prereleases&sort=semver" alt="Latest release" /></a>
  <img src="https://img.shields.io/badge/macOS-26%2B-111827" alt="macOS 26+" />
  <img src="https://img.shields.io/badge/Codex-emori-00c88a" alt="Codex plugin: emori" />
</p>

`emori` seeds a macOS 26+ machine with the dependencies, dotfiles, and Codex plugin assets that
support EMORI and `@emoriwan`. It is primarily consumed through the hosted `boot.sh` wrapper at
`https://emori.boot.tanaab.sh`, and it also ships the `emori` Codex plugin bundle built from this
repo.

> Supports macOS 26 or newer.
> Assumes the machine was prepared with the Tanaab-based [agentbox](https://github.com/tanaabased/agentbox) setup and that EMORI is installed
> from a non-admin macOS user.

## Overview

`boot.sh` is a thin hosted wrapper around [bootbox](https://github.com/tanaabased/bootbox). It
installs core tools and requested SSH keys, materializes `~/tanaab/emori`, materializes
`~/tanaab/canon` unless disabled, and then applies the `emori` checkout's [`Brewfile`](./Brewfile)
plus top-level [`dotfiles/`](./dotfiles/) packages onto `$HOME`. After the apply step, it checks
OpenClaw and runs `openclaw onboard` when OpenClaw does not already appear ready.

After bootstrap, complete the manual setup checklist so the expected apps and plugins are
available.

## Quickstart

`boot.sh` requires a 1Password service account token so it can fetch private SSH keys during
bootstrap.

```sh
/bin/bash -c "$(curl -fsSL https://emori.boot.tanaab.sh/boot.sh)" bootemori \
  --op-token "$OP_TOKEN" \
  --ssh-key "your-vault/your-ssh-key:id_emori"
```

`--ssh-key` uses `vault/item[:filename]`. Replace the example value with your own 1Password SSH key item. Note that you can use `--ssh-key` multiple times.

This default flow:

- installs core dependencies and SSH keys
- materializes the profile checkout into `~/tanaab/emori`
- clones `git@github.com:tanaabased/canon.git` into `~/tanaab/canon`
- applies the `emori` Brewfile and dotpkgs onto `$HOME`
- onboards OpenClaw if its app and CLI are installed but its status check does not pass

When the script finishes, complete the manual setup checklist below.

## Manual Setup Checklist

### Codex

- Plugins from `Tanaabstore`:
  - `emori`
  - `tanaab`

### Desktop Apps

- Open Codex and OpenClaw from EMORI's macOS user session.
- Complete any required sign-in or onboarding prompts for those apps. The wrapper attempts
  OpenClaw onboarding automatically unless `--skip-openclaw` or `EMORI_SKIP_OPENCLAW` is set.

After completing this checklist, ask Codex to run `$emori-readiness`.

## What Gets Installed

### Brewfile

[`Brewfile`](./Brewfile) is the single source of truth for base machine dependencies. It covers
Homebrew tooling plus the core CLI and runtime stack used here, including Git and GitHub CLI,
Bun, Codex CLI and desktop app, OpenClaw CLI and desktop app, Warp, Homebrew Node 24, Python,
ripgrep, Stow, the 1Password CLI beta, and Zsh. Homebrew cask apps install into
`~/Applications` for the non-admin EMORI user.

### Dotpkgs

- [`ai`](./dotfiles/ai): Codex agent defaults, portable global Codex config defaults, and the local `Tanaabstore` marketplace definition for `emori` and `tanaab`.
- [`gh`](./dotfiles/gh): GitHub CLI config.
- [`git`](./dotfiles/git): Git config, including the Lando-specific include.
- [`ssh`](./dotfiles/ssh): SSH config plus public-key material.
- [`theme`](./dotfiles/theme): Tanaab light/dark theme JSON assets.
- [`zsh`](./dotfiles/zsh): Shell startup config, including Homebrew and Node 24 PATH setup.

### Skills

- [`emori-skill-author`](./skills/skill-author/): creates, standardizes, and validates EMORI-based repo-local skills.
- [`emori-readiness`](./skills/emori-readiness/): verifies this `emori` repo and macOS user profile are ready for Codex work as `emoriwan`.

This plugin surface is intentionally small. Broader shared canon skills come from the paired
`tanaab` plugin.

## Usage

Use the hosted script's help output for the current option and environment-variable contract.

```sh
/bin/bash -c "$(curl -fsSL https://emori.boot.tanaab.sh/boot.sh)" bootemori --help
```

The `bootemori` argument is the `$0` placeholder for `bash -c`; wrapper options start after it.
`EMORI_OP_TOKEN`, `OP_SERVICE_ACCOUNT_TOKEN`, or `--op-token` can provide the 1Password token.
Interactive installs show the planned actions and wait for confirmation when a terminal is available.

## Advanced

If you want a reusable local command, download the script as `bootemori` first.

```sh
curl -fsSL https://emori.boot.tanaab.sh -o bootemori
chmod +x bootemori
./bootemori --help
```

To install it as a command, move it into a directory on `PATH`, such as `~/.local/bin`.

```sh
mkdir -p ~/.local/bin
mv bootemori ~/.local/bin/bootemori
bootemori --help
```

If you are not sure which directories are on `PATH`, inspect `echo "$PATH"` and choose one from that list.

## Development

This repo uses Bun for repo-local tooling.

```sh
bun install
bun run test
bun run lint
```

For day-to-day local work, the repo ships separate commands for plugin cache refreshes and `ai`
dotpkg restows.

```sh
bun run codex:validate
bun run codex:check
bun run codex:sync
bun run ai:sync
```

- `bun run codex:validate` runs `codexsync validate` to validate the plugin manifest, skills, MCP stub, and workflow script references.
- `bun run codex:check` runs `codexsync check` to check the installed `emori` cache copy.
- `bun run codex:sync` runs `codexsync sync` to refresh that cache copy when you want Codex to pick up local plugin changes.
- `bun run ai:sync` restows [`dotfiles/ai`](./dotfiles/ai/) into `$HOME` and generates
  `~/.codex/config.toml` from portable shared defaults plus optional local overrides.

The Codex config files under the `ai` dotpkg use a shared/local/generated model:

- `dotfiles/ai/.codex/config.shared.toml` is repo-owned and must contain only portable global
  Codex settings such as personality and stable feature defaults.
- Current shared defaults include `gpt-5.5`, `xhigh` reasoning, disabled automatic commit
  attribution, VS Code file links, Memories, multi-agent support, and Fast mode.
- Fast mode is intentional: `service_tier = "fast"` plus `[features].fast_mode = true` can make
  supported Codex turns faster, but may increase credit consumption.
- `~/.codex/config.local.toml` is machine-owned and must not be tracked here. Use it for project
  trust entries, local paths, marketplace paths, notification hooks, plugin cache paths, and other
  machine-specific Codex settings.
- `~/.codex/config.toml` is generated by `bun run ai:sync`; do not hand-edit it.
- Global instruction preferences that do not have native Codex config keys belong in
  `dotfiles/ai/.codex/AGENTS.md`; this repo intentionally does not use `developer_instructions`
  in shared config.

Set `EMORI_CODEX_CONFIG_SYNC=false` or pass `--no-codex-config` to skip config generation for one
run.

Run `bun run test` for JavaScript library and helper changes before the relevant lint and plugin
cache checks.

`bun run build` is CI-owned by default. Only run it locally when the task explicitly requires
`dist/` or release verification.

Leia scenarios are also CI-owned by default. Do not run Leia locally unless the task explicitly
needs a local Leia run.

## Issues, Questions and Support

Use the [GitHub issue queue](https://github.com/tanaabased/emori/issues/new/choose) for bugs, regressions,
or feature requests.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history and
[GitHub releases](https://github.com/tanaabased/emori/releases) for published artifacts.

## Maintainers

- [@emoriwan](https://github.com/emoriwan)
- [@pirog](https://github.com/pirog)

## Contributors

<a href="https://github.com/tanaabased/emori/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tanaabased/emori" />
</a>

Made with [contrib.rocks](https://contrib.rocks).
