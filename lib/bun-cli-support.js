import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, inspect } from 'node:util';

import { booleanFromEnv } from '../utils/boolean-from-env.js';
import { csvDisplay } from '../utils/csv-display.js';
import { splitCsv } from '../utils/split-csv.js';
import { valueEnabled } from '../utils/value-enabled.js';

const CSI = '\u001B[';
const ANSI_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, 'g');
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

async function readRepoVersion() {
  try {
    const packageJsonPath = path.join(REPO_ROOT, 'package.json');
    const content = await readFile(packageJsonPath, 'utf8');
    return JSON.parse(content).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const CLI_VERSION = await readRepoVersion();

export { booleanFromEnv, csvDisplay, splitCsv, valueEnabled };

function stripAnsi(value) {
  return String(value).replaceAll(ANSI_PATTERN, '');
}

/**
 * Render boolean-like values with the vocabulary used in help output.
 *
 * @param {unknown} value Raw boolean-like value.
 * @returns {'on' | 'off'} CLI display state.
 */
export function enabledDisplay(value) {
  return valueEnabled(value) ? 'on' : 'off';
}

function supportsColor(stream = process.stdout) {
  const forceColor = process.env.FORCE_COLOR;
  if (forceColor !== undefined) {
    return !['0', 'false'].includes(forceColor.toLowerCase());
  }

  if (process.env.NO_COLOR !== undefined) {
    return false;
  }

  return Boolean(stream?.isTTY);
}

function applyAnsi(code, text, stream = process.stdout) {
  const value = String(text);
  if (!supportsColor(stream)) {
    return value;
  }

  return `${CSI}${code}m${value}${CSI}0m`;
}

function hexToRgb(hex) {
  const normalized = hex.replace(/^#/, '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((segment) => segment.repeat(2))
          .join('')
      : normalized;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return {
    blue: Number.parseInt(expanded.slice(4, 6), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    red: Number.parseInt(expanded.slice(0, 2), 16),
  };
}

function applyRgb(hex, text, stream = process.stdout) {
  const value = String(text);
  if (!supportsColor(stream)) {
    return value;
  }

  const { red, green, blue } = hexToRgb(hex);
  return `${CSI}38;2;${red};${green};${blue}m${value}${CSI}0m`;
}

// Shared helper scripts inherit a stable debug namespace from the owning skill path.
function defaultDebugNamespace(scriptPath) {
  const relativePath = path.relative(REPO_ROOT, scriptPath).split(path.sep).join('/');
  const match = relativePath.match(/^skills\/([^/]+)\/scripts\/(.+)\.js$/);

  if (!match) {
    return path.basename(scriptPath, '.js');
  }

  const [, skillId, scriptName] = match;
  return `${skillId}:${scriptName.replaceAll('/', ':')}`;
}

export function bold(text, stream = process.stdout) {
  return applyAnsi('1', text, stream);
}

export function dim(text, stream = process.stdout) {
  return applyAnsi('2', text, stream);
}

export function green(text, stream = process.stdout) {
  return applyAnsi('32', text, stream);
}

export function red(text, stream = process.stdout) {
  return applyAnsi('31', text, stream);
}

export function yellow(text, stream = process.stdout) {
  return applyAnsi('33', text, stream);
}

export function tp(text, stream = process.stdout) {
  return applyRgb('#00c88a', text, stream);
}

export function ts(text, stream = process.stdout) {
  return applyRgb('#db2777', text, stream);
}

function normalizeMessage(message, stream) {
  if (typeof message === 'string') {
    return message;
  }

  return inspect(message, {
    colors: supportsColor(stream),
    depth: 6,
  });
}

function writeLine(stream, message = '', ...args) {
  const normalized = normalizeMessage(message, stream);
  stream.write(`${format(normalized, ...args)}\n`);
}

function writeStatus(stream, label, colorize, message = '', ...args) {
  const normalized = normalizeMessage(message, stream);
  const body = format(normalized, ...args);
  const prefix = bold(colorize(label, stream), stream);
  const line = body ? `${prefix} ${body}` : prefix;
  stream.write(`${line}\n`);
}

function debugPatternMatches(pattern, namespace) {
  if (!pattern) {
    return false;
  }

  if (pattern === '1' || pattern === '*') {
    return true;
  }

  if (pattern.endsWith('*')) {
    return namespace.startsWith(pattern.slice(0, -1));
  }

  return pattern === namespace;
}

function envDebugEnabled(namespace) {
  if (valueEnabled(process.env.EMORI_DEBUG)) {
    return true;
  }

  if (process.env.RUNNER_DEBUG === '1') {
    return true;
  }

  const rawDebug = process.env.DEBUG;
  if (!rawDebug) {
    return false;
  }

  return rawDebug
    .split(',')
    .map((segment) => segment.trim())
    .some((pattern) => debugPatternMatches(pattern, namespace));
}

function formatEntries(entries) {
  const normalized = entries.filter((entry) => entry.label && entry.description);
  if (normalized.length === 0) {
    return '';
  }

  const width = normalized.reduce(
    (maxWidth, entry) => Math.max(maxWidth, stripAnsi(entry.label).length),
    0,
  );
  return normalized
    .map((entry) => `  ${entry.label.padEnd(width)}  ${entry.description}`)
    .join('\n');
}

function formatHelpSection({ heading, entries = [], lines = [] }) {
  const content = entries.length > 0 ? formatEntries(entries) : lines.join('\n');
  if (!content) {
    return '';
  }

  return `${tp(heading)}:\n${content}`;
}

export function commonEmoriEnvironmentVariables() {
  return [{ label: 'EMORI_DEBUG', description: 'set to a truthy value to show debug messages' }];
}

/**
 * Return common flags while leaving command-specific arguments in order.
 *
 * @param {string[]} argv CLI arguments after the executable and script name.
 * @returns {{flags: {debug: boolean, help: boolean, version: boolean}, argv: string[]}} Parsed common flags and remaining arguments.
 */
export function extractCommonFlags(argv) {
  const flags = { debug: false, help: false, version: false };
  const remainingArgv = [];

  for (const arg of argv) {
    if (arg === '--debug') {
      flags.debug = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      flags.help = true;
      continue;
    }

    if (arg === '--version' || arg === '-V') {
      flags.version = true;
      continue;
    }

    remainingArgv.push(arg);
  }

  return { flags, argv: remainingArgv };
}

/**
 * Create the shared Bun CLI facade used by package entrypoints.
 *
 * The facade owns color, debug namespace handling, help rendering, status
 * streams, and package-version output so individual CLIs can stay focused on
 * their product contract.
 *
 * @param {string} importMetaUrl Entrypoint `import.meta.url`.
 * @param {object} [options] CLI facade options.
 * @param {string} [options.debugNamespace] Explicit DEBUG namespace override.
 * @returns {object} Stream-aware CLI helper facade.
 */
export function createCli(importMetaUrl, { debugNamespace } = {}) {
  const scriptPath = fileURLToPath(importMetaUrl);
  const cliName = path.basename(scriptPath);
  const namespace = debugNamespace ?? defaultDebugNamespace(scriptPath);
  let debugEnabled = envDebugEnabled(namespace);

  return {
    bold,
    cliName,
    debug(message = '', ...args) {
      if (!debugEnabled) {
        return;
      }

      const prefix = dim(`[${namespace}]`, process.stderr);
      writeStatus(process.stderr, 'debug', dim, `${prefix} ${message}`, ...args);
    },
    dim,
    enableDebug() {
      debugEnabled = true;
    },
    error(message = '', ...args) {
      writeStatus(process.stderr, 'error', red, message, ...args);
    },
    fail(message = '', exitCode = 1) {
      writeStatus(process.stderr, 'error', red, message);
      process.exit(exitCode);
    },
    green,
    isDebugEnabled() {
      return debugEnabled;
    },
    log(message = '', ...args) {
      writeLine(process.stdout, message, ...args);
    },
    note(message = '', ...args) {
      writeStatus(process.stdout, 'note', ts, message, ...args);
    },
    red,
    renderHelp({
      usage,
      description = '',
      options = [],
      environmentVariables = [],
      sections = [],
    }) {
      const parts = [
        `Usage: ${usage}`,
        description,
        formatHelpSection({
          entries: options,
          heading: 'Options',
        }),
        formatHelpSection({
          entries: environmentVariables,
          heading: 'Environment Variables',
        }),
      ];

      for (const section of sections) {
        const rendered = formatHelpSection(section);
        if (!rendered) {
          continue;
        }

        parts.push(rendered);
      }

      return parts.filter(Boolean).join('\n\n');
    },
    showHelp(config, code = 0) {
      this.log(this.renderHelp(config));
      process.exit(code);
    },
    showVersion() {
      this.log(CLI_VERSION);
    },
    success(message = '', ...args) {
      writeStatus(process.stdout, 'done', green, message, ...args);
    },
    tp,
    ts,
    version: CLI_VERSION,
    warn(message = '', ...args) {
      writeStatus(process.stderr, 'warn', yellow, message, ...args);
    },
    yellow,
  };
}
