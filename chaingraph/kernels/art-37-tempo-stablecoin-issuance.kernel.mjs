/**
 * art-37-tempo-stablecoin-issuance.kernel.mjs
 * Tempo Stablecoin Issuance — GENIUS Act + MiCA compliance validator.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-37-tempo-stablecoin-issuance';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'validate_tempo_token_compliance',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

export function compute(pp) {
  const tokenName        = pp.tokenName        ?? '';
  const currencyCode     = (pp.currencyCode    ?? '').toUpperCase();
  const supplyCap        = pp.supplyCap        ?? 0;
  const issuerLei        = pp.issuerLei        ?? null;
  const memoPolicy       = pp.memoPolicy       ?? 'optional';
  const roleIssuer       = !!pp.roleIssuer;
  const rolePause        = !!pp.rolePause;
  const roleBurnBlocked  = !!pp.roleBurnBlocked;
  const yieldEnabled     = !!pp.yieldEnabled;
  const allowlistEnabled = !!pp.allowlistEnabled;
  const blocklistEnabled = !!pp.blocklistEnabled;
  const freezeEnabled    = !!pp.freezeEnabled;
  const ofacEnabled      = !!pp.ofacEnabled;

  // GENIUS checks
  const currency_pass      = currencyCode === 'USD';
  const supply_cap_pass    = supplyCap > 0;
  const rbac_pass          = roleIssuer && rolePause;
  const burn_blocked_warn  = !roleBurnBlocked;  // true = warn present
  const yield_warning      = yieldEnabled;       // true = warning
  const freeze_pass        = freezeEnabled;
  const ofac_pass          = ofacEnabled;

  const genius = {
    currency_pass,
    supply_cap_pass,
    rbac_pass,
    burn_blocked_warn,
    yield_warning,
    freeze_pass,
    ofac_pass,
  };

  // MiCA checks
  const reserve_disclosure = true; // always hardcoded warn
  const pause_capability   = rolePause;

  const mica = {
    reserve_disclosure,
    pause_capability,
  };

  // Verdict
  const failCount = [!currency_pass, !supply_cap_pass, !rbac_pass, !freeze_pass, !ofac_pass]
    .filter(Boolean).length;
  const warnCount = [burn_blocked_warn, yield_warning, !pause_capability]
    .filter(Boolean).length;

  const verdict = failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS';

  // Compliance flags (filter nulls)
  const compliance_flags = [
    currency_pass  ? 'CURRENCY_CODE_USD_PASS'      : 'CURRENCY_CODE_FAIL',
    rbac_pass      ? 'RBAC_ISSUER_PAUSE_PASS'       : 'RBAC_FAIL',
    freeze_pass    ? 'FREEZE_CAPABILITY_PASS'        : 'FREEZE_CAPABILITY_FAIL',
    ofac_pass      ? 'OFAC_SDN_SCREENING_PASS'       : 'OFAC_SDN_SCREENING_FAIL',
    yield_warning  ? 'GENIUS_YIELD_WARNING'          : null,
    'VERDICT_' + verdict,
  ].filter(Boolean);

  const output_payload = {
    verdict,
    fail_count: failCount,
    warn_count: warnCount,
    genius,
    mica,
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
