// @ts-nocheck: floor helper, same exemption as the sibling _pbt-common.mjs.
// _caller-key-probes.mjs: KERNEL-CALLER-KEY-LOOKUP-LINT-1 runtime counterpart.
//
// Fixture generator for the property-test floor. For every required string or enum input of a
// kernel it substitutes, one key at a time into a declared-valid baseline, the six probes that
// merged kernels have failed on: ["x"], {}, false, "constructor", "__proto__", "toString".
// A string helper that coerces with String(v) accepts the first three as text; a plain-object
// enum lookup resolves the last three through the prototype chain.
//
// Zero dependencies. A floor imports this beside _pbt-common.mjs:
//   import { probeCallerKeys } from './_caller-key-probes.mjs';
//   properties.push(probeCallerKeys(compute, baseline, ['funded_from', 'profile_id']));
//
// The returned property result is { name, checked, violations } like the other floor
// properties. A probe is a violation when compute() throws on it (an uncontrolled TypeError),
// when the output carries a non-finite number or undefined, or when the optional `accepted`
// predicate says the kernel treated the probe as a valid value (pass it to assert the kernel's
// own rejection signal, for example (out) => out.status !== 'REJECTED').

export const CALLER_KEY_PROBES = [
  { name: 'array_x', make: () => ['x'] },
  { name: 'empty_object', make: () => ({}) },
  { name: 'false', make: () => false },
  { name: 'constructor', make: () => 'constructor' },
  { name: 'proto', make: () => '__proto__' },
  { name: 'toString', make: () => 'toString' },
];

function shapeViolation(value) {
  if (value === undefined) return true;
  if (typeof value === 'number' && !Number.isFinite(value)) return true;
  if (Array.isArray(value)) return value.some(shapeViolation);
  if (value !== null && typeof value === 'object') return Object.keys(value).some((k) => shapeViolation(value[k]));
  return false;
}

// keys: the required string or enum input names. Defaults to every string-valued baseline key.
export function probeCallerKeys(compute, baseline, keys = null, accepted = null) {
  const targets = keys || Object.keys(baseline).filter((k) => typeof baseline[k] === 'string');
  let checked = 0;
  const failures = [];
  for (const key of targets) {
    for (const probe of CALLER_KEY_PROBES) {
      checked++;
      const pp = { ...baseline, [key]: probe.make() };
      try {
        const { output_payload } = compute(pp);
        if (shapeViolation(output_payload)) failures.push(`${key}=${probe.name}: shape violation`);
        else if (accepted && accepted(output_payload, key, probe.name)) failures.push(`${key}=${probe.name}: accepted as valid`);
      } catch (e) {
        failures.push(`${key}=${probe.name}: threw ${String((e && e.message) || e).slice(0, 60)}`);
      }
    }
  }
  return { name: 'caller_key_probes_wrong_type_and_prototype', checked, violations: failures.length, failures };
}

// ---- self-test: a vulnerable and a hardened toy kernel (red and green) ----
const IS_MAIN = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (IS_MAIN && process.argv.includes('--self-test')) {
  const TABLE = { reserve: 1, fee: 2 };
  const vulnerable = (pp) => ({ output_payload: { v: TABLE[pp.kind].toFixed(0) } });
  const hardened = (pp) => ({
    output_payload: { v: typeof pp.kind === 'string' && Object.hasOwn(TABLE, pp.kind) ? TABLE[pp.kind] : 0 },
  });
  const red = probeCallerKeys(vulnerable, { kind: 'reserve' }, ['kind']);
  const green = probeCallerKeys(hardened, { kind: 'reserve' }, ['kind']);
  const acceptedRed = probeCallerKeys(hardened, { kind: 'reserve' }, ['kind'], () => true);
  const ok = red.violations > 0 && green.violations === 0 && green.checked === 6 && acceptedRed.violations === 6;
  console.log(`${ok ? '✓' : '✗'} caller-key probes self-test: vulnerable=${red.violations} violations, hardened=${green.violations}, accepted-predicate=${acceptedRed.violations}/6`);
  process.exit(ok ? 0 : 1);
}
