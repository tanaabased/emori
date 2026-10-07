import { mkdtemp, mkdir, chmod, rm, realpath, lstat } from 'node:fs/promises';
import { basename, join } from 'node:path';

import checkDriveFile from './utils/check-drive-file.js';
import readDrivePage from './utils/read-drive-page.js';
import { inspectArchive } from './storage.js';

export const destinationFolder = '1rSRlVHUrApaqxpNZVAO_IXnVuVhdiZVV';
const fileFields = 'id,name,size,mimeType,parents,md5Checksum,sha256Checksum,ownedByMe,trashed';
const requireResult = (condition, code) => {
  if (!condition) throw new Error(code);
};

async function listFolder(commands) {
  const files = [];
  const tokens = new Set();
  let token = '';
  do {
    requireResult(tokens.size < 100, 'drive-list-limit');
    const page = readDrivePage(
      await commands.drive([
        'drive',
        'ls',
        '--parent',
        destinationFolder,
        '--query',
        'trashed = false',
        '--max',
        '100',
        '--fields',
        'files(id,name),nextPageToken,incompleteSearch',
        ...(token ? ['--page', token] : []),
      ]),
      tokens,
    );
    files.push(...page.files);
    token = page.next;
    if (token) tokens.add(token);
  } while (token);
  requireResult(
    new Set(files.map((file) => file.id)).size === files.length,
    'drive-list-duplicates',
  );
  return files;
}

function verifyBackup(result, path) {
  requireResult(
    result.status === 'verified' &&
      result.agentId === 'emori' &&
      result.archive === path &&
      result.coverage?.openclawState === 'captured' &&
      result.coverage?.stage === 'workspace-and-agent-state' &&
      result.settings?.openclawState === 'required' &&
      result.diagnostics?.length === 0 &&
      Number.isFinite(Date.parse(result.capturedAt)),
    'backup-verification-failed',
  );
  return result.capturedAt;
}

export async function verifyDownload(commands, archive, workspace) {
  const temporaryRoot = join(workspace, '.temp');
  await mkdir(temporaryRoot, { recursive: true, mode: 0o700 });
  requireResult(
    (await lstat(temporaryRoot)).isDirectory() && (await realpath(temporaryRoot)) === temporaryRoot,
    'temporary-directory-unsafe',
  );
  const directory = await mkdtemp(join(temporaryRoot, 'backup-drive-'));
  await chmod(directory, 0o700);
  const downloaded = join(directory, 'downloaded-backup.tar.gz');
  try {
    await commands.drive(['drive', 'download', archive.remoteId, '--out', downloaded]);
    await chmod(downloaded, 0o600);
    verifyBackup(await commands.backup(['verify', downloaded]), downloaded);
    const contents = await inspectArchive(downloaded, workspace, directory);
    requireResult(
      contents.sha256 === archive.sha256 && contents.size === archive.size,
      'download-mismatch',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** Create, recover, and retain EMORI's verified Drive set. Checkpoints precede uncertain writes. */
export default async function runBackupDrive({
  workspace,
  commands,
  storage,
  resumeArchive,
  inspect = inspectArchive,
  roundTrip = verifyDownload,
}) {
  let stage = 'preflight';
  let state;
  const checkpoint = () => storage.write('journal', state);
  const getFile = async (id) =>
    (await commands.drive(['drive', 'get', id, '--fields', fileFields])).file;
  try {
    state = (await storage.read()) ?? {
      version: 1,
      folder: destinationFolder,
      receipts: {},
      run: null,
    };
    requireResult(
      state.version === 1 &&
        state.folder === destinationFolder &&
        state.receipts &&
        typeof state.receipts === 'object' &&
        !Array.isArray(state.receipts),
      'journal-invalid',
    );
    const folder = (
      await commands.drive([
        'drive',
        'get',
        destinationFolder,
        '--fields',
        'id,mimeType,driveId,capabilities,permissions',
      ])
    ).file;
    requireResult(
      folder?.id === destinationFolder &&
        folder.mimeType === 'application/vnd.google-apps.folder' &&
        !folder.driveId &&
        folder.capabilities?.canAddChildren === true &&
        Array.isArray(folder.permissions) &&
        folder.permissions.length > 0 &&
        folder.permissions.every((permission) => permission.type === 'user'),
      'drive-folder-unsafe',
    );
    await listFolder(commands);

    stage = 'create';
    if (resumeArchive) {
      requireResult(
        !state.run?.archive || state.run.archive === resumeArchive,
        'resume-conflicts-with-pending-run',
      );
      await inspect(resumeArchive, workspace);
      state.run = { archive: resumeArchive };
      await checkpoint();
    }
    if (!state.run) {
      state.run = { creating: true };
      await checkpoint();
      const created = await commands.backup(['create']);
      requireResult(
        created.status === 'created' && created.agentId === 'emori',
        'backup-create-failed',
      );
      state.run = { archive: created.archive };
      await checkpoint();
    }
    requireResult(typeof state.run.archive === 'string', 'create-outcome-unknown');
    stage = 'verify';
    await inspect(state.run.archive, workspace);
    verifyBackup(await commands.backup(['verify', state.run.archive]), state.run.archive);

    stage = 'retention-preview';
    const plan = await commands.backup(['prune', '--keep', '5', '--dry-run']);
    requireResult(
      plan.status === 'preview' &&
        plan.agentId === 'emori' &&
        plan.keep === 5 &&
        plan.output === join(workspace, '.agent-system', 'backups') &&
        Array.isArray(plan.kept) &&
        plan.kept.length > 0 &&
        plan.kept.length <= 5 &&
        plan.kept.includes(state.run.archive) &&
        Array.isArray(plan.wouldDelete) &&
        new Set(plan.kept).size === plan.kept.length,
      'retention-preview-invalid',
    );
    const retained = [];
    for (const path of plan.kept) {
      const contents = await inspect(path, workspace);
      const capturedAt = verifyBackup(await commands.backup(['verify', path]), path);
      retained.push({ path, name: basename(path), capturedAt, ...contents });
    }

    stage = 'upload';
    for (const archive of retained) {
      let receipt = state.receipts[archive.sha256];
      if (receipt) {
        requireResult(
          receipt.name === archive.name &&
            receipt.size === archive.size &&
            receipt.md5 === archive.md5,
          'receipt-conflict',
        );
      }
      const files = await listFolder(commands);
      const matches = files.filter((file) => file.name === archive.name);
      requireResult(matches.length <= 1, 'duplicate-remote-archive');
      let remoteId = receipt?.remoteId;
      if (remoteId) {
        requireResult(matches[0]?.id === remoteId, 'remote-receipt-missing');
      } else if (matches.length === 1) {
        remoteId = matches[0].id;
      } else {
        requireResult(!receipt?.uploadPending, 'upload-outcome-unknown');
        receipt = { ...archive, uploadPending: true };
        state.receipts[archive.sha256] = receipt;
        await checkpoint();
        const uploaded = await commands.drive([
          'drive',
          'upload',
          archive.path,
          '--name',
          archive.name,
          '--parent',
          destinationFolder,
          '--mime-type',
          'application/gzip',
        ]);
        remoteId = uploaded.file?.id;
        requireResult(
          typeof remoteId === 'string' && remoteId.length > 0,
          'upload-outcome-unknown',
        );
        receipt.remoteId = remoteId;
        await checkpoint();
      }
      const remote = await getFile(remoteId);
      requireResult(
        checkDriveFile(remote, archive, destinationFolder) && remote.id === remoteId,
        'remote-integrity-failed',
      );
      state.receipts[archive.sha256] = { ...archive, remoteId, verified: true };
      archive.remoteId = remoteId;
      await checkpoint();
    }

    stage = 'download-verify';
    await roundTrip(
      commands,
      retained.find((archive) => archive.path === state.run.archive),
      workspace,
    );

    stage = 'retention-preflight';
    const files = await listFolder(commands);
    const known = Object.values(state.receipts);
    requireResult(
      Object.entries(state.receipts).every(([hash, receipt]) => receipt?.sha256 === hash),
      'receipt-key-invalid',
    );
    requireResult(
      known.every(
        (receipt) =>
          receipt.verified === true &&
          typeof receipt.remoteId === 'string' &&
          Number.isFinite(Date.parse(receipt.capturedAt)),
      ),
      'unresolved-upload',
    );
    requireResult(
      new Set(known.map((receipt) => receipt.remoteId)).size === known.length,
      'duplicate-receipt',
    );
    for (const receipt of known) {
      const remote = await getFile(receipt.remoteId);
      if (remote?.trashed) {
        requireResult(receipt.deleting === true, 'remote-receipt-missing');
        delete state.receipts[receipt.sha256];
        await checkpoint();
        continue;
      }
      requireResult(
        files.some((file) => file.id === receipt.remoteId) &&
          checkDriveFile(remote, receipt, destinationFolder),
        'remote-integrity-failed',
      );
    }
    const active = Object.values(state.receipts).sort(
      (a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt) || a.name.localeCompare(b.name),
    );
    const remoteKeep = new Set(active.slice(0, 5).map((receipt) => receipt.remoteId));
    requireResult(
      retained.every((archive) => remoteKeep.has(archive.remoteId)),
      'remote-retention-conflict',
    );
    const fresh = await commands.backup(['prune', '--keep', '5', '--dry-run']);
    requireResult(
      fresh.status === 'preview' &&
        JSON.stringify(fresh.kept) === JSON.stringify(plan.kept) &&
        JSON.stringify(fresh.wouldDelete) === JSON.stringify(plan.wouldDelete),
      'local-retention-changed',
    );

    stage = 'remote-retention';
    for (const receipt of active.slice(5)) {
      requireResult(
        checkDriveFile(await getFile(receipt.remoteId), receipt, destinationFolder),
        'remote-integrity-failed',
      );
      receipt.deleting = true;
      await checkpoint();
      await commands.drive(['drive', 'delete', receipt.remoteId]);
      requireResult(
        (await getFile(receipt.remoteId))?.trashed === true,
        'remote-delete-unverified',
      );
      delete state.receipts[receipt.sha256];
      await checkpoint();
    }
    stage = 'local-retention';
    const pruned = await commands.backup(['prune', '--keep', '5']);
    requireResult(
      pruned.status === 'pruned' &&
        JSON.stringify(pruned.kept) === JSON.stringify(plan.kept) &&
        JSON.stringify(pruned.deleted) === JSON.stringify(plan.wouldDelete),
      'local-prune-failed',
    );
    const result = {
      status: 'completed',
      agentId: 'emori',
      localKept: plan.kept.length,
      remoteKept: remoteKeep.size,
    };
    state.run = null;
    await checkpoint();
    await storage.write('status', { ...result, finishedAt: new Date().toISOString() });
    return result;
  } catch (error) {
    await storage.write('status', {
      status: 'failed',
      stage,
      code: /^[a-z][a-z0-9-]{1,80}$/.test(error.message) ? error.message : 'task-failed',
      finishedAt: new Date().toISOString(),
    });
    throw error;
  }
}
