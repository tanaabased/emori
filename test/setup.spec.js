import assert from 'node:assert/strict';
import { delimiter } from 'node:path';

import {
  configurationPatch,
  containsSubset,
  homebrewEnvironment,
  memoryPatch,
  mergeRouteBinding,
  setupGroups,
  sqliteVectorPackage,
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

  it('should keep managed launchers out of Homebrew child commands during setup', () => {
    const result = homebrewEnvironment({
      AGENT_SYSTEM_EXEC_AUTHORITY: 'authority',
      AGENT_SYSTEM_EXEC_CAPABILITY: 'capability',
      PATH: ['/managed/launchers', '/host/bin'].join(delimiter),
      PRESERVE: 'yes',
    });
    assert.equal(result.PATH, '/host/bin');
    assert.equal(result.AGENT_SYSTEM_EXEC_AUTHORITY, undefined);
    assert.equal(result.AGENT_SYSTEM_EXEC_CAPABILITY, undefined);
    assert.equal(result.HOMEBREW_NO_AUTO_UPDATE, '1');
    assert.equal(result.PRESERVE, 'yes');
  });

  it('should select platform-specific SQLite vector packages', () => {
    assert.equal(sqliteVectorPackage('darwin', 'arm64'), 'sqlite-vec-darwin-arm64');
    assert.equal(sqliteVectorPackage('darwin', 'x64'), 'sqlite-vec-darwin-x64');
    assert.throws(() => sqliteVectorPackage('linux', 'x64'), /unavailable for linux-x64/u);
  });
});
