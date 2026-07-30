import assert from 'node:assert/strict';

import parseInitSkillArgs from '../utils/parse-init-skill-args.js';

describe('skills/skill-author/utils/parse-init-skill-args', () => {
  it('should apply defaults and parse initializer options', () => {
    assert.deepEqual(
      parseInitSkillArgs(
        ['--type', 'coding', '--output-dir', '/tmp/skills', '--emoji', '🧪', '--force'],
        '/default/skills',
      ),
      {
        emoji: '🧪',
        force: true,
        outputDir: '/tmp/skills',
        type: 'coding',
      },
    );
  });

  it('should return help without parsing later arguments', () => {
    assert.deepEqual(parseInitSkillArgs(['--help', 'ignored'], '/default/skills'), {
      help: true,
      outputDir: '/default/skills',
      type: 'generic',
    });
  });

  it('should reject missing option values and positional arguments', () => {
    assert.throws(() => parseInitSkillArgs(['--slug'], '/default/skills'), /Missing value/);
    assert.throws(
      () => parseInitSkillArgs(['example'], '/default/skills'),
      /Positional arguments are not supported/,
    );
  });
});
