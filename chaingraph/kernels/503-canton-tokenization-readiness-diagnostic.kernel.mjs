import { executionHash } from './_hash.mjs';

const TOOL_ID = '503-canton-tokenization-readiness-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'diagnose_canton_readiness',
  mandate_type: 'readiness_diagnostic',
  gpu: false,
};

const DOMAINS = [
  { key: 'settlement_ops',      weight: 20, qs: ['q1','q2'] },
  { key: 'custody_eligibility', weight: 18, qs: ['q3','q4'] },
  { key: 'cash_leg',            weight: 18, qs: ['q5','q6'] },
  { key: 'privacy_disclosure',  weight: 14, qs: ['q7','q8'] },
  { key: 'aml_kya',             weight: 15, qs: ['q9','q10'] },
  { key: 'capital_governance',  weight: 15, qs: ['q11','q12'] },
];

const GAP_THRESHOLDS = {
  settlement_ops:      10,
  custody_eligibility:  9,
  cash_leg:             9,
  privacy_disclosure:   7,
  aml_kya:              7.5,
  capital_governance:   7.5,
};

const GAP_FLAG_KEYS = {
  settlement_ops:      'SETTLEMENT_OPS_GAP',
  custody_eligibility: 'CUSTODY_ELIGIBILITY_GAP',
  cash_leg:            'CASH_LEG_GAP',
  privacy_disclosure:  'PRIVACY_DISCLOSURE_GAP',
  aml_kya:             'AML_KYA_GAP',
  capital_governance:  'CAPITAL_GOVERNANCE_GAP',
};

function getGrade(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  if (score >= 25) return 'E';
  return 'F';
}

export function compute(pp) {
  const domain_scores = {};
  const gaps = [];

  for (const d of DOMAINS) {
    const yesCount = d.qs.filter(q => pp[q] === 'yes').length;
    const dScore = (yesCount / 2) * d.weight;
    domain_scores[d.key] = dScore;
    if (dScore < GAP_THRESHOLDS[d.key]) {
      gaps.push(d.key);
    }
  }

  const total_score = +Object.values(domain_scores).reduce((a, b) => a + b, 0).toFixed(1);
  const grade = getGrade(total_score);
  const isReady = grade === 'A' || grade === 'B';

  const compliance_flags = ['CANTON_READINESS_SCORED'];
  if (isReady) compliance_flags.push('CANTON_READY');
  if (!isReady) compliance_flags.push('NOT_CANTON_READY');

  for (const [key, flagKey] of Object.entries(GAP_FLAG_KEYS)) {
    if (gaps.includes(key)) compliance_flags.push(flagKey);
  }

  const output_payload = { verdict: grade, total_score, domain_scores, gaps };
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
