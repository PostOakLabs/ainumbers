// 783-emv-mpm-qr-validator — class-K floor property test.
// kernel_digest_at_authoring: sha256:623576131e968205b93c3a4755b28dab500e5c04893b734b4aa3a3f89ef1d964
// spec: EMV-MPM-QR-VALIDATOR-1 row (board/queued/EMV-MPM-QR-VALIDATOR-1.md) · pinned texts in
// research/clause-snapshots/emv-mpm-qr/ · pin note research/EMV-MPM-QR-PIN-2026-10-29.md
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/783-emv-mpm-qr-validator.proptest.mjs

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute, SCHEME_PROFILES } from '../783-emv-mpm-qr-validator.kernel.mjs';
import { runFixtureOracle, summarize, deepEqual, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = '783-emv-mpm-qr-validator';
const HERE = dirname(fileURLToPath(import.meta.url));

const fixtures = JSON.parse(readFileSync(join(HERE, '..', 'fixtures', `${KERNEL_ID}.fixtures.json`), 'utf8'));
const vectors = fixtures.vectors;

// ── local (independent of the kernel) TLV walk + CRC-16/CCITT-FALSE ──────────────────────
function walkTlv(raw, out, prefix) {
  let i = 0;
  while (i + 4 <= raw.length) {
    const id = raw.slice(i, i + 2);
    const len = raw.slice(i + 2, i + 4);
    if (!/^\d\d$/.test(id) || !/^\d\d$/.test(len)) return;
    const l = parseInt(len, 10);
    if (i + 4 + l > raw.length) return;
    const val = raw.slice(i + 4, i + 4 + l);
    out.push({ id, len: l, value: val, path: prefix ? prefix + '.' + id : id });
    i += 4 + l;
  }
}
function crc16(bytes) {
  let c = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i] << 8;
    for (let b = 0; b < 8; b++) c = (c & 0x8000) !== 0 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c;
}
const hex4 = (n) => n.toString(16).toUpperCase().padStart(4, '0');
const chars = (s) => Array.from(s).map((c) => c.charCodeAt(0));

function collectNoEchoSecrets(payload) {
  // every value the no-echo contract forbids from ever appearing in an output
  const secrets = [];
  const root = [];
  walkTlv(payload, root, '');
  for (const o of root) {
    if (o.id === '59' || o.id === '60' || o.id === '61') secrets.push({ what: o.id, value: o.value });
    if ((o.id >= '26' && o.id <= '51') || (o.id >= '80' && o.id <= '99') || o.id === '62' || o.id === '64') {
      const sub = [];
      walkTlv(o.value, sub, o.id);
      for (const s of sub) {
        if (o.id === '62' || o.id === '64') secrets.push({ what: s.path, value: s.value });
        else if (s.id !== '00') secrets.push({ what: s.path, value: s.value }); // account identifiers
      }
    }
  }
  return secrets;
}

// ── P1 no-echo: tag 59/60/61 values, tag 62/64 subfield values, and merchant account
//    identifiers inside 26-51 (everything but the template GUID) NEVER appear in output.
function checkNoEcho() {
  let checked = 0;
  const violations = [];
  for (const v of vectors) {
    if (typeof v.policy_parameters.payload !== 'string') continue;
    const out = JSON.stringify(compute(v.policy_parameters).output_payload);
    for (const s of collectNoEchoSecrets(v.policy_parameters.payload)) {
      if (s.value.length >= 3 && out.indexOf(s.value) !== -1) violations.push(v.name + ':' + s.what);
      checked++;
    }
  }
  return { name: 'no_echo_never_leaks_59_60_61_62_account_ids', checked, violations };
}

// ── P2 echo-safe only: output tags carry `value` only for structural root tags and GUIDs.
function checkEchoSafeOnly() {
  const allowedRoot = new Set(SCHEME_PROFILES.echo_safe_root);
  let checked = 0;
  const violations = [];
  for (const v of vectors) {
    const out = compute(v.policy_parameters).output_payload;
    for (const t of out.tags || []) {
      checked++;
      const isAllowed = allowedRoot.has(t.tag) || /\.00$/.test(t.tag);
      if (Object.prototype.hasOwnProperty.call(t, 'value') && !isAllowed) violations.push(v.name + ':' + t.tag);
      if (t.tag === '59' || t.tag === '60' || t.tag === '61' || t.tag === '62' || t.tag === '64') {
        if (Object.prototype.hasOwnProperty.call(t, 'value')) violations.push(v.name + ':' + t.tag + ':value');
      }
    }
  }
  return { name: 'value_present_only_for_echo_safe_tags', checked, violations };
}

// ── P3 determinism: same pp in, byte-same output out.
function checkDeterminism() {
  let checked = 0;
  const violations = [];
  for (const v of vectors) {
    const a = compute(v.policy_parameters);
    const b = compute(JSON.parse(JSON.stringify(v.policy_parameters)));
    if (!deepEqual(a.output_payload, b.output_payload)) violations.push(v.name);
    checked++;
  }
  return { name: 'compute_is_deterministic', checked, violations };
}

// ── P4 CRC independence: an independent CRC-16/CCITT-FALSE implementation (this file's,
//    not the kernel's) agrees with crc.expected on every string-payload vector, and the
//    classic known-answer 123456789 -> 29B1 holds for the local implementation.
function checkCrcIndependent() {
  let checked = 0;
  const violations = [];
  if (hex4(crc16(chars('123456789'))) !== '29B1') violations.push('local-crc-KAT-123456789');
  checked++;
  for (const v of vectors) {
    const p = v.policy_parameters.payload;
    if (typeof p !== 'string') continue;
    const out = compute(v.policy_parameters).output_payload;
    if (out.crc.expected === null) continue; // refused inputs carry no CRC verdict
    const pos = p.lastIndexOf('6304');
    const prefix = pos >= 0 ? p.slice(0, pos + 4) : p + '6304';
    if (out.crc.expected !== hex4(crc16(chars(prefix)))) violations.push(v.name);
    checked++;
  }
  return { name: 'crc16_ccitt_false_over_payload_including_6304_literal', checked, violations };
}

// ── P5 corruption sensitivity: any single-character mutation before the CRC region of a
//    valid vector flips valid to false (CRC recomputed by the local implementation cannot
//    rescue it because the mutation is outside the CRC value itself).
function checkCorruptionSensitivity() {
  const rng = mulberry32(20261029);
  let checked = 0;
  const violations = [];
  for (const v of vectors) {
    const p = v.policy_parameters.payload;
    if (typeof p !== 'string') continue;
    const base = compute(v.policy_parameters).output_payload;
    if (base.valid !== true) continue;
    const pos = p.lastIndexOf('6304');
    if (pos < 8) continue;
    const idx = Math.floor(rng() * pos); // deterministic pick inside the pre-CRC region
    const c = p[idx];
    const repl = c === 'A' ? 'B' : 'A';
    const mutated = p.slice(0, idx) + repl + p.slice(idx + 1);
    const out = compute({ ...v.policy_parameters, payload: mutated }).output_payload;
    if (out.valid === true) violations.push(v.name + '@' + idx);
    checked++;
  }
  return { name: 'single_char_corruption_before_crc_breaks_validity', checked, violations };
}

// ── P6 duplicate tag: a CRC-correct payload with a duplicated root tag is rejected.
function checkDuplicateTag() {
  let checked = 0;
  const violations = [];
  for (const v of vectors) {
    const p = v.policy_parameters.payload;
    if (typeof p !== 'string') continue;
    const base = compute(v.policy_parameters).output_payload;
    if (base.valid !== true) continue;
    const pos = p.lastIndexOf('6304');
    const body = p.slice(0, pos);
    const dup = body + '5802US' + '6304' + hex4(crc16(chars(body + '5802US' + '6304')));
    const out = compute({ profile: 'generic', payload: dup }).output_payload;
    if (!out.violations.some((x) => x.rule_id === 'DUPLICATE_TAG')) violations.push(v.name);
    checked++;
  }
  return { name: 'duplicate_root_tag_rejected_even_with_valid_crc', checked, violations };
}

// ── P7 refusal branches: every structured refusal branch is reachable and fixture-proven.
function checkRefusalBranches() {
  const want = ['payload_not_string', 'payload_empty', 'payload_bound_exceeded', 'profile_unknown', 'expect_invalid', 'dynamic_envelope_not_object'];
  const seen = new Set();
  const violations = [];
  for (const v of vectors) {
    const out = compute(v.policy_parameters).output_payload;
    if (out.refused && out.refused.refused === true) seen.add(out.refused.refused_because);
  }
  for (const w of want) if (!seen.has(w)) violations.push('missing-reachable-fixture:' + w);
  return { name: 'all_refusal_branches_reachable_and_fixture_proven', checked: want.length, violations };
}

// ── P8 profiles data mirror: kernel-side profile data equals the fixtures-dir JSON mirror.
function checkProfilesMirror() {
  const mirror = JSON.parse(readFileSync(join(HERE, '..', 'fixtures', `${KERNEL_ID}.profiles.json`), 'utf8'));
  const kernel = JSON.parse(JSON.stringify(SCHEME_PROFILES));
  const okProfileKeys = deepEqual(Object.keys(kernel.profiles).sort(), ['fjqr', 'generic', 'pix_brcode']);
  const okDeep = deepEqual({ profiles: kernel.profiles, sources: kernel.sources, echo_safe_root: kernel.echo_safe_root, addl_sub_cap: kernel.addl_sub_cap }, { profiles: mirror.profiles, sources: mirror.sources, echo_safe_root: mirror.echo_safe_root, addl_sub_cap: mirror.addl_sub_cap });
  return { name: 'profiles_as_data_mirror_kernel_side_equal', checked: 3, violations: okProfileKeys && okDeep ? [] : ['mirror-drift'] };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkNoEcho(),
  checkEchoSafeOnly(),
  checkDeterminism(),
  checkCrcIndependent(),
  checkCorruptionSensitivity(),
  checkDuplicateTag(),
  checkRefusalBranches(),
  checkProfilesMirror(),
].map((p) => {
  // summarize() wants a violation COUNT; details print once for the failing property only.
  const n = Array.isArray(p.violations) ? p.violations.length : p.violations;
  if (Array.isArray(p.violations) && p.violations.length) console.log('  detail:', p.name, JSON.stringify(p.violations.slice(0, 5)));
  return { name: p.name, checked: p.checked, violations: n };
});
console.log(`[${KERNEL_ID}] class-K floor property test — 8 properties.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
