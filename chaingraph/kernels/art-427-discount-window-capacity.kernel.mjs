import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-427-discount-window-capacity';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_discount_window_capacity',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Discount Window borrowing-capacity calculator: lendable value = sum of pledged collateral
// positions x their published Fed margin (haircut-adjusted advance rate), compared against a
// runnable-liability / uninsured-deposit coverage target. Margin percentages are caller-supplied
// policy input versioned to a Fed collateral margin table effective date (2026-07-01 at time of
// writing) -- this kernel does not hardcode the schedule, it applies whatever table version the
// caller passes, so a future Fed margin-table update is a policy_parameters change, not a kernel
// change. DW Preparedness Act / Treasury LCR-recognition context: no vendor tool exists for this.
//
// Pure ECMA-262 arithmetic only -- no Date.now/new Date(), no Math.random. Dollar figures and
// ratios rounded to 2 decimals (r2) only at declared output boundaries; a zero-denominator
// coverage ratio is reported as null (finite gate: never NaN/Infinity).

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return (v === null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }

function computeCollateral(positions) {
  const rows = arr(positions).map((p) => ({
    category: (p && p.category) || '',
    par_value_musd: Math.max(0, safeNum(p && p.par_value_musd, 0)),
    margin_pct: Math.min(100, Math.max(0, safeNum(p && p.margin_pct, 0))),
  }));
  const lendableValue = rows.reduce((s, p) => s + p.par_value_musd * p.margin_pct / 100, 0);
  const totalParValue = rows.reduce((s, p) => s + p.par_value_musd, 0);
  return { rows, lendableValue, totalParValue };
}

function computeRunnable(liabilities) {
  const rows = arr(liabilities).map((l) => ({
    label: (l && l.label) || '',
    balance_musd: Math.max(0, safeNum(l && l.balance_musd, 0)),
  }));
  const total = rows.reduce((s, l) => s + l.balance_musd, 0);
  return { rows, total };
}

export function compute(pp) {
  pp = pp || {};

  const marginTableVersion = (typeof pp.margin_table_version === 'string' && pp.margin_table_version) || null;
  const coverageTargetPct = Math.max(0, safeNum(pp.coverage_target_pct, 100));

  const { lendableValue, totalParValue } = computeCollateral(pp.collateral_positions);
  const { total: runnableTotal } = computeRunnable(pp.runnable_liabilities);

  const coveragePct = runnableTotal > 0 ? (lendableValue / runnableTotal) * 100 : null;
  const capacityCompliant = coveragePct === null ? true : coveragePct >= coverageTargetPct;

  const compliance_flags = [];
  if (capacityCompliant === false) compliance_flags.push('DW_CAPACITY_COVERAGE_BELOW_TARGET_DEFICIENT');
  else compliance_flags.push('DW_CAPACITY_COVERAGE_ADEQUATE');

  const output_payload = {
    margin_table_version: marginTableVersion,
    collateral_par_value_musd: r2(totalParValue),
    lendable_value_musd: r2(lendableValue),
    runnable_liabilities_musd: r2(runnableTotal),
    coverage_target_pct: r2(coverageTargetPct),
    coverage_pct: coveragePct === null ? null : r2(coveragePct),
    capacity_surplus_shortfall_musd: r2(lendableValue - runnableTotal),
    capacity_compliant: capacityCompliant,
    note: 'Lendable value = sum(collateral par value x published Fed margin, policy-input margin table). Compared against caller-supplied runnable-liability / uninsured-deposit balance. Not a claim of actual Fed collateral eligibility or advance approval.',
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
