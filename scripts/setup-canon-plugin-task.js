#!/usr/bin/env node

import { applyCanonPlugin, checkCanonPlugin } from '../lib/setup/canon-plugin.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyCanonPlugin,
  check: checkCanonPlugin,
});
