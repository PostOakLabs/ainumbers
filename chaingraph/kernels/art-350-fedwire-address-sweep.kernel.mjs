import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-350-fedwire-address-sweep';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'sweep_fedwire_addresses',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Payment-file pre-migration sweep for the Fedwire/CHIPS Nov 2026 structured-address
// mandate. Batches a payment file's address records through the same per-message lint
// as art-349 (lint_fedwire_structured_address) and rolls the results into a
// rejection-risk report: violation-code frequency, worst offenders, and an aggregate
// risk score, plus a remediation-worksheet receipt (file digest + per-record findings
// digest + risk score).
//
// NOTE ON DUPLICATION: this kernel inlines a copy of art-349's lint rules rather than
// importing art-349's compute() -- the §24 VM↔worker parity harness (chaingraph/vm/
// kernel-vm.mjs) strips ALL `import` lines from a kernel source and re-supplies only
// `executionHash` as a global; a cross-kernel import silently resolves to `undefined`
// inside the VM. Kernels must be single-file, importing only from `_hash.mjs`. Keep the
// rule logic below in sync with art-349-fedwire-structured-address-linter.kernel.mjs
// if the Nov-2026 mandate rules change.
// FEDWIRE-ADDR-BUILD-SPEC.md §FA-3.

const FEDWIRE_CHIPS_DEADLINE = '2026-11-16';
const TABLE_VERSION = 'FEDWIRE-CHIPS-STRUCTURED-ADDRESS-NOV2026-V1';
const TABLE_SOURCE = 'Federal Reserve Financial Services, Fedwire Funds Service ISO 20022 November 2026 Release FAQ (frbservices.org/resources/financial-services/wires/iso-20022-implementation-center/november-release-faq); The Clearing House CHIPS ISO 20022 address rules (aligned to Fedwire)';
const WORST_OFFENDERS_CAP = 50;
const NETWORKS = ['fedwire', 'chips'];

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeArr(v) { return Array.isArray(v) ? v : (v && typeof v === 'string' ? [v] : []); }

// Verbatim copy of art-349's per-record lint (see NOTE ON DUPLICATION above).
function lintFedwireRecord(pp) {
  pp = pp || {};
  const network  = NETWORKS.includes(safeStr(pp.network).toLowerCase()) ? safeStr(pp.network).toLowerCase() : 'fedwire';
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
  } else if (hasTwnNm && hasCtry && adrLines.length <= 2) {
    structure_type = 'HYBRID';
  } else if (hasAdrLine && structured_field_count === 0 && !hasTwnNm) {
    structure_type = 'UNSTRUCTURED';
  } else if (!hasAdrLine && !hasCtry && structured_field_count === 0 && !hasTwnNm) {
    structure_type = 'EMPTY';
  } else {
    structure_type = 'MIXED_INVALID';
  }

  if (structure_type === 'UNSTRUCTURED') {
    violations.push({ code: 'UNSTRUCTURED_ADDRESS', severity: 'ERROR' });
  }
  if (structure_type === 'MIXED_INVALID') {
    violations.push({ code: 'INVALID_MIX', severity: 'ERROR' });
  }
  if (structure_type === 'EMPTY') {
    violations.push({ code: 'EMPTY_ADDRESS', severity: 'ERROR' });
  }
  if (structure_type === 'HYBRID') {
    if (!hasTwnNm) violations.push({ code: 'MISSING_TOWN_NAME', severity: 'ERROR' });
    if (adrLines.length > 2) violations.push({ code: 'EXCESS_ADR_LINES', severity: 'ERROR' });
    adrLines.forEach(function(line, i) {
      const l = safeStr(line);
      if (l.length > 70) violations.push({ code: 'ADR_LINE_TOO_LONG', severity: 'ERROR', field: 'AdrLine[' + i + ']' });
    });
  }
  if (hasAdrLine && (hasStrtNm || hasBldgNb || hasTwnNm || hasPstCd)) {
    const structuredValues = [strtNm, bldgNb, twnNm, pstCd].filter(function(v) { return v.length >= 3; });
    adrLines.forEach(function(line, i) {
      const lLower = safeStr(line).toLowerCase();
      structuredValues.forEach(function(sv) {
        if (lLower.includes(sv.toLowerCase())) violations.push({ code: 'SILENT_FAIL_DUPLICATION', severity: 'ERROR', field: 'AdrLine[' + i + ']' });
      });
    });
  }
  if (ctry.length > 0 && !/^[A-Z]{2}$/.test(ctry)) {
    violations.push({ code: 'INVALID_COUNTRY', severity: 'ERROR' });
  }

  const error_count = violations.length;
  const compliant = error_count === 0 && (structure_type === 'FULLY_STRUCTURED' || structure_type === 'HYBRID');
  return { network, structure_type, compliant, error_count, violations };
}

// Strict CSV parser (ISO20022-WB-1 not landed -- see spec note). Deterministic,
// no locale-dependent parsing. Header: network,street_name,building_number,
// post_code,town_name,country,country_subdivision,address_lines (address_lines
// is pipe-separated for multiple AdrLine entries within one CSV cell).
const CSV_HEADER = ['network', 'street_name', 'building_number', 'post_code', 'town_name', 'country', 'country_subdivision', 'address_lines'];

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.replace(/\r$/, ''));
}

export function parseCsv(fileContent) {
  const lines = safeStr(fileContent).split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { records: [], parse_errors: [] };
  const header = parseCsvLine(lines[0]).map((h) => safeStr(h).toLowerCase());
  const hasHeader = CSV_HEADER.some((h) => header.includes(h));
  const startIdx = hasHeader ? 1 : 0;
  const cols = hasHeader ? header : CSV_HEADER;
  const records = [];
  const parse_errors = [];
  for (let i = startIdx; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    if (parts.length === 1 && parts[0].trim() === '') continue;
    const rec = {};
    cols.forEach((col, idx) => {
      const val = safeStr(parts[idx]);
      if (!val) return;
      if (col === 'address_lines') rec.address_lines = val.split('|').map(safeStr).filter(Boolean);
      else if (CSV_HEADER.includes(col)) rec[col] = val;
    });
    if (Object.keys(rec).length === 0) {
      parse_errors.push({ row: i + 1, message: 'No recognised fields on this row.' });
      continue;
    }
    records.push(rec);
  }
  return { records, parse_errors };
}

export function compute(pp) {
  pp = pp || {};
  const fileContent = typeof pp.file_content === 'string' ? pp.file_content : '';
  const inlineRecords = Array.isArray(pp.records) ? pp.records : null;

  let records, parse_errors;
  if (inlineRecords) {
    records = inlineRecords;
    parse_errors = [];
  } else {
    const parsed = parseCsv(fileContent);
    records = parsed.records;
    parse_errors = parsed.parse_errors;
  }

  const total = records.length;
  const by_rule = {};
  const per_record = [];
  let compliant_count = 0;

  for (let i = 0; i < total; i++) {
    const r = lintFedwireRecord(records[i]);
    if (r.compliant) compliant_count++;
    r.violations.forEach((v) => {
      by_rule[v.code] = (by_rule[v.code] || 0) + 1;
    });
    per_record.push({
      index: i,
      network: r.network,
      structure_type: r.structure_type,
      compliant: r.compliant,
      error_count: r.error_count,
      violation_codes: r.violations.map((v) => v.code),
    });
  }

  const worst_offenders = per_record
    .filter((r) => !r.compliant)
    .slice()
    .sort((a, b) => (b.error_count - a.error_count) || (a.index - b.index))
    .slice(0, WORST_OFFENDERS_CAP);

  const by_rule_sorted = Object.keys(by_rule).sort().reduce((o, k) => (o[k] = by_rule[k], o), {});

  const compliant_pct = total > 0 ? +((compliant_count / total) * 100).toFixed(2) : 100;
  // risk_score: 0 (no risk) to 100 (max risk) -- inverse of compliant_pct, weighted by parse errors.
  const risk_score = total > 0
    ? Math.min(100, +((100 - compliant_pct) + Math.min(10, parse_errors.length)).toFixed(2))
    : (parse_errors.length > 0 ? 100 : 0);

  const rejection_risk_report = {
    total_records: total,
    compliant_count,
    non_compliant_count: total - compliant_count,
    compliant_pct,
    by_rule: by_rule_sorted,
    worst_offenders,
    worst_offenders_truncated: per_record.filter((r) => !r.compliant).length > WORST_OFFENDERS_CAP,
    parse_errors,
  };

  const output_payload = {
    fedwire_chips_deadline: FEDWIRE_CHIPS_DEADLINE,
    rejection_risk_report,
    risk_score,
    disambiguation: 'sweep_fedwire_addresses batch-sweeps a payment file (CSV or pre-parsed records) through the same rules as lint_fedwire_structured_address (art-349), per record, and rolls the results into a rejection-risk report. For a single-message lint use lint_fedwire_structured_address (art-349) directly.',
    pii_note: 'All fields operate on STRUCTURAL address components only. No real party PII enters this kernel -- use synthetic or anonymised payment-file data.',
    table_version: TABLE_VERSION,
    table_source: TABLE_SOURCE,
    regulatory_basis: 'Federal Reserve Financial Services Fedwire Funds Service ISO 20022 November 2026 Release; The Clearing House CHIPS ISO 20022 implementation (aligned to Fedwire address rules)',
  };

  const compliance_flags = [];
  if (risk_score === 0) compliance_flags.push('FEDWIRE_SWEEP_ALL_COMPLIANT');
  else if (risk_score < 20) compliance_flags.push('FEDWIRE_SWEEP_LOW_RISK');
  else if (risk_score < 60) compliance_flags.push('FEDWIRE_SWEEP_MODERATE_RISK');
  else compliance_flags.push('FEDWIRE_SWEEP_HIGH_RISK');
  if (parse_errors.length > 0) compliance_flags.push('FEDWIRE_SWEEP_PARSE_ERRORS_PRESENT');

  return { output_payload, compliance_flags, records, per_record };
}

// Remediation-worksheet receipt: file digest + per-record findings digest + risk score,
// alongside the standard OCG artifact envelope. Both auxiliary digests reuse the vetted
// executionHash canonicalizer (rather than a hand-rolled one) by pairing the value with a
// fixed marker instead of a real output_payload -- avoids importing cgCanon separately,
// which (like any non-_hash.mjs import) the §24 VM harness would strip to `undefined`.
async function auxDigest(value) {
  return executionHash(value, { digest_marker: TOOL_ID });
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags, records, per_record } = compute(pp);
  const file_digest = await auxDigest(typeof pp.file_content === 'string' ? pp.file_content : records);
  const per_record_findings_digest = await auxDigest(per_record);
  output_payload.file_digest = 'sha256:' + file_digest;
  output_payload.per_record_findings_digest = 'sha256:' + per_record_findings_digest;

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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
