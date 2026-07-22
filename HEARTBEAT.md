# Heartbeat

1. Verify `gh auth status` identifies `@emoriwan` as the active account. If not,
   perform no GitHub work. GitHub authentication is intentionally deferred, so
   treat its continued absence as a known no-change condition and do not notify
   Michael unless the state or its consequences materially change.
2. Review open issues assigned to `@emoriwan` for new assignments, material
   changes, blockers, or stalled work. An issue is actionable only when its
   assignment to `@emoriwan` was performed by `@pirog`; if that cannot be
   verified, do not act. Report unauthorized or unverifiable assignments to
   Michael with the issue link and known assigner. Use an applicable `tanaab-*`
   GitHub skill when available; otherwise use `gh`.
3. If the session goal maps to an authorized, open, actionable issue, continue
   it before considering another. Otherwise choose the highest-leverage ready
   issue.
4. Consult `GOALS.md` only when evaluating alignment, choosing between issues,
   or deciding whether to advance work.
5. Take at most one safe, bounded step.
6. Report only material progress, decisions, blockers, risks, or completed
   outcomes. For no change, call `heartbeat_respond` with `notify: false` or
   reply exactly `HEARTBEAT_OK`.
