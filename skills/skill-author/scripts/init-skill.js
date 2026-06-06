#!/usr/bin/env bun
/* eslint-disable no-console */

import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  CANON_SKILL_BRAND_COLOR,
  CANON_SKILL_LICENSE,
  CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN,
  CANON_SKILL_OWNER,
  SKILLS_ROOT_DIR,
  bold,
  dim,
  formatSkillTypeIds,
  formatValidationReport,
  getBundledLargeIconPath,
  getBundledSmallIconPath,
  getSkillType,
  inferCategoryTag,
  isKebabCaseId,
  makeDefaultPrompt,
  makeShortDescription,
  normalizeSkillDescription,
  renderCliHelp,
  renderMetadataTagsYaml,
  renderTemplate,
  stripSkillPrefix,
  validateSkillDir,
} from './skill-author-lib.js';

function usage(code = 0) {
  console.log(
    renderCliHelp({
      usage: `Usage: ${bold('init-skill.js')} ${dim('--type <type> --slug <slug> --display-name <name> --description <text> [options]')}`,
      summary:
        'Initialize an EMORI-based skill from the canonical local full templates owned by emori-skill-author.',
      options: [
        `  --type <type>           skill type such as ${dim(formatSkillTypeIds())}`,
        '  --category-tag <tag>    category tag override; must add one tag beyond owner and type',
        `  --slug <slug>           skill slug without the ${CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN} prefix`,
        '  --display-name <name>   human-readable skill display name',
        '  --description <text>    skill description text',
        '  --prompt <text>         default prompt for agents/openai.yaml',
        `  --output-dir <path>     parent directory for generated skills ${dim(`[default: ${SKILLS_ROOT_DIR}]`)}`,
        '  --force                 overwrite an existing generated skill directory',
        '  -h, --help              show this message',
      ],
    }),
  );
  process.exit(code);
}

function parseArgs(argv) {
  const parsed = {
    outputDir: SKILLS_ROOT_DIR,
    type: 'generic',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '-h' || arg === '--help') {
      usage(0);
    }

    if (arg === '--force') {
      parsed.force = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      throw new Error(`Positional arguments are not supported: ${arg}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }

    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const type = String(options.type ?? '')
    .trim()
    .toLowerCase();
  const rawSlug = normalizeSlug(options.slug ?? '');
  const categoryTagOverride = String(options.categoryTag ?? '')
    .trim()
    .toLowerCase();
  const displayName = String(options.displayName ?? '').trim();
  const description = String(options.description ?? '').trim();

  if (!type) {
    throw new Error('Type is required.');
  }

  if (!displayName) {
    throw new Error('Display name is required.');
  }

  if (!description) {
    throw new Error('Description is required.');
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
  const inferredCategoryTag = inferCategoryTag({
    description: normalizedDescription,
    displayName,
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
  const folderName = (await exists(pluginRootPath)) ? stripSkillPrefix(skillId) : skillId;
  const skillDir = path.resolve(validationTargetDir, folderName);
  const agentsDir = path.join(skillDir, 'agents');
  const assetsDir = path.join(skillDir, 'assets');

  if ((await exists(skillDir)) && !options.force) {
    throw new Error(`Skill directory already exists: ${skillDir}`);
  }

  if (options.force) {
    await rm(skillDir, { force: true, recursive: true });
  }

  await mkdir(agentsDir, { recursive: true });
  await mkdir(assetsDir, { recursive: true });

  const skillContent = renderTemplate(typeDefinition.templateBody, {
    description: normalizedDescription,
    display_name: displayName,
    license: CANON_SKILL_LICENSE,
    metadata_tags_yaml: renderMetadataTagsYaml(tags),
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

  console.log(`Created skill at ${skillDir}`);
  if (result.warnings.length > 0 || result.manualChecks.length > 0) {
    console.log(formatValidationReport(result));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  usage(1);
});
