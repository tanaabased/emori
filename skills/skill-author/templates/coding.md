---
template_type: coding
default_category_tag: implementation
optional_top_level_headings:
  - '## Deployment'
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
- Link documentation-specific references here when they materially shape the owned surface.
- Keep `## Bundled Resources` as an inventory, not the only discovery path for documentation guidance.
- Keep testing artifacts in `## Testing` even when they are README- or Markdown-backed, unless they are explicitly durable user-facing examples.
- Keep comments and examples sparse enough to clarify the contract without duplicating obvious implementation details.

## Testing

- Describe the default direct-test lifecycle for the owned code surface.
- Include one canonical mechanism and one minimal example only when that test pattern materially shapes the skill.
- Keep specialized or surface-coupled test patterns in narrower companion skills.

## Deployment

- Describe the default deployment or publication lifecycle only when one canonical delivery mechanism materially shapes the owned code surface.
- Include one canonical mechanism and one minimal example only when that deployment pattern materially shapes the skill.
- Keep surface-local build, package, artifact, and delivery decisions here; hand independent workflow-graph changes to the workflow owner.

## GitHub Actions

- Treat this as the automation projection of the skill's owned lifecycle sections, not as a separate owner of testing, linting, deployment, or release doctrine.
- Reference the applicable lifecycle section and its canonical workflow template instead of repeating their rules or embedding complete workflow YAML.
- Name each canonical target path under `.github/workflows/` so workflow boundaries and resulting check identities remain stable across repositories.
- Use descriptive H3 headings only when the skill maps two or more materially different workflow paths; omit them for one-path sections.
- Keep complete copyable workflow artifacts in `templates/`, surface-specific mechanics with their lifecycle owner, and independent workflow topology with the workflow owner.

## Optimization

Use the shared operation lenses—**keep**, **reconcile**, **deduplicate**, **consolidate/merge**, **split**, **extract**, **move**, **tighten**, and **remove**—only where they fit this code surface; do not manufacture changes to satisfy the list.

- **Inspect:** Inventory the existing implementation, owning scopes, public behavior, documentation, tests, and CI for this code surface.
- **Compare:** Evaluate the observed surface against repository-local patterns and linked coding canon, including contradictions, duplicated logic, overloaded modules, misplaced code, dead paths, and unsupported layers.
- **Recommend:** Preserve aligned behavior; reconcile conflicting representations; and prioritize justified deduplication, consolidation, splitting, extraction, movement, tightening, or removal.
- **Apply:** After explicit authorization, make the smallest coherent code change; avoid style-only refactors, forced utility extraction, and unrequested language migration.
- **Verify:** Run the narrowest relevant tests, lint, type-check, build, or smoke checks, then re-inspect the changed surface for remaining drift.

## Bundled Resources

- List only the code-specific canon, scripts, templates, or assets this skill actually needs.
- Keep local resources local unless they clearly pass the hoist test.

## Validation

- Run the narrowest relevant tests, lint, build, or smoke checks for the owned code path.
- Confirm broad discovery language still funnels toward one dominant implementation pattern when present.
- Confirm `GitHub Actions` maps the owned lifecycle sections without duplicating their doctrine or embedding a complete copyable workflow artifact.
- Confirm the lifecycle sections do not introduce multiple materially different validation mechanisms without a clear split decision.
- Confirm the change did not widen scope or introduce unrelated drift.
