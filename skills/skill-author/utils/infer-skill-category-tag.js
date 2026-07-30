const CATEGORY_INFERENCE_RULES = [
  ['validation', /\b(validat|verify|lint|check)\w*/],
  ['testing', /\b(test|coverage|assert|spec)\w*/],
  ['skills', /\b(skill|template|scaffold|creator|author|initializer|standardiz)\w*/],
  ['frontend', /\b(frontend|vue|react|component|css|scss|tailwind|vitepress)\w*/],
  ['design', /\b(design|brand|visual|ui|ux)\w*/],
  ['docs', /\b(doc|docs|documentation|readme|markdown|mdx|copy)\w*/],
  ['release', /\b(release|version|changelog|publish)\w*/],
  ['shell', /\b(shell|bash|zsh|cli|terminal|command[- ]line)\w*/],
  ['integration', /\b(github|gitlab|openai|api|mcp|webhook|integration)\w*/],
  ['coding', /\b(code|coding|typescript|javascript|bun|node|function|library)\w*/],
  ['research', /\b(research|investigat|audit|analysis)\w*/],
  ['automation', /\b(automate|automation|cron|scheduled|job|workflow)\w*/],
  ['meta', /\b(meta|canon|convention|prompt|template|packag|refin|standard)\w*/],
];

/**
 * Infers one category tag distinct from the skill owner and type.
 *
 * @param {object} context Local skill identity text.
 * @returns {string | null} The first matching category tag, or null.
 */
export default function inferSkillCategoryTag({
  description = '',
  displayName = '',
  owner = '',
  slug = '',
  type = '',
}) {
  const haystack = `${displayName} ${description} ${slug}`.toLowerCase();
  const normalizedOwner = String(owner).trim().toLowerCase();
  const normalizedType = String(type).trim().toLowerCase();

  for (const [tag, pattern] of CATEGORY_INFERENCE_RULES) {
    if (pattern.test(haystack) && tag !== normalizedOwner && tag !== normalizedType) {
      return tag;
    }
  }

  return null;
}
