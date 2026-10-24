import assert from 'node:assert/strict';

import {
  loadSqliteVecExtension,
  openNodeSqliteDatabase,
} from 'openclaw/plugin-sdk/memory-core-host-engine-knn';

const [extensionPath] = process.argv.slice(2);
assert.ok(extensionPath);
const database = openNodeSqliteDatabase(':memory:', { allowExtension: true });
try {
  const loaded = await loadSqliteVecExtension({ db: database, extensionPath });
  assert.equal(loaded.ok, true, loaded.error);
  assert.equal(loaded.extensionPath, extensionPath);
  assert.equal(typeof database.prepare('SELECT vec_version() AS version').get().version, 'string');
} finally {
  database.close();
}
