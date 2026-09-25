#!/usr/bin/env node

import { applyImessagePlugin, checkImessagePlugin } from '../lib/setup/imessage-plugin.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyImessagePlugin,
  check: checkImessagePlugin,
});
