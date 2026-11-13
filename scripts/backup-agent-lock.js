import { spawnSync } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import openStorage from '../lib/backup/storage.js';

// Only exclusion stays in JS: macOS has no stock flock command. Children inherit the lock.
let storage;
try {
  storage = await openStorage(await realpath(process.cwd()));
  const result = spawnSync(
    'bash',
    [fileURLToPath(new URL('./backup-agent.sh', import.meta.url)), '--locked'],
    { stdio: ['inherit', 'inherit', 'inherit', storage.lockFd] },
  );
  process.exitCode = result.status ?? 1;
} catch {
  process.stderr.write('backup failed: could not acquire backup/update exclusion\n');
  process.exitCode = 1;
} finally {
  await storage?.close();
}
