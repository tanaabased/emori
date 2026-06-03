import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import codingTemplateText from '../templates/coding.md' with { type: 'text' };
import genericTemplateText from '../templates/generic.md' with { type: 'text' };
import integrationTemplateText from '../templates/integration.md' with { type: 'text' };
import metaTemplateText from '../templates/meta.md' with { type: 'text' };
import workflowTemplateText from '../templates/workflow.md' with { type: 'text' };
import bundledLargeIconImport from '../assets/icon-large.png';
import bundledSmallIconImport from '../assets/icon-small.svg';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const AUXILIARY_DOCS = [
  'README.md',
  'CHANGELOG.md',
  'INSTALLATION.md',
  'INSTALLATION_GUIDE.md',
  'QUICK_REFERENCE.md',
];
const OPTIONAL_RESOURCE_NAMES = ['templates', 'assets', 'references', 'scripts'];
const KEBAB_CASE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEBAB_CASE_HELPER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(\.[a-z0-9]+)?$/;
const RELATIONSHIP_SECTION_HEADING = '## Relationship to Other Skills';

const REQUIRED_FRONTMATTER_FIELDS = [
  { key: 'name', message: "SKILL.md frontmatter must contain 'name'." },
  { key: 'description', message: "SKILL.md frontmatter must contain 'description'." },
  { key: 'license', message: "SKILL.md frontmatter must contain 'license'." },
  { key: 'metadata', message: "SKILL.md frontmatter must contain 'metadata'." },
];
const FORBIDDEN_TOP_LEVEL_FIELDS = [
  { key: 'type', message: 'Use SKILL.md frontmatter `metadata.type`, not top-level `type`.' },
  { key: 'owner', message: 'Use SKILL.md frontmatter `metadata.owner`, not top-level `owner`.' },
  { key: 'tags', message: 'Use SKILL.md frontmatter `metadata.tags`, not top-level `tags`.' },
];
const REQUIRED_METADATA_FIELDS = [
  { key: 'type', message: "SKILL.md frontmatter metadata must contain 'type'." },
  { key: 'owner', message: "SKILL.md frontmatter metadata must contain 'owner'." },
  { key: 'tags', message: "SKILL.md frontmatter metadata must contain 'tags'." },
];
const REQUIRED_OPENAI_INTERFACE_KEYS = [
  'display_name',
  'short_description',
  'icon_small',
  'icon_large',
  'default_prompt',
  'brand_color',
];
const TEMPLATE_TEXT_IMPORTS = [
  genericTemplateText,
  codingTemplateText,
  integrationTemplateText,
  workflowTemplateText,
  metaTemplateText,
];
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

export const CANON_SKILL_OWNER = 'emoriwan';
export const CANON_SKILL_MACHINE_PREFIX = 'emori';
export const CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN = `${CANON_SKILL_MACHINE_PREFIX}-`;
export const CANON_SKILL_LICENSE = 'MIT';
export const CANON_SKILL_BRAND_COLOR = '#00c88a';
export const CANON_DESCRIPTION_PREFIX = 'EMORI-based ';
export const SKILLS_ROOT_DIR = path.resolve(MODULE_DIR, '..', '..');
const ANSI_ESCAPE_PREFIX = '\u001B[';

function supportsColor(stream = process.stdout) {
  const forceColor = process.env.FORCE_COLOR;
  if (forceColor !== undefined) {
    return !['0', 'false'].includes(forceColor.toLowerCase());
  }

  if (process.env.NO_COLOR !== undefined) {
    return false;
  }

  return Boolean(stream?.isTTY);
}

function applyAnsi(code, text, stream = process.stdout) {
  const value = String(text);
  if (!supportsColor(stream)) {
    return value;
  }

  return `${ANSI_ESCAPE_PREFIX}${code}m${value}${ANSI_ESCAPE_PREFIX}0m`;
}

function applyRgb(hex, text, stream = process.stdout) {
  const value = String(text);
  if (!supportsColor(stream)) {
    return value;
  }

  const normalized = hex.replace(/^#/, '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `${ANSI_ESCAPE_PREFIX}38;2;${red};${green};${blue}m${value}${ANSI_ESCAPE_PREFIX}0m`;
}

export function bold(text, stream = process.stdout) {
  return applyAnsi('1', text, stream);
}

export function dim(text, stream = process.stdout) {
  return applyAnsi('2', text, stream);
}

export function tp(text, stream = process.stdout) {
  return applyRgb(CANON_SKILL_BRAND_COLOR, text, stream);
}

export function renderCliHelp({ usage, summary, options, environmentVariables = [] }) {
  const lines = [usage];

  if (summary) {
    lines.push('', summary);
  }

  if (options.length > 0) {
    lines.push('', `${tp('Options')}:`, ...options);
  }

  if (environmentVariables.length > 0) {
    lines.push('', `${tp('Environment Variables')}:`, ...environmentVariables);
  }

  return lines.join('\n');
}

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

export function parseFrontmatter(content) {
  const match = String(content ?? '').match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return null;
  }

  return parseYamlBlock(match[1]);
}

function splitLeadingFrontmatter(content) {
  const match = String(content ?? '').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Template is missing leading template frontmatter.');
  }

  return {
    body: match[2],
    frontmatter: parseYamlBlock(match[1]),
  };
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

function parseInterfaceYaml(content) {
  return parseIndentedKeyValues(content, 'interface');
}

function parsePolicyYaml(content) {
  return parseIndentedKeyValues(content, 'policy');
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

function hasDependenciesToolsSection(content) {
  return /^\s{2}tools:\s*$/m.test(String(content ?? ''));
}

function normalizeSectionHeading(heading) {
  if (/^#\s/.test(heading)) {
    return '# ';
  }

  return heading;
}

function extractTopLevelHeadings(content) {
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
      headings.push(normalizeSectionHeading(line.trim()));
    }
  }

  return headings;
}

function buildTemplateDefinition(templateContent) {
  const { body, frontmatter } = splitLeadingFrontmatter(templateContent);
  const templateType = normalizeLowercaseString(frontmatter?.template_type);
  const defaultCategoryTag = normalizeLowercaseString(frontmatter?.default_category_tag);
  const optionalTopLevelHeadings = Array.isArray(frontmatter?.optional_top_level_headings)
    ? frontmatter.optional_top_level_headings.map((heading) =>
        normalizeSectionHeading(String(heading).trim()),
      )
    : [];

  if (!templateType || !defaultCategoryTag) {
    throw new Error('Template metadata must include template_type and default_category_tag.');
  }

  return {
    defaultCategoryTag,
    id: templateType,
    optionalTopLevelHeadings,
    sectionOrder: extractTopLevelHeadings(body),
    templateBody: body,
  };
}

export const SKILL_TEMPLATES = Object.freeze(
  Object.fromEntries(
    TEMPLATE_TEXT_IMPORTS.map((templateContent) => {
      const definition = buildTemplateDefinition(templateContent);
      return [definition.id, definition];
    }),
  ),
);

export const SKILL_TYPE_IDS = Object.keys(SKILL_TEMPLATES);

export function getSkillType(type) {
  return (
    SKILL_TEMPLATES[
      String(type ?? '')
        .trim()
        .toLowerCase()
    ] ?? null
  );
}

export function isKnownSkillType(type) {
  return getSkillType(type) !== null;
}

export function formatSkillTypeIds() {
  return SKILL_TYPE_IDS.join(', ');
}

export function isKebabCaseId(value) {
  return KEBAB_CASE_ID_PATTERN.test(String(value ?? '').trim());
}

function resolveImportedAssetPath(importedAssetPath) {
  if (path.isAbsolute(importedAssetPath)) {
    return importedAssetPath;
  }

  return path.resolve(MODULE_DIR, importedAssetPath);
}

export function getBundledSmallIconPath() {
  return resolveImportedAssetPath(bundledSmallIconImport);
}

export function getBundledLargeIconPath() {
  return resolveImportedAssetPath(bundledLargeIconImport);
}

export function normalizeSkillDescription(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return '';
  }

  const withoutPrefix = trimmed.replace(/^emori(?:[- ]?based)\s+/i, '');
  return `${CANON_DESCRIPTION_PREFIX}${withoutPrefix}`;
}

export function makeShortDescription(description) {
  const cleaned = normalizeSkillDescription(description).replace(/\.$/, '');
  if (cleaned.length <= 64) {
    return cleaned;
  }

  const remainder = cleaned.slice(CANON_DESCRIPTION_PREFIX.length);
  const maxRemainderLength = 64 - CANON_DESCRIPTION_PREFIX.length - 3;
  return `${CANON_DESCRIPTION_PREFIX}${remainder.slice(0, maxRemainderLength).trimEnd()}...`;
}

export function makeDefaultPrompt(skillId, description) {
  const cleaned = String(description ?? '')
    .trim()
    .replace(/^emori(?:[- ]?based)\s+/i, '')
    .replace(/\.$/, '');
  const normalized = cleaned ? `${cleaned[0].toLowerCase()}${cleaned.slice(1)}` : cleaned;
  return `Use $${skillId} when you need to ${normalized}.`;
}

export function stripSkillPrefix(value) {
  const normalized = String(value ?? '').trim();
  if (normalized.startsWith(CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN)) {
    return normalized.slice(CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN.length);
  }

  return normalized;
}

export function renderTemplate(template, replacements) {
  return String(template ?? '').replaceAll(
    /\{\{([a-z_]+)\}\}/g,
    (match, key) => replacements[key] ?? match,
  );
}

export function renderMetadataTagsYaml(tags) {
  return tags.map((tag) => `    - ${tag}`).join('\n');
}

export function inferCategoryTag({ description = '', displayName = '', slug = '', type = '' }) {
  const haystack = `${displayName} ${description} ${slug}`.toLowerCase();

  for (const [tag, pattern] of CATEGORY_INFERENCE_RULES) {
    if (
      pattern.test(haystack) &&
      tag !== CANON_SKILL_OWNER &&
      tag !== String(type).trim().toLowerCase()
    ) {
      return tag;
    }
  }

  return null;
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function hasOrderedSections(content, orderedHeadings, optionalHeadings = []) {
  const headings = extractTopLevelHeadings(content);
  const optionalSet = new Set(optionalHeadings);

  let actualIndex = 0;
  let expectedIndex = 0;

  while (expectedIndex < orderedHeadings.length && actualIndex < headings.length) {
    const expectedHeading = orderedHeadings[expectedIndex];
    const actualHeading = headings[actualIndex];

    if (expectedHeading === actualHeading) {
      expectedIndex += 1;
      actualIndex += 1;
      continue;
    }

    if (optionalSet.has(expectedHeading)) {
      expectedIndex += 1;
      continue;
    }

    return false;
  }

  while (
    expectedIndex < orderedHeadings.length &&
    optionalSet.has(orderedHeadings[expectedIndex])
  ) {
    expectedIndex += 1;
  }

  return expectedIndex === orderedHeadings.length && actualIndex === headings.length;
}

function hasEmoriBasedPrefix(value) {
  return String(value ?? '')
    .trim()
    .startsWith(CANON_DESCRIPTION_PREFIX);
}

function isRelativePath(value) {
  const trimmed = String(value ?? '').trim();
  return Boolean(trimmed) && !path.isAbsolute(trimmed) && !/^[a-z]+:\/\//i.test(trimmed);
}

function extractRelativeLinks(markdown) {
  const links = [];
  const pattern = /\[[^\]]*\]\(([^)]+)\)/g;

  for (const match of String(markdown ?? '').matchAll(pattern)) {
    const rawTarget = match[1].trim();
    const target = rawTarget.split(/\s+/)[0];

    if (
      !target ||
      target.startsWith('#') ||
      target.startsWith('mailto:') ||
      target.startsWith('data:') ||
      /^[a-z]+:\/\//i.test(target)
    ) {
      continue;
    }

    links.push(target);
  }

  return links;
}

function getSkillMetadata(frontmatter) {
  if (!frontmatter || typeof frontmatter !== 'object') {
    return null;
  }

  const metadata = frontmatter.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  return metadata;
}

function pushMissingFieldErrors(source, fieldSpecs, errors) {
  for (const { key, message } of fieldSpecs) {
    if (!source?.[key]) {
      errors.push(message);
    }
  }
}

function pushForbiddenFieldErrors(source, fieldSpecs, errors) {
  if (!source || typeof source !== 'object') {
    return;
  }

  for (const { key, message } of fieldSpecs) {
    if (Object.hasOwn(source, key)) {
      errors.push(message);
    }
  }
}

function normalizeLowercaseString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  return value.trim().toLowerCase() || null;
}

function normalizeTagList(tags) {
  if (!Array.isArray(tags)) {
    return null;
  }

  return tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
}

function validateNormalizedTags({ normalizedTags, actualOwner, actualType, errors, warnings }) {
  if (!normalizedTags) {
    return;
  }

  if (normalizedTags.length === 0) {
    errors.push('SKILL.md frontmatter metadata.tags must not be empty.');
  }
  if (new Set(normalizedTags).size !== normalizedTags.length) {
    errors.push('SKILL.md frontmatter metadata.tags must not contain duplicates.');
  }

  for (const tag of normalizedTags) {
    if (!KEBAB_CASE_ID_PATTERN.test(tag)) {
      errors.push(`Skill tag must use lowercase letters, digits, and hyphens only: ${tag}`);
    }
  }

  if (actualOwner && !normalizedTags.includes(actualOwner)) {
    errors.push(`Skill tags must include the selected owner tag: ${actualOwner}`);
  }
  if (actualType && !normalizedTags.includes(actualType)) {
    errors.push(`Skill tags must include the selected type tag: ${actualType}`);
  }

  const categoryTags = normalizedTags.filter((tag) => tag !== actualOwner && tag !== actualType);
  if (categoryTags.length === 0) {
    errors.push(
      'Skill tags must include at least one additional category tag beyond owner and type.',
    );
  }

  if (normalizedTags.length > 5) {
    warnings.push('Keep skill tags short. Prefer a minimal tag set instead of a keyword dump.');
  }
}

function validateFrontmatter({ frontmatter, requestedType, errors, warnings }) {
  pushMissingFieldErrors(frontmatter, REQUIRED_FRONTMATTER_FIELDS, errors);
  pushForbiddenFieldErrors(frontmatter, FORBIDDEN_TOP_LEVEL_FIELDS, errors);

  const metadata = getSkillMetadata(frontmatter);
  if (!metadata) {
    errors.push("SKILL.md frontmatter 'metadata' must be a mapping.");
  } else {
    pushMissingFieldErrors(metadata, REQUIRED_METADATA_FIELDS, errors);
  }

  const rawDeclaredType = metadata?.type;
  const rawDeclaredOwner = metadata?.owner;
  const declaredTags = metadata?.tags;
  const declaredType = normalizeLowercaseString(rawDeclaredType);
  const declaredOwner = normalizeLowercaseString(rawDeclaredOwner);
  const actualType = declaredType ?? requestedType ?? 'generic';
  const actualOwner = declaredOwner ?? CANON_SKILL_OWNER;

  if (rawDeclaredType && typeof rawDeclaredType !== 'string') {
    errors.push('SKILL.md frontmatter metadata.type must be a string.');
  }
  if (rawDeclaredOwner && typeof rawDeclaredOwner !== 'string') {
    errors.push('SKILL.md frontmatter metadata.owner must be a string.');
  }

  if (requestedType && declaredType && declaredType !== requestedType) {
    errors.push(
      `SKILL.md metadata.type must match the requested type: expected \`${requestedType}\`.`,
    );
  }
  if (declaredOwner && declaredOwner !== CANON_SKILL_OWNER) {
    errors.push(`SKILL.md metadata.owner must be \`${CANON_SKILL_OWNER}\`.`);
  }
  if (declaredType && !isKnownSkillType(declaredType)) {
    errors.push(`SKILL.md metadata.type must be one of: ${formatSkillTypeIds()}`);
  }
  if (frontmatter.description && !hasEmoriBasedPrefix(frontmatter.description)) {
    errors.push(`Frontmatter description must start with \`${CANON_DESCRIPTION_PREFIX.trim()}\`.`);
  }
  if (frontmatter.license && frontmatter.license !== CANON_SKILL_LICENSE) {
    errors.push(`Frontmatter license must equal \`${CANON_SKILL_LICENSE}\`.`);
  }
  if (frontmatter.name && !KEBAB_CASE_ID_PATTERN.test(frontmatter.name)) {
    errors.push('Frontmatter name must use lowercase letters, digits, and single hyphens only.');
  }
  if (frontmatter.name && !frontmatter.name.startsWith(CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN)) {
    errors.push(`Frontmatter name must start with \`${CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN}\`.`);
  }

  if (declaredTags && !Array.isArray(declaredTags)) {
    errors.push('SKILL.md frontmatter metadata.tags must be a list of strings.');
  }

  validateNormalizedTags({
    actualOwner,
    actualType,
    errors,
    normalizedTags: normalizeTagList(declaredTags),
    warnings,
  });

  return { actualOwner, actualType };
}

async function validateSkillMarkdown({ actualType, errors, skillContent, skillPath, warnings }) {
  const typeDefinition = getSkillType(actualType);
  if (
    typeDefinition &&
    !hasOrderedSections(
      skillContent,
      typeDefinition.sectionOrder,
      typeDefinition.optionalTopLevelHeadings,
    )
  ) {
    errors.push(
      `\`${actualType}\` skills must use the section order defined by the canonical ${actualType} template owned by emori-skill-author.`,
    );
  }

  for (const relativeTarget of extractRelativeLinks(skillContent)) {
    const [targetPath] = relativeTarget.split('#', 1);
    const resolvedTarget = path.resolve(skillPath, targetPath);
    if (!(await pathExists(resolvedTarget))) {
      errors.push(`Broken relative link in SKILL.md: ${relativeTarget}`);
    }
  }

  if (skillContent.includes(RELATIONSHIP_SECTION_HEADING)) {
    warnings.push(
      'Avoid `## Relationship to Other Skills` unless the scope has already been challenged.',
    );
  }
}

async function findContainingPluginRoot(startPath) {
  let currentPath = path.resolve(startPath);
  let previousPath = null;

  while (currentPath && currentPath !== previousPath) {
    if (await pathExists(path.join(currentPath, '.codex-plugin', 'plugin.json'))) {
      return currentPath;
    }

    previousPath = currentPath;
    currentPath = path.dirname(currentPath);
  }

  return null;
}

async function validateFolderName({ folderName, frontmatterName, skillPath, errors }) {
  const pluginRoot = await findContainingPluginRoot(skillPath);

  if (!pluginRoot && !folderName.startsWith(CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN)) {
    errors.push(
      `Skill folder must use the machine prefix \`${CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN}\`.`,
    );
  }

  if (
    folderName.startsWith(
      `${CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN}${CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN}`,
    )
  ) {
    errors.push(`Skill folder repeats the machine prefix: ${folderName}`);
  }
  if (
    frontmatterName &&
    frontmatterName.startsWith(
      `${CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN}${CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN}`,
    )
  ) {
    errors.push(`Frontmatter name repeats the machine prefix: ${frontmatterName}`);
  }

  if (frontmatterName) {
    const expectedFolderNames = pluginRoot
      ? [frontmatterName, stripSkillPrefix(frontmatterName)]
      : [frontmatterName];
    if (!expectedFolderNames.includes(folderName)) {
      errors.push(
        `Skill folder name must match an expected folder id: expected one of ${expectedFolderNames.map((name) => `\`${name}\``).join(', ')}.`,
      );
    }
  }
}

async function validateOpenAiMetadata({
  actualOwner,
  errors,
  frontmatterName,
  openAiContent,
  skillPath,
  warnings,
}) {
  const interfaceValues = parseInterfaceYaml(openAiContent);
  const policyValues = parsePolicyYaml(openAiContent);

  for (const key of REQUIRED_OPENAI_INTERFACE_KEYS) {
    if (!interfaceValues[key]) {
      errors.push(`agents/openai.yaml is missing interface.${key}.`);
    }
  }

  if (interfaceValues.default_prompt && frontmatterName) {
    if (!interfaceValues.default_prompt.includes(`$${frontmatterName}`)) {
      errors.push('interface.default_prompt must explicitly mention the skill by `$<machine-id>`.');
    }
  }

  if (interfaceValues.brand_color && interfaceValues.brand_color !== CANON_SKILL_BRAND_COLOR) {
    errors.push(`interface.brand_color must equal \`${CANON_SKILL_BRAND_COLOR}\`.`);
  }

  for (const key of ['icon_small', 'icon_large']) {
    const iconPath = interfaceValues[key];
    if (!iconPath) {
      continue;
    }

    if (!isRelativePath(iconPath)) {
      errors.push(`interface.${key} must be a relative skill path.`);
      continue;
    }

    const resolvedIconPath = path.resolve(skillPath, iconPath);
    if (!(await pathExists(resolvedIconPath))) {
      errors.push(`interface.${key} points to a missing file: ${iconPath}`);
    }
  }

  if (actualOwner && interfaceValues.display_name) {
    const ownerLabel = `${actualOwner[0].toUpperCase()}${actualOwner.slice(1)} `;
    if (interfaceValues.display_name.startsWith(ownerLabel)) {
      warnings.push(
        'display_name is owner-prefixed. Keep display_name unprefixed unless explicitly requested.',
      );
    }
  }

  if (
    interfaceValues.short_description &&
    !hasEmoriBasedPrefix(interfaceValues.short_description)
  ) {
    errors.push(
      `interface.short_description must start with \`${CANON_DESCRIPTION_PREFIX.trim()}\`.`,
    );
  }

  if (
    policyValues.allow_implicit_invocation &&
    !['true', 'false'].includes(policyValues.allow_implicit_invocation)
  ) {
    errors.push('policy.allow_implicit_invocation must be `true` or `false` when present.');
  }

  if (hasDependenciesToolsSection(openAiContent)) {
    const dependencyTools = parseDependencyTools(openAiContent);
    if (dependencyTools.length === 0) {
      errors.push('dependencies.tools must contain at least one tool entry when present.');
    }

    for (const [index, tool] of dependencyTools.entries()) {
      if (!tool.type) {
        errors.push(`dependencies.tools[${index}] is missing type.`);
      }
      if (!tool.value) {
        errors.push(`dependencies.tools[${index}] is missing value.`);
      }
    }
  }
}

async function validateOptionalResources(skillPath, warnings) {
  for (const docName of AUXILIARY_DOCS) {
    if (await pathExists(path.join(skillPath, docName))) {
      warnings.push(`Auxiliary repo-style doc present inside the skill: ${docName}`);
    }
  }

  for (const resourceName of OPTIONAL_RESOURCE_NAMES) {
    const resourcePath = path.join(skillPath, resourceName);
    if (!(await pathExists(resourcePath))) {
      continue;
    }

    const entries = await readdir(resourcePath);
    if (entries.length === 0) {
      warnings.push(`Empty optional resource directory: ${resourceName}/`);
    }

    if (resourceName === 'scripts') {
      continue;
    }

    for (const entry of entries) {
      if (!KEBAB_CASE_HELPER_PATTERN.test(entry) && !entry.includes('.')) {
        warnings.push(
          `Repo-authored helper name should prefer kebab-case: ${resourceName}/${entry}`,
        );
      }
    }
  }
}

function buildManualChecks({ expectedType }) {
  const checks = [
    'Check that the description clearly says what the skill does and when to use it.',
    'Check that the skill owns one narrow, concrete surface.',
    'Check that bundled resources stay local unless they clearly pass the hoist test for repo-root canon.',
    'Check that any repo-root resources referenced by the skill still earn hoisted status through proven reuse, repo-wide contract status, or standalone human value.',
    'Check that bulk standardization preserved the skill purpose unless a behavioral rewrite was requested.',
  ];

  if (expectedType) {
    checks.unshift(`Check that the selected type \`${expectedType}\` is still the smallest fit.`);
  }

  if (expectedType === 'coding') {
    checks.push(
      'Check that broad discovery language, if present, still funnels toward one dominant implementation pattern.',
      'Check that `Documentation` describes the canonical docs surface for the owned code path.',
      'Check that `Testing` describes one canonical direct-test mechanism with one minimal example.',
      'Check that `GitHub Actions Workflow` describes one canonical GHA validation mechanism with one minimal example.',
      'Check whether multiple materially different documentation, testing, or GitHub Actions mechanisms mean the skill should split.',
    );
  }

  return checks;
}

function formatList(title, items) {
  if (items.length === 0) {
    return `${title}: none`;
  }

  return `${title}:\n${items.map((item) => `- ${item}`).join('\n')}`;
}

export function formatValidationReport(result) {
  return [
    `skill: ${result.skillDir}`,
    `status: ${result.errors.length === 0 ? 'ok' : 'failed'}`,
    formatList('errors', result.errors),
    formatList('warnings', result.warnings),
    formatList('manual_checks', result.manualChecks),
  ].join('\n');
}

export async function validateSkillDir(skillDir, options = {}) {
  const requestedType = normalizeLowercaseString(options.expectedType);
  const skillPath = path.resolve(skillDir);
  const folderName = path.basename(skillPath);
  const errors = [];
  const warnings = [];
  let actualType = requestedType ?? 'generic';
  let actualOwner = CANON_SKILL_OWNER;

  if (requestedType && !isKnownSkillType(requestedType)) {
    errors.push(`Requested type must be one of: ${formatSkillTypeIds()}`);
  }

  const skillMdPath = path.join(skillPath, 'SKILL.md');
  const openAiYamlPath = path.join(skillPath, 'agents', 'openai.yaml');
  const [skillMdExists, openAiYamlExists] = await Promise.all([
    pathExists(skillMdPath),
    pathExists(openAiYamlPath),
  ]);

  if (!skillMdExists) {
    errors.push('Missing SKILL.md.');
  }
  if (!openAiYamlExists) {
    errors.push('Missing agents/openai.yaml.');
  }

  let frontmatter = null;
  if (skillMdExists) {
    const skillContent = await readFile(skillMdPath, 'utf8');
    if (!skillContent.startsWith('---\n')) {
      errors.push('SKILL.md must start with YAML frontmatter.');
    }

    frontmatter = parseFrontmatter(skillContent);
    if (!frontmatter) {
      errors.push('SKILL.md frontmatter is missing or malformed.');
    } else {
      ({ actualOwner, actualType } = validateFrontmatter({
        errors,
        frontmatter,
        requestedType,
        warnings,
      }));
    }

    await validateSkillMarkdown({
      actualType,
      errors,
      skillContent,
      skillPath,
      warnings,
    });
  }

  await validateFolderName({
    errors,
    folderName,
    frontmatterName: frontmatter?.name,
    skillPath,
  });

  if (openAiYamlExists) {
    const openAiContent = await readFile(openAiYamlPath, 'utf8');
    await validateOpenAiMetadata({
      actualOwner,
      errors,
      frontmatterName: frontmatter?.name,
      openAiContent,
      skillPath,
      warnings,
    });
  }

  await validateOptionalResources(skillPath, warnings);

  return {
    errors,
    manualChecks: buildManualChecks({ expectedType: actualType }),
    skillDir: skillPath,
    warnings,
  };
}
