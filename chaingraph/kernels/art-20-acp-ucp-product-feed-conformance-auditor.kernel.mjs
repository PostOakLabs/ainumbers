import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-20-acp-ucp-product-feed-conformance-auditor';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'audit_acp_ucp_product_feed',
  mandate_type: 'scheme_rule',
  gpu: false,
};

const ACP_PRODUCT_FIELDS = [
  {field:'product_id', required:true,  type:'string'},
  {field:'name',       required:true,  type:'string'},
  {field:'price',      required:true,  type:'number'},
  {field:'currency',   required:true,  type:'string'},
  {field:'description',required:false, type:'string'},
  {field:'image_url',  required:false, type:'string'},
  {field:'quantity',   required:false, type:'number'},
  {field:'merchant_id',required:true,  type:'string'},
  {field:'category',   required:false, type:'string'},
  {field:'ap2_version',required:false, type:'string'},
];

const ACP_CHECKOUT_FIELDS = [
  {field:'cart_id',     required:true,  type:'string'},
  {field:'merchant_id', required:true,  type:'string'},
  {field:'total',       required:true,  type:'number'},
  {field:'currency',    required:true,  type:'string'},
  {field:'items',       required:true,  type:'array'},
  {field:'agent_id',    required:false, type:'string'},
  {field:'mandate_type',required:false, type:'string'},
  {field:'return_url',  required:false, type:'string'},
  {field:'signature',   required:false, type:'string'},
  {field:'expiry',      required:false, type:'string'},
];

const ACP_MANDATE_FIELDS = [
  {field:'mandate_id',   required:true,  type:'string'},
  {field:'mandate_type', required:true,  type:'string'},
  {field:'agent_id',     required:true,  type:'string'},
  {field:'merchant_id',  required:true,  type:'string'},
  {field:'issued_at',    required:true,  type:'string'},
  {field:'expiry',       required:true,  type:'string'},
  {field:'payload',      required:true,  type:'object'},
  {field:'signature',    required:false, type:'string'},
  {field:'vdc',          required:false, type:'object'},
];

const UCP_PRODUCT_FIELDS = [
  {field:'id',            required:true,  type:'string'},
  {field:'title',         required:true,  type:'string'},
  {field:'price_amount',  required:true,  type:'number'},
  {field:'price_currency',required:true,  type:'string'},
  {field:'availability',  required:true,  type:'string'},
  {field:'brand',         required:false, type:'string'},
  {field:'description',   required:false, type:'string'},
  {field:'images',        required:false, type:'array'},
  {field:'categories',    required:false, type:'array'},
  {field:'gtin',          required:false, type:'string'},
  {field:'ucp_version',   required:false, type:'string'},
];

const UCP_CHECKOUT_FIELDS = [
  {field:'checkout_id',     required:true,  type:'string'},
  {field:'merchant',        required:true,  type:'object'},
  {field:'line_items',      required:true,  type:'array'},
  {field:'total_price',     required:true,  type:'object'},
  {field:'buyer',           required:false, type:'object'},
  {field:'protocol_version',required:false, type:'string'},
  {field:'payment_methods', required:false, type:'array'},
  {field:'expires_at',      required:false, type:'string'},
];

const SCHEMAS = {
  product:  { acp: ACP_PRODUCT_FIELDS,  ucp: UCP_PRODUCT_FIELDS },
  checkout: { acp: ACP_CHECKOUT_FIELDS, ucp: UCP_CHECKOUT_FIELDS },
  mandate:  { acp: ACP_MANDATE_FIELDS,  ucp: UCP_CHECKOUT_FIELDS },
};

function auditFields(obj, fields, strict) {
  const results = [];
  for (const f of fields) {
    const present = f.field in obj;
    const val = obj[f.field];
    const typeOk = !present ? false : (
      f.type === 'string' ? (typeof val === 'string' && val.length > 0) :
      f.type === 'number' ? (typeof val === 'number' && !isNaN(val)) :
      f.type === 'array'  ? (Array.isArray(val) && val.length > 0) :
      f.type === 'object' ? (val !== null && typeof val === 'object' && !Array.isArray(val)) :
      true
    );
    const typeMismatch = present && !typeOk;
    let status;
    if (f.required) {
      status = !present ? 'fail' : typeMismatch ? 'warn' : 'pass';
    } else {
      status = !present ? (strict ? 'warn' : 'info') : typeMismatch ? 'warn' : 'pass';
    }
    results.push({ field: f.field, required: f.required, present, typeOk, typeMismatch, status });
  }
  return results;
}

function calcScore(results) {
  const reqTotal = results.filter(r => r.required).length;
  const reqPass  = results.filter(r => r.required && r.status === 'pass').length;
  const recTotal = results.filter(r => !r.required).length;
  const recPass  = results.filter(r => !r.required && r.status === 'pass').length;
  const reqScore = reqTotal ? Math.round(reqPass / reqTotal * 100) : 100;
  const recScore = recTotal ? Math.round(recPass / recTotal * 100) : 100;
  const overall  = Math.round(reqScore * 0.75 + recScore * 0.25);
  return { overall, reqScore, recScore, reqPass, reqTotal, recPass, recTotal };
}

export function compute(pp) {
  // Accept payload as object (preferred) or JSON string
  let obj = pp.payload ?? pp;
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj); } catch { obj = {}; }
  }

  const payload_type   = pp.payload_type   ?? 'product';
  const audit_target   = pp.audit_target   ?? 'both';
  const strict         = pp.strict         ?? false;

  const schema = SCHEMAS[payload_type] ?? SCHEMAS.product;

  let acpResults = null, ucpResults = null;
  if (audit_target === 'acp' || audit_target === 'both') acpResults = auditFields(obj, schema.acp, strict);
  if (audit_target === 'ucp' || audit_target === 'both') ucpResults = auditFields(obj, schema.ucp, strict);

  const conformance_scores = {};
  if (acpResults) conformance_scores.acp = calcScore(acpResults);
  if (ucpResults) conformance_scores.ucp = calcScore(ucpResults);

  const allResults = [...(acpResults || []), ...(ucpResults || [])];
  const critical_gaps = allResults.filter(r => r.status === 'fail').length;
  const warnings_count = allResults.filter(r => r.status === 'warn').length;

  const acpMissing = acpResults ? acpResults.filter(r => r.status === 'fail').map(r => r.field) : [];
  const ucpMissing = ucpResults ? ucpResults.filter(r => r.status === 'fail').map(r => r.field) : [];

  const verdict = critical_gaps > 0 ? 'non_conformant' : warnings_count > 0 ? 'conformant_with_warnings' : 'conformant';

  const compliance_flags = [];
  compliance_flags.push('ACP_UCP_AUDIT_COMPLETE');
  if (verdict === 'conformant') compliance_flags.push('PAYLOAD_CONFORMANT');
  if (verdict === 'non_conformant') compliance_flags.push('PAYLOAD_NON_CONFORMANT');
  if (acpResults ? acpMissing.length === 0 : null) compliance_flags.push('ACP_REQUIRED_SATISFIED');
  if (ucpResults ? ucpMissing.length === 0 : null) compliance_flags.push('UCP_REQUIRED_SATISFIED');

  const output_payload = {
    verdict,
    payload_type,
    audit_target,
    conformance_scores: {
      acp: acpResults ? conformance_scores.acp?.overall : null,
      ucp: ucpResults ? conformance_scores.ucp?.overall : null,
    },
    critical_gaps,
    warnings: warnings_count,
    acp_missing_required: acpMissing,
    ucp_missing_required: ucpMissing,
  };
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
