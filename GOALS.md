# Goals

Owner: Michael
Visibility: Public
Last reviewed: 2026-07-20
Review cadence: Weekly and when new information materially changes the plan

This file contains reviewed goals and priorities. Confidential details belong in
private GitHub issues or ignored context.

This format is transitional while the shared GitHub workflow is being built.
Until then, it may contain immediate next steps; once milestones can carry that
work, retain only objectives, priorities, status, and safe milestone links here.

Tanaab is building a digital agency for the AI age around hybrid human-agent
teams and continuously improving operational systems.

## Current Objective

Build a unified human-agent work system that turns goals into organized,
assigned, completed, verified, and continually improved work through one shared
GitHub-based process.

### Success

- Humans and agents use the same path from goal to milestone, issue, assignment,
  execution, review, and verified completion.
- `GOALS.md` retains direction and priority while GitHub milestones and issues
  hold executable work and progress evidence.
- Regular review improves both the work and the system used to perform it.

## Active Workstream

### GitHub Work Protocol (`tanaabased/canon`)

- Outcome: Humans and agents can create, refine, triage, assign, execute, and
  verify GitHub issues, milestones, and pull requests using shared `tanaab-*`
  skills.
- First capability: Standardized milestone and issue creation, refinement, and
  readiness assessment.
- Success evidence: Concrete `tanaab-*` skills cover the agreed issue-to-merge
  flow and work in both Codex and OpenClaw.
- Interim next steps:
  1. Define the minimum issue and milestone contracts.
  2. Build the first milestone and issue-management skills.
  3. Prove them on real work and revise the conventions from evidence.
  4. Use them to create milestones and issues for the remaining workstreams.
- Milestone: Pending the first usable milestone-management skill.

## Planned Workstreams

### Agent System

- Proposed repository: `tanaabased/agent-system`
- Product: A reusable OpenClaw plugin for any agent workspace.
- Outcome: Each agent has workspace-level configuration for identity, trusted
  principals, permissions, credential references, runtime needs, maintenance,
  and Covenant protection.
- Success evidence: The plugin can configure EMORI without storing workspace
  secrets, enforce authority boundaries, require GitHub operations as
  `@emoriwan`, route heartbeat alerts to a private Michael-visible destination,
  and be adopted independently of EMORI.
- Constraints: Prefer portable OpenClaw mechanisms where sufficient; keep
  secrets external.

### GitHub Communication Channel

- Proposed repository: `tanaabased/github-channel`
- Product: A reusable OpenClaw channel plugin for GitHub.
- Outcome: Authorized GitHub assignments, mentions, comments, and state changes
  reach an agent and support an ongoing work conversation through GitHub.
- Success evidence: Trusted GitHub events reliably activate the correct agent;
  unauthorized content is treated as data, not instruction.
- Constraints: Authenticate senders, resist prompt injection, and preserve
  least-privilege access.

## Next Objective

Develop Tanaab's public brand and publishing platform through
`tanaabased/theme`, `tanaabased/website`, and only the supporting Node or Bun
packages and integrations needed for the website, a blog, and distribution to
X. This is a reminder, not active scope; executable work will be defined after
the current objective is operational.

## Not Now

- Cross-repository initiative machinery beyond corresponding repository
  milestones.
- Business or revenue metrics before EMORI is operational enough for them to be
  meaningful.

## Decision Rules

When evaluating proposed work:

1. Does it materially advance an active goal?
2. If not, is it a necessary obligation, maintenance, risk reduction, learning, or time-sensitive opportunity?
3. What higher-priority work would it displace?
4. What evidence would show that it was worth doing?
