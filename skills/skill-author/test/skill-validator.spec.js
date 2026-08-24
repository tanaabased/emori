import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(TEST_DIR, '..');
const REPO_ROOT = path.resolve(SKILL_DIR, '..', '..');
const INIT_SCRIPT = path.join(SKILL_DIR, 'scripts', 'init-skill.js');
const VALIDATOR_MODULE_URL = pathToFileURL(path.join(SKILL_DIR, 'lib', 'skill-validator.js')).href;
const DIRECT_VALIDATION_SCRIPT = `
const { validateSkillDir } = await import(process.env.EMORI_VALIDATOR_MODULE_URL);
const expectedType = process.env.EMORI_VALIDATOR_EXPECTED_TYPE || undefined;
const result = await validateSkillDir(process.env.EMORI_VALIDATOR_SKILL_DIR, { expectedType });
console.log(JSON.stringify(result));
`;

function assertMessage(messages, pattern) {
  assert.ok(
    messages.some((message) => pattern.test(message)),
    `expected ${pattern} in:\n${messages.join('\n')}`,
  );
}

function commandOutput(result) {
  return [result.stdout, result.stderr].filter(Boolean).join('\n');
}

function validateDirectly(skillDir, expectedType = '') {
  const validated = spawnSync('bun', ['--eval', DIRECT_VALIDATION_SCRIPT], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      EMORI_VALIDATOR_EXPECTED_TYPE: expectedType,
      EMORI_VALIDATOR_MODULE_URL: VALIDATOR_MODULE_URL,
      EMORI_VALIDATOR_SKILL_DIR: skillDir,
      NO_COLOR: '1',
    },
  });

  assert.equal(validated.status, 0, commandOutput(validated));
  return JSON.parse(validated.stdout);
}

describe('skills/skill-author/lib/skill-validator', function () {
  this.timeout(10_000);

  let tempDir;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'emori-skill-validator-'));
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  async function makeValidSkill() {
    const initialized = spawnSync(
      'bun',
      [
        INIT_SCRIPT,
        '--type',
        'generic',
        '--slug',
        'validator-fixture',
        '--display-name',
        'Validator Fixture',
        '--description',
        'EMORI-based validation of local skill fixtures. Use when exercising validator branches.',
        '--emoji',
        '🧪',
        '--homepage',
        'https://example.com/emori-validator-fixture',
        '--output-dir',
        tempDir,
      ],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          NO_COLOR: '1',
        },
      },
    );

    assert.equal(initialized.status, 0, commandOutput(initialized));
    return path.join(tempDir, 'emori-validator-fixture');
  }

  it('should report missing required files', async () => {
    const skillDir = path.join(tempDir, 'emori-empty');
    await mkdir(skillDir);

    const result = validateDirectly(skillDir);

    assertMessage(result.errors, /Missing SKILL\.md/);
    assertMessage(result.errors, /Missing agents\/openai\.yaml/);
  });

  it('should report broken relative links', async () => {
    const skillDir = await makeValidSkill();
    const skillPath = path.join(skillDir, 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    await writeFile(
      skillPath,
      content.replace(
        '## Bundled Resources\n',
        '## Bundled Resources\n\n- [Missing reference](./references/missing.md)\n',
      ),
    );

    const result = validateDirectly(skillDir);

    assertMessage(result.errors, /Broken relative link in SKILL\.md/);
  });

  it('should report unexpected top-level headings', async () => {
    const skillDir = await makeValidSkill();
    const skillPath = path.join(skillDir, 'SKILL.md');
    const content = await readFile(skillPath, 'utf8');
    await writeFile(
      skillPath,
      content.replace('## Bundled Resources\n', '## Unexpected\n\n## Bundled Resources\n'),
    );

    const result = validateDirectly(skillDir);

    assertMessage(
      result.errors,
      /must use the section order defined by the local generic template/,
    );
  });

  it('should report incomplete OpenAI metadata and missing icons', async () => {
    const skillDir = await makeValidSkill();
    const metadataPath = path.join(skillDir, 'agents', 'openai.yaml');
    const content = await readFile(metadataPath, 'utf8');
    await writeFile(
      metadataPath,
      content
        .replace('  brand_color: "#00c88a"\n', '')
        .replace('./assets/icon-large.png', './assets/missing.png'),
    );

    const result = validateDirectly(skillDir);

    assertMessage(result.errors, /missing interface\.brand_color/);
    assertMessage(result.errors, /interface\.icon_large points to a missing file/);
  });

  it('should report a folder that does not match its machine id', async () => {
    const skillDir = await makeValidSkill();
    const renamedSkillDir = path.join(tempDir, 'emori-wrong-folder');
    await rename(skillDir, renamedSkillDir);

    const result = validateDirectly(renamedSkillDir);

    assertMessage(result.errors, /Skill folder name must match an expected folder id/);
  });

  it('should warn about empty optional resource directories', async () => {
    const skillDir = await makeValidSkill();
    await mkdir(path.join(skillDir, 'references'));

    const result = validateDirectly(skillDir);

    assertMessage(result.warnings, /Empty optional resource directory: references\//);
  });
});
