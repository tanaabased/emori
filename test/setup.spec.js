import assert from 'node:assert/strict';

import {
  configurationPatch,
  containsSubset,
  memoryPatch,
  mergeRouteBinding,
  setupGroups,
} from '../scripts/setup.js';

describe('setup helper', () => {
  it('should retain the four dependency-ordered setup groups', () => {
    assert.deepEqual(setupGroups, ['dependencies', 'plugins', 'configuration', 'memory']);
  });

  it('should compare owned configuration without rejecting unrelated state', () => {
    assert.equal(
      containsSubset(
        { owned: { enabled: true, nested: 'ready' }, unrelated: { preserved: true } },
        { owned: { enabled: true } },
      ),
      true,
    );
    assert.equal(containsSubset({ owned: false }, { owned: true }), false);
  });

  it('should preserve unrelated bindings while adding EMORI session isolation', () => {
    const unrelated = {
      type: 'route',
      agentId: 'other',
      match: { channel: 'telegram', accountId: 'other' },
    };
    const existing = {
      type: 'route',
      agentId: 'emori',
      comment: 'preserve this',
      match: { channel: 'imessage', accountId: 'emori' },
    };
    const result = mergeRouteBinding([unrelated, existing]);
    assert.deepEqual(result[0], unrelated);
    assert.equal(result[1].comment, 'preserve this');
    assert.equal(result[1].session.dmScope, 'per-account-channel-peer');
  });

  it('should keep Agent System-owned secrets and model selection out of setup patches', () => {
    const serialized = JSON.stringify({ configurationPatch, memoryPatch });
    assert.doesNotMatch(serialized, /apiKey|credential|primary|fallbacks/u);
    assert.equal(memoryPatch.agents.entries.emori.memory.search.provider, undefined);
    assert.equal(memoryPatch.agents.entries.emori.memory.search.model, undefined);
  });
});
