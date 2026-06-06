#!/usr/bin/env bun

import { spawn } from 'node:child_process';
import { access, lstat, readdir, readlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  REPO_ROOT,
  booleanFromEnv,
  commonTanaabEnvironmentVariables,
  createCli,
  extractCommonFlags,
} from '../lib/bun-cli-support.js';
import { syncCodexConfig } from '../lib/codex-config-sync.js';

const CLI_NAME = 'aisync';

const cli = createCli(import.meta.url);

function buildEnvironment() {
  const target = process.env.TANAAB_STOW_TARGET?.trim() || os.homedir();
  const codexDir = path.join(target, '.codex');

  return {
    codexConfigLocal:
      process.env.TANAAB_CODEX_CONFIG_LOCAL?.trim() || path.join(codexDir, 'config.local.toml'),
    codexConfigOutput:
      process.env.TANAAB_CODEX_CONFIG_OUTPUT?.trim() || path.join(codexDir, 'config.toml'),
    codexConfigShared:
      process.env.TANAAB_CODEX_CONFIG_SHARED?.trim() || path.join(codexDir, 'config.shared.toml'),
    codexConfigSync: booleanFromEnv(process.env.TANAAB_CODEX_CONFIG_SYNC, true),
    dotfilesDir: process.env.TANAAB_STOW_DOTFILES_DIR?.trim() || path.join(REPO_ROOT, 'dotfiles'),
    packageName: process.env.TANAAB_STOW_PACKAGE?.trim() || 'ai',
    prune: booleanFromEnv(process.env.TANAAB_STOW_PRUNE, true),
    simulate: booleanFromEnv(process.env.TANAAB_STOW_SIMULATE, false),
    target,
  };
}

function buildEnvironmentVariables() {
  return [
    ...commonTanaabEnvironmentVariables(),
    { label: 'TANAAB_STOW_TARGET', description: 'target home directory' },
    { label: 'TANAAB_STOW_DOTFILES_DIR', description: 'stow directory containing the ai package' },
    { label: 'TANAAB_STOW_PACKAGE', description: 'stow package name' },
    {
      label: 'TANAAB_STOW_SIMULATE',
      description: 'set to a truthy value to simulate the stow run',
    },
    {
      label: 'TANAAB_STOW_PRUNE',
      description: 'set to a truthy value to prune dangling links after restow',
    },
    {
      label: 'TANAAB_CODEX_CONFIG_SYNC',
      description: 'set to a falsey value to skip generated Codex config sync',
    },
    {
      label: 'TANAAB_CODEX_CONFIG_SHARED',
      description: 'portable shared Codex config fragment',
    },
    {
      label: 'TANAAB_CODEX_CONFIG_LOCAL',
      description: 'machine-local Codex config fragment',
    },
    {
      label: 'TANAAB_CODEX_CONFIG_OUTPUT',
      description: 'generated Codex config output path',
    },
  ];
}

function usage(code = 0) {
  const environment = buildEnvironment();

  cli.showHelp(
    {
      description:
        "Restow the repo's ai dot package into a target home directory and prune dangling skill links.",
      environmentVariables: buildEnvironmentVariables(),
      options: [
        {
          label: '--target <path>',
          description: `target home directory ${cli.dim(`[default: ${environment.target}]`)}`,
        },
        {
          label: '--dotfiles-dir <path>',
          description: `stow dir containing the ai package ${cli.dim(`[default: ${environment.dotfilesDir}]`)}`,
        },
        {
          label: '--package <name>',
          description: `stow package name ${cli.dim(`[default: ${environment.packageName}]`)}`,
        },
        {
          label: '--simulate',
          description: `print the stow plan without writing changes ${cli.dim(`[default: ${environment.simulate ? 'on' : 'off'}]`)}`,
        },
        {
          label: '--no-prune',
          description: `skip dangling skill-link cleanup after restow ${cli.dim(`[default: ${environment.prune ? 'off' : 'on'}]`)}`,
        },
        {
          label: '--no-codex-config',
          description: `skip generated Codex config sync ${cli.dim(`[default: ${environment.codexConfigSync ? 'off' : 'on'}]`)}`,
        },
        {
          label: '--codex-config-shared <path>',
          description: `portable shared Codex config fragment ${cli.dim(`[default: ${environment.codexConfigShared}]`)}`,
        },
        {
          label: '--codex-config-local <path>',
          description: `machine-local Codex config fragment ${cli.dim(`[default: ${environment.codexConfigLocal}]`)}`,
        },
        {
          label: '--codex-config-output <path>',
          description: `generated Codex config output path ${cli.dim(`[default: ${environment.codexConfigOutput}]`)}`,
        },
        { label: '--debug', description: 'show debug diagnostics' },
        { label: '-h, --help', description: 'show this message' },
        { label: '-V, --version', description: 'show the CLI version' },
      ],
      usage: `${cli.bold(CLI_NAME)} ${cli.dim('[options]')}`,
    },
    code,
  );
}

function parseArgs(argv) {
  const parsed = { ...buildEnvironment() };
  const explicitCodexConfigPaths = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      usage(0);
    }

    if (arg === '--simulate') {
      parsed.simulate = true;
      continue;
    }

    if (arg === '--no-prune') {
      parsed.prune = false;
      continue;
    }

    if (arg === '--no-codex-config') {
      parsed.codexConfigSync = false;
      continue;
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
    if (['codexConfigShared', 'codexConfigLocal', 'codexConfigOutput'].includes(key)) {
      explicitCodexConfigPaths.add(key);
    }
    index += 1;
  }

  parsed.dotfilesDir = path.resolve(parsed.dotfilesDir);
  parsed.target = path.resolve(parsed.target);
  const codexDir = path.join(parsed.target, '.codex');
  if (!explicitCodexConfigPaths.has('codexConfigShared')) {
    parsed.codexConfigShared = path.join(codexDir, 'config.shared.toml');
  }
  if (!explicitCodexConfigPaths.has('codexConfigLocal')) {
    parsed.codexConfigLocal = path.join(codexDir, 'config.local.toml');
  }
  if (!explicitCodexConfigPaths.has('codexConfigOutput')) {
    parsed.codexConfigOutput = path.join(codexDir, 'config.toml');
  }
  parsed.codexConfigShared = path.resolve(parsed.codexConfigShared);
  parsed.codexConfigLocal = path.resolve(parsed.codexConfigLocal);
  parsed.codexConfigOutput = path.resolve(parsed.codexConfigOutput);
  return parsed;
}

function runStow(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('stow', args, { stdio: 'inherit' });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`stow exited with status ${code}`));
    });
  });
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function pruneDanglingSymlinks(rootPath) {
  if (!(await pathExists(rootPath))) {
    return { removedDirs: 0, removedLinks: 0 };
  }

  const stat = await lstat(rootPath);
  if (!stat.isDirectory()) {
    return { removedDirs: 0, removedLinks: 0 };
  }

  const counters = { removedDirs: 0, removedLinks: 0 };

  async function visit(currentPath, preserveCurrent) {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isSymbolicLink()) {
        if (await pathExists(entryPath)) {
          continue;
        }

        await rm(entryPath, { force: true });
        counters.removedLinks += 1;
        continue;
      }

      if (entry.isDirectory()) {
        await visit(entryPath, false);
      }
    }

    if (preserveCurrent) {
      return;
    }

    const remainingEntries = await readdir(currentPath);
    if (remainingEntries.length === 0) {
      await rm(currentPath, { recursive: true, force: true });
      counters.removedDirs += 1;
    }
  }

  await visit(rootPath, true);
  return counters;
}

async function summarizePath(targetPath) {
  try {
    const stat = await lstat(targetPath);
    if (stat.isSymbolicLink()) {
      return `${targetPath} -> ${await readlink(targetPath)}`;
    }

    if (stat.isDirectory()) {
      const entries = await readdir(targetPath);
      return `${targetPath} [dir, ${entries.length} entries]`;
    }

    return `${targetPath} [file]`;
  } catch {
    return `${targetPath} [missing]`;
  }
}

async function main() {
  const { argv, flags } = extractCommonFlags(process.argv.slice(2));

  if (flags.debug) {
    cli.enableDebug();
  }

  if (flags.help) {
    usage(0);
  }

  if (flags.version) {
    cli.showVersion();
    return;
  }

  const options = parseArgs(argv);
  cli.debug('resolved options %O', options);
  const stowArgs = [
    '--dir',
    options.dotfilesDir,
    '--target',
    options.target,
    '--restow',
    '--no-folding',
  ];

  if (options.simulate) {
    stowArgs.push('--simulate');
  }

  stowArgs.push(options.packageName);

  cli.log(
    '%s %s via stow into %s',
    cli.tp('syncing'),
    cli.ts(options.packageName),
    cli.ts(options.target),
  );
  cli.debug('running stow with args %O', stowArgs);
  await runStow(stowArgs);

  if (options.simulate) {
    cli.note('completed simulated stow run');
    return;
  }

  if (options.prune) {
    const skillRoots = [
      path.join(options.target, '.codex', 'skills'),
      path.join(options.target, '.openclaw', 'skills'),
    ];

    let removedLinks = 0;
    let removedDirs = 0;

    for (const skillRoot of skillRoots) {
      const counters = await pruneDanglingSymlinks(skillRoot);
      removedLinks += counters.removedLinks;
      removedDirs += counters.removedDirs;
    }

    cli.success(
      '%s %s dangling skill links and %s empty directories',
      cli.tp('pruned'),
      cli.ts(String(removedLinks)),
      cli.ts(String(removedDirs)),
    );
  }

  if (options.codexConfigSync) {
    const result = await syncCodexConfig({
      localPath: options.codexConfigLocal,
      outputPath: options.codexConfigOutput,
      sharedPath: options.codexConfigShared,
    });

    if (result.migratedLocal) {
      cli.note('migrated existing Codex config to %s', cli.ts(result.localPath));
    }

    cli.success('generated Codex config at %s', cli.ts(result.outputPath));
  } else {
    cli.note('skipped generated Codex config sync');
  }

  const summaries = await Promise.all([
    summarizePath(path.join(options.target, '.codex', 'skills')),
    summarizePath(path.join(options.target, '.openclaw', 'skills')),
    summarizePath(options.codexConfigOutput),
  ]);

  cli.log(summaries.join('\n'));
}

main().catch((error) => {
  cli.error(error instanceof Error ? error.message : String(error));
  usage(1);
});
