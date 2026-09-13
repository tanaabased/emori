import parseYamlMapping from './parse-yaml-mapping.js';

function isMapping(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Parses OpenAI metadata without coercing YAML values; invalid shapes throw. */
export default function parseOpenAiSkillMetadata(content) {
  const metadata = parseYamlMapping(content);
  for (const key of ['interface', 'policy', 'dependencies']) {
    if (Object.hasOwn(metadata, key) && !isMapping(metadata[key])) {
      throw new Error(`${key} must be a mapping.`);
    }
  }
  const hasDependencyToolsSection = Object.hasOwn(metadata.dependencies ?? {}, 'tools');
  const dependencyTools = hasDependencyToolsSection ? metadata.dependencies.tools : [];
  if (!Array.isArray(dependencyTools) || dependencyTools.some((tool) => !isMapping(tool))) {
    throw new Error('dependencies.tools must be a list of mappings.');
  }
  return {
    dependencyTools,
    hasDependencyToolsSection,
    interfaceValues: metadata.interface ?? {},
    policyValues: metadata.policy ?? {},
  };
}
