import { semver } from 'bun';

// Maintenance compatibility is independent of the development toolchain's patch floor.
export const maintenanceBunRange = '>=1.4.2 <1.5.0';

/** Return the policy decision and bounded, single-line facts safe for Markdown reports. */
export default function checkRuntime({ version, executable } = {}) {
  const safeVersion =
    typeof version === 'string' && /^[0-9A-Za-z.+-]{1,100}$/.test(version)
      ? version
      : 'unavailable';
  const stable =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      safeVersion,
    );
  return {
    supported: stable && semver.satisfies(safeVersion, maintenanceBunRange),
    version: safeVersion,
    required: maintenanceBunRange,
    executable:
      typeof executable === 'string' && /^\/[A-Za-z0-9_./+ @()-]{1,1023}$/.test(executable)
        ? executable
        : undefined,
  };
}
