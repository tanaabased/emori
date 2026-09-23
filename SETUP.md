# EMORI Setup

Agent System installs EMORI's declared identity and credentials, then runs four
ordered setup groups from [`.agent-system/agent.yaml`](./.agent-system/agent.yaml).
The groups stay broad because seventeen configuration keys do not need seventeen
tiny ministries.

## Ownership

| Group           | EMORI-owned effect                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dependencies`  | Reconciles [`Brewfile`](./Brewfile) and creates `~/tanaab/canon` only when absent. Existing and dirty Canon checkouts are never updated.                  |
| `plugins`       | Links Canon as the `tanaab` plugin, enables required official capabilities, verifies skill discovery, and removes redundant Canon skill discovery.        |
| `configuration` | Adds EMORI's Codex routes, iMessage account and isolated binding, message behavior, execution policy, Workshop policy, and heartbeat defaults.            |
| `memory`        | Enables same-agent file/session recall, Active Memory, Memory Core dreaming, vector search, and private ignored memory paths without rebuilding an index. |

Agent System continues to own identity, model selection, environment credentials,
Git and SSH signing, GitHub admission, and the memory provider/model/credential
binding. Setup merges only the settings above. It preserves unrelated agents,
bindings, plugin configuration, existing checkouts, and private memory.

Canon is intentionally not a `git.worktrees.repositories.local` override. Agent
System validates local overrides before setup runs, which would require the
checkout before the step responsible for creating it—a dependency loop wearing a
tie. Use a normal managed project worktree when editing Canon.

## Prerequisites

Before running setup:

- Provision the macOS host and OpenClaw with Agentbox.
- Use OpenClaw 2026.9.5 or a compatible newer release.
- Install an Agent System build containing
  [setup support](https://github.com/tanaabased/openclaw-agent-system/pull/137).
- Give EMORI's 1Password service account access to the manifest's required
  environment and SSH key.
- Install Node.js 24 and Bun 1.3. OpenClaw and Agent System themselves are host
  prerequisites; setup does not recursively install its own floorboards.

Run the full install from EMORI's checkout:

```sh
openclaw agent-system credentials set op
openclaw agent-system validate
openclaw agent-system install
openclaw agent-system doctor
```

For installation-only automation, omit every setup command explicitly:

```sh
openclaw agent-system install --skip-setup
```

Checks are read-only. Exit `0` means healthy, `1` means actionable drift, and
other statuses mean a prerequisite or inspection is blocked. Applies are safe to
repeat; an existing Canon checkout, `MEMORY.md`, or `memory/` directory is left in
place.

## Manual onboarding

Setup cannot and should not automate account consent:

1. Sign in to Codex/OpenAI using the operator-approved account flow.
2. Sign in to Messages on the Gateway Mac, grant Full Disk Access and Messages
   Automation to the actual Gateway process context, then approve the first
   iMessage pairing.
3. Configure the private owner handle used for heartbeat delivery. Setup restores
   the reviewed 30-minute cadence and preserves any existing destination, but no
   private address belongs in this repository.
4. Run `openclaw doctor --fix` when ready to materialize the heartbeat monitor and
   apply OpenClaw's safe state migrations.
5. Verify channel delivery with an authorized real message. Configuration success
   is not evidence that macOS delivered anything; apparently permissions still
   decline to become telepathic.

Browser-local profiles, realtime voice, and private browser customization remain
optional and are not part of essential setup.

## Memory and continuity

Setup initializes only empty ignored memory paths and configuration. It never
restores private memory, imports conversations, copies session history, publishes
learned Workshop skills, or forces a healthy index rebuild.

After credentials and permissions are available, inspect memory without changing
it:

```sh
openclaw memory status --agent emori --deep --json
```

Run authenticated indexing or repair only as a separate, explicitly authorized
operation. Restore private continuity from its private backup path after the public
setup converges; never stage that material in this repository. Karabast, `.gitignore`
is not encryption.
