#!/usr/bin/env node

import { applyMemoryRecall, checkMemoryRecall } from '../lib/setup/memory-recall.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyMemoryRecall,
  check: checkMemoryRecall,
});
