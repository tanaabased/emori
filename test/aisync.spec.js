import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AISYNC_BIN = path.join(REPO_ROOT, 'bin', 'aisync.js');
const EMORI_ENV_KEYS = [
  'EMORI_CODEX_CONFIG_LOCAL',
  'EMORI_CODEX_CONFIG_OUTPUT',
  'EMORI_CODEX_CONFIG_SHARED',
  'EMORI_CODEX_CONFIG_SYNC',
  'EMORI_DEBUG',
  'EMORI_STOW_DOTFILES_DIR',
  'EMORI_STOW_PACKAGE',
  'EMORI_STOW_PRUNE',
  'EMORI_STOW_SIMULATE',
  'EMORI_STOW_TARGET',
];
const TANAAB_ENV_KEYS = [
  'TANAAB_CODEX_CONFIG_LOCAL',
  'TANAAB_CODEX_CONFIG_OUTPUT',
  'TANAAB_CODEX_CONFIG_SHARED',
  'TANAAB_CODEX_CONFIG_SYNC',
  'TANAAB_DEBUG',
  'TANAAB_STOW_DOTFILES_DIR',
  'TANAAB_STOW_PACKAGE',
  'TANAAB_STOW_PRUNE',
  'TANAAB_STOW_SIMULATE',
  'TANAAB_STOW_TARGET',
];

function makeEnv(overrides = {}) {
  const env = { ...process.env, NO_COLOR: '1' };

  for (const key of [...EMORI_ENV_KEYS, ...TANAAB_ENV_KEYS]) {
    delete env[key];
  }

  return { ...env, ...overrides };
}

async function aisyncHelp(env = {}) {
  const { stdout } = await execFile('bun', [AISYNC_BIN, '--help'], {
    env: makeEnv(env),
    maxBuffer: 1024 * 1024,
  });

  return stdout;
}

describe('bin/aisync', () => {
  it('should list EMORI environment variables in help output', async () => {
    const output = await aisyncHelp();

    for (const key of EMORI_ENV_KEYS) {
      assert.match(output, new RegExp(`\\b${key}\\b`), key);
    }
  });

  it('should not list legacy TANAAB environment variables in help output', async () => {
    const output = await aisyncHelp();

    for (const key of TANAAB_ENV_KEYS) {
      assert.doesNotMatch(output, new RegExp(`\\b${key}\\b`), key);
    }
  });

  it('should use EMORI environment variables for displayed defaults', async () => {
    const output = await aisyncHelp({
      EMORI_CODEX_CONFIG_LOCAL: '/tmp/emori-local.toml',
      EMORI_CODEX_CONFIG_OUTPUT: '/tmp/emori-output.toml',
      EMORI_CODEX_CONFIG_SHARED: '/tmp/emori-shared.toml',
      EMORI_CODEX_CONFIG_SYNC: '0',
      EMORI_STOW_DOTFILES_DIR: '/tmp/emori-dotfiles',
      EMORI_STOW_PACKAGE: 'custom-ai',
      EMORI_STOW_PRUNE: '0',
      EMORI_STOW_SIMULATE: '1',
      EMORI_STOW_TARGET: '/tmp/emori-home',
    });

    assert.match(output, /\[default: \/tmp\/emori-home\]/);
    assert.match(output, /\[default: \/tmp\/emori-dotfiles\]/);
    assert.match(output, /\[default: custom-ai\]/);
    assert.match(
      output,
      /--simulate\s+print the stow plan without writing changes \[default: on\]/,
    );
    assert.match(
      output,
      /--no-prune\s+skip dangling skill-link cleanup after restow \[default: on\]/,
    );
    assert.match(output, /--no-codex-config\s+skip generated Codex config sync \[default: on\]/);
    assert.match(output, /\[default: \/tmp\/emori-shared\.toml\]/);
    assert.match(output, /\[default: \/tmp\/emori-local\.toml\]/);
    assert.match(output, /\[default: \/tmp\/emori-output\.toml\]/);
  });
});
