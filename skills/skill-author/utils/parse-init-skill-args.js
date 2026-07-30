const VALUE_OPTIONS = new Set([
  '--category-tag',
  '--description',
  '--display-name',
  '--emoji',
  '--homepage',
  '--output-dir',
  '--prompt',
  '--slug',
  '--type',
]);

/**
 * Parses the internal EMORI skill initializer arguments.
 *
 * @param {string[]} argv Raw argument tokens.
 * @param {string} defaultOutputDir Default skill parent directory.
 * @returns {object} Parsed initializer options.
 * @throws {Error} When an option is unknown, is missing its value, or a positional argument is present.
 */
export default function parseInitSkillArgs(argv, defaultOutputDir) {
  const parsed = {
    outputDir: defaultOutputDir,
    type: 'generic',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '-h' || arg === '--help') {
      return { ...parsed, help: true };
    }

    if (arg === '--force') {
      parsed.force = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      throw new Error(`Positional arguments are not supported: ${arg}`);
    }

    if (!VALUE_OPTIONS.has(arg)) {
      throw new Error(`Unknown option: ${arg}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }

    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    parsed[key] = value;
    index += 1;
  }

  return parsed;
}
