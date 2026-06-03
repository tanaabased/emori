#!/usr/bin/env bun

import { fileURLToPath } from 'node:url';

import { checkMachine, formatReport } from './check-machine-lib.js';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await checkMachine();
  process.stdout.write(formatReport(report));
  process.exitCode = report.ok ? 0 : 1;
}
