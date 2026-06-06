function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function formatKey(key) {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function formatDottedKey(segments) {
  return segments.map(formatKey).join('.');
}

function formatScalar(value) {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  throw new Error(`Unsupported TOML value: ${String(value)}`);
}

function formatInlineTable(value) {
  const entries = Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${formatKey(key)} = ${formatTomlValue(entry)}`);

  return `{ ${entries.join(', ')} }`;
}

function formatTomlValue(value) {
  if (Array.isArray(value)) {
    if (value.every(isPlainObject)) {
      return `[${value.map(formatInlineTable).join(', ')}]`;
    }

    if (value.every((entry) => !isPlainObject(entry) && !Array.isArray(entry))) {
      return `[${value.map(formatTomlValue).join(', ')}]`;
    }
  }

  if (isPlainObject(value)) {
    return formatInlineTable(value);
  }

  return formatScalar(value);
}

function collectTables(config, prefix = []) {
  const scalarLines = [];
  const tables = [];
  const tableArrays = [];

  for (const [key, value] of Object.entries(config).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const segments = [...prefix, key];

    if (Array.isArray(value) && value.every(isPlainObject)) {
      tableArrays.push([segments, value]);
      continue;
    }

    if (isPlainObject(value)) {
      tables.push([segments, value]);
      continue;
    }

    scalarLines.push(`${formatKey(key)} = ${formatTomlValue(value)}`);
  }

  return { scalarLines, tables, tableArrays };
}

function renderTable(config, prefix = []) {
  const blocks = [];
  const { scalarLines, tables, tableArrays } = collectTables(config, prefix);

  if (scalarLines.length > 0) {
    const heading = prefix.length > 0 ? `[${formatDottedKey(prefix)}]\n` : '';
    blocks.push(`${heading}${scalarLines.join('\n')}`);
  }

  for (const [segments, value] of tables) {
    blocks.push(renderTable(value, segments));
  }

  for (const [segments, values] of tableArrays) {
    blocks.push(renderTableArray(values, segments));
  }

  return blocks.filter(Boolean).join('\n\n');
}

function renderTableArray(values, prefix) {
  const blocks = [];

  for (const value of values) {
    const { scalarLines, tables, tableArrays } = collectTables(value, prefix);
    const body = scalarLines.length > 0 ? `\n${scalarLines.join('\n')}` : '';

    blocks.push(`[[${formatDottedKey(prefix)}]]${body}`);

    for (const [segments, tableValue] of tables) {
      blocks.push(renderTable(tableValue, segments));
    }

    for (const [segments, tableValues] of tableArrays) {
      blocks.push(renderTableArray(tableValues, segments));
    }
  }

  return blocks.filter(Boolean).join('\n\n');
}

/**
 * Render the small TOML subset used by generated Codex config files.
 *
 * Object keys are sorted for deterministic output. Plain-object arrays become
 * table arrays; unsupported scalar or nested array values throw.
 *
 * @param {object} config Plain-object TOML tree to render.
 * @returns {string} Deterministic TOML text ending in a newline when non-empty.
 * @throws {Error} When a scalar or array shape is outside the supported subset.
 */
export function stringifyToml(config) {
  const rendered = renderTable(config);
  return rendered ? `${rendered}\n` : '';
}
