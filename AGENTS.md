# EMORI Workspace Guidance

## Purpose

- This repository is the committed, public OpenClaw workspace for EMORI.
- It owns EMORI's public workspace context, agent-specific knowledge, skills, references, and supporting assets or tools.
- `agentbox` or another host-management surface owns macOS preparation, OpenClaw installation and Gateway operation, networking, services, packages, and machine readiness.
- Per-machine configuration, credentials, authentication profiles, provider or channel state, and session transcripts belong outside this repository.

## Workspace Contract

- Treat every tracked file as intentionally public.
- `AGENTS.md` contains concise operating rules and workspace-wide conventions.
- `SOUL.md` and `IDENTITY.md` own EMORI's persona and public identity.
- `USER.md`, `TOOLS.md`, and `HEARTBEAT.md` must remain public-safe and focused on their standard OpenClaw roles.
- `MEMORY.md`, `DREAMS.md`, `memory/`, and `BOOTSTRAP.md` are local-only runtime files and must remain ignored.
- `skills/` contains optional EMORI-specific workflows that load only when relevant.

## Privacy

- Put reviewed, durable, intentionally public context in the appropriate public workspace file or in `references/`.
- Keep daily notes, raw conversation-derived context, sensitive attachments, private preferences, and unreviewed observations in ignored memory or `.private/`.
- Do not use `.private/` as a credential store.
- Never commit API keys, OAuth tokens, passwords, private keys, auth profiles, raw session exports, or provider and channel credentials, even if a file is normally ignored.
- Treat `.gitignore` as an accidental-commit guardrail, not a security boundary.

## Working Conventions

- Keep OpenClaw bootstrap files concise because they are injected into runtime context.
- Keep workspace-wide rules here, reusable triggered workflows in `skills/`, and generic shared guidance in Canon.
- Add scripts, examples, tests, and other tooling only when a concrete workspace need justifies them.
- Use `EMORI` for casual prose references to the agent and persona.

## Validation

- Prefer the narrowest reliable, read-only validation for the changed surface.
- Isolated unit tests are appropriate when relevant and when they do not mutate the host, OpenClaw runtime state, or external systems.
- Do not run bootstrap, installation, onboarding, configuration, service, network, or other machine-mutating commands as validation unless the user explicitly requests them.
- Do not run Leia locally unless the user explicitly requests a local Leia run; treat Leia scenarios as CI-owned by default.
- For guidance or ignore changes, run `git diff --check` and verify the relevant ignore behavior.
