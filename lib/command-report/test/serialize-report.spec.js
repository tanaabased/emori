import assert from 'node:assert/strict';

import safeText from '../utils/safe-text.js';
import serializeReport from '../utils/serialize-report.js';

const card = {
  id: 'fixture',
  title: 'Fixture',
  status: 'warning',
  summary: 'Activation unverified.',
};
describe('lib/command-report/utils/serialize-report', () => {
  it('should serialize one complete preferred document with plain values and no local icons or footer', () => {
    const text = serializeReport([
      {
        ...card,
        facts: [{ label: 'Check', value: '`raw` | [text]' }],
        actions: ['Inspect retained evidence.'],
      },
    ]);
    const document = JSON.parse(text);
    assert.equal(document.schema, 'agent-system.report');
    assert.equal(document.version, 1);
    assert.equal(document.cards[0].format, 'structured');
    assert.equal(document.cards[0].facts[0].value, '`raw` | [text]');
    assert.doesNotMatch(text, /Runner result|✅|⚠️|❌/);
  });
  it('should preserve every ordinary source and severity while disclosing omitted diagnostic-heavy detail', () => {
    const values = Array.from({ length: 4 }, (_, index) => ({
      ...card,
      id: `source:${index}`,
      status: index ? 'success' : 'error',
      findings: Array(30).fill('Unicode 🎸 and JSON \\"'.repeat(300)),
    }));
    const text = serializeReport(values);
    assert(Buffer.byteLength(text) <= 16 * 1024);
    const document = JSON.parse(text);
    assert.equal(document.cards.length, 4);
    assert.deepEqual(
      document.cards.map((entry) => entry.status),
      ['error', 'success', 'success', 'success'],
    );
    assert.match(text, /omitted/);
    assert.equal(values[0].findings.length, 30);
  });
  it('should emit an explicit capacity diagnostic instead of an empty or partial prefix', () => {
    for (const values of [
      [],
      Array.from({ length: 500 }, (_, index) => ({ ...card, id: `source:${index}` })),
    ]) {
      const text = serializeReport(values);
      assert(Buffer.byteLength(text) <= 16 * 1024);
      const document = JSON.parse(text);
      assert.equal(document.cards.length, 1);
      assert.equal(document.cards[0].status, 'error');
      assert.equal(document.cards[0].id, 'report-capacity');
    }
  });
  it('should redact known and encoded secrets and credential-shaped text before bounding', () => {
    const secret = 'value/with+spaces';
    const text = safeText(
      `start ${secret} ${encodeURIComponent(secret)} github_pat_private \u001b[31m\u202eevil`,
      500,
      { TOKEN: secret },
    );
    assert.doesNotMatch(text, /value|github_pat/);
    assert(!text.includes('\u001b') && !text.includes('\u202e'));
    assert.match(text, /redacted/);
    const large = safeText('prefix ' + 'a'.repeat(6000), 64, {});
    assert.match(large, /^prefix /);
    assert.match(large, /detail omitted/);
  });
});
