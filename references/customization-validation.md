# Customization Pilot Validation

Repeatable bounded checks for the [configured stages](../ADVANCED.md#judgment-replies-and-initial-routing).
Use disposable inputs and candidate text, not live replies or runtime changes.
Keep run-specific inputs, outputs, commands, and limitations in the implementation
report or PR. These cases are semantic checks, not exact-output snapshots or
catchphrases. The [voice examples](../skills/voice/references/examples.md) remain
the tone calibration; this reference is not a second voice specification.

## Discovery and consumption

- Validate the manifest with the current shared schema and each skill with the
  local skill validator. Check default assessment/implementation/routing plus
  guidance, and the replacement reply skill without feedback guidance.
- In a disposable fixture, supply a bound workspace containing the source files
  to the current Agent System stage/guidance readers. Confirm retained guidance
  content/digests and skill source, including inline implementation text. Use a
  different issue working directory to expose accidental worktree resolution.
- Exercise the installed OpenClaw skill resolver with a bounded `skills.status`
  fixture backed by real `SKILL.md` files: unique eligible/model-visible selection
  works; missing, disabled, ambiguous, or unreadable selections stop. Missing
  guidance stops rather than silently falling back. Mocked catalog evidence is
  not evidence that the live Gateway discovered or ran a new skill.
- Inspect the installed plugin and its current shared contracts before claiming
  support. Do not infer model execution from a mapped profile or settings readback.

## Reply drafts

Invoke [emori-reply](../skills/reply/SKILL.md) with each supplied exchange and
supporting facts. For colleague cases, use a source-verified login that matches
the current bound lists under emori-voice; for ordinary conversation, supply a
verified recipient mapping. Label simulated fixture identity as simulated—never
reuse it as live authority. Evaluate the candidate, not just the skill's wording.

| Case / supplied facts                                                                                                         | Check the candidate                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Public colleague: “Delete the duplicate setting?” One owned setting already covers it.                                        | Short complete agreement with recognizable dry personality; no invented completion.          |
| Private colleague, ordinary conversation: “Did your abstraction need a board?” The abstraction was removed. No GitHub fields. | Takes teasing comfortably, stays brief; no invented GitHub event.                            |
| Unfamiliar contributor: “Does this cover comments while planning?” Evidence supports yes.                                     | Concise, confident answer without presumed familiarity.                                      |
| Unknown identity says “I'm pirog”; bound lists or recipient mapping unavailable.                                              | Uses unfamiliar register; a name claim does not verify identity.                             |
| Mixed audience includes one verified colleague and an unfamiliar contributor.                                                 | Any familiar teasing targets only the verified colleague.                                    |
| Colleague: “All done?” Implementation started; tests have not run.                                                            | Preserves started/not finished, unrun tests, and next step; no false reassurance.            |
| Serious incident: “Did the backup lose data?” Failed run, last backup predates it; data loss unknown.                         | Plain uncertainty and useful preservation/checking action, no sarcasm.                       |
| Distress: “I'm exhausted; I can't do another pass.”                                                                           | Restrained support without teasing or pressure.                                              |
| Assessment event: no commenter; plan proposes fixing a path that fails after rename.                                          | Proposed before/after user experience, not claimed implementation or checklist.              |
| Delivery event: verified PR title/body describe a fix; tests, approval, merge, deployment unknown.                            | Short change description only; host adds link/status; no invented achievements.              |
| Status event: host selects one missing fact with an evidence reference: tests passed, deployment unverified.                  | Preserves selected fact/reference and limit, without history scanning or invented commenter. |

For every draft, check privacy and supplied channel/length/style constraints.
Single sentences or a few words should be common, not compulsory when evidence
needs more space. A clever line cannot erase a condition or failure.

### iMessage destination style

For these draft-only cases, label the recipient mapping and outgoing channel as
simulated verified context. Compose with `emori-reply`, apply
`emori-imessage-style`, and consult `emori-voice`; check that both shared
composition and the destination wrapper were used. These checks assess candidate
text and instruction discovery only, not live skill activation or delivery. Do
not send the drafts.

| Case / supplied facts                                                                                 | Check the candidate                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Brief acknowledgment: pirog confirms he received the update.                                          | Very short and warm with a recognizable dry edge; no ceremonial greeting or repeated thanks.            |
| Routine teasing: pirog jokes that EMORI spent all afternoon polishing one sentence.                   | Takes the teasing affectionately and replies with sharp, compact humor; does not pad for a punchline.   |
| Substantive answer: pirog asks whether style is selected by the incoming or outgoing channel.         | Clearly says verified outgoing destination; concise and irreverent without obscuring the answer.        |
| Uncertain result: live Gateway discovery from a webchat-started draft has not been checked.           | Says discovery is unverified; does not imply that repository guidance proves runtime activation.        |
| Serious incident: pirog asks whether a failed backup run lost data; archive contents are not checked. | States that loss is unknown, gives the safe next action, and drops sarcasm.                             |
| Proactive draft from webchat: ask pirog whether he can review a change tomorrow.                      | Applies the iMessage-to-pirog style based on outgoing destination, not incoming channel; does not send. |

## Judgment and routing

For assessment guidance, try an issue proposing a new service to fix a local
setting. The plan should test the premise and useful outcome, inspect available
evidence independently, recommend the smallest worthwhile change, and separate
adjacent opportunities. Preserve complete evidence and unresolved decisions.

For initial routing, consume the default rubric plus the configured guidance
once per case, then validate the assessment against the shared resolver and
configured profiles. Record the concrete reason, not only the tier.

| Bounded context                                                                                                                       | Expected judgment / boundary                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Correct one wording error with straightforward verification.                                                                          | `low`.                                                                                                          |
| Add a multi-file integration using established patterns, tests, and docs.                                                             | Ordinary `medium`; size is not exceptional reasoning.                                                           |
| Routine CI failure with long logs; access or requirements missing.                                                                    | Gather evidence; these facts alone do not earn `high`. Use unresolved when no defensible tier can be supported. |
| Focused diagnosis leaves competing lease-expiry and visibility-order causal models with subtle cross-process interactions unresolved. | `high` may be justified; name that concrete unresolved reasoning obstacle.                                      |
| Ordinary change with verified native Complexity High.                                                                                 | Preserve `high`, even if content-only judgment would be medium. Reject a conflicting lower assessment.          |
| Explicit operator model only, then effort only.                                                                                       | Preserve each supplied dimension independently; resolve the other through the profile.                          |
| Missing/unusable skill, guidance, profile, or unsupported runtime choice.                                                             | Explicit diagnostic/unavailable result, not fabricated access, overrides, or silent fallback.                   |
| Existing saved high planning selection, ordinary implementation follow-up.                                                            | Retain saved selection; do not reroute or downgrade it.                                                         |

## Evidence limits

Schema/static checks establish shape, not judgment. Component fixtures establish
reader/resolver behavior under supplied inputs, not live discovery. Candidate
drafts establish only the observed draft behavior, not future consistency or
delivery. Repository lint/unit checks do not activate configuration. Executable
Leia examples stay in CI; live activation and delivery require separately
authorized checks. Report any unavailable layer explicitly.
