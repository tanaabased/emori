import parseYamlMapping from './parse-yaml-mapping.js';

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/;

/** Splits template frontmatter from its Markdown body; invalid YAML throws. */
export function splitLeadingSkillFrontmatter(content) {
  const match = String(content ?? '').match(FRONTMATTER_PATTERN);
  if (!match) {
    throw new Error('Template is missing leading template frontmatter.');
  }
  return { body: match[2], frontmatter: parseYamlMapping(match[1]) };
}

/** Parses skill frontmatter, returning null when absent; invalid YAML throws. */
export default function parseSkillFrontmatter(content) {
  const match = String(content ?? '').match(FRONTMATTER_PATTERN);
  return match ? parseYamlMapping(match[1]) : null;
}
