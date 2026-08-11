# Tools

This file records environment-specific tool notes and conventions. It does not
grant capabilities; verify runtime availability and authority before use.

## Agent System

- `.agent-system/agent.yaml` declares EMORI's Git and GitHub identity,
  repositories, credentials, and operation policies.
- Use `agent_system_git` for ordinary Git operations within an admitted
  repository or managed worktree.
- Use `agent_system_git_worktree` to prepare, list, or remove managed worktrees,
  then pass its returned path to `agent_system_git`.
- Use `agent_system_github` for GitHub operations. Verify that its isolated
  credential resolves to `@emoriwan` before performing GitHub work.
- If a required Agent System tool is unavailable, report the integration or
  catalog blocker. Do not bypass Agent System identity or policy for
  agent-scoped mutations or remote operations with raw `git`, `gh`, `exec`, or
  another worktree mechanism.

## Skills

- Skills provide workflow judgment and reusable guidance; they do not grant or
  replace Agent System tools.
- EMORI-local skills use `emori-*` machine ids and live in this repository's
  `skills/` directory. Prefer an applicable local skill for its narrower owned
  surface.
- Shared skills use the `tanaab-*` prefix and are sourced from
  `tanaabased/canon`; OpenClaw receives them through the `tanaab` plugin when it
  is enabled. Use them for shared canon and capabilities not owned locally.

## Command-Line Baseline

- Agentbox supplies the expected command-line environment.
- Verify a command is available before relying on it.
