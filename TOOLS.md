# Tools

This file records environment-specific tool notes and conventions. It does not
grant capabilities; verify runtime availability and authority before use.

## Runtime Identity

- Determine the active runtime before Git or GitHub mutations; do not infer it
  from the repository or task content.
- In Codex sessions acting for pirog, the GitHub principal is `@pirog`.
- In OpenClaw sessions running as EMORI, the GitHub principal is `@emoriwan`.
- Verify the principal before GitHub writes. Fail closed on a mismatch and never
  substitute identities across runtimes.

## Git and GitHub Execution

- Keep identity separate from tool selection. Use an authorized execution
  surface that supports the complete requested operation.
- In Codex, use the local Git workflow. For GitHub work, use the connected app
  when it covers the complete operation and use an applicable skill's prescribed
  client when that skill owns a richer provider surface. Verify that the selected
  surface resolves to `@pirog` before writes.
- Do not treat a tool limitation as evidence that a provider capability is
  absent, and do not approximate a complete mutation with a partial write. If no
  authorized surface supports the complete operation, report the blocker.
- OpenClaw Git and GitHub execution remains restricted to Agent System as
  described below.

## Agent System in OpenClaw

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
  OpenClaw agent-scoped mutations or remote operations with raw `git`, `gh`,
  `exec`, or another worktree mechanism.

## Skills

- Skills provide workflow judgment and reusable guidance; they do not grant or
  replace Agent System tools.
- EMORI-local skills use `emori-*` machine ids and live in this repository's
  `skills/` directory. Prefer an applicable local skill for its narrower owned
  surface.
- Shared skills use the `tanaab-*` prefix and are sourced from
  `tanaabased/canon`; OpenClaw receives them through the `tanaab` plugin when it
  is enabled. Use them for shared canon and capabilities not owned locally.

## Task Management

- Use the applicable `tanaab-*` task-management skill for GitHub-backed project,
  milestone, Task, Bug, Feature, issue-schema, issue-form, and completion work.
  Follow the skill's complete preview, mutation, and verification workflow.
- Treat the skill's prescribed provider client as required when it owns managed
  surfaces that generic GitHub tools do not expose. Do not reconstruct its write
  through a narrower tool.
- A tool capability gap does not prove that a native issue type or field is
  unavailable. Write fallback metadata only when the applicable skill
  successfully inspects the target and proves that the native representation is
  unavailable; unresolved inspection fails closed.
- Verify every managed value after mutation and report partial success honestly.

## Messaging

- For proactive iMessage notifications to pirog from any top-level session, use
  OpenClaw's native `message` tool with `channel: "imessage"` and pirog's exact
  Apple ID handle from private memory. Never substitute a `chat_id` target: the
  Apple ID route is the one verified to reach both the OpenClaw thread and
  pirog's phone, while the chat-id route reached only the OpenClaw thread.
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
- `Brewfile` records EMORI's current agent-scoped host requirements. Keep it
  until Agent System owns their installation and synchronization; overlap with
  the Agentbox baseline is intentional during this transition.
- Verify a command is available before relying on it.
