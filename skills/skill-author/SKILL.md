---
name: emori-skill-author
description: EMORI-based authoring, standardization, and validation of canon skills. Use when a user wants to scaffold a new repo-local skill, standardize an existing skill, or validate a canon skill directory against the current contract.
license: MIT
metadata:
  type: meta
  owner: emoriwan
  tags:
    - emoriwan
    - meta
    - skills
---

# Skill Author

## Overview

Use this skill when the skill itself is the artifact being created, standardized, or validated.

- `type` is the only variable identity input for new or standardized skills.
- Choose the narrowest type that fits; keep `generic` as the fallback.
- Validation is a first-class workflow phase and a valid standalone mode.
- Let the shared standard define the base contract and let local templates and scripts own type-specific authoring behavior.
- Keep support material local unless it clearly passes the hoist test for repo-root canon.
- For `coding` skills, define one owned code surface plus three lifecycle sections: `Documentation`, `Testing`, and `GitHub Actions Workflow`.
- In plugin-contained skill trees, keep the `emori-` machine id in frontmatter and prompts. Prefer omitting that prefix from the skill folder name unless the full machine id is the clearer repo-local surface.
- If the reusable artifact is really a whole starter repository with committed structure, scripts, examples, and docs that users adopt wholesale, challenge whether it should be a repo template instead of a live skill.
- When a skill implies durable, always-on repo policy, it may bundle `references/repo-agents-lines.md` as short copyable guidance for a target repo's `AGENTS.md`.

## When to Use

- Create a new skill from scratch.
- Choose or refine a skill's `type`.
- Standardize an existing skill's `SKILL.md`, `agents/openai.yaml`, naming, or `metadata.owner`.
- Validate a newly created, standardized, or migrated skill directory.
- Review whether skill support material should stay local or be hoisted under the shared hoist test.
- Split a broad skill into narrower skills with clearer owned surfaces.
- Review whether a proposed skill surface is better expressed as a repo template than as a live skill.
- Review whether a skill should bundle short repo `AGENTS.md` lines because its surface implies durable ambient repo policy.

## When Not to Use

- Do not use this skill for ordinary work that merely happens inside an existing skill.
- Do not use this skill for whole-stack audit, keep/merge/delete planning, or router cleanup unless the task is specifically about creation or standardization mechanics.
- Do not treat shared references or helper CLIs as optional when they already cover the requested change.
- Do not force a live skill when the real reusable artifact is a whole starter repo that users should adopt directly.

## Evaluation Criteria

- Use the smallest type that clearly fits the skill's owned surface.
- Keep structure and metadata aligned with the shared canon contract.
- Keep validation results tied to the shared contract and canonical local templates rather than personal preference.
- Keep material local by default and hoist only on proven reuse, repo-wide contract status, or standalone human value.
- For `coding` skills, allow broad discovery language only when it still funnels into one dominant implementation pattern.
- Prefer a repo template when the reusable contract is a committed starter repository with structure, scripts, examples, and docs that users adopt as a whole; keep a live skill only for cross-repo decision-making that remains after the template choice.
- Bundle repo `AGENTS.md` lines only for durable always-on repo rules, not for conditional workflow steps that belong in the skill itself.

## Anti-Patterns

- Do not treat type selection as runtime routing.
- Do not keep a separate validator skill when validation is only a lifecycle phase of skill authoring.
- Do not use `generic` as the default when a narrower type clearly fits.
- Do not duplicate contract rules in skill prose when the standard or CLI already enforces them.
- Do not hoist a file to repo root just because it might be reused later.
- Do not let a `coding` skill accumulate multiple materially different documentation, testing, or GitHub Actions validation mechanisms unless the variations are minor flavors of one pattern.
- Do not keep a live skill whose main job is to restate one repo template's structure, scripts, examples, and docs.
- Do not use repo `AGENTS.md` guidance as a dumping ground for task-triggered workflow detail.

## Iteration Loop

- Start with the smallest fitting type.
- Scaffold or patch the skill, then validate immediately.
- Run validation first when the request is validation-only.
- Tighten scope before adding new sections, resources, or hoisted canon.
- For `coding` skills, challenge the scope before adding a second materially different documentation, direct-test, or GitHub Actions workflow pattern.
- Challenge skill-vs-template ownership before adding doctrine for a surface that already looks like a reusable starter repo.

## Workflow

1. Determine whether the task is create, standardize, or validate. Choose `type` whenever the task changes or asserts skill identity, and challenge whether the surface is really a live skill or would be better owned by a repo template.

2. Load only the needed shared references.

- Read [`../../references/skill-standard.md`](../../references/skill-standard.md) for the contract.
- Read the matching local template in [`./templates/`](./templates/) when type shape or default metadata needs review.

3. Scaffold or patch the skill.

- Use [`./scripts/init-skill.js`](./scripts/init-skill.js) when the task is a clean scaffold.
- Patch manually when the task is a partial migration or standardization pass.
- Use [`./scripts/validate-skill.js`](./scripts/validate-skill.js) when the task is validation-only or when structural changes need objective confirmation.
- Keep support material local by default.
- Hoist only when the file is reused across live surfaces, is a repo-wide contract or tooling surface, or has standalone human value.
- Review existing hoisted files with one meaningful live consumer for demotion.

4. Validate before finishing.

- Run [`./scripts/validate-skill.js`](./scripts/validate-skill.js) against the generated or updated skill.
- Fix every `[error]` before finishing.
- Review `[warn]` and `[manual]` results explicitly instead of treating them as silent success.
- Confirm the skill still owns one narrow surface and only references canon it actually needs.

## Bundled Resources

- [../../references/skill-standard.md](../../references/skill-standard.md): naming, structure, metadata, and validation contract
- [./templates/meta.md](./templates/meta.md): canonical full-template model for `meta` skills; sibling templates define the other type shapes
- [./scripts/init-skill.js](./scripts/init-skill.js): deterministic scaffolder for canonical full templates
- [./scripts/validate-skill.js](./scripts/validate-skill.js): validation entrypoint for skill directories
- [./scripts/skill-author-lib.js](./scripts/skill-author-lib.js): shared local authoring and validation helpers

## Validation

- Confirm the new or updated skill has a distinct owned surface.
- Confirm the selected `type` is explicit and correct.
- Confirm the selected type order is correct.
- Confirm `coding` skills include `Documentation`, `Testing`, and `GitHub Actions Workflow` as the canonical lifecycle sections.
- Confirm validation-only requests are handled by the same surface rather than a separate validator skill.
- Confirm the surface is not better expressed as a repo template with the skill kept only as a thin discovery or adaptation layer, if needed.
- Confirm any bundled repo `AGENTS.md` lines stay short, ambient, and worth copying into a project repo.
- Confirm bundled resources stay local unless they clearly pass the hoist test.
- Confirm any repo-root resources still justify being hoisted.
- Run `validate-skill.js` and fix all `[error]` results before finishing.
