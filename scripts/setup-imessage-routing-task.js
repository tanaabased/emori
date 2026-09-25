#!/usr/bin/env node

import { applyImessageRouting, checkImessageRouting } from '../lib/setup/imessage-routing.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyImessageRouting,
  check: checkImessageRouting,
});
