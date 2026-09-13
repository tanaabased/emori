import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { YAML } from 'bun';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..', '..', '..');
const SKILL_DIR = path.join(REPO_ROOT, 'skills', 'skill-author');
const INIT_SCRIPT = path.join(SKILL_DIR, 'scripts', 'init-skill.js');
const VALIDATE_SCRIPT = path.join(SKILL_DIR, 'scripts', 'validate-skill.js');
const TYPES = [
  { id: 'generic', headings: ['## Workflow', '## Optimization'] },
  {
    id: 'coding',
    headings: [
      '## Documentation',
      '## Testing',
      '## Deployment',
      '## GitHub Actions',
      '## Optimization',
    ],
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
    ...(outputDir ? ['--output-dir', outputDir] : []),
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

      if (type === 'meta') {
        assert.match(
          skillContent,
          /against the EMORI standard and any\s+relevant shared Tanaab contract/,
        );
        assert.match(skillContent, /Load only the EMORI standard, relevant shared Tanaab guidance/);
        assert.doesNotMatch(skillContent, /against shared canon|Load only the shared standard/);
      }

      const validated = runBun(VALIDATE_SCRIPT, ['--skill-dir', skillDir, '--type', type]);
      assert.equal(validated.status, 0, commandOutput(validated));
      assert.match(validated.stdout, /^status: ok$/m);
    });
  }

  it('should reuse shared artwork for workspace skills without copying icons', async () => {
    const workspace = path.join(tempDir, 'workspace');
    const skillsDir = path.join(workspace, 'skills');
    const authorDir = path.join(skillsDir, 'skill-author');
    const assetsDir = path.join(workspace, 'assets');
    await cp(SKILL_DIR, authorDir, { recursive: true });
    await mkdir(assetsDir);
    await Promise.all([
      writeFile(path.join(workspace, 'AGENTS.md'), '# Workspace\n'),
      writeFile(path.join(workspace, 'IDENTITY.md'), '# Identity\n'),
      copyFile(
        path.join(REPO_ROOT, 'assets', 'composer-icon.svg'),
        path.join(assetsDir, 'composer-icon.svg'),
      ),
      copyFile(
        path.join(REPO_ROOT, 'assets', 'icon-large.png'),
        path.join(assetsDir, 'icon-large.png'),
      ),
    ]);

    const initialized = runBun(path.join(authorDir, 'scripts', 'init-skill.js'), initArgs({}));
    assert.equal(initialized.status, 0, commandOutput(initialized));

    const skillDir = path.join(skillsDir, 'contract-generic');
    const metadata = await readFile(path.join(skillDir, 'agents', 'openai.yaml'), 'utf8');
    assert.equal(YAML.parse(metadata).interface.icon_small, '../../assets/composer-icon.svg');
    assert.equal(YAML.parse(metadata).interface.icon_large, '../../assets/icon-large.png');
    assert.ok(!(await readdir(skillDir)).includes('assets'));

    const validated = runBun(VALIDATE_SCRIPT, ['--skill-dir', skillDir]);
    assert.equal(validated.status, 0, commandOutput(validated));
  });

  it('should keep standalone exports portable with bundled artwork', async () => {
    const outputDir = path.join(tempDir, 'exports');
    const initialized = runBun(INIT_SCRIPT, initArgs({ outputDir }));
    assert.equal(initialized.status, 0, commandOutput(initialized));

    const movedSkillDir = path.join(tempDir, 'emori-contract-generic');
    await rename(path.join(outputDir, 'emori-contract-generic'), movedSkillDir);
    const metadata = await readFile(path.join(movedSkillDir, 'agents', 'openai.yaml'), 'utf8');
    assert.equal(YAML.parse(metadata).interface.icon_small, './assets/icon-small.svg');
    assert.equal(YAML.parse(metadata).interface.icon_large, './assets/icon-large.png');
    assert.deepEqual(
      await readFile(path.join(movedSkillDir, 'assets', 'icon-small.svg')),
      await readFile(path.join(REPO_ROOT, 'assets', 'composer-icon.svg')),
    );
    assert.deepEqual(
      await readFile(path.join(movedSkillDir, 'assets', 'icon-large.png')),
      await readFile(path.join(REPO_ROOT, 'assets', 'icon-large.png')),
    );

    const validated = runBun(VALIDATE_SCRIPT, ['--skill-dir', movedSkillDir]);
    assert.equal(validated.status, 0, commandOutput(validated));
  });

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
