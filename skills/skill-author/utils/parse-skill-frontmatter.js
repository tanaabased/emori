function unquoteYaml(value) {
  const trimmed = String(value ?? '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseYamlBlock(rawBlock) {
  const lines = String(rawBlock ?? '').split('\n');
  const indentOf = (line) => line.match(/^ */)?.[0].length ?? 0;
  const listPattern = (indent) => new RegExp(`^\\s{${indent}}-\\s+(.+)$`);
  const keyPattern = (indent) => new RegExp(`^\\s{${indent}}([a-z][a-z0-9_-]*):(.*)$`);

  function parseList(startIndex, indent) {
    const items = [];
    let index = startIndex;

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (indentOf(line) < indent) {
        break;
      }

      const matchList = line.match(listPattern(indent));
      if (!matchList) {
        break;
      }

      items.push(unquoteYaml(matchList[1]));
      index += 1;
    }

    return { value: items, nextIndex: index };
  }

  function parseMap(startIndex, indent) {
    const entries = {};
    let index = startIndex;

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (indentOf(line) < indent) {
        break;
      }

      const matchEntry = line.match(keyPattern(indent));
      if (!matchEntry) {
        break;
      }

      const [, key, rawValue] = matchEntry;
      const value = rawValue.trim();

      if (value) {
        if (value.startsWith('[') && value.endsWith(']')) {
          entries[key] = value
            .slice(1, -1)
            .split(',')
            .map((item) => unquoteYaml(item))
            .filter(Boolean);
        } else {
          entries[key] = unquoteYaml(value);
        }
        index += 1;
        continue;
      }

      const nextLine = lines[index + 1];
      if (!nextLine || !nextLine.trim() || indentOf(nextLine) <= indent) {
        entries[key] = '';
        index += 1;
        continue;
      }

      if (nextLine.match(listPattern(indent + 2))) {
        const parsedList = parseList(index + 1, indent + 2);
        entries[key] = parsedList.value;
        index = parsedList.nextIndex;
        continue;
      }

      if (nextLine.match(keyPattern(indent + 2))) {
        const parsedMap = parseMap(index + 1, indent + 2);
        entries[key] = parsedMap.value;
        index = parsedMap.nextIndex;
        continue;
      }

      entries[key] = '';
      index += 1;
    }

    return { value: entries, nextIndex: index };
  }

  return parseMap(0, 0).value;
}

/**
 * Splits the constrained frontmatter from a local skill template.
 *
 * @param {string} content Template content with leading frontmatter.
 * @returns {{body: string, frontmatter: object}} Parsed template inputs.
 * @throws {Error} When the template has no leading frontmatter.
 */
export function splitLeadingSkillFrontmatter(content) {
  const match = String(content ?? '').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Template is missing leading template frontmatter.');
  }

  return {
    body: match[2],
    frontmatter: parseYamlBlock(match[1]),
  };
}

/**
 * Parses the constrained YAML frontmatter used by EMORI-local skills.
 *
 * @param {string} content SKILL.md content.
 * @returns {object | null} Parsed frontmatter or null when absent.
 */
export default function parseSkillFrontmatter(content) {
  const match = String(content ?? '').match(/^---\n([\s\S]*?)\n---/);
  return match ? parseYamlBlock(match[1]) : null;
}
