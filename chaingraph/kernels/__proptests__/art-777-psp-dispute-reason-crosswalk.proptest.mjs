// art-777-psp-dispute-reason-crosswalk — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:a62af4e74f99726232353c2d35efa97d4a34cf86cbeb2c0e570b10baf62616b0
// spec: PSP-DISPUTE-CROSSWALK-NODE-1 (board/queued), narrowed static + credential-free
//   per the desk; clause authority research/clause-snapshots/{paypal,stripe,adyen,square}-disputes-2026-10/SNAPSHOT.md.
// human_sign_off: PENDING
//
// SCOPE: floor tier only. NOT a proof, NOT Dafny.
// float_sensitive: NO — pure table lookup, string assembly and set membership;
//   no arithmetic at all beyond array lengths.
//
// Checks:
//   fixture-oracle gate (mandatory before any property is trusted),
//   P1 total vocabulary coverage: every snapshot-published reason of every PSP
//      vocabulary (paypal/stripe/adyen/square) returns a non-refused payload
//      whose per_psp_match keys are exactly the four PSPs and whose input echo
//      is the query itself,
//   P2 citation honesty: every crosswalk cell with match exact or partial cites
//      at least one clause (non-empty id, quote and url); every none cell has
//      value null, match none and a no-support basis; no cell carries a value
//      without a match; the network note is always present,
//   P3 concept symmetry + determinism: the same concept reached from different
//      PSPs yields identical crosswalk cell VALUES (the crosswalk is a function
//      of the concept, not of the querying PSP); identical inputs replay
//      byte-identically,
//   P4 network-code lookup: every code published in a concept's network map is
//      resolvable by {network_code:{network,code}} to that concept with a
//      network_input echo; unknown network and unknown code are named refusals,
//   P5 singleton no-inference: a value in exactly one PSP's vocabulary returns
//      an exact queried cell and never an exact cell anywhere else; other-PSP
//      cells are none with a no-support basis — except the one designed,
//      clause-cited partial (Adyen scheme codes S5's Visa table places inside a
//      Stripe category), whose value must be a published Stripe reason. A
//      mapping no snapshot supports is none, never inferred,
//   P6 forced categorical refusals: unknown PSP, unknown reason per PSP
//      (including PayPal's American UNAUTHORIZED vs the schema v1.12 British
//      UNAUTHORISED), both input shapes at once, empty input, unknown network,
//      unknown network code, non-string reason — each a named refusal with a
//      domain_error and the ART777_INPUT_REFUSED flag, never a silent guess.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-777-psp-dispute-reason-crosswalk.proptest.mjs

import {
  compute as compute777,
  LOOKUP,
  PSPS,
  CONCEPTS,
  PAYPAL_REASONS,
  STRIPE_REASONS,
  ADYEN_VISA_CODES,
  SQUARE_REASONS,
} from '../art-777-psp-dispute-reason-crosswalk.kernel.mjs';
import { mulberry32, pick, runFixtureOracle, summarize } from './_pbt-common.mjs';
import { readFileSync } from 'node:fs';

const KERNEL_ID = 'art-777-psp-dispute-reason-crosswalk';
const VOCAB = { paypal: PAYPAL_REASONS, stripe: STRIPE_REASONS, adyen: ADYEN_VISA_CODES, square: SQUARE_REASONS };

const rand = mulberry32(0x0A777);
function randomPP(rng) {
  const roll = rng();
  if (roll < 0.7) {
    const psp = pick(rng, PSPS);
    return { psp, reason: pick(rng, VOCAB[psp]) };
  }
  if (roll < 0.85) {
    const net = pick(rng, ['visa', 'mastercard']);
    let code = '13.1';
    for (const c of Object.values(CONCEPTS)) {
      if (c.network[net] && c.network[net].length) { code = c.network[net][Math.floor(rng() * c.network[net].length)].code; break; }
    }
    return { network_code: { network: net, code } };
  }
  if (roll < 0.93) return { psp: pick(rng, PSPS), reason: 'not_a_snapshot_reason_' + Math.floor(rng() * 1000) };
  return { psp: pick(rng, ['wise', 'braintree', 'checkout.com']) };
}

// ---------- P1 total vocabulary coverage + echo ----------
function checkP1_coverage() {
  let checked = 0, violations = 0;
  for (const psp of PSPS) {
    for (const reason of VOCAB[psp]) {
      checked++;
      const { output_payload: o } = compute777({ psp, reason });
      if (o.refusal_reason !== null) { violations++; continue; }
      if (JSON.stringify(Object.keys(o.per_psp_match).sort()) !== JSON.stringify([...PSPS].sort())) violations++;
      if (JSON.stringify(o.input) !== JSON.stringify({ psp, reason })) violations++;
      if (!o.crosswalk || JSON.stringify(Object.keys(o.crosswalk).sort()) !== JSON.stringify([...PSPS].sort())) violations++;
      if (!o.network_codes_note || !Array.isArray(o.network_codes_note.clauses)) violations++;
    }
  }
  return { name: 'P1_total_vocabulary_coverage', checked, violations };
}

// ---------- P2 citation honesty ----------
function checkP2_citations() {
  let checked = 0, violations = 0;
  for (const psp of PSPS) {
    for (const reason of VOCAB[psp]) {
      const { output_payload: o } = compute777({ psp, reason });
      if (o.refusal_reason !== null) continue;
      for (const cell of Object.values(o.crosswalk)) {
        checked++;
        if (cell.match === 'exact' || cell.match === 'partial') {
          if (!Array.isArray(cell.clauses) || cell.clauses.length === 0) violations++;
          for (const cl of cell.clauses) {
            if (!cl.id || !cl.quote || !cl.url) violations++;
          }
          if (cell.value === null || cell.value === undefined) violations++;
          if (typeof cell.basis !== 'string' || cell.basis.length === 0) violations++;
        } else if (cell.match === 'none') {
          if (cell.value !== null) violations++;
          if (typeof cell.basis !== 'string' || !/none/i.test(cell.basis)) violations++;
        } else {
          violations++; // match must be one of the three grades
        }
      }
    }
  }
  return { name: 'P2_citation_honesty', checked, violations };
}

// ---------- P3 concept symmetry + determinism ----------
function checkP3_symmetry() {
  let checked = 0, violations = 0;
  // All reasons mapping to the same concept must produce identical crosswalk
  // cell values whichever PSP the query came in on.
  const byConcept = {};
  for (const psp of PSPS) for (const reason of VOCAB[psp]) {
    if (LOOKUP[psp][reason]) (byConcept[LOOKUP[psp][reason]] ||= []).push({ psp, reason });
  }
  for (const [concept, queries] of Object.entries(byConcept)) {
    const values = new Set();
    for (const q of queries) {
      const { output_payload: o } = compute777(q);
      if (o.refusal_reason !== null || o.concept !== concept) { violations++; continue; }
      values.add(JSON.stringify(Object.fromEntries(PSPS.map((p) => [p, o.crosswalk[p].value]))));
      checked++;
    }
    if (values.size !== 1) violations++;
  }
  for (let i = 0; i < 200; i++) {
    const pp = randomPP(rand);
    const a = compute777(pp), b = compute777(JSON.parse(JSON.stringify(pp)));
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'P3_concept_symmetry_determinism', checked, violations };
}

// ---------- P4 network-code lookup ----------
function checkP4_network_codes() {
  let checked = 0, violations = 0;
  for (const [concept, c] of Object.entries(CONCEPTS)) {
    for (const net of ['visa', 'mastercard']) {
      for (const n of c.network[net] || []) {
        checked++;
        const { output_payload: o } = compute777({ network_code: { network: net, code: n.code } });
        if (o.refusal_reason !== null) { violations++; continue; }
        if (o.concept !== concept) violations++;
        if (JSON.stringify(o.network_input) !== JSON.stringify({ network: net, code: n.code })) {
          if (!o.network_input || o.network_input.network !== net || o.network_input.code !== n.code) violations++;
        }
      }
    }
  }
  return { name: 'P4_network_code_lookup', checked, violations };
}

// ---------- P5 singleton no-inference ----------
function checkP5_singletons() {
  let checked = 0, violations = 0;
  for (const psp of PSPS) {
    for (const reason of VOCAB[psp]) {
      if (LOOKUP[psp][reason]) continue; // concepts covered by P2/P3
      checked++;
      const { output_payload: o } = compute777({ psp, reason });
      if (o.refusal_reason !== null) { violations++; continue; }
      if (o.concept !== null) violations++;
      const own = o.crosswalk[psp];
      if (own.match !== 'exact' || own.value !== reason) violations++;
      for (const other of PSPS) {
        if (other === psp) continue;
        const cell = o.crosswalk[other];
        if (cell.match === 'exact') violations++; // a singleton has no exact equivalent anywhere else
        if (cell.match === 'none') {
          if (cell.value !== null) violations++;
          if (typeof cell.basis !== 'string' || !/none/i.test(cell.basis)) violations++;
        } else if (cell.match === 'partial') {
          // the one designed exception: Adyen scheme codes S5's Visa table places
          // inside a Stripe category carry that CITED category mapping — a
          // documented partial, never an inference. Value must be a published
          // member of that PSP's vocabulary and the cell must cite clauses.
          if (psp !== 'adyen' || other !== 'stripe') violations++;
          if (!VOCAB[other].includes(cell.value)) violations++;
          if (!Array.isArray(cell.clauses) || cell.clauses.length === 0) violations++;
        } else {
          violations++;
        }
      }
    }
  }
  return { name: 'P5_singleton_no_inference', checked, violations };
}

// ---------- P6 forced categorical refusals ----------
function checkP6_forced_categorical() {
  let checked = 0, violations = 0;
  const cases = [
    [{ psp: 'wise', reason: 'UNAUTHORISED' }, 'REFUSED_UNKNOWN_PSP'],
    [{ psp: 'braintree', reason: 'fraudulent' }, 'REFUSED_UNKNOWN_PSP'],
    [{ psp: 'paypal', reason: 'UNAUTHORIZED' }, 'REFUSED_UNKNOWN_REASON'], // American spelling is not schema v1.12
    [{ psp: 'stripe', reason: 'not_a_snapshot_reason' }, 'REFUSED_UNKNOWN_REASON'],
    [{ psp: 'adyen', reason: '13.9' }, 'REFUSED_UNKNOWN_REASON'],
    [{ psp: 'square', reason: 'CARD_SWIPE' }, 'REFUSED_UNKNOWN_REASON'],
    [{ psp: 'paypal', reason: 'UNAUTHORISED', network_code: { network: 'visa', code: '13.1' } }, 'REFUSED_INPUT_SHAPE'],
    [{}, 'REFUSED_UNKNOWN_PSP'], // no psp at all: the categorical psp check fires first
    [{ network_code: { network: 'amex', code: '13.1' } }, 'REFUSED_UNKNOWN_NETWORK'],
    [{ network_code: { network: 'visa', code: '99.9' } }, 'REFUSED_UNKNOWN_NETWORK_CODE'],
    [{ network_code: { network: 'mastercard', code: '00.0' } }, 'REFUSED_UNKNOWN_NETWORK_CODE'],
    [{ psp: 'paypal', reason: 13.1 }, 'REFUSED_UNKNOWN_REASON'],
  ];
  for (const [pp, want] of cases) {
    checked++;
    const { output_payload: o, compliance_flags } = compute777(pp);
    if (o.refusal_reason !== want || o.refused !== want || !o.domain_errors.some((d) => d.code === want)) violations++;
    if (!compliance_flags.includes('ART777_INPUT_REFUSED')) violations++;
  }
  // every vocabulary value must NOT be refused (the inverse check)
  for (const psp of PSPS) {
    checked++;
    const { output_payload: o } = compute777({ psp, reason: VOCAB[psp][0] });
    if (o.refusal_reason !== null) violations++;
  }
  return { name: 'P6_forced_categorical_refusals', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute777);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(fixtures present)', got: String((e && e.message) || e) }] };
}

const kernelSource = readFileSync(new URL('../art-777-psp-dispute-reason-crosswalk.kernel.mjs', import.meta.url), 'utf8');
if (/JSON\.stringify\([\s\S]{0,200}?,\s*Object\.keys\([\s\S]{0,160}?\)\.sort\(\)\s*\)/.test(kernelSource) || /function\s+simpleHash\s*\(/.test(kernelSource)) {
  oracle.failures.push({ name: 'forbidden-hash-pattern', expected: 'none', got: 'kernel matches a lint-forbidden-hash pattern' });
}

const properties = [
  checkP1_coverage(),
  checkP2_citations(),
  checkP3_symmetry(),
  checkP4_network_codes(),
  checkP5_singletons(),
  checkP6_forced_categorical(),
];

const okRun = summarize(KERNEL_ID, oracle, properties);
process.exit(okRun ? 0 : 1);
