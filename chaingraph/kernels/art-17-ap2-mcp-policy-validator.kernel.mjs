/**
 * art-17-ap2-mcp-policy-validator.kernel.mjs
 * Server-side port of the deterministic AP2_SCHEMA_V1 validator (ORPHANNODE-ONBOARD-2).
 * Validates a supplied payload against the AINumbers Unified Build Contract v1.0 Policy
 * Mandate field set (ap2_version, mandate_id, tool_id, mandate_type, jurisdiction, ...) —
 * this is the site's own Policy Mandate schema, not Google's AP2 payments protocol.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-17-ap2-mcp-policy-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'validate_ap2_mandate_credential',
  mandate_type: 'scheme_rule',
  gpu: false,
};

const AP2_SCHEMA_V1 = {
  required_fields: ['ap2_version', 'mandate_id', 'issued_at', 'issued_by', 'tool_id', 'tool_version', 'mandate_type', 'jurisdiction', 'payload', 'audit_metadata'],
  optional_fields: ['summary', 'agent_instructions', 'valid_from', 'valid_until', 'last_reviewed', 'source_tool_inputs', 'regulatory_citations', 'regulatory_frameworks'],
  mandate_type_enum: [
    'payment_policy', 'aml_rule', 'kyc_requirement', 'routing_policy', 'compliance_control',
    'risk_parameter', 'credit_assessment', 'fx_policy', 'scheme_rule', 'disclosure_template',
    'fee_schedule_mandate', 'velocity_rule_mandate', 'incident_classification_mandate',
    'routing_policy_mandate', 'agent_guardrail_mandate',
  ],
  deprecated_fields: ['output_payload', 'audit_signature', 'policy_parameters', 'ap2_version_1_0_0'],
  audit_metadata_required_booleans: ['client_side_executed', 'zero_pii_verified', 'deterministic_run'],
};

function isISO8601(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(str);
}
function fieldDetail(field, val) {
  if (field === 'jurisdiction') return Array.isArray(val) ? `Array: [${val.join(', ')}]` : String(val);
  if (field === 'payload' || field === 'audit_metadata') return (val && typeof val === 'object') ? `Object with ${Object.keys(val).length} key(s)` : String(val);
  if (typeof val === 'string') return `"${val.slice(0, 60)}${val.length > 60 ? '…' : ''}"`;
  if (val && typeof val === 'object') return 'Object / Array';
  return String(val);
}

function validateAP2Schema(obj) {
  const rows = [];
  let points = 0;
  const reqWeight = 55 / AP2_SCHEMA_V1.required_fields.length;

  AP2_SCHEMA_V1.required_fields.forEach((field) => {
    const present = Object.prototype.hasOwnProperty.call(obj, field) && obj[field] !== null && obj[field] !== '';
    if (present) points += reqWeight;
    rows.push({ field, status: present ? 'PASS' : 'MISSING', detail: present ? fieldDetail(field, obj[field]) : `Required field is missing. Add "${field}" to your AP2 payload.` });
  });

  const versionRow = rows.find((r) => r.field === 'ap2_version');
  if (obj.ap2_version === '1.0.0') {
    points -= 5;
    if (versionRow) { versionRow.status = 'FAIL'; versionRow.detail = 'ap2_version must be "1.0" (string), not "1.0.0". Update per UBC §3.1.'; }
  } else if (obj.ap2_version && obj.ap2_version !== '1.0') {
    points -= 5;
    if (versionRow) { versionRow.status = 'FAIL'; versionRow.detail = `ap2_version "${obj.ap2_version}" is not recognised. Must be "1.0".`; }
  }

  if (obj.mandate_type) {
    const validMt = AP2_SCHEMA_V1.mandate_type_enum.includes(obj.mandate_type);
    if (validMt) { points += 10; rows.push({ field: 'mandate_type (enum)', status: 'PASS', detail: `"${obj.mandate_type}" is a valid mandate_type value.` }); }
    else { rows.push({ field: 'mandate_type (enum)', status: 'FAIL', detail: `"${obj.mandate_type}" is not a valid mandate_type. See valid values in schema reference.` }); }
  }

  if (obj.audit_metadata && typeof obj.audit_metadata === 'object') {
    const boolWeight = 15 / AP2_SCHEMA_V1.audit_metadata_required_booleans.length;
    AP2_SCHEMA_V1.audit_metadata_required_booleans.forEach((key) => {
      const val = obj.audit_metadata[key];
      const ok = val === true;
      if (ok) points += boolWeight;
      rows.push({ field: `audit_metadata.${key}`, status: ok ? 'PASS' : (val === false ? 'FAIL' : 'MISSING'), detail: ok ? 'Set to true.' : (val === false ? 'Must be true for UBC compliance (currently false).' : 'Missing from audit_metadata.') });
    });
  } else if (obj.audit_metadata) {
    rows.push({ field: 'audit_metadata (structure)', status: 'FAIL', detail: `audit_metadata must be an object, not a ${typeof obj.audit_metadata}` });
  }

  const dateFields = ['issued_at', 'valid_from', 'valid_until', 'last_reviewed'];
  let dateOk = 0;
  dateFields.forEach((df) => {
    if (obj[df]) {
      const ok = isISO8601(obj[df]);
      if (ok) dateOk++;
      rows.push({ field: `${df} (ISO 8601)`, status: ok ? 'PASS' : 'FAIL', detail: ok ? `Valid ISO 8601: "${obj[df]}"` : `"${obj[df]}" is not a valid ISO 8601 date/datetime.` });
    }
  });
  if (dateOk > 0) points += Math.min(5, dateOk * 1.5);

  if (obj.agent_instructions) {
    const ok = Array.isArray(obj.agent_instructions) && obj.agent_instructions.length > 0;
    if (ok) points += 5;
    rows.push({ field: 'agent_instructions', status: ok ? 'PASS' : 'FAIL', detail: ok ? `Array with ${obj.agent_instructions.length} instruction(s).` : 'Must be a non-empty array of strings.' });
  }

  if (obj.jurisdiction) {
    const ok = Array.isArray(obj.jurisdiction) && obj.jurisdiction.length > 0 && obj.jurisdiction.every((j) => /^[A-Z]{2}$/.test(j));
    if (ok) points += 5;
    rows.push({ field: 'jurisdiction (ISO 3166-1)', status: ok ? 'PASS' : 'WARN', detail: ok ? `Valid country codes: ${obj.jurisdiction.join(', ')}` : 'Some jurisdiction values may not be ISO 3166-1 alpha-2 codes.' });
  }

  const foundDeprecated = AP2_SCHEMA_V1.deprecated_fields.filter((f) => Object.prototype.hasOwnProperty.call(obj, f));
  if (foundDeprecated.length > 0) {
    points -= foundDeprecated.length * 5;
    foundDeprecated.forEach((f) => { rows.push({ field: `⚠ ${f} (DEPRECATED)`, status: 'FAIL', detail: `"${f}" is a deprecated AP2 field and must be removed. See UBC §3.1.` }); });
  }

  const score = Math.max(0, Math.min(100, Math.round(points)));
  return { score, rows, deprecatedFields: foundDeprecated };
}

export function compute(pp) {
  pp = pp || {};
  const obj = (pp.payload && typeof pp.payload === 'object' && !Array.isArray(pp.payload)) ? pp.payload : {};
  const result = validateAP2Schema(obj);

  const output_payload = {
    validated_payload_tool_id: obj.tool_id || null,
    compliance_score: result.score,
    deprecated_fields_found: result.deprecatedFields,
    agent_deployment_recommended: result.score >= 80,
    field_results: result.rows.map((r) => ({ field: r.field, status: r.status, detail: r.detail })),
    note: 'Validates a caller-supplied payload against the AINumbers Unified Build Contract v1.0 Policy Mandate field set. Distinct from Google’s external AP2 payments protocol.',
  };

  const compliance_flags = ['AP2_SCHEMA_VALIDATED'];
  if (result.score >= 80) compliance_flags.push('AGENT_DEPLOYMENT_RECOMMENDED');
  if (result.deprecatedFields.length > 0) compliance_flags.push('DEPRECATED_FIELDS_FOUND');

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
