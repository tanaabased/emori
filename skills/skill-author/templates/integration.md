---
template_type: integration
default_category_tag: external-systems
optional_top_level_headings:
  - '## Release Workflow'
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

- Use for skills that operate against external tools, APIs, SaaS systems, MCP servers, CLIs, or service workflows.
- Keep the surface centered on one integration boundary or external-system workflow.
- Prefer this type when prerequisites, interfaces, or remote failure modes matter.

## When Not to Use

- Do not use this type for repo-local coding work that does not materially depend on an outside system.
- Do not turn an integration skill into a vague operational playbook.

## Prerequisites

- Confirm required tools, services, auth, and local setup before acting.
- State missing dependencies or access early.

## Inputs

- Identify the required commands, requests, files, ids, or credentials up front.
- Make request/response or command I/O explicit when the interface matters.

## Outputs

- Define the expected changed state, returned data, or produced artifacts.
- Note any user-visible side effects or follow-up handoffs.

## Failure Handling

- Call out partial failure modes, retry limits, and rollback boundaries.
- Do not hide missing auth, missing tools, or remote errors.

## Workflow

1. Confirm the request matches this skill's external-system surface.
2. Load only the canon, tools, and external context required for the integration path.
3. Execute the narrowest reliable sequence against the target system.
4. Validate the resulting state and surface any remote uncertainty explicitly.

## Release Workflow

- Describe the default release automation path for the owned product surface only when one canonical release mechanism materially shapes the skill.
- Include one canonical mechanism and one minimal example only when it materially shapes the skill.
- Do not widen this section into full workflow-topology ownership.

## Bundled Resources

- List only the integration-specific canon, scripts, templates, or assets this skill actually needs.
- Keep local resources local unless they clearly pass the hoist test.

## Validation

- Confirm prerequisites, inputs, outputs, and failure handling are all explicit.
- Validate the resulting external or local state with the narrowest reliable checks.
