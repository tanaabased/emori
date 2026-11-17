import { lstat, realpath } from 'node:fs/promises';
import { join } from 'node:path';

/** Reject linked/task checkouts before Git inspects their content. No activity sampling. */
export default async function inspectSource({ source, execute, timeoutMs }) {
  const path = source.path;
  try {
    if ((await realpath(path)) !== path || !(await lstat(join(path, '.git'))).isDirectory())
      return { canonical: false };
  } catch (error) {
    if (error.code === 'ENOENT') return { canonical: false, missing: true };
    throw error;
  }
  const deadline = Date.now() + timeoutMs;
  const git = async (...argv) =>
    (await execute('git', argv, { timeoutMs: deadline - Date.now() })).trim();
  const identity = await git('rev-parse', '--show-toplevel');
  const status = (await git('status', '--porcelain=v2', '--branch', '--untracked-files=all')).split(
    '\n',
  );
  const field = (name) =>
    status.find((line) => line.startsWith(`# branch.${name} `))?.slice(name.length + 10);
  const branch = field('head');
  const head = field('oid');
  const upstream = field('upstream');
  const clean = !status.some((line) => line && !line.startsWith('# '));
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
      await lstat(join(path, '.git', name));
      inProgress = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  // Missing origin is a skip; errors from the managed command itself remain failures.
  const remotes = await git('remote');
  const remote = remotes.split('\n').includes('origin')
    ? await git('remote', 'get-url', '--all', 'origin')
    : '';
  return {
    canonical: identity === path,
    identity,
    branch: branch === '(detached)' ? '' : branch,
    clean,
    head,
    upstream,
    remote,
    inProgress,
  };
}
