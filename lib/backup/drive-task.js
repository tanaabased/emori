import { basename, join, resolve } from 'node:path';

import checkDriveFile from './utils/check-drive-file.js';
import readDrivePage from './utils/read-drive-page.js';
import { inspectArchive } from './storage.js';

export const destinationFolder = '1rSRlVHUrApaqxpNZVAO_IXnVuVhdiZVV';
const fileFields = 'id,name,size,mimeType,parents,md5Checksum,sha256Checksum,ownedByMe,trashed';
const requireResult = (condition, code) => {
  if (!condition) throw new Error(code);
};
const errorCode = (error) =>
  /^[a-z][a-z0-9-]{1,80}$/.test(error.message) ? error.message : 'task-failed';

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

function requireCapture(result, path, status) {
  requireResult(
    result?.status === status &&
      result.agentId === 'emori' &&
      result.archive === path &&
      result.coverage?.openclawState === 'captured' &&
      result.coverage?.stage === 'workspace-and-agent-state' &&
      result.settings?.openclawState === 'required' &&
      Array.isArray(result.diagnostics) &&
      result.diagnostics.length === 0 &&
      Number.isFinite(Date.parse(result.capturedAt)),
    'backup-capture-invalid',
  );
  return result.capturedAt;
}

function archivePath(path, workspace) {
  return (
    typeof path === 'string' &&
    resolve(path) === path &&
    path.startsWith(`${join(workspace, '.agent-system', 'backups')}/`) &&
    basename(path) === path.slice(join(workspace, '.agent-system', 'backups').length + 1) &&
    path.endsWith('.tar.gz') &&
    !basename(path).startsWith('.')
  );
}

function requireLedger(state, workspace) {
  requireResult(
    state?.version === 1 &&
      state.folder === destinationFolder &&
      Array.isArray(state.receipts) &&
      state.receipts.every(
        (r) =>
          r &&
          archivePath(r.path, workspace) &&
          r.name === basename(r.path) &&
          Number.isFinite(Date.parse(r.capturedAt)) &&
          Number.isSafeInteger(r.size) &&
          r.size > 0 &&
          /^[a-f0-9]{64}$/.test(r.sha256) &&
          /^[a-f0-9]{32}$/.test(r.md5) &&
          ['pending', 'delivered', 'deleting'].includes(r.status) &&
          (r.remoteId === undefined || (typeof r.remoteId === 'string' && r.remoteId.length > 0)) &&
          (r.status === 'pending' || r.remoteId),
      ),
    'delivery-record-invalid',
  );
  requireResult(
    new Set(state.receipts.map((r) => r.path)).size === state.receipts.length &&
      new Set(state.receipts.filter((r) => r.remoteId).map((r) => r.remoteId)).size ===
        state.receipts.filter((r) => r.remoteId).length,
    'delivery-record-conflict',
  );
}

/** Fresh delivery never depends on historical archive contents or remote reconciliation. */
export default async function runBackupDrive({
  workspace,
  commands,
  storage,
  resumeArchive,
  inspect = inspectArchive,
}) {
  let stage = 'preflight';
  let delivered = false;
  const getFile = async (id) => {
    const file = (await commands.drive(['drive', 'get', id, '--fields', fileFields])).file;
    requireResult(file?.id === id, 'remote-file-missing');
    return file;
  };
  const writeStatus = (value) =>
    storage.write('status', { ...value, finishedAt: new Date().toISOString() });
  try {
    // The old journal remains untouched: neither its schema nor its receipts gate delivery.
    const state = (await storage.read()) ?? {
      version: 1,
      folder: destinationFolder,
      receipts: [],
    };
    requireLedger(state, workspace);
    const checkpoint = () => storage.write('deliveries', state);
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

    stage = 'create';
    // Explicit retries only concern this ledger's attempted uploads, never legacy journal state.
    if (resumeArchive)
      requireResult(
        state.receipts.some((r) => r.path === resumeArchive),
        'resume-record-required',
      );
    const created = resumeArchive
      ? await commands.backup(['verify', resumeArchive])
      : await commands.backup(['create']);
    const path = resumeArchive ?? created?.archive;
    requireResult(archivePath(path, workspace), 'backup-create-failed');
    if (!resumeArchive)
      requireResult(
        created.format === 'agent-system-backup' && created.version === 2,
        'backup-create-failed',
      );
    const capturedAt = requireCapture(created, path, resumeArchive ? 'verified' : 'created');
    const archive = { path, name: basename(path), capturedAt, ...(await inspect(path, workspace)) };
    let receipt = state.receipts.find((r) => r.path === path);
    if (receipt) {
      requireResult(
        ['name', 'capturedAt', 'size', 'sha256', 'md5'].every(
          (key) => receipt[key] === archive[key],
        ),
        'receipt-conflict',
      );
      requireResult(receipt.status !== 'deleting', 'archive-being-deleted');
    }

    stage = 'upload';
    if (!receipt) {
      receipt = { ...archive, status: 'pending' };
      state.receipts.push(receipt);
      requireLedger(state, workspace);
      await checkpoint();
      const uploaded = await commands.drive([
        'drive',
        'upload',
        path,
        '--name',
        archive.name,
        '--parent',
        destinationFolder,
        '--mime-type',
        'application/gzip',
      ]);
      requireResult(
        typeof uploaded.file?.id === 'string' && uploaded.file.id.length > 0,
        'upload-outcome-unknown',
      );
      receipt.remoteId = uploaded.file.id;
      await checkpoint();
    } else if (!receipt.remoteId) {
      const matches = (await listFolder(commands)).filter((file) => file.name === archive.name);
      requireResult(matches.length <= 1, 'duplicate-remote-archive');
      requireResult(matches.length === 1, 'upload-outcome-unknown');
      receipt.remoteId = matches[0].id;
      await checkpoint();
    }
    stage = 'remote-check';
    requireResult(
      checkDriveFile(await getFile(receipt.remoteId), archive, destinationFolder),
      'remote-integrity-failed',
    );
    receipt.status = 'delivered';
    await checkpoint();
    delivered = true;
    // Record delivery before anything that can inspect or delete historical files.
    const result = {
      status: 'completed',
      delivery: 'confirmed',
      agentId: 'emori',
      retention: 'deferred',
      remoteRetention: 'deferred',
      localRetention: 'deferred',
    };
    await writeStatus(result);

    stage = 'retention';
    try {
      requireResult(
        state.receipts.every((r) => r.status !== 'pending'),
        'unresolved-upload',
      );
      stage = 'retention-preflight';
      const files = await listFolder(commands);
      for (const known of [...state.receipts]) {
        const remote = await getFile(known.remoteId);
        if (
          known.status === 'deleting' &&
          remote?.id === known.remoteId &&
          remote.trashed === true
        ) {
          continue;
        }
        requireResult(
          files.some((f) => f.id === known.remoteId && f.name === known.name) &&
            checkDriveFile(remote, known, destinationFolder),
          'remote-retention-unconfirmed',
        );
      }
      const active = [...state.receipts].sort(
        (a, b) =>
          Date.parse(b.capturedAt) - Date.parse(a.capturedAt) || a.name.localeCompare(b.name),
      );
      const excess = active.slice(5);
      requireResult(
        active.slice(0, 5).some((r) => r.path === path),
        'retention-ownership-unconfirmed',
      );
      stage = 'remote-retention';
      for (const known of excess) {
        const remote = await getFile(known.remoteId);
        if (known.status === 'deleting' && remote.trashed === true) continue;
        requireResult(
          checkDriveFile(remote, known, destinationFolder),
          'remote-retention-unconfirmed',
        );
        known.status = 'deleting';
        await checkpoint();
        await commands.drive(['drive', 'delete', known.remoteId, '--force']);
        const deleted = await getFile(known.remoteId);
        requireResult(
          deleted?.id === known.remoteId && deleted.trashed === true,
          'remote-delete-unverified',
        );
      }
      result.remoteRetention = 'completed';

      // The global local plan cannot select only receipt-owned archives. Defer it independently.
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
          plan.kept.includes(path) &&
          Array.isArray(plan.wouldDelete) &&
          [...plan.kept, ...plan.wouldDelete].every((p) => archivePath(p, workspace)) &&
          new Set([...plan.kept, ...plan.wouldDelete]).size ===
            plan.kept.length + plan.wouldDelete.length,
        'retention-preview-invalid',
      );
      stage = 'local-retention';
      requireResult(
        active.slice(0, 5).every((r) => plan.kept.includes(r.path)) &&
          plan.wouldDelete.every((p) => excess.some((r) => r.path === p)),
        'retention-ownership-unconfirmed',
      );
      const fresh = await commands.backup(['prune', '--keep', '5', '--dry-run']);
      requireResult(
        fresh.status === 'preview' &&
          JSON.stringify(fresh.kept) === JSON.stringify(plan.kept) &&
          JSON.stringify(fresh.wouldDelete) === JSON.stringify(plan.wouldDelete),
        'local-retention-changed',
      );
      const pruned = await commands.backup(['prune', '--keep', '5']);
      requireResult(
        pruned.status === 'pruned' &&
          JSON.stringify(pruned.kept) === JSON.stringify(plan.kept) &&
          JSON.stringify(pruned.deleted) === JSON.stringify(plan.wouldDelete),
        'local-prune-failed',
      );
      state.receipts = active.slice(0, 5);
      await checkpoint();
      result.localRetention = 'completed';
      result.retention = 'completed';
    } catch (error) {
      result.stage = stage;
      result.code = errorCode(error);
      if (error.diagnostic) result.diagnostic = error.diagnostic;
    }
    await writeStatus(result);
    return result;
  } catch (error) {
    await writeStatus({
      status: delivered ? 'completed' : 'failed',
      delivery: delivered ? 'confirmed' : 'unconfirmed',
      ...(delivered ? { retention: 'deferred' } : {}),
      stage,
      code: errorCode(error),
      ...(error.diagnostic ? { diagnostic: error.diagnostic } : {}),
    });
    throw error;
  }
}
