import { execFile as execFileCallback } from 'node:child_process';
import {
  lstat as defaultLstat,
  readFile as defaultReadFile,
  stat as defaultStat,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFileCallback);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..');
const PRIVATE_CONFIG_MODE = 0o600;
const EXPECTED_TAILNET_NAME = 'tanaab.dev';
const MINIMUM_ONEPASSWORD_ENVIRONMENT_CLI_VERSION = '2.33.0-beta.02';
const EXPECTED_NODE_FORMULA = 'node@24';
const EXPECTED_NODE_MAJOR_VERSION = 24;

export const REQUIRED_BREWFILE_CASKS = [
  '1password-cli@beta',
  'codex',
  'codex-app',
  'openclaw',
  'tailscale',
];
export const REQUIRED_BREWFILE_FORMULAS = [EXPECTED_NODE_FORMULA, 'openclaw-cli', 'ripgrep'];
export const FORBIDDEN_BREWFILE_CASKS = [
  {
    cask: '1password-cli',
    id: 'brewfile_cask_1password_cli_stable_absent',
  },
];
export const REQUIRED_COMMANDS = [
  'brew',
  'bun',
  'codex',
  'git',
  'gh',
  'node',
  'op',
  'openclaw',
  'rg',
  'stow',
  'tailscale',
];
export const ONEPASSWORD_TOKEN_ENV_KEYS = [
  'EMORI_OP_TOKEN',
  'TANAAB_OP_TOKEN',
  'OP_SERVICE_ACCOUNT_TOKEN',
  'OP_CONNECT_TOKEN',
  'OP_SESSION',
];
export const CHECK_BUCKET_ORDER = Object.freeze([
  'homebrew',
  'packages',
  'dotfiles',
  'manual_apps',
  'codex_plugins',
]);

const DOTFILE_LINKS = [
  {
    id: 'zshrc_link',
    relativePath: ['.zshrc'],
    label: '~/.zshrc',
    remediation:
      'Rerun https://emori.boot.tanaab.sh or restow the zsh dotpkg from /Users/emori/tanaab/emori.',
  },
  {
    id: 'zprofile_link',
    relativePath: ['.zprofile'],
    label: '~/.zprofile',
    remediation:
      'Rerun https://emori.boot.tanaab.sh or restow the zsh dotpkg from /Users/emori/tanaab/emori.',
  },
  {
    id: 'codex_agents_link',
    relativePath: ['.codex', 'AGENTS.md'],
    label: '~/.codex/AGENTS.md',
  },
  {
    id: 'codex_shared_config_link',
    relativePath: ['.codex', 'config.shared.toml'],
    label: '~/.codex/config.shared.toml',
  },
];

const CODEX_PLUGIN_LINKS = [
  {
    id: 'codex_emori_link',
    relativePath: ['.codex', 'plugins', 'emori'],
    label: '~/.codex/plugins/emori',
  },
  {
    id: 'codex_tanaab_link',
    relativePath: ['.codex', 'plugins', 'tanaab'],
    label: '~/.codex/plugins/tanaab',
  },
];

function checkIdSegment(value) {
  return value.replace(/[^a-z0-9]+/g, '_');
}

const CHECK_BUCKET_BY_ID = new Map([
  ...REQUIRED_COMMANDS.map((command) => [
    `command_${command}`,
    command === 'brew' ? 'homebrew' : 'packages',
  ]),
  ['brewfile_readable', 'packages'],
  ...REQUIRED_BREWFILE_CASKS.map((cask) => [`brewfile_cask_${checkIdSegment(cask)}`, 'packages']),
  ...REQUIRED_BREWFILE_FORMULAS.map((formula) => [
    `brewfile_formula_${checkIdSegment(formula)}`,
    'packages',
  ]),
  ...FORBIDDEN_BREWFILE_CASKS.map(({ id }) => [id, 'packages']),
  ['onepassword_environment_cli', 'packages'],
  ['node_homebrew_path', 'packages'],
  ['node_version', 'packages'],
  ['zshrc_link', 'dotfiles'],
  ['zprofile_link', 'dotfiles'],
  ['codex_agents_link', 'dotfiles'],
  ['codex_shared_config_link', 'dotfiles'],
  ['codex_generated_config', 'dotfiles'],
  ['codex_app', 'manual_apps'],
  ['openclaw_app', 'manual_apps'],
  ['tailscale_app', 'manual_apps'],
  ['tailscale_status', 'manual_apps'],
  ['bootstrap_token_env', 'manual_apps'],
  ['codex_emori_link', 'codex_plugins'],
  ['codex_tanaab_link', 'codex_plugins'],
]);
const CHECK_STATUSES = new Set(['pass', 'warn', 'fail']);

function makeCheck({ id, message, remediation, status }) {
  const bucket = CHECK_BUCKET_BY_ID.get(id);

  if (!bucket) {
    throw new Error(`No readiness bucket assigned for check ${id}.`);
  }

  if (!CHECK_STATUSES.has(status)) {
    throw new Error(`Unsupported readiness status ${status}.`);
  }

  const check = { bucket, id, status, message };

  if (status !== 'pass') {
    check.remediation = remediation;
  }

  return check;
}

function pass(id, message) {
  return makeCheck({ id, status: 'pass', message });
}

function warn(id, message, remediation) {
  return makeCheck({ id, status: 'warn', message, remediation });
}

function fail(id, message, remediation) {
  return makeCheck({ id, status: 'fail', message, remediation });
}

function hasCask(brewfile, cask) {
  return new RegExp(
    `^\\s*cask\\s+["']${cask.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
    'm',
  ).test(brewfile);
}

function hasFormula(brewfile, formula) {
  return new RegExp(
    `^\\s*brew\\s+["']${formula.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
    'm',
  ).test(brewfile);
}

function formatMode(mode) {
  return `0${(mode & 0o777).toString(8)}`;
}

async function defaultCommandExists(command) {
  try {
    await execFileAsync('which', [command], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function defaultExecFile(command, args, options = {}) {
  const { stdout } = await execFileAsync(command, args, {
    env: options.env ?? process.env,
    maxBuffer: 1024 * 1024,
    timeout: options.timeout ?? 10000,
  });

  return { stdout };
}

function formatErrorDetail(error) {
  const stderr = typeof error?.stderr === 'string' ? error.stderr : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (stderr || message).replace(/\s+/g, ' ').trim();
}

function formatTailscaleCommandError(error) {
  const detail = formatErrorDetail(error);

  if (/failed to connect to local Tailscaled|local tailscaled|tailscaled process/i.test(detail)) {
    return {
      message: 'Tailscale CLI could not connect to the local Tailscale service from this process.',
      remediation:
        'If this was a sandboxed run and tailscale status --json works in your terminal, rerun the readiness helper with unsandboxed local access from Codex. Otherwise open Tailscale, sign in, and connect this machine to the tanaab.dev tailnet.',
    };
  }

  return {
    message: 'Tailscale status check failed.',
    remediation:
      'Open Tailscale, sign in, connect this machine to the tanaab.dev tailnet, then rerun tailscale status --json.',
  };
}

async function pathInfo(targetPath, deps) {
  try {
    return await deps.lstat(targetPath);
  } catch {
    return null;
  }
}

function onePasswordTokenEnvKeys(env) {
  return Object.keys(env).filter(
    (key) => ONEPASSWORD_TOKEN_ENV_KEYS.includes(key) || key.startsWith('OP_SESSION_'),
  );
}

function commandEnvWithoutOnePasswordTokenFallbacks(env) {
  const commandEnv = { ...env };

  for (const key of onePasswordTokenEnvKeys(env)) {
    delete commandEnv[key];
  }

  return commandEnv;
}

async function commandCheck(command, deps) {
  return (await deps.commandExists(command))
    ? pass(`command_${command}`, `Command "${command}" is available.`)
    : fail(
        `command_${command}`,
        `Command "${command}" is not available on PATH.`,
        'Rerun https://emori.boot.tanaab.sh or install the missing Brewfile dependency.',
      );
}

function getCheck(checks, id) {
  return checks.find((check) => check.id === id);
}

function checkTailscaleStatus(status) {
  if (!status || typeof status !== 'object') {
    return fail(
      'tailscale_status',
      'Tailscale status output was not a JSON object.',
      'Open Tailscale, sign in, connect this machine to the tanaab.dev tailnet, then rerun tailscale status --json.',
    );
  }

  const issues = [];
  const tailscaleIps = Array.isArray(status.TailscaleIPs) ? status.TailscaleIPs : [];
  const tailnetName = status.CurrentTailnet?.Name;

  if (status.BackendState !== 'Running') {
    issues.push(`BackendState is "${String(status.BackendState ?? 'missing')}"`);
  }

  if (status.Self?.Online !== true) {
    issues.push('local node is not online');
  }

  if (status.Self?.InNetworkMap !== true) {
    issues.push('local node is not in the network map');
  }

  if (tailscaleIps.length === 0) {
    issues.push('no Tailscale IPs are assigned');
  }

  if (tailnetName !== EXPECTED_TAILNET_NAME) {
    issues.push(`CurrentTailnet.Name is "${String(tailnetName ?? 'missing')}"`);
  }

  return issues.length === 0
    ? pass('tailscale_status', `Tailscale is running on the ${EXPECTED_TAILNET_NAME} tailnet.`)
    : fail(
        'tailscale_status',
        `Tailscale is not ready: ${issues.join('; ')}.`,
        'Open Tailscale, sign in, connect this machine to the tanaab.dev tailnet, then rerun tailscale status --json.',
      );
}

async function appendStowedLinkChecks(checks, links, homeDir, deps) {
  for (const link of links) {
    const targetPath = path.join(homeDir, ...link.relativePath);
    const info = await pathInfo(targetPath, deps);
    const remediation =
      link.remediation ??
      'Run bun run ai:sync from /Users/emori/tanaab/emori to restow the Codex dotfiles.';

    if (!info) {
      checks.push(fail(link.id, `${link.label} is missing.`, remediation));
      continue;
    }

    checks.push(
      info.isSymbolicLink()
        ? pass(link.id, `${link.label} exists as a stowed link.`)
        : warn(link.id, `${link.label} exists but is not a symbolic link.`, remediation),
    );
  }
}

async function appendGeneratedConfigCheck(checks, homeDir, deps) {
  const generatedConfigPath = path.join(homeDir, '.codex', 'config.toml');

  try {
    const configStat = await deps.stat(generatedConfigPath);
    const mode = configStat.mode & 0o777;

    checks.push(
      mode === PRIVATE_CONFIG_MODE
        ? pass('codex_generated_config', '~/.codex/config.toml exists with private permissions.')
        : warn(
            'codex_generated_config',
            `~/.codex/config.toml exists with mode ${formatMode(configStat.mode)}, expected 0600.`,
            'Run bun run ai:sync from /Users/emori/tanaab/emori to regenerate Codex config with private permissions.',
          ),
    );
  } catch {
    checks.push(
      fail(
        'codex_generated_config',
        '~/.codex/config.toml is missing.',
        'Run bun run ai:sync from /Users/emori/tanaab/emori to generate Codex config.',
      ),
    );
  }
}

async function appendBrewfileChecks(checks, repoRoot, deps) {
  const brewfilePath = path.join(repoRoot, 'Brewfile');
  let brewfile = '';

  try {
    brewfile = await deps.readFile(brewfilePath, 'utf8');
  } catch {
    checks.push(
      fail(
        'brewfile_readable',
        `Brewfile was not readable at ${brewfilePath}.`,
        'Run this probe from the emori checkout or rerun https://emori.boot.tanaab.sh to materialize the repo.',
      ),
    );
  }

  if (!brewfile) {
    return;
  }

  checks.push(pass('brewfile_readable', 'Brewfile is readable.'));

  for (const cask of REQUIRED_BREWFILE_CASKS) {
    checks.push(
      hasCask(brewfile, cask)
        ? pass(`brewfile_cask_${checkIdSegment(cask)}`, `Brewfile includes cask "${cask}".`)
        : fail(
            `brewfile_cask_${checkIdSegment(cask)}`,
            `Brewfile does not include cask "${cask}".`,
            'Update the Brewfile and rerun https://emori.boot.tanaab.sh or install the missing Brewfile dependency.',
          ),
    );
  }

  for (const formula of REQUIRED_BREWFILE_FORMULAS) {
    checks.push(
      hasFormula(brewfile, formula)
        ? pass(
            `brewfile_formula_${checkIdSegment(formula)}`,
            `Brewfile includes formula "${formula}".`,
          )
        : fail(
            `brewfile_formula_${checkIdSegment(formula)}`,
            `Brewfile does not include formula "${formula}".`,
            'Update the Brewfile and rerun https://emori.boot.tanaab.sh or install the missing Brewfile dependency.',
          ),
    );
  }

  for (const { cask, id } of FORBIDDEN_BREWFILE_CASKS) {
    checks.push(
      hasCask(brewfile, cask)
        ? fail(
            id,
            `Brewfile still includes conflicting cask "${cask}".`,
            'Replace cask "1password-cli" with cask "1password-cli@beta" so op supports 1Password Environments.',
          )
        : pass(id, `Brewfile does not include conflicting cask "${cask}".`),
    );
  }
}

async function appendNodeRuntimeChecks(checks, deps) {
  const brewCheck = getCheck(checks, 'command_brew');
  const nodeCheck = getCheck(checks, 'command_node');
  const formulaLabel = EXPECTED_NODE_FORMULA;
  const remediation =
    'Install node@24 from the Brewfile, ensure Homebrew shellenv loads first, and put "$(brew --prefix node@24)/bin" before other node providers on PATH.';

  if (brewCheck?.status === 'fail') {
    checks.push(
      fail(
        'node_homebrew_path',
        'Homebrew node path could not be checked because brew is missing.',
        'Install Homebrew, rerun https://emori.boot.tanaab.sh, then rerun the readiness helper.',
      ),
      fail(
        'node_version',
        'Node version could not be checked because brew is missing.',
        'Install Homebrew and node@24 from the Brewfile, then rerun the readiness helper.',
      ),
    );
    return;
  }

  if (nodeCheck?.status === 'fail') {
    checks.push(
      fail(
        'node_homebrew_path',
        'Homebrew node path could not be checked because node is missing.',
        remediation,
      ),
      fail(
        'node_version',
        'Node version could not be checked because node is missing.',
        remediation,
      ),
    );
    return;
  }

  let expectedNodePath = '';

  try {
    const { stdout } = await deps.execFile('brew', ['--prefix', formulaLabel]);
    const nodePrefix = stdout.trim();
    expectedNodePath = path.join(nodePrefix, 'bin', 'node');
  } catch {
    checks.push(
      fail(
        'node_homebrew_path',
        `Homebrew prefix for ${formulaLabel} could not be resolved.`,
        remediation,
      ),
    );
  }

  if (expectedNodePath) {
    try {
      const { stdout } = await deps.execFile('which', ['node']);
      const actualNodePath = stdout.trim();

      checks.push(
        actualNodePath === expectedNodePath
          ? pass('node_homebrew_path', `node resolves to ${formulaLabel} at ${actualNodePath}.`)
          : fail(
              'node_homebrew_path',
              `node resolves to ${actualNodePath || 'an empty path'}, expected ${expectedNodePath}.`,
              remediation,
            ),
      );
    } catch {
      checks.push(fail('node_homebrew_path', 'which node failed.', remediation));
    }
  }

  try {
    const { stdout } = await deps.execFile('node', ['--version']);
    const version = stdout.trim();
    const major = Number.parseInt(version.replace(/^v/, '').split('.')[0] ?? '', 10);

    checks.push(
      major === EXPECTED_NODE_MAJOR_VERSION
        ? pass('node_version', `node reports version ${version}.`)
        : fail(
            'node_version',
            `node reports version ${version || 'unknown'}, expected major version ${EXPECTED_NODE_MAJOR_VERSION}.`,
            remediation,
          ),
    );
  } catch {
    checks.push(fail('node_version', 'node --version failed.', remediation));
  }
}

async function appendRequiredCommandChecks(checks, deps) {
  for (const command of REQUIRED_COMMANDS.filter((requiredCommand) => requiredCommand !== 'brew')) {
    checks.push(await commandCheck(command, deps));
  }
}

async function appendAppPresenceChecks(checks, deps) {
  const codexAppPath = '/Applications/Codex.app';
  checks.push(
    (await pathInfo(codexAppPath, deps))
      ? pass('codex_app', 'Codex.app was found.')
      : fail(
          'codex_app',
          'Codex.app was not found.',
          'Rerun https://emori.boot.tanaab.sh or install the Codex desktop app from the Brewfile, then open it and complete any required sign-in.',
        ),
  );

  const openClawAppPath = '/Applications/OpenClaw.app';
  checks.push(
    (await pathInfo(openClawAppPath, deps))
      ? pass('openclaw_app', 'OpenClaw.app was found.')
      : fail(
          'openclaw_app',
          'OpenClaw.app was not found.',
          'Rerun https://emori.boot.tanaab.sh or install the OpenClaw desktop app from the Brewfile, then open it and complete onboarding.',
        ),
  );

  const tailscaleAppPath = '/Applications/Tailscale.app';
  checks.push(
    (await pathInfo(tailscaleAppPath, deps))
      ? pass('tailscale_app', 'Tailscale.app was found.')
      : fail(
          'tailscale_app',
          'Tailscale.app was not found.',
          'Rerun https://emori.boot.tanaab.sh or install the Tailscale desktop app, then open it and sign in.',
        ),
  );
}

async function appendOnePasswordEnvironmentCliCheck(checks, env, deps) {
  if (getCheck(checks, 'command_op')?.status === 'fail') {
    checks.push(
      fail(
        'onepassword_environment_cli',
        '1Password Environment CLI support could not be checked because op is missing.',
        'Install the 1Password CLI beta cask from the Brewfile, then rerun op environment read --help.',
      ),
    );
    return;
  }

  try {
    await deps.execFile('op', ['environment', 'read', '--help'], {
      env: commandEnvWithoutOnePasswordTokenFallbacks(env),
    });
    checks.push(
      pass(
        'onepassword_environment_cli',
        '1Password CLI supports reading values from 1Password Environments.',
      ),
    );
  } catch {
    checks.push(
      fail(
        'onepassword_environment_cli',
        '1Password Environment CLI support check failed.',
        `Install or update to 1Password CLI beta ${MINIMUM_ONEPASSWORD_ENVIRONMENT_CLI_VERSION} or newer through cask "1password-cli@beta".`,
      ),
    );
  }
}

async function appendTailscaleStatusCheck(checks, deps) {
  if (getCheck(checks, 'command_tailscale')?.status === 'fail') {
    checks.push(
      fail(
        'tailscale_status',
        'Tailscale status could not be checked because tailscale is missing.',
        'Install the Tailscale desktop app, sign in, connect this machine to the tanaab.dev tailnet, then rerun tailscale status --json.',
      ),
    );
    return;
  }

  try {
    const { stdout } = await deps.execFile('tailscale', ['status', '--json']);
    checks.push(checkTailscaleStatus(JSON.parse(stdout)));
  } catch (error) {
    if (error instanceof SyntaxError) {
      checks.push(
        fail(
          'tailscale_status',
          'Tailscale status output was not parseable JSON.',
          'Open Tailscale, sign in, connect this machine to the tanaab.dev tailnet, then rerun tailscale status --json.',
        ),
      );
      return;
    }

    const formattedError = formatTailscaleCommandError(error);
    checks.push(fail('tailscale_status', formattedError.message, formattedError.remediation));
  }
}

function appendTokenFallbackCheck(checks, env) {
  const presentTokenKeys = onePasswordTokenEnvKeys(env);
  checks.push(
    presentTokenKeys.length === 0
      ? pass(
          'bootstrap_token_env',
          'No 1Password token fallback environment variables are present.',
        )
      : warn(
          'bootstrap_token_env',
          `1Password token fallback environment variable(s) are still set: ${presentTokenKeys.join(', ')}.`,
          'Unset 1Password token fallback environment variables so readiness does not run with persistent token material in the process environment.',
        ),
  );
}

/**
 * Runs the read-only local readiness checks and returns the stable helper report.
 *
 * @param {object} [options] Runtime overrides and test seams for filesystem, command, and env access.
 * @returns {Promise<{ok: boolean, checks: Array<object>}>} Readiness report shaped as `{ ok, checks }`.
 */
export async function checkMachine(options = {}) {
  const deps = {
    commandExists: defaultCommandExists,
    execFile: defaultExecFile,
    lstat: defaultLstat,
    readFile: defaultReadFile,
    stat: defaultStat,
    ...(options.deps ?? {}),
  };
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? os.homedir();
  const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
  const checks = [];

  checks.push(await commandCheck('brew', deps));
  await appendBrewfileChecks(checks, repoRoot, deps);
  await appendRequiredCommandChecks(checks, deps);
  await appendOnePasswordEnvironmentCliCheck(checks, env, deps);
  await appendNodeRuntimeChecks(checks, deps);
  await appendStowedLinkChecks(checks, DOTFILE_LINKS, homeDir, deps);
  await appendGeneratedConfigCheck(checks, homeDir, deps);
  await appendAppPresenceChecks(checks, deps);
  await appendTailscaleStatusCheck(checks, deps);
  appendTokenFallbackCheck(checks, env);
  await appendStowedLinkChecks(checks, CODEX_PLUGIN_LINKS, homeDir, deps);

  return {
    ok: !checks.some((check) => check.status === 'fail'),
    checks,
  };
}

export function formatReport(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}
