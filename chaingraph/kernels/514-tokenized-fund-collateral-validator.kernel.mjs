export const meta = {
  tool_id: '514-tokenized-fund-collateral-validator',
  mcp_name: 'validate_fund_collateral',
  mandate_type: 'collateral_mandate',
};

const SEC_TYPES = ['sec_govt_mmf','sec_retail_prime_mmf','sec_inst_prime_mmf'];
const EU_TYPES  = ['eu_cnav','eu_lvnav','eu_vnav'];

export function compute(pp) {
  const {
    fund_type,
    total_fund_value,
    daily_liquid_assets_pct: dla,
    weekly_liquid_assets_pct: wla,
    nav,
    collateral_use,
    platform,
    sftr_consent,
    reuse_flag,
    cp_jurisdiction,
  } = pp;

  const isSecRegime = SEC_TYPES.includes(fund_type);
  const isEuRegime  = EU_TYPES.includes(fund_type);

  // flags accumulator: { pass, err, warn }
  const compliance_flags = {};
  const setFlag = (key, type) => {
    compliance_flags[key] = { pass: type === 'pass', err: type === 'err', warn: type === 'warn' };
  };

  // SEC Rule 2a-7 checks
  if (isSecRegime) {
    if (dla < 25) setFlag('SEC_2A7_DLA_BREACH', 'err');
    if (wla < 50) setFlag('SEC_2A7_WLA_BREACH', 'err');
    if (fund_type === 'sec_inst_prime_mmf' && Math.abs(nav - 1.0) < 0.0001) setFlag('SEC_2A7_FNAV_REQUIRED', 'err');
    if (fund_type === 'sec_inst_prime_mmf' && wla < 30) setFlag('SEC_2A7_LIQUIDITY_FEE_TRIGGERED', 'warn');
  }

  // EU MMFR checks
  if (isEuRegime) {
    const dlaThr = fund_type === 'eu_vnav' ? 7.5 : 10;
    const wlaThr = fund_type === 'eu_vnav' ? 15 : 30;
    if (dla < dlaThr) setFlag('EU_MMFR_DLA_BREACH', 'err');
    if (wla < wlaThr) setFlag('EU_MMFR_WLA_BREACH', 'err');
    if (fund_type === 'eu_lvnav' && Math.abs(nav - 1.0) > 0.0020) setFlag('LVNAV_COLLAR_BREACHED', 'err');
  }

  // Collateral use
  if (collateral_use === 'repo_collateral')  setFlag('REPO_COLLATERAL_INELIGIBLE', 'err');
  if (collateral_use === 'im_derivative')    setFlag('IM_NON_STANDARD_COLLATERAL', 'warn');
  if (collateral_use === 'vm_derivative')    setFlag('VM_NON_STANDARD_COLLATERAL', 'warn');
  if (collateral_use === 'lender_collateral') setFlag('LENDER_COLLATERAL_CHECK', 'pass');

  // Canton
  if (platform === 'canton_benji') setFlag('CANTON_BENJI_PLATFORM', 'pass');

  // Haircut
  const isGovt = ['sec_govt_mmf','other_govt_fund','eu_cnav'].includes(fund_type);
  const haircut = isGovt ? 0 : 0.10;
  const adjusted_collateral_value = +(total_fund_value * (1 - haircut)).toFixed(2);

  // Always set
  setFlag('FUND_HQLA_EXCLUDED', 'pass'); // pass:false per spec — but the structure requires a type
  compliance_flags.FUND_HQLA_EXCLUDED = { pass: false, err: false, warn: false };
  setFlag('FUND_COLLATERAL_VALIDATED', 'pass');

  // Eligibility
  const hasHardFail = Object.values(compliance_flags).some(f => f.err === true);
  const hasWarn     = Object.values(compliance_flags).some(f => f.warn === true);

  let eligibility;
  if (collateral_use === 'repo_collateral' || hasHardFail) {
    eligibility = 'INELIGIBLE';
  } else if (hasWarn) {
    eligibility = 'ELIGIBLE_WITH_CONDITIONS';
  } else {
    eligibility = 'ELIGIBLE';
  }

  return {
    eligibility,
    haircut_applied: haircut,
    adjusted_collateral_value,
    hqla_tier: 'NON_HQLA',
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    fund_type: pp.fund_type ?? null,
    total_fund_value: pp.total_fund_value ?? null,
    collateral_use: pp.collateral_use ?? null,
    ...result,
  };
}
