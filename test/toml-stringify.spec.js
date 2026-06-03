import assert from 'node:assert/strict';

import { stringifyToml } from '../utils/toml-stringify.js';

describe('utils/toml-stringify', () => {
  it('should render root scalars and nested tables deterministically', () => {
    assert.equal(
      stringifyToml({
        personality: 'pragmatic',
        features: {
          memories: true,
          multi_agent: false,
        },
      }),
      'personality = "pragmatic"\n\n[features]\nmemories = true\nmulti_agent = false\n',
    );
  });

  it('should quote dotted keys and render table arrays', () => {
    assert.equal(
      stringifyToml({
        projects: [
          {
            'repo.path': {
              trust_level: 'trusted',
            },
          },
        ],
      }),
      '[[projects]]\n\n[projects."repo.path"]\ntrust_level = "trusted"\n',
    );
  });
});
