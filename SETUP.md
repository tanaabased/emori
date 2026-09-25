# EMORI Setup

The [README quickstart](./README.md#quickstart) is the common path. This operator
guide owns setup prerequisites, boundaries, and deferred work. Agent System
installs EMORI's declared identity and credentials, then runs the ordered setup
steps in [`.agent-system/agent.yaml`](./.agent-system/agent.yaml). The complete
audited inventory is declared only after every concern has passed independently;
setup is not a museum for code that once looked plausible.

## Audited setup inventory

| ID                  | EMORI-owned effect                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `brew-dependencies` | Reconciles [`Brewfile`](./Brewfile) and the platform-specific SQLite vector package.                               |
| `canon-checkout`    | Clones Canon over managed SSH when absent and preserves every existing checkout.                                   |
| `canon-plugin`      | Links Canon as `tanaab` and exposes its shared skills.                                                             |
| `codex-plugin`      | Installs the official Codex plugin from ClawHub and enables it.                                                    |
| `imessage-plugin`   | Installs and enables the official iMessage channel plugin without configuring accounts or routing.                 |
| `openclaw-config`   | Atomically merges EMORI's execution, messaging, routing, Workshop, and memory policy after dependencies are ready. |

Each installation concern has an explicit task entrypoint under
[`scripts/`](./scripts) and focused implementation under
[`lib/setup/`](./lib/setup). The final configuration step reads the reviewed
[`openclaw.patch.json`](./openclaw.patch.json) fragment, preserves unrelated
shared arrays and host-private channel values, injects the installed SQLite
extension path, validates the computed patch, and writes it once. Homebrew
receives only `HOMEBREW_NO_AUTO_UPDATE=1`; setup does not strip Agent System
authority or edit the inherited `PATH`.

The fragment is reviewable source, not a directly applicable whole-config
replacement. Run it through `openclaw-config`; applying the raw file would
replace shared arrays before the reconciler can preserve them. Apparently even
declarative configuration needs a warning label when arrays are involved.

Agent System continues to own identity, declared model routing, environment
credentials, Git and SSH signing, GitHub admission, and memory-provider binding.
Those values do not belong in setup patches wearing fake moustaches.

## Prerequisites

Before running setup:

- Provision the macOS host and OpenClaw with Agentbox.
- Install the exact OpenClaw version declared by `devDependencies.openclaw`.
- Install an Agent System build containing setup support, context-sensitive
  command routing, and Agent System-owned model/runtime binding. CI follows
  Agent System `main` and records the exact resolved commit for each run.
- Give EMORI's 1Password service account access to the manifest's required
  environment and SSH key.
- Install Node.js 24 and Bun 1.3. OpenClaw and Agent System are host
  prerequisites; setup does not recursively install its own floorboards.
- Start from EMORI's checkout. Canon may be absent; its setup step creates the
  declared checkout with EMORI's managed SSH identity. Other declared local
  repositories remain optional until their source is needed.

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
repeat. `canon-checkout` creates only its owned checkout; declaring another local
repository does not make its source a setup prerequisite.

## Excluded or deferred setup concerns

Bundled Active Memory and Memory Core defaults, standalone skill policy,
heartbeat automation, browser-local state, provider and model binding,
authenticated indexing, empty memory placeholders, and private continuity
restoration are intentionally excluded from EMORI's durable setup. They remain
runtime defaults, Agent System ownership, optional automation, host-local state,
or separately authorized private work.

The authoritative ordered inventory and completion evidence live in
[issue #65](https://github.com/tanaabased/emori/issues/65) and its linked pull
request. A manifest include system remains deferred until repeated implementations
establish a real need; the explicit sequence is cheaper than one speculative
abstraction and its inevitable support group.

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
continuity material in this repository.

The exact ignore rules for `MEMORY.md`, `DREAMS.md`, `memory/`, and `.private/`
prevent accidental Git tracking without manufacturing empty placeholders. The
runtime creates optional storage when it needs it. Ignore rules still do not
provide confidentiality. Karabast, `.gitignore` is not encryption.
