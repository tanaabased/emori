import assert from 'node:assert/strict';

import report from '../report.js';

const render = (rows, actions = []) =>
  report({
    id: 'update-agent',
    title: 'UPDATE AGENT',
    columns: ['Step', 'Status', 'Result'],
    rows,
    actions,
    now: new Date('2026-11-18T04:30:00Z'),
  });

describe('lib/update/report', () => {
  it('should emit one native Markdown report with a green header only when nothing remains actionable', () => {
    const result = render([
      {
        name: 'Install',
        status: 'success',
        label: 'Aligned',
        cells: ['Setup intentionally skipped.'],
      },
    ]);
    assert.equal(result.exitCode, 0);
    const document = JSON.parse(result.stdout);
    assert.equal(document.schema, 'agent-system.report');
    assert.equal(document.cards.length, 1);
    assert.equal(document.cards[0].format, 'markdown');
    const body = document.cards[0].body;
    assert.match(body, /^> ## ✅ UPDATE AGENT · RUN RESULTS/);
    assert.match(body, /November 17, 2026/);
    assert.match(body, /\| Step \| Status \| Result \|/);
    assert.match(body, /Action needed:\*\* None/);
    assert(!body.includes('⚠️'));
  });
  it('should reflect the worst unresolved row while preserving partial success and its next action', () => {
    const rows = [
      { name: 'Repository', status: 'success', label: 'Updated', cells: ['a → b'] },
      { name: 'Doctor', status: 'warning', label: 'Drift detected', cells: ['Schedule differs.'] },
    ];
    let result = render(rows, ['Apply the declared schedule.']);
    assert.notEqual(result.exitCode, 0);
    assert.match(JSON.parse(result.stdout).cards[0].body, /⚠️ UPDATE AGENT · ACTION NEEDED/);
    rows.push({ name: 'Cleanup', status: 'error', label: 'Failed', cells: ['Lock close failed.'] });
    result = render(rows, ['Inspect the maintenance process.']);
    const body = JSON.parse(result.stdout).cards[0].body;
    assert.match(body, /❌ UPDATE AGENT · RUN FAILED/);
    assert.match(body, /Repository.*✅ Updated/);
    assert.match(body, /Next action.*Inspect/);
  });
  it('should redact credential-shaped data and prevent table, quote and heading injection', () => {
    const result = render(
      [
        {
          name: 'Doctor',
          status: 'warning',
          label: 'Unverified',
          cells: ['token=secret-value\n|bad|\n> ## fake **green**'],
        },
      ],
      ['Fix token=other-secret'],
    );
    const body = JSON.parse(result.stdout).cards[0].body;
    assert(!body.includes('secret-value') && !body.includes('other-secret'));
    assert.equal(body.split('\n').filter((line) => line.startsWith('> ##')).length, 1);
    assert.match(body, /\\\|bad\\\|/);
    assert.match(body, /\\\*\\\*green\\\*\\\*/);
  });

  it('should retain an explicit reporting failure rather than emit oversized or partially serialized JSON', () => {
    const result = render(
      Array.from({ length: 100 }, () => ({
        name: 'Doctor',
        status: 'warning',
        label: 'Attention needed',
        cells: ['x'.repeat(500)],
      })),
      ['Inspect Doctor.'],
    );
    assert(Buffer.byteLength(result.stdout) <= 16 * 1024);
    assert.match(JSON.parse(result.stdout).cards[0].body, /❌.*REPORT UNAVAILABLE/);
    assert.notEqual(result.exitCode, 0);
  });
});
