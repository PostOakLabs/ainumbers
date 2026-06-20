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

import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-45-arc-xreserve-linter';
const TOOL_VERSION = '1.0.0';

const CADENCE_PASS = new Set(['daily', 'weekly', 'monthly']);

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
    usdc_pct             = 0,
    usyc_pct             = 0,
    other_pct            = 0,
    us_issuers_only      = false,
    yield_enabled        = false,
    is_us_ppsi           = true,
    is_eu_emt            = false,
    reserve_segregated   = false,
    cctp_domains         = 0,
    attestation_cadence  = 'quarterly',
    mint_role_segregated = false,
  } = pp;

  const usdcPct  = Number(usdc_pct);
  const usycPct  = Number(usyc_pct);
  const otherPct = Number(other_pct);
  const domains  = Number(cctp_domains);

  const checks = [];

  // Check 1: reserve sum
  const reserveSum     = usdcPct + usycPct + otherPct;
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

  // Check 2: US issuers only
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

  // Check 3: yield prohibition
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

  // Check 4: MiCA Art. 54 reserve segregation
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

  // Check 7: attestation cadence
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

  const failCount    = checks.filter(c => !c.pass && !c.warn).length;
  const warnCount    = checks.filter(c => c.warn).length;
  const verdict      = failCount === 0 ? (warnCount === 0 ? 'PASS' : 'WARN') : 'FAIL';
  const overallGrade = grade(failCount, warnCount);

  const compliance_flags = checks
    .filter(c => !c.pass || c.warn)
    .map(c => c.warn ? `WARN_${c.id.toUpperCase()}` : `FAIL_${c.id.toUpperCase()}`);
  compliance_flags.push(`VERDICT_${verdict}`);
  compliance_flags.push(`GRADE_${overallGrade}`);

  const output_payload = {
    verdict,
    grade:      overallGrade,
    fail_count: failCount,
    warn_count: warnCount,
    checks,
    compliance_flags,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       'compliance_mandate',
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    compute_mode:       'server',
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false, mandate_type: 'compliance_mandate' };
