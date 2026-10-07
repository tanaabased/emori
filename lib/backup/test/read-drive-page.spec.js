import assert from 'node:assert/strict';

import readDrivePage from '../utils/read-drive-page.js';

describe('Drive listing completeness', () => {
  it('accepts a proven empty final page', () => {
    assert.deepEqual(readDrivePage({ files: [], has_more: false, nextPageToken: '' }, new Set()), {
      files: [],
      next: '',
    });
  });
  it('preserves the next page token', () => {
    assert.equal(
      readDrivePage(
        { files: [{ id: 'one', name: 'archive' }], has_more: true, nextPageToken: 'next' },
        new Set(),
      ).next,
      'next',
    );
  });
  for (const page of [
    undefined,
    {},
    { files: [] },
    { files: [], has_more: true, nextPageToken: '' },
    { files: [], has_more: false, nextPageToken: 'next' },
    { files: [], has_more: false, nextPageToken: '', incompleteSearch: true },
    { files: [], has_more: true, nextPageToken: 'seen' },
    { files: [{}], has_more: false, nextPageToken: '' },
  ]) {
    it('rejects a missing, incomplete or cyclic page', () => {
      assert.throws(() => readDrivePage(page, new Set(['seen'])), /drive-list-incomplete/);
    });
  }
});
