import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-241-cbpr-structured-address-linter';
const TOOL_VERSION = '1.0.1';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_cbpr_structured_address',
  mandate_type: 'compliance_mandate', gpu: false,
};

// CBPR+ November 2026 pacs.008 structured-address lint (per-message rule check).
// Validates PostalAddress24 blocks against the SWIFT CBPR+ Nov-2026 mandate:
//   - Fully-structured: all ISO fields populated, no AdrLine.
//   - Hybrid: TwnNm + Ctry structured, max 2 AdrLine each <=70 chars, no silent-fail duplication.
//   - Unstructured: AdrLine-only -- will be prohibited once the structured-address requirement
//     takes effect (deferred by Swift on 27 Aug 2026, new date not published).
//   - Silent-fail rule: AdrLine must NOT duplicate structured field values verbatim.
// Missing input (fail-closed): all seven manifest-required address fields must be present. An
// absent, null, empty or whitespace-only required field is never evidence of compliance. When a
// required field is missing and no ERROR was found, output_payload.verdict is 'INDETERMINATE',
// compliant is null, readiness_pct is 0 and missing_required_fields lists the fields;
// compliance_flags carries INPUT_MISSING_INDETERMINATE. A field already producing an ERROR keeps
// the existing non-compliant verdict. buildArtifact never throws: an unhashable input (non-finite
// number, unsafe integer, depth or size past the hash limits) returns a refusal artifact with
// execution_hash null and hash_refusal.
// table_version: "CBPR-PLUS-STRUCTURED-ADDRESS-NOV2026-V1"
// Source: SWIFT CBPR+ Structured Address Migration Bulletin (swift.com/cbpr-plus-migration);
//         ISO 20022 PostalAddress24 element set (MX catalogue).
// Disambiguates from: verify_address_migration_batch (rca-03) = GPU-parallel BATCH verifier of
// already-migrated address archives; lint_cbpr_structured_address = per-MESSAGE Nov-2026 rule lint.

const MAX_ADR_LINE_LEN = 70;
const MAX_ADR_LINES = 2;
const TABLE_VERSION = 'CBPR-PLUS-STRUCTURED-ADDRESS-NOV2026-V1';
const TABLE_SOURCE = 'SWIFT CBPR+ Structured Address Migration Bulletin (verify current guidance at swift.com/cbpr-plus-migration); ISO 20022 PostalAddress24 element set (iso20022.org MX catalogue)';

// Required inputs per the manifest mcp_tool_definition.inputSchema.required. A missing,
// null, empty or whitespace-only one yields INDETERMINATE (verdict, compliant: null), never
// compliant: true. Every required input is read with a LITERAL property access so the static
// schema-read sweep sees it (no dynamic key reads).
const REQUIRED_FIELDS = ['address_lines', 'building_number', 'country', 'country_subdivision', 'post_code', 'street_name', 'town_name'];

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeArr(v) { return Array.isArray(v) ? v : (v && typeof v === 'string' ? [v] : []); }
function isFilled(v) { return v != null && !(typeof v === 'string' && v.trim() === ''); }

export function compute(pp) {
  pp = pp || {};

  const strtNm   = safeStr(pp.street_name);
  const bldgNb   = safeStr(pp.building_number);
  const pstCd    = safeStr(pp.post_code);
  const twnNm    = safeStr(pp.town_name);
  const ctry     = safeStr(pp.country).toUpperCase();
  const ctrySubD = safeStr(pp.country_subdivision);
  const adrLines = safeArr(pp.address_lines);

  const hasStrtNm   = strtNm.length > 0;
  const hasBldgNb   = bldgNb.length > 0;
  const hasPstCd    = pstCd.length > 0;
  const hasTwnNm    = twnNm.length > 0;
  const hasCtry     = ctry.length === 2 && /^[A-Z]{2}$/.test(ctry);
  const hasCtrySubD = ctrySubD.length > 0;
  const hasAdrLine  = adrLines.length > 0;

  const violations = [];
  const structured_field_count = (hasStrtNm ? 1 : 0) + (hasBldgNb ? 1 : 0) + (hasPstCd ? 1 : 0) + (hasCtrySubD ? 1 : 0);

  let structure_type;
  if (!hasAdrLine && structured_field_count >= 1 && hasCtry) {
    structure_type = 'FULLY_STRUCTURED';
  } else if (hasTwnNm && hasCtry && adrLines.length <= MAX_ADR_LINES) {
    structure_type = 'HYBRID';
  } else if (hasAdrLine && structured_field_count === 0 && !hasTwnNm) {
    structure_type = 'UNSTRUCTURED';
  } else if (!hasAdrLine && !hasCtry && structured_field_count === 0 && !hasTwnNm) {
    structure_type = 'EMPTY';
  } else {
    structure_type = 'MIXED_INVALID';
  }

  if (structure_type === 'UNSTRUCTURED') {
    violations.push({ code: 'UNSTRUCTURED_ADDRESS', severity: 'ERROR', field: 'AdrLine', message: 'Unstructured AdrLine-only addresses will be prohibited once the structured-address requirement takes effect (deferred by Swift on 27 Aug 2026, new date not published). CBPR+ mandate: migrate to fully-structured or hybrid format.' });
  }
  if (structure_type === 'MIXED_INVALID') {
    violations.push({ code: 'INVALID_MIX', severity: 'ERROR', field: 'PostalAddress24', message: 'Address mixes structured and unstructured fields in an invalid combination. Apply either fully-structured (no AdrLine, all ISO fields) or hybrid (TwnNm+Ctry+max 2 AdrLine) format.' });
  }
  if (structure_type === 'EMPTY') {
    violations.push({ code: 'EMPTY_ADDRESS', severity: 'ERROR', field: 'PostalAddress24', message: 'No address fields populated. pacs.008 requires a populated PostalAddress24 block.' });
  }

  if (structure_type === 'HYBRID') {
    if (adrLines.length > MAX_ADR_LINES) {
      violations.push({ code: 'EXCESS_ADR_LINES', severity: 'ERROR', field: 'AdrLine', message: 'Hybrid format allows at most ' + MAX_ADR_LINES + ' AdrLine elements; found ' + adrLines.length + '.' });
    }
    adrLines.forEach(function(line, i) {
      const l = safeStr(line);
      if (l.length > MAX_ADR_LINE_LEN) {
        violations.push({ code: 'ADR_LINE_TOO_LONG', severity: 'ERROR', field: 'AdrLine[' + i + ']', message: 'AdrLine[' + i + '] is ' + l.length + ' chars; maximum is ' + MAX_ADR_LINE_LEN + '.' });
      }
    });
  }

  // Silent-fail: AdrLine must NOT contain structured field values verbatim
  if (hasAdrLine && (hasStrtNm || hasBldgNb || hasTwnNm || hasPstCd)) {
    const structuredValues = [strtNm, bldgNb, twnNm, pstCd].filter(function(v) { return v.length >= 3; });
    adrLines.forEach(function(line, i) {
      const lLower = safeStr(line).toLowerCase();
      structuredValues.forEach(function(sv) {
        if (lLower.includes(sv.toLowerCase())) {
          violations.push({ code: 'SILENT_FAIL_DUPLICATION', severity: 'ERROR', field: 'AdrLine[' + i + ']', message: 'AdrLine[' + i + '] duplicates structured field value "' + sv + '" -- this silent-fail causes STP rejection without a visible error code. Remove the duplicated component from AdrLine.' });
        }
      });
    });
  }

  if (ctry.length > 0 && !/^[A-Z]{2}$/.test(ctry)) {
    violations.push({ code: 'INVALID_COUNTRY', severity: 'ERROR', field: 'Ctry', message: 'Country code "' + ctry + '" is not a valid ISO 3166-1 alpha-2 code.' });
  }

  const error_count = violations.filter(function(v) { return v.severity === 'ERROR'; }).length;

  // Fail-closed on missing input: a required field that is absent, null, empty or
  // whitespace-only is not evidence of compliance. With no ERROR already found the verdict
  // is INDETERMINATE (compliant: null, readiness_pct: 0). An already-found ERROR keeps the
  // existing non-compliant verdict.
  const required_checks = [
    ['address_lines', isFilled(pp.address_lines)],
    ['building_number', isFilled(pp.building_number)],
    ['country', isFilled(pp.country)],
    ['country_subdivision', isFilled(pp.country_subdivision)],
    ['post_code', isFilled(pp.post_code)],
    ['street_name', isFilled(pp.street_name)],
    ['town_name', isFilled(pp.town_name)],
  ];
  const missing_required_fields = required_checks.filter(function(pair) { return !pair[1]; }).map(function(pair) { return pair[0]; });
  const indeterminate = missing_required_fields.length > 0 && error_count === 0;
  const compliant = indeterminate ? null : (error_count === 0 && (structure_type === 'FULLY_STRUCTURED' || structure_type === 'HYBRID'));
  const readiness_pct = indeterminate ? 0 : (compliant ? 100 : Math.max(0, 100 - error_count * 20));

  const output_payload = {
    structure_type,
    compliant,
    readiness_pct,
    error_count,
    violations,
    cbpr_plus_deadline: null,
    cbpr_plus_deadline_status: 'deferred by Swift on 27 Aug 2026; no new date published',
    disambiguation: 'lint_cbpr_structured_address checks per-message Nov-2026 hybrid/fully-structured rule lint including the AdrLine silent-fail duplication rule. For batch verification of already-migrated address archives use verify_address_migration_batch (rca-03). For ISO 20022 securities settlement messages (sese/semt) use lint_securities_settlement_message (art-82). This tool operates on pacs.008 payments address blocks only.',
    pii_note: 'All fields operate on STRUCTURAL address components only. No real party PII enters this kernel -- use synthetic or anonymised address data.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: 'SWIFT CBPR+ Structured Address Migration Bulletin; ISO 20022 PostalAddress24 element set (MX catalogue); SEPA and CHAPS aligned; Swift notice of 27 Aug 2026 (structured-address date deferred, no new date published)',
  };

  if (indeterminate) {
    output_payload.missing_required_fields = missing_required_fields;
    output_payload.verdict = 'INDETERMINATE';
  }

  const compliance_flags = [];
  if (indeterminate) compliance_flags.push('INPUT_MISSING_INDETERMINATE');
  else if (!compliant) compliance_flags.push('CBPR_ADDRESS_NON_COMPLIANT');
  if (violations.some(function(v) { return v.code === 'SILENT_FAIL_DUPLICATION'; })) compliance_flags.push('SILENT_FAIL_DUPLICATION_DETECTED');
  if (violations.some(function(v) { return v.code === 'UNSTRUCTURED_ADDRESS'; })) compliance_flags.push('UNSTRUCTURED_ADDRESS_PROHIBITED');

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
      output_payload: { compliant: null, verdict: 'REFUSED', refusal: unhashable.reason },
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
