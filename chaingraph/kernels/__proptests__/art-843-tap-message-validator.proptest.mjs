// art-843-tap-message-validator — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:35a4efe832dbdbe3b3d7369c118ac4cd0ab8e2fc330600f057f250829b0d1b8d
// spec: board/claimed/TAP-MESSAGE-VALIDATOR-NODE-1.md
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-843-tap-message-validator.proptest.mjs

import { compute } from '../art-843-tap-message-validator.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = 'art-843-tap-message-validator';
const CTX = 'https://tap.rsvp/schema/1.0';
const H = CTX + '#';
const ORIG = 'did:web:originator.vasp';
const BENE = 'did:web:beneficiary.vasp';
const ETH = 'eip155:1:0x1234a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb';
const uu = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

function randomMessage(rng, id, thid) {
  const kind = pick(rng, ['Transfer', 'Authorize', 'Reject', 'Settle', 'Revert', 'Payment', 'Cancel', 'Connect']);
  const m = { id, from: ORIG, to: [BENE], type: H + kind };
  if (thid != null) m.thid = thid;
  if (rng() < 0.5) m.created_time = '2026-11-13T10:00:00Z';
  const ld = { '@context': CTX, '@type': H + kind };
  if (kind === 'Transfer') m.body = { asset: 'eip155:1/slip44:60', amount: '1.5', settlementAddress: ETH, agents: [{ '@id': ORIG, role: 'Originator' }] };
  else if (kind === 'Authorize') m.body = Object.assign(ld, rng() < 0.5 ? { amount: '2' } : {});
  else if (kind === 'Reject') m.body = Object.assign(ld, rng() < 0.5 ? { code: 'AC03' } : { reason: 'SYNTHETIC' });
  else if (kind === 'Settle') m.body = Object.assign(ld, { settlementAddress: ETH });
  else if (kind === 'Revert') m.body = Object.assign(ld, { settlementAddress: ETH, reason: '[len:12]' });
  else if (kind === 'Payment') m.body = Object.assign(ld, { currency: 'USD', amount: '3', merchant: { '@id': BENE }, agents: [{ '@id': BENE }] });
  else if (kind === 'Cancel') m.body = { reason: 'SYNTHETIC', by: ORIG };
  else m.body = {};
  if (rng() < 0.2) delete m.body.amount;
  return m;
}

function randomPP(rng) {
  const n = 1 + Math.floor(rng() * 5);
  const messages = [];
  for (let i = 0; i < n; i++) {
    const thid = i > 0 && rng() < 0.7 ? uu(1 + Math.floor(rng() * i)) : null;
    messages.push(randomMessage(rng, uu(1 + i), thid));
  }
  return { messages };
}

function shuffleKeys(rng, v) {
  if (Array.isArray(v)) return v.map((x) => shuffleKeys(rng, x));
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v);
    for (let i = ks.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = ks[i]; ks[i] = ks[j]; ks[j] = t; }
    const o = {};
    for (const k of ks) o[k] = shuffleKeys(rng, v[k]);
    return o;
  }
  return v;
}

function checkKeyOrderInvariance() {
  const rng = mulberry32(843);
  let checked = 0, violations = 0;
  for (let i = 0; i < 40; i++) {
    const pp = randomPP(rng);
    checked++;
    if (!deepEqual(compute(pp), compute(shuffleKeys(rng, pp)))) violations++;
  }
  return { name: 'key_order_never_changes_verdict', checked, violations };
}

function checkUnknownFieldFlagged() {
  const rng = mulberry32(8430);
  let checked = 0, violations = 0;
  for (let i = 0; i < 40; i++) {
    const pp = randomPP(rng);
    const which = Math.floor(rng() * pp.messages.length);
    // an uncovered type's body is never walked, so only the envelope can carry the extra field there
    const atBody = rng() < 0.5 && pp.messages[which].type !== H + 'Connect';
    const target = atBody ? pp.messages[which].body : pp.messages[which];
    target.zz_unknown_field = 'SYNTHETIC';
    const r = compute(pp);
    checked++;
    if (r.output_payload.status !== 'report') { violations++; continue; }
    const rec = r.output_payload.messages[which];
    const path = (atBody ? 'body.' : '') + 'zz_unknown_field';
    if (!rec.unexpected_fields.some((u) => u.path === path)) violations++;
    if (r.compliance_flags.indexOf('TAP_UNEXPECTED_FIELDS') === -1) violations++;
  }
  return { name: 'unknown_field_always_flagged', checked, violations };
}

function checkNeverClaimsValid() {
  const rng = mulberry32(8431);
  let checked = 0, violations = 0;
  for (let i = 0; i < 40; i++) {
    const pp = randomPP(rng);
    if (rng() < 0.3) pp.messages[0].signatures = [{ protected: 'e30', signature: 'c2ln' }];
    const o = compute(pp).output_payload;
    checked++;
    if (o.signatures_verified !== false || o.identifiers_resolved !== false || o.compliance_determination !== false) violations++;
    const hasSig = pp.messages[0].signatures !== undefined;
    if (hasSig !== (o.messages[0].signature_material === 'present_not_verified')) violations++;
    for (const m of o.messages) {
      if (m.coverage === 'not_covered' && m.status !== 'not_covered') violations++;
      if (m.status === 'valid') violations++;
    }
  }
  return { name: 'never_claims_valid_or_verified', checked, violations };
}

function checkReplyToEarlierIdNotDangling() {
  const rng = mulberry32(8432);
  let checked = 0, violations = 0;
  for (let i = 0; i < 40; i++) {
    const pp = randomPP(rng);
    const r = compute(pp);
    checked++;
    const dangling = r.output_payload.thread.dangling_reply_indexes;
    // every generated thid points at an earlier index, so none may dangle
    if (pp.messages.length > 1 && dangling.length !== 0) violations++;
    // now point one reply at an id outside the set
    const j = 1 + Math.floor(rng() * Math.max(1, pp.messages.length - 1));
    if (pp.messages.length > 1) {
      pp.messages[j].thid = uu(900);
      const d2 = compute(pp).output_payload.thread.dangling_reply_indexes;
      if (d2.indexOf(j) === -1) violations++;
    }
  }
  return { name: 'thread_dangling_iff_thid_outside_earlier_ids', checked, violations };
}

function checkFlagsMirror() {
  const rng = mulberry32(8433);
  let checked = 0, violations = 0;
  for (let i = 0; i < 40; i++) {
    const r = compute(randomPP(rng));
    checked++;
    if (!deepEqual(r.output_payload.warnings, r.compliance_flags)) violations++;
    const some = r.output_payload.messages.some((m) => m.findings.length > 0);
    if (some !== (r.compliance_flags.indexOf('TAP_STRUCTURE_FINDINGS') !== -1)) violations++;
  }
  return { name: 'warnings_mirror_flags_and_findings_iff_flag', checked, violations };
}

function checkRefusals() {
  const base = randomMessage(mulberry32(1), uu(1), null);
  const bad = [
    {}, { messages: [] }, { messages: 'x' }, { messages: [1] },
    { messages: new Array(33).fill(base) },
    { messages: [{ id: uu(1), type: H + 'Reject', body: { '@context': CTX, '@type': H + 'Reject', reason: 'Beneficiary name mismatch' } }] },
    { messages: [{ id: uu(1), type: H + 'Transfer', body: { originator: { '@id': ORIG, name: 'Alice' } } }] },
    { messages: [{ id: uu(1), type: H + 'Transfer', body: { originator: { '@id': ORIG, ivms101: { a: { b: 'Jane' } } } } }] },
    { messages: [{ id: uu(1), type: H + 'Connect', body: { label: 'Jane' } }] },
  ];
  let violations = 0;
  for (const pp of bad) {
    const r = compute(pp);
    if (r.output_payload.status !== 'refused' || r.compliance_flags.join() !== 'INPUT_REFUSED') violations++;
    if (JSON.stringify(r.output_payload).indexOf('Jane') !== -1 || JSON.stringify(r.output_payload).indexOf('Alice') !== -1) violations++;
  }
  return { name: 'free_text_and_bad_input_refused_without_echo', checked: bad.length, violations };
}

function checkDeterminism() {
  const rng = mulberry32(8434);
  let checked = 0, violations = 0;
  for (let i = 0; i < 30; i++) {
    const pp = randomPP(rng);
    checked++;
    if (!deepEqual(compute(pp), compute(JSON.parse(JSON.stringify(pp))))) violations++;
  }
  return { name: 'deterministic', checked, violations };
}

const PROTO_KEYS = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'isPrototypeOf'];
const withKey = (o, k, v) => { Object.defineProperty(o, k, { value: v, enumerable: true, configurable: true, writable: true }); return o; };

// compute never throws, whatever Object.prototype name a key carries, at every depth the walker reads
function checkPrototypeNamesNeverThrow() {
  const rng = mulberry32(8435);
  let checked = 0, violations = 0;
  for (let i = 0; i < 40; i++) {
    const pp = randomPP(rng);
    const m = pp.messages[0];
    const k = pick(rng, PROTO_KEYS);
    const v = pick(rng, ['SYNTHETIC', 'plain text', 7, null, { a: 'x' }, ['x']]);
    const where = Math.floor(rng() * 4);
    if (where === 0) withKey(m, k, v);
    else if (where === 1 && m.body && typeof m.body === 'object') withKey(m.body, k, v);
    else if (where === 2) m.body = Object.assign({}, m.body, { originator: { '@id': ORIG, ivms101: withKey({}, k, v) } });
    else m.body = Object.assign({}, m.body, { originator: withKey({ '@id': ORIG }, k, v) });
    checked++;
    try { compute(pp); } catch (e) { violations++; }
  }
  return { name: 'prototype_named_keys_never_throw', checked, violations };
}

// a calendar-impossible day is always BAD_FORMAT and a real day never is
function checkCalendarDates() {
  const dim = (y, mo) => (mo === 2 ? ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28) : [4, 6, 9, 11].indexOf(mo) !== -1 ? 30 : 31);
  const rng = mulberry32(8436);
  let checked = 0, violations = 0;
  for (let i = 0; i < 60; i++) {
    const y = 1900 + Math.floor(rng() * 300), mo = 1 + Math.floor(rng() * 12), d = 1 + Math.floor(rng() * 31);
    const pp = randomPP(rng);
    pp.messages[0].created_time = String(y) + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0') + 'T10:00:00Z';
    const f = compute(pp).output_payload.messages[0].findings.some((x) => x.path === 'created_time' && x.code === 'BAD_FORMAT');
    checked++;
    if (f !== (d > dim(y, mo))) violations++;
  }
  return { name: 'calendar_day_valid_iff_within_month', checked, violations };
}

// a present null is never read as absent: every typed header field turns it into a finding
function checkPresentNullIsFinding() {
  const rng = mulberry32(8437);
  let checked = 0, violations = 0;
  for (let i = 0; i < 40; i++) {
    const pp = randomPP(rng);
    const k = pick(rng, ['thid', 'from', 'to', 'created_time', 'expires_time', 'please_ack', 'ack']);
    pp.messages[0][k] = null;
    const r = compute(pp);
    checked++;
    if (r.output_payload.status !== 'report' || !r.output_payload.messages[0].findings.some((x) => x.path === k && x.code === 'WRONG_TYPE')) violations++;
  }
  return { name: 'present_null_is_wrong_type_finding', checked, violations };
}

// free text under any location the schema walk does not format-check refuses, and never echoes
function checkFreeTextAnywhereRefused() {
  const rng = mulberry32(8438);
  let checked = 0, violations = 0;
  for (let i = 0; i < 40; i++) {
    const pp = randomPP(rng);
    const m = pp.messages[0];
    const where = Math.floor(rng() * 5);
    if (where === 0) m.zz_extra = 'Jane Q Public';
    else if (where === 1) m.body = Object.assign({}, m.body, { zz_extra: 'Jane Q Public' });
    else if (where === 2) m.body = Object.assign({}, m.body, { originator: { '@id': ORIG, address: 'Jane Q Public' } });
    else if (where === 3) m.body = Object.assign({}, m.body, { purpose: 'Jane Q Public', reasonCode: 'Jane Q Public' });
    else { m.type = H + 'Unlisted'; m.body = ['Jane Q Public']; }
    const r = compute(pp);
    checked++;
    if (r.output_payload.status !== 'refused' || JSON.stringify(r.output_payload).indexOf('Jane') !== -1) violations++;
  }
  return { name: 'free_text_under_unchecked_locations_refused', checked, violations };
}

// an unsafe integer or a non-finite number anywhere in pp is refused with the named reason
// BEFORE the artifact hash would throw on it, whatever location carries it, and the value
// itself is never echoed (only the path and the kind are)
function checkUnsafeNumbersRefused() {
  const rng = mulberry32(8439);
  const HOSTILE = [9007199254740992, 1e300, -9007199254740992, -1e300, JSON.parse('1e999')];
  let checked = 0, violations = 0;
  for (let i = 0; i < 40; i++) {
    const pp = randomPP(rng);
    const m = pp.messages[0];
    const where = Math.floor(rng() * 3);
    if (where === 0) m.body = Object.assign({}, m.body, { exchangeRate: { rate: pick(rng, HOSTILE), from: 'USD', to: 'EUR' } });
    else if (where === 1) m.zz_amount = pick(rng, HOSTILE);
    else m.body = Object.assign({}, m.body, { transactionValue: { amount: '1', currency: 'USD', zz_n: pick(rng, HOSTILE) } });
    const r = compute(pp);
    checked++;
    if (r.output_payload.status !== 'refused' || r.output_payload.reason !== 'unsafe_number_refused') violations++;
    if (r.compliance_flags.join() !== 'INPUT_REFUSED') violations++;
    if (/e\+3\d\d|Infinity|9007199254740992/.test(JSON.stringify(r.output_payload))) violations++;
  }
  // nearest passing shapes: the largest safe integer and an ordinary float stay report-shaped
  // (on a Transfer body exchangeRate is a format-checked field, so the numbers are legal there)
  const okPP = { messages: [Object.assign(randomMessage(mulberry32(2), uu(1), null), {
    type: H + 'Transfer',
    body: { asset: 'eip155:1/slip44:60', amount: '1.5', settlementAddress: ETH, agents: [{ '@id': ORIG, role: 'Originator' }], exchangeRate: { rate: 9007199254740991, from: 'USD', to: 'EUR' } },
  })] };
  const okR = compute(okPP);
  checked++;
  if (okR.output_payload.status !== 'report' || okR.output_payload.reason !== undefined) violations++;
  const floatPP = JSON.parse(JSON.stringify(okPP));
  floatPP.messages[0].body.exchangeRate.rate = 1.5;
  const floatR = compute(floatPP);
  checked++;
  if (floatR.output_payload.status !== 'report' || floatR.output_payload.reason !== undefined) violations++;
  return { name: 'unsafe_or_non_finite_number_refused_named', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [checkKeyOrderInvariance(), checkUnknownFieldFlagged(), checkNeverClaimsValid(), checkReplyToEarlierIdNotDangling(), checkFlagsMirror(), checkRefusals(), checkDeterminism(),
  checkPrototypeNamesNeverThrow(), checkCalendarDates(), checkPresentNullIsFinding(), checkFreeTextAnywhereRefused(), checkUnsafeNumbersRefused()];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
