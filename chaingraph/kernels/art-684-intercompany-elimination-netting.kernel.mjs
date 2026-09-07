import { executionHash } from './_hash.mjs';

// art-684-intercompany-elimination-netting — Intercompany Elimination and Netting Workflow.
//
// PURPOSE AND SCOPE: pure matching arithmetic over caller-declared intercompany
// balances. For each declared entity pair the kernel compares the receivable
// declared by entity `a` against the payable declared by entity `b`: a pair
// MATCHES when the two rounded amounts are equal, otherwise it is listed as a
// MISMATCH with its difference. The elimination total sums the eliminated
// (smaller-side) amount of every declared pair; the unmatched residual sums the
// differences of the mismatched pairs. It is NOT legal advice, NOT an audit
// opinion, NOT a settlement instruction: it never moves money, never posts a
// journal anywhere, and never contacts any counterparty. All inputs are
// caller-declared and synthetic; as-of dating is an input, never a clock read.
//
// Output payload shape: exactly { matched_pairs, mismatched_pairs,
// elimination_total, unmatched_residual, mismatches, trace, overall } on a
// computable path (the canonical pinned shape; extra keys would move the
// execution_hash), and the same fields nulled plus a domain_errors[] array on
// the fail-closed path (the flag-mirror member: a caveat carrier, truthy
// exactly when inputs were refused).
//
// ROUNDING DECLARATION: all monetary arithmetic is performed at 2 decimal
// places, half-up, and rendered in the trace with trailing zeros dropped
// ("18000", never "18000.00"). This declaration is normative for the kernel.
//
// Zero network, zero randomness, zero wall-clock reads inside compute(). Runs
// unmodified in the QuickJS-ng guest (no TextEncoder/atob/btoa/URL anywhere in
// this file).
//
// Spec: INTERCOMPANY-ELIM-BUILD-SPEC.md (canonical preimage, execution_hash
// pinned at staging: 2ef81e5259e39f897169eaeb311de0ae3b15bb4fdfa94d7160cf3642aadd4eb4).

const TOOL_ID = 'art-684-intercompany-elimination-netting';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_intercompany_elimination_netting',
  mandate_type: 'compliance_control',
  gpu: false,
};

// Human phrasing per domain error code -- composes the fail-closed trace.
const ERROR_PHRASES = {
  INVALID_PAIRS_REQUIRED: 'pairs must be a non-empty array of declared entity pairs',
  INVALID_ENTITY_NAME: 'each pair needs non-empty string entity names a and b',
  INVALID_AMOUNT: 'each pair needs finite, non-negative numbers a_receivable and b_payable',
};

// Round to 2 decimal places, half-up. 2dp half-up per the kernel's rounding
// declaration; Number.EPSILON guard absorbs the binary-float representation
// error so values like 2.675 round up as a human would expect.
function round2dpHalfUp(n) {
  return Math.sign(n) * Math.round(Math.abs(n) * 100 + Number.EPSILON) / 100;
}

// Render a rounded amount for the trace: minimal form, trailing zeros dropped.
function fmt(n) {
  const r = round2dpHalfUp(n);
  return Number.isInteger(r) ? String(r) : String(r);
}

function validEntity(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

function validAmount(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];
  const compliance_flags = [];

  const pairs = pp.pairs;
  let shapeOk = Array.isArray(pairs) && pairs.length > 0;
  if (!shapeOk) domain_errors.push('INVALID_PAIRS_REQUIRED');

  if (shapeOk) {
    for (const p of pairs) {
      const pOk = p && typeof p === 'object' && !Array.isArray(p);
      if (!pOk || !validEntity(p.a) || !validEntity(p.b)) { domain_errors.push('INVALID_ENTITY_NAME'); break; }
    }
    for (const p of pairs) {
      const pOk = p && typeof p === 'object' && !Array.isArray(p);
      if (!pOk || !validAmount(p.a_receivable) || !validAmount(p.b_payable)) { domain_errors.push('INVALID_AMOUNT'); break; }
    }
  }

  if (domain_errors.length > 0) {
    const reasons = domain_errors.map((c) => ERROR_PHRASES[c]).join('; ');
    compliance_flags.push('DOMAIN_ERROR');
    for (const code of domain_errors) compliance_flags.push(`ICELIM_${code}`);
    return {
      output_payload: {
        matched_pairs: null,
        mismatched_pairs: null,
        elimination_total: null,
        unmatched_residual: null,
        mismatches: null,
        trace: `fail-closed: ${reasons}; no elimination arithmetic computed -- correct the named inputs and resubmit. Intercompany elimination and netting arithmetic over caller-declared synthetic inputs only: not legal advice, not an audit opinion, and not a settlement instruction.`,
        overall: null,
        domain_errors,
      },
      compliance_flags,
    };
  }

  const matched = [];
  const mismatches = [];
  let elimination_total = 0;
  let unmatched_residual = 0;
  const eliminateSegments = [];
  const residualSegments = [];

  for (const p of pairs) {
    const a = round2dpHalfUp(p.a_receivable);
    const b = round2dpHalfUp(p.b_payable);
    const eliminated = Math.min(a, b);
    elimination_total = round2dpHalfUp(elimination_total + eliminated);
    if (a === b) {
      matched.push({ a: p.a, b: p.b, amount: a });
    } else {
      const difference = round2dpHalfUp(a - b);
      mismatches.push({ a: p.a, b: p.b, difference });
      eliminateSegments.push(`min(${fmt(a)},${fmt(b)})=${fmt(eliminated)}`);
      residualSegments.push(`${fmt(a)}-${fmt(b)}`);
      unmatched_residual = round2dpHalfUp(unmatched_residual + difference);
    }
  }

  // Matched-pair segments follow the mismatch segments in the trace.
  for (const m of matched) eliminateSegments.push(`matched ${fmt(m.amount)}`);

  // Trace: eliminated amounts per pair (mismatches first, then matched pairs),
  // then the residual decomposition. Canonical phrasing:
  // "eliminate min(20000,18000)=18000 + matched 50000 = 68000; residual 20000-18000=2000".
  const residualPart = residualSegments.length > 0
    ? ` residual ${residualSegments.join(' + ')}=${fmt(unmatched_residual)}`
    : ' residual 0';
  const trace = `eliminate ${eliminateSegments.join(' + ')} = ${fmt(elimination_total)};${residualPart}`;

  const overall = mismatches.length > 0 ? 'GAPS_FOUND' : 'ALL_MATCHED';

  return {
    output_payload: {
      matched_pairs: matched.length,
      mismatched_pairs: mismatches.length,
      elimination_total,
      unmatched_residual,
      mismatches,
      trace,
      overall,
    },
    compliance_flags,
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
