import { YAML } from 'bun';

/** Parses one YAML mapping, rejecting scalar, sequence, and empty documents. */
export default function parseYamlMapping(content) {
  const value = YAML.parse(String(content ?? ''));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a YAML mapping.');
  }
  return value;
}
