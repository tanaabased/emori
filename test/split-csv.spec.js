import assert from 'node:assert/strict';

import { splitCsv } from '../utils/split-csv.js';

describe('utils/split-csv', () => {
  it('should split CSV text into trimmed non-empty values', () => {
    assert.deepEqual(splitCsv('alpha, beta,, gamma , '), ['alpha', 'beta', 'gamma']);
    assert.deepEqual(splitCsv(''), []);
    assert.deepEqual(splitCsv(undefined), []);
  });
});
