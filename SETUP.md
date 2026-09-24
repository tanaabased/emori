# EMORI Setup

Agent System installs EMORI's declared identity and credentials, then runs the
ordered setup steps in [`.agent-system/agent.yaml`](./.agent-system/agent.yaml).
Only the verified green prefix is declared. Later concerns remain tracked in
[issue #65](https://github.com/tanaabased/emori/issues/65) until each can pass
independently; setup is not a museum for code that once looked plausible.

## Current setup prefix

| ID                  | EMORI-owned effect                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `brew-dependencies` | Reconciles [`Brewfile`](./Brewfile) and the platform-specific SQLite vector package.                                |
| `canon-checkout`    | Creates `~/tanaab/canon` only when absent. Existing and dirty Canon checkouts are never updated, reset, or cleaned. |
| `canon-plugin`      | Links the Canon checkout as the `tanaab` plugin and enables it without changing skill policy.                       |

The steps invoke ordinary `brew`, `npm`, and `git` commands. They deliberately do
not use `AGENT_SYSTEM_GIT`, `AGENT_SYSTEM_GH`, or another strict launcher
environment variable. This exercises Agent System's default context-sensitive
routing, including the plain `git clone` used for Canon. Homebrew receives only
`HOMEBREW_NO_AUTO_UPDATE=1`; setup does not strip Agent System authority or edit
the inherited `PATH`.

Agent System continues to own identity, declared model routing, environment
credentials, Git and SSH signing, GitHub admission, and memory-provider binding.
Those values do not belong in setup patches wearing fake moustaches.

## Prerequisites

Before running setup:

- Provision the macOS host and OpenClaw with Agentbox.
- Use OpenClaw 2026.9.5 or a compatible newer release.
- Install an Agent System build containing setup support, context-sensitive
  command routing, and Agent System-owned model/runtime binding. CI pins the exact
  tested revision until a compatible release exists.
- Give EMORI's 1Password service account access to the manifest's required
  environment and SSH key.
- Install Node.js 24 and Bun 1.3. OpenClaw and Agent System are host
  prerequisites; setup does not recursively install its own floorboards.

Run the full install from EMORI's checkout:

```sh
openclaw agent-system credentials set op
openclaw agent-system validate
openclaw agent-system install
openclaw agent-system doctor
```

For installation-only automation, skip every setup step explicitly:

```sh
openclaw agent-system install --skip-setup
```

Checks are read-only. Exit `0` means healthy, `1` means actionable drift, and
other statuses mean a prerequisite or inspection is blocked. Applies are safe to
repeat. An existing Canon checkout is preserved without pulling or modifying it.

## Deferred setup concerns

The Codex, iMessage, and bundled plugins plus skill policy, execution policy,
messaging, iMessage routing, session policy, heartbeat, Workshop, browser
defaults, and memory behavior are not yet declared setup steps. They will be
added one concern at a time after the current prefix passes its first-run and
unchanged-rerun CI evidence.

The authoritative ordered inventory and current cutoff live in
[issue #65](https://github.com/tanaabased/emori/issues/65). A manifest include
system is deferred until repeated implementations establish a real need; nineteen
explicit lines are cheaper than one speculative abstraction and its inevitable
support group.

## Manual onboarding

Setup cannot and should not automate account consent:

1. Sign in to Codex/OpenAI using the operator-approved account flow.
2. Sign in to Messages on the Gateway Mac, grant Full Disk Access and Messages
   Automation to the actual Gateway process context, then approve the first
   iMessage pairing.
3. Configure private delivery destinations outside this public repository.
4. Verify channel delivery with an authorized real message. Configuration success
   is not evidence that macOS delivered anything; apparently permissions still
   decline to become telepathic.

Browser-local profiles, realtime voice, and private browser customization remain
optional and outside the initial setup sequence.

## Memory and continuity

Setup does not restore private memory, import conversations, copy session history,
publish learned Workshop skills, or force an index rebuild. Authenticated memory
indexing, retrieval verification, and continuity restoration remain separate,
explicitly authorized work after public setup converges. Never stage private
continuity material in this repository. Karabast, `.gitignore` is not encryption.
