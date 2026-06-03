import assert from 'node:assert/strict';

import { deepMerge } from '../utils/deep-merge.js';

describe('utils/deep-merge', () => {
  it('should merge nested objects with local values winning', () => {
    assert.deepEqual(
      deepMerge(
        {
          features: {
            memories: true,
            multi_agent: true,
          },
          model: 'gpt-5.5',
        },
        {
          features: {
            multi_agent: false,
          },
          model: 'gpt-5.4',
        },
      ),
      {
        features: {
          memories: true,
          multi_agent: false,
        },
        model: 'gpt-5.4',
      },
    );
  });

  it('should replace arrays instead of merging them by index', () => {
    assert.deepEqual(deepMerge({ approvals: ['read', 'write'] }, { approvals: ['read'] }), {
      approvals: ['read'],
    });
  });
});
