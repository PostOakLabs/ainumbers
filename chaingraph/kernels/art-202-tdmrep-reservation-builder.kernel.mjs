import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-202-tdmrep-reservation-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_tdm_reservation',
  mandate_type: 'compliance_mandate', gpu: false,
};

// W3C TDMRep + IETF AIPREF AI-training rights reservation builder.
// Generates a tdmrep.json rule array, HTTP Content-Usage / tdm-reservation header,
// and HTML meta-tag equivalents from a reservation flag, optional location pattern,
// optional policy URL, and optional ISCC content code soft-binding.
// Spec: W3C TDM Reservation Protocol CG-FINAL-20240202 + draft-ietf-aipref-attach.
// Deterministic, pure logic, zero PII.

const TDMREP_SPEC = 'https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240202/';
const AIPREF_SPEC = 'https://datatracker.ietf.org/doc/draft-ietf-aipref-attach/';

function isValidHttpUrl(u) {
  if (!u) return true;
  return /^https?:\/\/[^\s]+$/.test(u);
}

function isValidLocation(loc) {
  return typeof loc === 'string' && loc.length > 0 && loc[0] === '/';
}

export function compute(pp) {
  pp = pp || {};

  // reserved: true/1 = opt out (reserve rights), false/0 = allow TDM
  const rawReserved = pp.reserved;
  const reserved = rawReserved !== false && rawReserved !== 0 && rawReserved !== '0';
  const tdm_reservation = reserved ? 1 : 0;

  const location   = (typeof pp.location === 'string' && pp.location.trim()) ? pp.location.trim() : '/';
  const policy_url = typeof pp.policy_url === 'string' ? pp.policy_url.trim() : '';
  const iscc_ref   = typeof pp.iscc_ref === 'string' ? pp.iscc_ref.trim() : '';

  // W3C TDMRep rule object
  const rule = { location: location, 'tdm-reservation': tdm_reservation };
  if (policy_url) rule['tdm-policy'] = policy_url;
  const tdmrep_json = [rule];

  // HTTP header equivalents
  const content_usage_header =
    'tdm-reservation: ' + tdm_reservation +
    (policy_url ? '\ntdm-policy: ' + policy_url : '');

  // HTML meta-tag equivalents
  const meta_tag_html =
    '<meta name="tdm-reservation" content="' + tdm_reservation + '">' +
    (policy_url ? '\n<meta name="tdm-policy" content="' + policy_url + '">' : '');

  // Schema checks
  const locOk = isValidLocation(location);
  const urlOk = isValidHttpUrl(policy_url);

  const schema_checks = [
    {
      check: 'reservation_value',
      pass: true,
      detail: 'tdm-reservation: ' + tdm_reservation + ' (' + (reserved ? 'rights reserved' : 'not reserved') + ')'
    },
    {
      check: 'location_format',
      pass: locOk,
      detail: locOk
        ? 'location valid: ' + location
        : 'location must start with /; got: ' + location
    },
    {
      check: 'policy_url_format',
      pass: urlOk,
      detail: policy_url
        ? (urlOk ? 'policy_url valid http(s): ' + policy_url : 'policy_url not a valid http(s) URL: ' + policy_url)
        : 'policy_url not provided (optional)'
    }
  ];

  const all_checks_pass = schema_checks.every(function(c) { return c.pass; });

  const output_payload = {
    tdm_reservation: tdm_reservation,
    location: location,
    tdmrep_json: tdmrep_json,
    content_usage_header: content_usage_header,
    meta_tag_html: meta_tag_html,
    iscc_ref: iscc_ref || null,
    tdmrep_spec: TDMREP_SPEC,
    aipref_spec: AIPREF_SPEC,
    schema_checks: schema_checks,
    all_checks_pass: all_checks_pass
  };

  const compliance_flags = [];
  compliance_flags.push('TDM_RESERVATION_SET');
  compliance_flags.push('TDMREP_SPEC_APPLIED');
  compliance_flags.push('AIPREF_SPEC_APPLIED');
  if (!all_checks_pass) compliance_flags.push('TDMREP_SCHEMA_WARNINGS');

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
