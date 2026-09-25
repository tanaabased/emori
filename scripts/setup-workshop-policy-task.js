#!/usr/bin/env node

import { applyWorkshopPolicy, checkWorkshopPolicy } from '../lib/setup/workshop-policy.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyWorkshopPolicy,
  check: checkWorkshopPolicy,
});
