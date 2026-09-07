import { executionHash } from './_hash.mjs';

// art-693-intercompany-elimination-workflow — Intercompany Elimination and Netting Workflow.
//
// PURPOSE AND SCOPE: pure matching arithmetic over caller-declared intercompany
// balances. For each declared entity pair the kernel compares the receivable
// declared by entity `a` against the payable declared by entity `b`: a pair
// MATCHES when the two rounded amounts are equal; otherwise it is listed as a
// MISMATCH with its difference. The elimination total sums the eliminated
// (smaller-side) amount of every declared pair; the unmatched residual sums the
// differences of the mismatched pairs. It is NOT legal advice, NOT an audit
// opinion, NOT a settlement instruction: it never moves money, never posts a
// journal anywhere, and never contacts any counterparty. All inputs are
// caller-declared and synthetic; as-of dating is an input, never a clock read.
// Zero storage, zero network, no runtime clock anywhere in compute().
//
// Output payload shape: exactly { matched_pairs, mismatched_pairs,
// elimination_total, unmatched_residual, mismatches, trace, overall } — the
// canonical pinned shape; extra keys would move the execution_hash.
//
// ROUNDING DECLARATION: all monetary arithmetic is performed at 2 decimal
// places, half-up (declared in-kernel). When any declared amount is not an
// integer number of cents the trace says so explicitly ("amounts rounded 2dp
// half-up"); integer-cent inputs (including the canonical preimage) get the
// plain trace, so the canonical bytes stay byte-identical.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(),
// no network, no filesystem. It runs unmodified inside the QuickJS-ng zkVM guest,
// which is a STRICT SUBSET of a browser/Node global environment.
//
// Spec: INTERCOMPANY-ELIM-BUILD-SPEC.md (workspace root). PARITY TARGET: the
// canonical preimage embedded in the spec — for the spec's policy_parameters,
// compute() returns the spec's output_payload EXACTLY (same seven keys, same
// values, same trace string), and executionHash(pp, output_payload) must equal
// the spec's staged execution_hash
// 2ef81e5259e39f897169eaeb311de0ae3b15bb4fdfa94d7160cf3642aadd4eb4.
// The trace string format is therefore load-bearing:
//   "eliminate min(20000,18000)=18000 + matched 50000 = 68000; residual 20000-18000=2000"
// (mismatch segments first in declared pair order, then matched segments, then
// the residual decomposition of the mismatch differences).

const TOOL_ID = 'art-693-intercompany-elimination-workflow';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_intercompany_elimination_workflow',
  mandate_type: 'compliance_control', gpu: false,
};

// Round to 2 decimal places, half-up. The Number.EPSILON guard absorbs the
// binary-float representation error so values like 2.675 round up as a human
// would expect.
function round2dpHalfUp(n) {
  return Math.sign(n) * Math.round(Math.abs(n) * 100 + Number.EPSILON) / 100;
}

// Render a rounded amount for the trace: minimal form, trailing zeros dropped.
function fmt(n) {
  return String(round2dpHalfUp(n));
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isAmount(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/**
 * compute(pp) — pure decision kernel.
 * Declared inputs:
 *   pairs  (required, non-empty array) caller-declared entity pairs; each
 *          element { a: string, b: string, a_receivable: number, b_payable: number }
 *          — synthetic declared balances, never a ledger read.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const flags = [];

  const pairs = pp.pairs;
  if (!Array.isArray(pairs) || pairs.length === 0) {
    flags.push('ICELIM_ERROR');
    throw new TypeError('pairs must be supplied as a non-empty array of declared { a, b, a_receivable, b_payable } entity pairs (synthetic declared balances; never a ledger read).');
  }
  let fractional = false;
  for (const p of pairs) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      flags.push('ICELIM_ERROR');
      throw new TypeError('every element of pairs must be an object with non-empty string entity names a and b and finite non-negative numbers a_receivable and b_payable.');
    }
    if (!isNonEmptyString(p.a) || !isNonEmptyString(p.b)) {
      flags.push('ICELIM_ERROR');
      throw new TypeError('every declared pair needs non-empty string entity names a and b.');
    }
    if (!isAmount(p.a_receivable) || !isAmount(p.b_payable)) {
      flags.push('ICELIM_ERROR');
      throw new TypeError('every declared pair needs finite, non-negative numbers a_receivable and b_payable.');
    }
    if (!Number.isInteger(p.a_receivable) || !Number.isInteger(p.b_payable)) fractional = true;
  }

  let matchedPairs = 0;
  const matchedAmounts = [];
  const mismatches = [];
  let eliminationTotal = 0;
  let unmatchedResidual = 0;
  const eliminateSegments = [];
  const residualSegments = [];

  for (const p of pairs) {
    const a = round2dpHalfUp(p.a_receivable);
    const b = round2dpHalfUp(p.b_payable);
    const eliminated = Math.min(a, b);
    eliminationTotal = round2dpHalfUp(eliminationTotal + eliminated);
    if (a === b) {
      matchedPairs++;
      matchedAmounts.push(a);
    } else {
      const difference = round2dpHalfUp(a - b);
      mismatches.push({ a: p.a, b: p.b, difference });
      eliminateSegments.push(`min(${fmt(a)},${fmt(b)})=${fmt(eliminated)}`);
      residualSegments.push(`${fmt(a)}-${fmt(b)}`);
      unmatchedResidual = round2dpHalfUp(unmatchedResidual + difference);
    }
  }

  // Matched-pair segments follow the mismatch segments in the trace (canonical
  // segment order: mismatches first, then matched pairs).
  for (const m of matchedAmounts) eliminateSegments.push(`matched ${fmt(m)}`);

  // Residual part: the mismatch differences decompose the residual exactly;
  // with no mismatches the residual is zero and the trace says so.
  const residualPart = residualSegments.length > 0
    ? ` residual ${residualSegments.join(' + ')}=${fmt(unmatchedResidual)}`
    : ' residual 0';
  const roundingNote = fractional ? ' (amounts rounded 2dp half-up)' : '';
  const trace = `eliminate ${eliminateSegments.join(' + ')} = ${fmt(eliminationTotal)};${residualPart}${roundingNote}`;

  const overall = mismatches.length > 0 ? 'GAPS_FOUND' : 'ALL_MATCHED';

  const output_payload = {
    matched_pairs: matchedPairs,
    mismatched_pairs: mismatches.length,
    elimination_total: eliminationTotal,
    unmatched_residual: unmatchedResidual,
    mismatches,
    trace,
    overall,
  };

  return { output_payload, compliance_flags: flags };
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
