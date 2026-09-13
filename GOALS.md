# Goals

Owner: pirog
Visibility: Public
Last reviewed: 2026-08-24
Review cadence: Every two weeks and when new information materially changes the plan

This file holds reviewed direction; GitHub issues and pull requests hold work,
decisions, and progress evidence. Confidential details belong in private issues
or ignored context.

Tanaab is building a digital agency for the AI age around hybrid human-agent
teams and continuously improving operational systems.

## Current Objective

Prove and improve the human-agent work system through real repository work using
[Canon](https://github.com/tanaabased/canon) and
[Agent System](https://github.com/tanaabased/openclaw-agent-system). Feed validated
findings back into both systems.

### Responsibilities

#### pirog

- Advance Canon and Agent System in response to observed needs, likely including
  memory, installation and synchronization, custom GitHub notifications, prompt
  injection, instructions, and related agent-runtime integration.
- Provide EMORI with representative coding tasks and progressively larger work
  that exercises the system.
- Make product and policy decisions when pilot evidence exposes consequential
  tradeoffs or authority changes.

#### EMORI

- Serve as the primary pilot and demanding user, completing useful coding and
  repository tasks through the shared work system.
- Exercise assignment, planning, implementation, commit, pull-request, review,
  completion, and notification workflows where applicable.
- Record failures, friction, missing capabilities, and opportunities for
  simplification; file reproducible defects and concrete improvements in the
  owning repository.
- Keep this workspace and agent configuration aligned with reviewed Canon and
  Agent System updates.

#### Shared

- Periodically review pilot evidence and decide which findings justify changes.
- Prefer improvements supported by repeated use over speculative abstractions.
- Preserve clear authority, identity, privacy, and public/private output
  boundaries as automation expands.
- Revise these goals when evidence changes the appropriate priorities.

## Active Workstream

Initial work should favor:

- Small, well-bounded bug fixes and maintenance tasks.
- Repositories where mistakes are inexpensive and results are easy to verify.
- Work across different repository configurations and organizations.
- Tasks that exercise existing Canon skills and Agent System lifecycle paths.
- Periodic synchronization after pirog lands new platform capabilities.

As reliability improves, expand the pilot to:

- Features requiring planning and clarification.
- Multi-step work spanning implementation, review, and follow-up.
- Larger milestones with several related issues.
- Additional notification, memory, instruction, and runtime surfaces.

### Evidence and Recordkeeping

Keep provisional observations in daily memory or ignored scratch space. Use
pull requests and checks as verification evidence; summarize recurring patterns
and consequential conclusions rather than every event.

### Success Evidence

The current objective is succeeding when:

- EMORI regularly completes useful work across multiple repositories through the
  shared system.
- The path from task intake through implementation, review, and verified
  completion works without routine manual repair.
- Agent identity, credentials, repository authority, and public/private output
  boundaries remain correct across supported harnesses.
- Failure evidence distinguishes configuration and platform defects, model behavior,
  unclear task definitions, and project-specific implementation problems.
- Validated findings become owned issues and lead to measurable improvements in
  Canon or Agent System.
- New Canon and Agent System releases can be incorporated into EMORI's workspace
  without accumulating bespoke or duplicated conventions.
- At least one larger milestone can eventually be planned, assigned, executed,
  reviewed, and completed through the same process.

## Deferred Work

Develop Tanaab's public brand and publishing platform through
`tanaabased/theme`, `tanaabased/website`, and only the supporting packages and
integrations required for the website, blog, and distribution.

Resume this objective after the pilot has produced a stable operational baseline
and there is sufficient attention for product and design decisions.

Also outside current scope:

- Cross-repository initiative machinery beyond what real pilot work requires.
- New abstractions without evidence from actual use.
- Business or revenue metrics before the work system is operational enough for
  them to be meaningful.
- Automation that broadens authority merely to avoid a deliberate review or
  approval boundary.

## Decision Rules

When evaluating proposed work:

1. Does it materially exercise or improve the active human-agent work system?
2. Does it produce useful work, useful evidence, or both?
3. Is the finding reusable, or is it specific to one repository or task?
4. What higher-priority work would it displace?
5. What evidence would demonstrate successful completion?
6. Does it preserve appropriate identity, authority, privacy, and reversibility?
7. Should the result remain provisional, become a GitHub issue, or change a
   durable convention?
