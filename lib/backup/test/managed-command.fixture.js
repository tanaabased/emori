#!/usr/bin/env bun
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const { FIXTURE_OUTPUT: output, FIXTURE_MODE: mode, FIXTURE_LOG: log } = process.env;
const suffix = '2026-11-13T04-00-00-000Z-12345678-1234-4234-8234-123456789abc.tar.gz';
appendFileSync(log, `${JSON.stringify(args)}\n`);
const reply = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
if (args[0] === 'agent-system') {
  mkdirSync(output, { recursive: true });
  const archive = join(output, `emori-${suffix}`);
  writeFileSync(archive, 'exact completed bytes');
  if (mode === 'create-failure') process.exit(1);
  reply({ archive, settings: { output } });
} else if (args[1] === 'get') {
  reply({
    file: {
      id: args[2],
      mimeType: 'application/vnd.google-apps.folder',
      capabilities: { canAddChildren: true },
      permissions: [{ type: mode === 'public' ? 'anyone' : 'user' }],
    },
  });
} else if (args[1] === 'upload') {
  if (readFileSync(args[2], 'utf8') !== 'exact completed bytes') process.exit(2);
  if (mode === 'upload-failure') process.exit(1);
  reply({ file: { id: 'new-upload' } });
} else if (args[1] === 'ls') {
  if (mode === 'list-failure') process.exit(1);
  const page = args.includes('--page');
  const files = page
    ? [
        {
          id: 'oldest',
          name: 'emori-nightly-2026-01-01T04-00-00-000Z-12345678-1234-4234-8234-123456789abc.tar.gz',
        },
        { id: 'legacy', name: 'emori-2025-01-01.tar.gz' },
        { id: 'near-match', name: 'emori-nightly-old.tar.gz' },
      ]
    : Array.from({ length: 5 }, (_, i) => ({
        id: `keep-${i}`,
        name: `emori-nightly-2026-11-${String(13 - i).padStart(2, '0')}T04-00-00-000Z-12345678-1234-4234-8234-123456789abc.tar.gz`,
      }));
  reply({
    files,
    nextPageToken: page ? '' : 'page2',
    has_more: !page,
    incompleteSearch: mode === 'incomplete',
  });
} else if (args[1] === 'delete') {
  if (mode === 'delete-failure') process.exit(1);
  reply({ deleted: true });
} else process.exit(3);
