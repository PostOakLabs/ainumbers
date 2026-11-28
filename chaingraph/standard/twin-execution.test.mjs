// twin-execution.test.mjs — §29 Twin Execution Record GATE (SPEC.md §29).
// Proves: `audit_signature.twin_execution` is hash-EXCLUDED (§29.3 — adding the member changes the
// artifact's canonical form while `execution_hash` stays byte-identical; both halves of the exclusion
// proof asserted, so the invariance is never vacuous), every §29.5 conformance condition holds at the
// REAL gate: all eight §29.0 members are required when the object is present on the closed
// $defs/twinExecution form (each one missing is rejected by `schema-validate.mjs`, never silently
// skipped), `kernel_digest` MUST equal `audit_signature.build_identity.kernel_digest` (a mismatch
// FAILS — a cross-reference a JSON schema cannot express, so this unit gate owns it; the schema alone
// accepts a mismatch, asserted here so the extra enforcement is demonstrably non-vacuous),
// `checked_at` must be a valid ISO 8601 timestamp (invalid FAILS; this validator subset does not
// assert `format`, so the unit gate owns it), `agreement:false` is a recorded finding for human
// adjudication and is ACCEPTED — never a refusal or auto-hold (§29.1), both `method` values and a
// `null` `max_divergence` (exact/boolean comparison) are accepted, `absence` of the member is fully
// conformant and is never itself a finding (§29.5 defaults OFF), and `chaingraph_version` stays
// "0.4.0". Fixture: fixtures/twin-execution/art-215-twin-execution.fixture.json, derived from the
// art-215 record's twin_execution object in chaingraph/fv-pilot/art-215-reg-z-appendix-j-apr.json
// (member values copied verbatim; the source record is never edited in place).
// Node 18+ (WebCrypto + node: builtins only — zero npm deps).
// Run:  node chaingraph/standard/twin-execution.test.mjs
import { jcsStringify, canonicalPreimage, executionHash } from '../kernels/_hash.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

// ---- §29.5 semantic helpers this unit gate owns (the schema cannot express them) ------------------
// (a) §29.0 digest binding: twin_execution.kernel_digest == audit_signature.build_identity.kernel_digest
const bindingHolds = (art) =>
  art.audit_signature?.twin_execution != null &&
  art.audit_signature.twin_execution.kernel_digest === art.audit_signature?.build_identity?.kernel_digest;
// (b) §29.5 checked_at validity: strict RFC 3339 shape, then real-calendar field checks. Date.parse
// alone is NOT sufficient: V8 rolls out-of-range dates forward (2026-02-30 parses as Mar 2), so each
// field is range-checked against the true calendar (leap years included) before the parse sanity-check.
const RFC3339 = /^(?<d>\d{4})-(?<mo>\d{2})-(?<da>\d{2})T(?<h>\d{2}):(?<mi>\d{2}):(?<s>\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInMonth = (y, m) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
const checkedAtValid = (v) => {
  if (typeof v !== 'string') return false;
  const m = RFC3339.exec(v);
  if (!m) return false;
  const y = +m.groups.d, mo = +m.groups.mo, da = +m.groups.da, h = +m.groups.h, mi = +m.groups.mi, s = +m.groups.s;
  if (mo < 1 || mo > 12 || da < 1 || da > daysInMonth(y, mo)) return false;
  if (h > 23 || mi > 59 || s > 59) return false;
  return !Number.isNaN(Date.parse(v));
};

// ---- fixture: the art-215 twin_execution record, copied verbatim into a full artifact --------------
const fx = JSON.parse(readFileSync(join(HERE, 'fixtures', 'twin-execution', 'art-215-twin-execution.fixture.json'), 'utf8'));
const twin = fx.audit_signature.twin_execution;
const MEMBER_KEYS = ['twin_digest', 'kernel_digest', 'agreement', 'max_divergence', 'tolerance', 'method', 'cases_checked', 'checked_at'];
const policy = fx.policy_parameters;
const output = fx.output_payload;
const rootHash = await executionHash(policy, output);

ok(fx.chaingraph_version === '0.4.0', 'the fixture carries chaingraph_version "0.4.0" (no version bump, §29.3)');
ok(MEMBER_KEYS.every((k) => k in twin), 'the fixture carries all eight §29.0 members');
ok(rootHash === fx.execution_hash, 'the committed fixture execution_hash recomputes byte-identical (fixture is truthful)');
ok(bindingHolds(fx), '§29.0: fixture twin_execution.kernel_digest equals build_identity.kernel_digest');

// ---- §29.3 THE HASH-EXCLUSION PROOF (non-vacuous, mirrors §AGID-1/§21.6/§PPH-1) --------------------
const stripped = JSON.parse(JSON.stringify(fx));
delete stripped.audit_signature.twin_execution;
ok(jcsStringify(fx) !== jcsStringify(stripped),
   'the member DOES change the artifact\'s canonical form (it is materially present — the next assertions are not vacuous)');
ok(canonicalPreimage(fx.policy_parameters, fx.output_payload) === canonicalPreimage(stripped.policy_parameters, stripped.output_payload),
   '§4 preimage is byte-identical with and without the member (the member lives under audit_signature, outside the preimage)');
ok(await executionHash(fx.policy_parameters, fx.output_payload) === await executionHash(stripped.policy_parameters, stripped.output_payload),
   'execution_hash recomputes byte-identical with and without the member (member is hash-EXCLUDED, §29.3)');
ok(fx.execution_hash === stripped.execution_hash && fx.execution_hash === rootHash,
   'the recorded execution_hash does not move when the member is added or stripped (additive: goldens stay pinned)');
ok(executionHash.length === 2, 'executionHash() takes exactly the two §4 inputs — the member cannot reach the preimage');

// ---- §29.5 shape discipline at the REAL gate (no second validator implementation) ------------------
// Each case is a full artifact handed to schema-validate.mjs via CHAINGRAPH (its shape-sniff routes a
// document carrying execution_hash to $defs/artifact, where the new audit_signature.twin_execution
// $ref lives), so the acceptance/rejection verdicts are the gate's own, never re-implemented here.
const dir = mkdtempSync(join(tmpdir(), 'twin-'));
let gate = (art) => {
  const f = join(dir, 'case.json');
  writeFileSync(f, JSON.stringify(art));
  try {
    execFileSync(process.execPath, [join(HERE, 'schema-validate.mjs')], { env: { ...process.env, CHAINGRAPH: f }, stdio: 'pipe' });
    return { code: 0, out: '' };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
};
const variant = (twinPatch) => {
  const art = JSON.parse(JSON.stringify(fx));
  if (twinPatch === null) delete art.audit_signature.twin_execution;
  else Object.assign(art.audit_signature.twin_execution, twinPatch);
  return art;
};

for (const [label, art] of [
  ['the fixture (agreement:true, method differential) is accepted', fx],
  ['§29.1: agreement:false is ACCEPTED — a recorded finding for human adjudication, never a refusal or auto-hold', variant({ agreement: false })],
  ['§29.0: method "property-based" is accepted (closed two-value enum, both members valid)', variant({ method: 'property-based' })],
  ['§29.0: max_divergence null is accepted (exact/boolean-only comparison)', variant({ max_divergence: null })],
  ['§29.0: a bare (unprefixed) 64-hex twin_digest is accepted ($defs/sha256ref is prefix-optional)', variant({ twin_digest: 'ec59e62cb51d80f19fe66ee8fa5c5d971f83f27b98597d9d93482c067225952c' })],
  ['§29.5: absence of the member is accepted (fully conformant, defaults OFF, absence is never a finding)', variant(null)],
]) {
  const r = gate(art);
  ok(r.code === 0, `${label}${r.code ? ` (got exit ${r.code}: ${r.out.trim().split('\n').slice(0, 3).join(' | ')})` : ''}`);
}

for (const [label, twinPatch, fragment] of [
  ['missing twin_digest rejected', { twin_digest: undefined }, 'missing required "twin_digest"'],
  ['missing kernel_digest rejected', { kernel_digest: undefined }, 'missing required "kernel_digest"'],
  ['missing agreement rejected', { agreement: undefined }, 'missing required "agreement"'],
  ['missing max_divergence rejected', { max_divergence: undefined }, 'missing required "max_divergence"'],
  ['missing tolerance rejected', { tolerance: undefined }, 'missing required "tolerance"'],
  ['missing method rejected', { method: undefined }, 'missing required "method"'],
  ['missing cases_checked rejected', { cases_checked: undefined }, 'missing required "cases_checked"'],
  ['missing checked_at rejected', { checked_at: undefined }, 'missing required "checked_at"'],
  ['unknown member rejected (closed §29.0 object)', { vendor_note: 'extra' }, 'additional property'],
  ['non-boolean agreement rejected', { agreement: 'false' }, 'boolean'],
  ['off-enum method rejected', { method: 'ad-hoc' }, 'not in enum'],
  ['non-numeric max_divergence rejected', { max_divergence: '0.000051' }, 'got string'],
  ['negative cases_checked rejected', { cases_checked: -1 }, '< minimum 0'],
  ['fractional cases_checked rejected', { cases_checked: 1.5 }, 'expected type integer'],
  ['malformed twin_digest rejected', { twin_digest: 'sha256:deadbeef' }, 'does not match'],
]) {
  const r = gate(variant(twinPatch));
  ok(r.code !== 0 && r.out.toLowerCase().includes(fragment.toLowerCase()),
     `§29.0: ${label} (exit ${r.code})`);
}

// ---- §29.5 semantic negatives the unit gate owns (the schema alone cannot catch these) -------------
{
  const mismatched = variant({ kernel_digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000' });
  const schemaAcceptsMismatch = gate(JSON.parse(JSON.stringify(mismatched)));
  ok(bindingHolds(fx) && !bindingHolds(mismatched),
     '§29.5: the binding check ACCEPTS the fixture and REJECTS a kernel_digest that differs from build_identity (mismatch FAILS)');
  ok(schemaAcceptsMismatch.code === 0,
     '§29.5: the schema alone cannot cross-reference build_identity (a mismatching artifact still shape-validates) — asserted so the unit gate\'s binding enforcement is demonstrably the only enforcement, not a duplicate');
  ok(!checkedAtValid('not-a-timestamp') && !checkedAtValid('2026-13-45T99:00:00Z') && !checkedAtValid('2026-02-30T00:00:00Z') && !checkedAtValid('2023-02-29T00:00:00Z') && !checkedAtValid('2026-11-28T24:00:00Z'),
     '§29.5: invalid checked_at values (non-timestamp, month 13/day 45, Feb 30, non-leap Feb 29, hour 24) FAIL the validity check');
  ok(checkedAtValid(fx.audit_signature.twin_execution.checked_at) && checkedAtValid('2026-11-28T00:00:00Z') && checkedAtValid('2026-11-28T00:00:00.500+01:00'),
     '§29.5: valid ISO 8601 checked_at values (fractional seconds, offsets) pass the validity check');
}
rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} failure(s).` : '\nAll §29 twin-execution checks passed.');
process.exit(fail ? 1 : 0);
