import assert from 'node:assert/strict';

import normalizeSkillDescription, {
  makeDefaultPrompt,
  makeShortDescription,
} from '../utils/normalize-skill-description.js';

describe('skills/skill-author/utils/normalize-skill-description', () => {
  it('should apply one EMORI prefix and preserve empty input', () => {
    assert.equal(normalizeSkillDescription(''), '');
    assert.equal(
      normalizeSkillDescription('  EMORI-based validating local skills.  '),
      'EMORI-based validating local skills.',
    );
    assert.equal(
      normalizeSkillDescription('Emori based validating local skills.'),
      'EMORI-based validating local skills.',
    );
  });

  it('should cap short descriptions at 64 characters', () => {
    const shortDescription = makeShortDescription(
      'EMORI-based authoring an intentionally long local skill description that exceeds the limit.',
    );

    assert.equal(shortDescription.length, 64);
    assert.match(shortDescription, /^EMORI-based /);
    assert.match(shortDescription, /\.\.\.$/);
  });

  it('should create a prompt with the machine id and normalized action', () => {
    assert.equal(
      makeDefaultPrompt('emori-skill-author', 'EMORI-based Author local skills.'),
      'Use $emori-skill-author when you need to author local skills.',
    );
  });
});
