import assert from 'node:assert/strict';

import parseValidateSkillArgs from '../utils/parse-validate-skill-args.js';

describe('skills/skill-author/utils/parse-validate-skill-args', () => {
  it('should parse validator options', () => {
    assert.deepEqual(parseValidateSkillArgs(['--skill-dir', '/tmp/example', '--type', 'meta']), {
      skillDir: '/tmp/example',
      type: 'meta',
    });
  });

  it('should return help without parsing later arguments', () => {
    assert.deepEqual(parseValidateSkillArgs(['--help', 'ignored']), { help: true });
  });

  it('should reject unknown options, missing values, and positional arguments', () => {
    assert.throws(
      () => parseValidateSkillArgs(['--unknown-option', 'value']),
      /Unknown option: --unknown-option/,
    );
    assert.throws(() => parseValidateSkillArgs(['--skill-dir']), /Missing value/);
    assert.throws(
      () => parseValidateSkillArgs(['example']),
      /Positional arguments are not supported/,
    );
  });
});
