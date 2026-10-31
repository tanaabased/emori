import { spawnSync } from 'node:child_process';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';

const remotes = new Set([
  'git@github.com:tanaabased/emori.git',
  'https://github.com/tanaabased/emori.git',
  'https://github.com/tanaabased/emori',
]);

/** Strict managed commands only; no operator/raw-client fallback or target selectors. */
export default function updateCommands({
  workspace,
  storage,
  environment = process.env,
  spawn = spawnSync,
  stat = lstat,
  now = () => performance.now(),
  budgetMs = 1_800_000,
}) {
  const deadline = now() + budgetMs;
  const execute = async (command, argv, remaining = 600_000, allowed = [0]) => {
    if (!environment.AGENT_SYSTEM_GIT) throw new Error('command-failed');
    await storage.assertHeld();
    const timeout = Math.min(remaining, 600_000, deadline - now());
    if (timeout <= 0) throw new Error('deadline');
    const value = spawn(command, argv, {
      cwd: workspace,
      env: environment,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe', ...storage.lockFds],
      timeout: Math.max(1, Math.floor(timeout)),
      killSignal: 'SIGKILL',
      maxBuffer: 1024 * 1024,
    });
    if (value.error?.code === 'ETIMEDOUT') throw new Error('command-timeout');
    if (
      value.error ||
      value.signal ||
      !Number.isInteger(value.status) ||
      (allowed && !allowed.includes(value.status))
    ) {
      // Retain only this known native refusal, never arbitrary subprocess diagnostics.
      if (String(value.stderr).includes('automation-execution-stale'))
        throw new Error('automation-execution-stale');
      throw new Error('command-failed');
    }
    await storage.assertHeld();
    return {
      text: value.stdout,
      code: value.status,
      stale: String(value.stderr).includes('automation-execution-stale'),
    };
  };
  const git = async (argv, remaining, allowed) =>
    execute(environment.AGENT_SYSTEM_GIT, argv, remaining, allowed);
  const lifecycle = async (operation, remaining) => {
    const { text, code, stale } = await execute(
      'openclaw',
      ['agent-system', operation, ...(operation === 'install' ? ['--skip-setup'] : []), '--json'],
      remaining,
      null,
    );
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error(
        code === 0
          ? 'command-output-invalid'
          : stale
            ? 'automation-execution-stale'
            : 'command-failed',
      );
    }
    // Doctor's success contract is healthy. Install's exit status owns application;
    // loaded-state evidence is a separate mandatory host check, not inferred here.
    if (operation === 'doctor' && code === 0 && value?.status !== 'healthy')
      throw new Error('command-output-invalid');
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('command-output-invalid');
    if (
      operation === 'install' &&
      code === 0 &&
      (value.agentId !== 'emori' ||
        value.workspaceDir !== workspace ||
        !Array.isArray(value.outcomes) ||
        !Array.isArray(value.warnings))
    )
      throw new Error('command-output-invalid');
    const outcomes = Array.isArray(value.outcomes) ? value.outcomes : [];
    const summary = {
      completed: outcomes.filter((item) =>
        ['created', 'updated', 'removed', 'unchanged'].includes(item?.status),
      ).length,
      skipped: outcomes.filter((item) => item?.status === 'skipped').length,
      unattempted: Array.isArray(value.unattempted) ? value.unattempted.length : 0,
    };
    const warnings = Array.isArray(value.warnings) ? value.warnings.length : 0;
    if (code !== 0) {
      const error = new Error(stale ? 'automation-execution-stale' : 'command-failed');
      if (
        operation === 'install' &&
        value.agentId === 'emori' &&
        value.workspaceDir === workspace &&
        Array.isArray(value.outcomes)
      ) {
        error.lifecycle = summary;
        error.warnings = warnings;
      }
      throw error;
    }
    return operation === 'install' ? { setup: 'skipped', lifecycle: summary, warnings } : undefined;
  };
  return {
    async inspect(remaining) {
      const root = (await git(['rev-parse', '--show-toplevel'], remaining)).text.trim();
      const gitDir = (await git(['rev-parse', '--absolute-git-dir'], remaining)).text.trim();
      // Canonical non-bare checkout only; never follow a task-worktree gitdir.
      if (root !== workspace || gitDir !== join(workspace, '.git'))
        throw new Error('unsupported-target');
      const status = (
        await git(['status', '--porcelain=v2', '--branch', '--untracked-files=all'], remaining)
      ).text;
      const lines = status.trimEnd().split('\n');
      const field = (name) =>
        lines.find((line) => line.startsWith(`# branch.${name} `))?.slice(name.length + 10);
      const head = field('oid');
      const branch = field('head');
      const upstream = field('upstream');
      const remoteResult = await git(['remote', 'get-url', 'origin'], remaining, [0, 2]);
      const remote = remoteResult.code === 0 ? remoteResult.text.trim() : '';
      let inProgress = false;
      for (const name of [
        'MERGE_HEAD',
        'REBASE_HEAD',
        'CHERRY_PICK_HEAD',
        'REVERT_HEAD',
        'BISECT_LOG',
        'rebase-merge',
        'rebase-apply',
        'sequencer',
      ]) {
        try {
          await stat(join(gitDir, name));
          inProgress = true;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
      const approved = remotes.has(remote) && upstream === 'origin/main';
      const reference = approved
        ? await git(['rev-parse', '--verify', 'refs/remotes/origin/main'], remaining, [0, 128])
        : undefined;
      const target = reference?.code === 0 ? reference.text.trim() : undefined;
      const ancestry =
        approved && [head, target].every((sha) => /^[a-f0-9]{40}$/.test(sha))
          ? await git(['merge-base', '--is-ancestor', head, target], remaining, [0, 1])
          : undefined;
      return {
        workspace: root,
        canonical: true,
        head,
        target,
        remote,
        upstream,
        inProgress,
        branch: branch === '(detached)' ? undefined : branch,
        dirty: lines.some((line) => line && !line.startsWith('# ')),
        remoteApproved: remotes.has(remote) && reference?.code === 0,
        fastForward: ancestry?.code === 0,
      };
    },
    fetch: (remaining) =>
      git(['fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main'], remaining),
    advance: (target, remaining) => {
      if (!/^[a-f0-9]{40}$/.test(target)) throw new Error('unsafe-upstream');
      return git(['merge', '--ff-only', '--no-edit', target], remaining);
    },
    dependencies: (remaining) =>
      execute('bun', ['install', '--frozen-lockfile', '--ignore-scripts'], remaining),
    install: (remaining) => lifecycle('install', remaining),
    doctor: (remaining) => lifecycle('doctor', remaining),
  };
}
