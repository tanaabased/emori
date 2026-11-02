import assert from 'node:assert/strict';

import sanitizeDiagnostic from '../utils/sanitize-diagnostic.js';

describe('lib/update-shared-sources/utils/sanitize-diagnostic', () => {
  it('should retain useful errors while removing credentials and control sequences', () => {
    const text = sanitizeDiagnostic(
      '\x1b[31mlockfile changed\x1b[0m https://user:pass@example.test token=unknown GH_TOKEN_VALUE github_pat_example',
      { GH_TOKEN: 'GH_TOKEN_VALUE' },
    );
    assert.match(text, /lockfile changed/);
    assert.doesNotMatch(text, /user:pass|unknown|GH_TOKEN_VALUE|github_pat_example/);
    assert.equal(text.includes('\x1b'), false);
  });
  it('should bound diagnostics after redacting multiline keys', () => {
    const text = sanitizeDiagnostic(
      '-----BEGIN OPENSSH PRIVATE KEY-----\nprivate\n-----END OPENSSH PRIVATE KEY-----' +
        'x'.repeat(5000),
    );
    assert.equal(text.length, 4096);
    assert.doesNotMatch(text, /private/);
  });
});
