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

  it('should retain fields after comments and decode multiline descriptions', () => {
    const text =
      '---\r\nname: emori-example\r\n# comment\r\nlicense: MIT\r\ndescription: >-\r\n  EMORI-based help:\r\n  keeps # punctuation.\r\n---\r\n# Example\r\n';
    assert.deepEqual(parseSkillFrontmatter(text), {
      name: 'emori-example',
      license: 'MIT',
      description: 'EMORI-based help: keeps # punctuation.',
    });
  });

  it('should reject invalid YAML instead of returning partially parsed metadata', () => {
    assert.throws(
      () => parseSkillFrontmatter('---\nname: emori-example\ndescription: bad: value\n---\n'),
      SyntaxError,
    );
    assert.throws(() => splitLeadingSkillFrontmatter('---\n- sequence\n---\n'), /mapping/);
  });
});
