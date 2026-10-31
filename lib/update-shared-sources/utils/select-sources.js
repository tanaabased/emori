/** Select from the supplied Agent System local inventory without visiting excluded paths. */
export default function selectSources(local = {}) {
  const approved = ['canon', 'openclaw-agent-system'];
  const entries = Object.entries(local).map(([id, path]) => {
    if (['emori', 'smutlord'].includes(id)) return { id, status: 'excluded' };
    if (!approved.includes(id)) return { id, status: 'unsupported' };
    if (typeof path !== 'string' || !path.trim()) return { id, status: 'missing' };
    return { id, path, status: 'candidate' };
  });
  return [
    ...entries,
    ...approved.filter((id) => !Object.hasOwn(local, id)).map((id) => ({ id, status: 'missing' })),
  ];
}
