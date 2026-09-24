#!/usr/bin/env node

import { applyCodexPlugin, checkCodexPlugin } from '../lib/setup/codex-plugin.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyCodexPlugin,
  check: checkCodexPlugin,
});
