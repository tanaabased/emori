import assert from 'node:assert/strict';

import parseYamlMapping from '../utils/parse-yaml-mapping.js';

describe('skills/skill-author/utils/parse-yaml-mapping', () => {
  it('should preserve YAML strings, booleans, numbers and nulls for schema validation', () => {
    assert.deepEqual(parseYamlMapping('text: "false"\nflag: false\ncount: 3\nmissing: null'), {
      text: 'false',
      flag: false,
      count: 3,
      missing: null,
    });
  });

  it('should reject empty, scalar, sequence and multiple documents', () => {
    for (const text of ['', 'null', 'false', 'word', '- item', '---\na: 1\n---\nb: 2']) {
      assert.throws(() => parseYamlMapping(text), /mapping/);
    }
  });
});
