// art-703-mandate-authorization-gate.proptest.mjs — class-K property-test FLOOR
// (FV-PBT-FLOOR-BUILD-SPEC.md). Authored against the build spec at
// research/hackathon-builds/ART703-MANDATE-AUTHORIZATION-GATE-BUILD-SPEC-2026-10-01.md.
// kernel_digest_at_authoring: sha256:de1fb32291e04241870bd357ee96bddc43e5c271c831b79b0928246896875475
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny. Internal engineering QC only.
// float_sensitive: NO — amounts are integers in minor units, the mandate cap converts
// by integer string concatenation through the curated exponent table, timestamps parse
// to integer epoch seconds by civil-date arithmetic, and compute() touches no Date,
// no float accumulation and no Math.random. The digests inside compute() are the
// inlined vendored SHA-256 over the canonical form, pinned by load-time self-checks.
//
// Checks: fixture-oracle gate (F1..F17); P1 any one-unit change to the request after
// authorize makes verify_commit reject with DIGEST_MISMATCH; P2 an expired mandate
// (including the exact expiry boundary) never authorizes; P3 authorization_id is
// stable across key orderings of the inputs (the whole payload is byte-identical);
// P4 invalid-domain inputs are refused with named reasons, never a throw; P5
// determinism (two runs agree byte-for-byte) and output shape (no undefined/NaN/
// non-finite anywhere).
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-703-mandate-authorization-gate.proptest.mjs

import { compute } from '../art-703-mandate-authorization-gate.kernel.mjs';
import { runFixtureOracle, summarize, findShapeViolations, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-703-mandate-authorization-gate';

// ---------- declared-domain generator (authorizing draws only) ----------

const CURRENCIES = ['USD', 'EUR', 'JPY', 'KWD', 'GBP']; // exercises exponents 2, 2, 0, 3, 2
const RAILS = ['rail-a', 'rail-b', 'rail-c'];
const CAP_DIGITS = { USD: 2, EUR: 2, JPY: 0, KWD: 3, GBP: 2 };

function pad(n, w) { return String(n).padStart(w, '0'); }
function isoAt(y, mo, d, h, mi, s) { return `${pad(y, 4)}-${pad(mo, 2)}-${pad(d, 2)}T${pad(h, 2)}:${pad(mi, 2)}:${pad(s, 2)}Z`; }

function exp10(n) { let v = 1; for (let i = 0; i < n; i++) v *= 10; return v; }

/** a random draw that satisfies all ten rules, so authorize issues */
function authorizingDraw(rng, over = {}) {
  const ccy = over.currency || CURRENCIES[Math.floor(rng() * CURRENCIES.length)];
  const exp = CAP_DIGITS[ccy];
  const capMajorInt = 100 + Math.floor(rng() * 900); // major-unit integer part
  const fracDigits = exp === 0 ? '' : pad(Math.floor(rng() * exp10(exp)), exp);
  const capString = `${capMajorInt}${exp === 0 ? '' : '.' + fracDigits}`;
  const capMinor = Number(String(capMajorInt) + fracDigits);
  const amount = 1 + Math.floor(rng() * capMinor); // 1..cap => rule 8 clean
  const total = amount + 500 + Math.floor(rng() * 90000); // always covers the amount
  const spent = Math.floor(rng() * (total - amount)); // spent + amount <= total => rule 9 clean
  const rail = over.rail || RAILS[Math.floor(rng() * RAILS.length)];
  const payee = 'merchant:' + Math.floor(rng() * 50);
  const payer = 'acct:' + Math.floor(rng() * 50);
  const day = 1 + Math.floor(rng() * 27);
  const asOf = isoAt(2026, 10, day, 12, 0, 0);
  const issued = isoAt(2026, 10, 1, 0, 0, 0); // <= as_of
  const expires = isoAt(2026, 10, day + 1, 12, 0, 0); // strictly after as_of
  const ttl = 1 + Math.floor(rng() * 900);
  return {
    mode: 'authorize',
    as_of: asOf,
    ttl_seconds: ttl,
    mandate: { mandate_id: 'm-' + Math.floor(rng() * 1000), payer_ref: payer, payee_ref: payee,
               currency: ccy, max_amount: capString, issued_at: issued, expires_at: expires,
               purpose: 'purpose-' + Math.floor(rng() * 100) },
    extensions: { total_budget_minor: total, spent_minor: spent,
                  allowed_rails: [rail, RAILS[Math.floor(rng() * RAILS.length)]],
                  verified_payees: [payee, 'merchant:other'], revoked_at: null },
    request: { payer_ref: payer, payee_ref: payee, amount_minor: amount,
               currency: ccy, rail, purpose: 'purpose-' + Math.floor(rng() * 100) },
  };
}

/** deep key-order shuffle over every object in the value */
function shuffleKeys(v, rng) {
  if (Array.isArray(v)) return v.map((x) => shuffleKeys(x, rng));
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v);
    for (let i = ks.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = ks[i]; ks[i] = ks[j]; ks[j] = t;
    }
    const o = {};
    for (const k of ks) o[k] = shuffleKeys(v[k], rng);
    return o;
  }
  return v;
}

// ---------- properties ----------

// P1: any one-unit change to the request after authorize makes verify_commit reject
// with DIGEST_MISMATCH. The authorization is presented inside its window, so the only
// possible failure is the digest — proving the binding is to the exact request.
function checkRequestBinding() {
  const rng = mulberry32(703001);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 60; i++) {
    const pp = authorizingDraw(rng);
    const r = compute(pp);
    if (r.output_payload.decision !== 'authorize') { violations++; continue; }
    const auth = r.output_payload.authorization;
    const req = pp.request;
    const fields = Object.keys(req);
    const field = fields[Math.floor(rng() * fields.length)];
    let tampered;
    if (field === 'amount_minor') tampered = { ...req, [field]: req[field] + (req[field] > 1 ? 1 : -1) };
    else tampered = { ...req, [field]: req[field] + 'x' };
    const vc = compute({ mode: 'verify_commit', as_of: auth.not_before, authorization: auth, request: tampered });
    checked++;
    const codes = vc.output_payload.reasons.map((x) => x.code);
    if (vc.output_payload.decision !== 'reject' || !codes.includes('DIGEST_MISMATCH')) violations++;
  }
  return { name: 'P1 any one-unit change to the request after authorize makes verify_commit reject', checked, violations };
}

// P2: an expired mandate never authorizes — including the exact boundary as_of ==
// expires_at, and every draw where the mandate expired strictly before as_of.
function checkExpiredNeverAuthorizes() {
  const rng = mulberry32(703002);
  let checked = 0;
  let violations = 0;
  // boundary draw
  const b = authorizingDraw(rng);
  b.mandate.expires_at = b.as_of;
  const rb = compute(b);
  checked++;
  if (rb.output_payload.decision !== 'reject' || !rb.output_payload.reasons.some((x) => x.code === 'EXPIRED')) violations++;
  // random past-expiry draws: expiry sits at 11:00 on the draw's own as_of day, one
  // hour before the 12:00 as_of, so every draw is genuinely past its expiry
  for (let i = 0; i < 60; i++) {
    const pp = authorizingDraw(rng);
    const asOfDay = Number(pp.as_of.slice(8, 10));
    pp.mandate.expires_at = isoAt(2026, 10, asOfDay, 11, 0, 0);
    const r = compute(pp);
    checked++;
    if (r.output_payload.decision !== 'reject' || !r.output_payload.reasons.some((x) => x.code === 'EXPIRED')) violations++;
    if (r.output_payload.authorization !== null) violations++;
  }
  return { name: 'P2 an expired mandate never authorizes, boundary included', checked, violations };
}

// P3: authorization_id is stable across key orderings of the inputs — reshuffling every
// object's keys (top level, mandate, extensions, request) leaves the whole payload
// byte-identical, because both digests canonicalize before hashing.
function checkKeyOrderStability() {
  const rng = mulberry32(703003);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 40; i++) {
    const pp = authorizingDraw(rng);
    const first = compute(pp);
    if (first.output_payload.decision !== 'authorize') { violations++; continue; }
    for (let s = 0; s < 3; s++) {
      const again = compute(shuffleKeys(pp, rng));
      checked++;
      if (JSON.stringify(again) !== JSON.stringify(first)) violations++;
    }
  }
  return { name: 'P3 authorization_id is stable across key orderings of the inputs', checked, violations };
}

// P4: invalid-domain inputs are refused with a named reason code, never a throw.
function checkRefusals() {
  let checked = 0;
  let violations = 0;
  const rng = mulberry32(703004);
  const good = authorizingDraw(mulberry32(703014));
  const bad = [
    { mode: 'spend' }, { mode: '' }, { mode: null },
    { as_of: 'not-a-time' }, { as_of: '2026-10-01T15:00:00+02:00' }, { as_of: '2026-10-01 15:00:00Z' },
    { as_of: '2026-10-01T15:00:00' }, { as_of: '2026-02-30T15:00:00Z' }, { as_of: '2026-10-01T24:00:00Z' },
    { as_of: 123 },
    { ttl_seconds: '60' }, { ttl_seconds: 1.5 }, { ttl_seconds: null },
    { mandate: null }, { mandate: 'x' }, { mandate: [] },
    { request: null }, { request: 'x' },
    { request: { ...good.request, amount_minor: 1.5 } },
    { extensions: [] }, { extensions: { total_budget_minor: 'x' } },
    { extensions: { spent_minor: -1 } }, { extensions: { allowed_rails: 'rail-a' } },
    { extensions: { verified_payees: [42] } }, { extensions: { revoked_at: 'yesterday' } },
    { mandate: { ...good.mandate, issued_at: '2026-10-01T00:00:00+00:00' } },
    { mandate: { ...good.mandate, expires_at: 'nope' } },
    { mandate: { ...good.mandate, max_amount: '250.' + '0'.repeat(CAP_DIGITS[good.mandate.currency]) + '1' } }, // one fractional digit more than the draw's currency allows
    { mandate: { ...good.mandate, max_amount: 'abc' } },
    { mandate: { ...good.mandate, max_amount: 250 } }, // not a string
    { mandate: { ...good.mandate, currency: 'XYZ' } },
    { mandate: { ...good.mandate, currency: 'usd' } },
    { mandate: { ...good.mandate, currency: 840 } },
  ];
  for (const over of bad) {
    try {
      const r = compute({ ...good, ...over });
      checked++;
      const op = r.output_payload;
      const named = (op.reasons && op.reasons.length > 0) || op.error === 'unknown_mode';
      if (!named) violations++;
      if (!Array.isArray(r.compliance_flags) || r.compliance_flags.length === 0) violations++;
    } catch (e) {
      checked++;
      violations++;
    }
  }
  void rng;
  return { name: 'P4 invalid-domain inputs refused with named reasons, never a throw', checked, violations };
}

// P5: compute() is deterministic (two runs agree byte-for-byte) and every payload —
// authorize, reject and verify_commit — is free of undefined/NaN/non-finite values.
function checkDeterminismAndShape() {
  const rng = mulberry32(703005);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 25; i++) {
    const pp = authorizingDraw(rng);
    const r1 = compute(pp);
    const r2 = compute(pp);
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) violations++;
    checked++;
    if (findShapeViolations(r1.output_payload).length > 0) violations++;
    // a rejected run and a verify_commit run too
    const rej = compute({ ...pp, request: { ...pp.request, amount_minor: 0 } });
    checked++;
    if (findShapeViolations(rej.output_payload).length > 0) violations++;
    if (r1.output_payload.decision === 'authorize') {
      const vc = compute({ mode: 'verify_commit', as_of: r1.output_payload.authorization.not_before, authorization: r1.output_payload.authorization, request: pp.request });
      checked++;
      if (findShapeViolations(vc.output_payload).length > 0) violations++;
      if (vc.output_payload.decision !== 'commit_ok') violations++;
    }
  }
  return { name: 'P5 determinism and output shape: no undefined/NaN/non-finite anywhere', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkRequestBinding(),
  checkExpiredNeverAuthorizes(),
  checkKeyOrderStability(),
  checkRefusals(),
  checkDeterminismAndShape(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — F1..F17 fixture oracle + P1..P5.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
