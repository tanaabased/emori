import assert from 'node:assert/strict';

import inferSkillCategoryTag from '../utils/infer-skill-category-tag.js';

describe('skills/skill-author/utils/infer-skill-category-tag', () => {
  it('should return the first matching category distinct from the skill type', () => {
    assert.equal(
      inferSkillCategoryTag({
        description: 'Validate skill templates.',
        displayName: 'Skill Validator',
        owner: 'emoriwan',
        slug: 'emori-skill-validator',
        type: 'generic',
      }),
      'validation',
    );
    assert.equal(
      inferSkillCategoryTag({
        description: 'Validate skill templates.',
        owner: 'emoriwan',
        type: 'validation',
      }),
      'skills',
    );
  });

  it('should return null when the skill text has no category signal', () => {
    assert.equal(
      inferSkillCategoryTag({
        description: 'Handle a narrow local surface.',
        owner: 'emoriwan',
        type: 'generic',
      }),
      null,
    );
  });
});
