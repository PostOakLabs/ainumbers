import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-216-trid-tolerance-cure';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_trid_tolerance_cure',
  mandate_type: 'compliance_mandate', gpu: false,
};

// TRID fee tolerance buckets per Reg Z §1026.19(e)(3).
// Buckets:
//   ZERO_TOLERANCE      — 0% tolerance; any increase is a violation
//   TEN_PCT_CUMULATIVE  — 10% cumulative bucket; sum of increases <= 10% of sum of LE amounts
//   NO_TOLERANCE_LIMIT  — no tolerance limit (can increase without cure)
//
// Changed-circumstance flag exempts a fee from its baseline comparison:
//   fee.changed_circumstance: true  → exclude from tolerance analysis entirely

const BUCKET = {
  ZERO: 'zero_tolerance',
  TEN: 'ten_pct_cumulative',
  NO_LIMIT: 'no_tolerance_limit',
};

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

export function compute(pp) {
  pp = pp || {};

  // fees: array of { name, bucket, le_amount, cd_amount, changed_circumstance? }
  // bucket: "zero_tolerance" | "ten_pct_cumulative" | "no_tolerance_limit"
  const fees = Array.isArray(pp.fees) ? pp.fees : [];

  let zero_violation_count = 0;
  let ten_pct_le_sum = 0;      // sum of 10% bucket LE amounts
  let ten_pct_cd_sum = 0;      // sum of 10% bucket CD amounts
  let ten_pct_increase = 0;    // sum of increases in 10% bucket

  const fee_analysis = [];
  const violations = [];

  for (const fee of fees) {
    const name = String(fee.name || 'unnamed');
    const bucket = String(fee.bucket || BUCKET.NO_LIMIT);
    const le = safeNum(fee.le_amount, 0);
    const cd = safeNum(fee.cd_amount, 0);
    const cc = Boolean(fee.changed_circumstance);

    const increase = r2(cd - le);

    if (cc) {
      fee_analysis.push({
        name, bucket, le_amount: r2(le), cd_amount: r2(cd), increase,
        status: 'exempt_changed_circumstance',
        violation: false,
      });
      continue;
    }

    if (bucket === BUCKET.ZERO) {
      const violation = increase > 0.005; // allow $0.005 rounding tolerance
      if (violation) {
        zero_violation_count++;
        violations.push({ name, bucket, increase, reason: 'zero_tolerance_fee_increased' });
      }
      fee_analysis.push({
        name, bucket, le_amount: r2(le), cd_amount: r2(cd), increase: r2(increase),
        status: violation ? 'violation' : 'ok',
        violation,
      });
    } else if (bucket === BUCKET.TEN) {
      ten_pct_le_sum += le;
      ten_pct_cd_sum += cd;
      if (increase > 0) ten_pct_increase += increase;
      fee_analysis.push({
        name, bucket, le_amount: r2(le), cd_amount: r2(cd), increase: r2(increase),
        status: 'in_ten_pct_bucket', violation: false, // assessed at aggregate level
      });
    } else {
      // No-tolerance-limit: no violation possible from fee increase
      fee_analysis.push({
        name, bucket, le_amount: r2(le), cd_amount: r2(cd), increase: r2(increase),
        status: 'no_limit', violation: false,
      });
    }
  }

  // Evaluate 10% cumulative bucket
  const ten_pct_threshold = r2(ten_pct_le_sum * 0.10);
  const ten_pct_excess = r2(Math.max(0, ten_pct_increase - ten_pct_threshold));
  const ten_pct_violation = ten_pct_excess > 0.005;

  if (ten_pct_violation) {
    violations.push({
      bucket: BUCKET.TEN,
      le_sum: r2(ten_pct_le_sum),
      cd_sum: r2(ten_pct_cd_sum),
      total_increase: r2(ten_pct_increase),
      threshold_10pct: ten_pct_threshold,
      excess: ten_pct_excess,
      reason: 'ten_pct_cumulative_threshold_exceeded',
    });
    // Mark all 10% bucket fees as contributing to violation
    for (const fa of fee_analysis) {
      if (fa.bucket === BUCKET.TEN) {
        fa.status = 'contributing_to_ten_pct_violation';
        fa.violation = true;
      }
    }
  }

  const total_violations = violations.length;
  const cure_required = total_violations > 0;

  // Cure amount: zero-tolerance fees must be refunded in full increase;
  // 10% bucket cured by the excess amount. Larger of the two approaches per §1026.19(e)(4).
  const zero_tolerance_cure = fee_analysis
    .filter((f) => f.violation && f.bucket === BUCKET.ZERO)
    .reduce((s, f) => s + Math.max(0, f.increase), 0);
  const cure_amount = r2(zero_tolerance_cure + ten_pct_excess);

  const compliance_flags = [];
  if (cure_required) compliance_flags.push('TRID_CURE_REQUIRED');
  if (zero_violation_count > 0) compliance_flags.push('ZERO_TOLERANCE_VIOLATION');
  if (ten_pct_violation) compliance_flags.push('TEN_PCT_TOLERANCE_EXCEEDED');

  const output_payload = {
    cure_required,
    cure_amount,
    zero_tolerance_violations: zero_violation_count,
    ten_pct_bucket_le_sum: r2(ten_pct_le_sum),
    ten_pct_bucket_increase: r2(ten_pct_increase),
    ten_pct_threshold,
    ten_pct_excess,
    ten_pct_violation,
    total_violations,
    violations,
    fee_analysis,
    regulatory_basis: 'Reg Z §1026.19(e)(3), TRID fee tolerance rules (Loan Estimate to Closing Disclosure)',
    note: 'Changed-circumstance fees are excluded from comparison. Bucket assignment is the caller\'s responsibility per regulatory classification rules.',
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
