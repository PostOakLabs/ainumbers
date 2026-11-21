import { executionHash } from './_hash.mjs';

// art-852-murabahah-ibra-settlement — deferred-price schedule for a sale with a fixed
// mark-up, the rebate on early settlement, and the branch refusals that keep the arithmetic
// from being mistaken for a ruling. Pure integer arithmetic in minor units; no clock, no
// network, no filesystem, no cross-kernel imports.

const TOOL_ID = 'art-852-murabahah-ibra-settlement';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_murabahah_ibra_settlement',
  mandate_type: 'compliance_control', gpu: false,
};

const HASH_MAX_DEPTH = 512;
const HASH_MAX_ELEMENTS = 1000000;
const PP_MAX_DEPTH = HASH_MAX_DEPTH - 8;
const PP_MAX_ELEMENTS = 199000;
const RATE_DENOMINATOR = 120000n; // 12 months x 10000 basis points
const MAX_TENOR = 360;
const MAX_EPR_PERIODS = 24;
const MAX_CHARGES = 16;

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

function intField(errors, value, label, opts) {
  if (value === undefined) { refuse(errors, 'REFUSED_FIELD_MISSING', label + ' is required'); return null; }
  const v = value;
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) { refuse(errors, 'REFUSED_FIELD_TYPE', label + ' must be a safe integer'); return null; }
  if (opts && opts.min !== undefined && v < opts.min) { refuse(errors, 'REFUSED_FIELD_RANGE', label + ' is below its bound'); return null; }
  if (opts && opts.max !== undefined && v > opts.max) { refuse(errors, 'REFUSED_FIELD_RANGE', label + ' is above its bound'); return null; }
  return v;
}

function optIntField(errors, value, label, opts) {
  if (value === undefined) return null;
  return intField(errors, value, label, opts);
}

/**
 * Round-half-even of num / den for BigInt inputs.
 * @param {bigint} num
 * @param {bigint} den
 * @returns {bigint}
 */
function divHalfEven(num, den) {
  const neg = num < 0n;
  const a = neg ? -num : num;
  let q = a / den;
  const r = a % den;
  const twice = r * 2n;
  if (twice > den || (twice === den && q % 2n === 1n)) q += 1n;
  return neg ? -q : q;
}

const ALLOWED_KEYS = new Set([
  'authority', 'cost_of_purchase_minor', 'cpr_bp', 'tenor_months', 'instalment_minor',
  'selling_price_minor', 'selling_price_stated_minor', 'epr_periods', 'settlement_month',
  'instalment_due_minor', 'early_settlement_charges', 'late_payment_minor',
  'non_delivery', 'conventional_loan',
]);
const PERMITTED_COST_TYPES = ['unrecovered_discount', 'unrecovered_initial_cost'];
const SUPPORTED_AUTHORITIES = ['bnm'];

const ALLOWED_EPR_KEYS = new Set(['from_month', 'epr_bp', 'instalment_minor']);
const ALLOWED_CHARGE_KEYS = new Set(['cost_type', 'amount_minor']);
const ALLOWED_NONDELIVERY_KEYS = new Set(['undisbursed_principal_minor', 'first_sign_month']);
const ALLOWED_CONVENTIONAL_KEYS = new Set(['principal_minor', 'annual_rate_bp', 'tawidh_minor', 'gharamah_minor']);

function unknownKeys(obj, allowed, label, errors) {
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) refuse(errors, 'REFUSED_FIELD_NOT_ALLOWED', label + '.' + k);
  }
}

function validate(pp) {
  const errors = [];
  unknownKeys(pp, ALLOWED_KEYS, 'policy_parameters', errors);

  if (!hasOwn(pp, 'authority') || typeof pp.authority !== 'string') {
    refuse(errors, 'REFUSED_AUTHORITY_NOT_PINNED', 'authority must name a supported profile');
  } else if (!SUPPORTED_AUTHORITIES.includes(pp.authority)) {
    refuse(errors, 'REFUSED_AUTHORITY_NOT_PINNED', 'authority "' + pp.authority + '" is not supported; supported: ' + SUPPORTED_AUTHORITIES.join(', '));
  }

  const cop = intField(errors, pp.cost_of_purchase_minor, 'cost_of_purchase_minor', { min: 1 });
  const cpr = intField(errors, pp.cpr_bp, 'cpr_bp', { min: 0, max: 100000 });
  const tenor = intField(errors, pp.tenor_months, 'tenor_months', { min: 1, max: MAX_TENOR });
  const instalment = intField(errors, pp.instalment_minor, 'instalment_minor', { min: 1 });
  const sellingPrice = intField(errors, pp.selling_price_minor, 'selling_price_minor', { min: 0 });
  const stated = optIntField(errors, pp.selling_price_stated_minor, 'selling_price_stated_minor', { min: 0 });
  if (cop !== null && sellingPrice !== null && sellingPrice < cop) {
    refuse(errors, 'REFUSED_FIELD_RANGE', 'selling_price_minor must not be below cost_of_purchase_minor');
  }
  if (stated !== null && sellingPrice !== null && stated < sellingPrice) {
    refuse(errors, 'REFUSED_FIELD_RANGE', 'selling_price_stated_minor must not be below selling_price_minor');
  }

  let eprPeriods = null;
  if (hasOwn(pp, 'epr_periods')) {
    const raw = pp.epr_periods;
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_EPR_PERIODS) {
      refuse(errors, 'REFUSED_EPR_PERIOD_INVALID', 'epr_periods must be an array of 1 to ' + MAX_EPR_PERIODS + ' periods');
    } else {
      eprPeriods = [];
      let prevMonth = 0;
      for (let i = 0; i < raw.length; i++) {
        const r = raw[i];
        if (!isPlainObject(r)) { refuse(errors, 'REFUSED_EPR_PERIOD_INVALID', 'epr_periods[' + i + '] must be an object'); continue; }
        unknownKeys(r, ALLOWED_EPR_KEYS, 'epr_periods[' + i + ']', errors);
        const from = intField(errors, r.from_month, 'epr_periods[' + i + '].from_month', { min: 1, max: tenor === null ? MAX_TENOR : tenor });
        const bp = intField(errors, r.epr_bp, 'epr_periods[' + i + '].epr_bp', { min: 0, max: 100000 });
        const ins = intField(errors, r.instalment_minor, 'epr_periods[' + i + '].instalment_minor', { min: 1 });
        if (from !== null) {
          if (i === 0 && from !== 1) refuse(errors, 'REFUSED_EPR_PERIOD_INVALID', 'the first epr_period starts at month 1');
          if (from <= prevMonth) refuse(errors, 'REFUSED_EPR_PERIOD_INVALID', 'epr_periods from_month values must strictly increase');
          prevMonth = from;
        }
        if (from !== null && bp !== null && ins !== null) eprPeriods.push({ from, bp, ins });
      }
    }
  }

  const settlement = optIntField(errors, pp.settlement_month, 'settlement_month', { min: 1, max: tenor === null ? MAX_TENOR : tenor });
  const due = optIntField(errors, pp.instalment_due_minor, 'instalment_due_minor', { min: 0 });
  const late = optIntField(errors, pp.late_payment_minor, 'late_payment_minor', { min: 0 });

  const charges = [];
  const refusedChargeCodes = [];
  if (hasOwn(pp, 'early_settlement_charges')) {
    const raw = pp.early_settlement_charges;
    if (!Array.isArray(raw) || raw.length > MAX_CHARGES) {
      refuse(errors, 'REFUSED_CHARGE_LIST_INVALID', 'early_settlement_charges must be an array of at most ' + MAX_CHARGES + ' items');
    } else {
      for (let i = 0; i < raw.length; i++) {
        const r = raw[i];
        if (!isPlainObject(r)) { refuse(errors, 'REFUSED_CHARGE_LIST_INVALID', 'early_settlement_charges[' + i + '] must be an object'); continue; }
        unknownKeys(r, ALLOWED_CHARGE_KEYS, 'early_settlement_charges[' + i + ']', errors);
        const ct = r.cost_type;
        if (typeof ct !== 'string') { refuse(errors, 'REFUSED_CHARGE_TYPE', 'cost_type must be a string'); continue; }
        if (ct === 'lost_profit') { refuse(errors, 'REFUSED_CHARGE_LOST_PROFIT', 'lost_profit is not a recoverable cost type'); refusedChargeCodes.push('CHARGE_LOST_PROFIT_REFUSED'); continue; }
        if (ct === 'marketing') { refuse(errors, 'REFUSED_CHARGE_MARKETING', 'marketing is not a recoverable cost type'); refusedChargeCodes.push('CHARGE_MARKETING_REFUSED'); continue; }
        if (!PERMITTED_COST_TYPES.includes(ct)) { refuse(errors, 'REFUSED_CHARGE_TYPE', 'cost_type "' + ct + '" is not in the allowed set'); continue; }
        const amount = intField(errors, r.amount_minor, 'early_settlement_charges[' + i + '].amount_minor', { min: 0 });
        if (amount !== null) charges.push({ cost_type: ct, amount_minor: amount });
      }
    }
  }

  let nonDelivery = null;
  if (hasOwn(pp, 'non_delivery')) {
    const r = pp.non_delivery;
    if (!isPlainObject(r)) {
      refuse(errors, 'REFUSED_NON_DELIVERY_INVALID', 'non_delivery must be an object');
    } else {
      unknownKeys(r, ALLOWED_NONDELIVERY_KEYS, 'non_delivery', errors);
      const und = intField(errors, r.undisbursed_principal_minor, 'non_delivery.undisbursed_principal_minor', { min: 0 });
      const first = intField(errors, r.first_sign_month, 'non_delivery.first_sign_month', { min: 1, max: tenor === null ? MAX_TENOR : tenor });
      if (und !== null && cop !== null && und > cop) refuse(errors, 'REFUSED_NON_DELIVERY_INVALID', 'undisbursed_principal_minor exceeds cost_of_purchase_minor');
      nonDelivery = { und, first };
    }
  }

  let conventional = null;
  if (hasOwn(pp, 'conventional_loan')) {
    const r = pp.conventional_loan;
    if (!isPlainObject(r)) {
      refuse(errors, 'REFUSED_CONVENTIONAL_INVALID', 'conventional_loan must be an object');
    } else {
      unknownKeys(r, ALLOWED_CONVENTIONAL_KEYS, 'conventional_loan', errors);
      const principal = intField(errors, r.principal_minor, 'conventional_loan.principal_minor', { min: 1 });
      const rate = intField(errors, r.annual_rate_bp, 'conventional_loan.annual_rate_bp', { min: 0, max: 100000 });
      const tawidh = intField(errors, r.tawidh_minor, 'conventional_loan.tawidh_minor', { min: 0 });
      const gharamah = intField(errors, r.gharamah_minor, 'conventional_loan.gharamah_minor', { min: 0 });
      conventional = { principal, rate, tawidh, gharamah };
    }
  }

  if (nonDelivery !== null && settlement === null) {
    refuse(errors, 'REFUSED_NON_DELIVERY_INVALID', 'non_delivery requires settlement_month');
  }
  if (nonDelivery !== null && nonDelivery.first !== null && settlement !== null && nonDelivery.first > settlement) {
    refuse(errors, 'REFUSED_NON_DELIVERY_INVALID', 'first_sign_month must not be after settlement_month');
  }

  return { errors, cop, cpr, tenor, instalment, sellingPrice, stated, eprPeriods, settlement, due, late, charges, refusedChargeCodes, nonDelivery, conventional };
}

function emptyPayload() {
  return {
    valid_input: false, domain_errors: [], refusal_code: null,
    not_a_shariah_ruling: true, authority: null, authority_profile: null,
    cost_of_purchase_minor: null, contracted_rate_bp: null, tenor_months: null,
    instalment_minor: null, selling_price_minor: null, selling_price_stated_minor: null,
    selling_price_residual_minor: null, markup_minor: null, profit_rounding: 'half-even',
    schedule: [], settlement: null, non_delivery: null, conventional_comparison: null,
    refused_cost_types: [], variable_rate_applied: false, warnings: [],
  };
}

function refusedResult(errors, refusedChargeCodes) {
  const output_payload = emptyPayload();
  output_payload.domain_errors = errors;
  output_payload.refusal_code = errors.length > 0 ? errors[0].split(':')[0] : 'REFUSED_UNKNOWN';
  output_payload.refused_cost_types = refusedChargeCodes || [];
  const compliance_flags = [];
  if (errors.length > 0) compliance_flags.push('INPUT_REFUSED');
  for (const c of refusedChargeCodes || []) compliance_flags.push(c);
  if (errors.some((e) => e.indexOf('REFUSED_AUTHORITY_NOT_PINNED') === 0)) compliance_flags.push('AUTHORITY_NOT_PINNED');
  output_payload.warnings = compliance_flags.slice();
  return { output_payload, compliance_flags };
}

function periodAt(periods, month) {
  if (periods === null) return null;
  let found = null;
  for (let i = 0; i < periods.length; i++) if (periods[i].from <= month) found = periods[i];
  return found;
}

export function compute(pp) {
  if (!isPlainObject(pp)) return refusedResult(['REFUSED_INPUT_WRONG_TYPE: policy_parameters must be an object'], []);
  const unhashable = findHashRefusal(pp, 'pp', 1, { maxDepth: PP_MAX_DEPTH, maxElements: PP_MAX_ELEMENTS, n: 0 });
  if (unhashable !== null) return refusedResult([unhashable.reason + ': ' + unhashable.detail], []);

  const v = validate(pp);
  if (v.errors.length > 0) return refusedResult(v.errors, v.refusedChargeCodes);

  const compliance_flags = [];
  const cop0 = BigInt(v.cop);
  const cpr = BigInt(v.cpr);
  const instalment = BigInt(v.instalment);
  const sellingPrice = BigInt(v.sellingPrice);
  let cop = cop0;
  const schedule = [];
  let accruedProfit = 0n;
  let variable = false;

  for (let k = 1; k <= v.tenor; k++) {
    const period = periodAt(v.eprPeriods, k);
    const profit = divHalfEven(cop * cpr, RATE_DENOMINATOR);
    const copPayment = instalment - profit;
    const copBefore = cop;
    cop = cop - copPayment;
    accruedProfit += profit;
    const outstandingSP = sellingPrice - instalment * BigInt(k);
    const deferred = outstandingSP - cop;
    const row = {
      month: k,
      instalment_minor: v.instalment,
      profit_minor: Number(profit),
      cop_payment_minor: Number(copPayment),
      outstanding_cop_minor: Number(cop),
      outstanding_selling_price_minor: Number(outstandingSP),
      deferred_profit_minor: Number(deferred),
    };
    if (period !== null) {
      variable = true;
      const eprProfit = divHalfEven(copBefore * BigInt(period.bp), RATE_DENOMINATOR);
      row.epr_instalment_minor = period.ins;
      row.epr_rate_bp = period.bp;
      row.epr_profit_minor = Number(eprProfit);
      row.period_ibra_minor = Number(profit - eprProfit);
    }
    schedule.push(row);
  }
  if (variable) compliance_flags.push('VARIABLE_RATE_APPLIED');

  let settlement = null;
  if (v.settlement !== null) {
    const row = schedule[v.settlement - 1];
    const deferred = BigInt(row.deferred_profit_minor);
    const permitted = v.charges.reduce((a, c) => a + BigInt(c.amount_minor), 0n);
    if (permitted > deferred) return refusedResult(['REFUSED_CHARGES_EXCEED_DEFERRED_PROFIT: permitted recovery costs exceed the deferred profit at the settlement point'], v.refusedChargeCodes);
    const ibra = deferred - permitted;
    const due = v.due === null ? 0n : BigInt(v.due);
    const late = v.late === null ? 0n : BigInt(v.late);
    const amount = BigInt(row.outstanding_selling_price_minor) + due + late - ibra;
    settlement = {
      settlement_month: v.settlement,
      outstanding_selling_price_minor: row.outstanding_selling_price_minor,
      outstanding_cop_minor: row.outstanding_cop_minor,
      deferred_profit_minor: Number(deferred),
      ibra_minor: Number(ibra),
      permitted_charges_minor: Number(permitted),
      charges_applied: v.charges,
      instalment_due_minor: Number(due),
      late_payment_minor: Number(late),
      settlement_amount_minor: Number(amount),
    };
    compliance_flags.push('EARLY_SETTLEMENT_APPLIED');
    if (late > 0n) compliance_flags.push('LATE_PAYMENT_PASSTHROUGH');
  }

  let nonDelivery = null;
  if (v.nonDelivery !== null) {
    const at = schedule[v.nonDelivery.first - 1];
    const row = schedule[v.settlement - 1];
    const und = BigInt(v.nonDelivery.und);
    const deferred = BigInt(row.deferred_profit_minor);
    const permitted = v.charges.reduce((a, c) => a + BigInt(c.amount_minor), 0n);
    if (permitted > deferred + und) return refusedResult(['REFUSED_CHARGES_EXCEED_DEFERRED_PROFIT: permitted recovery costs exceed the rebate available on settlement'], v.refusedChargeCodes);
    const profitWaived = accruedProfit - BigInt(at.profit_minor > 0 ? at.profit_minor : 0);
    const ibra = deferred + und - permitted;
    const due = v.due === null ? 0n : BigInt(v.due);
    const late = v.late === null ? 0n : BigInt(v.late);
    const amount = BigInt(row.outstanding_selling_price_minor) + due + late - ibra;
    nonDelivery = {
      first_sign_month: v.nonDelivery.first,
      undisbursed_principal_minor: Number(und),
      profit_accrued_to_first_sign_minor: at.profit_minor,
      profit_waived_minor: Number(profitWaived < 0n ? 0n : profitWaived),
      ibra_on_undisbursed_minor: Number(und),
      ibra_on_deferred_profit_minor: Number(deferred),
      ibra_total_minor: Number(ibra),
      settlement_amount_minor: Number(amount),
    };
    compliance_flags.push('NON_DELIVERY_APPLIED');
  }

  let conventional = null;
  if (v.conventional !== null) {
    const rate = BigInt(v.conventional.rate);
    const firstInterest = divHalfEven(BigInt(v.conventional.principal) * rate, RATE_DENOMINATOR);
    conventional = {
      principal_minor: v.conventional.principal,
      annual_rate_bp: v.conventional.rate,
      first_period_interest_minor: Number(firstInterest),
      tawidh_minor: v.conventional.tawidh,
      gharamah_minor: v.conventional.gharamah,
      late_payment_accrues_interest: false,
      cash_flows_equal_note: 'equal dated cash flows do not make equal contracts',
    };
    compliance_flags.push('CONVENTIONAL_COMPARISON_ADDED');
  }

  const stated = v.stated === null ? v.sellingPrice : v.stated;
  const residual = BigInt(stated) - sellingPrice;
  const output_payload = {
    valid_input: true,
    domain_errors: [],
    refusal_code: null,
    not_a_shariah_ruling: true,
    authority: pp.authority,
    authority_profile: pp.authority,
    cost_of_purchase_minor: v.cop,
    contracted_rate_bp: v.cpr,
    tenor_months: v.tenor,
    instalment_minor: v.instalment,
    selling_price_minor: v.sellingPrice,
    selling_price_stated_minor: stated,
    selling_price_residual_minor: Number(residual),
    markup_minor: Number(sellingPrice - cop0),
    profit_rounding: 'half-even',
    schedule,
    settlement,
    non_delivery: nonDelivery,
    conventional_comparison: conventional,
    refused_cost_types: v.refusedChargeCodes,
    variable_rate_applied: variable,
    warnings: compliance_flags.slice(),
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'root', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
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
