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
import extractTopLevelSkillHeadings, {
  normalizeTopLevelSkillHeading,
} from '../utils/extract-top-level-skill-headings.js';
import hasOrderedSkillSections from '../utils/has-ordered-skill-sections.js';
import { SKILL_DESCRIPTION_PREFIX } from '../utils/normalize-skill-description.js';
import parseOpenAiSkillMetadata from '../utils/parse-openai-skill-metadata.js';
import parseSkillFrontmatter, {
  splitLeadingSkillFrontmatter,
} from '../utils/parse-skill-frontmatter.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const AUXILIARY_DOCS = [
  'README.md',
  'CHANGELOG.md',
  'INSTALLATION.md',
  'INSTALLATION_GUIDE.md',
  'QUICK_REFERENCE.md',
];
const OPTIONAL_RESOURCE_NAMES = [
  'bin',
  'lib',
  'scripts',
  'utils',
  'test',
  'templates',
  'assets',
  'references',
];
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
  { key: 'openclaw', message: "SKILL.md frontmatter metadata must contain 'openclaw'." },
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
export const CANON_SKILL_OWNER = 'emoriwan';
export const CANON_SKILL_MACHINE_PREFIX = 'emori';
export const CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN = `${CANON_SKILL_MACHINE_PREFIX}-`;
export const CANON_SKILL_LICENSE = 'MIT';
export const CANON_SKILL_BRAND_COLOR = '#00c88a';
export const CANON_DESCRIPTION_PREFIX = SKILL_DESCRIPTION_PREFIX;
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

function buildTemplateDefinition(templateContent) {
  const { body, frontmatter } = splitLeadingSkillFrontmatter(templateContent);
  const templateType = normalizeLowercaseString(frontmatter?.template_type);
  const defaultCategoryTag = normalizeLowercaseString(frontmatter?.default_category_tag);
  const optionalTopLevelHeadings = Array.isArray(frontmatter?.optional_top_level_headings)
    ? frontmatter.optional_top_level_headings.map((heading) =>
        normalizeTopLevelSkillHeading(String(heading).trim()),
      )
    : [];

  if (!templateType || !defaultCategoryTag) {
    throw new Error('Template metadata must include template_type and default_category_tag.');
  }

  return {
    defaultCategoryTag,
    id: templateType,
    optionalTopLevelHeadings,
    sectionOrder: extractTopLevelSkillHeadings(body),
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

export function stripSkillPrefix(value) {
  const normalized = String(value ?? '').trim();
  if (normalized.startsWith(CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN)) {
    return normalized.slice(CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN.length);
  }

  return normalized;
}

export function renderMetadataTagsYaml(tags) {
  return tags.map((tag) => `    - ${tag}`).join('\n');
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
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

function validateOpenclawMetadata(metadata, errors) {
  const openclaw = metadata?.openclaw;
  if (!openclaw || typeof openclaw !== 'object' || Array.isArray(openclaw)) {
    if (openclaw) {
      errors.push('SKILL.md frontmatter metadata.openclaw must be a mapping.');
    }
    return;
  }

  if (typeof openclaw.emoji !== 'string' || !openclaw.emoji.trim()) {
    errors.push('SKILL.md frontmatter metadata.openclaw.emoji must be a nonempty string.');
  }

  if (typeof openclaw.homepage !== 'string' || !/^https:\/\//i.test(openclaw.homepage.trim())) {
    errors.push('SKILL.md frontmatter metadata.openclaw.homepage must be an HTTPS URL.');
  }

  const requires = openclaw.requires;
  if (requires !== undefined && (typeof requires !== 'object' || Array.isArray(requires))) {
    errors.push('SKILL.md frontmatter metadata.openclaw.requires must be a mapping when present.');
    return;
  }

  for (const [key, values] of Object.entries(requires ?? {})) {
    if (!Array.isArray(values) || values.some((value) => !String(value).trim())) {
      errors.push(
        `SKILL.md frontmatter metadata.openclaw.requires.${key} must be a list of nonempty strings.`,
      );
    }
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
  validateOpenclawMetadata(metadata, errors);

  return { actualOwner, actualType };
}

async function validateSkillMarkdown({ actualType, errors, skillContent, skillPath, warnings }) {
  const typeDefinition = getSkillType(actualType);
  if (
    typeDefinition &&
    !hasOrderedSkillSections(
      skillContent,
      typeDefinition.sectionOrder,
      typeDefinition.optionalTopLevelHeadings,
    )
  ) {
    errors.push(
      `\`${actualType}\` skills must use the section order defined by the local ${actualType} template owned by emori-skill-author.`,
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

async function findContainingAgentWorkspaceRoot(skillPath) {
  const skillsPath = path.dirname(path.resolve(skillPath));
  if (path.basename(skillsPath) !== 'skills') {
    return null;
  }

  const workspaceRoot = path.dirname(skillsPath);
  const [agentsExists, identityExists] = await Promise.all([
    pathExists(path.join(workspaceRoot, 'AGENTS.md')),
    pathExists(path.join(workspaceRoot, 'IDENTITY.md')),
  ]);

  return agentsExists && identityExists ? workspaceRoot : null;
}

async function validateFolderName({ folderName, frontmatterName, skillPath, errors }) {
  const [pluginRoot, workspaceRoot] = await Promise.all([
    findContainingPluginRoot(skillPath),
    findContainingAgentWorkspaceRoot(skillPath),
  ]);
  const allowsUnprefixedFolder = Boolean(pluginRoot || workspaceRoot);

  if (!allowsUnprefixedFolder && !folderName.startsWith(CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN)) {
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
    const expectedFolderNames = allowsUnprefixedFolder
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
  const { dependencyTools, hasDependencyToolsSection, interfaceValues, policyValues } =
    parseOpenAiSkillMetadata(openAiContent);

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

  if (hasDependencyToolsSection) {
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
    'Check that the skill owns an EMORI-local specialization rather than duplicating a shared Tanaab capability.',
    'Check that bundled resources stay local unless they clearly pass the hoist test for a repository-wide contract.',
    'Check that any repo-root resources referenced by the skill still earn hoisted status through proven reuse, repo-wide contract status, or standalone human value.',
    'Check that the OpenClaw emoji and homepage are specific and truthful.',
    'Check whether the persistent surface should retain and tailor `Optimization` or omit it deliberately.',
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
      'Check that `GitHub Actions` describes one canonical GHA validation mechanism with one minimal example.',
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

    frontmatter = parseSkillFrontmatter(skillContent);
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
