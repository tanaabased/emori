# Goals

Owner: pirog
Visibility: Public
Last reviewed: 2026-08-24
Review cadence: Every two weeks and when new information materially changes the plan

This is the direction pirog has agreed to. Work, decisions, and evidence belong
in GitHub issues and pull requests. Confidential details belong in private
issues or ignored context.

Tanaab is building a digital agency where humans and agents work together and
improve the systems they use. The arrangement has to earn its keep.

## Current Objective

Put [Canon](https://github.com/tanaabased/canon) and
[Agent System](https://github.com/tanaabased/openclaw-agent-system) to work on real
repositories. Find out where they help, where they fail, and what needs to
change. Feed verified findings back into both.

### Responsibilities

#### pirog

- Develop Canon and Agent System where experience shows a need, likely including
  memory, installation and synchronization, custom GitHub notifications, prompt
  injection, instructions, and related agent-runtime integration.
- Give EMORI representative coding tasks, increasing their scope as the pilot
  progresses.
- Make product and policy decisions when the pilot reveals significant
  tradeoffs or proposed changes to authority.

#### EMORI

- Be the system's primary pilot and demanding user. Complete useful coding and
  repository tasks through it.
- Exercise assignment, planning, implementation, commit, pull-request, review,
  completion, and notification workflows where applicable.
- Record what breaks, what gets in the way, what's missing, and what could be
  simpler. File reproducible defects and concrete improvements in the owning
  repository.
- Keep this workspace and agent configuration aligned with reviewed Canon and
  Agent System updates.

#### Shared

- Review the pilot's evidence periodically and decide what merits a change.
- Let repeated use make the case for new abstractions.
- Preserve clear authority, identity, privacy, and public/private output
  boundaries as automation expands.
- Revise these goals when evidence changes the appropriate priorities.

## Active Workstream

Favor these at first:

- Small, well-bounded bug fixes and maintenance tasks.
- Repositories where mistakes are inexpensive and results are easy to verify.
- Work across different repository configurations and organizations.
- Tasks that exercise existing Canon skills and Agent System lifecycle paths.
- Periodic synchronization after pirog lands new platform capabilities.

As the system proves reliable, move on to:

- Features requiring planning and clarification.
- Multi-step work spanning implementation, review, and follow-up.
- Larger milestones with several related issues.
- Additional notification, memory, instruction, and runtime surfaces.

### Evidence and Recordkeeping

Keep provisional observations in daily memory or ignored scratch space. Use
pull requests and checks to establish what worked. Summaries should explain
recurring problems and conclusions that matter. Nobody needs a transcript of
every minor inconvenience.

### Success Evidence

We can call this useful when:

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

Return to this when the pilot works reliably and there is time to give product
and design decisions proper attention.

Also outside current scope:

- Cross-repository initiative machinery beyond what real pilot work requires.
- New abstractions without evidence from actual use.
- Business or revenue metrics before the work system is operational enough for
  them to be meaningful.
- Automation that broadens authority merely to avoid a deliberate review or
  approval boundary.

## Decision Rules

When evaluating proposed work:

1. Will this meaningfully test or improve the human-agent work system?
2. What useful work or evidence will it produce?
3. Does the finding apply elsewhere, or just to this repository or task?
4. What more important work would have to wait?
5. How will we know it is finished and works?
6. Does it preserve appropriate identity, authority, privacy, and reversibility?
7. Is this still an observation, ready for a GitHub issue, or enough evidence to
   change how we work?
