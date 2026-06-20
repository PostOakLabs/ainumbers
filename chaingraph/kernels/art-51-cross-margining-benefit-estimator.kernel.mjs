/**
 * art-51-cross-margining-benefit-estimator.kernel.mjs
 * Wave 11 — FICC–CME cross-margining IM-reduction estimator.
 * Offsets UST cash/repo DV01 against CME Treasury/SOFR futures DV01 in a combined
 * netting set. Standalone (two silos) vs cross-margined IM → reduction.
 * Customer cross-margining was expanded via the SEC notice published 2025-12-22.
 * EDUCATIONAL proxy — pure kernel. Spec: WORKFLOW-CANDIDATES-WAVE11 §2.4.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-51-cross-margining-benefit-estimator';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'estimate_cross_margin_benefit', mandate_type: 'risk_parameter', gpu: false };

const Z = { 0.90: 1.282, 0.95: 1.645, 0.99: 2.326, 0.999: 3.090 };
const BUCKETS = ['0-2y', '2-5y', '5-10y', '10-30y'];
const DAILY_VOL_BP = { '0-2y': 3, '2-5y': 5, '5-10y': 6, '10-30y': 7 };
const BUCKET_CORR = 0.80;
// CME contract DV01 ($/bp/contract) and tenor bucket (approx, educational).
const CME = {
  ZT: { dv01: 38, bucket: '0-2y' }, ZF: { dv01: 47, bucket: '2-5y' }, ZN: { dv01: 65, bucket: '5-10y' },
  ZB: { dv01: 130, bucket: '10-30y' }, UB: { dv01: 200, bucket: '10-30y' },
  SR1: { dv01: 41.67, bucket: '0-2y' }, SR3: { dv01: 25, bucket: '0-2y' },
};
const modDur = (t) => t / 1.04;
const bucketOf = (t) => (t <= 2 ? '0-2y' : t <= 5 ? '2-5y' : t <= 10 ? '5-10y' : '10-30y');

function bucketVaRtotal(netDV01, z, sq) {
  const bv = {};
  for (const b of BUCKETS) bv[b] = Math.abs(netDV01[b] || 0) * z * DAILY_VOL_BP[b] * sq;
  let s = 0;
  for (const a of BUCKETS) for (const c of BUCKETS) s += bv[a] * bv[c] * (a === c ? 1 : BUCKET_CORR);
  return Math.sqrt(s);
}

export function compute(pp) {
  const { ust_positions = [], cme_positions = [], account_type = 'house', confidence_level = 0.99, mpor_days = 1 } = pp;
  const z = Z[confidence_level] ?? 2.326;
  const sq = Math.sqrt(Math.max(1, Number(mpor_days) || 1));

  const ustDV01 = { '0-2y': 0, '2-5y': 0, '5-10y': 0, '10-30y': 0 };
  for (const p of ust_positions) {
    const notional = Number(p.notional) || 0;
    const tenor = Number(p.tenor_years) || (p.instrument === 'repo' || p.instrument === 'reverse-repo' ? 0.1 : 5);
    const sign = (p.direction === 'short' || p.instrument === 'reverse-repo') ? -1 : 1;
    ustDV01[bucketOf(tenor)] += sign * notional * modDur(tenor) * 0.0001;
  }

  const cmeDV01 = { '0-2y': 0, '2-5y': 0, '5-10y': 0, '10-30y': 0 };
  const eligible_offsets = [], ineligible_offsets = [];
  for (const p of cme_positions) {
    const spec = CME[p.contract];
    if (!spec) { ineligible_offsets.push({ contract: p.contract, reason: 'unknown CME contract' }); continue; }
    const sign = p.direction === 'short' ? -1 : 1;
    cmeDV01[spec.bucket] += sign * (Number(p.num_contracts) || 0) * spec.dv01;
  }

  // Eligibility: an offset is meaningful where both silos have DV01 in the same bucket with opposite sign.
  for (const b of BUCKETS) {
    if (ustDV01[b] !== 0 && cmeDV01[b] !== 0) {
      if (Math.sign(ustDV01[b]) !== Math.sign(cmeDV01[b])) eligible_offsets.push({ bucket: b, ust_dv01: +ustDV01[b].toFixed(1), cme_dv01: +cmeDV01[b].toFixed(1) });
      else ineligible_offsets.push({ bucket: b, reason: 'same-direction risk — no offset' });
    }
  }

  // Standalone: each silo margined independently (internal netting only).
  const imUST = bucketVaRtotal(ustDV01, z, sq);
  const imCME = bucketVaRtotal(cmeDV01, z, sq);
  const standalone_im_total = imUST + imCME;

  // Cross-margined: combined netting set (UST + CME DV01 net per bucket).
  const combined = {};
  for (const b of BUCKETS) combined[b] = (ustDV01[b] || 0) + (cmeDV01[b] || 0);
  const cross_margined_im = bucketVaRtotal(combined, z, sq);

  const im_reduction_usd = Math.max(0, standalone_im_total - cross_margined_im);
  const im_reduction_pct = standalone_im_total > 0 ? +((im_reduction_usd / standalone_im_total) * 100).toFixed(1) : 0;

  const compliance_flags = [];
  if (account_type === 'customer') compliance_flags.push('CUSTOMER_CROSS_MARGIN_PENDING_GO_LIVE');
  if (ineligible_offsets.length) compliance_flags.push('OFFSET_OUTSIDE_ELIGIBLE_SCOPE');
  if (im_reduction_pct >= 30) compliance_flags.push('MATERIAL_CROSS_MARGIN_BENEFIT');

  const account_type_note = account_type === 'customer'
    ? 'Customer cross-margining expanded via SEC notice published 2025-12-22; confirm operational go-live before relying on it.'
    : 'House (member) cross-margining — established FICC–CME arrangement.';

  const output_payload = {
    standalone_im_total: Math.round(standalone_im_total),
    cross_margined_im: Math.round(cross_margined_im),
    im_reduction_usd: Math.round(im_reduction_usd),
    im_reduction_pct,
    eligible_offsets,
    ineligible_offsets,
    account_type_note,
    assumptions: { confidence_level, mpor_days: Number(mpor_days) || 1, cme_dv01_table: 'approx per-contract $/bp', bucket_corr: BUCKET_CORR },
    note: 'Educational FICC–CME cross-margining estimate; CME DV01s are approximate. Not the official cross-margin calculator.',
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', ap2_version: '1.0.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
