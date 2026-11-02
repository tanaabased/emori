import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, readlink, realpath } from 'node:fs/promises';
import { join, sep } from 'node:path';

/** Read approved build inputs and outputs, never executing artifacts or following external links. */
export default async function buildEvidence({ source, head, files, execute, budget }) {
  let entries = 0;
  let bytes = 0;
  const buffer = Buffer.alloc(64 * 1024);
  const hash = () => createHash('sha256');
  const root = source.path;
  const frame = (digest, value) => digest.update(`${JSON.stringify(value)}\n`);
  const visit = async (digest, relative, links = false) => {
    budget();
    if (++entries > 200_000) throw new Error('build-evidence-invalid');
    const path = join(root, relative);
    const stat = await lstat(path);
    if (stat.isSymbolicLink() && links) {
      const resolved = await realpath(path);
      if (!resolved.startsWith(`${join(root, 'node_modules')}${sep}`))
        throw new Error('build-evidence-invalid');
      frame(digest, ['link', relative, await readlink(path)]);
    } else if (stat.isSymbolicLink()) {
      throw new Error('build-evidence-unsafe');
    } else if (stat.isDirectory()) {
      frame(digest, ['directory', relative]);
      for (const name of (await readdir(path)).sort())
        await visit(digest, join(relative, name), links);
    } else if (stat.isFile()) {
      const file = await open(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const identity = await file.stat();
        if (!identity.isFile() || identity.ino !== stat.ino || identity.dev !== stat.dev)
          throw new Error('build-evidence-invalid');
        const content = hash();
        for (;;) {
          budget();
          const { bytesRead } = await file.read(buffer);
          if (!bytesRead) break;
          bytes += bytesRead;
          if (bytes > 2 * 1024 ** 3) throw new Error('build-evidence-invalid');
          content.update(buffer.subarray(0, bytesRead));
        }
        const after = await file.stat();
        if (after.size !== identity.size || after.mtimeMs !== identity.mtimeMs)
          throw new Error('build-evidence-invalid');
        frame(digest, ['file', relative, stat.mode & 0o777, content.digest('hex')]);
      } finally {
        await file.close();
      }
    } else throw new Error('build-evidence-invalid');
  };
  if ((await realpath(root)) !== root) throw new Error('build-evidence-invalid');
  const bun = (await execute('bun', ['--version'], budget())).trim();
  const node = (await execute('node', ['--version'], budget())).trim();
  if (!/^\d+\.\d+\.\d+[\w.+-]*$/.test(bun) || !/^v\d+\.\d+\.\d+[\w.+-]*$/.test(node))
    throw new Error('build-evidence-invalid');
  const inputs = hash();
  frame(inputs, [1, head, bun, node, process.platform, process.arch]);
  for (const name of files
    .filter((name) => ['package.json', 'bun.lock', 'bun.lockb'].includes(name))
    .sort())
    await visit(inputs, name);
  await visit(inputs, 'node_modules', true);

  const artifacts = hash();
  try {
    await visit(artifacts, 'dist');
    // These are the outputs of Agent System's build, including its bundled Codex runtime.
    for (const name of ['index', 'memory-secret-provider-entry', 'codex/codex-runtime']) {
      for (const extension of ['.js', '.js.map']) {
        const path = join(root, 'dist', `${name}${extension}`);
        if (!(await lstat(path)).isFile() || (await lstat(path)).size === 0)
          throw new Error('build-evidence-invalid');
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT' && error.message !== 'build-evidence-invalid') throw error;
    return { version: 1, inputs: inputs.digest('hex'), artifacts: null };
  }
  return { version: 1, inputs: inputs.digest('hex'), artifacts: artifacts.digest('hex') };
}
