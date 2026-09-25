#!/usr/bin/env node

import { applyActiveMemory, checkActiveMemory } from '../lib/setup/active-memory.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyActiveMemory,
  check: checkActiveMemory,
});
