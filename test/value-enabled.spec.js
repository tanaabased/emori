import assert from 'node:assert/strict';

import { valueEnabled } from '../utils/value-enabled.js';

describe('utils/value-enabled', () => {
  it('should treat empty and explicit false-like values as disabled', () => {
    for (const value of [undefined, '', ' ', '0', 'false', 'no', 'off', ' FALSE ']) {
      assert.equal(valueEnabled(value), false);
    }
  });

  it('should treat every other normalized value as enabled', () => {
    for (const value of ['1', 'true', 'yes', 'on', 'debug', ' false-ish ']) {
      assert.equal(valueEnabled(value), true);
    }
  });
});
