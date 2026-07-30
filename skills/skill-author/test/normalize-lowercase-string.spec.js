import assert from 'node:assert/strict';

import normalizeLowercaseString from '../utils/normalize-lowercase-string.js';

describe('skills/skill-author/utils/normalize-lowercase-string', () => {
  it('should normalize strings and reject empty or non-string values', () => {
    assert.equal(normalizeLowercaseString('  Meta  '), 'meta');
    assert.equal(normalizeLowercaseString('   '), null);
    assert.equal(normalizeLowercaseString(42), null);
  });
});
