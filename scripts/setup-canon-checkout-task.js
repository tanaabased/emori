#!/usr/bin/env node

import { applyCanonCheckout, checkCanonCheckout } from '../lib/setup/canon-checkout.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyCanonCheckout,
  check: checkCanonCheckout,
});
