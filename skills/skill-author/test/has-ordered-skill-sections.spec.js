import assert from 'node:assert/strict';

import hasOrderedSkillSections from '../utils/has-ordered-skill-sections.js';

describe('skills/skill-author/utils/has-ordered-skill-sections', () => {
  const orderedHeadings = ['# ', '## Overview', '## Optional', '## Workflow'];
  const optionalHeadings = ['## Optional'];

  it('should accept canonical section order with or without optional sections', () => {
    assert.equal(
      hasOrderedSkillSections(
        '# Example\n## Overview\n## Optional\n## Workflow\n',
        orderedHeadings,
        optionalHeadings,
      ),
      true,
    );
    assert.equal(
      hasOrderedSkillSections(
        '# Example\n## Overview\n## Workflow\n',
        orderedHeadings,
        optionalHeadings,
      ),
      true,
    );
  });

  it('should reject reordered or additional top-level sections', () => {
    assert.equal(
      hasOrderedSkillSections(
        '# Example\n## Workflow\n## Overview\n',
        orderedHeadings,
        optionalHeadings,
      ),
      false,
    );
    assert.equal(
      hasOrderedSkillSections(
        '# Example\n## Overview\n## Extra\n## Workflow\n',
        orderedHeadings,
        optionalHeadings,
      ),
      false,
    );
  });
});
