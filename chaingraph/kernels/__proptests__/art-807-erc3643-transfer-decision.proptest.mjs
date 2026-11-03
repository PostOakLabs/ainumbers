// art-807-erc3643-transfer-decision — class-K property-test FLOOR (KERNEL-SCAFFOLD-1 scaffold, authored).
// kernel_digest_at_authoring: sha256:dbdb41257756cb1678a535c5e45c97a0202d808686c0bcaf16af5469cdb6edc6
// spec: permissioned-token transfer decision recomputed from declared registry, claim, module and token state
// human_sign_off: PENDING
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md). NOT a proof.
// float_sensitive: NO (BigInt over decimal strings throughout).
// Checks: fixture-oracle gate; decision equals the ordered conjunction of the reported gates
// and denied_by names exactly the first failing gate; a mint is never denied by the pause,
// freeze or balance gates; adding a failing module never turns DENIED into ALLOWED and turns
// ALLOWED into DENIED; max_balance differential against the plain integer rule; zero amount
// and zero receiver always refuse; errors mirrors compliance_flags; no NaN/Infinity anywhere;
// determinism.
// Zero external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-807-erc3643-transfer-decision.proptest.mjs

import { compute } from '../art-807-erc3643-transfer-decision.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = 'art-807-erc3643-transfer-decision';
const rand = mulberry32(0x807E3);

const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const I1 = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const Z = '0x0000000000000000000000000000000000000000';
const int = (n) => Math.floor(rand() * n);
const pick = (xs) => xs[int(xs.length)];

function randomPP() {
  const mint = rand() < 0.2;
  const topics = rand() < 0.3 ? [] : [1];
  const recvPresent = rand() < 0.85;
  const claimValid = rand() < 0.8;
  const balA = int(1000), balB = int(1000);
  const modules = [];
  if (rand() < 0.6) modules.push({ id: 'mb', type: 'max_balance', params: { max_balance: String(int(2000)) } });
  if (rand() < 0.3) modules.push({ id: 'cr', type: 'country_restriction', params: { blocked_countries: [pick([840, 826, 250])] } });
  if (rand() < 0.3) modules.push({ id: 'pt', type: 'pass_through', params: { passes: rand() < 0.7 } });
  if (rand() < 0.3) modules.push({ id: 'sl', type: 'supply_limit', params: { supply_limit: String(int(5000)) } });
  return {
    transfer: { from: mint ? Z : A, to: B, amount: String(1 + int(800)) },
    identity_registry: [
      { address: A, identity_present: true, country: 840, claims: [{ topic: 1, issuer: I1, claim_valid: true }] },
      { address: B, identity_present: recvPresent, country: pick([840, 826, 250]), claims: [{ topic: 1, issuer: I1, claim_valid: claimValid }] },
    ],
    required_claim_topics: topics,
    trusted_issuers: rand() < 0.9 ? { '1': [I1] } : {},
    compliance_modules: modules,
    token_state: {
      paused: rand() < 0.15,
      frozen: rand() < 0.15 ? { [pick([A, B])]: true } : {},
      frozen_tokens: rand() < 0.2 ? { [A]: String(int(600)) } : {},
      balances: { [A]: String(balA), [B]: String(balB) },
      total_supply: String(balA + balB),
    },
    fund_covenant: rand() < 0.4 ? { jurisdiction_allowlist: [pick([840, 826])] } : undefined,
  };
}

// The decision is the ordered conjunction of the reported gates; denied_by is the first
// failing gate (with the module id for a module failure) and null exactly when ALLOWED.
function checkDecisionIsOrderedConjunction() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 600; i++) {
    const p = compute(randomPP()).output_payload;
    const first = p.gates.find((g) => !g.passes);
    const want = first ? 'DENIED' : 'ALLOWED';
    if (p.decision !== want) violations++;
    if (!first && p.denied_by !== null) violations++;
    if (first) {
      const wantBy = first.gate === 'COMPLIANCE_MODULE' ? 'COMPLIANCE_MODULE:' + p.failing_module : first.gate;
      if (p.denied_by !== wantBy) violations++;
      if (first.gate === 'COMPLIANCE_MODULE') {
        const firstMod = p.compliance_report.find((r) => r.passes !== true);
        if (!firstMod || firstMod.id !== p.failing_module) violations++;
      }
    }
    checked++;
  }
  return { name: 'decision_is_ordered_conjunction_and_denied_by_is_first', checked, violations };
}

// A mint never reports or fails the pause, freeze or balance gates.
function checkMintSkipsSenderGates() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 300; i++) {
    const pp = randomPP();
    pp.transfer.from = Z;
    pp.token_state.paused = true;
    const p = compute(pp).output_payload;
    if (p.operation !== 'mint') violations++;
    if (p.gates.some((g) => ['TOKEN_PAUSED', 'FROZEN', 'INSUFFICIENT_UNFROZEN_BALANCE'].includes(g.gate))) violations++;
    checked++;
  }
  return { name: 'mint_skips_pause_freeze_balance_gates', checked, violations };
}

// Adding a failing caller-declared module: ALLOWED becomes DENIED, DENIED stays DENIED.
function checkFailingModuleIsMonotone() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 400; i++) {
    const pp = randomPP();
    const before = compute(pp).output_payload.decision;
    pp.compliance_modules = [...pp.compliance_modules, { id: 'added_fail', type: 'pass_through', params: { passes: false } }];
    const after = compute(pp).output_payload.decision;
    if (after !== 'DENIED') violations++;
    if (before === 'DENIED' && after !== 'DENIED') violations++;
    checked++;
  }
  return { name: 'adding_failing_module_never_allows', checked, violations };
}

// max_balance against the plain integer rule: passes iff amount <= max and held + amount <= max.
function checkMaxBalanceDifferential() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 500; i++) {
    const held = int(5000), amount = 1 + int(5000), max = int(8000);
    const pp = {
      transfer: { from: A, to: B, amount: String(amount) },
      identity_registry: [{ address: B, identity_present: true }],
      compliance_modules: [{ id: 'mb', type: 'max_balance', params: { max_balance: String(max), identity_balance: String(held) } }],
      token_state: { balances: { [A]: String(amount) } },
    };
    const r = compute(pp).output_payload.compliance_report[0];
    const want = amount <= max && held + amount <= max;
    if (r.passes !== want) violations++;
    checked++;
  }
  return { name: 'max_balance_matches_integer_rule', checked, violations };
}

// Zero amount and zero receiver always refuse, with no decision.
function checkRefusals() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 200; i++) {
    const pp = randomPP();
    if (i % 2 === 0) pp.transfer.amount = '0'; else pp.transfer.to = Z;
    const { output_payload, compliance_flags } = compute(pp);
    if (output_payload.decision !== null) violations++;
    if (compliance_flags.length !== 1 || compliance_flags[0] !== 'INPUT_REFUSED') violations++;
    checked++;
  }
  return { name: 'zero_amount_or_zero_receiver_refuses', checked, violations };
}

// errors mirrors compliance_flags, and hostile inputs never emit NaN or Infinity.
function checkFlagMirrorAndShape() {
  let checked = 0, violations = 0;
  /** @type {any[]} */
  const nasties = [undefined, null, NaN, Infinity, -1, 1.5, '', 'abc', [], {}, '1e3'];
  for (let i = 0; i < 400; i++) {
    const pp = randomPP();
    if (i % 3 === 0) pp.transfer.amount = nasties[i % nasties.length];
    if (i % 5 === 0) pp.required_claim_topics = nasties[i % nasties.length];
    const { output_payload, compliance_flags } = compute(pp);
    if (JSON.stringify(output_payload.errors) !== JSON.stringify(compliance_flags)) violations++;
    if (findShapeViolations(output_payload).length) violations++;
    checked++;
  }
  for (const junk of [undefined, null, 7, 'x', [], {}]) {
    const { output_payload, compliance_flags } = compute(junk);
    if (!compliance_flags.includes('INPUT_REFUSED')) violations++;
    if (findShapeViolations(output_payload).length) violations++;
    checked++;
  }
  return { name: 'flag_mirror_and_no_nan_or_infinity', checked, violations };
}

function checkDeterminism() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = randomPP();
    if (JSON.stringify(compute(pp)) !== JSON.stringify(compute(pp))) violations++;
    checked++;
  }
  return { name: 'determinism', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDecisionIsOrderedConjunction(),
  checkMintSkipsSenderGates(),
  checkFailingModuleIsMonotone(),
  checkMaxBalanceDifferential(),
  checkRefusals(),
  checkFlagMirrorAndShape(),
  checkDeterminism(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — permissioned-token transfer decision.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
