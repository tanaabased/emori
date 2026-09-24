import assert from 'node:assert/strict';

import {
  homebrewEnvironment,
  officialPluginSources,
  pluginInspectionHealthy,
  setupIds,
  sqliteVectorPackage,
} from '../scripts/setup.js';

describe('setup helper', () => {
  it('should expose only the verified setup prefix', () => {
    assert.deepEqual(setupIds, [
      'brew-dependencies',
      'canon-checkout',
      'canon-plugin',
      'codex-plugin',
    ]);
  });

  it('should preserve Agent System routing for Homebrew child commands', () => {
    const result = homebrewEnvironment({
      AGENT_SYSTEM_EXEC_AUTHORITY: 'authority',
      AGENT_SYSTEM_EXEC_CAPABILITY: 'capability',
      PATH: '/managed/launchers:/host/bin',
      PRESERVE: 'yes',
    });
    assert.equal(result.PATH, '/managed/launchers:/host/bin');
    assert.equal(result.AGENT_SYSTEM_EXEC_AUTHORITY, 'authority');
    assert.equal(result.AGENT_SYSTEM_EXEC_CAPABILITY, 'capability');
    assert.equal(result.HOMEBREW_NO_AUTO_UPDATE, '1');
    assert.equal(result.PRESERVE, 'yes');
  });

  it('should select platform-specific SQLite vector packages', () => {
    assert.equal(sqliteVectorPackage('darwin', 'arm64'), 'sqlite-vec-darwin-arm64');
    assert.equal(sqliteVectorPackage('darwin', 'x64'), 'sqlite-vec-darwin-x64');
    assert.throws(() => sqliteVectorPackage('linux', 'x64'), /unavailable for linux-x64/u);
  });

  it('should accept only the enabled healthy requested plugin', () => {
    assert.equal(
      pluginInspectionHealthy(
        { plugin: { id: 'tanaab', enabled: true, status: 'loaded' } },
        'tanaab',
      ),
      true,
    );
    assert.equal(
      pluginInspectionHealthy(
        { plugin: { id: 'tanaab', enabled: false, status: 'disabled' } },
        'tanaab',
      ),
      false,
    );
    assert.equal(
      pluginInspectionHealthy(
        { plugin: { id: 'other', enabled: true, status: 'loaded' } },
        'tanaab',
      ),
      false,
    );
  });

  it('should install Codex from the official ClawHub source', () => {
    assert.equal(officialPluginSources.codex, 'clawhub:@openclaw/codex');
  });
});
