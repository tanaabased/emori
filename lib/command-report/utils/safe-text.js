import sanitizeDiagnostic from '../../update-shared-sources/utils/sanitize-diagnostic.js';

/** Sanitize before bounding; the upstream renderer owns plain-text escaping. */
export default function safeText(value, maximum = 512, environment = process.env) {
  if (typeof value !== 'string') return '';
  const clean = sanitizeDiagnostic(value, environment, Infinity)
    .replace(/[\u202a-\u202e\u2066-\u2069]/gu, '')
    .trim();
  return clean.length > maximum ? `${clean.slice(0, maximum)}… [detail omitted]` : clean;
}
