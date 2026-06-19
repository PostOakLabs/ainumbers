/**
 * art-39-tempo-zone-disclosure.kernel.mjs
 * Tempo Zone Disclosure — privacy-layer and AML attestation validator.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */

export const meta = {
  tool_id:      'art-39-tempo-zone-disclosure',
  mcp_name:     'validate_tempo_zone_disclosure',
  mandate_type: 'attestation_mandate',
  version:      '1.0.0',
};

export function compute(pp) {
  const opSeesAll    = !!pp.opSeesAll;
  const userSeesOwn  = !!pp.userSeesOwn;
  const outsidersZK  = !!pp.outsidersZK;
  const tip403Allow  = !!pp.tip403Allow;
  const tip403Block  = !!pp.tip403Block;
  const tip403Freeze = !!pp.tip403Freeze;
  const tip403Mainnet = !!pp.tip403Mainnet;
  const amlTravel    = !!pp.amlTravel;
  const amlSAR       = !!pp.amlSAR;
  const amlOFAC      = !!pp.amlOFAC;
  const amlAudit     = !!pp.amlAudit;
  const operatorName = pp.operatorName ?? '';
  const useCase      = pp.useCase      ?? 'other';

  const checks = {
    AML_COVERAGE_MAINTAINED:      opSeesAll && (amlOFAC || amlSAR),
    TIP403_CROSS_ZONE:            tip403Allow && tip403Block && tip403Freeze && tip403Mainnet,
    TRAVEL_RULE_COMPLIANT:        !!amlTravel,
    REGULATOR_AUDIT_CAPABLE:      !!amlAudit,
    SELECTIVE_DISCLOSURE_CONFIRMED: userSeesOwn && outsidersZK,
    COMPETITIVE_CONFIDENTIALITY:  !!outsidersZK,
    OPERATOR_SEES_ALL:            !!opSeesAll,
    TIP403_ALLOWLIST:             !!tip403Allow,
    TIP403_BLOCKLIST:             !!tip403Block,
    TIP403_FREEZE:                !!tip403Freeze,
  };

  const hasFail = !checks.AML_COVERAGE_MAINTAINED || !checks.OPERATOR_SEES_ALL;
  const hasWarn = !checks.TRAVEL_RULE_COMPLIANT;

  const verdict = hasFail ? 'INSUFFICIENT'
    : hasWarn ? 'PARTIAL_ATTESTATION'
    : 'FULL_ATTESTATION';

  return {
    verdict,
    operator_name:    operatorName,
    use_case:         useCase,
    checks,
    compliance_flags: [],
  };
}

export function buildArtifact(pp, opts = {}) {
  const r = compute(pp);
  return {
    tool_id:          meta.tool_id,
    mandate_type:     meta.mandate_type,
    verdict:          r.verdict,
    operator_name:    r.operator_name,
    use_case:         r.use_case,
    checks:           r.checks,
    compliance_flags: r.compliance_flags,
    inputs:           pp,
  };
}
