import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..', '..', '..');
const SKILL_DIR = path.join(REPO_ROOT, 'skills', 'skill-author');
const INIT_SCRIPT = path.join(SKILL_DIR, 'scripts', 'init-skill.js');
const VALIDATE_SCRIPT = path.join(SKILL_DIR, 'scripts', 'validate-skill.js');
const TYPES = [
  { id: 'generic', headings: ['## Workflow', '## Optimization'] },
  {
    id: 'coding',
    headings: ['## Documentation', '## Testing', '## GitHub Actions', '## Optimization'],
  },
  { id: 'integration', headings: ['## Release Workflow', '## Optimization'] },
  { id: 'workflow', headings: ['## Checkpoints', '## Completion Criteria', '## Optimization'] },
  { id: 'meta', headings: ['## Evaluation Criteria', '## Optimization'] },
];

function runBun(scriptPath, args) {
  return spawnSync('bun', [scriptPath, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: '1',
    },
  });
}

function commandOutput(result) {
  return [result.stdout, result.stderr].filter(Boolean).join('\n');
}

function initArgs({ outputDir, type = 'generic', homepage = 'https://example.com/skill' }) {
  return [
    '--type',
    type,
    '--slug',
    `contract-${type}`,
    '--display-name',
    `Contract ${type}`,
    '--description',
    `EMORI-based ${type} contract fixture. Use when validating the ${type} template.`,
    '--emoji',
    '🧪',
    '--homepage',
    homepage,
    '--output-dir',
    outputDir,
  ];
}

describe('skills/skill-author', function () {
  this.timeout(10_000);

  let tempDir;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'emori-skill-author-'));
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  for (const { id: type, headings } of TYPES) {
    it(`should scaffold and validate the ${type} template`, async () => {
      const skillId = `emori-contract-${type}`;
      const homepage = `https://example.com/${skillId}`;
      const initialized = runBun(INIT_SCRIPT, initArgs({ homepage, outputDir: tempDir, type }));

      assert.equal(initialized.status, 0, commandOutput(initialized));

      const skillDir = path.join(tempDir, skillId);
      const skillContent = await readFile(path.join(skillDir, 'SKILL.md'), 'utf8');
      assert.match(skillContent, new RegExp(`^name: ${skillId}$`, 'm'));
      assert.match(skillContent, new RegExp(`^\\s{2}type: ${type}$`, 'm'));
      assert.match(skillContent, /^\s{2}owner: emoriwan$/m);
      assert.match(skillContent, /^\s{4}emoji: ['"]?🧪['"]?$/m);
      assert.match(skillContent, new RegExp(`^\\s{4}homepage: ['"]?${homepage}['"]?$`, 'm'));

      for (const heading of headings) {
        assert.ok(skillContent.includes(heading), `missing heading: ${heading}`);
      }

      const validated = runBun(VALIDATE_SCRIPT, ['--skill-dir', skillDir, '--type', type]);
      assert.equal(validated.status, 0, commandOutput(validated));
      assert.match(validated.stdout, /^status: ok$/m);
    });
  }

  it('should reject a non-HTTPS OpenClaw homepage', () => {
    const initialized = runBun(
      INIT_SCRIPT,
      initArgs({ homepage: 'http://example.com/emori-contract-generic', outputDir: tempDir }),
    );

    assert.equal(initialized.status, 1, commandOutput(initialized));
    assert.match(initialized.stderr, /OpenClaw homepage must be an HTTPS URL/);
  });

  it('should reject a skill owned by another layer', async () => {
    const initialized = runBun(INIT_SCRIPT, initArgs({ outputDir: tempDir }));
    assert.equal(initialized.status, 0, commandOutput(initialized));

    const skillDir = path.join(tempDir, 'emori-contract-generic');
    const skillPath = path.join(skillDir, 'SKILL.md');
    const skillContent = await readFile(skillPath, 'utf8');
    await writeFile(skillPath, skillContent.replace('owner: emoriwan', 'owner: tanaab'));

    const validated = runBun(VALIDATE_SCRIPT, ['--skill-dir', skillDir]);
    assert.equal(validated.status, 1, commandOutput(validated));
    assert.match(validated.stdout, /SKILL\.md metadata\.owner must be `emoriwan`/);
  });
});
