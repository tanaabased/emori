import assert from 'node:assert/strict';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyWorkspaceMemory, checkWorkspaceMemory } from '../lib/setup/workspace-memory.js';

const repository = fileURLToPath(new URL('../', import.meta.url));
const seed = '# Memory\n\nPrivate, curated notes for this agent.\n';

describe('lib/setup/workspace-memory', () => {
  let directory;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'emori-workspace-memory-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('should check without changing a fresh workspace, then initialize both paths', () => {
    assert.equal(checkWorkspaceMemory(directory), false);
    assert.deepEqual(readdirSync(directory), []);

    applyWorkspaceMemory(directory);
    assert.equal(lstatSync(join(directory, 'memory')).isDirectory(), true);
    assert.equal(lstatSync(join(directory, 'MEMORY.md')).isFile(), true);
    assert.equal(readFileSync(join(directory, 'MEMORY.md'), 'utf8'), seed);
    assert.equal(checkWorkspaceMemory(directory), true);
  });

  it('should create only the missing memory file in a partial workspace', () => {
    mkdirSync(join(directory, 'memory'));
    assert.equal(checkWorkspaceMemory(directory), false);
    applyWorkspaceMemory(directory);
    assert.equal(lstatSync(join(directory, 'memory')).isDirectory(), true);
    assert.equal(readFileSync(join(directory, 'MEMORY.md'), 'utf8'), seed);
    assert.equal(checkWorkspaceMemory(directory), true);
  });

  it('should create only the missing memory directory and preserve existing notes', () => {
    writeFileSync(join(directory, 'MEMORY.md'), 'existing notes\n');
    assert.equal(checkWorkspaceMemory(directory), false);
    applyWorkspaceMemory(directory);
    assert.equal(lstatSync(join(directory, 'memory')).isDirectory(), true);
    assert.equal(readFileSync(join(directory, 'MEMORY.md'), 'utf8'), 'existing notes\n');
    assert.equal(checkWorkspaceMemory(directory), true);
  });

  it('should preserve an intentionally empty memory file and existing daily notes', () => {
    mkdirSync(join(directory, 'memory'));
    writeFileSync(join(directory, 'memory', 'note.md'), 'keep this note\n');
    writeFileSync(join(directory, 'MEMORY.md'), '');
    applyWorkspaceMemory(directory);
    assert.equal(readFileSync(join(directory, 'MEMORY.md'), 'utf8'), '');
    assert.equal(readFileSync(join(directory, 'memory', 'note.md'), 'utf8'), 'keep this note\n');
  });

  it('should fail on a conflicting memory directory without making partial changes', () => {
    writeFileSync(join(directory, 'memory'), 'not a directory');
    assert.throws(() => applyWorkspaceMemory(directory), /conflicting type/u);
    assert.equal(readFileSync(join(directory, 'memory'), 'utf8'), 'not a directory');
    assert.deepEqual(readdirSync(directory), ['memory']);
  });

  it('should fail on a conflicting memory file without making partial changes', () => {
    mkdirSync(join(directory, 'MEMORY.md'));
    assert.throws(() => applyWorkspaceMemory(directory), /conflicting type/u);
    assert.equal(lstatSync(join(directory, 'MEMORY.md')).isDirectory(), true);
    assert.deepEqual(readdirSync(directory), ['MEMORY.md']);
  });

  it('should be safe to apply repeatedly', () => {
    applyWorkspaceMemory(directory);
    applyWorkspaceMemory(directory);
    assert.equal(checkWorkspaceMemory(directory), true);
    assert.equal(readFileSync(join(directory, 'MEMORY.md'), 'utf8'), seed);
  });
});

describe('workspace memory setup declaration', () => {
  it('should declare memory setup in the host phase', () => {
    const manifest = globalThis.Bun.YAML.parse(
      readFileSync(join(repository, '.agent-system/agent.yaml'), 'utf8'),
    );
    const hostSetup = globalThis.Bun.YAML.parse(
      readFileSync(join(repository, '.agent-system', manifest['setup-host'].file), 'utf8'),
    );
    assert.ok(hostSetup.steps.some(({ id }) => id === 'workspace-memory'));
  });
});
