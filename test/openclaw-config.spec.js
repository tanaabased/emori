import assert from 'node:assert/strict';

import {
  buildOpenClawConfigPatch,
  configPatchSatisfied,
  loadOpenClawConfigFragment,
  memoryStatusHealthy,
  nextImessageBindings,
  sessionMemoryHookHealthy,
  sqliteVectorExtensionPath,
  withoutCanonSkillDir,
} from '../lib/setup/openclaw-config.js';

const home = '/Users/emori';
const canonPath = `${home}/tanaab/canon`;
const vectorExtensionPath = '/opt/homebrew/lib/node_modules/sqlite-vec-darwin-arm64/vec0.dylib';

function buildPatch(current = {}) {
  return buildOpenClawConfigPatch(loadOpenClawConfigFragment(), current, {
    canonPath,
    home,
    vectorExtensionPath,
  });
}

describe('lib/setup/openclaw-config', () => {
  it('should derive the installed platform-specific vector extension path', () => {
    assert.equal(
      sqliteVectorExtensionPath('/opt/homebrew/lib/node_modules\n', 'darwin', 'arm64'),
      vectorExtensionPath,
    );
  });

  it('should preserve shared grants and leave model admission to the manifest', () => {
    const unrelatedBinding = {
      type: 'route',
      agentId: 'other',
      match: { channel: 'telegram', accountId: 'ops' },
    };
    const current = {
      agents: {
        entries: {
          emori: {
            tools: { alsoAllow: ['agent_system_git', 'agent_system_github'] },
            modelPolicy: { allow: ['openai/gpt-6-astra', 'operator/custom-model'] },
          },
        },
      },
      bindings: [
        {
          type: 'route',
          agentId: 'other',
          comment: 'preserve this metadata',
          match: { channel: 'imessage', accountId: 'emori' },
          session: { dmScope: 'main' },
        },
        {
          type: 'route',
          agentId: 'duplicate',
          match: { channel: 'imessage', accountId: 'emori' },
        },
        unrelatedBinding,
      ],
    };
    const patch = buildPatch(current);

    assert.deepEqual(patch.agents.entries.emori.tools.alsoAllow, [
      'agent_system_git',
      'agent_system_github',
      'message',
    ]);
    assert.equal(patch.agents.entries.emori.modelPolicy, undefined);
    assert.deepEqual(current.agents.entries.emori.modelPolicy.allow, [
      'openai/gpt-6-astra',
      'operator/custom-model',
    ]);
    assert.deepEqual(patch.bindings, [
      {
        type: 'route',
        agentId: 'emori',
        comment: 'preserve this metadata',
        match: { channel: 'imessage', accountId: 'emori' },
      },
      unrelatedBinding,
    ]);
  });

  it('should preserve explicit iMessage access policy and remove only Canon skill discovery', () => {
    const patch = buildPatch({
      channels: { imessage: { dmPolicy: 'allowlist', groupPolicy: 'disabled' } },
      skills: {
        load: { extraDirs: ['~/tanaab/canon/skills', '/opt/shared-skills'] },
      },
    });

    assert.equal(patch.channels.imessage.dmPolicy, undefined);
    assert.equal(patch.channels.imessage.groupPolicy, undefined);
    assert.deepEqual(patch.skills.load.extraDirs, ['/opt/shared-skills']);
    assert.deepEqual(withoutCanonSkillDir(['~/tanaab/canon/skills'], canonPath, home), []);
  });

  it('should preserve a shared iMessage default, other account, and route', () => {
    const otherAccount = { enabled: true, name: 'operator account' };
    const otherRoute = {
      type: 'route',
      agentId: 'operator',
      match: { channel: 'imessage', accountId: 'operator' },
    };
    const current = {
      channels: {
        imessage: {
          enabled: true,
          defaultAccount: 'operator',
          accounts: { operator: otherAccount },
        },
      },
      bindings: [otherRoute],
    };

    const patch = buildPatch(current);

    assert.equal(patch.channels.imessage.defaultAccount, undefined);
    assert.deepEqual(patch.channels.imessage.accounts, { emori: { enabled: true } });
    assert.equal(current.channels.imessage.defaultAccount, 'operator');
    assert.deepEqual(current.channels.imessage.accounts.operator, otherAccount);
    assert.deepEqual(patch.bindings, [otherRoute, loadOpenClawConfigFragment().bindings[0]]);
  });

  it('should establish the iMessage default on a fresh profile and converge on repeat', () => {
    const initialPatch = buildPatch();
    assert.equal(initialPatch.channels.imessage.defaultAccount, 'emori');

    const repeatedPatch = buildPatch(initialPatch);
    assert.equal(repeatedPatch.channels.imessage.defaultAccount, undefined);
    assert.equal(
      configPatchSatisfied(initialPatch.channels.imessage, repeatedPatch.channels.imessage),
      true,
    );
  });

  it('should carry every owned static policy through one patch', () => {
    const patch = buildPatch();
    assert.equal(patch.agents.entries.emori.models, undefined);
    assert.equal(patch.agents.entries.emori.modelPolicy, undefined);
    assert.equal(patch.agents.entries.emori.tools.profile, 'coding');
    assert.equal(patch.agents.entries.emori.tools.exec.mode, 'auto');
    assert.deepEqual(patch.agents.entries.emori.tools.message.actions.allow, ['send']);
    assert.equal(patch.agents.entries.emori.tools.message.crossContext, null);
    assert.equal(
      patch.agents.entries.emori.memory.search.store.vector.extensionPath,
      vectorExtensionPath,
    );
    assert.deepEqual(patch.agents.entries.emori.memory.search.sources, ['memory', 'sessions']);
    assert.equal(patch.hooks.internal.entries['session-memory'].enabled, false);
    assert.equal(patch.skills.workshop.autonomous.mode, 'propose');
    assert.equal(patch.tools, undefined);
  });

  it('should leave collaboration-managed session visibility untouched and converge', () => {
    const current = buildPatch();
    delete current.agents.entries.emori.tools.message.crossContext;
    current.tools = { sessions: { visibility: 'all' } };
    const patch = buildPatch(current);

    assert.equal(patch.tools, undefined);
    assert.equal(current.tools.sessions.visibility, 'all');
    assert.equal(configPatchSatisfied(current, patch), true);
  });

  it('should preserve manifest-created runtime bindings, model access, fallbacks, and effort', () => {
    const modelConfiguration = {
      model: { primary: 'openai/gpt-6-astra', fallbacks: ['openai/gpt-6-luna'] },
      thinkingDefault: 'high',
      models: {
        'openai/gpt-6-astra': {
          agentRuntime: { id: 'codex' },
          params: { reasoningEffort: 'high' },
        },
        'openai/gpt-6-luna': {
          agentRuntime: { id: 'codex' },
          params: { reasoningEffort: 'medium' },
        },
      },
      modelPolicy: { allow: ['openai/gpt-6-astra', 'openai/gpt-6-luna'] },
    };
    const current = buildPatch();
    Object.assign(current.agents.entries.emori, structuredClone(modelConfiguration));
    delete current.agents.entries.emori.tools.message.crossContext;
    const before = structuredClone(current);
    const patch = buildPatch(current);

    assert.equal(configPatchSatisfied(current, patch), true);
    assert.equal(patch.agents.entries.emori.models, undefined);
    assert.equal(patch.agents.entries.emori.modelPolicy, undefined);
    assert.deepEqual(current, before);
  });

  it('should not manage model defaults, effort profiles, or other agents', () => {
    const current = {
      agents: {
        defaults: {
          model: { primary: 'openai/gpt-6-luna' },
          models: { 'openai/gpt-6-luna': { params: { reasoningEffort: 'medium' } } },
        },
        entries: { other: { models: { 'openai/custom': { agentRuntime: { id: 'custom' } } } } },
      },
    };
    const before = structuredClone(current);
    const patch = buildPatch(current);

    assert.deepEqual(current, before);
    assert.equal(patch.agents.defaults, undefined);
    assert.equal(patch.agents.entries.other, undefined);
    assert.equal(patch.agents.entries.emori.models, undefined);
    assert.equal(patch.agents.entries.emori.modelPolicy, undefined);
  });

  it('should converge without changing manifest-created model settings', () => {
    const current = buildPatch();
    current.agents.entries.emori.model = {
      primary: 'openai/gpt-6-astra',
      fallbacks: ['openai/gpt-6-luna'],
    };
    current.agents.entries.emori.thinkingDefault = 'high';
    current.agents.entries.emori.models = {
      'openai/gpt-6-astra': { agentRuntime: { id: 'codex' } },
    };
    current.agents.entries.emori.modelPolicy = { allow: ['openai/gpt-6-astra'] };
    delete current.agents.entries.emori.tools.message.crossContext;
    const before = structuredClone(current);
    const patch = buildPatch(current);

    assert.equal(configPatchSatisfied(current, patch), true);
    assert.equal(patch.agents.entries.emori.models, undefined);
    assert.equal(patch.agents.entries.emori.modelPolicy, undefined);
    assert.deepEqual(current, before);
  });

  it('should leave model defaults, effort profiles, and other agent settings outside the patch', () => {
    const current = {
      agents: {
        defaults: {
          model: { primary: 'openai/gpt-6-luna' },
          models: { 'openai/gpt-6-luna': { params: { reasoningEffort: 'medium' } } },
        },
        entries: { other: { models: { 'openai/custom': { agentRuntime: { id: 'custom' } } } } },
      },
    };
    const before = structuredClone(current);
    const patch = buildPatch(current);

    assert.deepEqual(current, before);
    assert.equal(patch.agents.defaults, undefined);
    assert.equal(patch.agents.entries.other, undefined);
    assert.equal(patch.agents.entries.emori.models, undefined);
    assert.equal(patch.agents.entries.emori.modelPolicy, undefined);
  });

  it('should recognize a converged patch including deletions and exact arrays', () => {
    const patch = buildPatch();
    const current = structuredClone(patch);
    delete current.agents.entries.emori.tools.message.crossContext;
    assert.equal(configPatchSatisfied(current, patch), true);

    current.agents.entries.emori.memory.search.sources = ['sessions', 'memory'];
    assert.equal(configPatchSatisfied(current, patch), false);
  });

  it('should require the configured memory runtime and disabled legacy hook', () => {
    assert.equal(
      memoryStatusHealthy(
        [
          {
            agentId: 'emori',
            status: {
              sources: ['memory', 'sessions'],
              vector: { enabled: true, extensionPath: vectorExtensionPath },
            },
          },
        ],
        vectorExtensionPath,
      ),
      true,
    );
    assert.equal(memoryStatusHealthy([], vectorExtensionPath), false);
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

  it('should reject malformed shared arrays before replacing them', () => {
    assert.throws(
      () => buildPatch({ agents: { entries: { emori: { tools: { alsoAllow: 'message' } } } } }),
      /additional tool grants must be an array of strings/u,
    );
    assert.throws(() => buildPatch({ bindings: {} }), /bindings are invalid/u);
    assert.throws(
      () => buildPatch({ skills: { load: { extraDirs: [42] } } }),
      /extra skill directories must be an array of strings/u,
    );
  });

  it('should append a route when no owned route exists', () => {
    const desired = loadOpenClawConfigFragment().bindings[0];
    assert.deepEqual(nextImessageBindings([], desired), [desired]);
  });
});
