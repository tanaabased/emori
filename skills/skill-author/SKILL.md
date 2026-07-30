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

Author, standardize, optimize, and validate EMORI-local skills without taking
ownership of Tanaab Canon.

- EMORI-local skills use `emori-*` machine ids and live in this workspace's
  `skills/` directory.
- Shared `tanaab-*` skills provide reusable Tanaab capabilities and canon
  outside surfaces owned by an applicable EMORI skill.
- When both layers apply, prefer the narrower EMORI skill for its local surface
  and use the Tanaab skill outside that boundary.
- Treat the local scaffolder and validator as an independent EMORI-owned
  implementation that may deliberately diverge from its Tanaab seed.
- Keep support material local unless concrete EMORI reuse justifies hoisting it.

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
- Do not create a local wrapper merely to outrank an applicable Tanaab skill.
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
- Keep each local skill narrowly scoped even when its contract departs from a
  shared skill.
- Prefer references and deterministic scripts over repeated doctrine.

## Anti-Patterns

- Do not copy a shared Tanaab skill solely to change precedence.
- Do not describe EMORI-local rules as global canon.
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

1. Confirm the target is an EMORI-local skill rather than a Tanaab Canon skill.
2. Read [`../../references/skill-standard.md`](../../references/skill-standard.md)
   for the EMORI-local contract and consult shared Tanaab guidance only for
   concerns still owned by that layer.
3. Read the matching local template when type shape or metadata needs review.
4. Use [`./scripts/init-skill.js`](./scripts/init-skill.js) for a clean scaffold
   or patch an existing skill narrowly.
5. Supply a skill-specific OpenClaw emoji and review whether `Optimization`
   applies to the persistent surface.
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
- [./lib/skill-author.js](./lib/skill-author.js): local EMORI skill-author
  implementation

## Validation

- Confirm the skill id starts with `emori-`, uses owner `emoriwan`, and owns an
  EMORI-specific surface.
- Confirm `metadata.openclaw` has a skill-specific emoji and HTTPS homepage.
- Confirm unprefixed folders are used only inside an agent workspace or plugin
  skill tree.
- Confirm local discovery narrows or extends shared capability rather than
  silently replacing it.
- Confirm retained `Optimization` guidance is surface-specific.
- Run `validate-skill.js` and fix all errors before finishing.
