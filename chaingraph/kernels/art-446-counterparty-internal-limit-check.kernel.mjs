import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-446-counterparty-internal-limit-check';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_counterparty_limit_check',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Counterparty internal credit-limit check. Compares each counterparty's caller-supplied
// current exposure against its board-approved internal limit line (settlement,
// pre-settlement/PFE, or aggregate limit type). Deterministic point-in-time comparison from
// caller-supplied figures -- NOT a real-time exposure monitor (no live feed, no polling, no
// scheduled job). Distinct from the Basel/Reg-YY regulatory single-counterparty threshold
// check (art-425): this checks internally governed limit lines, not the 25%/15%-of-Tier-1
// regulatory ceiling.
//
// Pure ECMA-262 arithmetic only -- no Date.now/new Date(), no Math.random. Dollar figures and
// percentages rounded to 2 decimals (r2) only at declared output boundaries; a zero-denominator
// ratio is reported as null (finite gate: never NaN/Infinity).

const VALID_LIMIT_TYPES = ['settlement', 'pre_settlement', 'aggregate'];

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }
function clampPct(v, def) {
  const n = safeNum(v, def);
  return Math.min(100, Math.max(0, n));
}

function computeCounterparty(cp) {
  const approvedLimit = Math.max(0, safeNum(cp && cp.approved_limit_musd, 0));
  const currentExposure = Math.max(0, safeNum(cp && cp.current_exposure_musd, 0));
  const warningThresholdPct = clampPct(cp && cp.warning_threshold_pct, 90);
  const limitTypeRaw = (cp && cp.limit_type) || 'aggregate';
  const limitType = VALID_LIMIT_TYPES.indexOf(limitTypeRaw) >= 0 ? limitTypeRaw : 'aggregate';

  const utilizationPct = approvedLimit > 0 ? r2((currentExposure / approvedLimit) * 100) : null;
  const headroomMusd = r2(approvedLimit - currentExposure);
  const breached = currentExposure > approvedLimit;
  const warned = !breached && utilizationPct !== null && utilizationPct >= warningThresholdPct;
  const status = breached ? 'BREACH' : (warned ? 'WARNING' : 'WITHIN_LIMIT');

  return {
    counterparty_id: (cp && cp.counterparty_id) || '',
    counterparty_name: (cp && cp.counterparty_name) || '',
    limit_type: limitType,
    approved_limit_musd: r2(approvedLimit),
    current_exposure_musd: r2(currentExposure),
    warning_threshold_pct: r2(warningThresholdPct),
    utilization_pct: utilizationPct,
    headroom_musd: headroomMusd,
    status,
  };
}

export function compute(pp) {
  pp = pp || {};

  const counterparties = arr(pp.counterparties).map(computeCounterparty);
  const breach_list = counterparties.filter((c) => c.status === 'BREACH');
  const warning_list = counterparties.filter((c) => c.status === 'WARNING');

  const compliance_flags = [];
  if (breach_list.length > 0) compliance_flags.push('LIMIT_BREACH_DETECTED');
  if (warning_list.length > 0) compliance_flags.push('WARNING_THRESHOLD_TRIGGERED');
  if (breach_list.length === 0 && warning_list.length === 0) compliance_flags.push('ALL_WITHIN_LIMIT');

  const output_payload = {
    counterparties,
    breach_list,
    warning_list,
    regulatory_basis: 'Internal (board- or risk-committee-approved) counterparty credit-limit governance -- not a regulatory threshold. Distinct from the Basel III / Regulation YY 25%/15%-of-Tier-1 large-exposures limit (see art-425).',
    note: 'Deterministic point comparison of caller-supplied current exposure against the caller-supplied approved internal limit line for a single reporting date. Not a real-time exposure monitor.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
