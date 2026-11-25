/**
 * art-37-tempo-stablecoin-issuance.kernel.mjs
 * Tempo Stablecoin Issuance — GENIUS Act + MiCA compliance validator.
 * Pure decision kernel — no DOM, no window, no Date.now().
 *
 * Missing input (fail-closed): all eight manifest-required boolean flags must be present. A missing,
 * null, empty or whitespace-only required flag yields verdict 'INDETERMINATE' with
 * missing_required_fields, never PASS or WARN. The three previously read-and-ignored / defaulted
 * flags (allowlistEnabled, blocklistEnabled, yieldEnabled) are presence-checked literally so their
 * absence can no longer be silently treated as false. This kernel had no refusal/indeterminate
 * vocabulary before this edit; verdict 'INDETERMINATE' is introduced in output_payload only when a
 * required flag is missing, and only then is missing_required_fields added. All other outputs for
 * complete inputs give the same outputs as before, so goldens for valid vectors do not move.
 * buildArtifact never throws: an unhashable input (non-finite number, unsafe integer, depth or size
 * past the hash limits) returns a refusal artifact with execution_hash null and hash_refusal.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-37-tempo-stablecoin-issuance';
const TOOL_VERSION = '1.0.1';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'validate_tempo_token_compliance',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

function isFilled(v) { return v != null && !(typeof v === 'string' && v.trim() === ''); }

export function compute(pp) {
  pp = pp || {};
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

  // Required inputs per the manifest inputSchema.required, read literally (no dynamic pp[f]
  // lookup). A missing, null, empty or whitespace-only required flag yields INDETERMINATE,
  // never PASS or WARN.
  const missing_required_fields = [];
  if (!isFilled(pp.allowlistEnabled)) missing_required_fields.push('allowlistEnabled');
  if (!isFilled(pp.blocklistEnabled)) missing_required_fields.push('blocklistEnabled');
  if (!isFilled(pp.freezeEnabled)) missing_required_fields.push('freezeEnabled');
  if (!isFilled(pp.ofacEnabled)) missing_required_fields.push('ofacEnabled');
  if (!isFilled(pp.roleBurnBlocked)) missing_required_fields.push('roleBurnBlocked');
  if (!isFilled(pp.roleIssuer)) missing_required_fields.push('roleIssuer');
  if (!isFilled(pp.rolePause)) missing_required_fields.push('rolePause');
  if (!isFilled(pp.yieldEnabled)) missing_required_fields.push('yieldEnabled');
  const indeterminate = missing_required_fields.length > 0;
  const verdict = indeterminate ? 'INDETERMINATE' : failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS';

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
  if (indeterminate) output_payload.missing_required_fields = missing_required_fields;
  return { output_payload, compliance_flags };
}

// Mirrors _hash.mjs limits so buildArtifact never throws: non-finite number, unsafe integer,
// nesting past MAX_DEPTH, more values than MAX_ELEMENTS. Reports path and kind only.
const HASH_MAX_DEPTH = 512;
const HASH_MAX_ELEMENTS = 1000000;
function findHashRefusal(v, path, depth, budget) {
  if (depth > HASH_MAX_DEPTH) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > HASH_MAX_ELEMENTS) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  return null;
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const unhashable = findHashRefusal(pp, 'pp', 1, { n: 0 });
  if (unhashable !== null) {
    return {
      '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
      chaingraph_version: '0.4.0',
      mandate_type: meta.mandate_type,
      tool_id: TOOL_ID,
      tool_version: TOOL_VERSION,
      generated_at: now ?? null,
      execution_hash: null,
      hash_refusal: { reason: unhashable.reason, detail: unhashable.detail },
      chain: { parent_hashes, parent_tool_ids, chain_depth },
      policy_parameters: null,
      output_payload: { verdict: 'REFUSED', fail_count: null, warn_count: null, refusal: unhashable.reason },
      compliance_flags: ['INPUT_REFUSED'],
      compute_mode: 'server',
      audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
    };
  }
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
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
