#!/usr/bin/env bun
/* eslint-disable no-console */

import {
  CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN,
  SKILLS_ROOT_DIR,
  bold,
  dim,
  formatSkillTypeIds,
  formatValidationReport,
  renderCliHelp,
} from '../lib/skill-author.js';
import { initializeSkill } from '../lib/skill-scaffolder.js';
import parseInitSkillArgs from '../utils/parse-init-skill-args.js';

function usage(code = 0) {
  console.log(
    renderCliHelp({
      usage: `Usage: ${bold('init-skill.js')} ${dim('--type <type> --slug <slug> --display-name <name> --description <text> --emoji <emoji> [options]')}`,
      summary: 'Initialize an EMORI-local skill from the templates owned by this workspace.',
      options: [
        `  --type <type>           skill type such as ${dim(formatSkillTypeIds())}`,
        '  --category-tag <tag>    category tag override; must add one tag beyond owner and type',
        `  --slug <slug>           skill slug without the ${CANON_SKILL_MACHINE_PREFIX_WITH_HYPHEN} prefix`,
        '  --display-name <name>   human-readable skill display name',
        '  --description <text>    skill description text',
        '  --emoji <emoji>         skill-specific OpenClaw emoji',
        '  --homepage <url>        canonical HTTPS source URL; defaults to this repository skill path',
        '  --prompt <text>         default prompt for agents/openai.yaml',
        `  --output-dir <path>     parent directory for generated skills ${dim(`[default: ${SKILLS_ROOT_DIR}]`)}`,
        '  --force                 overwrite an existing generated skill directory',
        '  -h, --help              show this message',
      ],
    }),
  );
  process.exit(code);
}

async function main() {
  const options = parseInitSkillArgs(process.argv.slice(2), SKILLS_ROOT_DIR);
  if (options.help) {
    usage(0);
  }

  const { result, skillDir } = await initializeSkill(options);
  console.log(`Created skill at ${skillDir}`);
  if (result.warnings.length > 0 || result.manualChecks.length > 0) {
    console.log(formatValidationReport(result));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  usage(1);
});
