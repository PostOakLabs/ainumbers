import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-164-vida-compliance-readiness-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'run_vida_readiness_diagnostic',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Scored ViDA readiness diagnostic: four dimensions (e-invoice, DRR, platform/deemed-supplier,
// OSS/SVR). Produces 0–100 readiness score, gap list, and phased obligation timeline
// (2028-07-01 / 2030-07-01 / 2035-01-01). Terminal node of vida-platform-and-registration chain
// (art-162→163→164). Zero network.
export function compute(pp) {
  const { entity = {} } = pp;

  const DIMENSIONS = ['einvoice', 'drr', 'platform', 'oss'];
  const dim = {
    einvoice: entity.einvoice_ready === true,
    drr: entity.drr_ready === true,
    platform: entity.platform_assessed === true || entity.platform_not_applicable === true,
    oss: entity.oss_scheme_configured === true || entity.oss_not_applicable === true,
  };

  const dims_met = DIMENSIONS.filter((d) => dim[d]).length;
  const total_dims = DIMENSIONS.length;
  const readiness_score = Math.round((dims_met / total_dims) * 100);
  const gaps = DIMENSIONS.filter((d) => !dim[d]);
  const fully_ready = dims_met === total_dims;

  const OBLIGATIONS = [
    {
      date: '2028-07-01',
      scope: 'Platform deemed-supplier rule + Single VAT Registration extended to all B2C / stock transfers',
    },
    {
      date: '2030-07-01',
      scope: 'Mandatory DRR for intra-EU B2B cross-border + EN 16931 structured e-invoice mandatory',
    },
    {
      date: '2035-01-01',
      scope: 'Pre-2024 domestic reporting regimes must harmonize to EU DRR standard',
    },
  ];

  const compliance_flags = { VIDA_READINESS_ASSESSED: true };
  if (fully_ready) compliance_flags.VIDA_FULLY_READY = true;
  else if (readiness_score >= 50) compliance_flags.VIDA_PARTIALLY_READY = true;
  else compliance_flags.VIDA_NOT_READY = true;

  return {
    output_payload: {
      readiness_score,
      fully_ready,
      dimensions_met: dims_met,
      dimensions_total: total_dims,
      gaps,
      timeline_obligations: OBLIGATIONS,
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
