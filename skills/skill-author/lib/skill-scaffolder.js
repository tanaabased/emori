import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  CANON_SKILL_BRAND_COLOR,
  CANON_SKILL_LICENSE,
  CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN,
  CANON_SKILL_OWNER,
  SKILLS_ROOT_DIR,
  formatSkillTypeIds,
  formatValidationReport,
  getBundledLargeIconPath,
  getBundledSmallIconPath,
  getSkillType,
  isKebabCaseId,
  renderMetadataTagsYaml,
  stripSkillPrefix,
  validateSkillDir,
} from './skill-author.js';
import inferSkillCategoryTag from '../utils/infer-skill-category-tag.js';
import normalizeSkillDescription, {
  makeDefaultPrompt,
  makeShortDescription,
} from '../utils/normalize-skill-description.js';
import renderSkillTemplate from '../utils/render-skill-template.js';

function normalizeSlug(value) {
  const slug = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    throw new Error('Slug must contain at least one letter or digit.');
  }

  return slug;
}

function stripDuplicateOwnerPrefix(slug) {
  if (slug.startsWith(CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN)) {
    return slug.slice(CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN.length);
  }

  return slug;
}

function quoteYaml(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function makeOpenAiYaml({ displayName, shortDescription, defaultPrompt }) {
  return `interface:
  display_name: ${quoteYaml(displayName)}
  short_description: ${quoteYaml(shortDescription)}
  icon_small: "./assets/icon-small.svg"
  icon_large: "./assets/icon-large.png"
  brand_color: ${quoteYaml(CANON_SKILL_BRAND_COLOR)}
  default_prompt: ${quoteYaml(defaultPrompt)}
`;
}

/**
 * Creates and validates one EMORI-local skill from the selected template.
 *
 * This workflow writes the skill directory and replaces it when force is enabled.
 *
 * @param {object} options Authored skill values and filesystem options.
 * @returns {Promise<{result: object, skillDir: string}>} Created path and validation report.
 * @throws {Error} When authored values are invalid or the generated skill fails validation.
 */
export async function initializeSkill(options) {
  const type = String(options.type ?? '')
    .trim()
    .toLowerCase();
  const rawSlug = normalizeSlug(options.slug ?? '');
  const categoryTagOverride = String(options.categoryTag ?? '')
    .trim()
    .toLowerCase();
  const displayName = String(options.displayName ?? '').trim();
  const description = String(options.description ?? '').trim();
  const openclawEmoji = String(options.emoji ?? '').trim();

  if (!type) {
    throw new Error('Type is required.');
  }

  if (!displayName) {
    throw new Error('Display name is required.');
  }

  if (!description) {
    throw new Error('Description is required.');
  }

  if (!openclawEmoji) {
    throw new Error('A skill-specific OpenClaw emoji is required.');
  }

  const typeDefinition = getSkillType(type);
  if (!typeDefinition) {
    throw new Error(`Unknown type: ${type}. Allowed types: ${formatSkillTypeIds()}`);
  }

  if (categoryTagOverride && !isKebabCaseId(categoryTagOverride)) {
    throw new Error(
      `Category tag must use lowercase letters, digits, and hyphens only: ${categoryTagOverride}`,
    );
  }

  if (
    categoryTagOverride &&
    (categoryTagOverride === CANON_SKILL_OWNER || categoryTagOverride === type)
  ) {
    throw new Error('Category tag override must add one tag beyond owner and type.');
  }

  const normalizedDescription = normalizeSkillDescription(description);
  const slug = stripDuplicateOwnerPrefix(rawSlug);
  const skillId = `${CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN}${slug}`;
  const inferredCategoryTag = inferSkillCategoryTag({
    description: normalizedDescription,
    displayName,
    owner: CANON_SKILL_OWNER,
    slug: skillId,
    type,
  });
  const categoryTag =
    categoryTagOverride || inferredCategoryTag || typeDefinition.defaultCategoryTag;

  if (!categoryTag || !isKebabCaseId(categoryTag)) {
    throw new Error(`Category tag must be a kebab-case id: ${categoryTag || '<empty>'}`);
  }
  if (categoryTag === CANON_SKILL_OWNER || categoryTag === type) {
    throw new Error('Category tag must add one tag beyond owner and type.');
  }

  const tags = [CANON_SKILL_OWNER, type, categoryTag];
  const validationTargetDir = path.resolve(options.outputDir ?? SKILLS_ROOT_DIR);
  const pluginRootPath = path.resolve(validationTargetDir, '..', '.codex-plugin', 'plugin.json');
  const usesUnprefixedFolder =
    validationTargetDir === SKILLS_ROOT_DIR || (await exists(pluginRootPath));
  const folderName = usesUnprefixedFolder ? stripSkillPrefix(skillId) : skillId;
  const skillDir = path.resolve(validationTargetDir, folderName);
  const agentsDir = path.join(skillDir, 'agents');
  const assetsDir = path.join(skillDir, 'assets');
  const openclawHomepage = String(
    options.homepage ?? `https://github.com/tanaabased/emori/tree/main/skills/${folderName}`,
  ).trim();

  if (!/^https:\/\//i.test(openclawHomepage)) {
    throw new Error(`OpenClaw homepage must be an HTTPS URL: ${openclawHomepage}`);
  }

  if ((await exists(skillDir)) && !options.force) {
    throw new Error(`Skill directory already exists: ${skillDir}`);
  }

  if (options.force) {
    await rm(skillDir, { force: true, recursive: true });
  }

  await mkdir(agentsDir, { recursive: true });
  await mkdir(assetsDir, { recursive: true });

  const skillContent = renderSkillTemplate(typeDefinition.templateBody, {
    description: normalizedDescription,
    display_name: displayName,
    license: CANON_SKILL_LICENSE,
    metadata_tags_yaml: renderMetadataTagsYaml(tags),
    openclaw_emoji: quoteYaml(openclawEmoji),
    openclaw_homepage: quoteYaml(openclawHomepage),
    owner: CANON_SKILL_OWNER,
    skill_id: skillId,
    type,
  });
  const defaultPrompt =
    String(options.prompt ?? '').trim() || makeDefaultPrompt(skillId, normalizedDescription);
  const openAiContent = makeOpenAiYaml({
    defaultPrompt,
    displayName,
    shortDescription: makeShortDescription(normalizedDescription),
  });

  await Promise.all([
    writeFile(path.join(skillDir, 'SKILL.md'), skillContent, 'utf8'),
    writeFile(path.join(agentsDir, 'openai.yaml'), openAiContent, 'utf8'),
    copyFile(getBundledSmallIconPath(), path.join(assetsDir, 'icon-small.svg')),
    copyFile(getBundledLargeIconPath(), path.join(assetsDir, 'icon-large.png')),
  ]);

  const result = await validateSkillDir(skillDir, {
    expectedType: type,
  });
  if (result.errors.length > 0) {
    throw new Error(`Generated skill failed validation.\n${formatValidationReport(result)}`);
  }

  return { result, skillDir };
}
