import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';

import {
  activeMemoryPluginHealthy,
  activeMemoryPolicy,
  activeMemoryPolicyHealthy,
} from '../lib/setup/active-memory.js';
import { homebrewEnvironment, sqliteVectorPackage } from '../lib/setup/brew-dependencies.js';
import {
  canonPluginInspectionHealthy,
  canonSkillInspectionHealthy,
  configPathUnset,
  withoutCanonSkillDir,
} from '../lib/setup/canon-plugin.js';
import { codexPluginSource } from '../lib/setup/codex-plugin.js';
import {
  executionPolicy,
  executionPolicyHealthy,
  executionPolicyValues,
} from '../lib/setup/execution-policy.js';
import {
  imessagePluginInspectionHealthy,
  imessagePluginSource,
} from '../lib/setup/imessage-plugin.js';
import {
  imessageBindingsHealthy,
  imessageChannelHealthy,
  imessageRouting,
  imessageRoutingHealthy,
  imessageRoutingValues,
  nextImessageBindings,
  nextImessageChannel,
} from '../lib/setup/imessage-routing.js';
import {
  messagingPolicy,
  messagingPolicyHealthy,
  messagingPolicyValues,
  nextMessagingPolicy,
  nextMessagingToolGrants,
} from '../lib/setup/messaging-policy.js';
import {
  memoryConsolidationPolicy,
  memoryConsolidationPolicyHealthy,
  memoryCorePluginHealthy,
  memorySlotCompatible,
} from '../lib/setup/memory-consolidation.js';
import {
  memoryRecallPolicy,
  memoryRecallPolicyHealthy,
  memoryRecallStatusHealthy,
  sessionMemoryHookHealthy,
} from '../lib/setup/memory-recall.js';
import {
  memoryVectorStatusHealthy,
  memoryVectorStoreHealthy,
  memoryVectorStorePolicy,
  sqliteVectorExtensionPath,
} from '../lib/setup/memory-vector-store.js';
import { pluginInspectionHealthy } from '../lib/setup/plugin.js';
import { workshopPolicy, workshopPolicyHealthy } from '../lib/setup/workshop-policy.js';

describe('setup helper', () => {
  it('should keep every setup task entrypoint executable', () => {
    const scripts = readdirSync(new URL('../scripts/', import.meta.url)).filter((name) =>
      /^setup-.+-task\.js$/u.test(name),
    );
    assert.notEqual(scripts.length, 0);
    for (const script of scripts) {
      assert.notEqual(statSync(new URL(`../scripts/${script}`, import.meta.url)).mode & 0o111, 0);
    }
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

  it("should require EMORI's enabled default iMessage account and account route", () => {
    const channel = {
      enabled: true,
      defaultAccount: imessageRouting.accountId,
      accounts: { [imessageRouting.accountId]: { enabled: true } },
    };
    const bindings = [
      {
        type: 'route',
        agentId: imessageRouting.agentId,
        match: {
          channel: imessageRouting.channelId,
          accountId: imessageRouting.accountId,
        },
      },
    ];
    assert.equal(imessageChannelHealthy(channel), true);
    assert.equal(imessageBindingsHealthy(bindings), true);
    assert.equal(imessageRoutingHealthy(channel, bindings), true);
    assert.equal(imessageChannelHealthy({ ...channel, enabled: false }), false);
    assert.equal(
      imessageBindingsHealthy([{ ...bindings[0], session: { dmScope: 'main' } }]),
      false,
    );
    assert.equal(imessageRoutingHealthy(undefined, []), false);
  });

  it('should preserve iMessage policy and private settings while enabling EMORI', () => {
    assert.deepEqual(
      nextImessageChannel({
        dmPolicy: 'allowlist',
        groupPolicy: 'disabled',
        defaultTo: 'private-target',
        accounts: {
          emori: { dbPath: '/private/messages.db', includeAttachments: true },
          other: { enabled: false },
        },
      }),
      {
        dmPolicy: 'allowlist',
        groupPolicy: 'disabled',
        enabled: true,
        defaultAccount: 'emori',
        defaultTo: 'private-target',
        accounts: {
          emori: {
            enabled: true,
            dbPath: '/private/messages.db',
            includeAttachments: true,
          },
          other: { enabled: false },
        },
      },
    );
    assert.deepEqual(nextImessageChannel(), {
      dmPolicy: 'pairing',
      groupPolicy: 'allowlist',
      enabled: true,
      defaultAccount: 'emori',
      accounts: { emori: { enabled: true } },
    });
  });

  it('should preserve unrelated bindings and converge one sessionless EMORI route', () => {
    const current = [
      {
        type: 'route',
        agentId: 'other',
        comment: 'owned route',
        match: { channel: 'imessage', accountId: 'emori' },
        session: { dmScope: 'per-account-channel-peer' },
      },
      {
        type: 'route',
        agentId: 'duplicate',
        match: { channel: 'imessage', accountId: 'emori' },
      },
      {
        type: 'route',
        agentId: 'emori',
        match: { channel: 'imessage', accountId: 'default' },
      },
      {
        type: 'route',
        agentId: 'other',
        match: { channel: 'telegram', accountId: 'ops' },
      },
    ];

    assert.deepEqual(nextImessageBindings(current), [
      {
        type: 'route',
        agentId: 'emori',
        comment: 'owned route',
        match: { channel: 'imessage', accountId: 'emori' },
      },
      current[2],
      current[3],
    ]);
    assert.deepEqual(imessageRoutingValues(undefined, undefined), {
      bindings: undefined,
      channel: undefined,
    });
  });

  it('should require both EMORI execution policy values', () => {
    assert.equal(executionPolicyHealthy(executionPolicy.profile, executionPolicy.execMode), true);
    assert.equal(executionPolicyHealthy('full', executionPolicy.execMode), false);
    assert.equal(executionPolicyHealthy(executionPolicy.profile, 'ask'), false);
    assert.equal(executionPolicyHealthy(undefined, undefined), false);
  });

  it('should read only EMORI policy values from agent entries', () => {
    assert.deepEqual(
      executionPolicyValues({
        emori: {
          tools: {
            profile: executionPolicy.profile,
            alsoAllow: ['agent_system_git'],
            exec: { mode: executionPolicy.execMode, pathPrepend: ['/managed/launchers'] },
          },
        },
        main: { tools: { profile: 'minimal' } },
      }),
      executionPolicy,
    );
    assert.deepEqual(executionPolicyValues({ main: {} }), {
      execMode: undefined,
      profile: undefined,
    });
  });

  it('should require only the send message action and inherited routing defaults', () => {
    assert.equal(messagingPolicyHealthy(messagingPolicy, ['message']), true);
    assert.equal(messagingPolicyHealthy(messagingPolicy, ['agent_system_git']), false);
    assert.equal(
      messagingPolicyHealthy({ actions: { allow: ['send', 'read'] } }, ['message']),
      false,
    );
    assert.equal(
      messagingPolicyHealthy(
        {
          ...messagingPolicy,
          crossContext: { allowAcrossProviders: true },
        },
        ['message'],
      ),
      false,
    );
    assert.equal(messagingPolicyHealthy(undefined, ['message']), false);
  });

  it('should preserve unrelated EMORI grants and message settings while removing defaults', () => {
    const current = messagingPolicyValues({
      emori: {
        tools: {
          alsoAllow: ['agent_system_git', 'agent_system_github'],
          message: {
            actions: { allow: ['send', 'read'] },
            broadcast: { enabled: false },
            crossContext: {
              allowAcrossProviders: true,
              marker: { enabled: true, prefix: '[from {channel}] ' },
            },
          },
        },
      },
      main: { tools: { message: { actions: { allow: ['read'] } } } },
    });

    assert.deepEqual(nextMessagingToolGrants(current.alsoAllow), [
      'agent_system_git',
      'agent_system_github',
      'message',
    ]);
    assert.deepEqual(nextMessagingPolicy(current.message), {
      actions: { allow: ['send'] },
      broadcast: { enabled: false },
    });
    assert.deepEqual(messagingPolicyValues({ main: {} }), {
      alsoAllow: undefined,
      message: undefined,
    });
  });

  it('should allow Workshop proposals without autonomous publication or application', () => {
    assert.equal(workshopPolicy.autonomousMode, 'propose');
    assert.equal(workshopPolicyHealthy('propose'), true);
    assert.equal(workshopPolicyHealthy('off'), false);
    assert.equal(workshopPolicyHealthy('apply'), false);
    assert.equal(workshopPolicyHealthy(undefined), false);
  });

  it("should derive and require EMORI's agent-scoped SQLite vector store", () => {
    const extensionPath = sqliteVectorExtensionPath(
      '/opt/homebrew/lib/node_modules\n',
      'darwin',
      'arm64',
    );
    const expected = memoryVectorStorePolicy(extensionPath);

    assert.equal(
      extensionPath,
      '/opt/homebrew/lib/node_modules/sqlite-vec-darwin-arm64/vec0.dylib',
    );
    assert.equal(memoryVectorStoreHealthy(expected, expected), true);
    assert.equal(memoryVectorStoreHealthy({ extensionPath }, expected), false);
    assert.equal(
      memoryVectorStoreHealthy({ ...expected, extensionPath: '/tmp/vec0.dylib' }, expected),
      false,
    );
    assert.equal(
      memoryVectorStatusHealthy([{ agentId: 'emori', status: { vector: expected } }], expected),
      true,
    );
    assert.equal(
      memoryVectorStatusHealthy([{ agentId: 'other', status: { vector: expected } }], expected),
      false,
    );
  });

  it('should require private same-agent full-transcript recall without the legacy hook', () => {
    assert.equal(memoryRecallPolicyHealthy(memoryRecallPolicy), true);
    assert.equal(
      memoryRecallPolicyHealthy({ ...memoryRecallPolicy, sources: ['sessions', 'memory'] }),
      false,
    );
    assert.equal(
      memoryRecallPolicyHealthy({ ...memoryRecallPolicy, sessionVisibility: 'all' }),
      false,
    );
    assert.equal(
      memoryRecallPolicyHealthy({ ...memoryRecallPolicy, sessionMemoryHook: true }),
      false,
    );
    assert.equal(
      memoryRecallStatusHealthy([
        { agentId: 'emori', status: { sources: memoryRecallPolicy.sources } },
      ]),
      true,
    );
    assert.equal(
      memoryRecallStatusHealthy([
        { agentId: 'other', status: { sources: memoryRecallPolicy.sources } },
      ]),
      false,
    );
    assert.equal(
      sessionMemoryHookHealthy({
        hooks: [{ name: 'session-memory', disabled: true, enabledByConfig: false }],
      }),
      true,
    );
    assert.equal(
      sessionMemoryHookHealthy({
        hooks: [{ name: 'session-memory', disabled: false, enabledByConfig: true }],
      }),
      false,
    );
  });

  it('should require bounded Active Memory without transcript exports', () => {
    assert.equal(activeMemoryPolicyHealthy(activeMemoryPolicy), true);
    assert.equal(activeMemoryPolicyHealthy({ ...activeMemoryPolicy, mode: 'always' }), false);
    assert.equal(activeMemoryPolicyHealthy({ ...activeMemoryPolicy, timeoutMs: 45000 }), false);
    assert.equal(
      activeMemoryPolicyHealthy({ ...activeMemoryPolicy, persistTranscripts: true }),
      false,
    );
    assert.equal(
      activeMemoryPluginHealthy({
        plugin: {
          id: 'active-memory',
          enabled: true,
          origin: 'bundled',
          status: 'loaded',
        },
      }),
      true,
    );
    assert.equal(
      activeMemoryPluginHealthy({
        plugin: {
          id: 'active-memory',
          enabled: true,
          origin: 'external',
          status: 'loaded',
        },
      }),
      false,
    );
  });

  it('should enable bundled Memory Core dreaming without claiming its optional policy', () => {
    assert.equal(memoryConsolidationPolicyHealthy(memoryConsolidationPolicy), true);
    assert.equal(
      memoryConsolidationPolicyHealthy({
        ...memoryConsolidationPolicy,
        dreamingEnabled: false,
      }),
      false,
    );
    assert.equal(
      memoryCorePluginHealthy({
        plugin: {
          id: 'memory-core',
          enabled: true,
          origin: 'bundled',
          status: 'loaded',
          memorySlotSelected: true,
        },
      }),
      true,
    );
    assert.equal(
      memoryCorePluginHealthy({
        plugin: {
          id: 'memory-core',
          enabled: true,
          origin: 'bundled',
          status: 'loaded',
          memorySlotSelected: false,
        },
      }),
      false,
    );
    assert.equal(memorySlotCompatible(undefined), true);
    assert.equal(memorySlotCompatible('memory-core'), true);
    assert.equal(memorySlotCompatible('other-memory'), false);
  });
});
