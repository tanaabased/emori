/** Select configured source entries from the supplied Agent System local inventory. */
export default function selectSources(local = {}) {
  return Object.entries(local).map(([id, path]) => {
    if (typeof path !== 'string' || !path.trim()) return { id, status: 'missing' };
    return { id, path, status: 'candidate' };
  });
}
