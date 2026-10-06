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

function buildPatch(current = {}, operatorModelAdmissions = []) {
  return buildOpenClawConfigPatch(loadOpenClawConfigFragment(), current, {
    canonPath,
    home,
    vectorExtensionPath,
    operatorModelAdmissions,
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
    const patch = buildPatch(
      {
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
      },
      ['operator/custom-model'],
    );

    assert.deepEqual(patch.agents.entries.emori.tools.alsoAllow, [
      'agent_system_git',
      'agent_system_github',
      'message',
    ]);
    assert.deepEqual(patch.agents.entries.emori.modelPolicy.allow, [
      'operator/custom-model',
      'openai/gpt-6-astra',
      'openai/gpt-6-luna',
      'openai/gpt-6.1-sol',
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
    assert.equal(patch.agents.entries.emori.models['openai/gpt-6-astra'].agentRuntime.id, 'codex');
    assert.equal(patch.agents.entries.emori.models['openai/gpt-6-luna'].agentRuntime.id, 'codex');
    assert.equal(patch.agents.entries.emori.models['openai/gpt-6.1-sol'].agentRuntime.id, 'codex');
    assert.equal(patch.agents.entries.emori.models['openai/gpt-6-sol'], null);
    assert.deepEqual(patch.agents.entries.emori.modelPolicy.allow, [
      'openai/gpt-6-astra',
      'openai/gpt-6-luna',
      'openai/gpt-6.1-sol',
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

  it('should migrate the existing six-model allowlist to GPT-6.1 and converge', () => {
    const current = {
      agents: {
        entries: {
          emori: {
            modelPolicy: {
              allow: [
                'openai/gpt-5.5',
                'openai/gpt-5.6-sol',
                'openai/gpt-6-astra',
                'openai/gpt-5.6-terra',
                'openai/gpt-6-luna',
                'openai/gpt-6-sol',
              ],
            },
          },
        },
      },
    };
    const patch = buildPatch(current);
    assert.deepEqual(patch.agents.entries.emori.modelPolicy.allow, [
      'openai/gpt-6-astra',
      'openai/gpt-6-luna',
      'openai/gpt-6.1-sol',
    ]);
    assert.equal(configPatchSatisfied(current, patch), false);

    const reconciled = structuredClone(patch);
    delete reconciled.agents.entries.emori.models['openai/gpt-6-sol'];
    delete reconciled.agents.entries.emori.tools.message.crossContext;
    assert.equal(configPatchSatisfied(reconciled, buildPatch(reconciled)), true);
    assert.equal(current.agents.entries.emori.modelPolicy.allow.length, 6);
  });

  it('should remove retired workspace admissions while retaining operator and other-agent policy', () => {
    const fragment = loadOpenClawConfigFragment();
    fragment.agents.entries.emori.modelPolicy.allow = ['openai/gpt-6-astra'];
    const current = {
      agents: {
        entries: {
          emori: {
            models: {
              'openai/gpt-6-sol': { agentRuntime: { id: 'codex' } },
              'operator/custom-model': { agentRuntime: { id: 'custom' } },
            },
            modelPolicy: {
              allow: ['openai/gpt-6-astra', 'openai/gpt-6-sol', 'operator/custom-model'],
            },
            tools: { alsoAllow: ['agent_system_git'] },
          },
          other: { modelPolicy: { allow: ['openai/gpt-6-sol'] } },
        },
      },
    };
    const options = {
      canonPath,
      home,
      vectorExtensionPath,
      operatorModelAdmissions: ['operator/custom-model'],
    };
    const patch = buildOpenClawConfigPatch(fragment, current, options);

    assert.deepEqual(patch.agents.entries.emori.modelPolicy.allow, [
      'operator/custom-model',
      'openai/gpt-6-astra',
    ]);
    assert.deepEqual(patch.agents.entries.emori.tools.alsoAllow, ['agent_system_git', 'message']);
    assert.equal(patch.agents.entries.emori.models['openai/gpt-6-sol'], null);
    assert.equal(patch.agents.entries.other, undefined);
    assert.equal(configPatchSatisfied(current, patch), false);

    const reconciled = structuredClone(patch);
    reconciled.agents.entries.other = structuredClone(current.agents.entries.other);
    delete reconciled.agents.entries.emori.models['openai/gpt-6-sol'];
    reconciled.agents.entries.emori.models['operator/custom-model'] = structuredClone(
      current.agents.entries.emori.models['operator/custom-model'],
    );
    delete reconciled.agents.entries.emori.tools.message.crossContext;
    assert.equal(configPatchSatisfied(reconciled, patch), true);
    const repeatedPatch = buildOpenClawConfigPatch(fragment, reconciled, options);
    assert.deepEqual(
      repeatedPatch.agents.entries.emori.modelPolicy.allow,
      patch.agents.entries.emori.modelPolicy.allow,
    );
    assert.equal(configPatchSatisfied(reconciled, repeatedPatch), true);
    assert.deepEqual(reconciled.agents.entries.other.modelPolicy.allow, ['openai/gpt-6-sol']);
    assert.deepEqual(reconciled.agents.entries.emori.models['operator/custom-model'], {
      agentRuntime: { id: 'custom' },
    });
  });

  it('should report unresolved or conflicting model admission ownership', () => {
    const current = {
      agents: { entries: { emori: { modelPolicy: { allow: ['operator/custom-model'] } } } },
    };
    assert.throws(
      () => buildPatch(current),
      /Unresolved model admission ownership: operator\/custom-model/u,
    );
    assert.throws(
      () => buildPatch(current, ['openai/gpt-6-sol']),
      /Model admission ownership conflicts: openai\/gpt-6-sol/u,
    );
  });

  it('should recognize a converged patch including deletions and exact arrays', () => {
    const patch = buildPatch();
    const current = structuredClone(patch);
    delete current.agents.entries.emori.models['openai/gpt-6-sol'];
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
