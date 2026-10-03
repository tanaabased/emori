#!/usr/bin/env node

import { applyWorkspaceMemory, checkWorkspaceMemory } from '../lib/setup/workspace-memory.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyWorkspaceMemory,
  check: checkWorkspaceMemory,
});
