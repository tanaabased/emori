export const SKILL_DESCRIPTION_PREFIX = 'EMORI-based ';

/**
 * Normalizes a description to the EMORI-local owner prefix.
 *
 * @param {string} value Raw skill description.
 * @returns {string} Normalized description, or an empty string for empty input.
 */
export default function normalizeSkillDescription(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return '';
  }

  const withoutPrefix = trimmed.replace(/^emori(?:[- ]?based)\s+/i, '');
  return `${SKILL_DESCRIPTION_PREFIX}${withoutPrefix}`;
}

/**
 * Fits a normalized skill description into the OpenAI metadata limit.
 *
 * @param {string} description Canonical or unprefixed skill description.
 * @returns {string} Description capped at 64 characters.
 */
export function makeShortDescription(description) {
  const cleaned = normalizeSkillDescription(description).replace(/\.$/, '');
  if (cleaned.length <= 64) {
    return cleaned;
  }

  const remainder = cleaned.slice(SKILL_DESCRIPTION_PREFIX.length);
  const maxRemainderLength = 64 - SKILL_DESCRIPTION_PREFIX.length - 3;
  return `${SKILL_DESCRIPTION_PREFIX}${remainder.slice(0, maxRemainderLength).trimEnd()}...`;
}

/**
 * Creates a default prompt that explicitly names the local skill.
 *
 * @param {string} skillId EMORI-prefixed machine id.
 * @param {string} description Canonical or unprefixed skill description.
 * @returns {string} Default agent prompt.
 */
export function makeDefaultPrompt(skillId, description) {
  const cleaned = String(description ?? '')
    .trim()
    .replace(/^emori(?:[- ]?based)\s+/i, '')
    .replace(/\.$/, '');
  const normalized = cleaned ? `${cleaned[0].toLowerCase()}${cleaned.slice(1)}` : cleaned;
  return `Use $${skillId} when you need to ${normalized}.`;
}
