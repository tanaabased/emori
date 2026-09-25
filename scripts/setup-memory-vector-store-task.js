#!/usr/bin/env node

import {
  applyMemoryVectorStore,
  checkMemoryVectorStore,
} from '../lib/setup/memory-vector-store.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyMemoryVectorStore,
  check: checkMemoryVectorStore,
});
