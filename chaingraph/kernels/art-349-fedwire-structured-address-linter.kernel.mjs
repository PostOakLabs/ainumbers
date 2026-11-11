import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-349-fedwire-structured-address-linter';
const TOOL_VERSION = '1.0.1';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lint_fedwire_structured_address',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Fedwire/CHIPS ISO 20022 structured-address lint (per-message rule check), status-bearing form.
// FRFS announced on 27 August 2026 that the Fedwire November 2026 release moves to the
// November 2027 release (exact date TBA); until then Fedwire accepts BOTH unstructured and
// fully-structured postal addresses -- the former 2026-11-16 cutover is superseded and no
// replacement day-precision date is published, so this kernel carries a status string, not a
// date constant. Hybrid is NOT supported until the November 2027 release.
//   - Fully-structured: all ISO fields populated, no AdrLine -- accepted today, STP-safe.
//   - Hybrid: TwnNm + Ctry structured (always required), max 2 AdrLine each <=70 chars,
//     no silent-fail duplication -- becomes supported WITH the November 2027 release.
//   - Unstructured: AdrLine-only -- accepted today; WARN unless the caller asserts an
//     as_of_date on/after a published enforcement date (none is; the ERROR branch stays
//     inert until FEDWIRE_ENFORCEMENT_DATE is set from a sourced day).
// table_version: "FEDWIRE-CHIPS-STRUCTURED-ADDRESS-FRFS-2026-08-27-V2"
// Source: Federal Reserve Financial Services announcement of 27 August 2026 (Fedwire Funds
//         Service November 2026 release rescheduled to the November 2027 release; scope in
//         the fall); The Clearing House CHIPS ISO 20022 implementation, which aligns its
//         address rules to Fedwire's (CHIPS cycle undated, TBC, aligned-to-Fedwire).
// CHIPS decision (verified at build, FA-2 scope question): Fedwire and CHIPS structured-address
// rules are aligned -- byte-identical for this kernel's scope.
// FA-2 is folded into this kernel as the `network` param instead of a separate WU.
// Disambiguates from: lint_cbpr_structured_address (art-241), the SWIFT CBPR+ equivalent for
// pacs.008 cross-border messages -- this kernel covers the US domestic Fedwire/CHIPS rules.

const MAX_ADR_LINE_LEN = 70;
const MAX_ADR_LINES = 2;
const TABLE_VERSION = 'FEDWIRE-CHIPS-STRUCTURED-ADDRESS-FRFS-2026-08-27-V2';
const TABLE_SOURCE = 'Federal Reserve Financial Services announcement of 27 August 2026: Fedwire Funds Service November 2026 release rescheduled to the November 2027 release, exact date to be announced (unstructured and fully-structured addresses accepted until then); The Clearing House CHIPS ISO 20022 address rules (aligned to Fedwire; CHIPS cycle undated, TBC)';
const FEDWIRE_ADDRESS_RULE_STATUS = 'Fedwire accepts unstructured and fully-structured addresses today; hybrid becomes supported with the November 2027 release (FRFS, 2026-08-27); exact date TBA; CHIPS undated (aligned-to-Fedwire cycle, TBC)';
const FEDWIRE_ENFORCEMENT_DATE = null; // no day-precision enforcement date published (FRFS 2026-08-27: exact date TBA); set from a sourced day to restore hard-error semantics
const NETWORKS = ['fedwire', 'chips'];

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeArr(v) { return Array.isArray(v) ? v : (v && typeof v === 'string' ? [v] : []); }

export function compute(pp) {
  pp = pp || {};

  const network  = NETWORKS.includes(safeStr(pp.network).toLowerCase()) ? safeStr(pp.network).toLowerCase() : 'fedwire';
  const asOfDate = safeStr(pp.as_of_date);
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
  // Caller-supplied as-of severity gate (pure function of inputs, never wall-clock):
  // UNSTRUCTURED_ADDRESS is a WARN by default; ERROR only once an enforcement date is
  // published AND the caller asserts an as_of_date on/after it.
  const enforcement_in_force = FEDWIRE_ENFORCEMENT_DATE !== null && asOfDate !== '' && asOfDate >= FEDWIRE_ENFORCEMENT_DATE;

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
    violations.push({ code: 'UNSTRUCTURED_ADDRESS', severity: enforcement_in_force ? 'ERROR' : 'WARN', field: 'AdrLine', message: 'Unstructured AdrLine-only addresses remain accepted by ' + network.toUpperCase() + ' today; the structured-address requirement is enforced from the November 2027 release (FRFS, 2026-08-27; exact date TBA). Migrate to fully-structured -- the only STP-safe format pre-release; hybrid becomes supported with the November 2027 release.' });
  }
  if (structure_type === 'MIXED_INVALID') {
    violations.push({ code: 'INVALID_MIX', severity: 'ERROR', field: 'PostalAddress24', message: 'Address mixes structured and unstructured fields in an invalid combination. Apply either fully-structured (no AdrLine, all ISO fields) or hybrid (TwnNm+Ctry+max 2 AdrLine) format.' });
  }
  if (structure_type === 'EMPTY') {
    violations.push({ code: 'EMPTY_ADDRESS', severity: 'ERROR', field: 'PostalAddress24', message: 'No address fields populated. ' + network.toUpperCase() + ' ISO 20022 messages require a populated PostalAddress24 block.' });
  }

  if (structure_type === 'HYBRID') {
    violations.push({ code: 'HYBRID_NOT_YET_SUPPORTED', severity: 'WARN', field: 'PostalAddress24', message: 'Hybrid postal addresses are accepted by ' + network.toUpperCase() + ' only from the November 2027 release (FRFS, 2026-08-27; exact date TBA); today only unstructured and fully-structured formats are accepted. Fully-structured is the STP-safe form pre-release.' });
    if (!hasTwnNm) {
      violations.push({ code: 'MISSING_TOWN_NAME', severity: 'ERROR', field: 'TwnNm', message: 'Town Name is always required for a hybrid postal address on ' + network.toUpperCase() + '.' });
    }
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
  // Fully-structured is the only default-compliant state today; hybrid counts as compliant
  // only once enforcement is in force (November 2027 release) per the caller's as_of_date.
  const compliant = error_count === 0 && (structure_type === 'FULLY_STRUCTURED' || (structure_type === 'HYBRID' && enforcement_in_force));
  const readiness_pct = compliant ? 100 : Math.max(0, 100 - error_count * 20);

  const output_payload = {
    network,
    structure_type,
    compliant,
    readiness_pct,
    error_count,
    violations,
    fedwire_chips_deadline: null,
    fedwire_chips_deadline_status: FEDWIRE_ADDRESS_RULE_STATUS,
    disambiguation: 'lint_fedwire_structured_address checks per-message Fedwire/CHIPS structured-address rule lint under the FRFS 27 August 2026 rescheduling (November 2027 release; exact date TBA; no day-precision deadline is published, so fedwire_chips_deadline is null and the status string carries the rule state; network param selects fedwire or chips; rules are byte-identical on both as of build-time verification, so one kernel covers both networks). For the SWIFT CBPR+ cross-border equivalent use lint_cbpr_structured_address (art-241).',
    pii_note: 'All fields operate on STRUCTURAL address components only. No real party PII enters this kernel -- use synthetic or anonymised address data.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: 'Federal Reserve Financial Services announcement of 27 August 2026 (Fedwire Funds Service November 2026 release rescheduled to the November 2027 release; unstructured and fully-structured addresses accepted until then, hybrid from the November 2027 release); The Clearing House CHIPS ISO 20022 implementation (aligned to Fedwire address rules; CHIPS cycle undated, TBC)',
  };

  const compliance_flags = [];
  if (!compliant) compliance_flags.push('FEDWIRE_ADDRESS_NON_COMPLIANT');
  if (violations.some(function(v) { return v.code === 'SILENT_FAIL_DUPLICATION'; })) compliance_flags.push('SILENT_FAIL_DUPLICATION_DETECTED');
  if (violations.some(function(v) { return v.code === 'UNSTRUCTURED_ADDRESS'; })) compliance_flags.push('UNSTRUCTURED_ADDRESS_FLAGGED');

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
