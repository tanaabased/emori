# Advanced operations

Operator details for EMORI's installed workspace. Start with the
[README quickstart](./README.md#quickstart).

## Manual onboarding

After installation:

1. Sign in to Codex/OpenAI using the operator-approved account flow.
2. Sign in to Messages on the Gateway Mac. Grant Full Disk Access and Messages
   Automation to the actual Gateway process context, then approve the first
   iMessage pairing.
3. Configure private delivery destinations outside this public repository.
4. Verify delivery with an explicitly authorized real message. Successful
   configuration alone does not prove delivery.

## Reconciliation

From EMORI's checkout, rerun `openclaw agent-system install --yes` to reconcile
changes, then run `openclaw agent-system doctor` to inspect readiness and drift.
Existing Canon checkouts are preserved; installation does not pull their latest
changes.

Installation-only automation can use `openclaw agent-system install --skip-setup`.
This skips every setup check and apply, so it does not establish full readiness.

## Configuration ownership

Agent System owns the identity, runtime, model and effort profiles, model
admissions, credentials, Git/SSH, GitHub admission, and memory-provider binding declared in
[the manifest](./.agent-system/agent.yaml).

EMORI's final setup step reconciles [OpenClaw policy](./openclaw.patch.json),
including execution, messaging, Workshop, and memory settings, while preserving
unrelated shared arrays and private channel values. Chat-model routing, fallback
selection, effort, runtime bindings, and admissions remain Agent System-owned
and are reconciled from the manifest. Make non-model workspace policy changes in
that fragment and rerun installation; do not apply the raw fragment directly,
which would bypass merge logic and replace shared arrays.

Workshop is explicitly `off`: background learning and unused-skill cleanup are
disabled. OpenClaw removed proposal staging; `off` does not restore review before
each change. Ask EMORI to save or update a learned skill, or use `/learn`, when
you want to learn from a conversation. This requires the `skill_workshop` tool.

## Private continuity

Setup does not restore private memory, import conversations, or force an index
rebuild. Continuity restoration, authenticated indexing, and retrieval
verification require separate authorization after setup.

Private memory belongs in ignored workspace storage; credentials, channel state,
and transcripts belong outside this repository. Ignore rules prevent accidental
tracking, not disclosure.

## Drive backups

The nightly declaration is enabled by default at **04:00 America/New_York**.
Agent System installation synchronizes and enables the job when the Gateway is
reachable. If scheduler discovery is unavailable, installation warns and defers
automation sync; rerun installation once the Gateway is available.
The repo-owned task uses
Agent System backup commands and the strict managed Google launcher, delivering a
fresh verified archive to the
[supplied Drive folder](https://drive.google.com/drive/folders/1rSRlVHUrApaqxpNZVAO_IXnVuVhdiZVV).
It does not change sharing. Only user-shared My Drive destinations are admitted;
Shared Drive behavior has not been piloted. Creation relies on Agent System's
verification-before-publication guarantee (supported baseline: `0.8.0`); the task
requires its successful response to confirm workspace and agent-state capture.

From the installed EMORI checkout, the operator can pilot the complete task:

```sh
cd /Users/emori/tanaab/emori
bun scripts/backup-drive-task.js --operator
```

This creates and uploads one fresh archive, then compares its owned Drive ID,
parent, size, SHA-256 and MD5 with the local bytes. Agent System already verifies
archive contents during creation; there is no duplicate nightly verification or
download. Workspace and database capture are not an atomic snapshot.

After recording delivery, the task attempts the existing five-backup policy.
Only files proven by this job's delivery records can be deleted; Drive excess
goes to trash. Legacy archives, unrelated files, and the old `journal.json` stay
preserved, not imported or synchronized. Local cleanup reuses Agent System's
`prune --keep 5`; an old-schema archive that breaks its preview only defers cleanup.

A delivered backup exits successfully with `delivery: "confirmed"`. Cleanup errors
report `retention: "deferred"` and a sanitized reason, not backup failure. Cleanup
stops at the first error, preserving remaining files; already completed deletions
are not rolled back. Legacy files, unresolved uploads, or deferred cleanup can
leave more than five copies. Failed or uncertain fresh delivery exits nonzero
without pruning or claiming delivery.

The scheduled command omits `--operator`. It requires the automation runner's
active-agent binding; there is no fallback to host Google credentials. An
operator-only manual run does not prove the bound scheduled command works.
Code validation and installation do not prove operational recovery. A separately
authorized operator pilot and actual nightly occurrence are needed to establish
live behavior; disposable tests do not run those operations.

### Interrupted runs

Each ordinary invocation captures current state afresh, even after an earlier
creation or upload failure. Sanitized status lives in
`.private/backup-drive/status.json`; compact ownership and upload-intent evidence
lives in `deliveries.json` beside it. Never publish these records or archive
contents. The obsolete `journal.json` is neither read nor rewritten, so obsolete
checkpoints cannot block a fresh backup.

An unresolved older upload is not reconciled or replayed by the nightly job.
A different fresh archive can still be delivered, with cleanup deferred until
uncertainty is resolved. Preserve pending records: an empty Drive listing does
not prove an uncertain upload failed.

The whole workflow uses a nonblocking OS file lock on `run.lock`. Its descriptor
is also inherited by each direct managed command, so killing the wrapper does
not release exclusion while that command remains alive. The OS releases the
lock when its last descriptor closes. The empty file stays in place: never
delete or replace it to unlock an active run. This requires a local filesystem
with working `flock` support on macOS or Linux; network filesystems are not supported.

For the first upgrade from the existence-only lock, stop old scheduled/manual
runs and establish that their managed commands have exited before switching
versions. A nonempty legacy `run.lock` is refused with `legacy-backup-lock`;
preserve it under another private evidence filename only after establishing
writer quiescence. Do not discard journals, delivery records, status, or archives.
No migration command or live repair runs as part of installation.

Agent System stages and verifies archives before publishing their final names.
A hard interruption can leave staging or hidden `.pending-*` files, or a completed
local archive whose return was lost. These files are not guessed or deleted to
retry creation; abandoned temporary-file cleanup is separate. To resolve an exact
upload already attempted by the new task, the operator-only override remains:

```sh
bun scripts/backup-drive-task.js --operator --resume-archive .agent-system/backups/EXACT-ARCHIVE.tar.gz
```

The override requires an existing `deliveries.json` entry for that archive and
verifies it once before checking the exact recorded remote ID, or finding its
unique name and comparing owned bytes. It never retries an uncertain upload when
no match is found. Arbitrary legacy archives are not automatically adopted;
preserve them for separately authorized recovery. Investigate missing or changed
remote files and pending/deleting records before changing evidence. Do not clear
a record just to make cleanup run. Existing recoverable archives are preserved
on fresh-delivery failure.
