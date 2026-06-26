/**
 * rca-03-iso20022-address-migration-verifier.kernel.mjs
 * ISO 20022 Address Migration Verifier — fully deterministic, no PRNG.
 * Pure decision kernel — no DOM, no window, no Date.now().
 */

import { executionHash } from './_hash.mjs';

export const meta = {
  tool_id:      'rca-03-iso20022-address-migration-verifier',
  mcp_name:     'verify_address_migration_batch',
  mandate_type: 'compliance_mandate',
  version:      '1.0.0',
};

const TOOL_ID      = 'rca-03-iso20022-address-migration-verifier';
const TOOL_VERSION = '1.0.0';

// ── Field limits (ISO 20022 pacs.008 Nov 2026) ───────────────────────────────
const LIMITS = {
  nm:   140,  // BIC name
  strt: 70,   // StreetName
  bldg: 16,   // BuildingNumber
  pst:  16,   // PostCode
  twn:  35,   // TownName
  ctry: 2,    // Country (ISO 3166-1 alpha-2)
};

// ── Country allowlist (ISO 3166-1 alpha-2, common subset) ────────────────────
const VALID_COUNTRIES = new Set([
  'DE','FR','IT','ES','NL','PL','SE','GB','AT','BE','CH','DK','NO','FI',
  'PT','IE','CZ','HU','RO','SK','SI','HR','BG','EE','LV','LT','LU','MT',
  'CY','GR','US','CA','AU','JP','SG','HK','AE','IN','BR','ZA',
]);

// ── Country-specific address rules ────────────────────────────────────────────
const COUNTRY_RULES = {
  GB: { requires_postcode: true,  postcode_pattern: /^[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}$/i },
  US: { requires_postcode: true,  postcode_pattern: /^\d{5}(-\d{4})?$/ },
  DE: { requires_postcode: true,  postcode_pattern: /^\d{5}$/ },
  FR: { requires_postcode: true,  postcode_pattern: /^\d{5}$/ },
  NL: { requires_postcode: true,  postcode_pattern: /^\d{4}\s*[A-Z]{2}$/i },
};

// ── Per-record validator ──────────────────────────────────────────────────────
function validateRecord(rec, strictness, truncThreshold) {
  const issues = [];
  let truncation_risk = false;

  // Required fields
  if (!rec.nm   || rec.nm.trim()   === '') issues.push('MISSING_NAME');
  if (!rec.ctry || rec.ctry.trim() === '') issues.push('MISSING_COUNTRY');
  if (!rec.twn  || rec.twn.trim()  === '') issues.push('MISSING_TOWN');

  // Country validation
  if (rec.ctry && !VALID_COUNTRIES.has(rec.ctry.trim().toUpperCase())) {
    issues.push('INVALID_COUNTRY_CODE');
  }

  // Field length — truncation risk
  for (const [field, limit] of Object.entries(LIMITS)) {
    const val = rec[field];
    if (val && val.length > limit) {
      if (val.length > limit) {
        issues.push(`FIELD_EXCEEDS_LIMIT:${field}:${val.length}>${limit}`);
        truncation_risk = true;
      }
    } else if (val && val.length >= limit * truncThreshold) {
      truncation_risk = true; // approaching limit
    }
  }

  // Country-specific postcode rules
  const ctry = rec.ctry?.trim().toUpperCase();
  const rules = COUNTRY_RULES[ctry];
  if (rules) {
    if (rules.requires_postcode && (!rec.pst || rec.pst.trim() === '')) {
      issues.push('MISSING_REQUIRED_POSTCODE');
    } else if (rec.pst && rules.postcode_pattern && !rules.postcode_pattern.test(rec.pst.trim())) {
      if (strictness === 'strict') issues.push('INVALID_POSTCODE_FORMAT');
    }
  }

  // Strict mode: require street
  if (strictness === 'strict' && (!rec.strt || rec.strt.trim() === '')) {
    issues.push('MISSING_STREET');
  }

  const status = issues.length === 0 ? 'PASS'
    : issues.some(i => i.startsWith('MISSING_') || i.startsWith('INVALID_COUNTRY')) ? 'FAIL'
    : 'WARN';

  return { status, issues, truncation_risk };
}

// ── Built-in test records ─────────────────────────────────────────────────────
const DEFAULT_RECORDS = [
  { nm: 'Acme GmbH',   strt: 'Hauptstraße',    bldg: '12',  pst: '10115', twn: 'Berlin',  ctry: 'DE' },
  { nm: 'XYZ Ltd',     strt: 'High Street',    bldg: '100', pst: 'SW1A 2AA', twn: 'London', ctry: 'GB' },
  { nm: 'ABC Corp',    strt: '',               bldg: '1',   pst: '',      twn: 'Paris',   ctry: 'FR' },
  { nm: '',            strt: 'Via Roma',       bldg: '5',   pst: '00100', twn: 'Rome',    ctry: 'IT' },
  { nm: 'Global SA',   strt: 'Rue de la Paix', bldg: '22',  pst: '75001', twn: 'Paris',   ctry: 'FR' },
];

// ── compute ───────────────────────────────────────────────────────────────────
export function compute(pp) {
  const records         = pp.records         ?? DEFAULT_RECORDS;
  const strictness      = pp.strictness      ?? 'standard';  // 'lenient' | 'standard' | 'strict'
  const trunc_threshold = pp.trunc_threshold ?? 0.80;        // 80% of limit = truncation risk

  let pass = 0, warn = 0, fail = 0, truncation_risk_count = 0;
  const failing_records = [];

  for (let i = 0; i < records.length; i++) {
    const rec    = records[i];
    const result = validateRecord(rec, strictness, trunc_threshold);
    if (result.status === 'PASS') pass++;
    else if (result.status === 'WARN') warn++;
    else fail++;
    if (result.truncation_risk) truncation_risk_count++;
    if (result.status !== 'PASS') {
      failing_records.push({
        index:          i,
        name:           rec.nm ?? '(blank)',
        country:        rec.ctry ?? '(blank)',
        status:         result.status,
        issues:         result.issues,
        truncation_risk: result.truncation_risk,
      });
    }
  }

  const total = records.length;
  const november_2026_readiness_pct = total > 0 ? +((pass / total) * 100).toFixed(2) : 0;

  const compliance_flags = [];
  if (november_2026_readiness_pct >= 95) compliance_flags.push('ISO20022_NOV2026_READY');
  else if (november_2026_readiness_pct >= 80) compliance_flags.push('ISO20022_NOV2026_PARTIAL');
  else compliance_flags.push('ISO20022_NOV2026_NOT_READY');
  if (truncation_risk_count > 0) compliance_flags.push('TRUNCATION_RISK_DETECTED');
  if (fail > 0) compliance_flags.push('RECORDS_FAILING_VALIDATION');

  return {
    verdict:              november_2026_readiness_pct >= 95 ? 'READY' : november_2026_readiness_pct >= 80 ? 'PARTIAL' : 'NOT_READY',
    november_2026_readiness_pct,
    batch_summary:        { total, pass, warn, fail, truncation_risk: truncation_risk_count },
    failing_records:      failing_records.slice(0, 20), // cap at 20
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const result = compute(pp);
  const { compliance_flags = {} } = result;
  const output_payload = result;
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
