#!/usr/bin/env bun

import path from 'node:path';

import { REPO_ROOT, createCli, extractCommonFlags } from '../lib/bun-cli-support.js';
import { runCodexSyncCheck } from '../lib/codexsync-check.js';
import { MANAGED_PATHS, resolveCodexSyncContext } from '../lib/codexsync-context.js';
import { runCodexSyncSync } from '../lib/codexsync-sync.js';
import { runCodexSyncValidate } from '../lib/codexsync-validate.js';

const CLI_NAME = 'codexsync';
const DEFAULT_REPO_ROOT = REPO_ROOT;
const COMMANDS = new Set(['check', 'validate', 'sync']);

const cli = createCli(import.meta.url);

function resolveArgValue(arg, key) {
  if (arg === key) {
    return null;
  }

  if (arg.startsWith(`${key}=`)) {
    return arg.slice(`${key}=`.length);
  }

  return undefined;
}

function parseArgs(argv) {
  const options = {
    cachePath: null,
    repoRoot: DEFAULT_REPO_ROOT,
  };
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    const repoRootValue = resolveArgValue(arg, '--repo-root');
    if (repoRootValue !== undefined) {
      const value = repoRootValue ?? argv[++index];
      if (!value) {
        throw new Error('Missing value for --repo-root.');
      }

      options.repoRoot = path.resolve(value);
      continue;
    }

    const cachePathValue = resolveArgValue(arg, '--cache-path');
    if (cachePathValue !== undefined) {
      const value = cachePathValue ?? argv[++index];
      if (!value) {
        throw new Error('Missing value for --cache-path.');
      }

      options.cachePath = path.resolve(value);
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positionals.push(arg);
  }

  const [command = null, ...extraPositionals] = positionals;
  return { command, extraPositionals, options };
}

function setFailure(message, ...args) {
  cli.error(message, ...args);
  process.exitCode = 1;
}

function renderHelp({ cachePath, repoRoot }) {
  return cli.renderHelp({
    description: 'Validate Codex plugin inputs and compare or refresh the plugin-owned cache copy.',
    options: [
      {
        label: '--repo-root <path>',
        description: `repo root to compare from ${cli.dim(`[default: ${repoRoot}]`)}`,
      },
      {
        label: '--cache-path <path>',
        description: `cache copy to compare or sync; ignored by validate ${cli.dim(`[default: ${cachePath}]`)}`,
      },
      { label: '--debug', description: 'show debug diagnostics' },
      { label: '-h, --help', description: 'show this message' },
      {
        label: '-V, --version',
        description: 'show the CLI version',
      },
    ],
    sections: [
      {
        heading: 'Commands',
        entries: [
          { label: 'check', description: 'report drift for plugin-managed cache paths only' },
          {
            label: 'validate',
            description:
              'validate plugin manifest, skills, MCP stub, starter prompts, and workflow scripts',
          },
          { label: 'sync', description: 'refresh the managed cache paths from the repo source' },
        ],
      },
      {
        heading: 'Managed Paths',
        lines: MANAGED_PATHS.map((managedPath) => `  ${managedPath}`),
      },
    ],
    usage: `${cli.bold(CLI_NAME)} <check|validate|sync> ${cli.dim('[options]')}`,
  });
}

async function dispatchCommand(command, context) {
  const commandContext = { ...context, cli };

  let result;
  if (command === 'check') {
    result = await runCodexSyncCheck(commandContext);
  } else if (command === 'validate') {
    result = await runCodexSyncValidate(commandContext);
  } else if (command === 'sync') {
    result = await runCodexSyncSync(commandContext);
  }

  if (result && !result.ok) {
    process.exitCode = 1;
  }
}

async function main() {
  const { argv, flags } = extractCommonFlags(process.argv.slice(2));

  if (flags.debug) {
    cli.enableDebug();
  }

  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    setFailure(error instanceof Error ? error.message : String(error));
    cli.log('');
    const context = await resolveCodexSyncContext({ repoRoot: DEFAULT_REPO_ROOT });
    cli.log(renderHelp(context));
    return;
  }

  const context = await resolveCodexSyncContext({
    cachePathOverride: parsed.options.cachePath,
    repoRoot: parsed.options.repoRoot,
  });

  if (flags.help) {
    cli.log(renderHelp(context));
    return;
  }

  if (flags.version) {
    cli.showVersion();
    return;
  }

  if (!parsed.command) {
    setFailure(
      `expected a command (${cli.ts('check')}, ${cli.ts('validate')}, or ${cli.ts('sync')})`,
    );
    cli.log('');
    cli.log(renderHelp(context));
    return;
  }

  if (parsed.extraPositionals.length > 0) {
    setFailure(`unexpected positional arguments: ${parsed.extraPositionals.join(', ')}`);
    return;
  }

  if (!COMMANDS.has(parsed.command)) {
    setFailure(`unknown command: ${parsed.command}`);
    return;
  }

  await dispatchCommand(parsed.command, context);
}

main().catch((error) => {
  cli.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
