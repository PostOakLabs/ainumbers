export const meta = {
  tool_id: 'art-14-psd3-psr-readiness-checker',
  mcp_name: 'assess_psd3_readiness',
  mandate_type: 'compliance_mandate',
};

export function compute(pp) {
  const instType = pp.instType || 'payment_institution';
  const jurisdiction = pp.jurisdiction || 'eu_single';
  const psd2Status = pp.psd2Status || 'mostly_compliant';
  const openBankingLevel = pp.openBankingLevel || 'ob_testing';
  const tppTypes = Array.isArray(pp.tppTypes) ? pp.tppTypes : (pp.tppTypes ? [pp.tppTypes] : ['tpp_none']);
  const scaExemptions = Array.isArray(pp.scaExemptions) ? pp.scaExemptions : (pp.scaExemptions ? [pp.scaExemptions] : ['sca_none']);
  const consentMaturity = pp.consentMaturity || 'standard';
  const openFinance = Array.isArray(pp.openFinance) ? pp.openFinance : (pp.openFinance ? [pp.openFinance] : ['of_none']);
  const fraudLiability = pp.fraudLiability || 'shared';
  const baasScope = pp.baasScope || 'none';

  // D1: openFinance (weight 0.20)
  let d1 = 50;
  if (openBankingLevel === 'ob_live') d1 += 25;
  else if (openBankingLevel === 'ob_testing') d1 += 10;
  const ofCategories = ['of_savings','of_investments','of_insurance','of_pension','of_mortgage'];
  ofCategories.forEach(c => { if (openFinance.includes(c)) d1 += 5; });
  if (psd2Status === 'fully_compliant') d1 += 15;
  else if (psd2Status === 'mostly_compliant') d1 += 8;
  d1 = Math.min(d1, 100);

  // D2: tppCategorisation (weight 0.18)
  let d2 = 40;
  if (tppTypes.includes('tpp_pisp')) d2 += 15;
  if (tppTypes.includes('tpp_aisp')) d2 += 15;
  if (tppTypes.includes('tpp_piisp')) d2 += 15;
  if (tppTypes.includes('tpp_none')) d2 -= 10;
  if (instType === 'fintech_tpp') d2 += 10;
  if (instType === 'baas_platform') d2 += 5;
  d2 = Math.max(0, Math.min(d2, 100));

  // D3: scaAlignment (weight 0.18)
  let d3 = 30;
  const scaItems = ['sca_low_value','sca_recurring','sca_trusted','sca_tra','sca_corp'];
  scaItems.forEach(e => { if (scaExemptions.includes(e)) d3 += 12; });
  if (scaExemptions.includes('sca_none')) d3 = 20;
  d3 = Math.min(d3, 100);

  // D4: consentFramework (weight 0.20)
  const consentBaseMap = { advanced: 90, standard: 65, basic: 35, none: 10 };
  let d4 = consentBaseMap[consentMaturity] || 65;
  if (instType === 'baas_platform' && consentMaturity !== 'advanced') d4 -= 15;

  // D5: fraudLiability (weight 0.14)
  const fraudBaseMap = { zero_liability: 90, shared: 70, payer_bears: 40, undefined: 15 };
  let d5 = fraudBaseMap[fraudLiability] || 70;
  if (jurisdiction.includes('uk')) d5 = Math.max(10, d5 - 10);

  // D6: embeddedFinance (weight 0.10)
  const baasBaseMap = { none: 80, limited: 65, moderate: 50, extensive: 30 };
  let d6 = baasBaseMap[baasScope] || 80;
  if (baasScope === 'extensive' && psd2Status !== 'fully_compliant') d6 -= 20;
  if (baasScope === 'extensive' && consentMaturity === 'advanced') d6 += 20;
  d6 = Math.max(0, Math.min(d6, 100));

  const domains = [
    { key: 'd1', score: d1, weight: 0.20 },
    { key: 'd2', score: d2, weight: 0.18 },
    { key: 'd3', score: d3, weight: 0.18 },
    { key: 'd4', score: d4, weight: 0.20 },
    { key: 'd5', score: d5, weight: 0.14 },
    { key: 'd6', score: d6, weight: 0.10 },
  ];

  const overall = Math.round(domains.reduce((s, d) => s + d.score * d.weight, 0));

  const band = overall >= 80
    ? 'Strong Readiness'
    : overall >= 60
      ? 'Moderate Readiness'
      : overall >= 40
        ? 'Partial Readiness'
        : 'Early Stage';

  const critGaps = domains.filter(d => d.score < 40).length;

  const verdict = (critGaps >= 3 || overall < 40)
    ? 'High Regulatory Risk'
    : (critGaps >= 1 || overall < 65)
      ? 'Moderate Readiness — Targeted Gap Remediation Required'
      : 'Strong PSD3/PSR Readiness — Monitor & Maintain';

  const complianceFlags = [
    'PSD3_PSR_READINESS_ASSESSED',
    'COMPLIANCE_MANDATE_ISSUED',
    overall >= 75 ? 'PSD3_STRONG_READINESS' : 'PSD3_GAP_REMEDIATION_REQUIRED',
    critGaps > 0 ? 'CRITICAL_GAPS_IDENTIFIED' : 'NO_CRITICAL_GAPS',
  ];
  if (jurisdiction.includes('uk')) complianceFlags.push('UK_PSR_SCOPE');
  if (!tppTypes.includes('tpp_none')) complianceFlags.push('TPP_LICENSED');
  complianceFlags.push('CONSENT_MATURITY_' + consentMaturity.toUpperCase());

  return {
    overall_readiness_score: overall,
    band,
    verdict,
    critical_gaps: critGaps,
    domain_scores: { d1, d2, d3, d4, d5, d6 },
    compliance_flags: complianceFlags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    output_payload: result,
    compliance_flags: result.compliance_flags,
  };
}
