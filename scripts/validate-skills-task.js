import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  formatValidationReport,
  validateSkillDir,
} from '../skills/skill-author/lib/skill-validator.js';

const root = new URL('../skills/', import.meta.url);
const directories = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name));

for (const { name } of directories) {
  const result = await validateSkillDir(fileURLToPath(new URL(`${name}/`, root)));
  process.stdout.write(`${formatValidationReport(result)}\n`);
  if (result.errors.length) process.exitCode = 1;
}
