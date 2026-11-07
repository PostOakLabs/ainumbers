// art-789-stablecoin-admin-role-lint — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:05def883e775390c24e1ac0d394a7f3707777aa11bedddec121be8120c46edea
// spec: board/queued/STABLECOIN-ADMIN-ROLE-LINT-1.md — role-label-only stablecoin admin-role linter
// human_sign_off: PENDING
//
// Properties:
//   P1 verdict-consistency — fail/warn counters always agree with the verdict string
//   P2 key-material refusal — address-like labels always REFUSED (invalid-domain rejection)
//   P3 determinism — same input twice, byte-identical output payload
//   P4 concentration monotonicity — merging a second critical role onto one label never
//      lowers the fail count
//   P5 output shape — non-refused payloads carry all four analysis domains
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-789-stablecoin-admin-role-lint.proptest.mjs

import { compute } from '../art-789-stablecoin-admin-role-lint.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-789-stablecoin-admin-role-lint';

const baseRoles = {
  owner: 'a', proxy_admin: 'b', master_minter: 'c', pauser: 'd', blacklister: 'e', rescuer: 'f',
};
const baseHolders = ['a', 'b', 'c', 'd', 'e', 'f'].map((l) => ({ label: l, kind: 'multisig', threshold: 2, signers_count: 3 }));
const basePolicy = {
  max_single_minter_allowance_minor: 1000,
  max_total_allowance_minor: 5000,
  require_multisig_for: ['pauser'],
  require_distinct: [['owner', 'pauser']],
};
const basePP = () => ({ profile: 'fiattoken', holders: JSON.parse(JSON.stringify(baseHolders)), roles: { ...baseRoles }, minters: [], policy: { ...basePolicy } });

// P1 — verdict consistency
function checkVerdictConsistency() {
  let checked = 0;
  const violations = []; const push = (x) => violations.push(x);
  const cases = [
    basePP(),
    // two roles collapsed onto one label
    (() => { const pp = basePP(); pp.roles.pauser = 'a'; return pp; })(),
    // allowance breach
    (() => { const pp = basePP(); pp.minters = [{ holder_label: 'c', allowance_minor: 99999 }]; return pp; })(),
    // single-signer critical holder
    (() => { const pp = basePP(); pp.holders[3] = { label: 'd', kind: 'eoa' }; return pp; })(),
  ];
  for (const pp of cases) {
    const { output_payload } = compute(pp);
    checked++;
    const expected = output_payload.fail_count > 0 ? 'FAIL'
      : output_payload.warn_count > 0 ? 'PASS_WITH_FINDINGS' : 'PASS';
    if (output_payload.verdict !== expected) push({ case: pp.profile + ':' + output_payload.verdict, expected, got: output_payload.verdict });
  }
  return { name: 'P1_verdict_consistency', checked, violations: violations.length, detail: violations.slice(0, 5) };
}

// P2 — refusal of key-material-looking labels
function checkRefusalBranch() {
  let checked = 0;
  const violations = []; const push = (x) => violations.push(x);
  const badLabels = [
    '0x' + 'a'.repeat(40),
    '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    'f'.repeat(64),
    '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
    'ok-label-but-0xAbCdEf0123456789AbCdEf0123456789AbCdEf01',
  ];
  for (const lbl of badLabels) {
    const pp = basePP();
    pp.roles.owner = lbl;
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    if (output_payload.verdict !== 'REFUSED') push({ label: lbl.slice(0, 12) + '...', expected: 'REFUSED', got: output_payload.verdict });
    if (!compliance_flags.includes('MALFORMED_INPUT_REFUSED')) push({ label: lbl.slice(0, 12) + '...', expected: 'MALFORMED_INPUT_REFUSED flag', got: compliance_flags.join(',') });
  }
  // clean labels must NOT be refused
  const { output_payload } = compute(basePP());
  checked++;
  if (output_payload.verdict === 'REFUSED') push({ label: 'clean-labels', expected: 'not REFUSED', got: 'REFUSED' });
  return { name: 'P2_key_material_refusal', checked, violations: violations.length, detail: violations.slice(0, 5) };
}

// P3 — determinism
function checkDeterminism() {
  let checked = 0;
  const violations = []; const push = (x) => violations.push(x);
  for (const pp of [basePP(), (() => { const p = basePP(); p.profile = 'usdp'; return p; })(), { profile: 'generic', holders: [{ label: 'x', kind: 'multisig', threshold: 2 }], roles: { admin: 'x', pauser: 'x' }, minters: [], policy: { require_distinct: [['admin', 'pauser']] } }]) {
    const r1 = compute(pp).output_payload;
    const r2 = compute(pp).output_payload;
    checked++;
    if (JSON.stringify(r1) !== JSON.stringify(r2)) push({ case: pp.profile, expected: 'identical', got: 'diverged' });
  }
  return { name: 'P3_determinism', checked, violations: violations.length, detail: violations.slice(0, 5) };
}

// P4 — concentration monotonicity: collapsing a role onto an already-critical label never
// lowers the fail count
function checkConcentrationMonotonicity() {
  let checked = 0;
  const violations = []; const push = (x) => violations.push(x);
  const pairs = [['owner', 'master_minter'], ['owner', 'proxy_admin'], ['pauser', 'blacklister']];
  for (const [keep, move] of pairs) {
    const before = compute(basePP()).output_payload.fail_count;
    const pp = basePP();
    pp.roles[move] = pp.roles[keep];
    const after = compute(pp).output_payload.fail_count;
    checked++;
    if (after < before) push({ pair: keep + '+' + move, before, after });
  }
  return { name: 'P4_concentration_monotonicity', checked, violations: violations.length, detail: violations.slice(0, 5) };
}

// P5 — output shape on non-refused paths
function checkOutputShape() {
  let checked = 0;
  const violations = []; const push = (x) => violations.push(x);
  for (const profile of ['fiattoken', 'usdp', 'generic']) {
    const pp = profile === 'generic'
      ? { profile, holders: [{ label: 'x', kind: 'multisig', threshold: 2 }], roles: { admin: 'x' }, minters: [], policy: {} }
      : basePP();
    const { output_payload } = compute(pp);
    checked++;
    for (const k of ['separation', 'concentration', 'issuance', 'capabilities', 'findings']) {
      if (!(k in output_payload)) push({ profile, missing: k });
    }
  }
  return { name: 'P5_output_shape', checked, violations: violations.length, detail: violations.slice(0, 5) };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkVerdictConsistency(),
  checkRefusalBranch(),
  checkDeterminism(),
  checkConcentrationMonotonicity(),
  checkOutputShape(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — 5 properties + fixture oracle.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
