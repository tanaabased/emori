---
name: emori-skill-author
description: EMORI-based authoring, standardization, and validation of EMORI-local skills. Use when a user wants to scaffold, refine, optimize, or validate a skill owned by this workspace.
license: MIT
metadata:
  type: meta
  owner: emoriwan
  tags:
    - emoriwan
    - meta
    - skills
  openclaw:
    emoji: '🛠️'
    homepage: https://github.com/tanaabased/emori/tree/main/skills/skill-author
    requires:
      bins:
        - bun
---

# Skill Author

## Overview

Author, standardize, optimize, and validate EMORI-local skills using this
workspace's [skill standard](../../references/skill-standard.md), scaffolder,
and validator. The standard owns local conventions and the Tanaab boundary.

## Required Reading

Read applicable references before dependent work. Reuse complete reads already
in context; if a required reference is unavailable, report the gap and stop only
the dependent work.

- **Always:** [EMORI Skill Standard](../../references/skill-standard.md).
- **Before scaffolding or reviewing type shape:** the matching local [generic](./templates/generic.md), [coding](./templates/coding.md), [integration](./templates/integration.md), [workflow](./templates/workflow.md), or [meta](./templates/meta.md) template.
- **Before changing shared Tanaab skills:** use `tanaab-skill-author` and its governing references; this local skill does not own shared canon.

## When to Use

- Create a new EMORI-local skill.
- Choose or refine a local skill's type, metadata, folder, or discovery text.
- Standardize or validate an existing `emori-*` skill.
- Review whether a local workflow deserves a skill rather than ordinary
  workspace guidance.
- Optimize the local skill collection for overlap, contradiction, or stale
  identity.

## When Not to Use

- Do not author or standardize `tanaab-*` skills; use `tanaab-skill-author` in
  `tanaabased/canon`.
- Do not use this skill for ordinary work that merely happens inside another
  skill.
- Do not force a live skill when the reusable artifact is really a repository
  template or a short workspace rule.

## Evaluation Criteria

- Confirm the proposed skill owns a narrow EMORI-specific surface.
- Preserve useful shared conventions where they still fit, and make every
  EMORI-specific divergence explicit.
- Keep OpenClaw metadata in `SKILL.md` and Codex interface metadata in
  `agents/openai.yaml`.
- Keep coding-skill documentation, testing, optional deployment, and GitHub
  Actions projection aligned with the local template contract.
- Prefer references and deterministic scripts over repeated doctrine.

### Codex icons

Choose the category by the skill’s primary job, not by its metadata type or tags.
Use the glyph colors from [Tanaab Actions’ artwork guidance](https://github.com/tanaabased/actions/blob/85320f9cb9019f630c5ae273ed2e204a0e37688d/AGENTS.md#documentation), not the base or background colors.

| Category    | Glyph     | EMORI skills                 |
| ----------- | --------- | ---------------------------- |
| Setup       | `#008f64` | —                            |
| Preparation | `#9c1c55` | Skill Author                 |
| Testing     | `#6f42c1` | —                            |
| Publishing  | `#0069b8` | Reply, iMessage Style, Voice |

After scaffolding, copy a matching category SVG into the skill’s `assets/` and
set both `interface.icon_small` and `interface.icon_large` in `agents/openai.yaml`
to `./assets/skill-icon-<category>.svg`, using the lowercase category name.
Codex ignores icon paths outside the skill, so use the same SVG bytes in each
skill in the category rather than linking to another skill’s copy. If the
category has no variant yet, copy an existing variant and change only its two
fill values to the matching glyph color. Keep the square border and witch mark
the same. Leave the OpenClaw emoji and Codex `brand_color` unchanged.

## Anti-Patterns

- Do not copy a shared Tanaab skill solely to change precedence.
- Do not present EMORI-local structure as global Tanaab canon.
- Do not add broad routing matrices or relationship prose to rescue an
  overloaded skill.
- Do not hoist support files for hypothetical reuse.

## Iteration Loop

- Start with the smallest surface that EMORI should own directly.
- Scaffold or patch the skill, then validate immediately.
- Tighten scope before adding resources, code, or another local skill.
- Recheck the EMORI/Tanaab boundary as either layer evolves, then explicitly
  choose whether to adopt the shared change or retain local divergence.

## Workflow

1. Read the skill standard and confirm the target belongs to its local scope.
2. Read the matching local template when type shape or metadata needs review.
3. Use [`./scripts/init-skill.js`](./scripts/init-skill.js) for a clean scaffold
   or patch an existing skill narrowly.
4. Supply a skill-specific OpenClaw emoji, review whether `Optimization`
   applies to the persistent surface, and decide whether a coding skill has one
   material deployment mechanism worth retaining.
5. Choose the Codex icon using the category guidance above.
6. Run [`./scripts/validate-skill.js`](./scripts/validate-skill.js), fix every
   error, and review warnings and manual checks explicitly.

## Optimization

- **Inspect:** Inventory local skill ids, owned surfaces, discovery metadata,
  OpenClaw metadata, templates, resources, validation evidence, and their
  relationship to installed `tanaab-*` skills.
- **Compare:** Reconcile local behavior with the EMORI standard and relevant
  shared Canon; distinguish intentional divergence from accidental wrappers,
  duplicated doctrine, unclear precedence, misplaced resources, stale ids, and
  overloaded local owners.
- **Recommend:** Keep justified local behavior; adopt shared changes only when
  they improve the EMORI contract; propose movement to Canon only for proven
  shared capability; and tighten or remove local scope only when evidence
  supports it.
- **Apply:** After authorization, make the smallest local changes and update
  every affected prompt, link, template, validator rule, and consumer.
- **Verify:** Run the local validator for every surviving EMORI skill, search for
  stale identities, and confirm local and shared ownership boundaries are
  explicit.

## Bundled Resources

- [../../references/skill-standard.md](../../references/skill-standard.md):
  independent EMORI-local skill contract
- [./templates/meta.md](./templates/meta.md): local full-template model for meta
  skills; sibling templates define the other supported types
- [./scripts/init-skill.js](./scripts/init-skill.js): deterministic EMORI-local
  skill scaffolder
- [./scripts/validate-skill.js](./scripts/validate-skill.js): EMORI-local skill
  validation entrypoint
- [./lib/skill-author.js](./lib/skill-author.js): local skill definitions and
  command presentation
- [./lib/skill-scaffolder.js](./lib/skill-scaffolder.js): EMORI-local scaffold
  orchestration
- [./lib/skill-validator.js](./lib/skill-validator.js): EMORI-local validation
  orchestration and reporting

## Validation

- Run `bun skills/skill-author/scripts/validate-skill.js --skill-dir <path>`
  from the repository root; fix errors and review warnings and manual checks.
- Confirm local discovery narrows or extends shared capability rather than
  silently replacing it.
- Confirm coding-skill lifecycle sections and their GitHub Actions projection
  follow the local template without duplicated doctrine.
- Confirm retained `Optimization` guidance is surface-specific.
