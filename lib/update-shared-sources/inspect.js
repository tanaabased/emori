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
  const branch = await git('branch', '--show-current');
  const clean = (await git('status', '--porcelain=v1', '--untracked-files=all')) === '';
  const head = await git('rev-parse', '--verify', 'HEAD');
  const upstream = await git('for-each-ref', '--format=%(upstream:short)', 'refs/heads/main');
  // Missing origin is a skip; errors from the managed command itself remain failures.
  const remotes = await git('remote');
  const remote = remotes.split('\n').includes('origin')
    ? await git('remote', 'get-url', '--all', 'origin')
    : '';
  return { canonical: identity === path, identity, branch, clean, head, upstream, remote };
}
