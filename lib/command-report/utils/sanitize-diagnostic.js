import { stripVTControlCharacters } from 'node:util';

/** Bound command diagnostics and remove credential-shaped values before stderr. */
export default function sanitizeDiagnostic(value, environment = {}, maximum = 4096) {
  let text = stripVTControlCharacters(String(value ?? ''));
  for (const [key, secret] of Object.entries(environment)) {
    if (/token|secret|password|credential|private.?key|authority|capability/i.test(key) && secret) {
      for (const form of [secret, encodeURIComponent(secret)])
        text = text.split(form).join('[redacted]');
    }
  }
  return (
    text
      .replace(
        /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g,
        '[redacted]',
      )
      .replace(/(https?:\/\/)[^\s/@]+@/gi, '$1[redacted]@')
      .replace(/\b(?:github_pat_|gh[pousr]_|sk-)[A-Za-z0-9_-]+/g, '[redacted]')
      .replace(
        /((?:authorization|token|password|secret|api[-_]?key)\s*[=:]\s*)(?:Bearer\s+)?[^\s&,;]+/gi,
        '$1[redacted]',
      )
      // Control characters are the intended match, not accidental invisible literals.
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
      .slice(-maximum)
  );
}
