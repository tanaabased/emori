import assert from 'node:assert/strict';

import { homebrewEnvironment, sqliteVectorPackage } from '../lib/setup/brew-dependencies.js';
import {
  canonPluginInspectionHealthy,
  canonSkillInspectionHealthy,
  configPathUnset,
  withoutCanonSkillDir,
} from '../lib/setup/canon-plugin.js';
import { codexPluginSource } from '../lib/setup/codex-plugin.js';
import { executionPolicy, executionPolicyHealthy } from '../lib/setup/execution-policy.js';
import {
  imessagePluginInspectionHealthy,
  imessagePluginSource,
} from '../lib/setup/imessage-plugin.js';
import { pluginInspectionHealthy } from '../lib/setup/plugin.js';

describe('setup helper', () => {
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

  it('should require Canon to be linked with its accepted skill surface', () => {
    const canon = '/Users/emori/tanaab/canon';
    assert.equal(
      canonPluginInspectionHealthy(
        {
          plugin: { id: 'tanaab', enabled: true, status: 'loaded', rootDir: canon },
          install: {
            source: 'path',
            sourcePath: canon,
            acceptedSurface: { skills: ['./skills'] },
          },
        },
        canon,
      ),
      true,
    );
    assert.equal(
      canonPluginInspectionHealthy(
        {
          plugin: { id: 'tanaab', enabled: true, status: 'loaded', rootDir: canon },
          install: { source: 'path', sourcePath: canon, acceptedSurface: { skills: [] } },
        },
        canon,
      ),
      false,
    );
  });

  it('should require representative Canon skills from the plugin-managed index', () => {
    assert.equal(
      canonSkillInspectionHealthy({
        name: 'tanaab-project-optimizer',
        eligible: true,
        disabled: false,
        filePath: '/tmp/openclaw/plugin-skills/project-optimizer/SKILL.md',
      }),
      true,
    );
    assert.equal(
      canonSkillInspectionHealthy({
        name: 'tanaab-project-optimizer',
        eligible: true,
        disabled: false,
        filePath: '/Users/emori/tanaab/canon/skills/project-optimizer/SKILL.md',
      }),
      false,
    );
  });

  it('should recognize only an explicitly unset config path', () => {
    assert.equal(
      configPathUnset(
        {
          status: 1,
          stdout: JSON.stringify({
            ok: false,
            error: {
              message:
                'Config path is valid but unset: skills.load.extraDirs. The runtime default applies.',
            },
          }),
        },
        'skills.load.extraDirs',
      ),
      true,
    );
    assert.equal(
      configPathUnset({ status: 1, stdout: '{"ok":false}' }, 'skills.load.extraDirs'),
      false,
    );
  });

  it('should remove only Canon from extra skill directories', () => {
    assert.deepEqual(
      withoutCanonSkillDir(
        ['~/tanaab/canon/skills', '/opt/shared-skills'],
        '/Users/emori/tanaab/canon',
        '/Users/emori',
      ),
      ['/opt/shared-skills'],
    );
  });

  it('should install Codex from the official ClawHub source', () => {
    assert.equal(codexPluginSource, 'clawhub:@openclaw/codex');
  });

  it('should require the official iMessage channel plugin', () => {
    assert.equal(imessagePluginSource, '@openclaw/imessage');
    assert.equal(
      imessagePluginInspectionHealthy({
        plugin: {
          id: 'imessage',
          enabled: true,
          status: 'loaded',
          packageName: '@openclaw/imessage',
          channelIds: ['imessage'],
        },
        install: { resolvedName: '@openclaw/imessage' },
      }),
      true,
    );
    assert.equal(
      imessagePluginInspectionHealthy({
        plugin: {
          id: 'imessage',
          enabled: true,
          status: 'loaded',
          packageName: '@other/imessage',
          channelIds: ['imessage'],
        },
        install: { resolvedName: '@other/imessage' },
      }),
      false,
    );
  });

  it('should require EMORI execution policy without rejecting Agent System grants', () => {
    const tools = {
      profile: executionPolicy.profile,
      alsoAllow: ['agent_system_git', 'agent_system_github'],
      exec: {
        mode: executionPolicy.execMode,
        pathPrepend: ['/managed/launchers'],
      },
    };
    assert.equal(executionPolicyHealthy(tools), true);
    assert.equal(executionPolicyHealthy({ ...tools, profile: 'full' }), false);
    assert.equal(executionPolicyHealthy({ ...tools, exec: { ...tools.exec, mode: 'ask' } }), false);
  });
});
