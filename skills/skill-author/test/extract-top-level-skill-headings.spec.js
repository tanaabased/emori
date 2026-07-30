import assert from 'node:assert/strict';

import extractTopLevelSkillHeadings from '../utils/extract-top-level-skill-headings.js';

describe('skills/skill-author/utils/extract-top-level-skill-headings', () => {
  it('should normalize the title and ignore nested or fenced headings', () => {
    const content = `# Example
## Overview
### Detail

\`\`\`markdown
# Example in a fence
## Overview in a fence
\`\`\`

## Workflow
`;

    assert.deepEqual(extractTopLevelSkillHeadings(content), ['# ', '## Overview', '## Workflow']);
  });
});
