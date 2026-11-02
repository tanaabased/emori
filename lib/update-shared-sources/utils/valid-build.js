/** A receipt proves a successful sync only with both input and artifact digests. */
export default function validBuild(value) {
  return (
    value?.version === 1 &&
    Object.keys(value).length === 3 &&
    typeof value.inputs === 'string' &&
    typeof value.artifacts === 'string' &&
    /^[a-f0-9]{64}$/.test(value.inputs) &&
    /^[a-f0-9]{64}$/.test(value.artifacts)
  );
}
