# EMORI model-profile rollout

The profiles in [the manifest](../.agent-system/agent.yaml) implement the mapping
approved in [EMORI #50](https://github.com/tanaabased/emori/issues/50).
Agent System `install` applies the default model and reasoning effort and binds
the declared models to the existing runtime. Declaring the complete tier group
does not route issues automatically;
[Agent System #86](https://github.com/tanaabased/openclaw-agent-system/issues/86)
remains a separate prerequisite.

## Compatibility evidence

On 2026-09-12, the installed Agent System reported version **0.5.3**, built with
OpenClaw **2026.9.3**. Its 252 production/package files and all 233 bundled
source-map entries matched the immutable source tree at
[`19a70d25ada8c6726796181f853d6c99012987e1`](https://github.com/tanaabased/openclaw-agent-system/commit/19a70d25ada8c6726796181f853d6c99012987e1),
the merged [PR #90](https://github.com/tanaabased/openclaw-agent-system/pull/90).
This establishes source-content provenance; the installed checkout's Git HEAD
was not read because it is outside native managed Git's admitted directories.
The loaded bundle's SHA-256 was
`e81233235d1f1b9038e0fc8ff79acbdbe26ae823b998af4fb24538ce1a2118e9`.

The supported schema requires provider/model references and effort `medium`,
`high`, or `xhigh`. It accepts a default alone or a default plus all three tiers;
profiles accept no runtime or Fast-mode property.

## Repository validation

Validation on 2026-09-12 used the installed build above and the issue worktree:

- `openclaw agent-system validate --json`: valid, including
  `agent-model-declaration-valid`; no diagnostics.
- `bun run lint`: ESLint and Prettier passed.
- `bun run test`: 37 passing.
- Managed `git diff --check`: passed.
- Removing only the new `models` block reproduced the original manifest
  byte-for-byte; the approved actor's `operator-owner: true` remained intact.

No live configuration, authentication, runtime, cache, Fast-mode, fallback,
operator-access, global-default, or session changes were made. Leia was not run
locally; existing example checks remain in CI.

## Operator rollout checklist

Repository delivery does not authorize rollout. After approval and merge, run
these steps from EMORI's registered workspace, not the issue worktree. Keep
effective-setting snapshots private and limited to non-secret fields.

1. Capture the effective primary model, reasoning default, explicit Codex runtime
   bindings, subscription-authentication route, Fast-off preference, fallbacks,
   cache and other model-entry parameters, global defaults, and explicit session
   overrides. Run `openclaw agent-system doctor --json`.
   `agent-model-config-drift` may be expected before installation. Stop and report
   runtime conflicts, unavailable runtime/authentication, unavailable models,
   unsupported effort, or missing capability evidence. Do not substitute a
   provider, credential, model, or runtime to make the check pass.
2. After explicit operator authorization, run
   `openclaw agent-system install --json`. The model component should report
   `set-agent-models` when changed, or `agent-models-unchanged` when already
   converged. Installation reconciles configuration; it does not establish
   runtime readiness or perform inference.
3. Run `openclaw agent-system doctor --json` again. Require `agent-models-ready`
   with no model drift or blocked model findings. Compare the non-secret snapshots:
   only EMORI's primary model, reasoning default, and necessary model runtime
   bindings may change. Preserve the Codex/subscription route, Fast-off,
   fallbacks, cache and unrelated model-entry parameters, global defaults,
   operator access, and explicit session overrides. Report any discrepancy.
4. With authorization covering the repeat, run install again and require
   `agent-models-unchanged`. Run doctor again and compare the same settings to
   verify idempotency and no unrelated changes.

Live readiness, preservation after installation, and repeat-install idempotency
remain **pending operator rollout**. Configuration convergence and doctor
readiness are not proof of native inference. An optional, separately authorized
fresh-turn test must verify the actual runtime, model, and reasoning independently;
do not replay old work or overwrite existing sessions to test defaults.
