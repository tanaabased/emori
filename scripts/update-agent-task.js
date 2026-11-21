#!/usr/bin/env bun
// Keep previously installed schedules working until the manifest is reapplied.
import { fileURLToPath } from 'node:url';

import { spawn } from 'bun';

const script = fileURLToPath(new URL('./update-agent.sh', import.meta.url));
const child = spawn(['bash', script], { stdout: 'inherit', stderr: 'inherit' });
process.once('SIGTERM', () => child.kill('SIGTERM'));
process.once('SIGINT', () => child.kill('SIGINT'));
process.exitCode = await child.exited;
