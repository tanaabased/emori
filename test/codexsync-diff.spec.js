import assert from 'node:assert/strict';

import { diffEntries, diffHasChanges, previewPaths, summarizeDiff } from '../lib/codexsync-diff.js';

function fileEntry(content, mode = 0o644) {
  return {
    content: Buffer.from(content),
    mode,
    type: 'file',
  };
}

function symlinkEntry(target) {
  return {
    target,
    type: 'symlink',
  };
}

describe('lib/codexsync-diff', () => {
  it('should report no changes for matching entries', () => {
    const sourceEntries = new Map([
      ['bin', { type: 'dir' }],
      ['bin/codexsync.js', fileEntry('same')],
      ['current', symlinkEntry('target')],
    ]);
    const targetEntries = new Map([
      ['bin', { type: 'dir' }],
      ['bin/codexsync.js', fileEntry('same')],
      ['current', symlinkEntry('target')],
    ]);

    const diff = diffEntries(sourceEntries, targetEntries);

    assert.deepEqual(diff, { changed: [], extra: [], missing: [] });
    assert.equal(diffHasChanges(diff), false);
    assert.equal(summarizeDiff(diff), 'in sync');
  });

  it('should report changed file content and mode', () => {
    const sourceEntries = new Map([
      ['changed-content.js', fileEntry('new')],
      ['changed-mode.js', fileEntry('same', 0o755)],
    ]);
    const targetEntries = new Map([
      ['changed-content.js', fileEntry('old')],
      ['changed-mode.js', fileEntry('same', 0o644)],
    ]);

    const diff = diffEntries(sourceEntries, targetEntries);

    assert.deepEqual(diff.changed, ['changed-content.js', 'changed-mode.js']);
    assert.equal(diffHasChanges(diff), true);
  });

  it('should report changed symlink targets', () => {
    const diff = diffEntries(
      new Map([['current', symlinkEntry('../next')]]),
      new Map([['current', symlinkEntry('../previous')]]),
    );

    assert.deepEqual(diff.changed, ['current']);
  });

  it('should report missing and extra entries in sorted order', () => {
    const diff = diffEntries(
      new Map([
        ['a.js', fileEntry('a')],
        ['b.js', fileEntry('b')],
      ]),
      new Map([
        ['b.js', fileEntry('b')],
        ['c.js', fileEntry('c')],
      ]),
    );

    assert.deepEqual(diff.missing, ['a.js']);
    assert.deepEqual(diff.extra, ['c.js']);
    assert.equal(summarizeDiff(diff), 'missing 1, extra 1');
  });

  it('should preview long path lists with a remaining-count marker', () => {
    assert.deepEqual(previewPaths(['a', 'b', 'c', 'd', 'e', 'f', 'g']), [
      'a',
      'b',
      'c',
      'd',
      'e',
      '... 2 more',
    ]);
  });

  it('should summarize changed, missing, and extra counts in order', () => {
    assert.equal(
      summarizeDiff({
        changed: ['a', 'b'],
        extra: ['d'],
        missing: ['c'],
      }),
      'changed 2, missing 1, extra 1',
    );
  });
});
