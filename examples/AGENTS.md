# Leia Example Guidance

This file applies to `examples/**`. Scenario README files are executable Leia specifications that run on fresh GitHub-hosted runners.

## Scope and Placement

- Begin each scenario README with “What this example does” and “What it doesn't do” sections. State the single user-visible outcome, the critical properties it proves, and nearby exclusions. Link existing owners where useful; keep scope concise rather than listing every assertion.
- Before adding coverage, read the existing scenario scope statements and choose the owner. An assertion belongs only when it directly establishes that scenario's stated outcome. Shared prerequisites or convenient installed state do not establish ownership.
- If coverage does not fit, first consider an existing unit or component test, or coverage in the owning dependency. Create a new example when a distinct user-visible flow requires real command execution. Remove redundant coverage rather than relocating it.
- Do not broaden a scope statement merely to accommodate a new assertion. Explain the proposed scope change and its execution cost before expanding the scenario.
- Additional installs, Gateway launches, or model turns must establish a distinct required behavior that existing evidence cannot prove. Reuse captured output and successful owning checks unless a concrete, consequential gap requires another check.
- Keep scenario scope in its README and shared authoring rules here. Add a per-example `AGENTS.md` only for distinct authoring or execution rules; do not duplicate scope in YAML or additional guidance files.

## Scenario Rules

- Keep one user-visible flow per scenario and one behavior per `# should ...` block.
- Treat blank-line-separated Leia blocks as separate scripts; do not rely on variables, functions, or working-directory changes persisting between blocks.
- Use the fresh runner's default OpenClaw profile unless profile behavior is the scenario contract.
- Run real public OpenClaw commands and keep model authentication, Gateway startup, channels, and host setup out of credential-free scenarios.
- The workspace scenario uses the checked-out repository directly. OpenClaw may create the ignored `openclaw-workspace-state.json` marker, but no tracked or unignored workspace files may change.
- Keep runtime output under the scenario's `TMPDIR` and do not commit generated OpenClaw state, sessions, configuration, or credentials.
- Run these scenarios in CI by default; do not run them locally unless the user explicitly requests operational validation.
