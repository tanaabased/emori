import assert from 'node:assert/strict';

import checkCheckout from '../utils/check-checkout.js';

const source = { id: 'canon' };
const snapshot = {
  canonical: true,
  identity: '/canonical/canon',
  branch: 'main',
  clean: true,
  upstream: 'origin/main',
  remote: 'https://github.com/tanaabased/canon.git',
  head: 'a'.repeat(40),
};

describe('lib/update-shared-sources/utils/check-checkout', () => {
  it('should not require a checkout-use reservation', () => {
    for (const reserved of [undefined, false, true])
      assert.equal(checkCheckout(source, { ...snapshot, reserved }), undefined);
  });
  it('should accept canonical clean main with the expected upstream', () => {
    assert.equal(checkCheckout(source, snapshot), undefined);
    assert.equal(
      checkCheckout(source, { ...snapshot, remote: 'git@github.com:tanaabased/canon.git' }),
      undefined,
    );
  });

  for (const [change, reason] of [
    [{ canonical: false }, 'noncanonical'],
    [{ identity: '' }, 'noncanonical'],
    [{ branch: 'feature' }, 'non-main'],
    [{ branch: null }, 'detached'],
    [{ clean: false }, 'dirty-or-unknown'],
    [{ clean: undefined }, 'dirty-or-unknown'],
    [{ upstream: 'origin/other' }, 'unsafe-upstream'],
    [{ remote: 'https://github.com/attacker/canon.git' }, 'unsafe-upstream'],
    [{ remote: 'https://token@github.com/tanaabased/canon.git' }, 'unsafe-upstream'],
    [{ head: '-HEAD' }, 'unknown-revision'],
  ]) {
    it(`should refuse ${JSON.stringify(change)} as ${reason}`, () => {
      assert.equal(checkCheckout(source, { ...snapshot, ...change }), reason);
    });
  }

  it('should detect a changed checkout identity or revision on revalidation', () => {
    for (const change of [{ identity: '/different' }, { head: 'b'.repeat(40) }])
      assert.equal(checkCheckout(source, { ...snapshot, ...change }, snapshot), 'checkout-changed');
    assert.equal(checkCheckout({ id: 'emori' }, snapshot), 'unsupported');
  });
});
