# Repo Guidance For `emori`

This root `AGENTS.md` is the repo-local override for Codex work in this repository. Keep repo-specific agent policy here and do not duplicate it in additional repo-local `AGENTS.md` files unless explicitly asked.

## Purpose

- This repo exists to seed a supported macOS machine with packages, dotfiles, identity or access material, and Codex plugin assets for EMORI and `@emoriwan`.
- The repo currently ships `boot.sh` as the bootstrap wrapper and `emori` as the Codex plugin bundle.

## Identity Text

- Use `EMORI` for casual prose references to the persona this repo supports.
- Preserve exact literal strings for package metadata, URLs, IDs, and external account display names.

## Source Of Truth

- `boot.sh` is the shipped shell entrypoint and the main bootstrap surface to preserve.
- `dist/` is generated publish output for hosting and release preparation; do not hand-edit it during normal work.
- Preserve the separation between `boot.sh` as source, `dist/` as generated hosting output, and `.codex-plugin/` plus `skills/` as plugin package inputs.

## Codex Plugin Guidance

- This repo is packaged as the Codex plugin `emori` via `.codex-plugin/plugin.json`.
- Prefer Codex plugin and skill-aware workflows when they are actually available in the active environment.
- Verify skill files or skill availability before claiming a skill is loaded or in use.
- If a skill is unavailable, say so plainly and continue with repo files and the current session guidance.
- Treat `.codex-plugin/`, `.mcp.json`, `assets/`, `bin/`, `lib/`, `skills/`, `utils/`, `package.json`, and this root `AGENTS.md` as the managed plugin cache surface for `bun run codex:validate`, `bun run codex:check`, and `bun run codex:sync`.
- Use `bun run codex:validate` for semantic plugin validation, including manifest paths, skill metadata, the MCP stub, and workflow script references.
- Treat `dotfiles/ai` as a separate stow-owned surface. Use `bun run ai:sync` for home-directory restow work, not for Codex plugin cache refreshes.

## EMORI Readiness Maintenance

- Treat `$emori-readiness` as a verification surface for this `emori` checkout and macOS user profile. It should not become a token-management, environment-management, external-service automation, setup, release, Leia, or general machine-admin workflow.
- For protected resource access, use native Codex connectors only when a workflow explicitly needs them and they are available. When a script or skill needs protected resources without a native connector, use the 1Password CLI beta intentionally instead of committed `.env` files or persistent shell environment secrets.
- Local readiness probes must not require or exercise the 1Password macOS desktop app. Readiness may verify that the 1Password CLI beta is installed and exposes expected CLI surfaces, but it must not run authenticated 1Password vault or Environment access probes.
- `$emori-readiness` may run its bundled read-only local helper unsandboxed by default because it verifies Tailscale desktop/daemon readiness. Do not extend that unsandboxed default to unrelated repo commands, setup, package installation, tests, release validation, protected-resource access, or broad machine administration.
- Keep README readiness content limited to human bootstrap/manual setup steps and a brief pointer to run `$emori-readiness` after setup. Do not put detailed readiness bucket or maintenance policy in README.
- Keep readiness maintenance policy in this `AGENTS.md`. Keep `skills/emori-readiness/SKILL.md` focused on how to run readiness, parse helper output, and report local setup status.
- Skill changes under `skills/**` do not automatically require readiness updates. Update readiness only when a skill adds or changes a stable machine prerequisite: a Brewfile dependency, a repo-owned dotfile, a manual app/auth/network step, or a Codex plugin install/link surface.
- When a skill introduces a prerequisite, update the source of truth first, then readiness if the requirement is repo-owned, stable, read-only, and machine-verifiable:
  - Brew package or cask requirements belong in `Brewfile`; then update the `packages` bucket only if the readiness helper should assert the new package or command.
  - Repo-owned config belongs under the relevant `dotfiles/**` package; then update the `dotfiles` bucket only if readiness should assert the stowed/generated surface.
  - Human app/auth/network setup belongs in the README manual setup checklist; then update the `manual_apps` bucket only if a local read-only probe can verify it.
  - Codex plugin install or link layout belongs in the plugin/dotfile source of truth; then update the `codex_plugins` bucket only if the local installed surface should be asserted.
- Use these helper buckets only:
  - `homebrew`: Homebrew command availability.
  - `packages`: Brewfile declarations and required command availability.
  - `dotfiles`: repo-owned stowed files and generated local config readiness.
  - `manual_apps`: installed apps and local app/auth/network readiness that cannot be fully handled by Brewfile alone, such as Codex, OpenClaw, and Tailscale.
  - `codex_plugins`: local Codex plugin links or plugin install surfaces owned by this repo.

## Validation Policy

- Never run Leia locally. Leia scenarios in this repo are CI-only unless the user explicitly asks for a local Leia run.
- Treat `bun run build` as CI-owned by default. Only run it locally when the task explicitly requires release or `dist/` verification.
- Prefer narrow local validation such as static review and `bun run lint`.
- For JavaScript library or helper changes, run `bun run test` before the relevant lint and plugin cache checks.
- For changes to managed plugin surfaces, run `bun run codex:validate`, then `bun run codex:check`; if `codex:check` reports drift, run `bun run codex:sync`.
- For `dotfiles/ai` changes, use `bun run ai:sync` when the task requires restowing the live home-directory surface.
- New `boot.sh` features and bug fixes should add the smallest practical amount of coverage to all relevant Leia examples instead of relying on one catch-all scenario.
- When cache sync, `ai:sync`, agent restart, Leia, or `bun run build` is intentionally skipped because of task scope or repo policy, say so explicitly.

## Release And Distribution

- Netlify serves the generated `dist/` folder. Preserve that contract unless the task is explicitly about changing hosting behavior.
- GitHub Releases publish the `emoriplugin-<tag>.tar.gz` archive plus the CI-prepared `dist` publish surface.
- The current `.github/workflows/release.yml` runs `bun run build`, stamps `dist/boot.sh` and `.codex-plugin/plugin.json`, packages `emoriplugin-<tag>.tar.gz`, and uploads that archive to the release.

## `boot.sh` Invariants

- Keep `BOOTBOX_URL` fixed and not user-configurable unless the task explicitly changes that contract.
- Preserve token masking in debug output. Do not leak raw 1Password tokens in logs or display commands.
- Do not reintroduce raw argument logging.
- Preserve the public wrapper contract under the `EMORI_*` namespace unless the task is explicitly about changing it. Use upstream `TANAAB_*` names only as the internal bridge when delegating to bootbox.
- Preserve the current token, SSH key, `--emori`, and `--tanaab` contract unless the task is explicitly about changing it.
- Keep `--emori` / `EMORI_SOURCE` aligned with the current source modes: `ssh`, a local git repo path, or a release version, with a fixed target of `~/tanaab/emori` and skip-or-replace behavior controlled by `--force`.
- Keep `--tanaab` / `EMORI_TANAAB` aligned with the current source modes: `ssh`, a local git repo path, a release version, or falsey disable values, with a fixed target of `~/tanaab/canon`.
- When `--tanaab` is enabled, preserve the wrapper-owned relative plugin link at `~/tanaab/emori/dotfiles/ai/.codex/plugins/tanaab` so the main `ai` stow can install `~/.codex/plugins/tanaab` back to `~/tanaab/canon`.
- After repo materialization, preserve the wrapper-side bootbox apply phase that uses the `emori` checkout's root `Brewfile` and top-level `dotfiles/*` package directories on the default `$HOME` target.
- Keep planning output aligned with actual execution order: core remediation, SSH handling, `emori` fetch, optional `tanaab` fetch and plugin-link prep, then the `emori` apply step.
