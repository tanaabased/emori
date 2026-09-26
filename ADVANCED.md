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

Agent System owns the identity, model and effort profiles, credentials, Git/SSH,
GitHub admission, and memory-provider binding declared in
[the manifest](./.agent-system/agent.yaml).

EMORI's final setup step reconciles [OpenClaw policy](./openclaw.patch.json),
including model admission and runtime bindings, execution, messaging, Workshop,
and memory settings. It preserves unrelated shared arrays and private channel
values. Make policy changes in that fragment and rerun installation; do not
apply the raw fragment directly, which would bypass the merge logic and replace
shared arrays. Primary model and fallback selection remain Agent System's job.

## Private continuity

Setup does not restore private memory, import conversations, or force an index
rebuild. Continuity restoration, authenticated indexing, and retrieval
verification require separate authorization after setup.

Private memory belongs in ignored workspace storage; credentials, channel state,
and transcripts belong outside this repository. Ignore rules prevent accidental
tracking, not disclosure.
