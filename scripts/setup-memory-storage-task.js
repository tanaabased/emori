#!/usr/bin/env node

import { applyMemoryStorage, checkMemoryStorage } from '../lib/setup/memory-storage.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyMemoryStorage,
  check: checkMemoryStorage,
});
