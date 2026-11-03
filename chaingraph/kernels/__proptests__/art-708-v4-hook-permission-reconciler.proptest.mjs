// art-708-v4-hook-permission-reconciler — class-K property test floor, authored by ART708-V4HOOK-PERMBIT-RECONCILER-1.
// spec: RHC hooks build spec WU-1 (research/rhc-hooks/RHC-HOOKS-BUILD-SPEC-2026-10-03.md), Uniswap v4-core
// Hooks.sol at the pinned commit a7cf038cd568801a79a9b4cf92cd5b52c95c8585
// kernel_digest_at_authoring: sha256:e08cd99eaa433bc5d34fddce29b5bc96932043799b00ecc03f90b6e8670d25e9
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-708-v4-hook-permission-reconciler.proptest.mjs

import { compute, FLAGS, FLAG_NAMES } from '../art-708-v4-hook-permission-reconciler.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-708-v4-hook-permission-reconciler';
const TRIALS = 2000;
const rand = mulberry32(0x708CB);

function allFlags(v) {
  return Object.fromEntries(FLAG_NAMES.map((f) => [f, v]));
}

const BIT_FLAG = Object.fromEntries(FLAGS.map(([f, b]) => [b, f]));

// Random 40-hex address, deterministic.
function mkAddress(rng) {
  let hex = '';
  for (let i = 0; i < 40; i++) hex += Math.floor(rng() * 16).toString(16);
  return '0x' + hex;
}

function randomPerms(rng) {
  return Object.fromEntries(FLAG_NAMES.map((f) => [f, rng() < 0.5]));
}

// Independent BigInt reference decoder (does not call the kernel's helpers).
function refBits(addrHex) {
  return BigInt(addrHex.toLowerCase()) & 0x3fffn;
}
function refHas(addrHex, bit) {
  return (refBits(addrHex) & (1n << BigInt(bit))) !== 0n;
}

function rngPick(rng, n) { return rng() * n; }
function flipBit(addrHex, bit) {
  const v = BigInt(addrHex) ^ (1n << BigInt(bit));
  return '0x' + v.toString(16).padStart(40, '0');
}

// ---------- P1 (row-mandated): flipping one address bit changes exactly one flag's actual ----------
function checkP1_singleBitFlipSingleFlag() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const addr = mkAddress(rand);
    const bit = Math.floor(rngPick(rand, 14));
    const flipped = flipBit(addr, bit);
    const a = compute({ hook_address: addr, declared_permissions: allFlags(false) }).output_payload;
    const b = compute({ hook_address: flipped, declared_permissions: allFlags(false) }).output_payload;
    checked++;
    const diffs = FLAG_NAMES.filter((f) => {
      const fa = a.flags.find((x) => x.flag === f).actual;
      const fb = b.flags.find((x) => x.flag === f).actual;
      return fa !== fb;
    });
    if (diffs.length !== 1) violations++;
    if (diffs.length === 1 && diffs[0] !== BIT_FLAG[bit]) violations++;
    // every actual must equal the independent reference decode
    if (!a.flags.every((x) => x.actual === refHas(addr, x.bit))) violations++;
    if (!b.flags.every((x) => x.actual === refHas(flipped, x.bit))) violations++;
  }
  return { name: 'P1_single_bit_flip_changes_exactly_one_flag', checked, violations };
}

// ---------- P2 (row-mandated): mismatch_count = popcount(declared XOR actual) ----------
function checkP2_mismatchCountPopcount() {
  let violations = 0, checked = 0;
  for (let i = 0; i < TRIALS; i++) {
    const addr = mkAddress(rand);
    const perms = randomPerms(rand);
    const r = compute({ hook_address: addr, declared_permissions: perms }).output_payload;
    checked++;
    let pop = 0;
    for (const f of FLAG_NAMES) {
      const bit = FLAGS.find(([n]) => n === f)[1];
      if (perms[f] !== refHas(addr, bit)) pop++;
    }
    if (r.mismatch_count !== pop || r.mismatches.length !== pop) violations++;
    if (r.mismatch_count !== r.flags.filter((x) => x.status !== 'MATCH').length) violations++;
    for (const m of r.mismatches) {
      if (m.status !== (m.declared ? 'DECLARED_NOT_SET' : 'SET_NOT_DECLARED')) { violations++; break; }
    }
  }
  return { name: 'P2_mismatch_count_equals_declared_xor_actual_popcount', checked, violations };
}

// ---------- P3: validity replica agrees with an independent isValidHookAddress reference ----------
function checkP3_validityReference() {
  let violations = 0, checked = 0;
  const DYN = 0x800000n;
  const FEES = [0n, 500n, 8388608n, 8388609n, 12582912n, 16777215n];
  for (let i = 0; i < TRIALS; i++) {
    const addr = BigInt(mkAddress(rand));
    const bits = addr & 0x3fffn;
    const has = (bit) => (bits & (1n << BigInt(bit))) !== 0n;
    const poolFee = FEES[Math.floor(rngPick(rand, FEES.length))];
    const dyn = poolFee === DYN; // isDynamicFee: equality with the flag, not a bit test
    // independent reference (Hooks.sol isValidHookAddress, L109-127 at the pin)
    let ref = true;
    if (!has(7) && has(3)) ref = false;
    if (ref && !has(6) && has(2)) ref = false;
    if (ref && !has(10) && has(1)) ref = false;
    if (ref && !has(8) && has(0)) ref = false;
    if (ref && addr === 0n && dyn) ref = false;
    if (ref && addr !== 0n && bits === 0n && !dyn) ref = false;
    const r = compute({
      hook_address: '0x' + addr.toString(16).padStart(40, '0'),
      declared_permissions: randomPerms(rand),
      pool_fee: Number(poolFee),
    }).output_payload;
    checked++;
    if (r.valid_hook_address !== ref) violations++;
    if (ref && r.failing_rule !== null) violations++;
    if (!ref && (typeof r.failing_rule !== 'string' || r.failing_rule === '')) violations++;
  }
  return { name: 'P3_valid_hook_address_matches_independent_reference', checked, violations };
}

// ---------- P4: refusal contract — missing boolean, malformed address, bad pool_fee ----------
function checkP4_refusalContract() {
  let violations = 0, checked = 0;
  const cases = [];
  const miss = allFlags(false); delete miss.beforeDonate;
  cases.push([{ hook_address: mkAddress(rand), declared_permissions: miss }, 'declared_permissions_incomplete']);
  cases.push([{ declared_permissions: allFlags(false) }, 'hook_address_invalid']);
  cases.push([{ hook_address: '0xzz00', declared_permissions: allFlags(false) }, 'hook_address_invalid']);
  cases.push([{ hook_address: mkAddress(rand), declared_permissions: allFlags(false), pool_fee: 16777216 }, 'pool_fee_invalid']);
  cases.push([{ hook_address: mkAddress(rand), declared_permissions: allFlags(false), pool_fee: 1.5 }, 'pool_fee_invalid']);
  cases.push([{ hook_address: mkAddress(rand), declared_permissions: allFlags(false), declaration_source: 7 }, 'declaration_source_invalid']);
  for (const [pp, code] of cases) {
    const r = compute(pp);
    checked++;
    if (!r.output_payload.error || r.output_payload.error !== code) violations++;
    if (r.compliance_flags[0] !== 'INPUT_REFUSED') violations++;
    if (!r.output_payload.domain_errors || r.output_payload.domain_errors.length !== 1) violations++;
  }
  // the incomplete refusal names the missing key and never defaults it
  const r = compute({ hook_address: mkAddress(rand), declared_permissions: miss });
  checked++;
  if (!/beforeDonate/.test(r.output_payload.detail)) violations++;
  return { name: 'P4_refusal_contract_kill_power', checked, violations };
}

// ---------- P5: hooklist entry shape — address from entry, flags from flags, dynamicFee reconciliation ----------
function checkP5_hooklistShape() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 500; i++) {
    const addr = mkAddress(rand);
    const perms = randomPerms(rand);
    const dynamicFee = rand() < 0.5;
    const withPool = rand() < 0.7;
    const poolFee = withPool ? (rand() < 0.3 ? 0x800000 : Math.floor(rngPick(rand, 16777216))) : undefined;
    const entry = { hook: { address: addr }, flags: { ...perms }, properties: { dynamicFee } };
    const pp = { declared_permissions: entry };
    if (withPool) pp.pool_fee = poolFee;
    const r = compute(pp).output_payload;
    checked++;
    if (r.hook_address !== addr.toLowerCase()) violations++;               // address came from the entry
    const poolDynamic = withPool && poolFee === 0x800000;
    const expect = r.dynamic_fee_declaration;
    if (!expect || expect.declared_dynamic !== dynamicFee) violations++;
    if (withPool) {
      if (expect.pool_fee_dynamic !== poolDynamic || expect.agrees !== (dynamicFee === poolDynamic)) violations++;
    } else if (expect.agrees !== null || expect.pool_fee_dynamic !== null) violations++;
  }
  return { name: 'P5_hooklist_entry_shape_and_dynamic_fee_reconciliation', checked, violations };
}

// ---------- P6: output shape, determinism and evidence-only contract ----------
function checkP6_outputShapeDeterminism() {
  let violations = 0, checked = 0;
  for (let i = 0; i < 300; i++) {
    const pp = { hook_address: mkAddress(rand), declared_permissions: randomPerms(rand) };
    if (rand() < 0.5) pp.pool_fee = Math.floor(rngPick(rand, 16777216));
    const a = compute(pp), b = compute(pp);
    const out = a.output_payload;
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    if (out.error) continue;
    if (!Array.isArray(out.flags) || out.flags.length !== 14 || !Array.isArray(out.mismatches) || !Array.isArray(out.assumptions)) violations++;
    if (out.v4_core_commit !== 'a7cf038cd568801a79a9b4cf92cd5b52c95c8585') violations++;
    if (typeof out.valid_hook_address !== 'boolean') violations++;
    if (!out.assumptions.some((x) => /never reads a chain/.test(x))) violations++;
    for (const f of out.flags) {
      if (!['MATCH', 'DECLARED_NOT_SET', 'SET_NOT_DECLARED'].includes(f.status)) { violations++; break; }
      if (typeof f.declared !== 'boolean' || typeof f.actual !== 'boolean') { violations++; break; }
    }
  }
  return { name: 'P6_output_shape_determinism_evidence_only', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1_singleBitFlipSingleFlag(),
  checkP2_mismatchCountPopcount(),
  checkP3_validityReference(),
  checkP4_refusalContract(),
  checkP5_hooklistShape(),
  checkP6_outputShapeDeterminism(),
];
console.log('[' + KERNEL_ID + '] class-K floor property test — ' + properties.length + ' properties.');
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
