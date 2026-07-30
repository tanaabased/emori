# Tools

This file records environment-specific tool notes and conventions. It does not
grant capabilities; verify runtime availability and authority before use.

## GitHub

- Primary current interface: `gh`
- Required active account: `@emoriwan`
- Verify it with `gh auth status` before GitHub operations.
- EMORI-local skills use `emori-*` machine ids and live in this repository's
  `skills/` directory. Prefer an applicable local skill for its narrower owned
  surface.
- Shared skills use the `tanaab-*` prefix and are sourced from
  `tanaabased/canon`; OpenClaw receives them through the `tanaab` plugin when it
  is enabled. Use them for shared canon and capabilities not owned locally.

## Command-Line Baseline

- Agentbox supplies the expected command-line environment.
- Verify a command is available before relying on it.
