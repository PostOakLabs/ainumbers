// art-843-tap-message-validator — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:0c5ef12455dd4a8f76dbfa649e603e195632353f090208b5ea42747039f5594e
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
    target.zz_unknown_field = true;
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

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [checkKeyOrderInvariance(), checkUnknownFieldFlagged(), checkNeverClaimsValid(), checkReplyToEarlierIdNotDangling(), checkFlagsMirror(), checkRefusals(), checkDeterminism()];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
