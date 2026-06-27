import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-167-eudr-commodity-scope-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_eudr_commodity_scope',
  mandate_type: 'compliance_mandate', gpu: false,
};

// EUDR Annex I: 7 regulated commodities + their derivatives.
// HS code → commodity determination → operator/trader/SME role → obligations + deadline.
// Deadlines: large/medium operators 2026-12-30; micro/SME 2027-06-30.
// SME threshold: <250 employees AND (<€50M turnover OR <€43M balance sheet).
// Micro: <10 employees AND <€2M turnover (postal-address geo exemption).
// Feeds supply-chain risk scorer (art-168). Zero network.
export function compute(pp) {
  const { hs_code = '', entity = {} } = pp;

  // EUDR Annex I commodity HS heading map (4-digit HS headings, not exhaustive — structural check)
  const COMMODITY_MAP = {
    cattle:   ['0102','0201','0202','0206','0210','1602','4101','4104','4107','4114'],
    cocoa:    ['1801','1802','1803','1804','1805','1806'],
    coffee:   ['0901','2101'],
    oil_palm: ['1511','1513','2104','2306','3823'],
    rubber:   ['4001','4002','4003','4004','4005','4006','4007','4008','4009','4010','4011','4012','4013','4014','4015','4016','4017'],
    soya:     ['1201','1208','2304','2301'],
    wood:     ['4401','4402','4403','4404','4405','4406','4407','4408','4409','4410','4411','4412','4413','4414','4415','4416','4417','4418','4419','4420','4421','4701','4702','4703','4704','4705','4706','4707','4801','4802','4803','4804','4805','4806','4807','4808','4809','4810','4811','4812','4813','4814','4815','4816','4817','4818','4819','4820','4821','4822','4823','9401','9402','9403'],
  };

  const hs_norm = typeof hs_code === 'string' ? hs_code.trim().replace(/\./g, '') : '';
  const hs4 = hs_norm.slice(0, 4);

  let commodity = null;
  let in_scope = false;
  for (const [com, codes] of Object.entries(COMMODITY_MAP)) {
    if (codes.includes(hs4)) { commodity = com; in_scope = true; break; }
  }

  // Entity classification
  const employees = Number.isFinite(Number(entity.employee_count)) ? Number(entity.employee_count) : 0;
  const turnover = Number.isFinite(Number(entity.annual_turnover_eur)) ? Number(entity.annual_turnover_eur) : 0;
  const is_micro = employees < 10 && turnover < 2_000_000;
  const is_sme = employees < 250 && (turnover < 50_000_000);
  const entity_role = !in_scope
    ? 'out_of_scope'
    : (typeof entity.entity_type === 'string' && ['operator','trader'].includes(entity.entity_type)
        ? entity.entity_type
        : 'operator');

  // Obligations
  const deadline = (is_micro || is_sme) ? '2027-06-30' : '2026-12-30';
  const due_diligence_required = in_scope && entity_role !== 'out_of_scope';
  const dds_filing_required = due_diligence_required && entity_role === 'operator';
  const geo_exemption_eligible = is_micro && entity_role === 'operator';

  const OBLIGATIONS = [];
  if (!in_scope) OBLIGATIONS.push('Commodity not in EUDR Annex I scope — no EUDR obligations');
  else {
    if (entity_role === 'operator') OBLIGATIONS.push(`File Due Diligence Statement (DDS) in TRACES NT before placing on EU market (deadline: ${deadline})`);
    if (entity_role === 'trader') OBLIGATIONS.push('Reference upstream operator DDS — single-DDS rule applies');
    if (due_diligence_required) OBLIGATIONS.push('Collect geolocation data for all production plots');
    if (geo_exemption_eligible) OBLIGATIONS.push('Micro-operator: postal address may substitute geolocation');
    OBLIGATIONS.push('Retain DDS records for 5 years');
  }

  const compliance_flags = { EUDR_COMMODITY_ASSESSED: true };
  if (!in_scope) compliance_flags.EUDR_OUT_OF_SCOPE = true;
  else if (dds_filing_required) compliance_flags.EUDR_DDS_REQUIRED = true;
  else compliance_flags.EUDR_REFERENCE_ONLY = true;

  return {
    output_payload: {
      in_scope,
      commodity: commodity ?? null,
      hs4_matched: hs4 || null,
      entity_role,
      is_micro,
      is_sme,
      due_diligence_required,
      dds_filing_required,
      geo_exemption_eligible,
      deadline: in_scope ? deadline : null,
      obligations: OBLIGATIONS,
    },
    compliance_flags,
  };
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
