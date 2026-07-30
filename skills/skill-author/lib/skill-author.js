import path from 'node:path';
import { fileURLToPath } from 'node:url';

import bundledLargeIconImport from '../assets/icon-large.png';
import bundledSmallIconImport from '../assets/icon-small.svg';
import codingTemplateText from '../templates/coding.md' with { type: 'text' };
import extractTopLevelSkillHeadings, {
  normalizeTopLevelSkillHeading,
} from '../utils/extract-top-level-skill-headings.js';
import genericTemplateText from '../templates/generic.md' with { type: 'text' };
import integrationTemplateText from '../templates/integration.md' with { type: 'text' };
import metaTemplateText from '../templates/meta.md' with { type: 'text' };
import normalizeLowercaseString from '../utils/normalize-lowercase-string.js';
import { SKILL_DESCRIPTION_PREFIX } from '../utils/normalize-skill-description.js';
import { splitLeadingSkillFrontmatter } from '../utils/parse-skill-frontmatter.js';
import workflowTemplateText from '../templates/workflow.md' with { type: 'text' };

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const KEBAB_CASE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TEMPLATE_TEXT_IMPORTS = [
  genericTemplateText,
  codingTemplateText,
  integrationTemplateText,
  workflowTemplateText,
  metaTemplateText,
];
const ANSI_ESCAPE_PREFIX = '\u001B[';

export const EMORI_SKILL_OWNER = 'emoriwan';
export const EMORI_SKILL_MACHINE_PREFIX = 'emori';
export const EMORI_SKILL_MACHINE_PREFIX_WITH_HYPHEN = `${EMORI_SKILL_MACHINE_PREFIX}-`;
export const EMORI_SKILL_LICENSE = 'MIT';
export const EMORI_SKILL_BRAND_COLOR = '#00c88a';
export const EMORI_SKILL_DESCRIPTION_PREFIX = SKILL_DESCRIPTION_PREFIX;
export const SKILLS_ROOT_DIR = path.resolve(MODULE_DIR, '..', '..');

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
  return applyRgb(EMORI_SKILL_BRAND_COLOR, text, stream);
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
  if (normalized.startsWith(EMORI_SKILL_MACHINE_PREFIX_WITH_HYPHEN)) {
    return normalized.slice(EMORI_SKILL_MACHINE_PREFIX_WITH_HYPHEN.length);
  }

  return normalized;
}

export function renderMetadataTagsYaml(tags) {
  return tags.map((tag) => `    - ${tag}`).join('\n');
}
