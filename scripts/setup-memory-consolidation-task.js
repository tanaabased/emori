#!/usr/bin/env node

import {
  applyMemoryConsolidation,
  checkMemoryConsolidation,
} from '../lib/setup/memory-consolidation.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyMemoryConsolidation,
  check: checkMemoryConsolidation,
});
