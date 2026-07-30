/**
 * Normalizes a skill title so template and authored headings compare by role.
 *
 * @param {string} heading Level-one or level-two Markdown heading.
 * @returns {string} A title placeholder for level one, otherwise the original heading.
 */
export function normalizeTopLevelSkillHeading(heading) {
  if (/^#\s/.test(heading)) {
    return '# ';
  }

  return heading;
}

/**
 * Extracts level-one and level-two headings while ignoring fenced examples.
 *
 * @param {string} content Skill Markdown content.
 * @returns {string[]} Normalized headings in document order.
 */
export default function extractTopLevelSkillHeadings(content) {
  const headings = [];
  let inFence = false;

  for (const line of String(content ?? '').split('\n')) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    if (/^#{1,2}\s/.test(line)) {
      headings.push(normalizeTopLevelSkillHeading(line.trim()));
    }
  }

  return headings;
}
