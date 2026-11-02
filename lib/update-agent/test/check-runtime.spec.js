import assert from 'node:assert/strict';

import checkRuntime, { maintenanceBunRange } from '../utils/check-runtime.js';

describe('lib/update-agent/utils/check-runtime', () => {
  for (const version of ['1.4.2', '1.4.3', '1.4.4', '1.4.99', '1.4.2+build.1']) {
    it(`should support stable maintenance version ${version}`, () => {
      assert.equal(checkRuntime({ version }).supported, true);
    });
  }

  for (const version of [
    undefined,
    '',
    '1.4.1',
    '1.5.0',
    '2.0.0',
    '1.4.2-beta.1',
    '1.4.4-canary.1',
    '1.5.0-beta.1',
    'invalid',
    'v1.4.2',
    '01.4.2',
    '1.4.2\n',
  ]) {
    it(`should refuse unsupported or nonstable version ${JSON.stringify(version)}`, () => {
      assert.equal(checkRuntime({ version }).supported, false);
    });
  }

  it('should retain safe observed facts without consulting the development pin', () => {
    assert.deepEqual(checkRuntime({ version: '1.4.1', executable: '/opt/Bun runtime/bin/bun' }), {
      supported: false,
      version: '1.4.1',
      required: maintenanceBunRange,
      executable: '/opt/Bun runtime/bin/bun',
    });
  });

  for (const value of [
    null,
    {},
    'x'.repeat(1100),
    'secret\n- injected',
    '`markup`',
    '\u001b[31m',
  ]) {
    it(`should omit unsafe runtime facts ${JSON.stringify(value).slice(0, 60)}`, () => {
      const result = checkRuntime({ version: value, executable: value });
      assert.equal(result.supported, false);
      assert.equal(result.version, 'unavailable');
      assert.equal(result.executable, undefined);
    });
  }

  it('should omit relative or markup-breaking executable identities', () => {
    for (const executable of ['bun', '/tmp/`secret`/bun', '/tmp/bun\n- injected'])
      assert.equal(checkRuntime({ executable }).executable, undefined);
  });
});
