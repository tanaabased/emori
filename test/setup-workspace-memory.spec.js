import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const task = fileURLToPath(new URL('../scripts/setup-workspace-memory-task.js', import.meta.url));
const repository = dirname(dirname(task));
const seed = '# Memory\n\nPrivate, curated notes for this agent.\n';

function workspace() {
  return mkdtempSync(join(tmpdir(), 'emori-workspace-memory-'));
}

function run(mode, cwd) {
  return spawnSync(task, [mode], { cwd, encoding: 'utf8' });
}

describe('workspace memory setup task', () => {
  let directory;

  afterEach(() => {
    if (directory) rmSync(directory, { recursive: true, force: true });
    directory = undefined;
  });

  it('creates private paths on a fresh workspace, checks without writing, and is repeatable', () => {
    directory = workspace();
    const before = run('check', directory);
    assert.equal(before.status, 1);
    assert.equal(lstatSync(directory).isDirectory(), true);
    assert.throws(() => lstatSync(join(directory, 'memory')));
    assert.throws(() => lstatSync(join(directory, 'MEMORY.md')));

    assert.equal(run('apply', directory).status, 0);
    assert.equal(lstatSync(join(directory, 'memory')).isDirectory(), true);
    assert.equal(lstatSync(join(directory, 'MEMORY.md')).isFile(), true);
    assert.equal(readFileSync(join(directory, 'MEMORY.md'), 'utf8'), seed);
    assert.equal(run('check', directory).status, 0);
    assert.equal(run('apply', directory).status, 0);
    assert.equal(readFileSync(join(directory, 'MEMORY.md'), 'utf8'), seed);
  });

  it('fills only the absent path for either partial workspace state', () => {
    directory = workspace();
    mkdirSync(join(directory, 'memory'));
    assert.equal(run('apply', directory).status, 0);
    assert.equal(lstatSync(join(directory, 'memory')).isDirectory(), true);
    assert.equal(readFileSync(join(directory, 'MEMORY.md'), 'utf8'), seed);

    const other = workspace();
    try {
      writeFileSync(join(other, 'MEMORY.md'), 'existing notes\n');
      assert.equal(run('apply', other).status, 0);
      assert.equal(lstatSync(join(other, 'memory')).isDirectory(), true);
      assert.equal(readFileSync(join(other, 'MEMORY.md'), 'utf8'), 'existing notes\n');
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it('preserves existing content and an intentionally empty memory file', () => {
    directory = workspace();
    mkdirSync(join(directory, 'memory'));
    writeFileSync(join(directory, 'memory', 'note.md'), 'keep this note\n');
    writeFileSync(join(directory, 'MEMORY.md'), '');
    assert.equal(run('apply', directory).status, 0);
    assert.equal(readFileSync(join(directory, 'MEMORY.md'), 'utf8'), '');
    assert.equal(readFileSync(join(directory, 'memory', 'note.md'), 'utf8'), 'keep this note\n');
  });

  it('fails on conflicting path types without replacing them or making partial changes', () => {
    directory = workspace();
    writeFileSync(join(directory, 'memory'), 'not a directory');
    const conflict = run('apply', directory);
    assert.equal(conflict.status, 2);
    assert.equal(readFileSync(join(directory, 'memory'), 'utf8'), 'not a directory');
    assert.throws(() => lstatSync(join(directory, 'MEMORY.md')));

    const other = workspace();
    try {
      mkdirSync(join(other, 'MEMORY.md'));
      const fileConflict = run('apply', other);
      assert.equal(fileConflict.status, 2);
      assert.equal(lstatSync(join(other, 'MEMORY.md')).isDirectory(), true);
      assert.throws(() => lstatSync(join(other, 'memory')));
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it('runs from the host phase before agent-bound setup and keeps generated paths ignored', () => {
    const hostSetup = readFileSync(join(repository, '.agent-system/setup-host.yaml'), 'utf8');
    const agentSetup = readFileSync(join(repository, '.agent-system/setup-agent.yaml'), 'utf8');
    const agentConfig = readFileSync(join(repository, '.agent-system/agent.yaml'), 'utf8');
    const ignoredPaths = readFileSync(join(repository, '.gitignore'), 'utf8').split(/\r?\n/u);
    assert.ok(
      hostSetup.indexOf('id: brew-dependencies') < hostSetup.indexOf('id: workspace-memory'),
    );
    assert.ok(agentConfig.indexOf('setup-host:') < agentConfig.indexOf('setup-agent:'));
    assert.match(agentSetup, /id: canon-checkout/u);
    assert.ok(ignoredPaths.includes('/MEMORY.md'));
    assert.ok(ignoredPaths.includes('/memory/'));
  });
});
