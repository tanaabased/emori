---
name: emori-readiness
description: EMORI-based workflow to verify that a bootstrapped EMORI machine is ready for Codex work as emoriwan.
license: MIT
metadata:
  type: workflow
  owner: emoriwan
  tags:
    - emoriwan
    - workflow
    - validation
---

# EMORI Readiness

## Overview

Use this skill only to verify that the current `emori` checkout and macOS user profile are ready for
Codex work as `emoriwan`. It checks the repo-owned machine setup, manually configured app
readiness, and Codex plugin links. It does not configure tokens, run setup, manage environments,
perform external service automation, or validate releases.

## When to Use

- Run after `boot.sh` and the README manual setup checklist have completed.
- Run before relying on Codex plugin skills, 1Password CLI beta behavior, or desktop app readiness.
- Run when moving this EMORI environment to a new interactive macOS user profile.

## When Not to Use

- Do not use this skill for Agentbox or robot-user readiness.
- Do not use this skill to configure external service tokens, write runtime env files, configure
  1Password shell plugins, or provision secrets.
- Do not use this skill to mutate external service data, post readiness updates, run setup, run
  release validation, or perform general machine administration.

## Preconditions

- Work from the `emori` checkout at `/Users/emori/tanaab/emori`.
- The user should have completed the README manual setup checklist first.

## Workflow

1. Run the bundled local probe:

   ```sh
   bun ./skills/emori-readiness/scripts/check-machine.js
   ```

   This helper is read-only, strips 1Password token fallback environment variables from `op`
   subprocesses, and does not require or exercise the 1Password macOS desktop app.

2. Parse the JSON output and summarize each `fail` and `warn` check with its `remediation` text.
   The helper emits checks in dependency order and every check includes one stable `bucket`:
   `homebrew`, `packages`, `dotfiles`, `manual_apps`, then `codex_plugins`.

   Bucket meanings:
   - `homebrew`: Homebrew command availability and prefix access.
   - `packages`: Brewfile declarations and required command availability.
   - `dotfiles`: repo-owned stowed files and generated local config readiness.
   - `manual_apps`: installed apps and local app/auth/network readiness.
   - `codex_plugins`: local Codex plugin links or plugin install surfaces owned by this repo.

   The bucket order is intentional: package manager availability comes before package contracts,
   package contracts come before dotfile checks, dotfiles come before manual app readiness, and
   app readiness comes before Codex plugin readiness.

3. Close with a concise readiness summary:
   - ready: no local failures
   - ready with warnings: no local failures and warnings present
   - not ready: any local failure

   Use this report format: put the final status first as `🟢 Ready`, `🟡 Ready with warnings`,
   or `🔴 Not ready`, then include a status list for these surfaces. Use `✅` for passing
   surfaces, `⚠️` for warning surfaces, and `❌` for failing surfaces:

   ```markdown
   🟢 **Ready**

   - ✅ Homebrew (command and prefix access)
   - ✅ Packages and Brewfile contract
   - ✅ Dotfiles
   - ✅ Desktop apps (Codex, OpenClaw, Warp)
   - ✅ 1Password CLI beta
   - ✅ Codex plugin links
   ```

   If any surface fails or warns, mark it with `❌` or `⚠️` and list only the failed or warning
   checks below the status list with their remediation text.

## Checkpoints

- Do not mutate external services during readiness. No issues, PRs, update posts, item edits, or
  browser/computer automation fallback.
- Do not print tokens, secret values, raw environment contents, or raw command stderr that may
  contain sensitive data.
- Do not add readiness checks for general environment values, token provisioning, authenticated
  1Password access, task automation, setup mutation, release builds, or Leia.
- Do not add a new helper check id without assigning it to one of the five allowed local buckets.
- Treat `op environment read --help` as the 1Password CLI beta readiness gate because it verifies
  the expected CLI surface without granting the agent access to the 1Password macOS desktop app.
- Treat the README as human setup guidance. Use the helper JSON as the machine-readable source of
  readiness truth.
- Follow the root `AGENTS.md` readiness maintenance policy when deciding whether future repo or
  skill changes should update this readiness skill.

## Completion Criteria

- The helper JSON was parsed successfully.
- Every local `fail` or `warn` was reported with a remediation step.
- Every helper check included a known bucket and bucket order matched the dependency order.
- 1Password CLI beta readiness verified the expected `op environment read --help` surface without
  running authenticated vault or Environment access.

## Bundled Resources

- [`scripts/check-machine.js`](./scripts/check-machine.js): local read-only machine readiness probe
  CLI wrapper that emits deterministic JSON.
- [`scripts/check-machine-lib.js`](./scripts/check-machine-lib.js): tested local helper library used
  by the CLI wrapper.

## Validation

- Confirm the local helper output is parseable JSON.
- Confirm every `warn` and `fail` local check includes remediation.
- Confirm every helper check includes a known bucket.
- Confirm local helper checks stay within the five allowed buckets and do not print or commit
  protected values.
- Confirm 1Password CLI beta validation strips token fallback env vars from `op` subprocesses.
