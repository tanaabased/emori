import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { YAML } from 'bun';

import parseSkillFrontmatter from '../utils/parse-skill-frontmatter.js';

// The native Bun process loads the library's bundled image and text imports.
const NATIVE_SCRIPT = `
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { initializeSkill } from './skills/skill-author/lib/skill-scaffolder.js';
import { validateSkillDir } from './skills/skill-author/lib/skill-validator.js';
const { operation, input, failWrite } = JSON.parse(process.env.EMORI_SCAFFOLD_TEST);
const dependencies = failWrite ? { writeSkillFile: async (file, ...args) => {
  if (path.basename(file) === 'openai.yaml') throw new Error('simulated disk failure');
  await writeFile(file, ...args);
}} : {};
const result = operation === 'validate' ? await validateSkillDir(input) : await initializeSkill(input, dependencies);
console.log(JSON.stringify(result));
`;

async function invokeNative(operation, input, failWrite = false) {
  const result = spawnSync('bun', ['--eval', NATIVE_SCRIPT], {
    cwd: new URL('../../../', import.meta.url),
    encoding: 'utf8',
    env: { ...process.env, EMORI_SCAFFOLD_TEST: JSON.stringify({ operation, input, failWrite }) },
  });
  if (result.status !== 0) throw new Error(result.stderr || String(result.error));
  return JSON.parse(result.stdout);
}

const initializeSkill = (options, failWrite) => invokeNative('initialize', options, failWrite);
const validateSkillDir = (skillDir) => invokeNative('validate', skillDir);

describe('skills/skill-author/lib/skill-scaffolder', () => {
  let outputDir;
  let options;

  beforeEach(async () => {
    outputDir = await mkdtemp(path.join(os.tmpdir(), 'emori-scaffold-'));
    options = {
      outputDir,
      type: 'generic',
      slug: 'example',
      displayName: 'Example',
      description: 'EMORI-based fixture validation. Use when testing scaffolds.',
      emoji: '🧪',
      homepage: 'https://example.com/skill',
    };
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it('should round-trip authored punctuation and newlines through valid YAML', async () => {
    const description =
      'EMORI-based help: keep "quotes", # symbols and \\ paths.\nUse when testing.';
    const displayName = 'Say "hello": #1';
    const prompt = 'Use $emori-example: keep "quotes".\nKeep the second line.';
    const { skillDir, result } = await initializeSkill({
      ...options,
      description,
      displayName,
      prompt,
    });
    assert.deepEqual(result.errors, []);
    assert.equal(result.skillDir, skillDir);
    assert.equal(
      parseSkillFrontmatter(await readFile(path.join(skillDir, 'SKILL.md'), 'utf8')).description,
      description,
    );
    const metadata = YAML.parse(await readFile(path.join(skillDir, 'agents/openai.yaml'), 'utf8'));
    assert.equal(metadata.interface.display_name, displayName);
    assert.equal(metadata.interface.default_prompt, prompt);
    assert.deepEqual((await validateSkillDir(skillDir)).errors, []);
  });

  it('should leave no destination or staging files after invalid generation', async () => {
    await assert.rejects(
      initializeSkill({ ...options, prompt: 'Missing skill reference' }),
      /failed validation/,
    );
    assert.deepEqual(await readdir(outputDir), []);
  });

  it('should preserve an existing skill when forced validation fails', async () => {
    const { skillDir } = await initializeSkill(options);
    const original = await readFile(path.join(skillDir, 'SKILL.md'), 'utf8');
    await writeFile(path.join(skillDir, 'keep.txt'), 'original work');
    await assert.rejects(
      initializeSkill({ ...options, force: true, prompt: 'Missing reference' }),
      /failed validation/,
    );
    assert.equal(await readFile(path.join(skillDir, 'SKILL.md'), 'utf8'), original);
    assert.equal(await readFile(path.join(skillDir, 'keep.txt'), 'utf8'), 'original work');
    assert.deepEqual(await readdir(outputDir), ['emori-example']);
  });

  it('should preserve an existing skill and clean staging after a write failure', async () => {
    const { skillDir } = await initializeSkill(options);
    await writeFile(path.join(skillDir, 'keep.txt'), 'original work');
    await assert.rejects(
      initializeSkill({ ...options, force: true }, true),
      /simulated disk failure/,
    );
    assert.equal(await readFile(path.join(skillDir, 'keep.txt'), 'utf8'), 'original work');
    assert.deepEqual(await readdir(outputDir), ['emori-example']);
  });

  it('should publish a valid replacement and remove its backup', async () => {
    const { skillDir } = await initializeSkill(options);
    await writeFile(path.join(skillDir, 'old.txt'), 'old');
    await initializeSkill({ ...options, force: true, displayName: 'Replacement' });
    const metadata = YAML.parse(await readFile(path.join(skillDir, 'agents/openai.yaml'), 'utf8'));
    assert.equal(metadata.interface.display_name, 'Replacement');
    assert.ok(!(await readdir(skillDir)).includes('old.txt'));
    assert.deepEqual(await readdir(outputDir), ['emori-example']);
    assert.deepEqual((await validateSkillDir(skillDir)).errors, []);
  });
});
