import assert from 'node:assert/strict';

import parseSkillFrontmatter, {
  splitLeadingSkillFrontmatter,
} from '../utils/parse-skill-frontmatter.js';

describe('skills/skill-author/utils/parse-skill-frontmatter', () => {
  const content = `---
name: emori-example
metadata:
  type: generic
  tags: [emoriwan, generic, example]
  openclaw:
    emoji: '🧩'
    homepage: https://example.com/skill
    requires:
      bins:
        - bun
        - node
---
# Example
`;

  it('should parse nested metadata, lists, and the remaining body', () => {
    assert.deepEqual(parseSkillFrontmatter(content), {
      metadata: {
        openclaw: {
          emoji: '🧩',
          homepage: 'https://example.com/skill',
          requires: { bins: ['bun', 'node'] },
        },
        tags: ['emoriwan', 'generic', 'example'],
        type: 'generic',
      },
      name: 'emori-example',
    });
    assert.equal(splitLeadingSkillFrontmatter(content).body, '# Example\n');
  });

  it('should distinguish absent skill frontmatter from a malformed template', () => {
    assert.equal(parseSkillFrontmatter('# Example\n'), null);
    assert.throws(
      () => splitLeadingSkillFrontmatter('# Example\n'),
      /Template is missing leading template frontmatter/,
    );
  });
});
