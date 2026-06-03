#!/usr/bin/env bun
/* eslint-disable no-console */

import {
  bold,
  dim,
  formatValidationReport,
  renderCliHelp,
  validateSkillDir,
} from './skill-author-lib.js';

function usage(code = 0) {
  console.log(
    renderCliHelp({
      usage: `Usage: ${bold('validate-skill.js')} ${dim('--skill-dir <path> [options]')}`,
      summary:
        'Validate a canon skill directory against references/skill-standard.md and the canonical local full templates owned by emori-skill-author.',
      options: [
        '  --skill-dir <path>      skill directory to validate',
        '  --type <type>           expected type override',
        '  -h, --help              show this message',
      ],
    }),
  );
  process.exit(code);
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '-h' || arg === '--help') {
      usage(0);
    }

    if (!arg.startsWith('--')) {
      throw new Error(`Positional arguments are not supported: ${arg}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }

    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const skillDir = String(options.skillDir ?? '').trim();

  if (!skillDir) {
    throw new Error('Skill directory is required.');
  }

  const result = await validateSkillDir(skillDir, {
    expectedType: options.type,
  });

  console.log(formatValidationReport(result));
  process.exit(result.errors.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  usage(1);
});
