import safeText from './safe-text.js';

const limit = 16 * 1024;

/** Bound the complete document, never a serialized JSON prefix or a status. */
export default function serializeReport(cards) {
  const selected = cards.map((card) => ({
    id: card.id,
    format: 'structured',
    title: safeText(card.title, 100).replace(/[\r\n]+/gu, ' ') || 'Application report',
    status: ['success', 'warning', 'error', 'unknown'].includes(card.status)
      ? card.status
      : 'unknown',
    summary: safeText(card.summary, 700) || 'Application result unavailable.',
    ...(card.facts?.length
      ? {
          facts: card.facts.map(({ label, value }) => ({
            label: safeText(label, 100).replace(/[\r\n]+/gu, ' ') || 'Detail',
            value: safeText(value, 700) || 'Unavailable',
          })),
        }
      : {}),
    ...(card.findings?.length
      ? {
          findings: card.findings.map(
            (value) => safeText(value, 700) || 'Finding detail unavailable.',
          ),
        }
      : {}),
    ...(card.actions?.length
      ? {
          actions: card.actions.map((value) => safeText(value, 500) || 'Inspect the retained run.'),
        }
      : {}),
  }));
  const encode = (entries) =>
    `${JSON.stringify({ schema: 'agent-system.report', version: 1, cards: entries })}\n`;
  let output = encode(selected);
  if (selected.length && Buffer.byteLength(output) <= limit) return output;
  // Allocate disclosure evenly; retain every normal source and its severity.
  for (const card of selected) {
    const omitted =
      (card.facts?.length ?? 0) + (card.findings?.length ?? 0) + (card.actions?.length ?? 0);
    delete card.facts;
    delete card.findings;
    delete card.actions;
    card.summary = safeText(card.summary, 160);
    if (omitted)
      card.findings = [
        `${omitted} detail entries omitted to fit the report; inspect retained run evidence.`,
      ];
  }
  output = encode(selected);
  if (selected.length && Buffer.byteLength(output) <= limit) return output;
  return encode([
    {
      id: 'report-capacity',
      format: 'structured',
      title: 'Application report unavailable',
      status: 'error',
      summary: `Could not disclose all ${cards.length} application outcomes within the report limit. No partial success is inferred.`,
      actions: ['Inspect retained run evidence; do not repeat mutations to resend reports.'],
    },
  ]);
}
