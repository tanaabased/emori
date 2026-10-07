import assert from 'node:assert/strict';

import checkDriveFile from '../utils/check-drive-file.js';

describe('verified Drive archive identity', () => {
  const archive = { name: 'emori-test.tar.gz', size: 12, sha256: 'source-sha', md5: 'source-md5' };
  const file = {
    id: 'owned-id',
    name: archive.name,
    size: '12',
    sha256Checksum: archive.sha256,
    md5Checksum: archive.md5,
    mimeType: 'application/gzip',
    parents: ['folder'],
    ownedByMe: true,
  };

  it('accepts the exact owned archive in the one designated parent', () => {
    assert.equal(checkDriveFile(file, archive, 'folder'), true);
  });

  for (const change of [
    { ownedByMe: false },
    { parents: ['other'] },
    { parents: ['folder', 'other'] },
    { sha256Checksum: 'corrupt' },
    { md5Checksum: undefined },
    { size: '13' },
    { name: 'unrelated' },
    { trashed: true },
    { mimeType: 'application/vnd.google-apps.document' },
  ]) {
    it(`rejects changed ${Object.keys(change)[0]}`, () => {
      assert.equal(checkDriveFile({ ...file, ...change }, archive, 'folder'), false);
    });
  }
});
