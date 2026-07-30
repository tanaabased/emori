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

function parseIndentedKeyValues(content, sectionName) {
  const lines = String(content ?? '').split('\n');
  const values = {};
  let inSection = false;

  for (const line of lines) {
    if (!inSection) {
      if (line.trim() === `${sectionName}:`) {
        inSection = true;
      }
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    if (!line.startsWith('  ')) {
      break;
    }

    const match = line.match(/^\s{2}([a-z_]+):\s*(.+)$/);
    if (!match) {
      continue;
    }

    values[match[1]] = unquoteYaml(match[2]);
  }

  return values;
}

function parseDependencyTools(content) {
  const lines = String(content ?? '').split('\n');
  const tools = [];
  let inDependencies = false;
  let inTools = false;
  let currentTool = null;

  for (const line of lines) {
    if (!inDependencies) {
      if (line.trim() === 'dependencies:') {
        inDependencies = true;
      }
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    if (!line.startsWith('  ')) {
      break;
    }

    if (!inTools) {
      if (line.trim() === 'tools:') {
        inTools = true;
      }
      continue;
    }

    if (!line.startsWith('    ')) {
      break;
    }

    const firstEntryMatch = line.match(/^ {4}-\s+([a-z_]+):\s*(.+)$/);
    if (firstEntryMatch) {
      currentTool = {
        [firstEntryMatch[1]]: unquoteYaml(firstEntryMatch[2]),
      };
      tools.push(currentTool);
      continue;
    }

    const entryMatch = line.match(/^ {6}([a-z_]+):\s*(.+)$/);
    if (entryMatch && currentTool) {
      currentTool[entryMatch[1]] = unquoteYaml(entryMatch[2]);
    }
  }

  return tools;
}

/**
 * Parses the agents/openai.yaml values used by local skill validation.
 *
 * @param {string} content agents/openai.yaml content.
 * @returns {{dependencyTools: object[], hasDependencyToolsSection: boolean, interfaceValues: object, policyValues: object}} Validation inputs.
 */
export default function parseOpenAiSkillMetadata(content) {
  const normalizedContent = String(content ?? '');

  return {
    dependencyTools: parseDependencyTools(normalizedContent),
    hasDependencyToolsSection: /^\s{2}tools:\s*$/m.test(normalizedContent),
    interfaceValues: parseIndentedKeyValues(normalizedContent, 'interface'),
    policyValues: parseIndentedKeyValues(normalizedContent, 'policy'),
  };
}
