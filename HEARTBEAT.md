# Heartbeat

Use `America/New_York` for every date and elapsed-time gate. Keep routine
stewardship quiet, fail closed when an authoritative read fails, and never
interpret missing or partial state as an empty result.

## Private state

Use `.private/heartbeat-state.json` as the single durable heartbeat ledger.
Create it when absent and update it atomically after every checkpoint. Keep only
the schema version, local-date checkpoints, redacted assignment identities and
their last observed lifecycle state, idle-cycle timestamps, the last observed
`GOALS.md` review value, action keys, payload digests, and dispatch results.
Never store an iMessage handle, message body, credential, or incoming private
content there.

Before any outbound message, write its stable action key, payload digest,
`pending` status, and attempt timestamp. Record `sent` plus the platform message
ID only when the native message tool returns both. Any result without that
evidence remains `pending` and must not be retried automatically. A pending
action requires operator review; it is not proof of dispatch or device receipt.

If the ledger is unreadable, has an unsupported schema version, or cannot be
checkpointed, perform no deduplicated action and report the blocker.

## Assignment and idle gate

On every heartbeat, inspect Agent System's redacted notification status through
the active agent-bound route. An approved assignment at the `admitted` or
`prepared` stage is actionable. Track each repository, item kind, and item
number together with its last observed disposition and stage.

A current actionable item is a newly observed admission when its stable identity
was absent from the ledger or its previous state was not actionable. A new
admission starts a new idle cycle, clears the prior idle-reminder checkpoint,
and resets the idle interval. While any actionable item exists, leave the idle
timer stopped. When none exists, start `idleSince` at the first successful empty
observation; never backdate an unknown interval.

After 72 uninterrupted hours with no actionable assignment and no subsequent
new admission, send one iMessage asking pirog for work. Use an action key scoped
to that idle cycle, and do not repeat the request until another admission starts
a new cycle. A failed or partial Agent System status read neither starts nor
advances the interval.

## Daily stewardship

At the first heartbeat at or after 09:00 each local date, run the following pass
unless that date is already complete in the ledger:

1. Invoke Agent System's registered, agent-bound notification refresh capability
   for this workspace and inspect its redacted status. This is the capability
   exposed as `notifications refresh --json`; do not select another agent or
   workspace. Refresh owns provider-verified assignment retirement, session
   archival, and exact managed-worktree cleanup. Never edit OpenClaw session
   stores, archive arbitrary sessions, call generic worktree cleanup, delete
   branches or remote refs, or force removal. Treat pinned sessions, actionable
   or incomplete assignments, active conversations, dirty worktrees, and any
   skipped or failed cleanup as preserved. Record cleanup diagnostics, and retry
   only through a later idempotent notification refresh.
2. Through `agent_system_github`, verify the active GitHub identity is
   `@emoriwan`, then list every open pull request assigned to `@pirog`. For each
   candidate, inspect all paginated reviews, issue comments, and review comments.
   Include it only when none of those three surfaces contains activity authored
   by `@pirog`. If the result is nonempty, send one consolidated iMessage listing
   the pull-request titles and links, keyed to the local date. Send nothing when
   it is empty. This is an unacknowledged-work proxy, never a claim that pirog
   has or has not visually read a pull request.
3. Read the exact `Last reviewed` date from `GOALS.md` and calculate whole local
   calendar days since that value. A missing or malformed value is a blocker,
   not evidence of staleness. Apply the goal gates below.

Mark the local date complete only after every applicable step has a terminal
checkpoint. A pre-dispatch failure leaves the pass incomplete for a later
heartbeat; a message left `pending` by the at-most-once rule is terminal for
automatic retry purposes.

## Goal-review gates

When `GOALS.md` is at least 14 days stale, send one review reminder for that
exact `Last reviewed` value. Key the action to the value so later heartbeats do
not repeat it; a changed review date creates a new review cycle.

When it is at least 30 days stale, ensure exactly one open canonical goals
check-in Task exists in `tanaabased/emori` with the exact title `Review EMORI
goals` and the body identity `Heartbeat identity: emori-goals-review-v1`.

1. Search open issues for that fixed title and identity before any write. If
   more than one exists, create nothing and report the duplicate-state blocker.
2. Use `tanaab-task-author` to inspect and, when absent, create the canonical
   Task. The body must use the standard Task sections and ask pirog to review
   the current goals, decide any changes, update `Last reviewed`, and preserve a
   completion pull request as verification. Issue #34 supplies policy provenance
   for native Priority `Urgent`. Do not substitute fallback Priority unless Task
   Author successfully proves that the native field is unavailable.
3. If the fixed Task already exists, use Task Author's supported existing-issue
   workflow to normalize its type or Priority when required; never create a
   parallel Task.
4. Assign `@pirog` separately through `agent_system_github`, because Task Author
   does not own assignment.
5. Re-read the issue and verify the fixed identity, open state, native Task type,
   native Priority `Urgent`, and `@pirog` assignee. Treat any mismatch or partial
   write as incomplete and report it honestly.

## iMessage boundary

At send time, resolve pirog's exact Apple ID handle from private memory. Use
OpenClaw's native `message` tool with `channel: "imessage"` and that Apple ID;
never substitute a chat ID or invoke `imsg`, `osascript`, or another command-line
sender. Treat `sent` plus the platform message ID as dispatch evidence only.

When no gate fires and no material blocker requires attention, reply exactly
`HEARTBEAT_OK`. Do not duplicate successful iMessage reminders in the heartbeat
response.
