import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import {
  formatValidationReport,
  parseFrontmatter,
  validateSkillDir,
} from '../skills/skill-author/scripts/skill-author-lib.js';

const PLANNED_SKILL_IDS = new Set(['emori-writing']);
const PACKAGE_SCRIPT_PATTERN = /\b(?:bun|npm|pnpm|yarn)\s+run\s+([a-zA-Z0-9:_-]+)/g;
const SKILL_REFERENCE_PATTERN = /\$([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/g;

function createValidationContext({
  repoRoot = process.cwd(),
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  return {
    failures: [],
    repoRoot: path.resolve(repoRoot),
    stderr,
    stdout,
    warnings: [],
  };
}

function fail(context, message) {
  context.failures.push(message);
}

function warn(context, message) {
  context.warnings.push(message);
}

function logCheck(context, message) {
  context.stdout.write(`check ${message}\n`);
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(context, relativePath) {
  return JSON.parse(await readFile(path.join(context.repoRoot, relativePath), 'utf8'));
}

async function listDirectories(targetDir) {
  const entries = await readdir(targetDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function collectFiles(targetPath, predicate, files = []) {
  if (!(await pathExists(targetPath))) {
    return files;
  }

  const targetStat = await stat(targetPath);
  if (targetStat.isFile()) {
    if (predicate(targetPath)) {
      files.push(targetPath);
    }
    return files;
  }

  if (!targetStat.isDirectory()) {
    return files;
  }

  const entries = await readdir(targetPath, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === '.git' || entry.name === 'node_modules') {
      continue;
    }
    await collectFiles(path.join(targetPath, entry.name), predicate, files);
  }

  return files;
}

function normalizeManifestPath(rawPath) {
  return String(rawPath ?? '').trim();
}

async function checkManifestPath(context, { label, rawPath, required = true }) {
  const manifestPath = normalizeManifestPath(rawPath);
  if (!manifestPath) {
    if (required) {
      fail(context, `plugin manifest is missing ${label}.`);
    }
    return false;
  }

  if (!manifestPath.startsWith('./')) {
    fail(
      context,
      `plugin manifest ${label} must be relative to the plugin root and start with './': ${manifestPath}`,
    );
    return false;
  }

  if (!(await pathExists(path.join(context.repoRoot, manifestPath)))) {
    fail(context, `plugin manifest ${label} points to a missing path: ${manifestPath}`);
    return false;
  }

  return true;
}

async function validateSkills(context) {
  logCheck(context, 'skill directories');
  const skillsDir = path.join(context.repoRoot, 'skills');
  const skillDirs = await listDirectories(skillsDir);
  const skillIds = new Set();

  for (const skillName of skillDirs) {
    const skillDir = path.join(skillsDir, skillName);
    const skillContent = await readFile(path.join(skillDir, 'SKILL.md'), 'utf8');
    const frontmatter = parseFrontmatter(skillContent);
    if (frontmatter?.name) {
      skillIds.add(frontmatter.name);
    }

    const result = await validateSkillDir(skillDir);
    context.stdout.write(`${formatValidationReport(result)}\n`);

    if (result.errors.length > 0) {
      fail(context, `skill validation failed for ${path.relative(context.repoRoot, skillDir)}.`);
    }
  }

  return skillIds;
}

function collectDefaultPrompts(pluginInterface) {
  const rawPrompts = pluginInterface.defaultPrompt ?? [];
  const prompts = Array.isArray(rawPrompts) ? rawPrompts : [rawPrompts];
  return prompts.map((prompt) => String(prompt ?? '').trim()).filter(Boolean);
}

function validateDefaultPrompts(context, pluginInterface, skillIds) {
  logCheck(context, 'plugin starter prompts');
  const prompts = collectDefaultPrompts(pluginInterface);

  if (prompts.length === 0) {
    fail(context, 'plugin interface.defaultPrompt must include at least one starter prompt.');
    return;
  }

  const referencedSkillIds = new Set();
  for (const prompt of prompts) {
    for (const match of prompt.matchAll(SKILL_REFERENCE_PATTERN)) {
      referencedSkillIds.add(match[1]);
    }
  }

  let installedSkillReferenceCount = 0;
  for (const skillId of referencedSkillIds) {
    if (skillIds.has(skillId)) {
      installedSkillReferenceCount += 1;
      continue;
    }

    if (PLANNED_SKILL_IDS.has(skillId)) {
      warn(context, `starter prompt references planned future skill: ${skillId}`);
      continue;
    }

    fail(context, `starter prompt references unknown skill: ${skillId}`);
  }

  if (installedSkillReferenceCount === 0) {
    fail(context, 'plugin interface.defaultPrompt must reference at least one installed skill.');
  }
}

async function validateMcpConfig(context, rawPath) {
  logCheck(context, 'MCP config');
  if (!(await checkManifestPath(context, { label: 'mcpServers', rawPath }))) {
    return;
  }

  const mcpPath = normalizeManifestPath(rawPath);
  let mcpJson;
  try {
    mcpJson = await readJson(context, mcpPath);
  } catch (error) {
    fail(
      context,
      `plugin manifest mcpServers points to invalid JSON: ${mcpPath}: ${error.message}`,
    );
    return;
  }

  if (!mcpJson || typeof mcpJson !== 'object' || Array.isArray(mcpJson)) {
    fail(context, `MCP config must be a JSON object: ${mcpPath}`);
    return;
  }

  if (
    !mcpJson.mcpServers ||
    typeof mcpJson.mcpServers !== 'object' ||
    Array.isArray(mcpJson.mcpServers)
  ) {
    fail(context, `MCP config must contain an object mcpServers property: ${mcpPath}`);
  }
}

async function validatePluginManifest(context, skillIds) {
  logCheck(context, 'plugin manifest paths');
  const pluginJson = await readJson(context, '.codex-plugin/plugin.json');

  await checkManifestPath(context, { label: 'skills', rawPath: pluginJson.skills });
  await checkManifestPath(context, { label: 'apps', rawPath: pluginJson.apps, required: false });

  const pluginInterface = pluginJson.interface ?? {};
  await checkManifestPath(context, {
    label: 'interface.composerIcon',
    rawPath: pluginInterface.composerIcon,
  });
  await checkManifestPath(context, { label: 'interface.logo', rawPath: pluginInterface.logo });

  if (Array.isArray(pluginInterface.screenshots)) {
    for (const [index, screenshotPath] of pluginInterface.screenshots.entries()) {
      await checkManifestPath(context, {
        label: `interface.screenshots[${index}]`,
        rawPath: screenshotPath,
      });
    }
  }

  await validateMcpConfig(context, pluginJson.mcpServers);
  validateDefaultPrompts(context, pluginInterface, skillIds);
}

async function validateWorkflowPackageScripts(context) {
  logCheck(context, 'workflow package script references');
  const workflowDir = path.join(context.repoRoot, '.github', 'workflows');
  if (!(await pathExists(workflowDir))) {
    return;
  }

  const packageJson = await readJson(context, 'package.json');
  const scripts = new Set(Object.keys(packageJson.scripts ?? {}));
  const workflowFiles = await collectFiles(workflowDir, (filePath) => /\.(ya?ml)$/.test(filePath));

  for (const workflowFile of workflowFiles) {
    const content = await readFile(workflowFile, 'utf8');
    for (const match of content.matchAll(PACKAGE_SCRIPT_PATTERN)) {
      const scriptName = match[1];
      if (!scripts.has(scriptName)) {
        fail(
          context,
          `workflow ${path.relative(context.repoRoot, workflowFile)} calls missing package script: ${scriptName}`,
        );
      }
    }
  }
}

export async function runCodexSyncValidate(options = {}) {
  const context = createValidationContext(options);

  const skillIds = await validateSkills(context);
  await validatePluginManifest(context, skillIds);
  await validateWorkflowPackageScripts(context);

  if (context.warnings.length > 0) {
    context.stdout.write('\nwarnings:\n');
    for (const warning of context.warnings) {
      context.stdout.write(`- ${warning}\n`);
    }
  }

  if (context.failures.length > 0) {
    context.stderr.write('\nCodex plugin validation failed:\n');
    for (const failure of context.failures) {
      context.stderr.write(`- ${failure}\n`);
    }

    return {
      failures: [...context.failures],
      ok: false,
      repoRoot: context.repoRoot,
      warnings: [...context.warnings],
    };
  }

  context.stdout.write('done Codex plugin validation passed\n');
  return {
    failures: [],
    ok: true,
    repoRoot: context.repoRoot,
    warnings: [...context.warnings],
  };
}
