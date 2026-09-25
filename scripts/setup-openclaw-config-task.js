#!/usr/bin/env node

import { applyOpenClawConfig, checkOpenClawConfig } from '../lib/setup/openclaw-config.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyOpenClawConfig,
  check: checkOpenClawConfig,
});
