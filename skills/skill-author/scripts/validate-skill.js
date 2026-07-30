#!/usr/bin/env bun
/* eslint-disable no-console */

import { bold, dim, renderCliHelp } from '../lib/skill-author.js';
import { formatValidationReport, validateSkillDir } from '../lib/skill-validator.js';
import parseValidateSkillArgs from '../utils/parse-validate-skill-args.js';

function usage(code = 0) {
  console.log(
    renderCliHelp({
      usage: `Usage: ${bold('validate-skill.js')} ${dim('--skill-dir <path> [options]')}`,
      summary:
        'Validate an EMORI-local skill against the workspace standard and local full templates.',
      options: [
        '  --skill-dir <path>      skill directory to validate',
        '  --type <type>           expected type override',
        '  -h, --help              show this message',
      ],
    }),
  );
  process.exit(code);
}

async function main() {
  const options = parseValidateSkillArgs(process.argv.slice(2));
  if (options.help) {
    usage(0);
  }

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
