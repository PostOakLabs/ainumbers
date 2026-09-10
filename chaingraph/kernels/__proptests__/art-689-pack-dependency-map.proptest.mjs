// art-689-pack-dependency-map — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:85bcff208b87268413f83990a57e48329b66f8e71716731c46263e13e98121fc
// spec: PACK-DEPENDENCY-MAP-BUILD-SPEC.md (workspace root)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-689-pack-dependency-map.proptest.mjs

import { compute } from '../art-689-pack-dependency-map.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-689-pack-dependency-map';

// Deterministic pseudo-random draws (LCG) — never Math.random(), the kernel and the
// property test must be reproducible byte-for-byte.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// Class-A: the impacted set is EXACTLY the declared packs whose usage list contains the
// changed component, in declared order; impact_count equals its length; the trace
// restates the same count.
function checkMembershipIdentity() {
  const rand = lcg(686);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < 300; i++) {
    const n = 1 + Math.floor(rand() * 6);
    const packs = [];
    for (let p = 0; p < n; p++) {
      const uses = new Set();
      const m = Math.floor(rand() * 4);
      for (let c = 0; c < m; c++) uses.add(`kern-${Math.floor(rand() * 8)}`);
      packs.push({ pack: `pack-${p}`, uses: [...uses] });
    }
    const changed = `kern-${Math.floor(rand() * 8)}`;
    const { output_payload } = compute({ packs, changed_component: changed });
    const expected = packs.filter((e) => e.uses.includes(changed)).map((e) => e.pack);
    checked++;
    if (JSON.stringify(output_payload.impacted) !== JSON.stringify(expected)) violations++;
    if (output_payload.impact_count !== expected.length) violations++;
    if (expected.length > 0 && !output_payload.trace.includes(changed)) violations++;
  }
  return { name: 'membership-identity-declared-usage-lists', checked, violations };
}

// Class-B: verdict enum is exactly the two declared paths — IMPACT_MAPPED iff at least
// one declared usage list contains the changed component, else NO_IMPACT.
function checkVerdictTracksImpact() {
  const cases = [
    {
      pp: { packs: [{ pack: 'exam-readiness', uses: ['kern-roll', 'kern-date'] }, { pack: 'close-center', uses: ['kern-date'] }], changed_component: 'kern-date' },
      want: 'IMPACT_MAPPED',
    },
    {
      pp: { packs: [{ pack: 'exam-readiness', uses: ['kern-roll', 'kern-date'] }, { pack: 'close-center', uses: ['kern-date'] }], changed_component: 'kern-weather' },
      want: 'NO_IMPACT',
    },
    { pp: { packs: [{ pack: 'p1', uses: [] }], changed_component: 'kern-x' }, want: 'NO_IMPACT' },
  ];
  let checked = 0;
  let violations = 0;
  for (const c of cases) {
    const { output_payload } = compute(c.pp);
    checked++;
    if (output_payload.overall !== c.want) violations++;
  }
  const rand = lcg(1686);
  for (let i = 0; i < 200; i++) {
    const n = 1 + Math.floor(rand() * 5);
    const packs = [];
    for (let p = 0; p < n; p++) {
      const uses = new Set();
      const m = Math.floor(rand() * 3);
      for (let c = 0; c < m; c++) uses.add(`c-${Math.floor(rand() * 5)}`);
      packs.push({ pack: `pack-${p}`, uses: [...uses] });
    }
    const changed = `c-${Math.floor(rand() * 5)}`;
    const { output_payload } = compute({ packs, changed_component: changed });
    const want = output_payload.impact_count > 0 ? 'IMPACT_MAPPED' : 'NO_IMPACT';
    checked++;
    if (output_payload.overall !== want) violations++;
  }
  return { name: 'verdict-enum-tracks-impact-count', checked, violations };
}

// Class-K invalid-domain rejection: each malformed declared input throws (never silently
// computes), and the output shape stays within the declared four-member schema.
function checkInvalidDomainRejection() {
  const good = { pack: 'p1', uses: ['kern-x'] };
  const bad = [
    null,
    {},
    { packs: [], changed_component: 'kern-x' },
    { packs: 'p1', changed_component: 'kern-x' },
    { packs: [null], changed_component: 'kern-x' },
    { packs: [{ uses: ['kern-x'] }], changed_component: 'kern-x' },
    { packs: [{ pack: '', uses: ['kern-x'] }], changed_component: 'kern-x' },
    { packs: [{ pack: 'p1' }], changed_component: 'kern-x' },
    { packs: [{ pack: 'p1', uses: 'kern-x' }], changed_component: 'kern-x' },
    { packs: [{ pack: 'p1', uses: [42] }], changed_component: 'kern-x' },
    { packs: [{ pack: 'p1', uses: ['kern-x'] }, { pack: 'p1', uses: [] }], changed_component: 'kern-x' },
    { packs: [{ pack: 'p1', uses: ['kern-x', 'kern-x'] }], changed_component: 'kern-x' },
    { packs: [good], changed_component: '' },
    { packs: [good], changed_component: 7 },
    { packs: [good] },
  ];
  let checked = 0;
  let violations = 0;
  for (const pp of bad) {
    let threw = false;
    try { compute(pp); } catch { threw = true; }
    checked++;
    if (!threw) violations++;
  }
  return { name: 'invalid-domain-rejection-throws', checked, violations };
}

// Output-shape: every output_payload carries exactly the four canonical-parity members
// (the spec's canonical preimage shape); determinism over repeats.
function checkOutputShapeAndDeterminism() {
  const canonical = {
    packs: [{ pack: 'exam-readiness', uses: ['kern-roll', 'kern-date'] }, { pack: 'close-center', uses: ['kern-date'] }],
    changed_component: 'kern-date',
  };
  let checked = 0;
  let violations = 0;
  const a = compute(canonical).output_payload;
  const b = compute(canonical).output_payload;
  checked++;
  if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  checked++;
  if (JSON.stringify(Object.keys(a).sort()) !== JSON.stringify(['impact_count', 'impacted', 'overall', 'trace'])) violations++;
  const empty = compute({ packs: [{ pack: 'p1', uses: [] }], changed_component: 'kern-x' }).output_payload;
  checked++;
  if (JSON.stringify(Object.keys(empty).sort()) !== JSON.stringify(['impact_count', 'impacted', 'overall', 'trace'])) violations++;
  return { name: 'output-shape-and-determinism', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkMembershipIdentity(),
  checkVerdictTracksImpact(),
  checkInvalidDomainRejection(),
  checkOutputShapeAndDeterminism(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — Pack Dependency Map.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
