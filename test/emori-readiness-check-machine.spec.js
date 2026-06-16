import assert from 'node:assert/strict';
import path from 'node:path';

import {
  CHECK_BUCKET_ORDER,
  ONEPASSWORD_TOKEN_ENV_KEYS,
  REQUIRED_COMMANDS,
  checkMachine,
  formatReport,
} from '../skills/emori-readiness/scripts/check-machine-lib.js';

const HOME_DIR = '/Users/tester';
const REPO_ROOT = '/repo/emori';

function makePath(...segments) {
  return path.join(HOME_DIR, ...segments);
}

function makeFileInfo({ symbolicLink = false } = {}) {
  return {
    isSymbolicLink() {
      return symbolicLink;
    },
  };
}

function makeHealthyTailscaleStatus(overrides = {}) {
  return {
    BackendState: 'Running',
    TailscaleIPs: ['100.64.0.1'],
    CurrentTailnet: {
      Name: 'tanaab.dev',
    },
    Self: {
      InNetworkMap: true,
      Online: true,
    },
    ...overrides,
  };
}

const NODE_BREW_PREFIX = '/opt/homebrew/opt/node@24';
const NODE_BREW_PATH = path.join(NODE_BREW_PREFIX, 'bin', 'node');

function healthyExistingPaths(...missingPaths) {
  const missing = new Set(missingPaths);

  return [
    '/Applications/Codex.app',
    '/Applications/OpenClaw.app',
    '/Applications/Tailscale.app',
    '/Applications/Warp.app',
    makePath('.zshrc'),
    makePath('.zprofile'),
    makePath('.codex', 'AGENTS.md'),
    makePath('.codex', 'config.shared.toml'),
    makePath('.codex', 'plugins', 'emori'),
    makePath('.codex', 'plugins', 'tanaab'),
    makePath('.codex', 'config.toml'),
  ].filter((targetPath) => !missing.has(targetPath));
}

function makeDeps({
  brewfile = [
    'cask "1password-cli@beta"',
    'cask "codex"',
    'cask "codex-app"',
    'cask "openclaw"',
    'cask "tailscale"',
    'cask "warp"',
    'brew "node@24"',
    'brew "openclaw-cli"',
    'brew "ripgrep"',
  ].join('\n'),
  brewPrefixError = false,
  commands = REQUIRED_COMMANDS,
  configMode = 0o100600,
  environmentCliHelp = true,
  execCalls,
  existingPaths,
  nodePath = NODE_BREW_PATH,
  nodeVersion = 'v24.11.1',
  nodeVersionError = false,
  opEnvironmentHelpError = false,
  symbolicLinks,
  tailscaleExecError = false,
  tailscaleStatus = makeHealthyTailscaleStatus(),
  tailscaleStdout,
  whichNodeError = false,
} = {}) {
  const existing = new Set(existingPaths ?? healthyExistingPaths());
  const symlinks = new Set(
    symbolicLinks ?? [
      makePath('.codex', 'AGENTS.md'),
      makePath('.codex', 'config.shared.toml'),
      makePath('.zshrc'),
      makePath('.zprofile'),
      makePath('.codex', 'plugins', 'emori'),
      makePath('.codex', 'plugins', 'tanaab'),
    ],
  );
  const commandSet = new Set(commands);

  return {
    commandExists(command) {
      return commandSet.has(command);
    },
    execFile(command, args, options = {}) {
      execCalls?.push({ args, command, options });

      if (command === 'brew') {
        assert.deepEqual(args, ['--prefix', 'node@24']);

        if (brewPrefixError) {
          throw brewPrefixError instanceof Error
            ? brewPrefixError
            : new Error('brew prefix failed');
        }

        return { stdout: `${NODE_BREW_PREFIX}\n` };
      }

      if (command === 'which') {
        assert.deepEqual(args, ['node']);

        if (whichNodeError) {
          throw whichNodeError instanceof Error ? whichNodeError : new Error('which node failed');
        }

        return { stdout: `${nodePath}\n` };
      }

      if (command === 'node') {
        assert.deepEqual(args, ['--version']);

        if (nodeVersionError) {
          throw nodeVersionError instanceof Error
            ? nodeVersionError
            : new Error('node version failed');
        }

        return { stdout: `${nodeVersion}\n` };
      }

      if (command === 'op') {
        if (args[0] === 'environment') {
          assert.deepEqual(args, ['environment', 'read', '--help']);

          if (opEnvironmentHelpError || !environmentCliHelp) {
            throw opEnvironmentHelpError instanceof Error
              ? opEnvironmentHelpError
              : new Error('unknown command "environment"');
          }

          return {
            stdout: 'Read environment variables from a 1Password Environment.\n',
          };
        }

        throw new Error(`unexpected op args ${args.join(' ')}`);
      }

      if (command === 'tailscale') {
        assert.deepEqual(args, ['status', '--json']);

        if (tailscaleExecError) {
          throw tailscaleExecError instanceof Error
            ? tailscaleExecError
            : new Error('tailscale failed');
        }

        return { stdout: tailscaleStdout ?? JSON.stringify(tailscaleStatus) };
      }

      throw new Error(`unexpected command ${command}`);
    },
    lstat(targetPath) {
      if (!existing.has(targetPath)) {
        throw new Error(`missing ${targetPath}`);
      }

      return makeFileInfo({ symbolicLink: symlinks.has(targetPath) });
    },
    readFile(targetPath) {
      if (targetPath === path.join(REPO_ROOT, 'Brewfile')) {
        return brewfile;
      }

      throw new Error(`unexpected readFile ${targetPath}`);
    },
    stat(targetPath) {
      assert.equal(targetPath, makePath('.codex', 'config.toml'));

      if (!existing.has(targetPath)) {
        throw new Error(`missing ${targetPath}`);
      }

      return { mode: configMode };
    },
  };
}

async function runCheck(options = {}) {
  return checkMachine({
    env: options.env ?? {},
    homeDir: HOME_DIR,
    repoRoot: REPO_ROOT,
    deps: makeDeps(options),
  });
}

describe('skills/emori-readiness/scripts/check-machine-lib', () => {
  it('should report readiness when every local check passes', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths(),
    });

    assert.equal(report.ok, true);
    assert.ok(report.checks.length > 0);
    assert.deepEqual([...new Set(report.checks.map((check) => check.status))], ['pass']);
  });

  it('should emit the Homebrew command check first', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths(),
    });

    assert.equal(report.checks[0].id, 'command_brew');
    assert.equal(report.checks[0].bucket, 'homebrew');
  });

  it('should verify Homebrew node@24 is the active node runtime', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths(),
    });
    const formulaCheck = report.checks.find((check) => check.id === 'brewfile_formula_node_24');
    const commandCheck = report.checks.find((check) => check.id === 'command_node');
    const pathCheck = report.checks.find((check) => check.id === 'node_homebrew_path');
    const versionCheck = report.checks.find((check) => check.id === 'node_version');

    assert.equal(formulaCheck.status, 'pass');
    assert.equal(commandCheck.status, 'pass');
    assert.equal(pathCheck.status, 'pass');
    assert.equal(versionCheck.status, 'pass');
    assert.match(pathCheck.message, /node@24/);
    assert.match(versionCheck.message, /v24/);
  });

  it('should assign stable buckets in readiness order', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths(),
    });
    const allowedBuckets = new Set(CHECK_BUCKET_ORDER);
    const bucketIndexes = report.checks.map((check) => {
      assert.ok(allowedBuckets.has(check.bucket), check.id);
      return CHECK_BUCKET_ORDER.indexOf(check.bucket);
    });

    assert.deepEqual([...new Set(report.checks.map((check) => check.bucket))], CHECK_BUCKET_ORDER);

    for (let index = 1; index < bucketIndexes.length; index += 1) {
      assert.ok(
        bucketIndexes[index] >= bucketIndexes[index - 1],
        `${report.checks[index - 1].id} should not run after ${report.checks[index].id}`,
      );
    }
  });

  it('should include remediation for every warning and failure', async () => {
    const report = await runCheck({
      brewfile: 'cask "1password-cli"\n',
      commands: REQUIRED_COMMANDS.filter((command) => !['gh', 'tailscale'].includes(command)),
      configMode: 0o100644,
      env: {
        EMORI_OP_TOKEN: 'super-secret-token',
      },
      existingPaths: [
        makePath('.codex', 'AGENTS.md'),
        makePath('.codex', 'config.shared.toml'),
        makePath('.codex', 'plugins', 'emori'),
        makePath('.codex', 'plugins', 'tanaab'),
        makePath('.codex', 'config.toml'),
      ],
      symbolicLinks: [
        makePath('.codex', 'config.shared.toml'),
        makePath('.codex', 'plugins', 'emori'),
        makePath('.codex', 'plugins', 'tanaab'),
      ],
    });

    assert.equal(report.ok, false);

    for (const check of report.checks) {
      if (check.status !== 'pass') {
        assert.equal(typeof check.remediation, 'string', check.id);
        assert.notEqual(check.remediation.trim(), '', check.id);
      }
    }

    assert.ok(report.checks.some((check) => check.id === 'brewfile_cask_1password_cli_beta'));
    assert.ok(report.checks.some((check) => check.id === 'brewfile_cask_codex'));
    assert.ok(report.checks.some((check) => check.id === 'brewfile_cask_codex_app'));
    assert.ok(report.checks.some((check) => check.id === 'brewfile_cask_openclaw'));
    assert.ok(report.checks.some((check) => check.id === 'brewfile_cask_warp'));
    assert.ok(report.checks.some((check) => check.id === 'brewfile_formula_node_24'));
    assert.ok(report.checks.some((check) => check.id === 'brewfile_formula_openclaw_cli'));
    assert.ok(report.checks.some((check) => check.id === 'brewfile_formula_ripgrep'));
    assert.ok(
      report.checks.some((check) => check.id === 'brewfile_cask_1password_cli_stable_absent'),
    );
    assert.ok(report.checks.some((check) => check.id === 'brewfile_cask_tailscale'));
    assert.ok(report.checks.some((check) => check.id === 'zshrc_link'));
    assert.ok(report.checks.some((check) => check.id === 'zprofile_link'));
    assert.ok(report.checks.some((check) => check.id === 'command_codex'));
    assert.ok(report.checks.some((check) => check.id === 'command_gh'));
    assert.ok(report.checks.some((check) => check.id === 'command_openclaw'));
    assert.ok(report.checks.some((check) => check.id === 'command_rg'));
    assert.ok(report.checks.some((check) => check.id === 'command_tailscale'));
    assert.ok(report.checks.some((check) => check.id === 'codex_app'));
    assert.ok(report.checks.some((check) => check.id === 'openclaw_app'));
    assert.ok(report.checks.some((check) => check.id === 'onepassword_environment_cli'));
    assert.ok(report.checks.some((check) => check.id === 'tailscale_app'));
    assert.ok(report.checks.some((check) => check.id === 'warp_app'));
    assert.ok(report.checks.some((check) => check.id === 'tailscale_status'));
    assert.ok(report.checks.some((check) => check.id === 'bootstrap_token_env'));
  });

  it('should not leak token fallback values in formatted JSON', async () => {
    const report = await runCheck({
      env: {
        OP_SERVICE_ACCOUNT_TOKEN: 'do-not-print-this-token',
      },
      existingPaths: healthyExistingPaths(),
    });

    const output = formatReport(report);

    assert.doesNotMatch(output, /do-not-print-this-token/);
    assert.match(output, /OP_SERVICE_ACCOUNT_TOKEN/);
  });

  it('should check 1Password Environment CLI help without token fallback environment variables', async () => {
    const execCalls = [];

    await runCheck({
      env: {
        KEEP_ME: 'yes',
        OP_CONNECT_TOKEN: 'do-not-pass',
        OP_SERVICE_ACCOUNT_TOKEN: 'do-not-pass',
        OP_SESSION: 'do-not-pass',
        OP_SESSION_tanaab: 'do-not-pass',
        EMORI_OP_TOKEN: 'do-not-pass',
      },
      execCalls,
      existingPaths: healthyExistingPaths(),
    });

    const opCall = execCalls.find((call) => call.command === 'op');

    assert.deepEqual(opCall.args, ['environment', 'read', '--help']);
    assert.equal(opCall.options.env.KEEP_ME, 'yes');

    for (const key of [...ONEPASSWORD_TOKEN_ENV_KEYS, 'OP_SESSION_tanaab']) {
      assert.equal(Object.hasOwn(opCall.options.env, key), false, key);
    }
  });

  it('should require the beta 1Password CLI cask and reject the stable cask', async () => {
    const report = await runCheck({
      brewfile: [
        'cask "1password-cli"',
        'cask "codex"',
        'cask "codex-app"',
        'cask "openclaw"',
        'cask "tailscale"',
        'cask "warp"',
        'brew "node@24"',
        'brew "openclaw-cli"',
        'brew "ripgrep"',
      ].join('\n'),
      existingPaths: healthyExistingPaths(),
    });
    const betaCheck = report.checks.find(
      (check) => check.id === 'brewfile_cask_1password_cli_beta',
    );
    const stableCheck = report.checks.find(
      (check) => check.id === 'brewfile_cask_1password_cli_stable_absent',
    );

    assert.equal(betaCheck.status, 'fail');
    assert.equal(stableCheck.status, 'fail');
    assert.match(stableCheck.remediation, /1password-cli@beta/);
  });

  it('should require the node@24 Brewfile formula', async () => {
    const report = await runCheck({
      brewfile: [
        'cask "1password-cli@beta"',
        'cask "codex"',
        'cask "codex-app"',
        'cask "openclaw"',
        'cask "tailscale"',
        'cask "warp"',
        'brew "openclaw-cli"',
        'brew "ripgrep"',
      ].join('\n'),
      existingPaths: healthyExistingPaths(),
    });
    const formulaCheck = report.checks.find((check) => check.id === 'brewfile_formula_node_24');

    assert.equal(report.ok, false);
    assert.equal(formulaCheck.status, 'fail');
    assert.match(formulaCheck.message, /node@24/);
    assert.match(formulaCheck.remediation, /Brewfile/);
  });

  it('should require Codex, OpenClaw, and Warp Brewfile packages', async () => {
    const report = await runCheck({
      brewfile: ['cask "1password-cli@beta"', 'cask "tailscale"', 'brew "node@24"'].join('\n'),
      existingPaths: healthyExistingPaths(),
    });
    const requiredIds = [
      'brewfile_cask_codex',
      'brewfile_cask_codex_app',
      'brewfile_cask_openclaw',
      'brewfile_cask_warp',
      'brewfile_formula_openclaw_cli',
      'brewfile_formula_ripgrep',
    ];

    assert.equal(report.ok, false);
    for (const id of requiredIds) {
      const check = report.checks.find((candidate) => candidate.id === id);
      assert.equal(check.status, 'fail', id);
      assert.equal(check.bucket, 'packages', id);
      assert.match(check.remediation, /Brewfile/);
    }
  });

  it('should require Codex, OpenClaw, and ripgrep commands', async () => {
    const report = await runCheck({
      commands: REQUIRED_COMMANDS.filter(
        (command) => !['codex', 'openclaw', 'rg'].includes(command),
      ),
      existingPaths: healthyExistingPaths(),
    });

    assert.equal(report.ok, false);
    for (const id of ['command_codex', 'command_openclaw', 'command_rg']) {
      const check = report.checks.find((candidate) => candidate.id === id);
      assert.equal(check.status, 'fail', id);
      assert.match(check.remediation, /Brewfile/);
    }
  });

  it('should not require a Warp command', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths(),
    });

    assert.equal(REQUIRED_COMMANDS.includes('warp'), false);
    assert.equal(
      report.checks.some((check) => check.id === 'command_warp'),
      false,
    );
  });

  it('should fail when node resolves outside Homebrew node@24', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths(),
      nodePath: '/Users/tester/.asdf/shims/node',
    });
    const pathCheck = report.checks.find((check) => check.id === 'node_homebrew_path');

    assert.equal(report.ok, false);
    assert.equal(pathCheck.status, 'fail');
    assert.match(pathCheck.message, /asdf/);
    assert.match(pathCheck.message, /node@24/);
    assert.match(pathCheck.remediation, /brew --prefix node@24/);
  });

  it('should fail when node does not report major version 24', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths(),
      nodeVersion: 'v23.11.0',
    });
    const versionCheck = report.checks.find((check) => check.id === 'node_version');

    assert.equal(report.ok, false);
    assert.equal(versionCheck.status, 'fail');
    assert.match(versionCheck.message, /v23\.11\.0/);
    assert.match(versionCheck.message, /24/);
    assert.match(versionCheck.remediation, /node@24/);
  });

  it('should pass zsh readiness when stowed links exist', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths(),
    });
    const zshChecks = report.checks.filter((check) => check.id.startsWith('z'));

    assert.deepEqual(
      zshChecks.map((check) => [check.id, check.status]),
      [
        ['zshrc_link', 'pass'],
        ['zprofile_link', 'pass'],
      ],
    );
  });

  it('should fail zsh readiness when a stowed shell link is missing', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths(makePath('.zshrc')),
    });
    const zshrcCheck = report.checks.find((check) => check.id === 'zshrc_link');

    assert.equal(report.ok, false);
    assert.equal(zshrcCheck.status, 'fail');
    assert.match(zshrcCheck.remediation, /restow/);
  });

  it('should fail 1Password Environment CLI support when the beta CLI surface is missing', async () => {
    const report = await runCheck({
      environmentCliHelp: false,
      existingPaths: healthyExistingPaths(),
    });
    const cliCheck = report.checks.find((check) => check.id === 'onepassword_environment_cli');

    assert.equal(cliCheck.status, 'fail');
    assert.match(cliCheck.remediation, /1password-cli@beta/);
  });

  it('should emit parseable JSON with only supported statuses', async () => {
    const report = await runCheck({
      environmentCliHelp: false,
      existingPaths: healthyExistingPaths(),
    });

    const parsed = JSON.parse(formatReport(report));
    const statuses = new Set(parsed.checks.map((check) => check.status));

    assert.deepEqual([...statuses].sort(), ['fail', 'pass']);
  });
  it('should fail when the Tailscale app is missing', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths('/Applications/Tailscale.app'),
    });
    const tailscaleAppCheck = report.checks.find((check) => check.id === 'tailscale_app');

    assert.equal(report.ok, false);
    assert.equal(tailscaleAppCheck.status, 'fail');
  });

  it('should fail when the Codex or OpenClaw desktop apps are missing', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths('/Applications/Codex.app', '/Applications/OpenClaw.app'),
    });
    const codexAppCheck = report.checks.find((check) => check.id === 'codex_app');
    const openClawAppCheck = report.checks.find((check) => check.id === 'openclaw_app');

    assert.equal(report.ok, false);
    assert.equal(codexAppCheck.status, 'fail');
    assert.match(codexAppCheck.remediation, /Codex desktop app/);
    assert.equal(openClawAppCheck.status, 'fail');
    assert.match(openClawAppCheck.remediation, /OpenClaw desktop app/);
  });

  it('should fail when the Warp app is missing', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths('/Applications/Warp.app'),
    });
    const warpAppCheck = report.checks.find((check) => check.id === 'warp_app');

    assert.equal(report.ok, false);
    assert.equal(warpAppCheck.status, 'fail');
    assert.equal(warpAppCheck.bucket, 'manual_apps');
    assert.match(warpAppCheck.remediation, /Brewfile/);
  });

  it('should fail Tailscale status when the command is missing', async () => {
    const report = await runCheck({
      commands: REQUIRED_COMMANDS.filter((command) => command !== 'tailscale'),
      existingPaths: healthyExistingPaths(),
    });
    const commandCheck = report.checks.find((check) => check.id === 'command_tailscale');
    const statusCheck = report.checks.find((check) => check.id === 'tailscale_status');

    assert.equal(commandCheck.status, 'fail');
    assert.equal(statusCheck.status, 'fail');
    assert.match(statusCheck.message, /tailscale is missing/);
  });

  it('should fail Tailscale status when connected to the wrong tailnet', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths(),
      tailscaleStatus: makeHealthyTailscaleStatus({
        CurrentTailnet: {
          Name: 'other.example',
        },
      }),
    });
    const statusCheck = report.checks.find((check) => check.id === 'tailscale_status');

    assert.equal(statusCheck.status, 'fail');
    assert.match(statusCheck.message, /other\.example/);
  });

  it('should fail Tailscale status when the local node is offline or not running', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths(),
      tailscaleStatus: makeHealthyTailscaleStatus({
        BackendState: 'Stopped',
        Self: {
          InNetworkMap: false,
          Online: false,
        },
        TailscaleIPs: [],
      }),
    });
    const statusCheck = report.checks.find((check) => check.id === 'tailscale_status');

    assert.equal(statusCheck.status, 'fail');
    assert.match(statusCheck.message, /BackendState/);
    assert.match(statusCheck.message, /not online/);
    assert.match(statusCheck.message, /no Tailscale IPs/);
  });

  it('should fail Tailscale status when JSON output is invalid', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths(),
      tailscaleStdout: '{not json',
    });
    const statusCheck = report.checks.find((check) => check.id === 'tailscale_status');

    assert.equal(statusCheck.status, 'fail');
    assert.match(statusCheck.message, /not parseable JSON/);
  });

  it('should identify Tailscale daemon connection failures as local access issues', async () => {
    const report = await runCheck({
      existingPaths: healthyExistingPaths(),
      tailscaleExecError: Object.assign(new Error('tailscale failed'), {
        stderr:
          'failed to connect to local Tailscaled process and failed to enumerate processes while looking for it',
      }),
    });
    const statusCheck = report.checks.find((check) => check.id === 'tailscale_status');

    assert.equal(statusCheck.status, 'fail');
    assert.match(statusCheck.message, /local Tailscale service/);
    assert.match(statusCheck.remediation, /unsandboxed local access/);
  });
});
