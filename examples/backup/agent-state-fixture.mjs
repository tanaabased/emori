import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { openOpenClawAgentDatabase } from 'openclaw/plugin-sdk/sqlite-runtime';

const [mode, path] = process.argv.slice(2);
if (!path || (mode !== 'seed' && mode !== 'verify'))
  throw new Error('Use seed <ready-file> or verify <database>.');

const embedding = Buffer.from([0, 0, 128, 63]);

if (mode === 'seed') {
  const opened = openOpenClawAgentDatabase({ agentId: 'emori' });
  const database = opened.db;
  database.exec('PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0;');
  database.exec(`
    CREATE TABLE IF NOT EXISTS memory_index_chunks (
      chunk_rowid INTEGER PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      path TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'memory',
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      hash TEXT NOT NULL,
      model TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding BLOB NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS memory_embedding_cache (
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      provider_key TEXT NOT NULL,
      hash TEXT NOT NULL,
      embedding BLOB NOT NULL,
      dims INTEGER,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (provider, model, provider_key, hash)
    ) STRICT;
  `);
  database
    .prepare(
      `
    INSERT INTO memory_index_chunks
      (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
    VALUES (?, ?, 'memory', 1, 1, ?, ?, ?, ?, 1)
  `,
    )
    .run(
      'recovery-chunk',
      'memory/recovery.md',
      'recovery-hash',
      'synthetic-model',
      'synthetic indexed memory',
      embedding,
    );
  database
    .prepare(
      `
    INSERT INTO memory_embedding_cache
      (provider, model, provider_key, hash, embedding, dims, updated_at)
    VALUES ('synthetic', 'synthetic-model', 'recovery', 'recovery-hash', ?, 1, 1)
  `,
    )
    .run(embedding);
  database.close();
  writeFileSync(path, `${opened.path}\n`, { mode: 0o600 });
} else {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
    const chunk = database
      .prepare("SELECT path, text, embedding FROM memory_index_chunks WHERE id = 'recovery-chunk'")
      .get();
    assert.equal(chunk?.path, 'memory/recovery.md');
    assert.equal(chunk?.text, 'synthetic indexed memory');
    assert.deepEqual(Buffer.from(chunk?.embedding ?? []), embedding);
    const cache = database
      .prepare(
        `
      SELECT embedding, dims FROM memory_embedding_cache
      WHERE provider = 'synthetic' AND hash = 'recovery-hash'
    `,
      )
      .get();
    assert.equal(cache?.dims, 1);
    assert.deepEqual(Buffer.from(cache?.embedding ?? []), embedding);
  } finally {
    database.close();
  }
}
