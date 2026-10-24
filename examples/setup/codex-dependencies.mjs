import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const [systemReport, codexReport] = process.argv.slice(2);
const system = readJson(systemReport);
const codex = readJson(codexReport);
const owner = readJson(join(system.plugin.rootDir, 'package.json'));
const pluginPath = join(codex.plugin.rootDir, 'package.json');
const plugin = readJson(pluginPath);
const cli = readJson(createRequire(pluginPath).resolve('@openai/codex/package.json'));

assert.equal(codex.plugin.enabled, true);
assert.notEqual(codex.plugin.status, 'error');
assert.equal(`${plugin.name}@${plugin.version}`, owner.openclaw.agentSystem.codexPlugin);
assert.equal(codex.install.resolvedName, plugin.name);
assert.equal(codex.install.version, plugin.version);
assert.equal(cli.name, '@openai/codex');
assert.equal(cli.version, plugin.dependencies['@openai/codex']);
process.stdout.write(`${plugin.name}@${plugin.version} -> ${cli.name}@${cli.version}\n`);
