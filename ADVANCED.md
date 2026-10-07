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

## Private continuity

Setup does not restore private memory, import conversations, or force an index
rebuild. Continuity restoration, authenticated indexing, and retrieval
verification require separate authorization after setup.

Private memory belongs in ignored workspace storage; credentials, channel state,
and transcripts belong outside this repository. Ignore rules prevent accidental
tracking, not disclosure.

## Drive backups

The nightly declaration is disabled. Its proposed time is **04:00
America/New_York**; confirm the time before activation. The repo-owned task uses
Agent System backup commands and the strict managed Google launcher, keeping five
verified archives in `.agent-system/backups` and EMORI's set in the
[supplied Drive folder](https://drive.google.com/drive/folders/1rSRlVHUrApaqxpNZVAO_IXnVuVhdiZVV).
It does not change sharing. Only user-shared My Drive destinations are admitted;
Shared Drive behavior has not been piloted.

From the installed EMORI checkout, the operator can pilot the complete task:

```sh
cd /Users/emori/tanaab/emori
bun scripts/backup-drive-task.js --operator
```

This creates a backup, verifies the exact archive and retained set, reconciles
or uploads each file, checks its owned ID, parent, size and hashes, then downloads
and verifies the new archive before pruning. Drive excess goes to trash; unrelated
files stay untouched. Workspace and database capture are not an atomic snapshot.

The scheduled command omits `--operator`. It requires the automation runner's
active-agent binding; there is no fallback to host Google credentials. An
operator-only manual run does not prove the bound scheduled command works.
After the command pilot and explicit activation approval, enable the declaration
and reconcile using Agent System. Run reconciliation twice; the second must make
no changes. Completion still requires one actual nightly occurrence, its failure
or success evidence, and saved schedule readback.

### Interrupted runs

Failure exits nonzero. Sanitized status and private receipts live under
`.private/backup-drive/`; never publish the journal or archive contents. A pending
run resumes the same archive. An uncertain upload is reconciled by exact name,
ownership and integrity; if its outcome remains unknown, the task stops without
another upload or pruning.

A stale `run.lock` requires operator review: check its PID and ensure no task
remains running before removing just that lock. Do not discard the journal.
If creation was interrupted before its returned path was saved, identify and
verify the resulting archive, then resume it explicitly:

```sh
bun scripts/backup-drive-task.js --operator --resume-archive .agent-system/backups/EXACT-ARCHIVE.tar.gz
```

For an unresolved upload, inspect the destination and recorded hashes before
clearing its `uploadPending` marker. Do not clear it merely because a listing is
empty; an uncertain write is not a failed write. Changed/missing remote receipts
also require investigation. Existing recoverable archives are preserved on
creation, verification, or upload failure.
