import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const task = fileURLToPath(new URL('../scripts/setup-codex-plugin-task.js', import.meta.url));
const missing = {
  ok: false,
  error: {
    type: 'cli_error',
    message: 'Plugin not found: codex. Run `openclaw plugins list` to see installed plugins.',
  },
};

describe('lib/setup/plugin', () => {
  let directory;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'emori-plugin-inspection-'));
    writeFileSync(
      join(directory, 'openclaw'),
      `#!/bin/sh
printf '%s\\n' "$*" >> "$EMORI_TEST_CALLS"
if [ "$2" = inspect ]; then
  /bin/cat "$EMORI_TEST_RESPONSE"
  exit "$EMORI_TEST_STATUS"
fi
`,
      { mode: 0o700 },
    );
  });

  afterEach(() => rmSync(directory, { force: true, recursive: true }));

  function execute(mode, status, response) {
    const responsePath = join(directory, 'response.json');
    const callsPath = join(directory, 'calls');
    writeFileSync(responsePath, typeof response === 'string' ? response : JSON.stringify(response));
    writeFileSync(callsPath, '');
    const result = spawnSync(process.execPath, [task, mode], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: directory,
        EMORI_TEST_CALLS: callsPath,
        EMORI_TEST_RESPONSE: responsePath,
        EMORI_TEST_STATUS: String(status),
      },
    });
    assert.ifError(result.error);
    return { ...result, calls: readFileSync(callsPath, 'utf8').trim().split('\n') };
  }

  it('should report an inspected healthy plugin as converged', () => {
    const result = execute('check', 0, {
      plugin: { id: 'codex', enabled: true, status: 'loaded' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, ['plugins inspect codex --json']);
  });

  it('should install only after an explicit missing-plugin response', () => {
    assert.equal(execute('check', 1, missing).status, 1);
    const result = execute('apply', 1, missing);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, [
      'plugins inspect codex --json',
      'plugins install clawhub:@openclaw/codex --accept-capabilities --acknowledge-install-policy-warning',
      'plugins enable codex --accept-capabilities',
    ]);
  });

  it('should block checks and applies when inspection fails or returns an invalid result', () => {
    const failures = [
      [1, { ok: false, error: { type: 'cli_error', message: 'Invalid configuration.' } }],
      [2, missing],
      [
        1,
        { ...missing, error: { ...missing.error, message: 'Plugin not found: other. Run help.' } },
      ],
      [1, 'not JSON'],
      [0, 'not JSON'],
      [0, null],
      [0, { plugin: { id: 'other' } }],
    ];
    for (const [status, response] of failures) {
      for (const mode of ['check', 'apply']) {
        const result = execute(mode, status, response);
        assert.equal(result.status, 2, `${mode}: ${JSON.stringify(response)}\n${result.stderr}`);
        assert.deepEqual(result.calls, ['plugins inspect codex --json']);
        assert.match(result.stderr, /could not inspect plugin codex|returned invalid JSON/u);
      }
    }
  });
});
