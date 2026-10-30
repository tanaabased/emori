/**
 * Do not replace missing host contracts with a clean-tree check, a timestamp,
 * environment toggle, or an operator-written readiness file. See emori#153.
 */
export default function updateHost() {
  return {
    toolsStable: false,
    runnerStable: false,
    async assertHeld() {
      throw new Error('maintenance-unavailable');
    },
    async ready() {
      throw new Error('shared-readiness-unavailable');
    },
    async loaded() {
      throw new Error('loaded-state-unverified');
    },
  };
}
