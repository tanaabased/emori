const VALUE_OPTIONS = new Set(['--skill-dir', '--type']);

/**
 * Parses the internal EMORI skill validator arguments.
 *
 * @param {string[]} argv Raw argument tokens.
 * @returns {object} Parsed validator options.
 * @throws {Error} When an option is unknown, is missing its value, or a positional argument is present.
 */
export default function parseValidateSkillArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '-h' || arg === '--help') {
      return { ...parsed, help: true };
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
