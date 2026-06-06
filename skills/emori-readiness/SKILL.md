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
- Run before relying on Codex plugin skills, 1Password-backed local setup, or Tailscale network
  access.
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

1. Run the bundled local probe with unsandboxed/elevated local access by default:

   ```sh
   bun ./skills/emori-readiness/scripts/check-machine.js
   ```

   This helper is read-only, strips 1Password token fallback environment variables from `op`
   subprocesses, and intentionally verifies local desktop/daemon services such as 1Password and
   Tailscale. The unsandboxed default is specific to this bundled helper and should not be treated
   as permission to run unrelated repo commands unsandboxed.

   If a local permission prompt appears during this helper run, tell the user it is expected for
   1Password or Tailscale desktop readiness. Denying the prompt may make readiness fail.

   If unsandboxed access is denied or unavailable, run the helper sandboxed. If that sandboxed run
   fails only on retryable local desktop or daemon access checks, report those checks as unresolved
   local access failures and explain that an unsandboxed read-only run is needed for an authoritative
   local readiness result.

2. Parse the JSON output and summarize each `fail` and `warn` check with its `remediation` text.
   The helper emits checks in dependency order and every check includes one stable `bucket`:
   `homebrew`, `packages`, `dotfiles`, `manual_apps`, then `codex_plugins`.

   Bucket meanings:
   - `homebrew`: Homebrew command availability.
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

   - ✅ Homebrew
   - ✅ Packages and Brewfile contract
   - ✅ Dotfiles
   - ✅ 1Password app and CLI vault access
   - ✅ 1Password Environment
   - ✅ Tailscale tailnet
   - ✅ Codex plugin links

   Local access note: sandboxed helper could not reach local desktop services, but the unsandboxed read-only retry passed.
   ```

   If any surface fails or warns, mark it with `❌` or `⚠️` and list only the failed or warning
   checks below the status list with their remediation text. Include `Local access note` only when
   the sandboxed and unsandboxed helper results differ.

## Checkpoints

- Do not mutate external services during readiness. No issues, PRs, update posts, item edits, or
  browser/computer automation fallback.
- Do not print tokens, secret values, raw environment contents, or raw command stderr that may
  contain sensitive data.
- Do not add readiness checks for general environment values, token provisioning, task
  automation, setup mutation, release builds, or Leia. The only Environment value this skill may
  verify is the hashed readiness authorization sentinel.
- Do not add a new helper check id without assigning it to one of the five allowed local buckets.
- Treat `op vault list --format json` as the local 1Password readiness gate because it proves the
  app is unlocked and integrated enough for authenticated CLI access.
- Treat `op environment read --help` and `op run --environment zsstdfqknicwfv5glv76gd6tue` as the
  local protected-resource fallback readiness gate. The helper must verify only the hashed
  readiness authorization sentinel and must not print or commit the sentinel value.
- Treat `tailscale status --json` as the local Tailscale readiness gate. Require the local node to
  be running, online, present in the network map, assigned a Tailscale IP, and connected to
  `tanaab.dev`. Peer pings are troubleshooting tools, not readiness gates.
- Treat the README as human setup guidance. Use the helper JSON as the machine-readable source of
  readiness truth.
- Run only the bundled readiness helper unsandboxed by default. Do not generalize that default to
  tests, setup commands, package managers, release validation, or other repo commands.
- If the sandboxed helper only fails on retryable local desktop or daemon access and the
  unsandboxed read-only retry passes, base the final readiness status on the unsandboxed result.
  Report the sandboxed failures as a local access note, not as readiness failures.
- Follow the root `AGENTS.md` readiness maintenance policy when deciding whether future repo or
  skill changes should update this readiness skill.

## Completion Criteria

- The helper JSON was parsed successfully.
- Every local `fail` or `warn` was reported with a remediation step.
- Every helper check included a known bucket and bucket order matched the dependency order.
- 1Password Environment readiness either proved `op run --environment` access to the readiness
  Environment or reported the setup mismatch without printing the authorization sentinel.

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
  Environment values.
- Confirm 1Password Environment validation strips token fallback env vars from `op` subprocesses.
