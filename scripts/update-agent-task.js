#!/usr/bin/env bun
import runUpdateTask from '../lib/update-agent/task.js';

const controller = new AbortController();
const cancel = () => controller.abort();
process.once('SIGTERM', cancel);
process.once('SIGINT', cancel);
try {
  process.exitCode = await runUpdateTask({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    signal: controller.signal,
  });
} finally {
  process.removeListener('SIGTERM', cancel);
  process.removeListener('SIGINT', cancel);
}
