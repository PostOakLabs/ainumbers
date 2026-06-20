/**
 * art-47-arc-cctp-transfer.kernel.mjs
 * Arc CCTP v2 Cross-Chain USDC Transfer Validator — 6 checks, A–F grade.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * CCTP v2 (live Mar 2025): 13 domains, 30-second Fast Transfer, programmable Hooks.
 * CCTP v1 manual relay phase-out: 31 Jul 2026.
 * FATF R16 / GENIUS Act PPSI: Travel Rule applies ≥$3,000 cross-border.
 */

import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-47-arc-cctp-transfer';
const TOOL_VERSION = '1.0.0';

const CCTP_V2_DOMAINS = new Set([
  'ethereum', 'base', 'arbitrum', 'optimism', 'polygon',
  'avalanche', 'solana', 'noble', 'sui', 'linea',
  'arc', 'unichain', 'worldchain',
]);

const FAST_TRANSFER_PAIRS = new Set([
  'ethereum:base', 'base:ethereum',
  'ethereum:arbitrum', 'arbitrum:ethereum',
  'ethereum:optimism', 'optimism:ethereum',
  'arc:ethereum', 'ethereum:arc',
  'arc:base', 'base:arc',
]);

const LARGE_NOTIONAL_THRESHOLD = 1_000_000;
const TRAVEL_RULE_THRESHOLD    = 3_000;

function grade(failCount, warnCount) {
  if (failCount === 0 && warnCount === 0) return 'A';
  if (failCount === 0 && warnCount === 1) return 'B';
  if (failCount === 0 && warnCount <= 3)  return 'C';
  if (failCount === 1)                    return 'D';
  if (failCount === 2)                    return 'E';
  return 'F';
}

export function compute(pp) {
  const {
    source_domain = '',
    dest_domain   = '',
    notional_usd  = 0,
    transfer_mode = 'standard',
    hook_payload  = null,
    using_v1      = false,
  } = pp;

  const src      = source_domain.toLowerCase().trim();
  const dst      = dest_domain.toLowerCase().trim();
  const notional = Number(notional_usd) || 0;
  const isFast   = transfer_mode === 'fast';
  const pairKey  = `${src}:${dst}`;

  const checks = [];

  // Check 1: Domain eligibility
  const srcValid   = CCTP_V2_DOMAINS.has(src);
  const dstValid   = CCTP_V2_DOMAINS.has(dst);
  const domainPass = srcValid && dstValid;
  checks.push({
    id:      'domain_eligibility',
    pass:    domainPass,
    warn:    false,
    message: domainPass
      ? `Domain pair ${src}→${dst} eligible for CCTP v2 ✓`
      : !srcValid && !dstValid
        ? `Neither "${src}" nor "${dst}" is a supported CCTP v2 domain`
        : !srcValid
          ? `Source domain "${src}" is not a supported CCTP v2 domain`
          : `Destination domain "${dst}" is not a supported CCTP v2 domain`,
    cite: 'CCTP v2 docs — 13 supported domains as of Oct 2025',
  });

  // Check 2: Fast Transfer eligibility
  const fastPairKnown = FAST_TRANSFER_PAIRS.has(pairKey);
  const fastWarn      = isFast && !fastPairKnown;
  checks.push({
    id:      'fast_transfer',
    pass:    !fastWarn,
    warn:    fastWarn,
    message: !isFast
      ? 'Standard transfer mode — no Fast Transfer risk ✓'
      : fastPairKnown
        ? `Fast Transfer (30s) available for ${src}→${dst}; LP availability not guaranteed for large notionals`
        : `Fast Transfer requested for ${src}→${dst} — pair not in known Fast Transfer list; may fall back to standard (~13 min)`,
    cite: 'CCTP v2 Fast Transfer docs; LP-financed pre-mint settlement',
  });

  // Check 3: Hook payload safety
  const hasHook  = !!(hook_payload && String(hook_payload).trim().length > 0);
  const hookWarn = hasHook;
  checks.push({
    id:      'hook_safety',
    pass:    !hookWarn,
    warn:    hookWarn,
    message: hasHook
      ? 'Hook payload present — destination-side code executes on mint; verify hook contract is audited and non-reentrant'
      : 'No hook payload — clean burn-and-mint ✓',
    cite: 'CCTP v2 Hooks spec; EVM reentrancy risk (SWC-107)',
  });

  // Check 4: CCTP v1 sunset
  const v1Warn = !!using_v1;
  checks.push({
    id:      'v1_sunset',
    pass:    !v1Warn,
    warn:    v1Warn,
    message: using_v1
      ? 'CCTP v1 manual relay phase-out begins 31 Jul 2026 — migrate to CCTP v2 before deadline'
      : 'Using CCTP v2 — not affected by v1 sunset ✓',
    cite: 'Circle announcement — CCTP v1 manual relay phase-out 31 Jul 2026',
  });

  // Check 5: Large notional LP depth risk
  const lpRiskWarn = isFast && notional > LARGE_NOTIONAL_THRESHOLD;
  checks.push({
    id:      'lp_depth_risk',
    pass:    !lpRiskWarn,
    warn:    lpRiskWarn,
    message: lpRiskWarn
      ? `Notional $${notional.toLocaleString()} exceeds $1M — Fast Transfer LP pools may lack depth; risk of fallback to standard (~13 min finality)`
      : notional > LARGE_NOTIONAL_THRESHOLD && !isFast
        ? `Large notional ($${notional.toLocaleString()}) — standard CCTP sufficient; no LP depth risk ✓`
        : 'Notional within LP depth comfort zone ✓',
    cite: 'CCTP v2 Fast Transfer LP financing model',
  });

  // Check 6: Travel Rule
  const travelRuleRequired = notional >= TRAVEL_RULE_THRESHOLD;
  const travelRuleWarn     = travelRuleRequired;
  checks.push({
    id:      'travel_rule',
    pass:    !travelRuleWarn,
    warn:    travelRuleWarn,
    message: travelRuleRequired
      ? `Notional $${notional.toLocaleString()} ≥ $3,000 — FATF R16 / GENIUS Act PPSI Travel Rule: originator and beneficiary data required`
      : 'Notional below $3,000 Travel Rule threshold ✓',
    cite: 'FATF Recommendation 16; GENIUS Act PPSI AML NPRM (Fed. Reg. 2026-06963)',
  });

  const failCount    = checks.filter(c => !c.pass && !c.warn).length;
  const warnCount    = checks.filter(c => c.warn).length;
  const verdict      = failCount === 0 ? (warnCount === 0 ? 'PASS' : 'WARN') : 'FAIL';
  const overallGrade = grade(failCount, warnCount);

  const compliance_flags = checks
    .filter(c => !c.pass || c.warn)
    .map(c => c.warn ? `WARN_${c.id.toUpperCase()}` : `FAIL_${c.id.toUpperCase()}`);
  compliance_flags.push(`VERDICT_${verdict}`);

  const output_payload = {
    verdict,
    grade:        overallGrade,
    fail_count:   failCount,
    warn_count:   warnCount,
    source_domain: src || source_domain,
    dest_domain:   dst || dest_domain,
    transfer_mode,
    notional_usd:  notional,
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
    mandate_type:       'settlement_mandate',
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

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false, mandate_type: 'settlement_mandate' };
