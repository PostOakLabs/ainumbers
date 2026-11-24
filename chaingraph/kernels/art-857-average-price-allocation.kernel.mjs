import { executionHash } from './_hash.mjs';

// art-857-average-price-allocation: split one set of executed fills across accounts at one
// average price, in exact integer minor units, with a declared rounding basis and a declared
// residual rule.
//
// compute() is a pure function of pp: no clock, no network, no storage, and no floating
// point anywhere on the computation path. Prices are parsed from decimal strings into
// BigInt values scaled by 10^8, and every rounding is an exact BigInt half-up division.
// (The float trap this avoids: Math.round(1.005 * 100) is 100, not 101.)
//
// Minor units follow ISO 4217 (Codes for the representation of currencies, maintained by
// SIX Financial Information as the ISO 4217 maintenance agency), List One "minor unit"
// column: most codes 2, the codes listed in MINOR_0 below 0, MINOR_3 below 3, MINOR_4
// below 4. Codes outside the table (including the no-minor-unit funds and metals such as
// XAU and XDR) are refused.
//
// The rounding basis (amount_basis) and the residual rule (residual_handling) are declared
// conventions of this tool, not a regulatory or fairness rule.

const TOOL_ID = 'art-857-average-price-allocation';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'allocate_average_price',
  mandate_type: 'compliance_control', gpu: false,
};

// Caps: 5,000 fills (the art-541 FILL_SET_CEILING precedent) and 500 accounts.
export const MAX_FILLS = 5000;
export const MAX_ACCOUNTS = 500;
export const PRICE_SCALE_DP = 8;
const PRICE_SCALE = 100000000n;

const MINOR_0 = ['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'];
const MINOR_3 = ['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'];
const MINOR_4 = ['CLF', 'UYW'];
const MINOR_2 = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BGN', 'BMD', 'BND',
  'BOB', 'BOV', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHE', 'CHF', 'CHW', 'CNY', 'COP', 'COU',
  'CRC', 'CUP', 'CVE', 'CZK', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS',
  'GIP', 'GMD', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IRR', 'JMD', 'KES', 'KGS', 'KHR',
  'KPW', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU',
  'MUR', 'MVR', 'MWK', 'MXN', 'MXV', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'PAB', 'PEN', 'PGK',
  'PHP', 'PKR', 'PLN', 'QAR', 'RON', 'RSD', 'RUB', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS',
  'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'USD',
  'USN', 'UYU', 'UZS', 'VED', 'VES', 'WST', 'XCD', 'XCG', 'YER', 'ZAR', 'ZMW', 'ZWG',
];
const MINOR_UNITS = new Map();
for (const c of MINOR_2) MINOR_UNITS.set(c, 2);
for (const c of MINOR_0) MINOR_UNITS.set(c, 0);
for (const c of MINOR_3) MINOR_UNITS.set(c, 3);
for (const c of MINOR_4) MINOR_UNITS.set(c, 4);

const SIDES = ['buy', 'sell'];
const AMOUNT_BASES = ['unrounded_average', 'rounded_average_dp'];
const RESIDUAL_RULES = ['assign_largest', 'report_unallocated'];
const FILL_KEYS = ['price_per_share', 'quantity_shares', 'currency'];
const ALLOC_KEYS = ['account', 'shares'];

// Positive decimal string, at most 15 integer digits and at most 8 decimals.
const PRICE_RE = /^(0|[1-9][0-9]{0,14})(\.[0-9]{1,8})?$/;
// Pseudonymous account id: 1 to 64 characters from a fixed set.
const ACCOUNT_RE = /^[A-Za-z0-9._:-]{1,64}$/;

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

const NOTE = 'Average-price allocation in exact integer minor units (ISO 4217 minor unit for the declared currency). total_minor = half-up(sum of quantity x price). average_price = sum(quantity x price) / sum(quantity), 8 decimals half-up. Per account: half-up(shares x average) under unrounded_average, or half-up(shares x average rounded half-up to average_price_dp) under rounded_average_dp. residual_minor = total_minor - sum of account amounts; assign_largest adds it to the account with the most shares (ties to the first declared), report_unallocated leaves it unallocated. Identity: sum of final account amounts + unallocated residual = total_minor. The rounding basis and the residual rule are declared conventions of this tool, not a regulatory or fairness rule. Calculation check, not investment, legal or regulatory advice.';

// Mirrors the classes _hash.mjs assertIJson() refuses before canonicalizing.
const HASH_MAX_DEPTH = 512;        // _hash.mjs MAX_DEPTH
const HASH_MAX_ELEMENTS = 1000000; // _hash.mjs MAX_ELEMENTS
const PP_MAX_DEPTH = HASH_MAX_DEPTH - 8;
const PP_MAX_ELEMENTS = 199000;

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (typeof v === 'bigint') return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': bigint' };
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

function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

// Own-property read; absent and an explicit null both read as undefined (the R4 relation).
function own(o, k) {
  if (!Object.hasOwn(o, k)) return undefined;
  const v = o[k];
  return v === null ? undefined : v;
}

// Half-up division for non-negative BigInt numerator and positive denominator.
function halfUp(num, den) {
  return (2n * num + den) / (2n * den);
}

function pow10(n) {
  let out = 1n;
  for (let i = 0; i < n; i++) out *= 10n;
  return out;
}

// Fixed-point BigInt (non-negative) to a decimal string with dp decimals.
function fmtFixed(v, dp) {
  if (dp === 0) return v.toString();
  const s = v.toString().padStart(dp + 1, '0');
  return s.slice(0, s.length - dp) + '.' + s.slice(s.length - dp);
}

function parsePrice(s) {
  const m = PRICE_RE.exec(s);
  if (m === null) return null;
  const frac = m[2] === undefined ? '' : m[2].slice(1);
  const v = BigInt(m[1]) * PRICE_SCALE + BigInt(frac.padEnd(PRICE_SCALE_DP, '0'));
  return v > 0n ? v : null;
}

function isPosSafeInt(v) {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 1;
}

function validate(pp) {
  const refusals = [];
  /** @type {{currency: any, exp: any, side: any, basis: any, dp: any, rule: any, fills: Array<{price: bigint, qty: bigint}>|null, allocs: Array<{account: string, shares: bigint}>|null}} */
  const out = { currency: null, exp: null, side: null, basis: null, dp: null, rule: null, fills: null, allocs: null };

  const currency = own(pp, 'currency');
  if (currency === undefined) refusals.push('currency: REFUSED_INPUT_MISSING');
  else if (typeof currency !== 'string') refusals.push('currency: REFUSED_INPUT_WRONG_TYPE');
  else if (!MINOR_UNITS.has(currency)) refusals.push('currency: REFUSED_INPUT_UNKNOWN_CURRENCY');
  else { out.currency = currency; out.exp = MINOR_UNITS.get(currency); }

  const side = own(pp, 'side');
  if (side === undefined) refusals.push('side: REFUSED_INPUT_MISSING');
  else if (typeof side !== 'string' || !SIDES.includes(side)) refusals.push('side: REFUSED_INPUT_NOT_ALLOWED');
  else out.side = side;

  const basis = own(pp, 'amount_basis');
  if (basis === undefined) out.basis = 'unrounded_average';
  else if (typeof basis !== 'string' || !AMOUNT_BASES.includes(basis)) refusals.push('amount_basis: REFUSED_INPUT_NOT_ALLOWED');
  else out.basis = basis;

  const dp = own(pp, 'average_price_dp');
  if (out.basis === 'rounded_average_dp') {
    if (dp === undefined) refusals.push('average_price_dp: REFUSED_INPUT_MISSING');
    else if (typeof dp !== 'number' || !Number.isSafeInteger(dp)) refusals.push('average_price_dp: REFUSED_INPUT_NOT_INTEGER');
    else if (dp < 0 || dp > PRICE_SCALE_DP) refusals.push('average_price_dp: REFUSED_INPUT_OUT_OF_RANGE');
    else out.dp = dp;
  } else if (out.basis === 'unrounded_average' && dp !== undefined) {
    refusals.push('average_price_dp: REFUSED_INPUT_NOT_APPLICABLE');
  }

  const rule = own(pp, 'residual_handling');
  if (rule === undefined) {
    if (out.basis === 'unrounded_average') out.rule = 'assign_largest';
    else if (out.basis === 'rounded_average_dp') refusals.push('residual_handling: REFUSED_INPUT_MISSING');
  } else if (typeof rule !== 'string' || !RESIDUAL_RULES.includes(rule)) refusals.push('residual_handling: REFUSED_INPUT_NOT_ALLOWED');
  else out.rule = rule;

  const fills = own(pp, 'fills');
  if (fills === undefined) refusals.push('fills: REFUSED_INPUT_MISSING');
  else if (!Array.isArray(fills)) refusals.push('fills: REFUSED_INPUT_WRONG_TYPE');
  else if (fills.length < 1) refusals.push('fills: REFUSED_INPUT_EMPTY');
  else if (fills.length > MAX_FILLS) refusals.push('fills: REFUSED_INPUT_TOO_MANY');
  else {
    const parsed = [];
    let ok = true;
    for (let i = 0; i < fills.length; i++) {
      const f = fills[i];
      const at = 'fills[' + i + ']';
      if (!isPlainObject(f)) { refusals.push(at + ': REFUSED_INPUT_WRONG_TYPE'); ok = false; continue; }
      for (const k of Object.keys(f)) {
        if (!FILL_KEYS.includes(k)) { refusals.push(at + '.' + k + ': REFUSED_INPUT_UNKNOWN_KEY'); ok = false; }
      }
      const p = own(f, 'price_per_share');
      let price = null;
      if (p === undefined) refusals.push(at + '.price_per_share: REFUSED_INPUT_MISSING');
      else if (typeof p !== 'string') refusals.push(at + '.price_per_share: REFUSED_INPUT_WRONG_TYPE');
      else {
        price = parsePrice(p);
        if (price === null) refusals.push(at + '.price_per_share: REFUSED_INPUT_FORMAT');
      }
      const q = own(f, 'quantity_shares');
      if (q === undefined) refusals.push(at + '.quantity_shares: REFUSED_INPUT_MISSING');
      else if (!isPosSafeInt(q)) refusals.push(at + '.quantity_shares: REFUSED_INPUT_NOT_POSITIVE_INTEGER');
      const fc = own(f, 'currency');
      if (fc !== undefined && fc !== currency) refusals.push(at + '.currency: REFUSED_INPUT_CURRENCY_MISMATCH');
      if (price === null || !isPosSafeInt(q) || (fc !== undefined && fc !== currency)) { ok = false; continue; }
      parsed.push({ price, qty: BigInt(q) });
    }
    if (ok) out.fills = parsed;
  }

  const allocs = own(pp, 'allocations');
  if (allocs === undefined) refusals.push('allocations: REFUSED_INPUT_MISSING');
  else if (!Array.isArray(allocs)) refusals.push('allocations: REFUSED_INPUT_WRONG_TYPE');
  else if (allocs.length < 1) refusals.push('allocations: REFUSED_INPUT_EMPTY');
  else if (allocs.length > MAX_ACCOUNTS) refusals.push('allocations: REFUSED_INPUT_TOO_MANY');
  else {
    const parsed = [];
    const seen = new Map();
    let ok = true;
    for (let i = 0; i < allocs.length; i++) {
      const a = allocs[i];
      const at = 'allocations[' + i + ']';
      if (!isPlainObject(a)) { refusals.push(at + ': REFUSED_INPUT_WRONG_TYPE'); ok = false; continue; }
      for (const k of Object.keys(a)) {
        if (!ALLOC_KEYS.includes(k)) { refusals.push(at + '.' + k + ': REFUSED_INPUT_UNKNOWN_KEY'); ok = false; }
      }
      const acct = own(a, 'account');
      let acctOk = false;
      if (acct === undefined) refusals.push(at + '.account: REFUSED_INPUT_MISSING');
      else if (typeof acct !== 'string') refusals.push(at + '.account: REFUSED_INPUT_WRONG_TYPE');
      else if (!ACCOUNT_RE.test(acct)) refusals.push(at + '.account: REFUSED_INPUT_FORMAT');
      else if (seen.has(acct)) refusals.push(at + '.account: REFUSED_INPUT_DUPLICATE_ACCOUNT');
      else { seen.set(acct, i); acctOk = true; }
      const sh = own(a, 'shares');
      if (sh === undefined) refusals.push(at + '.shares: REFUSED_INPUT_MISSING');
      else if (!isPosSafeInt(sh)) refusals.push(at + '.shares: REFUSED_INPUT_NOT_POSITIVE_INTEGER');
      if (!acctOk || !isPosSafeInt(sh)) { ok = false; continue; }
      parsed.push({ account: acct, shares: BigInt(sh) });
    }
    if (ok) out.allocs = parsed;
  }

  if (out.fills !== null && out.allocs !== null) {
    let qf = 0n;
    for (const f of out.fills) qf += f.qty;
    let qa = 0n;
    for (const a of out.allocs) qa += a.shares;
    if (qf > MAX_SAFE) refusals.push('fills: REFUSED_INPUT_UNSAFE_TOTAL');
    else if (qa !== qf) refusals.push('allocations: REFUSED_INPUT_SHARES_MISMATCH');
  }
  return { refusals, v: out };
}

function refused(v, refusals) {
  const compliance_flags = ['INPUT_REFUSED'];
  return {
    output_payload: {
      currency: v.currency, minor_unit_exponent: v.exp, side: v.side,
      amount_label: v.side === null ? null : (v.side === 'buy' ? 'cost' : 'proceeds'),
      amount_basis: v.basis, average_price_dp: v.dp, residual_handling: v.rule,
      total_shares: null, total_minor: null, average_price: null, rounded_average_price: null,
      allocations: [], residual_minor: null, residual_account: null, unallocated_residual_minor: null,
      identity_holds: null, overall: 'INPUT_REFUSED', refusals,
      warnings: compliance_flags.slice(), note: NOTE,
    },
    compliance_flags,
  };
}

export function compute(rawPp) {
  if (!isPlainObject(rawPp)) {
    return refused({ currency: null, exp: null, side: null, basis: null, dp: null, rule: null }, ['policy_parameters: REFUSED_INPUT_WRONG_TYPE']);
  }
  const unhashable = findHashRefusal(rawPp, 'policy_parameters', 1, { maxDepth: PP_MAX_DEPTH, maxElements: PP_MAX_ELEMENTS, n: 0 });
  if (unhashable !== null) {
    return refused({ currency: null, exp: null, side: null, basis: null, dp: null, rule: null }, [unhashable.detail + ': ' + unhashable.reason]);
  }
  const { refusals, v } = validate(rawPp);
  if (refusals.length > 0) return refused(v, refusals);

  const minorScale = pow10(v.exp);
  let notional = 0n; // sum(quantity x price), scaled by 10^8
  let qtot = 0n;
  for (const f of v.fills) { notional += f.qty * f.price; qtot += f.qty; }

  const totalMinor = halfUp(notional * minorScale, PRICE_SCALE);
  const avg8 = halfUp(notional, qtot);
  let roundedAvg = null;
  let dpScale = null;
  if (v.basis === 'rounded_average_dp') {
    dpScale = pow10(v.dp);
    roundedAvg = halfUp(notional * dpScale, qtot * PRICE_SCALE);
  }

  const pre = [];
  let sumPre = 0n;
  for (const a of v.allocs) {
    const amt = v.basis === 'unrounded_average'
      ? halfUp(a.shares * notional * minorScale, qtot * PRICE_SCALE)
      : halfUp(a.shares * roundedAvg * minorScale, dpScale);
    pre.push(amt);
    sumPre += amt;
  }
  const residual = totalMinor - sumPre;

  // Every figure that leaves the kernel must be a safe integer (I-JSON).
  let unsafe = totalMinor > MAX_SAFE || residual > MAX_SAFE || -residual > MAX_SAFE;
  for (const p of pre) if (p + (residual < 0n ? -residual : residual) > MAX_SAFE) unsafe = true;
  if (unsafe) return refused(v, ['fills: REFUSED_INPUT_AMOUNT_UNSAFE']);

  let target = -1;
  if (v.rule === 'assign_largest') {
    target = 0;
    for (let i = 1; i < v.allocs.length; i++) if (v.allocs[i].shares > v.allocs[target].shares) target = i;
  }

  const allocations = [];
  let sumFinal = 0n;
  let negative = false;
  for (let i = 0; i < v.allocs.length; i++) {
    const fin = i === target ? pre[i] + residual : pre[i];
    if (fin < 0n) negative = true;
    sumFinal += fin;
    allocations.push({
      account: v.allocs[i].account,
      shares: Number(v.allocs[i].shares),
      amount_minor_pre_residual: Number(pre[i]),
      amount_minor: Number(fin),
    });
  }
  const unallocated = target === -1 ? residual : 0n;
  const identity_holds = sumFinal + unallocated === totalMinor;

  const compliance_flags = [];
  if (residual !== 0n && target !== -1) compliance_flags.push('RESIDUAL_ASSIGNED');
  if (residual !== 0n && target === -1) compliance_flags.push('RESIDUAL_UNALLOCATED');
  if (negative) compliance_flags.push('ACCOUNT_AMOUNT_NEGATIVE');
  if (!identity_holds) compliance_flags.push('IDENTITY_FAILED');

  const output_payload = {
    currency: v.currency,
    minor_unit_exponent: v.exp,
    side: v.side,
    amount_label: v.side === 'buy' ? 'cost' : 'proceeds',
    amount_basis: v.basis,
    average_price_dp: v.dp,
    residual_handling: v.rule,
    total_shares: Number(qtot),
    total_minor: Number(totalMinor),
    average_price: fmtFixed(avg8, PRICE_SCALE_DP),
    rounded_average_price: roundedAvg === null ? null : fmtFixed(roundedAvg, v.dp),
    allocations,
    residual_minor: Number(residual),
    residual_account: target === -1 ? null : v.allocs[target].account,
    unallocated_residual_minor: Number(unallocated),
    identity_holds,
    overall: 'ALLOCATION_COMPUTED',
    refusals: [],
    warnings: compliance_flags.slice(),
    note: NOTE,
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  // Walk the caller input first so compute() never sees an unhashable value, then walk
  // the {policy_parameters, output_payload} pair that executionHash() will canonicalize.
  let unhashable = findHashRefusal(pp, 'policy_parameters', 2, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  const result = unhashable === null ? compute(pp) : null;
  const output_payload = result === null ? null : result.output_payload;
  const compliance_flags = result === null ? ['INPUT_UNHASHABLE_REFUSED'] : result.compliance_flags;
  if (unhashable === null) {
    unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'artifact', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  }
  const hash = unhashable === null ? await executionHash(pp, output_payload) : null;
  const artifact = {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
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
