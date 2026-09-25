#!/usr/bin/env node

import { applyExecutionPolicy, checkExecutionPolicy } from '../lib/setup/execution-policy.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyExecutionPolicy,
  check: checkExecutionPolicy,
});
