/**
 * art-110-arc-partner-stablecoin-onboarding.kernel.mjs
 * Arc Partner-Stablecoin Onboarding Conformance Scorer.
 * Scores a non-USD issuer's readiness to join Circle Partner Stablecoins on Arc.
 * DISTINCT from arc-xreserve-issuance (USDC issuer / GENIUS Act) — this is the non-USD partner path.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';
const TOOL_ID = 'art-110-arc-partner-stablecoin-onboarding';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'score_partner_stablecoin_readiness',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// Technical capability requirements (Circle Partner Stablecoin standards)
const REQUIRED_TECH_CAPS = ['evm_compatibility', 'mint_burn_api', 'on_chain_attestation', 'iso20022_messaging'];
// Reserve management requirements
const REQUIRED_RESERVE_COMPOSITION = ['liquid_sovereign', 'cash_equivalent'];
// Risk management requirements
const REQUIRED_RISK_CONTROLS = ['aml_screening', 'transaction_monitoring', 'sanctions_screening'];

const GRADE_THRESHOLDS = [
  { min: 90, grade: 'A' },
  { min: 75, grade: 'B' },
  { min: 60, grade: 'C' },
  { min: 45, grade: 'D' },
  { min: 0,  grade: 'F' },
];

function scoreSection(provided, required) {
  if (!Array.isArray(provided) || provided.length === 0) return { score: 0, gaps: required.slice() };
  const providedSet = new Set(provided.map(s => s.toLowerCase().replace(/[- ]/g, '_')));
  const gaps = required.filter(r => !providedSet.has(r.toLowerCase().replace(/[- ]/g, '_')));
  const score = Math.round(((required.length - gaps.length) / required.length) * 100);
  return { score, gaps };
}

export function compute(pp) {
  const profile = pp.issuer_profile ?? {};

  const ccy                 = profile.ccy ?? 'UNKNOWN';
  const reserve_composition = Array.isArray(profile.reserve_composition) ? profile.reserve_composition : [];
  const attestation_cadence = profile.attestation_cadence ?? 'none';
  const risk_mgmt_controls  = Array.isArray(profile.risk_mgmt_controls) ? profile.risk_mgmt_controls : [];
  const technical_caps      = Array.isArray(profile.technical_caps) ? profile.technical_caps : [];
  const home_regime         = profile.home_regime ?? 'unknown';

  // Score three dimensions (0-100 each)
  const techResult    = scoreSection(technical_caps, REQUIRED_TECH_CAPS);
  const reserveResult = scoreSection(reserve_composition, REQUIRED_RESERVE_COMPOSITION);
  const riskResult    = scoreSection(risk_mgmt_controls, REQUIRED_RISK_CONTROLS);

  // Attestation cadence bonus: monthly=+5, quarterly=+2
  const attestationBonus = attestation_cadence === 'monthly' ? 5 : attestation_cadence === 'quarterly' ? 2 : 0;

  const tech_score    = techResult.score;
  const reserve_score = reserveResult.score;
  const risk_score    = Math.min(100, riskResult.score + attestationBonus);

  const composite = Math.round((tech_score + reserve_score + risk_score) / 3);
  const grade     = (GRADE_THRESHOLDS.find(t => composite >= t.min) || { grade: 'F' }).grade;
  const eligible  = grade === 'A' || grade === 'B';

  const gaps = [
    ...techResult.gaps.map(g => `tech:${g}`),
    ...reserveResult.gaps.map(g => `reserve:${g}`),
    ...riskResult.gaps.map(g => `risk:${g}`),
  ];

  const verdict = eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE';

  const compliance_flags = [eligible ? 'PARTNER_STABLECOIN_ELIGIBLE' : 'PARTNER_STABLECOIN_INELIGIBLE'];
  if (tech_score >= 75)    compliance_flags.push('TECH_READY');
  if (reserve_score >= 75) compliance_flags.push('RESERVE_COMPLIANT');
  if (risk_score >= 75)    compliance_flags.push('RISK_CONTROLS_ADEQUATE');

  const output_payload = {
    ccy,
    home_regime,
    tech_score,
    reserve_score,
    risk_score,
    composite_grade: composite,
    grade,
    gaps,
    eligible,
    verdict,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, {
  now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0,
  sign = null,
} = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  if (!sign) return artifact;
  // §16 signer imported lazily so the runner-guest (which only runs compute()) need not resolve _proof.mjs.
  const { sign: proofSign } = await import('./_proof.mjs');
  return proofSign(artifact, sign);
}
