---
template_type: coding
default_category_tag: implementation
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
---

# {{display_name}}

## Overview

{{description}}

## When to Use

- Use for skills that modify, generate, refactor, debug, or explain code.
- Keep the owned surface narrow to one code-centric artifact or workflow.
- Broad discovery language is acceptable only when it materially improves triggerability and still funnels into one dominant implementation pattern.
- Prefer requests that benefit from deterministic validation or repeatable code patterns.

## When Not to Use

- Do not use this type for skills centered on external-system setup, operational sequencing, or canon maintenance.
- Do not widen coding skills into repo routers or broad engineering doctrine dumps.

## Constraints

- Prefer the smallest change that solves the task.
- Preserve existing style and local patterns unless the task clearly requires a change.
- Avoid unrelated refactors.

## Change Strategy

- Identify the narrowest code path that owns the change.
- Funnel the skill toward one dominant implementation pattern instead of treating every adjacent code path as equally owned.
- Reuse existing patterns before adding new abstractions.

## Workflow

1. Confirm the request matches this skill's code-owned surface.
2. Load only the code, tests, and canon needed for the task.
3. Make the smallest coherent change and validate it directly.
4. Stop once the owned code path is complete and verified.

## Documentation

- Describe how this skill documents the owned code surface.
- Keep documentation guidance focused on public contracts, user-facing examples, and durable repo-local surfaces that belong to this skill.
- Point to narrower references or companion skills when README, docs-site, inline API docs, or operational examples have a more specific owner.
- Keep comments and examples sparse enough to clarify the contract without duplicating obvious implementation details.

## Testing

- Describe the default direct-test lifecycle for the owned code surface.
- Include one canonical mechanism and one minimal example only when that test pattern materially shapes the skill.
- Keep specialized or surface-coupled test patterns in narrower companion skills.

## GitHub Actions Workflow

- Describe the default GitHub Actions validation path for the owned code surface when GHA is the standard CI mechanism.
- Include one canonical mechanism and one minimal example only when it materially shapes the skill.
- Do not widen this section into full workflow-topology ownership.

## Bundled Resources

- List only the code-specific canon, scripts, templates, or assets this skill actually needs.
- Keep local resources local unless they clearly pass the hoist test.

## Validation

- Run the narrowest relevant tests, lint, build, or smoke checks for the owned code path.
- Confirm broad discovery language still funnels toward one dominant implementation pattern when present.
- Confirm the lifecycle sections do not introduce multiple materially different validation mechanisms without a clear split decision.
- Confirm the change did not widen scope or introduce unrelated drift.
