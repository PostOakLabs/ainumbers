// art-835-bank-reconciliation-recompute — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:b3e7e01f5b854caaa5d8988fa47fb8f12c0cffd3db36c5e647b35b788bc5fcea
// spec: BANK-REC-RECOMPUTE-NODE-1 board row (bank-to-book reconciliation and proof of cash over declared integer values)
// human_sign_off: PENDING
//
// Properties: a reconciliation built to balance reports reconciled with a zero difference; the adjusted
// sides equal exactly when the difference is zero; the difference matches an independent BigInt recompute;
// item order never changes the result; the stale list matches an independent age recompute; a proof of cash
// built to foot never breaks and one perturbed cell always does; refusals and missing facts never reconcile;
// output is deterministic and warnings mirror the flags; buildArtifact never throws.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-835-bank-reconciliation-recompute.proptest.mjs

import { compute, buildArtifact } from '../art-835-bank-reconciliation-recompute.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32 } from './_pbt-common.mjs';

const KERNEL_ID = 'art-835-bank-reconciliation-recompute';
const N_CASES = 400;

function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function pad(n) { return String(n).padStart(2, '0'); }
// Day-of-October-2026 helper: dates between 2026-08-01 and 2026-10-31.
const REC_DATE = '2026-10-31';
function randDate(rng) {
  const off = randInt(rng, 0, 91); // days back from 2026-10-31
  const d = new Date(Date.UTC(2026, 9, 31) - off * 86400000);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}
function ageDays(date) { return Math.round((Date.UTC(2026, 9, 31) - Date.parse(date + 'T00:00:00Z')) / 86400000); }

const TYPES = ['bank_error', 'book_error', 'bank_fee', 'interest', 'other'];

// A reconciliation built to balance: random items, the ledger derived so adjusted book equals adjusted bank.
function genRec(rng) {
  const statement = randInt(rng, -100000, 5000000);
  const deposits = [];
  const payments = [];
  const others = [];
  for (let i = 0; i < randInt(rng, 0, 6); i++) deposits.push({ item_id: 'd' + i, amount_minor: randInt(rng, 1, 90000), item_date: randDate(rng) });
  for (let i = 0; i < randInt(rng, 0, 6); i++) payments.push({ item_id: 'p' + i, amount_minor: randInt(rng, 1, 90000), item_date: randDate(rng) });
  for (let i = 0; i < randInt(rng, 0, 5); i++) {
    others.push({ item_id: 'o' + i, item_type: TYPES[randInt(rng, 0, 4)], side: rng() < 0.5 ? 'bank' : 'book', effect_minor: randInt(rng, -30000, 30000), item_date: randDate(rng) });
  }
  let bankAdj = statement;
  for (const d of deposits) bankAdj += d.amount_minor;
  for (const p of payments) bankAdj -= p.amount_minor;
  let bankSide = 0;
  let bookSide = 0;
  for (const o of others) { if (o.side === 'bank') bankSide += o.effect_minor; else bookSide += o.effect_minor; }
  bankAdj += bankSide;
  const ledger = bankAdj - bookSide;
  return {
    statement_ending_balance_minor: statement,
    ledger_ending_balance_minor: ledger,
    as_of_date: REC_DATE,
    stale_threshold_days: randInt(rng, 0, 120),
    outstanding_deposits: deposits,
    outstanding_payments: payments,
    other_items: others,
  };
}

// Independent reference: BigInt recompute of the difference and the stale id set, straight from the input.
function reference(pp) {
  let bank = BigInt(pp.statement_ending_balance_minor);
  for (const d of pp.outstanding_deposits) bank += BigInt(d.amount_minor);
  for (const p of pp.outstanding_payments) bank -= BigInt(p.amount_minor);
  let book = BigInt(pp.ledger_ending_balance_minor);
  for (const o of pp.other_items) { if (o.side === 'bank') bank += BigInt(o.effect_minor); else book += BigInt(o.effect_minor); }
  const stale = [];
  for (const it of [].concat(pp.outstanding_deposits, pp.outstanding_payments, pp.other_items)) {
    if (ageDays(it.item_date) > pp.stale_threshold_days) stale.push(it.item_id);
  }
  stale.sort();
  return { bank, book, diff: bank - book, stale };
}

function shuffle(rng, a) {
  const out = a.slice();
  for (let j = out.length - 1; j > 0; j--) {
    const t = Math.floor(rng() * (j + 1));
    [out[j], out[t]] = [out[t], out[j]];
  }
  return out;
}

function checkBuiltToBalanceReconciles(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const { output_payload: o } = compute(genRec(rng));
    if (o.verdict !== 'reconciled' || o.unreconciled_difference_minor !== 0) violations++;
    if (o.adjusted_bank_balance_minor !== o.adjusted_book_balance_minor) violations++;
  }
  return { name: 'built_to_balance_always_reconciles', checked: N_CASES, violations };
}

function checkDifferenceMatchesReference(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genRec(rng);
    const delta = randInt(rng, -5000, 5000);
    pp.ledger_ending_balance_minor += delta;
    const { output_payload: o } = compute(pp);
    const ref = reference(pp);
    if (BigInt(o.unreconciled_difference_minor) !== ref.diff) violations++;
    if (BigInt(o.adjusted_bank_balance_minor) !== ref.bank || BigInt(o.adjusted_book_balance_minor) !== ref.book) violations++;
    // adjusted sides equal exactly when the difference is zero
    if ((o.adjusted_bank_balance_minor === o.adjusted_book_balance_minor) !== (o.unreconciled_difference_minor === 0)) violations++;
    if ((delta === 0) !== (o.verdict === 'reconciled')) violations++;
  }
  return { name: 'difference_matches_independent_bigint_recompute', checked: N_CASES, violations };
}

function checkItemOrderInvariance(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genRec(rng);
    pp.ledger_ending_balance_minor += randInt(rng, -3, 3);
    const a = compute(pp);
    const b = compute({
      ...pp,
      outstanding_deposits: shuffle(rng, pp.outstanding_deposits),
      outstanding_payments: shuffle(rng, pp.outstanding_payments),
      other_items: shuffle(rng, pp.other_items),
    });
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'item_order_never_changes_result', checked: N_CASES, violations };
}

function checkStaleMatchesReference(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genRec(rng);
    const { output_payload: o, compliance_flags } = compute(pp);
    const ref = reference(pp);
    const got = o.stale_items.map((s) => s.item_id);
    if (JSON.stringify(got) !== JSON.stringify(ref.stale)) violations++;
    if ((ref.stale.length > 0) !== compliance_flags.includes('STALE_ITEMS')) violations++;
    for (const s of o.stale_items) if (s.age_days <= pp.stale_threshold_days) violations++;
  }
  return { name: 'stale_items_match_independent_age_recompute', checked: N_CASES, violations };
}

function genPoc(rng, pp) {
  const col = (closing) => {
    const receipts = randInt(rng, 0, 900000);
    const disb = randInt(rng, 0, 900000);
    return { opening_minor: closing - receipts + disb, receipts_minor: receipts, disbursements_minor: disb, closing_minor: closing };
  };
  return { bank: col(pp.statement_ending_balance_minor), book: col(pp.ledger_ending_balance_minor) };
}

function checkProofOfCash(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genRec(rng);
    pp.proof_of_cash = genPoc(rng, pp);
    const ok = compute(pp);
    if (ok.output_payload.verdict !== 'reconciled' || ok.output_payload.proof_of_cash.foots !== true || ok.compliance_flags.length > (ok.output_payload.stale_items.length ? 1 : 0)) violations++;
    const cell = ['opening_minor', 'receipts_minor', 'disbursements_minor'][randInt(rng, 0, 2)];
    const side = rng() < 0.5 ? 'bank' : 'book';
    pp.proof_of_cash[side][cell] += randInt(rng, 1, 999);
    const bad = compute(pp);
    if (bad.output_payload.verdict !== 'unreconciled' || bad.output_payload.proof_of_cash.foots !== false || !bad.compliance_flags.includes('PROOF_OF_CASH_FOOTING_BREAK')) violations++;
  }
  return { name: 'proof_of_cash_foots_or_breaks_exactly', checked: N_CASES, violations };
}

function checkRefusalsAndMissing(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const which = i % 8;
    /** @type {any} */
    const pp = genRec(rng);
    if (pp.outstanding_deposits.length === 0) pp.outstanding_deposits.push({ item_id: 'dx', amount_minor: 5, item_date: REC_DATE });
    if (which === 0) pp.outstanding_deposits[0].memo = 'x';
    else if (which === 1) pp.outstanding_deposits[0].item_id = 'acct' + String(randInt(rng, 10000000, 99999999));
    else if (which === 2) pp.statement_ending_balance_minor = null; // present null reads as not provided
    else if (which === 3) pp.as_of_date = '2026-02-31';
    else if (which === 4) pp.ledger_ending_balance_minor = '5';
    else if (which === 5) delete pp.ledger_ending_balance_minor;
    else if (which === 6) delete pp.other_items;
    else pp.outstanding_deposits[0].item_id = 'Jane Doe';
    const { output_payload: o, compliance_flags } = compute(pp);
    const refused = which !== 2 && which !== 5 && which !== 6;
    if (refused) {
      if (o.verdict !== 'input_refused' || !o.refusal_code || !compliance_flags.includes('INPUT_REFUSED')) violations++;
    } else if (o.verdict !== 'indeterminate' || !compliance_flags.includes('INDETERMINATE')) violations++;
    if (o.adjusted_bank_balance_minor !== null || o.unreconciled_difference_minor !== null) violations++;
  }
  return { name: 'refusals_and_missing_facts_never_reconcile', checked: N_CASES, violations };
}

function checkDeterminismAndWarningsMirror(rng) {
  let violations = 0;
  for (let i = 0; i < N_CASES; i++) {
    const pp = genRec(rng);
    if (rng() < 0.5) pp.ledger_ending_balance_minor += randInt(rng, 1, 50);
    if (rng() < 0.3) pp.proof_of_cash = genPoc(rng, pp);
    const a = compute(pp);
    const b = compute(JSON.parse(JSON.stringify(pp)));
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
    if ((a.output_payload.warnings.length > 0) !== (a.compliance_flags.length > 0)) violations++;
  }
  return { name: 'deterministic_and_warnings_mirror_flags', checked: N_CASES, violations };
}

const NASTY = [
  undefined, null, 0, 'x', [], {}, 1e300, -1e300, 9007199254740993, NaN, Infinity,
  JSON.parse('{"__proto__":{"a":1}}'), JSON.parse('{"constructor":1,"toString":2}'),
  { statement_ending_balance_minor: 9007199254740993, ledger_ending_balance_minor: 1, as_of_date: REC_DATE, stale_threshold_days: 1, outstanding_deposits: [], outstanding_payments: [], other_items: [] },
  { statement_ending_balance_minor: 1e300, ledger_ending_balance_minor: NaN, as_of_date: REC_DATE, stale_threshold_days: 1, outstanding_deposits: [{ item_id: 'a', amount_minor: Infinity, item_date: REC_DATE }], outstanding_payments: [], other_items: [] },
];

async function checkBuildArtifactNeverThrows() {
  let violations = 0;
  let checked = 0;
  for (const pp of NASTY) {
    checked++;
    try {
      const a = await buildArtifact(pp);
      const unhashable = a.execution_hash === null;
      if (unhashable && !a.hash_refusal) violations++;
      if (!unhashable && !/^[0-9a-f]{64}$/.test(a.execution_hash)) violations++;
    } catch (e) {
      violations++;
    }
  }
  return { name: 'buildArtifact_never_throws', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkBuiltToBalanceReconciles(mulberry32(1)),
  checkDifferenceMatchesReference(mulberry32(2)),
  checkItemOrderInvariance(mulberry32(3)),
  checkStaleMatchesReference(mulberry32(4)),
  checkProofOfCash(mulberry32(5)),
  checkRefusalsAndMissing(mulberry32(6)),
  checkDeterminismAndWarningsMirror(mulberry32(7)),
  await checkBuildArtifactNeverThrows(),
];
console.log(`[${KERNEL_ID}] class-K floor property test`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
