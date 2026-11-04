/** Select approved sources from the supplied Agent System local inventory. */
export default function selectSources(local = {}) {
  const approved = ['canon', 'openclaw-agent-system'];
  return approved.map((id) => {
    const path = local[id];
    if (typeof path !== 'string' || !path.trim()) return { id, status: 'missing' };
    return { id, path, status: 'candidate' };
  });
}
