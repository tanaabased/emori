#!/usr/bin/env bun
import runBackupTask from '../lib/backup/task.js';

process.exitCode = await runBackupTask({ argv: process.argv.slice(2), cwd: process.cwd() });
