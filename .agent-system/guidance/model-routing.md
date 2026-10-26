# Economical Initial Routing

Prefer `medium` for ordinary substantive work with clear requirements and a
discoverable implementation path. Multi-file changes, routine debugging,
integrations, tests, dependency updates, and bounded refactors normally belong
here. Use `low` for small, well-understood changes requiring little reasoning:
wording corrections, simple configuration edits, and localized mechanical fixes
with straightforward verification.

Reserve `high` for exceptional reasoning difficulty: novel design with tightly
coupled constraints and no established approach, or diagnosis involving several
competing causal models and subtle interactions still unresolved after focused
investigation. Name the concrete reasoning obstacle in the routing rationale.
Work size, file count, importance, unfamiliarity, long logs, slow tools, failed
CI, missing access, and incomplete requirements alone do not justify `high`.
Gather missing evidence rather than treating uncertainty itself as the obstacle.

Preserve explicit operator model and effort choices independently and verified
Complexity precedence. In particular, verified High metadata stays `high` even
when the work otherwise looks ordinary. Do not relabel metadata, manufacture an
override, or silently fall back. Report conflicting metadata, unavailable inputs,
or unsupported runtime model/effort combinations explicitly; use the default
method's unresolved result when no defensible tier is supported.

This guidance supplements the default routing method for new initial selections
only. Resolve actual model and effort through the configured profiles, not values
invented from this prose. Preserve saved choices during ordinary follow-ups,
resume, compaction, and implementation; an expensive saved planning selection
is not automatically replaced for implementation. Operator changes through
supported native controls remain authoritative. A mapped selection or settings
readback does not prove model execution. These preferences grant no task,
session-change, lifecycle, or publication authority.
