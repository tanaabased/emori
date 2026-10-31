/**
 * Check preservation facts supplied by the caller's inspection boundary.
 * `reserved` must mean supported checkout-use exclusion, not an idle/process sample.
 * These decisions do not acquire a reservation or establish canonical identity.
 */
export default function checkCheckout(source, snapshot, previous) {
  if (!['canon', 'openclaw-agent-system'].includes(source.id)) return 'unsupported';
  if (!snapshot || snapshot.canonical !== true) return 'noncanonical';
  if (snapshot.branch !== 'main') return snapshot.branch ? 'non-main' : 'detached';
  if (snapshot.clean !== true) return 'dirty-or-unknown';
  if (snapshot.reserved !== true) return 'active-or-unknown';
  const remote = `github.com/tanaabased/${source.id}.git`;
  if (
    snapshot.upstream !== 'origin/main' ||
    ![`https://${remote}`, `git@${remote.replace('/', ':')}`].includes(snapshot.remote)
  )
    return 'unsafe-upstream';
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(snapshot.head ?? '')) return 'unknown-revision';
  if (
    previous &&
    ['head', 'remote', 'upstream', 'identity'].some((key) => snapshot[key] !== previous[key])
  )
    return 'checkout-changed';
  if (typeof snapshot.identity !== 'string' || !snapshot.identity) return 'noncanonical';
  return undefined;
}
