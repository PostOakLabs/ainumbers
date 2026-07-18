import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-354-mletr-jurisdiction-adoption-lookup';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'lookup_mletr_jurisdiction_adoption',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Static-table lookup: is UNCITRAL MLETR (or a functionally-equivalent electronic
// transferable-record regime) adopted in a jurisdiction, and is an electronic bill of
// lading (eBL) therefore legally effective across a given corridor (origin -> destination)?
// Update-on-touch static table, not live data -- carries DATA_VERSION so a caller can
// tell how fresh the citation set is. Verify citations at build/touch time.
// MLETR-CONTROL-BUILD-SPEC.md §MC-3.

const DATA_VERSION = 'MLETR-JURISDICTION-ADOPTION-2026-07-17-V1';
const TABLE_SOURCE = 'UNCITRAL Model Law on Electronic Transferable Records (MLETR, 2017) national-adoption tracking (uncitral.org/en/texts/ecommerce/modellaw/electronic_transferable_records/status); national gazette/statute citations per jurisdiction, verified at build.';

// status: 'adopted' = enacted MLETR-based (or UNCITRAL-recognised MLETR-aligned) electronic
// transferable-record legislation covering eBLs. 'aligned' = a functionally-equivalent
// electronic-record regime exists but is not a literal MLETR enactment (gaps possible).
// 'not-adopted' = no identified electronic transferable-record legislation.
const JURISDICTION_TABLE = {
  UK: { name: 'United Kingdom', status: 'adopted', statute: 'Electronic Trade Documents Act 2023 (ETDA 2023)', effective_date: '2023-09-20', scope: 'Possessable electronic documents incl. bills of lading, bills of exchange, promissory notes.', citation: 'UK Public General Acts 2023 c.8' },
  SG: { name: 'Singapore', status: 'adopted', statute: 'Electronic Transactions (Amendment) Act 2021', effective_date: '2021-02-01', scope: 'Electronic transferable records -- first national MLETR adoption worldwide.', citation: 'Singapore Statutes, Electronic Transactions Act Part IVA' },
  AE: { name: 'UAE', status: 'adopted', statute: 'Federal Decree-Law No. 46 of 2021 on Electronic Transactions and Trust Services', effective_date: '2022-01-02', scope: 'Electronic transferable records incl. eBLs.', citation: 'UAE Federal Decree-Law 46/2021' },
  BH: { name: 'Bahrain', status: 'adopted', statute: 'Electronic Communications and Transactions Law (Legislative Decree No. 54 of 2018), MLETR-aligned amendments', effective_date: '2019-01-01', scope: 'Electronic transferable records.', citation: 'Bahrain Legislative Decree 54/2018' },
  FR: { name: 'France', status: 'adopted', statute: 'Decree No. 2025-811 (national transposition of the EU electronic transferable-records digitalisation framework)', effective_date: '2025-08-01', scope: 'First EU Member State full MLETR-aligned transposition.', citation: 'JORF Decret n. 2025-811' },
  JP: { name: 'Japan', status: 'adopted', statute: 'Commercial Code Amendment Act (electronic bills of lading), FY2026', effective_date: '2026-04-01', scope: 'Electronic bills of lading recognised as functional equivalent of a paper B/L.', citation: 'Japan Commercial Code amendment, FY2026 Diet session' },
  IN: { name: 'India', status: 'adopted', statute: 'Bills of Lading Act amendments recognising electronic bills of lading (MLETR-aligned)', effective_date: '2025-01-01', scope: 'Electronic bills of lading.', citation: 'India Bills of Lading (Amendment) Act' },
  US: { name: 'United States', status: 'aligned', statute: 'Uniform Commercial Code Article 12 -- Controllable Electronic Records (2022 UCC Amendments), state-by-state enactment', effective_date: '2023-01-01', scope: 'Controllable-electronic-records framework -- functionally aligned, not a literal MLETR enactment. Adoption is state-by-state; confirm the specific state.', citation: 'Uniform Law Commission, 2022 UCC Amendments, UCC Art. 12' },
  DE: { name: 'Germany', status: 'aligned', statute: 'eWpG (Electronic Securities Act)', effective_date: '2021-06-10', scope: 'Electronic securities only -- no dedicated MLETR eBL statute yet; EU digitalisation package proposal pending.', citation: 'German eWpG 2021' },
};

const ALIASES = {
  'UNITED KINGDOM': 'UK', 'GREAT BRITAIN': 'UK', 'GB': 'UK', 'ENGLAND': 'UK',
  'SINGAPORE': 'SG',
  'UAE': 'AE', 'UNITED ARAB EMIRATES': 'AE',
  'BAHRAIN': 'BH',
  'FRANCE': 'FR',
  'JAPAN': 'JP',
  'INDIA': 'IN',
  'UNITED STATES': 'US', 'USA': 'US', 'UNITED STATES OF AMERICA': 'US',
  'GERMANY': 'DE',
};

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }

function normalizeCode(raw) {
  const s = safeStr(raw).toUpperCase();
  if (!s) return '';
  if (JURISDICTION_TABLE[s]) return s;
  if (ALIASES[s]) return ALIASES[s];
  return s;
}

function lookupJurisdiction(raw) {
  const code = normalizeCode(raw);
  const entry = JURISDICTION_TABLE[code];
  if (!entry) {
    return {
      input: safeStr(raw), code: code || null, name: safeStr(raw) || null,
      status: 'not-adopted', statute: null, effective_date: null,
      scope: 'No MLETR-aligned electronic transferable-record legislation identified as of ' + DATA_VERSION + '.',
      citation: null,
    };
  }
  return Object.assign({ input: safeStr(raw), code }, entry);
}

function corridorVerdict(origin, destination) {
  const statuses = [origin.status, destination.status];
  if (statuses.every((s) => s === 'adopted')) return 'MLETR_CORRIDOR_RECOGNIZED';
  if (statuses.every((s) => s === 'adopted' || s === 'aligned')) return 'FUNCTIONALLY_EQUIVALENT_CHECK_LOCAL_COUNSEL';
  return 'GAP_LEGACY_PAPER_LIKELY_REQUIRED';
}

export function compute(pp) {
  pp = pp || {};
  const origin = lookupJurisdiction(pp.origin_jurisdiction);
  const destination = lookupJurisdiction(pp.destination_jurisdiction);
  const verdict = corridorVerdict(origin, destination);

  const output_payload = {
    corridor: { origin, destination },
    verdict,
    ebl_legally_effective: verdict === 'MLETR_CORRIDOR_RECOGNIZED',
    disambiguation: 'lookup_mletr_jurisdiction_adoption is a static citation-table lookup -- statute, scope, and effective date per jurisdiction, plus a corridor verdict. It is NOT a legal opinion and does NOT assess a specific eBL document (use validate_mletr_record, art-53, for a document-level MLETR Art.10/11 conformance check).',
    data_version: DATA_VERSION,
    table_source: TABLE_SOURCE,
  };

  const compliance_flags = [];
  if (verdict === 'MLETR_CORRIDOR_RECOGNIZED') compliance_flags.push('MLETR_CORRIDOR_RECOGNIZED');
  else if (verdict === 'FUNCTIONALLY_EQUIVALENT_CHECK_LOCAL_COUNSEL') compliance_flags.push('MLETR_CORRIDOR_PARTIAL_ALIGNMENT');
  else compliance_flags.push('MLETR_CORRIDOR_GAP');

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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
