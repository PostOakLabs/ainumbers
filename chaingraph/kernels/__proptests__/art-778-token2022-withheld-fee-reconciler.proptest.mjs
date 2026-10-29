// art-778-token2022-withheld-fee-reconciler property-test floor (SOLANA-WITHHELD-FEE-RECON-1).
// kernel_digest_at_authoring: sha256:7a3439e0dec0a2b4f853b0e62b3ae84f881f7f7ef933bc83a442052570449d63
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md section 3. Shape:
//   - Fixture-oracle gate (GATES the exit code): every fixture vector's spec_pins — hand-derived
//     from the pinned primary text (solana-program/token-2022 at commit
//     b5b7511e5d4f19a6a118b858d83a7fe3b0017b1e: transfer_fee mod.rs L135-L181, instruction.rs
//     L118-L135, processor.rs L169-L227) — is resolved against the kernel's compute() result.
//   - P1 sum equivalence: for randomized account lists, the kernel's recomputed_account_sum and
//     sum_over_all_declared_entries equal an INDEPENDENT reference written here from the pinned
//     clause text (a plain BigInt loop, deliberately structured differently from the kernel's
//     two-pass filter), and the wrong-mint/duplicate partitions match.
//   - P2 reconciliation sign: declared_minus_recomputed and the MATCH/ABOVE/BELOW label are
//     exact functions of declared_total versus the reference sum, on a boundary sweep around it.
//   - P3 harvest-projection overflow property: post_harvest_would_overflow_u64 is exactly
//     (mint_withheld + sum) > u64::MAX in unbounded BigInt (the source's checked_add semantics
//     restated), including the exact-u64::MAX boundary; sums past u64 are REPORTED exactly,
//     never wrapped or refused.
//   - P4 refusal matrix: every named refusal fires with its exact error string, its
//     INPUT_REFUSED flag, a domain_errors entry and a detail naming the offending field; every
//     refusal leaves every reconciliation output null.
//   - P5 flag-order and placement pins: exact compliance_flags arrays including the multi-flag
//     order, and the destination/authority boolean grid (match/mismatch, null config authority).
//   - P6 determinism: identical pp in, byte-identical result out, twice.
// float:no — every amount is a decimal string parsed to BigInt in kernel and reference alike;
// JS Number never touches an amount. ZERO external dependencies — pure Node built-ins.
// READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-778-token2022-withheld-fee-reconciler.proptest.mjs

import { compute } from '../art-778-token2022-withheld-fee-reconciler.kernel.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const U64_MAX = (1n << 64n) - 1n;

// Deterministic PRNG (xorshift64) so the run is reproducible — no Math.random.
let seed = 0x7c1d6f5b3a2e8101n;
function rnd() {
  seed ^= seed << 13n; seed &= U64_MAX;
  seed ^= seed >> 7n;
  seed ^= seed << 17n; seed &= U64_MAX;
  return seed;
}
function rndAmount() { return rnd() % (1n << 53n); } // safe-sized draws; boundary cases pinned separately
function rndAddr(i) { return 'Addr' + i + 'x' + (rnd() % 1000000n).toString(10); }

// ---------------------------------------------------------------- fixture oracle
// Resolves a spec_pins key path against the compute() result tree
// ({ output_payload, compliance_flags }): "a.b", "a[0].b", "a[0]" and bare "compliance_flags".
function getPath(root, key) {
  const parts = key.replace(/\]/g, '').split(/[.[]/).filter(Boolean);
  let cur = root;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[p];
  }
  return cur;
}

function fixtureOracle() {
  const fxPath = path.resolve(__dirname, '..', 'fixtures', 'art-778-token2022-withheld-fee-reconciler.fixtures.json');
  const doc = JSON.parse(readFileSync(fxPath, 'utf8'));
  const violations = [];
  let checked = 0;
  for (const v of doc.vectors) {
    const r = compute(v.policy_parameters);
    // Merge: spec_pins name output_payload fields bare ("reconciliation") but also the sibling
    // compliance_flags array, so resolve against the union (output_payload wins on collision).
    const root = { ...r, ...r.output_payload };
    for (const [key, expected] of Object.entries(v.spec_pins || {})) {
      const got = getPath(root, key);
      const ok = JSON.stringify(got) === JSON.stringify(expected);
      if (!ok) violations.push(`${v.name}: ${key} expected ${JSON.stringify(expected)} got ${JSON.stringify(got)}`);
      checked++;
    }
  }
  return { name: 'fixture_oracle', vectors: doc.vectors.length, pins: checked, violations: violations.slice(0, 8), detail: violations };
}

// ---------------------------------------------------------------- P1: sum equivalence + partitions
function checkP1() {
  const violations = [];
  for (let t = 0; t < 200; t++) {
    const n = Number(rnd() % 8n) + 1; // 1..8 accounts
    const accounts = [];
    for (let i = 0; i < n; i++) {
      const sameMint = (rnd() % 4n) !== 0n; // 3/4 same mint
      accounts.push({
        address: rndAddr(i),
        mint: sameMint ? 'MINT1' : 'MINTOTHER' + (rnd() % 3n).toString(10),
        withheld_amount: rndAmount().toString(10),
      });
    }
    const declaredRef = accounts.filter((a) => a.mint === 'MINT1').reduce((s, a) => s + BigInt(a.withheld_amount), 0n);
    const allRef = accounts.reduce((s, a) => s + BigInt(a.withheld_amount), 0n);
    const wrongRef = accounts.filter((a) => a.mint !== 'MINT1').map((a) => a.address);
    const dupRef = [...new Set(accounts.filter((a, i) => accounts.findIndex((b) => b.address === a.address) !== i).map((a) => a.address))];
    const r = compute({
      mint: 'MINT1',
      transfer_fee_config: { withdraw_withheld_authority: null, withheld_amount: '0' },
      accounts, declared_total: declaredRef.toString(10),
    });
    if (r.output_payload.recomputed_account_sum !== declaredRef.toString(10)) violations.push(`P1 sum t=${t}: got ${r.output_payload.recomputed_account_sum} want ${declaredRef}`);
    if (r.output_payload.sum_over_all_declared_entries !== allRef.toString(10)) violations.push(`P1 allsum t=${t}`);
    if (r.output_payload.wrong_mint_accounts.map((w) => w.address).join(',') !== wrongRef.join(',')) violations.push(`P1 wrongmint t=${t}`);
    if (r.output_payload.duplicate_addresses.map((d) => d.address).join(',') !== dupRef.join(',')) violations.push(`P1 dup t=${t}`);
  }
  return { name: 'P1_sum_equivalence', cases: 200, violations: violations.length, detail: violations.slice(0, 5) };
}

// ---------------------------------------------------------------- P2: reconciliation labels and signs
function checkP2() {
  const violations = [];
  const accounts = [
    { address: 'A1', mint: 'MINT1', withheld_amount: '400' },
    { address: 'A2', mint: 'MINT1', withheld_amount: '50' },
  ];
  const SUM = 450n;
  // declared_total is a u64 decimal string, so the sweep's floor is declared_total 0 (d=-450);
  // below that the kernel refuses (P4's domain), which is out of this property's scope.
  for (const delta of [-450n, -1n, 0n, 1n, 449n, 450n]) {
    const declared = SUM + delta;
    const r = compute({
      mint: 'MINT1',
      transfer_fee_config: { withdraw_withheld_authority: null, withheld_amount: '0' },
      accounts, declared_total: declared.toString(10),
    });
    const wantLabel = delta === 0n ? 'MATCH' : delta > 0n ? 'DECLARED_ABOVE_RECOMPUTED' : 'DECLARED_BELOW_RECOMPUTED';
    const wantDiff = delta === 0n ? '0' : (delta > 0n ? '+' + delta.toString(10) : delta.toString(10));
    if (r.output_payload.reconciliation !== wantLabel) violations.push(`P2 label d=${delta}: got ${r.output_payload.reconciliation} want ${wantLabel}`);
    if (r.output_payload.declared_minus_recomputed !== wantDiff) violations.push(`P2 diff d=${delta}: got ${r.output_payload.declared_minus_recomputed} want ${wantDiff}`);
    const wantDivergeFlag = delta !== 0n;
    if (r.compliance_flags.includes('DECLARED_TOTAL_DIVERGES') !== wantDivergeFlag) violations.push(`P2 flag d=${delta}`);
  }
  return { name: 'P2_reconciliation_signs', cases: 7, violations: violations.length, detail: violations.slice(0, 5) };
}

// ---------------------------------------------------------------- P3: harvest projection overflow property
function checkP3() {
  const violations = [];
  const cases = [
    { a: [U64_MAX.toString(10), '0'], mintW: '0' },
    { a: [U64_MAX.toString(10), '1'], mintW: '0' },
    { a: [(U64_MAX - 1n).toString(10), '1'], mintW: '0' },
    { a: [(U64_MAX - 1n).toString(10), '1'], mintW: '1' },
    { a: ['1', '2'], mintW: '3' },
  ];
  for (let t = 0; t < 150; t++) {
    const big = rnd() % (U64_MAX / 2n) + (U64_MAX / 2n); // upper half: overflows reachable
    const mintW = rnd() % (U64_MAX / 4n);
    cases.push({ a: [big.toString(10), (rnd() % (U64_MAX / 4n)).toString(10)], mintW: mintW.toString(10) });
  }
  for (const c of cases) {
    const sumRef = c.a.reduce((s, x) => s + BigInt(x), 0n);
    const postRef = BigInt(c.mintW) + sumRef;
    const r = compute({
      mint: 'MINT1',
      transfer_fee_config: { withdraw_withheld_authority: null, withheld_amount: c.mintW },
      accounts: c.a.map((w, i) => ({ address: 'A' + i, mint: 'MINT1', withheld_amount: w })),
      declared_total: '0',
    });
    if (r.output_payload.recomputed_account_sum !== sumRef.toString(10)) violations.push(`P3 sum-exactness: got ${r.output_payload.recomputed_account_sum} want ${sumRef}`);
    if (r.output_payload.sum_exceeds_u64 !== sumRef > U64_MAX) violations.push('P3 sum_exceeds_u64');
    if (r.output_payload.post_harvest_mint_withheld !== postRef.toString(10)) violations.push('P3 post sum exactness');
    if (r.output_payload.post_harvest_would_overflow_u64 !== postRef > U64_MAX) violations.push(`P3 overflow flag: mintW=${c.mintW} sum=${sumRef}`);
  }
  return { name: 'P3_overflow_checked_not_wrapped', cases: cases.length, violations: violations.length, detail: violations.slice(0, 5) };
}

// ---------------------------------------------------------------- P4: refusal matrix
const REFUSAL_CASES = [
  { name: 'mint_empty', pp: { mint: '', transfer_fee_config: { withdraw_withheld_authority: null, withheld_amount: '0' }, accounts: [], declared_total: '0' }, code: 'MINT_INVALID', field: 'mint' },
  { name: 'config_not_object', pp: { mint: 'M', transfer_fee_config: null, accounts: [], declared_total: '0' }, code: 'TRANSFER_FEE_CONFIG_MALFORMED', field: 'transfer_fee_config' },
  { name: 'config_withheld_not_decimal', pp: { mint: 'M', transfer_fee_config: { withdraw_withheld_authority: null, withheld_amount: 'ten' }, accounts: [], declared_total: '0' }, code: 'TRANSFER_FEE_CONFIG_MALFORMED', field: 'withheld_amount' },
  { name: 'config_withheld_negative', pp: { mint: 'M', transfer_fee_config: { withdraw_withheld_authority: null, withheld_amount: '-1' }, accounts: [], declared_total: '0' }, code: 'TRANSFER_FEE_CONFIG_MALFORMED', field: 'withheld_amount' },
  { name: 'config_authority_number', pp: { mint: 'M', transfer_fee_config: { withdraw_withheld_authority: 7, withheld_amount: '0' }, accounts: [], declared_total: '0' }, code: 'TRANSFER_FEE_CONFIG_MALFORMED', field: 'withdraw_withheld_authority' },
  { name: 'accounts_not_array', pp: { mint: 'M', transfer_fee_config: { withdraw_withheld_authority: null, withheld_amount: '0' }, accounts: {}, declared_total: '0' }, code: 'ACCOUNTS_MALFORMED', field: 'accounts' },
  { name: 'account_missing_address', pp: { mint: 'M', transfer_fee_config: { withdraw_withheld_authority: null, withheld_amount: '0' }, accounts: [{ mint: 'M', withheld_amount: '1' }], declared_total: '1' }, code: 'ACCOUNTS_MALFORMED', field: 'address' },
  { name: 'account_withheld_float', pp: { mint: 'M', transfer_fee_config: { withdraw_withheld_authority: null, withheld_amount: '0' }, accounts: [{ address: 'A', mint: 'M', withheld_amount: '1.5' }], declared_total: '1' }, code: 'ACCOUNTS_MALFORMED', field: 'withheld_amount' },
  { name: 'account_withheld_number_type', pp: { mint: 'M', transfer_fee_config: { withdraw_withheld_authority: null, withheld_amount: '0' }, accounts: [{ address: 'A', mint: 'M', withheld_amount: 100 }], declared_total: '1' }, code: 'ACCOUNTS_MALFORMED', field: 'withheld_amount' },
  { name: 'declared_total_invalid', pp: { mint: 'M', transfer_fee_config: { withdraw_withheld_authority: null, withheld_amount: '0' }, accounts: [], declared_total: '1e9' }, code: 'DECLARED_TOTAL_INVALID', field: 'declared_total' },
  { name: 'destination_partial', pp: { mint: 'M', transfer_fee_config: { withdraw_withheld_authority: null, withheld_amount: '0' }, accounts: [], declared_total: '0', destination: { address: 'D', mint: 'M' } }, code: 'DESTINATION_MALFORMED', field: 'withdraw_authority' },
];
function checkP4_refusalMatrix() {
  const violations = [];
  for (const c of REFUSAL_CASES) {
    const r = compute(c.pp);
    const o = r.output_payload;
    if (o.error !== c.code.toLowerCase()) violations.push(`${c.name}: error got ${o.error} want ${c.code.toLowerCase()}`);
    if (!Array.isArray(o.domain_errors) || o.domain_errors[0]?.code !== c.code) violations.push(`${c.name}: domain_errors code`);
    if (typeof o.detail !== 'string' || !o.detail.includes(c.field)) violations.push(`${c.name}: detail must name ${c.field}, got ${JSON.stringify(o.detail)}`);
    if (JSON.stringify(r.compliance_flags) !== '["INPUT_REFUSED"]') violations.push(`${c.name}: flags ${JSON.stringify(r.compliance_flags)}`);
    for (const k of ['recomputed_account_sum', 'declared_total', 'reconciliation', 'declared_minus_recomputed', 'post_harvest_mint_withheld', 'fee_receiver_placement']) {
      if (o[k] !== null && o[k] !== undefined) violations.push(`${c.name}: refusal left ${k} non-null`);
    }
  }
  return { name: 'P4_refusal_matrix', cases: REFUSAL_CASES.length, violations: violations.length, detail: violations.slice(0, 6) };
}

// ---------------------------------------------------------------- P5: flag-order + placement grid
function checkP5() {
  const violations = [];
  const cfgAuth = 'AUTHX';
  const mk = (accounts, declared, dest) => compute({
    mint: 'MINT1',
    transfer_fee_config: { withdraw_withheld_authority: cfgAuth, withheld_amount: '0' },
    accounts, declared_total: declared, destination: dest,
  });
  // multi-flag order: wrong-mint, duplicate, divergence, dest-mint, authority
  const r5 = mk([
    { address: 'A1', mint: 'MINT1', withheld_amount: '100' },
    { address: 'A1', mint: 'MINT1', withheld_amount: '100' },
    { address: 'A9', mint: 'MINT2', withheld_amount: '500' },
  ], '210', { address: 'D', mint: 'MINT2', withdraw_authority: 'OTHER' });
  const want5 = ['ACCOUNT_MINT_MISMATCH', 'DUPLICATE_ACCOUNT_ADDRESS', 'DECLARED_TOTAL_DIVERGES', 'DESTINATION_MINT_MISMATCH', 'DECLARED_WITHDRAW_AUTHORITY_MISMATCH'];
  if (JSON.stringify(r5.compliance_flags) !== JSON.stringify(want5)) violations.push(`P5 order: got ${JSON.stringify(r5.compliance_flags)}`);
  // placement grid: 2x2 booleans + null-config-authority case
  for (const mintOk of [true, false]) {
    for (const authOk of [true, false]) {
      const r = mk([{ address: 'A1', mint: 'MINT1', withheld_amount: '5' }], '5', { address: 'D', mint: mintOk ? 'MINT1' : 'MINT2', withdraw_authority: authOk ? cfgAuth : 'OTHER' });
      const fp = r.output_payload.fee_receiver_placement;
      if (fp.destination_mint_matches_declared_mint !== mintOk) violations.push(`P5 mint ${mintOk}`);
      if (fp.declared_withdraw_authority_matches_config !== authOk) violations.push(`P5 auth ${authOk}`);
      if (fp.declared_destination_mint !== (mintOk ? 'MINT1' : 'MINT2')) violations.push('P5 echo mint');
      if (fp.config_withdraw_withheld_authority !== cfgAuth) violations.push('P5 echo config authority');
      const wantFlags = [];
      if (!mintOk) wantFlags.push('DESTINATION_MINT_MISMATCH');
      if (!authOk) wantFlags.push('DECLARED_WITHDRAW_AUTHORITY_MISMATCH');
      const gotTail = r.compliance_flags.filter((f) => f.startsWith('DESTINATION_') || f.startsWith('DECLARED_WITHDRAW_'));
      if (JSON.stringify(gotTail) !== JSON.stringify(wantFlags)) violations.push(`P5 flags grid m=${mintOk} a=${authOk}: ${JSON.stringify(gotTail)}`);
    }
  }
  // null config authority vs declared: mismatch; no destination: placement null, no placement flags
  const rn = compute({ mint: 'M', transfer_fee_config: { withdraw_withheld_authority: null, withheld_amount: '0' }, accounts: [{ address: 'A', mint: 'M', withheld_amount: '1' }], declared_total: '1', destination: { address: 'D', mint: 'M', withdraw_authority: 'AUTHX' } });
  if (rn.output_payload.fee_receiver_placement.declared_withdraw_authority_matches_config !== false) violations.push('P5 null-authority must not match a declared authority');
  const rnod = compute({ mint: 'M', transfer_fee_config: { withdraw_withheld_authority: null, withheld_amount: '0' }, accounts: [{ address: 'A', mint: 'M', withheld_amount: '1' }], declared_total: '1' });
  if (rnod.output_payload.fee_receiver_placement !== null) violations.push('P5 no-destination must yield null placement');
  if (rnod.compliance_flags.length !== 0) violations.push('P5 no-destination clean case must carry no flags');
  return { name: 'P5_flag_order_and_placement_grid', cases: 8, violations: violations.length, detail: violations.slice(0, 6) };
}

// ---------------------------------------------------------------- P6: determinism
function checkP6() {
  const pp = {
    mint: 'MINT1',
    transfer_fee_config: { withdraw_withheld_authority: 'AUTHX', withheld_amount: '42' },
    accounts: [
      { address: 'A1', mint: 'MINT1', withheld_amount: '100' },
      { address: 'A2', mint: 'MINT2', withheld_amount: '7' },
      { address: 'A1', mint: 'MINT1', withheld_amount: '100' },
    ],
    declared_total: '207',
    destination: { address: 'D', mint: 'MINT1', withdraw_authority: 'AUTHX' },
  };
  const a = JSON.stringify(compute(pp));
  const b = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))));
  const violations = a === b ? [] : ['P6 determinism: two runs differ'];
  return { name: 'P6_determinism', cases: 1, violations: violations.length, detail: violations };
}

// ---------------------------------------------------------------- run
const oracle = fixtureOracle();
const oracleOk = oracle.violations.length === 0;
results.fixture_oracle = { name: oracle.name, vectors: oracle.vectors, pins: oracle.pins, violations: oracle.violations.length };
results.properties.push(checkP1());
results.properties.push(checkP2());
results.properties.push(checkP3());
results.properties.push(checkP4_refusalMatrix());
results.properties.push(checkP5());
results.properties.push(checkP6());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);
console.log(JSON.stringify({
  tool: 'art-778-token2022-withheld-fee-reconciler',
  fixture_oracle: results.fixture_oracle,
  properties: results.properties,
  verdict: (oracleOk && !anyPropertyViolation) ? 'GREEN' : 'RED',
}, null, 1));

process.exit(oracleOk && !anyPropertyViolation ? 0 : 1);
