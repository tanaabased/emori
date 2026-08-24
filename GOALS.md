# Goals

Owner: pirog
Visibility: Public
Last reviewed: 2026-08-24
Review cadence: Weekly and when new information materially changes the plan

This file contains reviewed goals, priorities, responsibilities, and success
conditions. GitHub issues and pull requests hold executable work, decisions, and
progress evidence. Confidential details belong in private issues or ignored
context.

Tanaab is building a digital agency for the AI age around hybrid human-agent
teams and continuously improving operational systems.

## Current Objective

Operationalize and improve a unified human-agent work system by using Canon and
Agent System to complete real repository work, gathering evidence from failures
and friction, and feeding validated improvements back into both systems.

The immediate priority is no longer merely constructing the initial machinery.
It is proving that the machinery helps humans and agents accomplish useful work
together.

### Responsibilities

#### pirog

- Continue advancing
  [`tanaabased/canon`](https://github.com/tanaabased/canon) and
  [`tanaabased/openclaw-agent-system`](https://github.com/tanaabased/openclaw-agent-system).
- Introduce new capabilities in response to observed needs, likely including
  memory, installation and synchronization, custom GitHub notifications, prompt
  injection, instructions, and related agent-runtime integration.
- Provide EMORI with representative coding tasks and progressively larger work
  that exercises the system.
- Make product and policy decisions when pilot evidence exposes consequential
  tradeoffs or authority changes.

#### EMORI

- Serve as the primary pilot and demanding user of Canon and Agent System.
- Complete useful coding and repository tasks through the shared work system,
  beginning with bounded bug fixes and maintenance across several repositories.
- Exercise assignment, planning, implementation, commit, pull-request, review,
  completion, and notification workflows where applicable.
- Record failures, friction, missing capabilities, and opportunities for
  simplification.
- Promote reproducible defects and concrete improvements into GitHub issues in
  the repository that owns them.
- Keep this workspace and agent configuration aligned with reviewed Canon and
  Agent System updates.
- Distinguish platform defects from project-specific mistakes, model behavior,
  unclear task definitions, and ordinary implementation difficulty.

#### Shared

- Periodically review pilot evidence and decide which findings justify changes.
- Prefer improvements supported by repeated use over speculative abstractions.
- Preserve clear authority, identity, privacy, and public/private output
  boundaries as automation expands.
- Revise these goals when evidence changes the appropriate priorities.

## Active Workstream

### Pilot the Human-Agent Work System

Use real repository work as the proving ground for Canon and Agent System.

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

The coding work is not separate from the systems objective. It supplies the
evidence needed to determine whether the work system is useful, trustworthy, and
worth expanding.

### Evidence and Recordkeeping

- Provisional observations may remain in daily memory or ignored scratch space.
- Reproducible defects and actionable improvements belong in GitHub issues
  owned by the affected repository.
- Pull requests and checks provide implementation and verification evidence.
- Periodic pilot summaries should capture recurring patterns and consequential
  conclusions rather than every individual event.
- `GOALS.md` retains reviewed direction and priority; it is not a task queue or
  raw activity log.

### Success Evidence

The current objective is succeeding when:

- EMORI regularly completes useful work across multiple repositories through the
  shared system.
- The path from task intake through implementation, review, and verified
  completion works without routine manual repair.
- Agent identity, credentials, repository authority, and public/private output
  boundaries remain correct across supported harnesses.
- Failures produce enough evidence to distinguish configuration, platform,
  model, task-definition, and project-code problems.
- Validated findings become owned issues and lead to measurable improvements in
  Canon or Agent System.
- New Canon and Agent System releases can be incorporated into EMORI's workspace
  without accumulating bespoke or duplicated conventions.
- At least one larger milestone can eventually be planned, assigned, executed,
  reviewed, and completed through the same process.
- Regular review improves both the work being performed and the system used to
  perform it.

## Supporting Systems

### Canon

[`tanaabased/canon`](https://github.com/tanaabased/canon) owns shared,
portable `tanaab-*` skills and work conventions.

Its role is to provide reusable judgment and workflows for task intake,
repository work, implementation, review, completion, documentation, and other
recurring project operations.

### Agent System

[`tanaabased/openclaw-agent-system`](https://github.com/tanaabased/openclaw-agent-system)
owns agent identity, credentials, authority, managed Git and GitHub operations,
worktrees, notification intake, runtime integration, and related workspace
configuration.

Its role is to let agents perform trusted work without collapsing operator,
agent, repository, and provider boundaries.

## Deferred Objective

Develop Tanaab's public brand and publishing platform through
`tanaabased/theme`, `tanaabased/website`, and only the supporting packages and
integrations required for the website, blog, and distribution.

This remains important but is not active scope. Executable work should resume
after the current pilot has produced a stable operational baseline and there is
sufficient attention available for product and design decisions.

## Not Now

- Theme, website, blog, and broader public-brand implementation.
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
