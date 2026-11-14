import { executionHash } from './_hash.mjs';

// art-791-check-je-multicurrency-balance — checks that structured journal entries balance on a
// caller-declared basis (functional currency or per currency) in integer minor units, with a
// declared per-currency tolerance. Pure decision kernel: every amount is a signed JSON integer
// with debit positive; no floats, no hashing, no guest builtins.
const TOOL_ID = 'art-791-check-je-multicurrency-balance';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_je_multicurrency_balance',
  mandate_type: 'compliance_control', gpu: false,
};

// Hard cap on the number of entries accepted in one run (named constant).
const MAX_ENTRIES = 500;
const MIN_LINES_PER_ENTRY = 2;
const MAX_SAFE_MINOR = Number.MAX_SAFE_INTEGER; // 2^53 - 1

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Non-negative-integer-or-zero tolerance check. Returns true when the value is an integer >= 0.
function isValidTolerance(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function checkAmount(v) {
  if (typeof v !== 'number' || !Number.isInteger(v)) return 'AMOUNT_NOT_INTEGER';
  if (!Number.isSafeInteger(v) || v > MAX_SAFE_MINOR || v < -MAX_SAFE_MINOR) return 'AMOUNT_UNSAFE_INTEGER';
  return null;
}

/**
 * compute(pp) — pure function of policy_parameters.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const compliance_flags = [];

  // ---- batch-level validation (deterministic order) ----
  const basis = pp.balance_basis;
  if (basis !== 'functional' && basis !== 'per_currency') {
    compliance_flags.push('BASIS_NOT_DECLARED');
    return { output_payload: { execution_state: 'did_not_run', reason: 'BASIS_NOT_DECLARED' }, compliance_flags };
  }
  const fnCcy = pp.functional_currency;
  if (basis === 'functional' && (typeof fnCcy !== 'string' || fnCcy.length === 0)) {
    compliance_flags.push('BASIS_NOT_DECLARED');
    return { output_payload: { execution_state: 'did_not_run', reason: 'BASIS_NOT_DECLARED_FUNCTIONAL_CURRENCY_REQUIRED' }, compliance_flags };
  }
  const exponents = pp.currency_exponents;
  if (!isPlainObject(exponents) || Object.keys(exponents).length === 0) {
    compliance_flags.push('UNKNOWN_CURRENCY');
    return { output_payload: { execution_state: 'did_not_run', reason: 'UNKNOWN_CURRENCY_CURRENCY_EXPONENTS_REQUIRED' }, compliance_flags };
  }
  const tolIn = pp.tolerance_minor;
  const tolerance = {};
  if (tolIn !== undefined && tolIn !== null) {
    if (!isPlainObject(tolIn)) {
      compliance_flags.push('NEGATIVE_TOLERANCE');
      return { output_payload: { execution_state: 'did_not_run', reason: 'NEGATIVE_TOLERANCE' }, compliance_flags };
    }
    for (const ccy of Object.keys(tolIn)) {
      if (!isValidTolerance(tolIn[ccy])) {
        compliance_flags.push('NEGATIVE_TOLERANCE');
        return { output_payload: { execution_state: 'did_not_run', reason: 'NEGATIVE_TOLERANCE', currency: ccy }, compliance_flags };
      }
      tolerance[ccy] = tolIn[ccy];
    }
  }
  const entriesIn = pp.entries;
  if (!Array.isArray(entriesIn) || entriesIn.length === 0) {
    compliance_flags.push('ENTRY_TOO_FEW_LINES');
    return { output_payload: { execution_state: 'did_not_run', reason: 'ENTRY_TOO_FEW_LINES' }, compliance_flags };
  }
  if (entriesIn.length > MAX_ENTRIES) {
    compliance_flags.push('ENTRY_CAP_EXCEEDED');
    return { output_payload: { execution_state: 'did_not_run', reason: 'ENTRY_CAP_EXCEEDED', cap: MAX_ENTRIES }, compliance_flags };
  }

  // ---- per-entry evaluation (input order preserved; deterministic) ----
  const seenEntryIds = new Set();
  const seenLineIds = new Set();
  const results = [];
  const totals = { balanced: 0, within_tolerance: 0, imbalanced: 0, refused: 0 };

  for (const e of entriesIn) {
    const entryResult = evaluateEntry(e, { basis, fnCcy, exponents, tolerance, seenEntryIds, seenLineIds });
    totals[entryResult.status] += 1;
    results.push(entryResult);
  }

  return {
    output_payload: {
      execution_state: 'ran',
      basis: basis,
      functional_currency: basis === 'functional' ? fnCcy : null,
      tolerance_used: tolerance,
      entry_cap: MAX_ENTRIES,
      entries: results,
      totals: totals,
    },
    compliance_flags,
  };
}

function evaluateEntry(e, ctx) {
  const { basis, fnCcy, exponents, tolerance, seenEntryIds, seenLineIds } = ctx;

  if (!isPlainObject(e)) {
    return refused('AMOUNT_NOT_INTEGER');
  }
  const entryId = e.entry_id;
  if (typeof entryId === 'string' && entryId.length > 0) {
    if (seenEntryIds.has(entryId)) return refused('DUPLICATE_ENTRY_ID', [], entryId);
    seenEntryIds.add(entryId);
  }
  const lines = e.lines;
  if (!Array.isArray(lines) || lines.length < MIN_LINES_PER_ENTRY) {
    return refused('ENTRY_TOO_FEW_LINES');
  }

  const warnings = [];
  const residualByCcy = {};
  let fnResidual = 0;
  let firstRefusal = null;

  for (const ln of lines) {
    if (!isPlainObject(ln)) { firstRefusal = firstRefusal || 'AMOUNT_NOT_INTEGER'; continue; }
    const lineId = ln.line_id;
    if (typeof lineId === 'string' && lineId.length > 0) {
      if (seenLineIds.has(lineId)) { firstRefusal = firstRefusal || 'DUPLICATE_LINE_ID'; continue; }
      seenLineIds.add(lineId);
    }
    const ccy = ln.currency;
    if (typeof ccy !== 'string' || !(ccy in exponents)) {
      firstRefusal = firstRefusal || 'UNKNOWN_CURRENCY';
      continue;
    }
    const amtCheck = checkAmount(ln.amount_minor);
    if (amtCheck) { firstRefusal = firstRefusal || amtCheck; continue; }
    if (ln.amount_minor === 0) warnings.push('ZERO_AMOUNT_LINE');

    let fnAmt = null;
    if (basis === 'functional' && ccy !== fnCcy) {
      if (ln.functional_minor === undefined || ln.functional_minor === null) {
        firstRefusal = firstRefusal || 'MISSING_FUNCTIONAL_AMOUNT';
        continue;
      }
      const fnCheck = checkAmount(ln.functional_minor);
      if (fnCheck) { firstRefusal = firstRefusal || fnCheck; continue; }
      fnAmt = ln.functional_minor;
    } else if (basis === 'functional' && ccy === fnCcy) {
      if (ln.functional_minor !== undefined && ln.functional_minor !== null) {
        const fnCheck = checkAmount(ln.functional_minor);
        if (fnCheck) { firstRefusal = firstRefusal || fnCheck; continue; }
        fnAmt = ln.functional_minor;
      } else {
        fnAmt = ln.amount_minor;
      }
    }

    if (basis === 'per_currency') {
      residualByCcy[ccy] = (residualByCcy[ccy] || 0) + ln.amount_minor;
    } else {
      fnResidual += fnAmt;
    }
  }

  if (firstRefusal) return refused(firstRefusal, warnings, entryId);

  let residualMinor;
  let maxResidual;
  if (basis === 'per_currency') {
    residualMinor = residualByCcy;
    maxResidual = 0;
    for (const ccy of Object.keys(residualByCcy)) {
      const r = Math.abs(residualByCcy[ccy]);
      if (r > maxResidual) maxResidual = r;
    }
  } else {
    residualMinor = {};
    residualMinor[fnCcy] = fnResidual;
    maxResidual = Math.abs(fnResidual);
  }

  // Status: the largest absolute residual across the relevant currency set is compared
  // against the declared tolerance for that currency; any currency over its own
  // tolerance tips the entry to imbalanced.
  let status = 'balanced';
  const ccySet = basis === 'per_currency' ? Object.keys(residualByCcy) : [fnCcy];
  const amounts = basis === 'per_currency' ? residualByCcy : residualMinor;
  for (const ccy of ccySet) {
    const r = Math.abs(amounts[ccy]);
    const t = tolerance[ccy] !== undefined ? tolerance[ccy] : 0;
    if (r === 0) continue;
    if (r <= t) { if (status === 'balanced') status = 'within_tolerance'; }
    else status = 'imbalanced';
  }

  return {
    entry_id: typeof entryId === 'string' ? entryId : null,
    status: status,
    residual_minor: residualMinor,
    tolerance_used: tolerance,
    warnings: warnings,
  };
}

function refused(code, warnings, entryId) {
  return {
    entry_id: typeof entryId === 'string' ? entryId : null,
    status: 'refused',
    reason: code,
    residual_minor: null,
    tolerance_used: null,
    warnings: warnings || [],
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
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
}
