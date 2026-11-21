import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-856-ijarah-imbt-schedule';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_ijarah_imbt_schedule',
  mandate_type: 'compliance_control', gpu: false,
};

const MAX_TENOR = 360;
const MAX_ASSET = 1000000000000000;
const MAX_MONTHLY = 1000000000000;
const MAX_BP = 100000;
const MAX_REVISIONS = 12;
const HASH_MAX_DEPTH = 512;
const HASH_MAX_ELEMENTS = 1000000;
const PP_MAX_DEPTH = HASH_MAX_DEPTH - 8;
const PP_MAX_ELEMENTS = 199000;

const RENTAL_DENOM = 120000n;

const BASES = ['fixed', 'benchmark', 'hybrid'];
const TRANSFER_MODES = ['sale', 'conditional_hibah', 'wad_to_hibah'];
const EXCEPTIONS = ['not_offered', 'rejected_by_all_operators', 'more_competitive_cost'];
const WAD_TRIGGERS = ['default', 'breach', 'mutual_agreement', 'voluntary_early_purchase'];
const WAD_ALLOWED = ['default', 'breach'];
const AUTHORITY = 'bnm_malaysia';

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

/**
 * Round-half-even of a non-negative BigInt quotient.
 * @param {bigint} num
 * @param {bigint} den
 * @returns {bigint}
 */
function divHalfEven(num, den) {
  const q = num / den, r = num % den, twice = r * 2n;
  if (twice > den) return q + 1n;
  if (twice < den) return q;
  return q % 2n === 0n ? q : q + 1n;
}

function moneyString(v) {
  const neg = v < 0n;
  const a = neg ? -v : v;
  return (neg ? '-' : '') + a.toString();
}

function readAmount(holder, key, errors, path, opts) {
  if (!hasOwn(holder, key) || holder[key] === null) {
    if (opts.required) refuse(errors, opts.code, path + '.' + key + ' is required');
    return null;
  }
  const v = holder[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < (opts.min !== undefined ? opts.min : 0) || v > (opts.max !== undefined ? opts.max : MAX_MONTHLY)) {
    refuse(errors, opts.code, path + '.' + key + ' must be an integer' + (opts.max !== undefined ? ' up to ' + opts.max : '') + (opts.min ? ' of at least ' + opts.min : ' of at least 0') + ' when present');
    return null;
  }
  return v;
}

function readEnum(holder, key, allowed, errors, path, opts) {
  if (!hasOwn(holder, key) || holder[key] === null) {
    if (opts.required) refuse(errors, opts.code, path + '.' + key + ' is required and must be exactly one of ' + allowed.join(', '));
    return null;
  }
  const v = holder[key];
  if (typeof v !== 'string' || !allowed.includes(v)) {
    refuse(errors, opts.code, path + '.' + key + ' must be exactly one of ' + allowed.join(', '));
    return null;
  }
  return v;
}

function optionalBool(holder, key, errors, path) {
  if (!hasOwn(holder, key) || holder[key] === null) return null;
  const v = holder[key];
  if (typeof v !== 'boolean') {
    refuse(errors, 'REFUSED_INPUT_TYPE', path + '.' + key + ' must be a boolean when present');
    return null;
  }
  return v;
}

function emptyPayload() {
  return {
    not_a_shariah_ruling: true,
    valid_input: false,
    domain_errors: [],
    refusal_code: null,
    authority: null,
    asset_cost_minor_units: null,
    tenor_months: null,
    rental_basis: null,
    rounding_rule: null,
    schedule: [],
    totals: null,
    total_loss: null,
    transfer: null,
    exception_used: null,
    mutual_revision_agreed: null,
    warnings: [],
  };
}

function refusedResult(errors) {
  const output_payload = emptyPayload();
  output_payload.domain_errors = errors;
  output_payload.refusal_code = errors[0].split(':')[0];
  const compliance_flags = [];
  if (errors.length > 0) compliance_flags.push('INPUT_REFUSED', output_payload.refusal_code);
  output_payload.warnings = compliance_flags.slice();
  return { output_payload, compliance_flags };
}

function validate(pp) {
  const errors = [];

  let authority = AUTHORITY;
  if (hasOwn(pp, 'authority') && pp.authority !== null) {
    if (typeof pp.authority !== 'string') {
      refuse(errors, 'REFUSED_INPUT_TYPE', 'authority must be a string');
    } else if (pp.authority !== AUTHORITY) {
      refuse(errors, 'AUTHORITY_NOT_PINNED', 'authority ' + pp.authority + ' is not pinned; supported: ' + AUTHORITY);
    } else authority = pp.authority;
  }

  const assetCost = readAmount(pp, 'asset_cost_minor_units', errors, 'pp',
    { required: true, code: 'REFUSED_INPUT_ASSET_COST', min: 1, max: MAX_ASSET });
  const tenor = readAmount(pp, 'tenor_months', errors, 'pp',
    { required: true, code: 'REFUSED_INPUT_TENOR', min: 1, max: MAX_TENOR });
  const basis = readEnum(pp, 'rental_basis', BASES, errors, 'pp',
    { required: true, code: 'REFUSED_INPUT_BASIS' });
  const transferMode = readEnum(pp, 'transfer_mode', TRANSFER_MODES, errors, 'pp',
    { required: true, code: 'REFUSED_INPUT_TRANSFER_MODE' });

  let marginBp = null;
  if (basis === 'fixed' || basis === 'benchmark') {
    marginBp = readAmount(pp, 'margin_bp', errors, 'pp',
      { required: true, code: 'REFUSED_INPUT_MARGIN', min: 0, max: MAX_BP });
  } else if (hasOwn(pp, 'margin_bp') && pp.margin_bp !== null) {
    if (typeof pp.margin_bp !== 'number' || !Number.isSafeInteger(pp.margin_bp) || pp.margin_bp < 0 || pp.margin_bp > MAX_BP) {
      refuse(errors, 'REFUSED_INPUT_MARGIN', 'pp.margin_bp must be an integer from 0 to ' + MAX_BP + ' when present');
    } else marginBp = pp.margin_bp;
  }

  const hasFloor = hasOwn(pp, 'floor_rental_minor_units') && pp.floor_rental_minor_units !== null;
  const hasCap = hasOwn(pp, 'cap_rental_minor_units') && pp.cap_rental_minor_units !== null;
  let floor = null, cap = null;
  if (basis === 'benchmark' || basis === 'hybrid') {
    if (!hasFloor || !hasCap) {
      refuse(errors, 'REFUSED_BENCHMARK_BOUNDS_MISSING', 'a benchmark-determined rental requires both floor_rental_minor_units and cap_rental_minor_units');
    } else {
      floor = readAmount(pp, 'floor_rental_minor_units', errors, 'pp', { code: 'REFUSED_INPUT_FLOOR', max: MAX_MONTHLY });
      cap = readAmount(pp, 'cap_rental_minor_units', errors, 'pp', { code: 'REFUSED_INPUT_CAP', max: MAX_MONTHLY });
      if (floor !== null && cap !== null && floor > cap) {
        refuse(errors, 'REFUSED_FLOOR_EXCEEDS_CAP', 'floor_rental_minor_units must not exceed cap_rental_minor_units');
      }
    }
  } else if (hasFloor || hasCap) {
    refuse(errors, 'REFUSED_INPUT_INCONSISTENT', 'floor_rental_minor_units and cap_rental_minor_units apply only to a benchmark or hybrid rental basis');
  }

  let benchmarkPath = null;
  const hasPath = hasOwn(pp, 'benchmark_path_bp') && pp.benchmark_path_bp !== null;
  if (basis === 'benchmark' || basis === 'hybrid') {
    if (!hasPath || !Array.isArray(pp.benchmark_path_bp) || pp.benchmark_path_bp.length !== tenor) {
      refuse(errors, 'REFUSED_INPUT_BENCHMARK_PATH', 'benchmark_path_bp must be an array with exactly tenor_months = ' + tenor + ' monthly values');
    } else {
      benchmarkPath = [];
      for (let i = 0; i < pp.benchmark_path_bp.length; i++) {
        const v = pp.benchmark_path_bp[i];
        if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > MAX_BP) {
          refuse(errors, 'REFUSED_INPUT_BENCHMARK_PATH', 'benchmark_path_bp[' + i + '] must be an integer from 0 to ' + MAX_BP);
          benchmarkPath = null;
          break;
        }
        benchmarkPath.push(v);
      }
    }
  } else if (hasPath) {
    refuse(errors, 'REFUSED_INPUT_INCONSISTENT', 'benchmark_path_bp applies only to a benchmark or hybrid rental basis');
  }

  let fixedComponent = null;
  if (basis === 'hybrid') {
    if (!hasOwn(pp, 'fixed_component_minor_units') || pp.fixed_component_minor_units === null) {
      refuse(errors, 'REFUSED_INPUT_FIXED_COMPONENT', 'pp.fixed_component_minor_units is required for a hybrid rental basis');
    } else fixedComponent = readAmount(pp, 'fixed_component_minor_units', errors, 'pp', { code: 'REFUSED_INPUT_FIXED_COMPONENT', max: MAX_MONTHLY });
  } else if (hasOwn(pp, 'fixed_component_minor_units') && pp.fixed_component_minor_units !== null) {
    refuse(errors, 'REFUSED_INPUT_INCONSISTENT', 'fixed_component_minor_units applies only to a hybrid rental basis');
  }

  const maintenance = readAmount(pp, 'maintenance_minor_units_per_month', errors, 'pp', { code: 'REFUSED_INPUT_MAINTENANCE' });
  const takaful = readAmount(pp, 'takaful_minor_units_per_month', errors, 'pp', { code: 'REFUSED_INPUT_TAKAFUL' });
  const insurance = readAmount(pp, 'insurance_minor_units_per_month', errors, 'pp', { code: 'REFUSED_INPUT_INSURANCE' });

  const exception = readEnum(pp, 'conventional_insurance_exception', EXCEPTIONS, errors, 'pp',
    { code: 'REFUSED_INPUT_EXCEPTION' });

  const takafulPresent = takaful !== null;
  const exceptionSet = exception !== null;
  const insurancePresent = insurance !== null;
  if (takafulPresent && exceptionSet) {
    refuse(errors, 'REFUSED_TAKAFUL_CONFLICT', 'conventional_insurance_exception applies only when no takaful line is declared');
  }
  if (exceptionSet && !insurancePresent) {
    refuse(errors, 'REFUSED_INPUT_INSURANCE', 'insurance_minor_units_per_month is required when conventional_insurance_exception is set');
  }
  if (!takafulPresent && !exceptionSet) {
    refuse(errors, 'REFUSED_TAKAFUL_MISSING', 'a schedule requires a takaful line (takaful_minor_units_per_month) or a declared conventional_insurance_exception with its insurance line');
  }

  const lossMonth = readAmount(pp, 'total_loss_month', errors, 'pp', { code: 'REFUSED_INPUT_LOSS_MONTH', min: 1 });
  const fault = optionalBool(pp, 'lessee_fault', errors, 'pp');
  const recovery = readAmount(pp, 'takaful_recovery_minor_units', errors, 'pp', { code: 'REFUSED_INPUT_RECOVERY' });
  if (lossMonth !== null && tenor !== null && lossMonth > tenor) {
    refuse(errors, 'REFUSED_INPUT_LOSS_MONTH', 'total_loss_month must fall within the tenor');
  }
  if (fault !== null && lossMonth === null) {
    refuse(errors, 'REFUSED_INPUT_FAULT_FLAG', 'lessee_fault applies only together with total_loss_month');
  }
  if (recovery !== null && lossMonth === null) {
    refuse(errors, 'REFUSED_INPUT_RECOVERY', 'takaful_recovery_minor_units applies only together with total_loss_month');
  }

  let transferPrice = null;
  if (transferMode === 'sale') {
    transferPrice = readAmount(pp, 'transfer_price_minor_units', errors, 'pp',
      { required: true, code: 'REFUSED_INPUT_TRANSFER_PRICE', max: MAX_ASSET });
  } else if (hasOwn(pp, 'transfer_price_minor_units') && pp.transfer_price_minor_units !== null) {
    refuse(errors, 'REFUSED_INPUT_INCONSISTENT', 'transfer_price_minor_units applies only to the sale transfer mode');
  }

  const trigger = readEnum(pp, 'wad_purchase_trigger', WAD_TRIGGERS, errors, 'pp',
    { code: 'REFUSED_INPUT_TRIGGER' });
  if (trigger !== null && !WAD_ALLOWED.includes(trigger)) {
    refuse(errors, 'REFUSED_WAD_TRIGGER', 'wad_purchase_trigger ' + trigger + ' cannot trigger a wa\'d to purchase; only default or breach of terms may');
  }

  const mutualRevision = optionalBool(pp, 'mutual_revision_agreed', errors, 'pp');
  let revisions = null;
  if (hasOwn(pp, 'rental_revisions') && pp.rental_revisions !== null) {
    if (!Array.isArray(pp.rental_revisions) || pp.rental_revisions.length < 1 || pp.rental_revisions.length > MAX_REVISIONS) {
      refuse(errors, 'REFUSED_INPUT_REVISIONS', 'rental_revisions must be an array of 1 to ' + MAX_REVISIONS + ' records when present');
    } else if (mutualRevision !== true) {
      refuse(errors, 'REFUSED_UNILATERAL_RENTAL_INCREASE', 'a rental revision requires mutual_revision_agreed: true; the lessor must not raise the rental unilaterally');
    } else {
      revisions = [];
      const months = new Map();
      for (let i = 0; i < pp.rental_revisions.length; i++) {
        const r = pp.rental_revisions[i], path = 'rental_revisions[' + i + ']';
        if (!isPlainObject(r)) {
          refuse(errors, 'REFUSED_INPUT_REVISIONS', path + ' must be an object');
          revisions = null;
          break;
        }
        const month = readAmount(r, 'month', errors, path, { code: 'REFUSED_INPUT_REVISIONS', min: 1, max: MAX_TENOR });
        const amount = readAmount(r, 'rental_minor_units', errors, path, { code: 'REFUSED_INPUT_REVISIONS', min: 0 });
        if (month !== null && tenor !== null && month > tenor) {
          refuse(errors, 'REFUSED_INPUT_REVISIONS', path + '.month must fall within the tenor');
        }
        if (month !== null) {
          if (months.has(month)) {
            refuse(errors, 'REFUSED_INPUT_REVISIONS', 'two rental_revisions records target month ' + month);
            revisions = null;
            break;
          }
          months.set(month, amount);
        }
        if (month === null || amount === null) { revisions = null; break; }
        revisions.push({ month, amount });
      }
    }
  }

  return { errors, authority, assetCost, tenor, basis, transferMode, marginBp, floor, cap,
    benchmarkPath, fixedComponent, maintenance, takaful, insurance, exception, insurancePresent,
    lossMonth, fault, recovery, transferPrice, trigger, mutualRevision, revisions };
}

function clampBp(rawBp, floor, cap, row) {
  if (rawBp < floor) { row.rental_minor_units = BigInt(floor); row.clamped_to_floor = true; return; }
  if (rawBp > cap) { row.rental_minor_units = BigInt(cap); row.clamped_to_cap = true; return; }
  row.rental_minor_units = rawBp;
}

export function compute(pp) {
  if (!isPlainObject(pp)) return refusedResult(['REFUSED_INPUT_WRONG_TYPE: policy_parameters must be an object']);
  const unhashable = findHashRefusal(pp, 'pp', 1, { maxDepth: PP_MAX_DEPTH, maxElements: PP_MAX_ELEMENTS, n: 0 });
  if (unhashable !== null) return refusedResult([unhashable.reason + ': ' + unhashable.detail]);

  const v = validate(pp);
  if (v.errors.length > 0) return refusedResult(v.errors);

  const cost = BigInt(v.assetCost);
  const tenor = v.tenor;
  const compliance_flags = [];

  const schedule = [];
  const revisionByMonth = new Map();
  if (v.revisions !== null) {
    for (const r of v.revisions) revisionByMonth.set(r.month, BigInt(r.amount));
    compliance_flags.push('RENTAL_REVISION_APPLIED');
  }

  let scheduledTotal = 0n, payableTotal = 0n;
  let maintenanceTotal = 0n, protectionTotal = 0n;
  const perMaintenance = BigInt(v.maintenance !== null ? v.maintenance : 0);
  const perProtection = BigInt(v.takaful !== null ? v.takaful : (v.insurancePresent ? v.insurance : 0));
  let floorMonths = 0, capMonths = 0;

  for (let m = 1; m <= tenor; m++) {
    const row = { month: m, benchmark_bp: null, clamped_to_floor: false, clamped_to_cap: false };
    if (v.basis === 'fixed') {
      row.rental_minor_units = divHalfEven(cost * BigInt(v.marginBp), RENTAL_DENOM);
    } else {
      const bp = v.benchmarkPath[m - 1];
      row.benchmark_bp = bp;
      const raw = divHalfEven(cost * BigInt((v.basis === 'benchmark' ? v.marginBp : (v.marginBp !== null ? v.marginBp : 0)) + bp), RENTAL_DENOM);
      clampBp(raw, BigInt(v.floor), BigInt(v.cap), row);
      if (row.clamped_to_floor) floorMonths += 1;
      if (row.clamped_to_cap) capMonths += 1;
    }
    if (v.basis === 'hybrid') row.rental_minor_units += BigInt(v.fixedComponent);
    if (revisionByMonth.has(m)) row.rental_minor_units = revisionByMonth.get(m);

    const lossStopsRent = v.lossMonth !== null && v.fault !== true && m >= v.lossMonth;
    row.lessor_maintenance_minor_units = moneyString(perMaintenance);
    row.lessor_protection_minor_units = moneyString(perProtection);
    row.rental_due_minor_units = lossStopsRent ? '0' : moneyString(row.rental_minor_units);
    row.rental_minor_units = moneyString(row.rental_minor_units);
    scheduledTotal += BigInt(row.rental_minor_units);
    payableTotal += BigInt(row.rental_due_minor_units);
    maintenanceTotal += perMaintenance;
    protectionTotal += perProtection;
    schedule.push(row);
  }
  if (floorMonths > 0) compliance_flags.push('RENTAL_CLAMPED_FLOOR');
  if (capMonths > 0) compliance_flags.push('RENTAL_CLAMPED_CAP');

  let totalLoss = null;
  if (v.lossMonth !== null) {
    totalLoss = {
      month: v.lossMonth,
      lessee_fault: v.fault === true,
      rent_stops_from_loss_month: v.fault !== true,
      restoration_borne_by: v.fault === true ? 'lessee' : 'lessor',
      takaful_recovery_minor_units: moneyString(BigInt(v.recovery !== null ? v.recovery : 0)),
    };
    if (v.fault === true) compliance_flags.push('TOTAL_LOSS_WITH_FAULT');
    else compliance_flags.push('TOTAL_LOSS_NO_FAULT_RENT_STOPPED');
  }

  const transfer = { mode: v.transferMode, price_minor_units: null };
  if (v.trigger !== null) transfer.wad_purchase_trigger = v.trigger;
  if (v.transferMode === 'sale') {
    transfer.timing = 'after_lease_expiry';
    transfer.execution = 'separate_sale_contract_after_expiry';
    transfer.price_minor_units = moneyString(BigInt(v.transferPrice));
  } else if (v.transferMode === 'conditional_hibah') {
    transfer.timing = 'when_condition_fulfilled';
    transfer.execution = 'conditional_hibah';
  } else {
    transfer.timing = 'after_lease_expiry';
    transfer.execution = 'separate_hibah_contract';
  }

  let exceptionUsed = null;
  if (v.exception !== null) {
    exceptionUsed = { circumstance: v.exception };
    compliance_flags.push('INSURANCE_EXCEPTION_APPLIED');
  }

  const output_payload = {
    not_a_shariah_ruling: true,
    valid_input: true,
    domain_errors: [],
    refusal_code: null,
    authority: v.authority,
    asset_cost_minor_units: moneyString(cost),
    tenor_months: tenor,
    rental_basis: v.basis,
    rounding_rule: 'half_even_to_minor_unit_per_month',
    schedule,
    totals: {
      scheduled_rentals_minor_units: moneyString(scheduledTotal),
      payable_rentals_minor_units: moneyString(payableTotal),
      lessor_maintenance_total_minor_units: moneyString(maintenanceTotal),
      lessor_protection_total_minor_units: moneyString(protectionTotal),
    },
    total_loss: totalLoss,
    transfer,
    exception_used: exceptionUsed,
    mutual_revision_agreed: v.mutualRevision === true,
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
