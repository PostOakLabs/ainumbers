import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-13-eudi-wallet-credential-readiness-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'check_eudi_readiness',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

export function compute(pp) {
  const credType = pp.credential_type || 'eaa';
  const format = pp.format || 'sd_jwt_vc';
  const issuerCountry = (pp.issuer_country || '').toUpperCase();
  const claims = pp.claims || {};
  const sd = pp.sd !== false && pp.sd !== 'false';
  const pop = pp.pop !== false && pp.pop !== 'false';
  const rev = pp.rev !== false && pp.rev !== 'false';
  const accred = pp.accred === true || pp.accred === 'true';

  const EU27 = new Set(['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK']);

  const maxScore = credType === 'qeaa' ? 10 : credType === 'pid' ? 9 : 8;

  const checkResults = [];
  let score = 0;

  // C01
  const c01Pass = ['sd_jwt_vc','mdoc_cbor'].includes(format);
  checkResults.push({ id: 'C01', status: c01Pass ? 'pass' : 'warn', score_added: c01Pass ? 1 : 0 });
  score += c01Pass ? 1 : 0;

  // C02
  if (credType !== 'non_qualified_eaa') {
    const c02Pass = sd;
    checkResults.push({ id: 'C02', status: c02Pass ? 'pass' : 'fail', score_added: c02Pass ? 1 : 0 });
    score += c02Pass ? 1 : 0;
  }

  // C03
  if (['sd_jwt_vc','mdoc_cbor'].includes(format)) {
    const c03Pass = pop;
    checkResults.push({ id: 'C03', status: c03Pass ? 'pass' : 'fail', score_added: c03Pass ? 1 : 0 });
    score += c03Pass ? 1 : 0;
  }

  // C04
  const c04Pass = rev;
  checkResults.push({ id: 'C04', status: c04Pass ? 'pass' : 'warn', score_added: c04Pass ? 1 : 0 });
  score += c04Pass ? 1 : 0;

  // C05 (qeaa only)
  if (credType === 'qeaa') {
    const c05Pass = accred;
    checkResults.push({ id: 'C05', status: c05Pass ? 'pass' : 'fail', score_added: c05Pass ? 1 : 0 });
    score += c05Pass ? 1 : 0;
  }

  // C06 (pid only)
  if (credType === 'pid') {
    const required = ['family_name','given_name','birth_date','age_over_18','nationality','issuing_country','issuing_authority','document_number'];
    const missing = required.filter(k => !(k in claims));
    let c06Score, c06Status;
    if (missing.length === 0) { c06Score = 1; c06Status = 'pass'; }
    else if (missing.length <= 2) { c06Score = 0.5; c06Status = 'warn'; }
    else { c06Score = 0; c06Status = 'fail'; }
    checkResults.push({ id: 'C06', status: c06Status, score_added: c06Score });
    score += c06Score;
  }

  // C07 (qeaa|eaa only)
  if (credType === 'qeaa' || credType === 'eaa') {
    const required = ['issuer','subject','issuanceDate','expirationDate','credentialType','attestation_type'];
    const missing = required.filter(k => !(k in claims));
    let c07Score, c07Status;
    if (missing.length === 0) { c07Score = 1; c07Status = 'pass'; }
    else if (missing.length === 1) { c07Score = 0.5; c07Status = 'warn'; }
    else { c07Score = 0; c07Status = 'fail'; }
    checkResults.push({ id: 'C07', status: c07Status, score_added: c07Score });
    score += c07Score;
  }

  // C08
  const c08Pass = EU27.has(issuerCountry);
  checkResults.push({ id: 'C08', status: c08Pass ? 'pass' : 'warn', score_added: c08Pass ? 1 : 0 });
  score += c08Pass ? 1 : 0;

  // C09 (always warn, +0.5)
  checkResults.push({ id: 'C09', status: 'warn', score_added: 0.5 });
  score += 0.5;

  // C10 (non_qualified_eaa only)
  if (credType === 'non_qualified_eaa') {
    checkResults.push({ id: 'C10', status: 'warn', score_added: 0 });
  }

  const readinessScore = Math.round(Math.min(score / maxScore, 1) * 100);
  const failChecks = checkResults.filter(c => c.status === 'fail');
  const failCount = failChecks.length;
  const acceptanceReady = readinessScore >= 80 && failCount === 0;

  let compliance_flags;
  if (acceptanceReady) {
    compliance_flags = ['EUDI_WALLET_READY', 'EIDEAS2_COMPLIANT'];
  } else if (readinessScore >= 60) {
    compliance_flags = ['EUDI_WALLET_PARTIAL', 'REMEDIATION_REQUIRED'];
  } else {
    compliance_flags = ['EUDI_WALLET_NOT_READY', 'CRITICAL_GAPS'];
  }

  const verdict = acceptanceReady
    ? 'ACCEPTANCE READY'
    : readinessScore >= 60
      ? 'PARTIAL READINESS — GAPS IDENTIFIED'
      : 'NOT READY — CRITICAL GAPS';

  const output_payload = {
    acceptance_ready: acceptanceReady,
    readiness_score: readinessScore,
    verdict,
    gaps: failChecks.map(c => c.id),
    fail_count: failCount,
    credential_type: credType,
    format,
    issuer_country: issuerCountry,
    check_results: checkResults,
  };
  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    ap2_version: '1.0.0',
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
