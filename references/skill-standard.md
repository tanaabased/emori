# Skill Standard

## Validation Contract

Use this file as the source of truth for canon skill validation.

- `[error]` means the skill should fail validation.
- `[warn]` means the skill is probably shaped poorly and should be reviewed.
- `[manual]` means a human should judge the rule because it is not fully machine-checkable.

## Identity and Naming

- `[error]` Canonical type-specific authoring and validation behavior comes from the full templates owned by `emori-skill-author`.
- `[error]` Frontmatter `metadata.owner` must exist and must equal `emoriwan`.
- `[error]` Frontmatter `metadata.type` must be one of the type ids defined by those canonical templates.
- `[error]` Frontmatter `metadata.type` must equal the selected or asserted type id when one is provided.
- `[error]` The generated machine id must use lowercase letters, digits, and hyphens only.
- `[error]` Frontmatter `name` must equal the generated machine id exactly.
- `[error]` Frontmatter `name` must start with `emori-`.
- `[error]` Outside a larger Codex plugin, the skill folder name must equal the generated machine id.
- `[error]` Inside a larger Codex plugin, the skill folder name must equal either the generated machine id or the generated machine id with the leading `emori-` machine prefix removed.
- `[error]` Strip an accidental duplicate `emori-` prefix before writing the final machine id.

## Required Files

```text
skill-folder/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── templates/     # optional, only when unique to this skill
├── assets/        # optional, only when unique to this skill
├── references/    # optional, only when unique to this skill
└── scripts/       # optional, only when unique to this skill
```

- In plugin-contained skill trees, `skill-folder/` may be the full machine id or the unprefixed surface id while frontmatter `name` remains the full `emori-` machine id.

- `[error]` `SKILL.md` must exist.
- `[error]` `agents/openai.yaml` must exist.
- `[warn]` Create optional resource directories only when the skill actually needs them.
- `[warn]` Do not add auxiliary repo-style docs inside a skill such as `README.md`, `CHANGELOG.md`, or installation guides unless a runtime requires them.

## Required SKILL.md Shape

- `[error]` `SKILL.md` must start with YAML frontmatter.
- `[error]` Frontmatter must contain `name`, `description`, `license`, and `metadata`.
- `[error]` Frontmatter `license` must equal `MIT`.
- `[error]` Frontmatter `metadata` must contain `type`, `owner`, and `tags`.
- `[error]` Do not use top-level `type`, `owner`, or `tags`; Codex warns on unsupported top-level skill attributes.
- `[error]` Frontmatter `description` must start with `EMORI-based`.
- `[error]` `metadata.tags` must be a list of strings.
- `[error]` `metadata.tags` must include the selected `owner` and `type`.
- `[error]` `metadata.tags` must include at least one additional kebab-case category tag beyond `owner` and `type`.
- `[error]` Section order must match the selected type's canonical template order.
- `[error]` Optional top-level sections declared by the canonical template may be omitted, but if present they must appear in the template's declared order.
- `[error]` `coding` skills must include the canonical `Documentation`, `Testing`, and `GitHub Actions Workflow` lifecycle sections in template order.
- `[error]` Relative links in `SKILL.md` must resolve.
- `[manual]` `description` should say both what the skill does and when to use it.
- `[manual]` `When to Use` and `When Not to Use` should describe a narrow, concrete owned surface.
- `[warn]` Keep `metadata.tags` short. Prefer one category tag by default instead of a long keyword list.

## Required OpenAI Metadata

- `[error]` `agents/openai.yaml` must contain `interface.display_name`, `interface.short_description`, `interface.default_prompt`, and `interface.brand_color`.
- `[error]` `agents/openai.yaml` must contain `interface.icon_small` and `interface.icon_large`.
- `[error]` `interface.short_description` must start with `EMORI-based`.
- `[error]` `interface.icon_small` and `interface.icon_large` must point to existing relative skill asset paths.
- `[error]` `interface.default_prompt` should explicitly mention the skill by `$<machine-id>`.
- `[error]` `interface.brand_color` must equal `#00c88a`.
- `[error]` Optional `policy.allow_implicit_invocation` must be a boolean when present.
- `[error]` Optional `dependencies.tools` entries must declare at least `type` and `value` when present.
- `[warn]` `display_name` should be unprefixed by default unless the user explicitly wants `EMORI` in the human-facing title.
- `[manual]` After the `EMORI-based` prefix, `short_description` should describe the skill outcome.
- `[manual]` Use `policy.allow_implicit_invocation: false` only when a skill should require explicit `$<machine-id>` invocation.
- `[manual]` Use `dependencies.tools` only for real tool dependencies that improve execution, such as an MCP server the skill directly needs.

## Resource Placement Rules

- `[error]` Start every skill from the canonical full type template owned by `emori-skill-author`.
- `[error]` Type-specific authoring and validation behavior must come from those canonical templates rather than ad hoc parallel registries.
- `[error]` Use the shared EMORI owner contract from this standard and the validator. Do not load owner behavior from a separate owner-data folder.
- `[error]` Use kebab-case for repo-authored helper filenames in `scripts/`, `assets/`, `references/`, `prompts/`, and `templates/` unless a tool requires a fixed conventional filename.
- `[error]` `scripts/` is code-only. Do not store static registry data there as JS object literals.
- `[error]` Repo-level script filenames must end in `-cli.js`, `-task.js`, or `-lib.js`.
- `[warn]` Keep support material local to the owning skill by default.
- `[warn]` Hoist support material to repo root only on proven reuse across live surfaces, repo-wide contract or tooling status, or standalone human value.
- `[warn]` Machine-readable data should live with the smallest justified owner. Hoist it into repo-root `references/` only when multiple live consumers or independent human value justify it.
- `[error]` Bundleable repo scripts must import shared templates, assets, and machine-readable canon explicitly so `bun build` can follow the dependency graph.
- `[warn]` Keep the default scaffold minimal.
- `[warn]` Keep skill-bundled helpers in the skill's own `scripts/` directory. Do not treat them as repo-level package `bin/` entrypoints.
- `[warn]` Shebang-bearing skill-local scripts and executable starter templates should be committed executable.
- `[warn]` Do not mark repo-authored files executable unless they actually start with a shebang.
- `[warn]` If a skill bundles `references/repo-agents-lines.md`, keep it to durable ambient repo rules rather than conditional workflow steps.
- `[warn]` `generic` is the fallback type. Prefer a narrower type when one clearly fits.
- `[warn]` Additional skill types should add a new canonical full template under `emori-skill-author` instead of inventing an unrelated structure without a strong reason.
- `[manual]` Check whether each new or retained hoisted file still passes the hoist test instead of merely reflecting historical placement.

## Scope and Size Rules

- `[warn]` A skill should own one concrete task surface.
- `[warn]` Prefer a repo template over a live skill when the reusable artifact is a whole starter repository with committed structure, scripts, examples, and docs that users should adopt wholesale.
- `[warn]` For `coding` skills, broad discovery language is acceptable only when it still funnels into one dominant implementation pattern.
- `[warn]` For `coding` skills, multiple materially different documentation, direct-test, or GitHub Actions workflow mechanisms are a split signal unless they are minor flavor variations of one pattern.
- `[warn]` If a skill needs a routing matrix, broad arbitration rules, or heavy relationship language to stay understandable, split it.
- `[warn]` Do not add `## Relationship to Other Skills` by default. If a skill needs that section to make sense, challenge the scope first.
- `[warn]` Keep `SKILL.md` lean. Assume the agent is already capable and add only task-specific context that materially improves performance.
- `[warn]` Prefer references for detailed facts, schemas, and long examples instead of stuffing them into `SKILL.md`.
- `[warn]` Prefer scripts when deterministic reliability matters or the same code keeps being rewritten.
- `[warn]` Keep bundled references one hop from `SKILL.md`; link to them directly instead of hiding them behind deeper navigation.
- `[manual]` For `coding` skills, `Documentation`, `Testing`, and `GitHub Actions Workflow` should each describe one canonical mechanism and one minimal example when an example materially shapes the skill.
- `[manual]` Check whether the skill mostly restates one repo template's structure, scripts, examples, and docs; if so, prefer the template as source of truth and keep only a thin discovery or adaptation skill if needed.
- `[manual]` Check shebang and executable-bit alignment for skill-local `scripts/`, starter templates, and any `bin/` surfaces.
- `[manual]` Optional `references/repo-agents-lines.md` should stay short, copyable, and scoped to always-on repo policy that should influence many tasks.
- `[manual]` Hoisting decisions should be reviewed as placement choices, not assumed to be improvements.
- `[manual]` Bulk standardization should preserve the skill's core purpose and workflow unless the task explicitly asks for a behavioral rewrite.
