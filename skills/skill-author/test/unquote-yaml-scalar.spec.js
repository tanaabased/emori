import assert from 'node:assert/strict';

import unquoteYamlScalar from '../utils/unquote-yaml-scalar.js';

describe('skills/skill-author/utils/unquote-yaml-scalar', () => {
  it('should remove matching scalar quotes and preserve unquoted values', () => {
    assert.equal(unquoteYamlScalar(' "example" '), 'example');
    assert.equal(unquoteYamlScalar("'example'"), 'example');
    assert.equal(unquoteYamlScalar('example'), 'example');
    assert.equal(unquoteYamlScalar('"example\''), '"example\'');
  });
});
