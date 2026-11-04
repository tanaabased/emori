import assert from 'node:assert/strict';

import selectSources from '../utils/select-sources.js';

describe('lib/update-shared-sources/utils/select-sources', () => {
  it('should select approved sources and omit all other inventory entries', () => {
    const local = {
      canon: '~/canon',
      emori: '/private/agent',
      smutlord: '/private/other',
      extra: '/extra',
    };
    assert.deepEqual(selectSources(local), [
      { id: 'canon', path: '~/canon', status: 'candidate' },
      { id: 'openclaw-agent-system', status: 'missing' },
    ]);
    assert.equal(local.emori, '/private/agent');
  });

  it('should account for absent and unusable approved entries', () => {
    assert.deepEqual(selectSources({ canon: ' ', 'openclaw-agent-system': false }), [
      { id: 'canon', status: 'missing' },
      { id: 'openclaw-agent-system', status: 'missing' },
    ]);
    assert.equal(selectSources().length, 2);
  });
});
