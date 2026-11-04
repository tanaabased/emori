import assert from 'node:assert/strict';

import selectSources from '../utils/select-sources.js';

describe('lib/update-shared-sources/utils/select-sources', () => {
  it('should select every configured local source', () => {
    const local = {
      canon: '~/canon',
      emori: '/private/agent',
      smutlord: '/private/other',
      extra: '/extra',
    };
    assert.deepEqual(selectSources(local), [
      { id: 'canon', path: '~/canon', status: 'candidate' },
      { id: 'emori', path: '/private/agent', status: 'candidate' },
      { id: 'smutlord', path: '/private/other', status: 'candidate' },
      { id: 'extra', path: '/extra', status: 'candidate' },
    ]);
    assert.equal(local.emori, '/private/agent');
  });

  it('should account for unusable configured entries without inventing absent sources', () => {
    assert.deepEqual(selectSources({ canon: ' ', extra: false }), [
      { id: 'canon', status: 'missing' },
      { id: 'extra', status: 'missing' },
    ]);
    assert.deepEqual(selectSources(), []);
  });
});
