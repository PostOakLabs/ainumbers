export const meta = {
  tool_id: '515-collateral-swap-eligibility-validator',
  mcp_name: 'validate_collateral_swap_eligibility',
  mandate_type: 'collateral_mandate',
};

const HQLA_TIERS = {
  ust:           { tier: 'Level1',   tierNum: 1,  stdHaircut: 0.00 },
  gilt:          { tier: 'Level1',   tierNum: 1,  stdHaircut: 0.00 },
  eu_sovereign:  { tier: 'Level1',   tierNum: 1,  stdHaircut: 0.00 },
  agency_mbs:    { tier: 'Level2A',  tierNum: 2,  stdHaircut: 0.15 },
  ig_corp_bond:  { tier: 'Level2B',  tierNum: 3,  stdHaircut: 0.50 },
  equity:        { tier: 'Level2B',  tierNum: 3,  stdHaircut: 0.50 },
  cash_usd:      { tier: 'Level1',   tierNum: 1,  stdHaircut: 0.00 },
  cash_eur:      { tier: 'Level1',   tierNum: 1,  stdHaircut: 0.00 },
  mmf_fund_share:{ tier: 'NON_HQLA', tierNum: 99, stdHaircut: 0.10 },
};

export function compute(pp) {
  const {
    asset_a,
    asset_b,
    notional_a,
    notional_b,
    haircut_a,
    haircut_b,
    declared_direction,
    governing_agreement,
    reuse_flag,
    sftr_consent,
    provider_informed,
    counterparty_jurisdiction,
  } = pp;

  // Effective haircuts
  const hcA = haircut_a ?? ((HQLA_TIERS[asset_a]?.stdHaircut ?? 0) * 100);
  const hcB = haircut_b ?? ((HQLA_TIERS[asset_b]?.stdHaircut ?? 0) * 100);

  const valueA = notional_a * (1 - hcA / 100);
  const valueB = notional_b * (1 - hcB / 100);
  const netEconomicValue = valueB - valueA;

  // HQLA impact
  const tierA = HQLA_TIERS[asset_a]?.tierNum ?? 99;
  const tierB = HQLA_TIERS[asset_b]?.tierNum ?? 99;

  let hqlaImpact;
  if (tierA > tierB) {
    hqlaImpact = 'UPGRADE';
  } else if (tierA < tierB) {
    hqlaImpact = 'DOWNGRADE';
  } else {
    hqlaImpact = 'NEUTRAL';
  }

  // flags accumulator: { pass, err, warn }
  const compliance_flags = {};
  const setFlag = (key, type) => {
    compliance_flags[key] = { pass: type === 'pass', err: type === 'err', warn: type === 'warn' };
  };

  // Direction mismatch
  if (declared_direction !== hqlaImpact) {
    if (declared_direction === 'upgrade' && hqlaImpact === 'DOWNGRADE') {
      setFlag('DIRECTION_MISMATCH', 'err');
    } else {
      setFlag('DIRECTION_NOTE', 'warn');
    }
  }

  // MMF hard fail
  if (asset_a === 'mmf_fund_share' || asset_b === 'mmf_fund_share') {
    setFlag('FUND_HQLA_EXCLUDED_SWAP', 'err');
    setFlag('MMF_COLLATERAL_NOTE', 'warn');
  }

  // SFTR Art 15
  const euCp = counterparty_jurisdiction === 'eu';
  if (euCp && reuse_flag && !sftr_consent) setFlag('SFTR_ART15_CONSENT_MISSING', 'err');
  if (euCp && reuse_flag && !provider_informed) setFlag('SFTR_ART15_PROVIDER_NOT_INFORMED', 'err');
  if ((sftr_consent && provider_informed) || !reuse_flag) setFlag('SFTR_ART15_COMPLIANT', 'pass');

  // Governing agreement
  if (governing_agreement === 'undefined') {
    setFlag('GOVERNING_AGREEMENT_UNDEFINED', 'err');
  } else if (governing_agreement === 'gmsla' && hqlaImpact === 'UPGRADE') {
    setFlag('GMSLA_UPGRADE_NOTE', 'pass');
  } else if (governing_agreement === 'gmra' && hqlaImpact === 'UPGRADE') {
    setFlag('GMRA_SUBSTITUTION_NOTE', 'pass');
  }

  // Eligibility
  const sftrViolation = euCp && reuse_flag && (!sftr_consent || !provider_informed);
  const hasHardFail = Object.values(compliance_flags).some(f => f.err === true);
  const hasWarn     = Object.values(compliance_flags).some(f => f.warn === true);

  let eligibility;
  if (sftrViolation || hasHardFail) {
    eligibility = 'SWAP_INELIGIBLE';
    setFlag('SWAP_INELIGIBLE', 'err');
  } else if (hasWarn) {
    eligibility = 'SWAP_ELIGIBLE_WITH_CONDITIONS';
    setFlag('SWAP_ELIGIBLE_WITH_CONDITIONS', 'warn');
  } else {
    eligibility = 'SWAP_ELIGIBLE';
    setFlag('SWAP_ELIGIBLE', 'pass');
    setFlag('COLLATERAL_SWAP_VALIDATED', 'pass');
  }

  const pacs008 = {
    instructed_amount: Math.max(valueA, valueB).toFixed(2),
    settlement_date: null,
  };

  return {
    eligibility,
    hqla_tier_a: HQLA_TIERS[asset_a]?.tier ?? null,
    hqla_tier_b: HQLA_TIERS[asset_b]?.tier ?? null,
    value_a: +valueA.toFixed(2),
    value_b: +valueB.toFixed(2),
    net_economic_value: +netEconomicValue.toFixed(2),
    hqla_impact: hqlaImpact,
    pacs008,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const result = compute(pp);
  return {
    tool_id: meta.tool_id,
    mcp_name: meta.mcp_name,
    mandate_type: meta.mandate_type,
    asset_a: pp.asset_a ?? null,
    asset_b: pp.asset_b ?? null,
    notional_a: pp.notional_a ?? null,
    notional_b: pp.notional_b ?? null,
    declared_direction: pp.declared_direction ?? null,
    ...result,
  };
}
