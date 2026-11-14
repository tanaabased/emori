import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  buildOpenClawConfigPatch,
  loadOpenClawConfigFragment,
  sqliteVectorExtensionPath,
} from '../openclaw-config.js';

const describePlatform = process.platform === 'darwin' ? describe : describe.skip;

describePlatform('lib/setup/openclaw-config check component', () => {
  let directory;
  let config;
  let vectorExtensionPath;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'emori-config-check-'));
    vectorExtensionPath = sqliteVectorExtensionPath(directory);
    mkdirSync(dirname(vectorExtensionPath), { recursive: true });
    writeFileSync(vectorExtensionPath, 'fixture');
    config = buildOpenClawConfigPatch(
      loadOpenClawConfigFragment(),
      {},
      {
        home: directory,
        canonPath: join(directory, 'tanaab/canon'),
        vectorExtensionPath,
      },
    );
    delete config.agents.entries.emori.tools.message.crossContext;
    writeFileSync(
      join(directory, 'npm'),
      `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(directory)});\n`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(directory, 'openclaw'),
      `#!${process.execPath}
import { readFileSync } from 'node:fs';
const [command, operation, section] = process.argv.slice(2);
if (command !== 'config' || operation !== 'get') process.exit(99);
const config = JSON.parse(readFileSync(${JSON.stringify(join(directory, 'config.json'))}, 'utf8'));
process.stdout.write(JSON.stringify(config[section] ?? {}));
`,
      { mode: 0o755 },
    );
  });

  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  function check() {
    writeFileSync(join(directory, 'config.json'), JSON.stringify(config));
    return spawnSync(process.execPath, ['scripts/setup-openclaw-config-task.js', 'check'], {
      encoding: 'utf8',
      env: { ...process.env, HOME: directory, PATH: `${directory}:${process.env.PATH}` },
    });
  }

  it('should accept converged configuration without memory, hook, or Doctor runtime probes', () => {
    const result = check();
    assert.equal(result.status, 0, result.stderr);
  });

  for (const [label, change] of [
    [
      'sources',
      (search) => {
        search.sources = ['memory'];
      },
    ],
    [
      'vector enablement',
      (search) => {
        search.store.vector.enabled = false;
      },
    ],
    [
      'vector path',
      (search) => {
        search.store.vector.extensionPath = '/missing/vec0.dylib';
      },
    ],
  ]) {
    it(`should reject drift in configured ${label}`, () => {
      change(config.agents.entries.emori.memory.search);
      assert.equal(check().status, 1);
    });
  }

  it('should reject an enabled legacy hook', () => {
    config.hooks.internal.entries['session-memory'].enabled = true;
    assert.equal(check().status, 1);
  });

  it('should reject an unavailable vector extension prerequisite', () => {
    unlinkSync(vectorExtensionPath);
    const result = check();
    assert.equal(result.status, 2);
    assert.match(result.stderr, /SQLite vector extension is unavailable/u);
  });
});
