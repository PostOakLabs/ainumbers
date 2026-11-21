import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-851-islamic-mmf-placement-limits';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_islamic_mmf_placement_limits',
  mandate_type: 'compliance_control', gpu: false,
};

const MAX_HOLDINGS = 500;
const MAX_DAYS = 100000;
const HASH_MAX_DEPTH = 512;
const HASH_MAX_ELEMENTS = 1000000;
const PP_MAX_DEPTH = HASH_MAX_DEPTH - 8;
const PP_MAX_ELEMENTS = 199000;

const TOKEN_RE = /^[a-z][a-z0-9_]{0,31}$/;
const PROTO_NAMES = new Set(['constructor', '__proto__', 'toString', 'prototype', 'valueof', 'hasownproperty']);
const TYPES = [
  'sama_money_market_transaction', 'debt_instrument', 'derivative',
  'sama_regulated_deposit', 'public_mmf_units', 'fixed_income_fund_units',
];
const FUND_UNITS = ['public_mmf_units', 'fixed_income_fund_units'];
const CAP = {
  derivative: 500n, securitisation: 1000n, issuer: 1000n,
  counterparty: 2500n, group: 2500n, fund_units: 2500n, liquidity: 1000n,
};
const WAL_CAP_SCALED = 1800000n;
const BUCKETS = [
  ['0-7', 0, 7], ['8-30', 8, 30], ['31-90', 31, 90],
  ['91-180', 91, 180], ['181-365', 181, 365], ['366+', 366, MAX_DAYS + 1],
];

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
  }
  return null;
}

function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

const hasOwn = (o, k) => Object.hasOwn(o, k);
const refuse = (errors, code, detail) => { errors.push(code + ': ' + detail); };

function pctString(bp) {
  const neg = bp < 0n;
  const a = neg ? -bp : bp;
  return (neg ? '-' : '') + String(a / 100n) + '.' + String(a % 100n).padStart(2, '0');
}

function daysString(scaled) {
  const neg = scaled < 0n;
  const a = neg ? -scaled : scaled;
  return (neg ? '-' : '') + String(a / 10000n) + '.' + String(a % 10000n).padStart(4, '0');
}

function divHalfEven(num, den) {
  const q = num / den, r = num % den, twice = r * 2n;
  if (twice > den) return q + 1n;
  if (twice < den) return q;
  return q % 2n === 0n ? q : q + 1n;
}

function emptyPayload() {
  return {
    not_a_shariah_ruling: true,
    valid_input: false,
    domain_errors: [],
    refusal_code: null,
    authority: null,
    nav_minor_units: null,
    limits: [],
    overall_breached: null,
    placement_ladder: [],
    reminders: [],
    exempt_holdings_count: null,
    liquidity_met_by_short_maturities: null,
    computed_wal_days: null,
    wal_days_source: null,
    warnings: [],
  };
}

function refusedResult(errors) {
  const output_payload = emptyPayload();
  output_payload.domain_errors = errors;
  output_payload.refusal_code = errors[0].split(':')[0];
  const compliance_flags = ['INPUT_REFUSED', output_payload.refusal_code];
  output_payload.warnings = compliance_flags.slice();
  return { output_payload, compliance_flags };
}

function optionalBool(holder, key, errors, path) {
  if (!hasOwn(holder, key)) return false;
  const v = holder[key];
  if (typeof v !== 'boolean') {
    refuse(errors, 'REFUSED_INPUT_TYPE', path + '.' + key + ' must be a boolean when present');
    return false;
  }
  return v;
}

function validate(pp) {
  const errors = [];

  let authority = 'saudi_cma';
  if (hasOwn(pp, 'authority')) {
    if (typeof pp.authority !== 'string') {
      refuse(errors, 'REFUSED_INPUT_TYPE', 'authority must be a string');
    } else if (pp.authority !== 'saudi_cma') {
      refuse(errors, 'AUTHORITY_NOT_PINNED', 'authority ' + pp.authority + ' is not pinned; supported: saudi_cma');
    } else authority = pp.authority;
  }

  let nav = null;
  if (!hasOwn(pp, 'nav_minor_units') || typeof pp.nav_minor_units !== 'number'
      || !Number.isSafeInteger(pp.nav_minor_units) || pp.nav_minor_units < 1) {
    refuse(errors, 'REFUSED_INPUT_NAV', 'nav_minor_units must be a positive safe integer of minor units');
  } else nav = pp.nav_minor_units;

  let liquid = 0;
  if (hasOwn(pp, 'liquid_minor_units')) {
    const v = pp.liquid_minor_units;
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) {
      refuse(errors, 'REFUSED_INPUT_LIQUIDITY', 'liquid_minor_units must be a non-negative safe integer when present');
    } else if (nav !== null && v > nav) {
      refuse(errors, 'REFUSED_INPUT_LIQUIDITY', 'liquid_minor_units must not exceed nav_minor_units');
    } else liquid = v;
  }

  let declaredWal = null;
  if (hasOwn(pp, 'wal_days')) {
    const v = pp.wal_days;
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > MAX_DAYS) {
      refuse(errors, 'REFUSED_INPUT_WAL', 'wal_days must be an integer from 0 to ' + MAX_DAYS + ' when present');
    } else declaredWal = v;
  }

  let holdings = null;
  if (!hasOwn(pp, 'holdings') || !Array.isArray(pp.holdings)
      || pp.holdings.length < 1 || pp.holdings.length > MAX_HOLDINGS) {
    refuse(errors, 'REFUSED_INPUT_HOLDINGS', 'holdings must be an array of 1 to ' + MAX_HOLDINGS + ' records');
  } else {
    holdings = [];
    for (let i = 0; i < pp.holdings.length; i++) {
      const h = pp.holdings[i], path = 'holdings[' + i + ']';
      const before = errors.length;
      if (!isPlainObject(h)) {
        refuse(errors, 'REFUSED_INPUT_TYPE', path + ' must be an object');
        continue;
      }
      let type = null;
      if (!hasOwn(h, 'instrument_type') || typeof h.instrument_type !== 'string' || !TYPES.includes(h.instrument_type)) {
        refuse(errors, 'REFUSED_INSTRUMENT_TYPE', path + '.instrument_type must be exactly one of ' + TYPES.join(', '));
      } else type = h.instrument_type;

      const tokens = {};
      for (const key of ['issuer_token', 'counterparty_token', 'group_token']) {
        const v = hasOwn(h, key) ? h[key] : undefined;
        if (typeof v !== 'string' || !TOKEN_RE.test(v) || PROTO_NAMES.has(v)) {
          refuse(errors, 'REFUSED_IDENTIFIER_LIKE_TOKEN', path + '.' + key + ' must be an opaque lowercase token (letters, digits, underscore; 1 to 32 characters) and not a prototype name');
        } else tokens[key] = v;
      }

      let amount = null, days = null;
      if (!hasOwn(h, 'amount_minor_units') || typeof h.amount_minor_units !== 'number'
          || !Number.isSafeInteger(h.amount_minor_units) || h.amount_minor_units < 1) {
        refuse(errors, 'REFUSED_INPUT_AMOUNT', path + '.amount_minor_units must be a positive safe integer of minor units');
      } else amount = h.amount_minor_units;
      if (!hasOwn(h, 'remaining_maturity_days') || typeof h.remaining_maturity_days !== 'number'
          || !Number.isSafeInteger(h.remaining_maturity_days) || h.remaining_maturity_days < 0
          || h.remaining_maturity_days > MAX_DAYS) {
        refuse(errors, 'REFUSED_INPUT_MATURITY', path + '.remaining_maturity_days must be an integer from 0 to ' + MAX_DAYS);
      } else days = h.remaining_maturity_days;

      const isGovt = optionalBool(h, 'is_saudi_govt', errors, path);
      const isSec = optionalBool(h, 'is_securitisation', errors, path);
      const isHedge = optionalBool(h, 'is_hedging_derivative', errors, path);
      const prudent = optionalBool(h, 'derivative_issuer_prudential', errors, path);
      if (type === 'derivative') {
        if (errors.length === before) {
          if (isHedge !== true) refuse(errors, 'REFUSED_NON_HEDGING_DERIVATIVE', path + ' is a non-hedging derivative, which is not an eligible placement');
          else if (prudent !== true) refuse(errors, 'REFUSED_DERIVATIVE_ISSUER_NOT_PRUDENTIAL', path + ' derivative issuer is not declared subject to prudential rules');
        }
      }
      if (errors.length === before) {
        holdings.push({ type, issuer: tokens.issuer_token, counterparty: tokens.counterparty_token,
          group: tokens.group_token, amount, days, isGovt, isSec });
      }
    }
  }
  return { errors, authority, nav, liquid, declaredWal, holdings };
}

function maxRatioBp(sum, nav) {
  return (sum * 10000n) / nav;
}

function limit(id, usedBp, capBp) {
  const breached = usedBp > capBp;
  return {
    id, unit: 'pct',
    used: pctString(usedBp), cap: pctString(capBp), headroom: pctString(capBp - usedBp),
    used_bp: Number(usedBp), cap_bp: Number(capBp), headroom_bp: Number(capBp - usedBp),
    breached,
  };
}

export function compute(pp) {
  if (!isPlainObject(pp)) return refusedResult(['REFUSED_INPUT_WRONG_TYPE: policy_parameters must be an object']);
  const unhashable = findHashRefusal(pp, 'pp', 1, { maxDepth: PP_MAX_DEPTH, maxElements: PP_MAX_ELEMENTS, n: 0 });
  if (unhashable !== null) return refusedResult([unhashable.reason + ': ' + unhashable.detail]);

  const v = validate(pp);
  if (v.errors.length > 0) return refusedResult(v.errors);

  const nav = BigInt(v.nav);
  const holdings = v.holdings;
  const exempt = (h) => h.isGovt === true && h.type === 'debt_instrument';

  let derivativeSum = 0n, secSum = 0n, fundSum = 0n, shortSum = 0n, weightedSum = 0n, amountSum = 0n;
  let exemptCount = 0, allShort = true;
  const issuerMap = new Map(), counterpartyMap = new Map(), groupMap = new Map();
  const buckets = [];
  for (const b of BUCKETS) buckets.push({ bucket: b[0], lo: b[1], hi: b[2], holdings: 0, amount_minor_units: 0n });

  for (const h of holdings) {
    const amt = BigInt(h.amount);
    amountSum += amt;
    weightedSum += amt * BigInt(h.days);
    if (h.days <= 7) shortSum += amt;
    else allShort = false;
    for (const b of buckets) {
      if (h.days >= b.lo && h.days <= b.hi) {
        b.holdings += 1;
        b.amount_minor_units += amt;
        break;
      }
    }
    if (exempt(h)) { exemptCount += 1; continue; }
    if (h.type === 'derivative') derivativeSum += amt;
    if (h.isSec === true) secSum += amt;
    if (h.type === 'debt_instrument') issuerMap.set(h.issuer, (issuerMap.get(h.issuer) || 0n) + amt);
    counterpartyMap.set(h.counterparty, (counterpartyMap.get(h.counterparty) || 0n) + amt);
    if (!FUND_UNITS.includes(h.type)) groupMap.set(h.group, (groupMap.get(h.group) || 0n) + amt);
    else fundSum += amt;
  }

  const computedScaled = divHalfEven(weightedSum * 10000n, amountSum);
  if (v.declaredWal !== null) {
    const declaredScaled = BigInt(v.declaredWal) * 10000n;
    const diff = declaredScaled > computedScaled ? declaredScaled - computedScaled : computedScaled - declaredScaled;
    if (diff > 10000n) return refusedResult(['REFUSED_WAL_INCONSISTENT: declared wal_days differs from the amount-weighted maturity of the holdings by more than one day']);
  }
  const walScaled = v.declaredWal !== null ? BigInt(v.declaredWal) * 10000n : computedScaled;
  const walCap = WAL_CAP_SCALED;
  const walBreached = walScaled > walCap;
  const walLimit = {
    id: 'wal_180_days', unit: 'days',
    used: daysString(walScaled), cap: daysString(walCap), headroom: daysString(walCap - walScaled),
    used_scaled: Number(walScaled), cap_scaled: Number(walCap), headroom_scaled: Number(walCap - walScaled),
    breached: walBreached,
  };

  const mapMax = (m) => { let best = 0n; for (const val of m.values()) if (val > best) best = val; return best; };
  const liquidBp = maxRatioBp(BigInt(v.liquid), nav);
  const liquidityByMaturities = allShort;
  const liquidityOk = liquidBp >= CAP.liquidity || liquidityByMaturities;

  const limits = [
    limit('derivatives_5pct', maxRatioBp(derivativeSum, nav), CAP.derivative),
    limit('securitisation_10pct', maxRatioBp(secSum, nav), CAP.securitisation),
    limit('single_issuer_10pct', maxRatioBp(mapMax(issuerMap), nav), CAP.issuer),
    limit('single_counterparty_25pct', maxRatioBp(mapMax(counterpartyMap), nav), CAP.counterparty),
    limit('same_group_25pct', maxRatioBp(mapMax(groupMap), nav), CAP.group),
    limit('fund_units_25pct', maxRatioBp(fundSum, nav), CAP.fund_units),
    walLimit,
    {
      id: 'liquidity_10pct', unit: 'pct',
      used: pctString(liquidBp), cap: pctString(CAP.liquidity), headroom: pctString(CAP.liquidity - liquidBp),
      used_bp: Number(liquidBp), cap_bp: Number(CAP.liquidity), headroom_bp: Number(CAP.liquidity - liquidBp),
      breached: !liquidityOk,
    },
  ];

  const compliance_flags = [];
  for (const l of limits) {
    if (!l.breached) continue;
    compliance_flags.push('LIMIT_BREACH');
    compliance_flags.push(l.id.toUpperCase() + '_BREACH');
  }
  if (exemptCount > 0) compliance_flags.push('GOVERNMENT_DEBT_EXEMPT');
  if (liquidityByMaturities && liquidBp < CAP.liquidity) compliance_flags.push('LIQUIDITY_BY_SHORT_MATURITIES');

  const output_payload = {
    not_a_shariah_ruling: true,
    valid_input: true,
    domain_errors: [],
    refusal_code: null,
    authority: v.authority,
    nav_minor_units: v.nav,
    limits,
    overall_breached: limits.some((l) => l.breached),
    placement_ladder: buckets.map((b) => ({
      bucket: b.bucket, holdings: b.holdings,
      amount_minor_units: b.amount_minor_units.toString(),
      pct_of_nav: pctString(maxRatioBp(b.amount_minor_units, nav)),
    })),
    reminders: [{ id: 'stress_test_frequency', text: 'Perform a stress test at least twice a year; frequency reminder only, not computed.' }],
    exempt_holdings_count: exemptCount,
    liquidity_met_by_short_maturities: liquidityByMaturities,
    computed_wal_days: daysString(computedScaled),
    wal_days_source: v.declaredWal !== null ? 'declared' : 'computed',
    warnings: compliance_flags.slice(),
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'preimage', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  const artifact = {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now,
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
