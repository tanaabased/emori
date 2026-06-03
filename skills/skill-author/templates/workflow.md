---
template_type: workflow
default_category_tag: operations
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

- Use for repeatable operational processes that may span tools but are not primarily coding or integration implementation.
- Keep the owned surface focused on one concrete workflow or handoff path.
- Prefer this type when sequence, checkpoints, and completion criteria matter more than implementation details.

## When Not to Use

- Do not use this type for skills whose main value is code change strategy or external-system interface handling.
- Do not let a workflow skill become a vague doctrine essay.

## Preconditions

- Confirm starting state, prerequisites, and blockers before beginning.
- State required approvals or missing context early.

## Workflow

1. Confirm the request matches this skill's operational surface.
2. Load only the canon, inputs, and checkpoints required for the workflow.
3. Execute the sequence in order and pause at explicit decision points.
4. Close only when completion criteria are met and surfaced clearly.

## Checkpoints

- Make review points, handoffs, or approvals explicit.
- Pause rather than guessing when a checkpoint depends on outside confirmation.

## Completion Criteria

- Define what finished looks like before closing the task.
- List the signals or artifacts that prove the workflow is complete.

## Bundled Resources

- List only the workflow-specific canon, scripts, templates, or assets this skill actually needs.
- Keep local resources local unless they clearly pass the hoist test.

## Validation

- Confirm preconditions, checkpoints, and completion criteria are all explicit.
- Validate that the sequence stayed narrow and did not absorb unrelated workflow surfaces.
