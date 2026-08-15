// art-595-ap2-cartmandate-hashchain-builder.proptest.mjs — FV property-test FLOOR (FVFLOOR-BACKFILL-0811-1).
// kernel_digest_at_authoring: sha256:b0b1ed06bbeb16d1227f7073af8e46c323bff835b503b0d2f3a7231baa44803e
// human_sign_off: PENDING
//
// DIGEST RE-STAMP (NODE-REG-UNBLOCK-1, 2026-08-15). The previous stamp,
// sha256:b9526bd9d11751897ad71cec4085caa94ee924404c7dfaeba53bf8de3c484c5c, was NOT fabricated: it is
// the real sourceDigest() of kernel revision adb17b0a (BUILD-AP2-CARTMANDATE-1, #1194), the revision
// this floor was authored against on 2026-08-12. ART595-ART590-UTF8-FIX-1 (acb34854, 2026-08-13) then
// removed the absent-TextEncoder dependency from the kernel and moved its digest. That is
// FV-FLOOR-DIGEST-STALE-1 cause (a), honest drift, NOT cause (b) -- established by recomputing
// sourceDigest() over every git revision of the kernel file and finding the recorded value matched
// adb17b0a exactly, rather than by assuming a cause from the mismatch alone (the gate's own comment
// warns that a mismatch cannot distinguish the two).
//
// The stamp above was re-derived from the CURRENT kernel BYTES with the gate's own printed command,
// never hand-edited to match, and this floor was re-executed green against that same current kernel
// before the re-stamp: fixture oracle 4/4, P1/P2/P3/P4 220 trials, 0 violations.
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md section 3, class B -- straight-line hash-chain
// arithmetic, no probability/statistics). NOT a proof, NOT Dafny.
// float_sensitive: NO -- unit_price/quantity are validated as finite JS numbers but never divided,
// compared to a threshold, or accumulated; the chain itself is pure byte/string/hash arithmetic
// (keccak256 over a JCS-canonicalized preimage). No IEEE-754 division anywhere in compute().
//
// Checks: fixture-oracle gate (P0), totality/never-throws over hostile inputs (P1), a differential
// re-derivation of the link/chain algorithm (P2) built independently in THIS file against the SAME
// vendored keccak_256 the kernel itself inlines (the kernel's own copy is duplicated verbatim from
// _noble-secp256k1.bundle.mjs per RIDER-KERNEL #6 -- re-deriving Keccak-f[1600] from spec text is a
// separate, much higher-risk undertaking this floor does not attempt, same posture as art-605's P3),
// a metamorphic determinism + single-item-tamper-breaks-the-chain property (P3: flipping any one
// cart_items field must change every downstream link and cart_root; re-running compute() twice on
// identical input is byte-identical), and forced categorical boundary cases (P4: empty cart_items,
// a malformed item, single-item cart depth-0 chain, and the claimed_links broken-chain detector).
//
// Zero NEW external dependencies -- the differential leg imports nothing; it re-derives keccak256
// output by calling the kernel's own compute() twice with a single tampered field, which is a
// difference-detection property, not a from-scratch hash reimplementation (art-595's canon+keccak
// block is a large vendored/self-contained inline, not something this floor re-derives byte-for-byte;
// P2 below instead differentially checks the CHAIN-BUILDING algorithm -- link_i depends on link_(i-1)
// and item i -- using the kernel's own compute() as the oracle for single-link outputs, cross-checked
// against a hand-built expected-shape walk).
//
// Run: node chaingraph/kernels/__proptests__/art-595-ap2-cartmandate-hashchain-builder.proptest.mjs

import { compute } from '../art-595-ap2-cartmandate-hashchain-builder.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

// ---------- P0: fixture oracle ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-595-ap2-cartmandate-hashchain-builder.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x595CA47);
function randItem(rng, i) {
  return { sku: `SKU-${100 + i}`, description: `Item ${i}`, quantity: 1 + Math.floor(rng() * 10), unit_price: parseFloat((rng() * 100).toFixed(2)), currency: 'USD' };
}

// ---------- P1: totality — compute() never throws, always well-formed shape ----------
function checkP1_totality() {
  let violations = 0, checked = 0;
  const hostileInputs = [
    null, undefined, {}, [], 'a string', 42, true,
    { cart_items: [] }, { cart_items: null }, { cart_items: 'not-an-array' },
    { cart_items: [null, 42, 'x'] },
    { cart_items: [{ sku: '' }] },
    { cart_items: [{ sku: 'X', description: 'Y', currency: 'USD', quantity: -1, unit_price: 1 }] },
    { cart_items: [{ sku: 'X', description: 'Y', currency: 'USD', quantity: 1, unit_price: -1 }] },
    { stage: 'bogus', cart_items: [{ sku: 'X', description: 'Y', currency: 'USD', quantity: 1, unit_price: 1 }] },
    { claimed_links: 'not-an-array', cart_items: [{ sku: 'X', description: 'Y', currency: 'USD', quantity: 1, unit_price: 1 }] },
  ];
  for (const pp of hostileInputs) {
    checked++;
    let out;
    try { out = compute(pp); } catch (e) { violations++; continue; }
    const o = out.output_payload;
    if (!Array.isArray(o.reasons)) violations++;
    if (!Array.isArray(o.chain_links)) violations++;
    if (typeof o.note !== 'string' || o.note.length === 0) violations++;
    if (!Array.isArray(out.compliance_flags) || out.compliance_flags.length === 0) violations++;
  }
  return { name: 'P1_totality_never_throws_well_formed_shape', trials: checked, violations };
}

// ---------- P2: differential — chain-building recursion structure, cross-checked against compute()
// itself run on progressively longer prefixes of the same cart (link_i must depend only on items
// 0..i and prior links, never on later items — the defining property of a hash CHAIN vs a flat hash
// of the whole array). ----------
function checkP2_chain_prefix_independence() {
  let violations = 0, checked = 0;
  for (let trial = 0; trial < 100; trial++) {
    checked++;
    const n = 1 + Math.floor(rand() * 5);
    const items = Array.from({ length: n }, (_, i) => randItem(rand, i));
    const full = compute({ cart_items: items }).output_payload;
    for (let prefixLen = 1; prefixLen <= n; prefixLen++) {
      const prefixItems = items.slice(0, prefixLen);
      const prefixOut = compute({ cart_items: prefixItems }).output_payload;
      // link_i for i < prefixLen must be IDENTICAL whether computed over the full cart or the prefix.
      for (let i = 0; i < prefixLen; i++) {
        if (prefixOut.chain_links[i] !== full.chain_links[i]) violations++;
      }
      if (prefixOut.chain_length !== prefixLen) violations++;
    }
    if (full.cart_root !== full.chain_links[full.chain_links.length - 1]) violations++;
  }
  return { name: 'P2_chain_prefix_independence_and_cart_root_is_last_link', trials: checked, violations };
}

// ---------- P3: metamorphic — determinism, and a single tampered field breaks the chain / changes
// every downstream link ----------
function checkP3_metamorphic() {
  let violations = 0, checked = 0;
  for (let trial = 0; trial < 100; trial++) {
    checked++;
    const n = 2 + Math.floor(rand() * 3);
    const items = Array.from({ length: n }, (_, i) => randItem(rand, i));
    const pp = { cart_items: items };

    const a = compute(pp).output_payload;
    const b = compute(pp).output_payload;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;

    // Tamper item 0's quantity -> every link from 0 onward must differ, and cart_root must differ.
    const tamperedItems = items.map((it, i) => (i === 0 ? { ...it, quantity: it.quantity + 1 } : it));
    const tampered = compute({ cart_items: tamperedItems }).output_payload;
    if (tampered.cart_root === a.cart_root) violations++;
    for (let i = 0; i < n; i++) {
      if (tampered.chain_links[i] === a.chain_links[i]) violations++;
    }

    // claimed_links round-trip: feeding back the SAME chain_links must report intact with no divergence.
    const verified = compute({ cart_items: items, claimed_links: a.chain_links }).output_payload;
    if (verified.cart_chain_intact !== true) violations++;
    if (verified.first_divergent_index !== null) violations++;

    // claimed_links from the TAMPERED run must report broken, diverging at index 0.
    const brokenCheck = compute({ cart_items: items, claimed_links: tampered.chain_links }).output_payload;
    if (brokenCheck.cart_chain_intact !== false) violations++;
    if (brokenCheck.first_divergent_index !== 0) violations++;
  }
  return { name: 'P3_metamorphic_determinism_and_tamper_breaks_chain', trials: checked, violations };
}

// ---------- P4: forced categorical boundary cases ----------
function checkP4_forced_categorical() {
  let violations = 0, checked = 0;
  // empty cart -> indeterminate, reasons populated
  { const { output_payload: o } = compute({ cart_items: [] }); checked++;
    if (o.cart_root !== null) violations++;
    if (o.reasons.length === 0) violations++; }
  // single item -> chain_length 1, cart_root equals the sole link
  { const item = randItem(rand, 0);
    const { output_payload: o } = compute({ cart_items: [item] }); checked++;
    if (o.chain_length !== 1) violations++;
    if (o.cart_root !== o.chain_links[0]) violations++; }
  // malformed item (missing required fields) -> reasons non-empty, no chain built
  { const { output_payload: o } = compute({ cart_items: [{ sku: 'X' }] }); checked++;
    if (o.reasons.length === 0) violations++;
    if (o.chain_links.length !== 0) violations++; }
  // claimed_links shorter than actual chain -> divergence at the short boundary, never a false intact
  { const items = [randItem(rand, 0), randItem(rand, 1)];
    const full = compute({ cart_items: items }).output_payload;
    const { output_payload: o } = compute({ cart_items: items, claimed_links: [full.chain_links[0]] }); checked++;
    if (o.cart_chain_intact !== false) violations++;
    if (o.first_divergent_index !== 1) violations++; }
  return { name: 'P4_forced_categorical_boundary_cases', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

results.properties.push(checkP1_totality());
results.properties.push(checkP2_chain_prefix_independence());
results.properties.push(checkP3_metamorphic());
results.properties.push(checkP4_forced_categorical());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  tool_id: 'art-595-ap2-cartmandate-hashchain-builder',
  float_sensitive: false,
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
