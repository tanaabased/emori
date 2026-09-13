import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import publishSkillDirectory from '../utils/publish-skill-directory.js';

describe('skills/skill-author/utils/publish-skill-directory', () => {
  let root;
  let staged;
  let destination;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'emori-publish-'));
    staged = path.join(root, 'candidate');
    destination = path.join(root, 'skill');
    await mkdir(staged);
    await writeFile(path.join(staged, 'new.txt'), 'new');
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  async function originalSkill() {
    await mkdir(destination);
    await writeFile(path.join(destination, 'old.txt'), 'original work');
  }

  it('should never replace an existing destination without force', async () => {
    await originalSkill();
    await assert.rejects(publishSkillDirectory(staged, destination), { code: 'EEXIST' });
    assert.equal(await readFile(path.join(destination, 'old.txt'), 'utf8'), 'original work');
    assert.equal(await readFile(path.join(staged, 'new.txt'), 'utf8'), 'new');
  });

  it('should restore the original directory if publishing the candidate fails', async () => {
    await originalSkill();
    const failure = new Error('simulated rename failure');
    await assert.rejects(
      publishSkillDirectory(staged, destination, {
        force: true,
        renameDirectory: async (from, to) => {
          if (from === staged) throw failure;
          await rename(from, to);
        },
      }),
      (error) => error === failure,
    );
    assert.equal(await readFile(path.join(destination, 'old.txt'), 'utf8'), 'original work');
    assert.deepEqual((await readdir(root)).sort(), ['candidate', 'skill']);
  });

  it('should retain and report the backup if restoration also fails', async () => {
    await originalSkill();
    let backup;
    await assert.rejects(
      publishSkillDirectory(staged, destination, {
        force: true,
        renameDirectory: async (from, to) => {
          if (from === destination) {
            backup = to;
            return rename(from, to);
          }
          throw new Error('simulated failure');
        },
      }),
      (error) => error instanceof AggregateError && error.message.includes(backup),
    );
    assert.equal(await readFile(path.join(backup, 'old.txt'), 'utf8'), 'original work');
  });

  it('should remove only its empty reservation when a first publication fails', async () => {
    await assert.rejects(
      publishSkillDirectory(staged, destination, {
        renameDirectory: async () => {
          throw new Error('simulated failure');
        },
      }),
      /simulated failure/,
    );
    assert.deepEqual(await readdir(root), ['candidate']);
  });
});
