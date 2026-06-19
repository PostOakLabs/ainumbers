/**
 * art-45-arc-xreserve-linter.kernel.mjs
 * Arc xReserve Config Linter — 8-check A–F compliance linter.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Checks:
 *   1. reserve_sum        — usdc_pct + usyc_pct + other_pct must = 100
 *   2. us_issuers_only    — GENIUS Act §4: US-issued eligible assets only
 *   3. genius_yield       — GENIUS §4(a)(11): US PPSIs may NOT pass yield to holders
 *   4. mica_art54         — MiCA Art. 54: EU EMT issuers need reserve segregation
 *   5. usyc_ceiling       — USYC ≤ 80% (tokenized MMF; liquidity risk above 80%)
 *   6. cctp_domains       — ≥2 CCTP v2 domains for cross-chain eligibility
 *   7. attestation        — cadence must be monthly or more frequent
 *   8. role_segregation   — mint/burn roles must be separate from admin
 */

export const meta = {
  tool_id:      'art-45-arc-xreserve-linter',
  mcp_name:     'lint_arc_xreserve_config',
  mandate_type: 'compliance_mandate',
  version:      '1.0.0',
};

// Attestation cadence weights (monthly or better = pass)
const CADENCE_PASS = new Set(['daily', 'weekly', 'monthly']);

// Grade by fail + warn count
function grade(failCount, warnCount) {
  if (failCount === 0 && warnCount === 0) return 'A';
  if (failCount === 0 && warnCount <= 1)  return 'B';
  if (failCount === 0 && warnCount <= 3)  return 'C';
  if (failCount === 1)                    return 'D';
  if (failCount === 2)                    return 'E';
  return 'F';
}

export function compute(pp) {
  const {
    usdc_pct              = 0,
    usyc_pct              = 0,
    other_pct             = 0,
    us_issuers_only       = false,
    yield_enabled         = false,
    is_us_ppsi            = true,   // US Payment Stablecoin Issuer → yield prohibition applies
    is_eu_emt             = false,  // EU EMT issuer → MiCA Art. 54 applies
    reserve_segregated    = false,
    cctp_domains          = 0,
    attestation_cadence   = 'quarterly',
    mint_role_segregated  = false,
  } = pp;

  const usdcPct  = Number(usdc_pct);
  const usycPct  = Number(usyc_pct);
  const otherPct = Number(other_pct);
  const domains  = Number(cctp_domains);

  const checks = [];

  // Check 1: reserve sum
  const reserveSum = usdcPct + usycPct + otherPct;
  const reserveSumPass = Math.abs(reserveSum - 100) < 0.01;
  checks.push({
    id:      'reserve_sum',
    pass:    reserveSumPass,
    warn:    false,
    message: reserveSumPass
      ? `Reserve composition sums to 100% ✓`
      : `Reserve composition sums to ${reserveSum.toFixed(1)}% — must equal 100%`,
    cite:    'GENIUS Act §4; xReserve Program Terms §3',
  });

  // Check 2: US issuers only (GENIUS §4 eligible assets)
  const usIssuersPass = !!us_issuers_only;
  checks.push({
    id:      'us_issuers_only',
    pass:    usIssuersPass,
    warn:    false,
    message: usIssuersPass
      ? 'Reserve backed by US-issued eligible assets ✓'
      : 'GENIUS Act §4: reserve assets must be US-issued eligible instruments (Treasuries, insured deposits)',
    cite:    'GENIUS Act §4(a)',
  });

  // Check 3: yield prohibition (US PPSI only)
  const yieldWarn = is_us_ppsi && yield_enabled;
  checks.push({
    id:      'genius_yield',
    pass:    !yieldWarn,
    warn:    yieldWarn,
    message: yieldWarn
      ? 'GENIUS Act §4(a)(11): US PPSIs may NOT pass yield or interest to token holders'
      : 'Yield prohibition compliant ✓',
    cite:    'GENIUS Act §4(a)(11)',
  });

  // Check 4: MiCA Art. 54 reserve segregation (EU EMT issuers only)
  const micaApplies = !!is_eu_emt;
  const micaPass    = !micaApplies || !!reserve_segregated;
  const micaWarn    = micaApplies && !reserve_segregated;
  checks.push({
    id:      'mica_art54',
    pass:    micaPass,
    warn:    micaWarn,
    message: !micaApplies
      ? 'MiCA Art. 54 not applicable (non-EU EMT issuer)'
      : micaPass
        ? 'MiCA Art. 54: reserve assets held in segregated custody ✓'
        : 'MiCA Art. 54: EU EMT issuers must hold reserve in segregated custody accounts',
    cite:    'MiCA (EU) 2023/1114 Art. 54',
  });

  // Check 5: USYC ceiling ≤ 80%
  const usycPass = usycPct <= 80;
  const usycWarn = usycPct > 60 && usycPct <= 80;
  checks.push({
    id:      'usyc_ceiling',
    pass:    usycPass,
    warn:    usycWarn,
    message: usycPct > 80
      ? `USYC at ${usycPct}% exceeds 80% ceiling — liquidity risk (tokenized MMF redemption gates)`
      : usycWarn
        ? `USYC at ${usycPct}% — approaching 80% ceiling; consider adding liquid USDC buffer`
        : `USYC at ${usycPct}% within 80% ceiling ✓`,
    cite:    'xReserve Program Terms §4; GENIUS Act §4(a)(i) liquidity requirement',
  });

  // Check 6: CCTP v2 domains ≥ 2
  const cctpPass = domains >= 2;
  const cctpWarn = domains === 1;
  checks.push({
    id:      'cctp_domains',
    pass:    cctpPass,
    warn:    cctpWarn,
    message: domains < 1
      ? 'CCTP v2: no domains configured — cross-chain USDC bridging unavailable'
      : domains === 1
        ? `CCTP v2: only 1 domain configured — recommend ≥2 for redundancy`
        : `CCTP v2: ${domains} domains configured ✓`,
    cite:    'CCTP v2 docs; xReserve cross-chain eligibility',
  });

  // Check 7: attestation cadence ≤ monthly
  const attestPass = CADENCE_PASS.has(attestation_cadence);
  const attestWarn = !attestPass;
  checks.push({
    id:      'attestation_cadence',
    pass:    attestPass,
    warn:    attestWarn && attestation_cadence !== 'none',
    message: attestPass
      ? `Attestation cadence "${attestation_cadence}" meets monthly minimum ✓`
      : `Attestation cadence "${attestation_cadence}" is insufficient — GENIUS Act §4 and xReserve require at least monthly attestation`,
    cite:    'GENIUS Act §4; xReserve Program Terms §5',
  });

  // Check 8: mint/burn role segregation
  const rolePass = !!mint_role_segregated;
  checks.push({
    id:      'role_segregation',
    pass:    rolePass,
    warn:    false,
    message: rolePass
      ? 'Mint/burn roles segregated from admin ✓'
      : 'Mint/burn roles must be segregated from admin — prevents single-key mint-and-transfer attacks',
    cite:    'GENIUS Act §4(a)(8); xReserve Program Terms §6',
  });

  // Aggregate
  const failCount = checks.filter(c => !c.pass && !c.warn).length;
  const warnCount = checks.filter(c => c.warn).length;
  const verdict   = failCount === 0 ? (warnCount === 0 ? 'PASS' : 'WARN') : 'FAIL';
  const overallGrade = grade(failCount, warnCount);

  const compliance_flags = checks
    .filter(c => !c.pass || c.warn)
    .map(c => c.warn ? `WARN_${c.id.toUpperCase()}` : `FAIL_${c.id.toUpperCase()}`);
  compliance_flags.push(`VERDICT_${verdict}`);
  compliance_flags.push(`GRADE_${overallGrade}`);

  return {
    verdict,
    grade:     overallGrade,
    fail_count: failCount,
    warn_count: warnCount,
    checks,
    compliance_flags,
  };
}

export function buildArtifact(pp, opts = {}) {
  const r = compute(pp);
  return {
    tool_id:          meta.tool_id,
    mandate_type:     meta.mandate_type,
    verdict:          r.verdict,
    grade:            r.grade,
    fail_count:       r.fail_count,
    warn_count:       r.warn_count,
    checks:           r.checks,
    compliance_flags: r.compliance_flags,
    inputs:           pp,
  };
}
