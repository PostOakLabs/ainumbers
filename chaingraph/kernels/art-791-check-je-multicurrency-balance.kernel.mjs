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
  // Declared optional string (manifest input_schema): echoed through to the ran
  // artifact's output_payload; null when absent or not a string. No refusal is
  // attached to it — it is provenance echo, not a decision input.
  const policy_version = typeof pp.policy_version === 'string' && pp.policy_version.length > 0 ? pp.policy_version : null;

  // ---- batch-level validation (deterministic order) ----
  const basis = pp.balance_basis;
  if (basis !== 'functional' && basis !== 'per_currency') {
    compliance_flags.push('BASIS_NOT_DECLARED');
    return { output_payload: { execution_state: 'did_not_run', reason: 'BASIS_NOT_DECLARED', domain_errors: compliance_flags.slice() }, compliance_flags };
  }
  const fnCcy = pp.functional_currency;
  if (basis === 'functional' && (typeof fnCcy !== 'string' || fnCcy.length === 0)) {
    compliance_flags.push('BASIS_NOT_DECLARED');
    return { output_payload: { execution_state: 'did_not_run', reason: 'BASIS_NOT_DECLARED_FUNCTIONAL_CURRENCY_REQUIRED', domain_errors: compliance_flags.slice() }, compliance_flags };
  }
  const exponents = pp.currency_exponents;
  if (!isPlainObject(exponents) || Object.keys(exponents).length === 0) {
    compliance_flags.push('UNKNOWN_CURRENCY');
    return { output_payload: { execution_state: 'did_not_run', reason: 'UNKNOWN_CURRENCY_CURRENCY_EXPONENTS_REQUIRED', domain_errors: compliance_flags.slice() }, compliance_flags };
  }
  const tolIn = pp.tolerance_minor;
  const tolerancePairs = [];
  if (tolIn !== undefined && tolIn !== null) {
    if (!isPlainObject(tolIn)) {
      compliance_flags.push('NEGATIVE_TOLERANCE');
      return { output_payload: { execution_state: 'did_not_run', reason: 'NEGATIVE_TOLERANCE', domain_errors: compliance_flags.slice() }, compliance_flags };
    }
    for (const ccy of Object.keys(tolIn)) {
      if (!isValidTolerance(tolIn[ccy])) {
        compliance_flags.push('NEGATIVE_TOLERANCE');
        return { output_payload: { execution_state: 'did_not_run', reason: 'NEGATIVE_TOLERANCE', currency: ccy, domain_errors: compliance_flags.slice() }, compliance_flags };
      }
      tolerancePairs.push([ccy, tolIn[ccy]]);
    }
  }
  const tolerance = Object.fromEntries(tolerancePairs);
  const entriesIn = pp.entries;
  if (!Array.isArray(entriesIn) || entriesIn.length === 0) {
    compliance_flags.push('ENTRY_TOO_FEW_LINES');
    return { output_payload: { execution_state: 'did_not_run', reason: 'ENTRY_TOO_FEW_LINES', domain_errors: compliance_flags.slice() }, compliance_flags };
  }
  if (entriesIn.length > MAX_ENTRIES) {
    compliance_flags.push('ENTRY_CAP_EXCEEDED');
    return { output_payload: { execution_state: 'did_not_run', reason: 'ENTRY_CAP_EXCEEDED', cap: MAX_ENTRIES, domain_errors: compliance_flags.slice() }, compliance_flags };
  }

  // ---- per-entry evaluation (input order preserved; deterministic) ----
  const seenEntryIds = new Set();
  const seenLineIds = new Set();
  const results = [];
  const totals = { balanced: 0, within_tolerance: 0, imbalanced: 0, refused: 0 };

  for (const e of entriesIn) {
    const entryResult = evaluateEntry(e, { basis, fnCcy, exponents, tolerance, seenEntryIds, seenLineIds });
    if (!Object.hasOwn(totals, entryResult.status)) totals[entryResult.status] = 0;
    totals[entryResult.status] += 1;
    results.push(entryResult);
  }

  return {
    output_payload: {
      execution_state: 'ran',
      policy_version: policy_version,
      basis: basis,
      functional_currency: basis === 'functional' ? fnCcy : null,
      tolerance_used: tolerance,
      entry_cap: MAX_ENTRIES,
      entries: results,
      totals: totals,
      domain_errors: compliance_flags.slice(),
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
  const residualByCcy = new Map();
  let fnResidual = 0n;
  let firstRefusal = null;

  for (const ln of lines) {
    if (!isPlainObject(ln)) { firstRefusal = firstRefusal || 'AMOUNT_NOT_INTEGER'; continue; }
    const lineId = ln.line_id;
    if (typeof lineId === 'string' && lineId.length > 0) {
      if (seenLineIds.has(lineId)) { firstRefusal = firstRefusal || 'DUPLICATE_LINE_ID'; continue; }
      seenLineIds.add(lineId);
    }
    const ccy = ln.currency;
    if (typeof ccy !== 'string' || !Object.hasOwn(exponents, ccy)) {
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
      residualByCcy.set(ccy, (residualByCcy.get(ccy) || 0n) + BigInt(ln.amount_minor));
    } else {
      fnResidual += BigInt(fnAmt);
    }
  }

  if (firstRefusal) return refused(firstRefusal, warnings, entryId);

  let residualMinor;
  if (basis === 'per_currency') {
    residualMinor = Object.fromEntries([...residualByCcy].map(([ccy, res]) => [ccy, Number(res)]));
  } else {
    residualMinor = { [fnCcy]: Number(fnResidual) };
  }

  // Status: the largest absolute residual across the relevant currency set is compared
  // against the declared tolerance for that currency; any currency over its own
  // tolerance tips the entry to imbalanced.
  let status = 'balanced';
  if (basis === 'per_currency') {
    for (const [ccy, res] of residualByCcy) {
      const r = res < 0n ? -res : res;
      const t = BigInt(Object.hasOwn(tolerance, ccy) ? tolerance[ccy] : 0);
      if (r === 0n) continue;
      if (r <= t) { if (status === 'balanced') status = 'within_tolerance'; }
      else status = 'imbalanced';
    }
  } else {
    const r = fnResidual < 0n ? -fnResidual : fnResidual;
    const t = BigInt(Object.hasOwn(tolerance, fnCcy) ? tolerance[fnCcy] : 0);
    if (r !== 0n) {
      if (r <= t) status = 'within_tolerance';
      else status = 'imbalanced';
    }
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

// ── hashability walk (D6) ────────────────────────────────────────────────────────
// Mirrors the classes _hash.mjs assertIJson() refuses before canonicalizing: a non-finite
// number or an integer outside the 2^53 safe range, a BigInt, nesting past its MAX_DEPTH,
// more values than its MAX_ELEMENTS. Reports { reason, detail } with the path and kind
// only, never the value; null when the subtree is safe to hash. _hash.mjs stays untouched.
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

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  // The object walked below is the execution_hash preimage. When the shared canonicalizer
  // would refuse it, mint the artifact with a null execution_hash and the reason beside it
  // instead of letting the hash throw (D6).
  const unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'pp', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
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
