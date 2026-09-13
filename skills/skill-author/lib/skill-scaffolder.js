import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { YAML } from 'bun';

import {
  EMORI_SKILL_BRAND_COLOR,
  EMORI_SKILL_LICENSE,
  EMORI_SKILL_MACHINE_PREFIX_WITH_HYPHEN,
  EMORI_SKILL_OWNER,
  SKILLS_ROOT_DIR,
  formatSkillTypeIds,
  getBundledLargeIconPath,
  getBundledSmallIconPath,
  getSkillType,
  isKebabCaseId,
  renderMetadataTagsYaml,
  stripSkillPrefix,
} from './skill-author.js';
import { formatValidationReport, validateSkillDir } from './skill-validator.js';
import inferSkillCategoryTag from '../utils/infer-skill-category-tag.js';
import normalizeSkillDescription, {
  makeDefaultPrompt,
  makeShortDescription,
} from '../utils/normalize-skill-description.js';
import pathExists from '../utils/path-exists.js';
import publishSkillDirectory from '../utils/publish-skill-directory.js';
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

function makeOpenAiYaml({ displayName, shortDescription, defaultPrompt, iconSmall, iconLarge }) {
  return (
    YAML.stringify(
      {
        interface: {
          display_name: displayName,
          short_description: shortDescription,
          icon_small: iconSmall,
          icon_large: iconLarge,
          brand_color: EMORI_SKILL_BRAND_COLOR,
          default_prompt: defaultPrompt,
        },
      },
      null,
      2,
    ) + '\n'
  );
}

/**
 * Creates and validates one EMORI-local skill from the selected template.
 *
 * Validates a sibling candidate before publication; failed forced replacement
 * restores the existing skill or reports its retained backup path.
 *
 * @param {object} options Authored skill values and filesystem options.
 * @param {object} [dependencies] File-writing boundary for deterministic failure checks.
 * @returns {Promise<{result: object, skillDir: string}>} Created path and validation report.
 * @throws {Error} When authored values are invalid or the generated skill fails validation.
 */
export async function initializeSkill(options, { writeSkillFile = writeFile } = {}) {
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
    (categoryTagOverride === EMORI_SKILL_OWNER || categoryTagOverride === type)
  ) {
    throw new Error('Category tag override must add one tag beyond owner and type.');
  }

  const normalizedDescription = normalizeSkillDescription(description);
  const slug = stripSkillPrefix(rawSlug);
  const skillId = `${EMORI_SKILL_MACHINE_PREFIX_WITH_HYPHEN}${slug}`;
  const inferredCategoryTag = inferSkillCategoryTag({
    description: normalizedDescription,
    displayName,
    owner: EMORI_SKILL_OWNER,
    slug: skillId,
    type,
  });
  const categoryTag =
    categoryTagOverride || inferredCategoryTag || typeDefinition.defaultCategoryTag;

  if (!categoryTag || !isKebabCaseId(categoryTag)) {
    throw new Error(`Category tag must be a kebab-case id: ${categoryTag || '<empty>'}`);
  }
  if (categoryTag === EMORI_SKILL_OWNER || categoryTag === type) {
    throw new Error('Category tag must add one tag beyond owner and type.');
  }

  const tags = [EMORI_SKILL_OWNER, type, categoryTag];
  const validationTargetDir = path.resolve(options.outputDir ?? SKILLS_ROOT_DIR);
  const usesWorkspaceAssets = validationTargetDir === SKILLS_ROOT_DIR;
  const pluginRootPath = path.resolve(validationTargetDir, '..', '.codex-plugin', 'plugin.json');
  const usesUnprefixedFolder = usesWorkspaceAssets || (await pathExists(pluginRootPath));
  const folderName = usesUnprefixedFolder ? stripSkillPrefix(skillId) : skillId;
  const skillDir = path.resolve(validationTargetDir, folderName);
  const openclawHomepage = String(
    options.homepage ?? `https://github.com/tanaabased/emori/tree/main/skills/${folderName}`,
  ).trim();

  if (!/^https:\/\//i.test(openclawHomepage)) {
    throw new Error(`OpenClaw homepage must be an HTTPS URL: ${openclawHomepage}`);
  }

  if ((await pathExists(skillDir)) && !options.force) {
    throw new Error(`Skill directory already exists: ${skillDir}`);
  }

  const skillContent = renderSkillTemplate(typeDefinition.templateBody, {
    description: normalizedDescription,
    description_yaml: YAML.stringify(normalizedDescription),
    display_name: displayName,
    license: EMORI_SKILL_LICENSE,
    metadata_tags_yaml: renderMetadataTagsYaml(tags),
    openclaw_emoji: YAML.stringify(openclawEmoji),
    openclaw_homepage: YAML.stringify(openclawHomepage),
    owner: EMORI_SKILL_OWNER,
    skill_id: skillId,
    type,
  });
  const defaultPrompt =
    String(options.prompt ?? '').trim() || makeDefaultPrompt(skillId, normalizedDescription);
  const openAiContent = makeOpenAiYaml({
    defaultPrompt,
    displayName,
    iconLarge: usesWorkspaceAssets ? '../../assets/icon-large.png' : './assets/icon-large.png',
    iconSmall: usesWorkspaceAssets ? '../../assets/composer-icon.svg' : './assets/icon-small.svg',
    shortDescription: makeShortDescription(normalizedDescription),
  });

  await mkdir(validationTargetDir, { recursive: true });
  const stagedDir = await mkdtemp(path.join(validationTargetDir, '.emori-skill-'));
  const agentsDir = path.join(stagedDir, 'agents');
  const assetsDir = path.join(stagedDir, 'assets');
  try {
    await mkdir(agentsDir);
    await writeSkillFile(path.join(stagedDir, 'SKILL.md'), skillContent, 'utf8');
    await writeSkillFile(path.join(agentsDir, 'openai.yaml'), openAiContent, 'utf8');
    if (!usesWorkspaceAssets) {
      await mkdir(assetsDir);
      await copyFile(getBundledSmallIconPath(), path.join(assetsDir, 'icon-small.svg'));
      await copyFile(getBundledLargeIconPath(), path.join(assetsDir, 'icon-large.png'));
    }

    const result = await validateSkillDir(stagedDir, {
      destinationDir: skillDir,
      expectedType: type,
    });
    if (result.errors.length > 0) {
      throw new Error(`Generated skill failed validation.\n${formatValidationReport(result)}`);
    }

    await publishSkillDirectory(stagedDir, skillDir, { force: options.force });
    return { result: { ...result, skillDir }, skillDir };
  } finally {
    await rm(stagedDir, { force: true, recursive: true });
  }
}
