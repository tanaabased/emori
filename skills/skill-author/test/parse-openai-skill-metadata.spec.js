import assert from 'node:assert/strict';

import parseOpenAiSkillMetadata from '../utils/parse-openai-skill-metadata.js';

describe('skills/skill-author/utils/parse-openai-skill-metadata', () => {
  it('should parse interface, policy, and dependency tool values', () => {
    const content = `interface:
  display_name: "Example"
  brand_color: '#00c88a'
policy:
  allow_implicit_invocation: false
dependencies:
  tools:
    - type: "mcp"
      value: github`;

    assert.deepEqual(parseOpenAiSkillMetadata(content), {
      dependencyTools: [{ type: 'mcp', value: 'github' }],
      hasDependencyToolsSection: true,
      interfaceValues: { brand_color: '#00c88a', display_name: 'Example' },
      policyValues: { allow_implicit_invocation: false },
    });
  });

  it('should report an omitted dependency tool section without inventing entries', () => {
    assert.deepEqual(parseOpenAiSkillMetadata('interface:\n  display_name: Example\n'), {
      dependencyTools: [],
      hasDependencyToolsSection: false,
      interfaceValues: { display_name: 'Example' },
      policyValues: {},
    });
  });

  it('should decode quoted strings and preserve typed policy values', () => {
    const parsed = parseOpenAiSkillMetadata(String.raw`# authored metadata
interface:
  display_name: "Say \"hello\": keep # punctuation"
policy:
  allow_implicit_invocation: true
`);
    assert.equal(parsed.interfaceValues.display_name, 'Say "hello": keep # punctuation');
    assert.equal(parsed.policyValues.allow_implicit_invocation, true);
  });

  it('should reject malformed YAML and invalid section shapes', () => {
    for (const content of [
      'interface: [',
      'interface: null',
      'policy: false',
      'dependencies: []',
      'dependencies: {tools: [null]}',
      'dependencies: {tools: false}',
    ]) {
      assert.throws(() => parseOpenAiSkillMetadata(content), Error);
    }
  });
});
