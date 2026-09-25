#!/usr/bin/env node

import { applyMessagingPolicy, checkMessagingPolicy } from '../lib/setup/messaging-policy.js';
import runSetupTask from '../lib/setup/task.js';

process.exitCode = runSetupTask(process.argv[2], {
  apply: applyMessagingPolicy,
  check: checkMessagingPolicy,
});
