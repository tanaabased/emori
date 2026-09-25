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

  it('should preserve shared grants and model admission while reconciling one EMORI iMessage route', () => {
    const unrelatedBinding = {
      type: 'route',
      agentId: 'other',
      match: { channel: 'telegram', accountId: 'ops' },
    };
    const patch = buildPatch({
      agents: {
        entries: {
          emori: {
            tools: { alsoAllow: ['agent_system_git', 'agent_system_github'] },
            modelPolicy: { allow: ['openai/gpt-6-astra', 'openai/gpt-5.6-sol'] },
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
    });

    assert.deepEqual(patch.agents.entries.emori.tools.alsoAllow, [
      'agent_system_git',
      'agent_system_github',
      'message',
    ]);
    assert.deepEqual(patch.agents.entries.emori.modelPolicy.allow, [
      'openai/gpt-6-astra',
      'openai/gpt-5.6-sol',
      'openai/gpt-6-luna',
      'openai/gpt-6-sol',
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

  it('should carry every owned static policy through one patch', () => {
    const patch = buildPatch();
    assert.equal(patch.agents.entries.emori.models['openai/gpt-6-luna'].agentRuntime.id, 'codex');
    assert.equal(patch.agents.entries.emori.models['openai/gpt-6-sol'].agentRuntime.id, 'codex');
    assert.deepEqual(patch.agents.entries.emori.modelPolicy.allow, [
      'openai/gpt-6-luna',
      'openai/gpt-6-sol',
    ]);
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
    assert.equal(patch.tools.sessions.visibility, 'agent');
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
    assert.throws(
      () => buildPatch({ agents: { entries: { emori: { modelPolicy: { allow: 'all' } } } } }),
      /model allowlist must be an array of strings/u,
    );
  });

  it('should append a route when no owned route exists', () => {
    const desired = loadOpenClawConfigFragment().bindings[0];
    assert.deepEqual(nextImessageBindings([], desired), [desired]);
  });
});
