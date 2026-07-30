/**
 * Replaces lowercase skill-template tokens while preserving unknown tokens.
 *
 * @param {string} template Local skill template content.
 * @param {object} replacements Token values keyed by placeholder name.
 * @returns {string} Rendered content.
 */
export default function renderSkillTemplate(template, replacements) {
  return String(template ?? '').replaceAll(
    /\{\{([a-z_]+)\}\}/g,
    (match, key) => replacements[key] ?? match,
  );
}
