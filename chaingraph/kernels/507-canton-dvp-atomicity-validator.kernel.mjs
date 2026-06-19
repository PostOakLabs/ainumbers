export const meta = {
  tool_id: '507-canton-dvp-atomicity-validator',
  mcp_name: 'validate_canton_dvp_atomicity',
  mandate_type: 'settlement_mandate',
};

export function compute(pp) {
  const {
    settlement_mechanism,
    platform,
    finality_type,
    unwind_protection,
    cash_type,
    settlement_amount,
    currency,
  } = pp;

  // Atomicity branch
  let atomicityFlag, atomicity_status;

  if (
    settlement_mechanism === 'atomic_dvp' &&
    (platform === 'canton_daml' || platform === 'canton_composerx')
  ) {
    atomicityFlag = 'ATOMICITY_PFMI_P12_COMPLIANT';
    atomicity_status = 'COMPLIANT';
  } else if (
    settlement_mechanism === 'atomic_dvp' &&
    platform === 'traditional_csd'
  ) {
    atomicityFlag = 'ATOMICITY_CONDITIONAL';
    atomicity_status = 'CONDITIONAL';
  } else if (settlement_mechanism === 'sequential_with_lock') {
    atomicityFlag = 'ATOMICITY_CONDITIONAL';
    atomicity_status = 'CONDITIONAL';
  } else if (settlement_mechanism === 'free_delivery') {
    atomicityFlag = 'ATOMICITY_FAILED';
    atomicity_status = 'FAILED';
  } else {
    atomicityFlag = 'ATOMICITY_CONDITIONAL';
    atomicity_status = 'CONDITIONAL';
  }

  // Finality
  const FINALITY_FLAGS = {
    irrevocable_realtime: 'FINALITY_IRREVOCABLE_REALTIME',
    irrevocable_eod:      'FINALITY_IRREVOCABLE_EOD',
    provisional:          'FINALITY_PROVISIONAL',
  };
  const finalityFlag = FINALITY_FLAGS[finality_type] ?? 'FINALITY_UNDEFINED';

  // Herstatt
  const herstatt_eliminated = atomicityFlag === 'ATOMICITY_PFMI_P12_COMPLIANT';

  // Verdict
  const isCompliantAtomicity = atomicityFlag === 'ATOMICITY_PFMI_P12_COMPLIANT';
  const isGoodFinality = finality_type === 'irrevocable_realtime' || finality_type === 'irrevocable_eod';
  const isBadFinality = finality_type === 'undefined';
  const isProvisionalNoUnwind = finality_type === 'provisional' && !unwind_protection;

  let verdict;
  if (isCompliantAtomicity && isGoodFinality && unwind_protection === true) {
    verdict = 'PASS';
  } else if (
    settlement_mechanism === 'free_delivery' ||
    finality_type === 'undefined' ||
    isProvisionalNoUnwind
  ) {
    verdict = 'FAIL';
  } else {
    verdict = 'CONDITIONAL';
  }

  const compliance_flags = {
    DVP_ATOMICITY_VALIDATED: true,
    [atomicityFlag]: true,
    [finalityFlag]: true,
    HERSTATT_RISK_ELIMINATED: herstatt_eliminated,
    HERSTATT_RISK_PRESENT: !herstatt_eliminated,
  };

  if (cash_type === 'wire') {
    compliance_flags.CASH_LEG_NOT_DIGITAL = true;
  }

  return {
    verdict,
    atomicity_status,
    atomicity_flag: atomicityFlag,
    finality_flag: finalityFlag,
    herstatt_eliminated,
    settlement_amount,
    currency,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    platform: pp.platform ?? null,
    ...result,
  };
}
