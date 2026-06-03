import assert from 'node:assert/strict';

import { csvDisplay } from '../utils/csv-display.js';

describe('utils/csv-display', () => {
  it('should render CSV values or a none fallback', () => {
    assert.equal(csvDisplay(['alpha', 'beta']), 'alpha,beta');
    assert.equal(csvDisplay([]), 'none');
  });
});
