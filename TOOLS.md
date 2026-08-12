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

## Messaging

- For proactive iMessage notifications to Mike from any top-level session, use
  OpenClaw's native `message` tool with `channel: "imessage"` and Mike's exact
  Apple ID handle from private memory. Never substitute a `chat_id` target: the
  Apple ID route is the one verified to reach both the OpenClaw thread and
  Mike's phone, while the chat-id route reached only the OpenClaw thread.
  Delivery runs through the Gateway's established `imsg` RPC process.
- Do not invoke `imsg send` or `osascript` through `exec` for agent-initiated
  notifications. A fresh command process can have a different macOS Automation
  context and may fail or report an indeterminate result even while the iMessage
  channel is healthy.
- Treat the message tool's `sent` result and platform message id as dispatch
  evidence, not proof that a device received the message. Report that distinction
  when delivery confirmation matters.
- Native subagents do not receive the message tool. They return completion to
  the parent session, which owns any user-facing notification.

## Command-Line Baseline

- Agentbox supplies the expected command-line environment.
- Verify a command is available before relying on it.
