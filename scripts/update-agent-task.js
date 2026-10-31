#!/usr/bin/env bun
import runUpdateTask from '../lib/update-agent/task.js';

process.exitCode = await runUpdateTask({ argv: process.argv.slice(2), cwd: process.cwd() });
