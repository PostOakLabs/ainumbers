import { executionHash } from './_hash.mjs';

// art-835-bank-reconciliation-recompute — recomputes a bank-to-book reconciliation and an optional proof of
// cash from declared balances and declared reconciling items, and flags stale items and any unreconciled
// difference. Integer minor units only (BigInt inside, safe-integer Numbers out). It recomputes from declared
// values. It does not read a bank statement and cannot tell whether a declared item is real. Ids and integers
// only: free-text labels, names and account-number lookalikes are refused, never read.
//
// DETERMINISM: compute() is a pure function of pp (no clock, no randomness, no I/O, no TextEncoder).

const TOOL_ID = 'art-835-bank-reconciliation-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_bank_reconciliation',
  mandate_type: 'compliance_control', gpu: false,
};

const MAX_MINOR = 1000000000000n; // 1e12: with 500 items per list every sum stays a safe integer
const MAX_ITEMS = 500;
const MAX_THRESHOLD_DAYS = 36500;
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const ACCOUNT_RUN_RE = /[0-9]{8,}/;
const IBAN_LIKE_RE = /^[a-z]{2}[0-9]{2}[a-z0-9_-]{10,}$/;
const DATE_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const ITEM_TYPES = ['bank_error', 'book_error', 'bank_fee', 'interest', 'other'];
const SIDES = ['bank', 'book'];

const TOP_KEYS = ['statement_ending_balance_minor', 'ledger_ending_balance_minor', 'as_of_date', 'stale_threshold_days',
  'outstanding_deposits', 'outstanding_payments', 'other_items', 'proof_of_cash'];
const ITEM_KEYS = ['item_id', 'amount_minor', 'item_date'];
const OTHER_KEYS = ['item_id', 'item_type', 'side', 'effect_minor', 'item_date'];
const POC_KEYS = ['bank', 'book'];
const COLUMN_KEYS = ['opening_minor', 'receipts_minor', 'disbursements_minor', 'closing_minor'];

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function absBig(x) { return x < 0n ? -x : x; }

// Day count from the Unix epoch day (1970-01-01) for a proleptic Gregorian civil date (pure integer arithmetic).
function daysFromCivil(y, m, d) {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

// Strict ISO date plus calendar check (days-in-month and the leap rule). Returns a day number or null.
function parseDate(s) {
  if (typeof s !== 'string') return null;
  const m = DATE_RE.exec(s);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (y < 1900 || y > 2999 || mo < 1 || mo > 12 || d < 1) return null;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return d > dim ? null : daysFromCivil(y, mo, d);
}

function shell(verdict, refusalCode, flags) {
  const output_payload = {
    verdict,
    refusal_code: refusalCode,
    as_of_date: null,
    stale_threshold_days: null,
    statement_ending_balance_minor: null,
    ledger_ending_balance_minor: null,
    outstanding_deposits_total_minor: null,
    outstanding_payments_total_minor: null,
    bank_side_adjustments_minor: null,
    book_side_adjustments_minor: null,
    adjusted_bank_balance_minor: null,
    adjusted_book_balance_minor: null,
    unreconciled_difference_minor: null,
    item_counts: null,
    stale_items: [],
    proof_of_cash: null,
    warnings: flags.slice(),
  };
  return { output_payload, compliance_flags: flags.slice() };
}

/**
 * compute(pp): pure bank-to-book reconciliation recompute.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  let refusal = null;
  const refuse = (c) => { if (refusal === null) refusal = c; };
  const flags = [];
  const add = (f) => { if (!flags.includes(f)) flags.push(f); };

  if (!isObj(pp)) return shell('input_refused', 'WRONG_TYPE_REFUSED', ['INPUT_REFUSED']);

  const keyCheck = (o, allowed) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) { refuse('FREE_TEXT_FIELD_REFUSED'); return false; }
    return true;
  };
  // Presence (R4): null and undefined are both "not provided" and flag the fact as missing; they are never
  // read as a value and never defaulted. A present value of the wrong type, range or shape refuses.
  // Money: safe integer inside the declared limit.
  const money = (v, { positive = false, nonNegative = false } = {}) => {
    if (v == null) return undefined;
    if (typeof v !== 'number' || !Number.isSafeInteger(v)) { refuse('WRONG_TYPE_REFUSED'); return undefined; }
    const b = BigInt(v);
    if (absBig(b) > MAX_MINOR) { refuse('AMOUNT_OUT_OF_RANGE_REFUSED'); return undefined; }
    if (positive && b <= 0n) { refuse('AMOUNT_NOT_POSITIVE_REFUSED'); return undefined; }
    if (nonNegative && b < 0n) { refuse('AMOUNT_NEGATIVE_REFUSED'); return undefined; }
    return b;
  };
  const idOf = (v) => {
    if (v == null) return undefined;
    if (typeof v !== 'string') { refuse('WRONG_TYPE_REFUSED'); return undefined; }
    if (ACCOUNT_RUN_RE.test(v) || IBAN_LIKE_RE.test(v)) { refuse('ACCOUNT_NUMBER_LOOKALIKE_REFUSED'); return undefined; }
    if (!ID_RE.test(v)) { refuse('ID_FORMAT_REFUSED'); return undefined; }
    return v;
  };
  const enumOf = (v, allowed) => {
    if (v == null) return undefined;
    if (typeof v !== 'string' || !allowed.includes(v)) { refuse('ENUM_VALUE_REFUSED'); return undefined; }
    return v;
  };
  const dateOf = (v) => {
    if (v == null) return undefined;
    const n = parseDate(v);
    if (n === null) { refuse('DATE_INVALID_REFUSED'); return undefined; }
    return n;
  };

  keyCheck(pp, TOP_KEYS);

  const statement = money(pp.statement_ending_balance_minor);
  if (statement === undefined) add('STATEMENT_BALANCE_MISSING');
  const ledger = money(pp.ledger_ending_balance_minor);
  if (ledger === undefined) add('LEDGER_BALANCE_MISSING');
  const asOf = dateOf(pp.as_of_date);
  if (asOf === undefined) add('AS_OF_DATE_MISSING');

  let threshold;
  if (pp.stale_threshold_days == null) add('STALE_THRESHOLD_MISSING');
  else if (typeof pp.stale_threshold_days !== 'number' || !Number.isSafeInteger(pp.stale_threshold_days)) refuse('WRONG_TYPE_REFUSED');
  else if (pp.stale_threshold_days < 0 || pp.stale_threshold_days > MAX_THRESHOLD_DAYS) refuse('THRESHOLD_OUT_OF_RANGE_REFUSED');
  else threshold = pp.stale_threshold_days;

  const seenIds = new Set();
  const noteId = (id) => { if (id === undefined) return; if (seenIds.has(id)) refuse('DUPLICATE_ITEM_ID_REFUSED'); seenIds.add(id); };
  const noteDate = (d) => { if (d !== undefined && asOf !== undefined && d > asOf) refuse('ITEM_DATE_AFTER_AS_OF_REFUSED'); };

  // Outstanding lists: required, each item positive amount + id + date.
  const readList = (v, missingFlag, listName) => {
    const out = [];
    if (v == null) { add(missingFlag); return null; }
    if (!Array.isArray(v)) { refuse('WRONG_TYPE_REFUSED'); return null; }
    if (v.length > MAX_ITEMS) { refuse('MAX_ITEMS_REFUSED'); return null; }
    for (const it of v) {
      if (!isObj(it)) { refuse('WRONG_TYPE_REFUSED'); continue; }
      keyCheck(it, ITEM_KEYS);
      const id = idOf(it.item_id);
      noteId(id);
      const amt = money(it.amount_minor, { positive: true });
      const dt = dateOf(it.item_date);
      noteDate(dt);
      if (id === undefined || amt === undefined || dt === undefined) { add('ITEM_FIELD_MISSING'); continue; }
      out.push({ id, amt, dt, list: listName });
    }
    return out;
  };
  const deposits = readList(pp.outstanding_deposits, 'OUTSTANDING_DEPOSITS_MISSING', 'outstanding_deposits');
  const payments = readList(pp.outstanding_payments, 'OUTSTANDING_PAYMENTS_MISSING', 'outstanding_payments');

  let others = null;
  if (pp.other_items == null) add('OTHER_ITEMS_MISSING');
  else if (!Array.isArray(pp.other_items)) refuse('WRONG_TYPE_REFUSED');
  else if (pp.other_items.length > MAX_ITEMS) refuse('MAX_ITEMS_REFUSED');
  else {
    others = [];
    for (const it of pp.other_items) {
      if (!isObj(it)) { refuse('WRONG_TYPE_REFUSED'); continue; }
      keyCheck(it, OTHER_KEYS);
      const id = idOf(it.item_id);
      noteId(id);
      const type = enumOf(it.item_type, ITEM_TYPES);
      const side = enumOf(it.side, SIDES);
      const eff = money(it.effect_minor);
      const dt = dateOf(it.item_date);
      noteDate(dt);
      if (id === undefined || type === undefined || side === undefined || eff === undefined || dt === undefined) { add('ITEM_FIELD_MISSING'); continue; }
      others.push({ id, type, side, eff, dt, list: 'other_items' });
    }
  }

  // Optional proof of cash. Absent is allowed; a present block must be complete and well typed.
  /** @type {{ bank?: any, book?: any } | null} */
  let poc = null;
  if (pp.proof_of_cash != null) {
    if (!isObj(pp.proof_of_cash)) refuse('WRONG_TYPE_REFUSED');
    else {
      keyCheck(pp.proof_of_cash, POC_KEYS);
      poc = {};
      for (const col of POC_KEYS) {
        const c = pp.proof_of_cash[col];
        if (c == null) { add('PROOF_OF_CASH_COLUMN_MISSING'); poc = null; break; }
        if (!isObj(c)) { refuse('WRONG_TYPE_REFUSED'); poc = null; break; }
        keyCheck(c, COLUMN_KEYS);
        const opening = money(c.opening_minor);
        const receipts = money(c.receipts_minor, { nonNegative: true });
        const disb = money(c.disbursements_minor, { nonNegative: true });
        const closing = money(c.closing_minor);
        if (opening === undefined || receipts === undefined || disb === undefined || closing === undefined) { add('PROOF_OF_CASH_COLUMN_MISSING'); poc = null; break; }
        poc[col] = { opening, receipts, disb, closing };
      }
    }
  }

  if (refusal !== null) return shell('input_refused', refusal, ['INPUT_REFUSED']);
  if (flags.length) return shell('indeterminate', null, flags.concat(['INDETERMINATE']));

  // ---- recompute (all facts present and well typed from here) ----
  let depTotal = 0n;
  for (const d of deposits) depTotal += d.amt;
  let payTotal = 0n;
  for (const p of payments) payTotal += p.amt;
  let bankAdj = 0n;
  let bookAdj = 0n;
  for (const o of others) { if (o.side === 'bank') bankAdj += o.eff; else bookAdj += o.eff; }

  const adjBank = statement + depTotal - payTotal + bankAdj;
  const adjBook = ledger + bookAdj;
  const diff = adjBank - adjBook;

  const stale = [];
  const dated = [];
  for (const group of [deposits, payments, others]) for (const it of group) dated.push(it);
  for (const it of dated) {
    const age = asOf - it.dt;
    if (age > threshold) stale.push({ item_id: it.id, list: it.list, age_days: age });
  }
  stale.sort((a, b) => (a.item_id < b.item_id ? -1 : a.item_id > b.item_id ? 1 : 0));

  const compliance_flags = [];
  if (diff !== 0n) compliance_flags.push('UNRECONCILED_DIFFERENCE');
  if (stale.length) compliance_flags.push('STALE_ITEMS');

  let proof = null;
  let pocBreak = false;
  if (poc !== null) {
    const column = (c, balance) => {
      const footingDiff = c.opening + c.receipts - c.disb - c.closing;
      return {
        opening_minor: Number(c.opening),
        receipts_minor: Number(c.receipts),
        disbursements_minor: Number(c.disb),
        closing_minor: Number(c.closing),
        footing_difference_minor: Number(footingDiff),
        closing_minus_declared_balance_minor: Number(c.closing - balance),
      };
    };
    const bank = column(poc.bank, statement);
    const book = column(poc.book, ledger);
    const movementDiff = (poc.bank.receipts - poc.bank.disb) - (poc.book.receipts - poc.book.disb);
    const footBreak = bank.footing_difference_minor !== 0 || book.footing_difference_minor !== 0;
    const closeBreak = bank.closing_minus_declared_balance_minor !== 0 || book.closing_minus_declared_balance_minor !== 0;
    pocBreak = footBreak || closeBreak;
    proof = { bank, book, movement_difference_minor: Number(movementDiff), foots: !footBreak, closes_to_declared_balances: !closeBreak };
    if (footBreak) compliance_flags.push('PROOF_OF_CASH_FOOTING_BREAK');
    if (closeBreak) compliance_flags.push('PROOF_OF_CASH_CLOSING_MISMATCH');
  }

  const output_payload = {
    verdict: diff !== 0n || pocBreak ? 'unreconciled' : 'reconciled',
    refusal_code: null,
    as_of_date: pp.as_of_date,
    stale_threshold_days: threshold,
    statement_ending_balance_minor: Number(statement),
    ledger_ending_balance_minor: Number(ledger),
    outstanding_deposits_total_minor: Number(depTotal),
    outstanding_payments_total_minor: Number(payTotal),
    bank_side_adjustments_minor: Number(bankAdj),
    book_side_adjustments_minor: Number(bookAdj),
    adjusted_bank_balance_minor: Number(adjBank),
    adjusted_book_balance_minor: Number(adjBook),
    unreconciled_difference_minor: Number(diff),
    item_counts: { outstanding_deposits: deposits.length, outstanding_payments: payments.length, other_items: others.length },
    stale_items: stale,
    proof_of_cash: proof,
    warnings: compliance_flags.slice(),
  };
  return { output_payload, compliance_flags };
}

// ── hashability walk (D6) ────────────────────────────────────────────────────────
// Mirrors the classes _hash.mjs assertIJson() refuses before canonicalizing: a non-finite number or an
// integer outside the 2^53 safe range, nesting past its MAX_DEPTH, more values than its MAX_ELEMENTS.
// Reports { reason, detail } with the path and kind only; null when the subtree is safe to hash.
const HASH_MAX_DEPTH = 512;        // _hash.mjs MAX_DEPTH
const HASH_MAX_ELEMENTS = 1000000; // _hash.mjs MAX_ELEMENTS

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  return null;
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  // The walked object is the exact execution_hash preimage. When the shared canonicalizer would refuse it,
  // mint the artifact with a null execution_hash and the reason beside it instead of letting the hash throw.
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'pp', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  const artifact = {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: unhashable === null ? await executionHash(pp, output_payload) : null,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  if (unhashable !== null) artifact.hash_refusal = { reason: unhashable.reason, detail: unhashable.detail };
  return artifact;
}
