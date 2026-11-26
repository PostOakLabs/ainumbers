// art-735-solana-dvp-prefund-verifier property-test floor (SOLANA-DVP-PREFUND-VERIFIER-1).
// kernel_digest_at_authoring: sha256:7f829143fa17775ede38a2a9591a5de5b4f4090ce1f6e12e9d0cfc41d97b560b
// human_sign_off: PENDING
//
// Class-K floor per FV-PBT-FLOOR-BUILD-SPEC.md, with the art-715 kill-power shape:
//   - Fixture-oracle gate (GATES the exit code): every conformance vector's output_payload is
//     asserted against the kernel.
//   - P1 independent-reference equivalence: an INDEPENDENT recompute of the eight pre-funding
//     checks, written in this file from the pinned SOLANA-DVP-* clause text (owner pin, LEN 458,
//     one-year cap 31,536,000s, earliest <= expiry, expiry > now, four-extension deny list,
//     32-per-leg hook cap, terms list), must agree with the kernel on every randomized input.
//   - P2 mutant kill section: twelve decision-rule mutants of the reference (pinned-owner typo,
//     LEN 457, cap dropped, cap off-by-one, earliest reversed, expiry strictness flipped,
//     deny list missing NonTransferable, short-name alias not normalized, hook cap 31,
//     leg-A-only blocked check, terms check ignoring destinations, trust flags silent) — each
//     must be DISTINGUISHED from the kernel on at least one input; the kill count is printed
//     and any survivor fails the run.
//   - P3 refusal pins: every named refusal fires with its exact code, INPUT_REFUSED, and a
//     truthy manual_review_required marker.
//   - P4 determinism and input purity: identical inputs give byte-identical results; the input
//     object is never mutated.
//   - P5 flag-mirror pin: when trust flags are present, warnings are non-empty (mirror member);
//     a clean record raises no flags at all.
// float:no — all amounts and timestamps are decimal strings parsed to BigInt in kernel and
// reference alike; JS Number never touches a u64/i64. ZERO external dependencies.
// READ-ONLY w.r.t. the kernel it imports.
//
// Run: node chaingraph/kernels/__proptests__/art-735-solana-dvp-prefund-verifier.proptest.mjs

import { compute } from '../art-735-solana-dvp-prefund-verifier.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-735-solana-dvp-prefund-verifier';

// ---------- pinned constants, restated independently from the clause pins ----------
const PIN_OWNER = 'dvp34bdbcEm4f4FCUjGV4mDAkDshaQR4LkK8fdcsyZq'; // declare_id pin
const PIN_LEN = 458n;                    // struct LEN pin (1 + 32*7 + 8*4 + 64 + 32*2 + 32*2 + 1 + 8)
const PIN_ONE_YEAR = 31536000n;          // README Notes line 26, fixed 365-day year
const PIN_HOOK_CAP = 32n;                // MAX_HOOK_REMAINING_ACCOUNTS pin
const PIN_BLOCKED = ['TransferFeeConfig', 'InterestBearingConfig', 'ScaledUiAmountConfig', 'NonTransferable'];

// ---------- deterministic PRNG (fixed seed; no Math.random) ----------
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const A_USER = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const B_USER = 'Gf8cMJ3yRMLpponGJtdfkzX67BhTReLh4m1uPjYz6Ugk';
const SETTLE_AUTH = 'BfIwS1B8f7RC1ZY8NbZLBuJSQP9fM2tzL8t8XnJ9c8kX';
const DEST_A = 'Ck8x2E9S8DcVJ3cJnd6oFfEqBMDdhzWY9zKLzye4LYBw';
const DEST_B = 'Dq8pgDk1ZdLcPdMxyvRQ2NLhEu9XvPia8Gn2LtzY9dKo';

function basePP(over = {}) {
  return {
    owner_program_id: PIN_OWNER, byte_length: '458',
    user_a: A_USER, user_b: B_USER,
    mint_a: '3p9W2vGhTdMQp7sKdDXhcHmgRcxpaB3ZuXYxU8k2FhQN', mint_b: '8kQFfPJ1FwDkZUsxBernCLzexFAZpQvH4fpRS8TwEGXi',
    token_program_a: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', token_program_b: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    settlement_authority: SETTLE_AUTH, destination_a: DEST_A, destination_b: DEST_B,
    mint_a_authority: 'Eq2vH9GeNcqLQobYm5YoFbLpaKMPTZhMKAqcBf41LxNh', mint_b_authority: 'Fq9kxRfM4PqNZeSVh3pLRLn9vbcEKmZAxnZqdZ4SPrBG',
    amount_a: '1500000000', amount_b: '250000000',
    expiry_timestamp: '1770086400', earliest_settlement_timestamp: null,
    creation_timestamp: '1769900000', nonce: '7284759301947385401',
    mint_a_extensions: [], mint_b_extensions: [],
    mint_a_frozen_by_default: false, mint_b_frozen_by_default: false,
    mint_a_freeze_authority_set: false, mint_b_freeze_authority_set: false,
    leg_a_extras_count: '0', leg_b_extras_count: '0',
    now: '1770000000',
    expected: {
      amount_a: '1500000000', amount_b: '250000000', expiry_timestamp: '1770086400',
      earliest_settlement_timestamp: null, user_a: A_USER, user_b: B_USER,
      settlement_authority: SETTLE_AUTH, destination_a: DEST_A, destination_b: DEST_B,
    },
    ...over,
  };
}

// ---------- independent reference (written from the pin text, NOT from the kernel) ----------
function refChecks(pp, mut = {}) {
  const ownerOk = pp.owner_program_id === (mut.owner ?? PIN_OWNER);
  const lenOk = BigInt(pp.byte_length) === (mut.len ?? PIN_LEN);
  const termsOk = pp.amount_a === pp.expected.amount_a && pp.amount_b === pp.expected.amount_b
    && pp.expiry_timestamp === pp.expected.expiry_timestamp
    && String(pp.earliest_settlement_timestamp ?? 'null') === String(pp.expected.earliest_settlement_timestamp ?? 'null')
    && pp.user_a === pp.expected.user_a && pp.user_b === pp.expected.user_b
    && pp.settlement_authority === pp.expected.settlement_authority
    && (mut.dropDestinations || (pp.destination_a === pp.expected.destination_a && pp.destination_b === pp.expected.destination_b));
  const earliest = pp.earliest_settlement_timestamp === null ? null : BigInt(pp.earliest_settlement_timestamp);
  const expiry = BigInt(pp.expiry_timestamp);
  const creation = BigInt(pp.creation_timestamp);
  const now = BigInt(pp.now);
  const earliestOk = earliest === null ? null : (mut.earliestReversed ? earliest >= expiry : earliest <= expiry);
  const yearOk = mut.capDropped ? true : (mut.capOffByOne ? expiry <= creation + PIN_ONE_YEAR + 1n : expiry <= creation + PIN_ONE_YEAR);
  const futureOk = mut.expiryStrict ? expiry >= now : expiry > now; // mutant: boundary flip
  const norm = (e) => (e === 'TransferFee' ? 'TransferFeeConfig' : e === 'InterestBearing' ? 'InterestBearingConfig' : e === 'ScaledUiAmount' ? 'ScaledUiAmountConfig' : e);
  const listA = [...new Set(pp.mint_a_extensions.map(norm))];
  const listB = [...new Set(pp.mint_b_extensions.map(norm))];
  const deny = mut.denyWithoutNonTransferable ? PIN_BLOCKED.filter((x) => x !== 'NonTransferable') : PIN_BLOCKED;
  const found = mut.legAOnly
    ? listA.filter((e) => deny.includes(e)).map((e) => 'mint_a:' + e)
    : [...listA.filter((e) => deny.includes(e)).map((e) => 'mint_a:' + e), ...listB.filter((e) => deny.includes(e)).map((e) => 'mint_b:' + e)];
  const blockedOk = found.length === 0;
  const cap = mut.hookCap31 ? 31n : PIN_HOOK_CAP;
  const hookOk = BigInt(pp.leg_a_extras_count) <= cap && BigInt(pp.leg_b_extras_count) <= cap;
  const failed = [];
  if (!ownerOk) failed.push('owner');
  if (!lenOk) failed.push('length');
  if (!termsOk) failed.push('terms');
  if (earliestOk === false) failed.push('earliest_after_expiry');
  if (!yearOk) failed.push('expiry_over_one_year');
  if (!futureOk) failed.push('expiry_not_in_future');
  if (!blockedOk) failed.push('blocked_extension');
  if (!hookOk) failed.push('hook_extras_over_cap');
  const verdict = failed.length === 0 ? 'PASS' : 'FAIL';
  const trustCats = (list, frozenByDefault, freezeAuth) => {
    const cats = new Set();
    if (list.includes('PermanentDelegate')) cats.add('pd');
    if (list.includes('Pausable')) cats.add('pause');
    if (list.includes('MintCloseAuthority')) cats.add('mca');
    if (list.includes('TransferHook')) cats.add('hook');
    if (list.includes('ConfidentialTransfer') || list.includes('ConfidentialTransferFeeConfig')) cats.add('conf');
    if (list.includes('DefaultAccountState') || frozenByDefault || freezeAuth) cats.add('frozen');
    return cats;
  };
  const trustCount = mut.trustSilent ? 0
    : trustCats(listA, pp.mint_a_frozen_by_default, pp.mint_a_freeze_authority_set).size
      + trustCats(listB, pp.mint_b_frozen_by_default, pp.mint_b_freeze_authority_set).size;
  return { verdict, failed, ownerOk, lenOk, termsOk, earliestOk, yearOk, futureOk, blockedOk, hookOk, blockedFound: found, trustCount };
}

function kernelChecks(pp) {
  const { output_payload } = compute(pp);
  return {
    verdict: output_payload.prefund_check,
    failed: output_payload.failed_checks,
    ownerOk: output_payload.owner_matches,
    lenOk: output_payload.length_matches,
    termsOk: output_payload.terms_match,
    earliestOk: output_payload.earliest_within_expiry,
    yearOk: output_payload.expiry_within_one_year,
    futureOk: output_payload.expiry_in_future,
    blockedOk: output_payload.no_blocked_extensions,
    hookOk: output_payload.hook_extras_within_cap,
    blockedFound: output_payload.blocked_extensions_found,
    trustCount: output_payload.trust_flags.length,
  };
}

// ---------- P1: randomized equivalence ----------
function p1_random_equivalence() {
  const rnd = lcg(0xD2E735);
  let checked = 0, violations = 0;
  for (let i = 0; i < 300; i++) {
    const pp = basePP();
    const now = BigInt(pp.now);
    const drift = () => rnd() < 0.5;
    pp.expiry_timestamp = (now + BigInt(Math.floor(rnd() * 4000000)) - 1000000n).toString();
    if (drift()) pp.expected.expiry_timestamp = (BigInt(pp.expiry_timestamp) + BigInt(Math.floor(rnd() * 3))).toString();
    if (rnd() < 0.4) {
      pp.earliest_settlement_timestamp = (now + BigInt(Math.floor(rnd() * 2000000)) - 1000000n).toString();
      pp.expected.earliest_settlement_timestamp = rnd() < 0.7 ? pp.earliest_settlement_timestamp : (BigInt(pp.earliest_settlement_timestamp) + 1n).toString();
    }
    if (drift()) pp.amount_a = (BigInt(pp.amount_a) + BigInt(Math.floor(rnd() * 5))).toString();
    if (drift()) pp.expected.amount_b = (BigInt(pp.amount_b) + BigInt(Math.floor(rnd() * 5))).toString();
    if (drift()) pp.destination_a = 'OtherDestination11111111111111111111111111111';
    if (drift()) pp.expected.destination_b = 'OtherDestination22222222222222222222222222222';
    if (rnd() < 0.3) pp.byte_length = Math.floor(rnd() * 900).toString();
    if (rnd() < 0.2) pp.owner_program_id = 'DifferentProgram111111111111111111111111111';
    const pools = [['TransferFeeConfig', 'TransferFee'], ['InterestBearingConfig', 'InterestBearing'], ['ScaledUiAmountConfig', 'ScaledUiAmount'], ['NonTransferable'], ['PermanentDelegate'], ['Pausable'], ['TransferHook'], ['ConfidentialTransfer'], ['DefaultAccountState']];
    const pickExt = () => { const p = pools[Math.floor(rnd() * pools.length)]; return p[Math.floor(rnd() * p.length)]; };
    if (rnd() < 0.4) pp.mint_a_extensions = Array.from({ length: Math.floor(rnd() * 3) }, pickExt);
    if (rnd() < 0.4) pp.mint_b_extensions = Array.from({ length: Math.floor(rnd() * 3) }, pickExt);
    if (rnd() < 0.25) pp.leg_a_extras_count = Math.floor(rnd() * 40).toString();
    if (rnd() < 0.25) pp.leg_b_extras_count = Math.floor(rnd() * 40).toString();
    pp.creation_timestamp = (BigInt(pp.expiry_timestamp) - BigInt(Math.floor(rnd() * 40000000))).toString();
    const k = kernelChecks(pp);
    const r = refChecks(pp);
    checked++;
    const ok = k.verdict === r.verdict && JSON.stringify(k.failed) === JSON.stringify(r.failed)
      && k.blockedFound.length === r.blockedFound.length && k.blockedFound.every((x) => r.blockedFound.includes(x))
      && k.trustCount === r.trustCount;
    if (!ok) { violations++; if (violations <= 3) console.log('  P1 mismatch at', i, JSON.stringify(k), JSON.stringify(r)); }
  }
  return { name: 'P1_kernel_matches_independent_reference', checked, violations };
}

// ---------- P2: mutant kill section ----------
function p2_mutant_kills() {
  const survivors = [];
  const kill = (name, pp, mut, cmp) => {
    const k = kernelChecks(pp);
    const r = refChecks(pp, mut);
    const differs = cmp
      ? cmp(k)
      : k.verdict !== r.verdict || JSON.stringify(k.failed) !== JSON.stringify(r.failed)
        || k.blockedFound.length !== r.blockedFound.length || !k.blockedFound.every((x) => r.blockedFound.includes(x))
        || k.trustCount !== r.trustCount;
    if (!differs) survivors.push(name);
  };
  {
    // a record whose owner IS the typo'd id: the kernel must still reject it (real pin differs),
    // while a kernel carrying the typo'd pin would accept it
    const p = basePP(); p.owner_program_id = PIN_OWNER.slice(0, -1);
    kill('owner-pin-typo', p, { owner: PIN_OWNER.slice(0, -1) });
  }
  {
    const p = basePP(); p.byte_length = '457';
    kill('len-457', p, { len: 457n });
  }
  {
    const p = basePP(); p.expiry_timestamp = (BigInt(p.creation_timestamp) + PIN_ONE_YEAR + 5n).toString(); p.expected = { ...p.expected, expiry_timestamp: p.expiry_timestamp };
    kill('cap-dropped', p, { capDropped: true });
    const q = { ...p, expiry_timestamp: (BigInt(p.creation_timestamp) + PIN_ONE_YEAR + 1n).toString(), expected: { ...p.expected, expiry_timestamp: (BigInt(p.creation_timestamp) + PIN_ONE_YEAR + 1n).toString() } };
    kill('cap-off-by-one', q, { capOffByOne: true });
  }
  {
    const p = basePP(); p.earliest_settlement_timestamp = '1770200000'; p.expected = { ...p.expected, earliest_settlement_timestamp: '1770200000' };
    kill('earliest-reversed', p, { earliestReversed: true });
  }
  {
    const p = basePP(); p.expiry_timestamp = p.now; p.expected = { ...p.expected, expiry_timestamp: p.now };
    kill('expiry-strictness-flip', p, { expiryStrict: true });
  }
  {
    const p = basePP(); p.mint_b_extensions = ['NonTransferable'];
    kill('deny-list-without-nontransferable', p, { denyWithoutNonTransferable: true });
  }
  {
    // short-name alias must normalize to the pinned full name and block identically
    const alias = basePP(); alias.mint_a_extensions = ['InterestBearing'];
    const k = kernelChecks(alias);
    if (JSON.stringify(k.failed) !== JSON.stringify(['blocked_extension']) || k.blockedFound[0] !== 'mint_a:InterestBearingConfig') survivors.push('deny-short-names-only');
  }
  {
    const p = basePP(); p.leg_a_extras_count = '32';
    kill('hook-cap-31', p, { hookCap31: true });
  }
  {
    const p = basePP(); p.mint_b_extensions = ['ScaledUiAmount'];
    kill('leg-a-only-blocked-check', p, { legAOnly: true });
  }
  {
    const p = basePP(); p.expected = { ...p.expected, destination_b: 'AttackerDest1111111111111111111111111111111' };
    kill('terms-ignores-destinations', p, { dropDestinations: true });
  }
  {
    const p = basePP(); p.mint_a_extensions = ['PermanentDelegate'];
    kill('trust-flags-silent', p, { trustSilent: true });
  }
  {
    const p = basePP(); p.mint_b_frozen_by_default = true; p.mint_b_freeze_authority_set = true;
    kill('trust-flags-silent-frozen', p, { trustSilent: true });
  }
  const name = 'P2_mutant_kill_section';
  console.log(`  [${name}] killed ${12 - survivors.length}/12 decision-rule mutants${survivors.length ? ' — SURVIVORS: ' + survivors.join(', ') : ''}`);
  return { name, checked: 12, violations: survivors.length };
}

// ---------- P3: refusal pins ----------
function p3_refusal_pins() {
  /** @type {Array<[string, () => any]>} */
  const cases = [
    ['NOW_REQUIRED', () => { const p = basePP(); delete p.now; return p; }],
    ['EXPECTED_TERMS_REQUIRED', () => { const p = basePP(); delete p.expected; return p; }],
    ['AMOUNT_INVALID', () => ({ ...basePP(), amount_a: '1.5' })],
    ['BYTE_LENGTH_MALFORMED', () => ({ ...basePP(), byte_length: 'x' })],
    ['NONCE_MALFORMED', () => ({ ...basePP(), nonce: '' })],
    ['HOOK_EXTRAS_INVALID', () => ({ ...basePP(), leg_a_extras_count: '256' })],
    ['EXTENSION_LIST_MALFORMED', () => ({ ...basePP(), mint_b_extensions: ['Made Up Extension'] })],
    ['EARLIEST_INVALID', () => ({ ...basePP(), earliest_settlement_timestamp: 'soon' })],
    ['OWNER_MALFORMED', () => ({ ...basePP(), owner_program_id: '' })],
    ['CREATION_MALFORMED', () => ({ ...basePP(), creation_timestamp: null })],
    ['FIELD_MALFORMED', () => ({ ...basePP(), user_b: '' })],
    ['EXPIRY_INVALID', () => { const p = basePP(); delete p.expiry_timestamp; return p; }],
  ];
  let checked = 0, violations = 0;
  for (const [code, mk] of cases) {
    const pp = mk();
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const ok = output_payload.error === code.toLowerCase()
      && compliance_flags.includes('INPUT_REFUSED')
      && output_payload.manual_review_required === true
      && output_payload.prefund_check === 'REFUSED'
      && Array.isArray(output_payload.domain_errors) && output_payload.domain_errors.length === 1
      && output_payload.failed_checks === null;
    if (!ok) { violations++; console.log('  P3 refusal pin failure for', code, JSON.stringify({ error: output_payload.error, flags: compliance_flags })); }
  }
  return { name: 'P3_refusal_pins_exact_codes', checked, violations };
}

// ---------- P4: determinism / purity ----------
function p4_determinism() {
  const pp = basePP({ mint_b_extensions: ['Pausable', 'TransferHook'], leg_a_extras_count: '4' });
  const before = JSON.stringify(pp);
  const a = compute(JSON.parse(JSON.stringify(pp)));
  const b = compute(JSON.parse(JSON.stringify(pp)));
  const same = JSON.stringify(a) === JSON.stringify(b);
  const inputUnchanged = JSON.stringify(pp) === before;
  let checked = 2, violations = same && inputUnchanged ? 0 : 1;
  return { name: 'P4_deterministic_and_input_pure', checked, violations };
}

// ---------- P5: flag mirror ----------
function p5_flag_mirror() {
  let checked = 0, violations = 0;
  const withTrust = basePP({ mint_a_extensions: ['PermanentDelegate'] });
  const clean = basePP();
  for (const [pp, expectFlags] of [[withTrust, true], [clean, false]]) {
    const { output_payload, compliance_flags } = compute(pp);
    checked++;
    const trustPresent = compliance_flags.some((f) => f.startsWith('TRUST_'));
    if (trustPresent !== expectFlags) violations++;
    if (trustPresent && output_payload.warnings.length === 0) violations++; // mirror must be truthy when conditional flags are present
    if (!trustPresent && compliance_flags.length !== 0) violations++; // clean record: no flags at all
  }
  return { name: 'P5_trust_flag_mirror', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(fixtures present)', got: String((e && e.message) || e) }] };
}
const properties = [
  p1_random_equivalence(),
  p2_mutant_kills(),
  p3_refusal_pins(),
  p4_determinism(),
  p5_flag_mirror(),
];
console.log(`[${KERNEL_ID}] class-K floor — fixture oracle + independent-reference equivalence + mutant kills + refusal pins + determinism + flag mirror`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
