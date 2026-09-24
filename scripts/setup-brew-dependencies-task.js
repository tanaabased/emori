#!/usr/bin/env node

import { applyBrewDependencies, checkBrewDependencies } from '../lib/setup/brew-dependencies.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyBrewDependencies,
  check: checkBrewDependencies,
});
