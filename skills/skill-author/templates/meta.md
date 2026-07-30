---
template_type: meta
default_category_tag: skills
optional_top_level_headings:
  - '## Optimization'
---
---
name: {{skill_id}}
description: {{description}}
license: {{license}}
metadata:
  type: {{type}}
  owner: {{owner}}
  tags:
{{metadata_tags_yaml}}
  openclaw:
    emoji: {{openclaw_emoji}}
    homepage: {{openclaw_homepage}}
---

# {{display_name}}

## Overview

{{description}}

## When to Use

- Use for skills that create, refine, validate, package, or audit other skills, prompts, templates, or conventions.
- Keep the owned surface focused on one canon-facing artifact family.
- Prefer this type when consistency, structure, or contract enforcement matters more than implementation detail.

## When Not to Use

- Do not use this type for ordinary product work that merely references canon.
- Do not widen a meta skill into a router or a broad keep/merge/delete planner without a specific owned surface.

## Evaluation Criteria

- Check structure, naming, and consistency against the EMORI standard and any
  relevant shared Tanaab contract.
- Prefer small, composable outputs over broad surfaces.

## Anti-Patterns

- Avoid router behavior, overlapping ownership, or duplicated doctrine.
- Treat repeated ambiguity as a signal to split or simplify.

## Iteration Loop

- Start with the smallest coherent change.
- Re-evaluate after validation before widening scope.

## Workflow

1. Confirm the request matches this skill's canon-facing surface.
2. Load only the EMORI standard, relevant shared Tanaab guidance, and local
   resources required for the task.
3. Create, standardize, or validate using the narrowest reliable approach.
4. Re-run validation before finishing and surface any manual review points.

## Optimization

- **Inspect:** Inventory the local artifact family, discovery metadata, bundled
  resources, and validation evidence owned by the skill.
- **Compare:** Reconcile the local surface with the EMORI standard and relevant
  shared Tanaab contract, distinguishing intentional divergence from
  contradictions, duplicated doctrine, overloaded owners, and obsolete
  identities.
- **Recommend:** Preserve clear local ownership; adopt or reject shared doctrine
  deliberately; and tighten, move, or remove only where evidence supports the
  operation.
- **Apply:** After authorization, make the smallest contract-aligned change and
  update every affected local consumer.
- **Verify:** Run the local validator, review manual checks, and confirm the
  artifact still owns one EMORI-specific surface.

## Bundled Resources

- List only the canon-facing files, scripts, templates, or assets this skill actually needs.
- Keep local resources local unless they clearly pass the hoist test.

## Validation

- Confirm the artifact still owns one narrow canon-facing surface.
- Validate that structure, naming, and local-vs-hoisted placement match the EMORI contract.
