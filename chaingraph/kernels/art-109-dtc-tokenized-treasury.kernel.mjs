/**
 * art-109-dtc-tokenized-treasury.kernel.mjs
 * DTC-Custodied Tokenized Treasury Issuance & DvP Validator.
 * Validates a DTCC/ComposerX tokenized U.S. Treasury for issuance and atomic settlement.
 * DISTINCT from 512 (generic lifecycle) and us-treasury-clearing (FICC economics).
 * Pure decision kernel — no DOM, no window, no Date.now().
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-109-dtc-tokenized-treasury';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'validate_dtc_tokenized_treasury',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

const REQUIRED_LIFECYCLE_EVENTS = ['issuance', 'corporate_actions', 'redemption'];
const CUSIP_CLASS_DTC_ELIGIBLE   = ['US-TREASURY', 'UST', 'T-BILL', 'T-NOTE', 'T-BOND'];
const DAML_TEMPLATE_PATTERN      = /^composerx:/i;

export function compute(pp) {
  const cfg = pp.tokenized_ust_config ?? {};

  const cusip_class            = cfg.cusip_class ?? '';
  const dtc_custody_ref        = cfg.dtc_custody_ref ?? '';
  const fed_eligible           = cfg.fed_eligible === true;
  const composerx_daml_template= cfg.composerx_daml_template ?? '';
  const lifecycle_events       = Array.isArray(cfg.lifecycle_events) ? cfg.lifecycle_events : [];
  const collateral_reuse_policy= cfg.collateral_reuse_policy ?? 'none';

  // DTC custody linkage: non-empty ref present
  const custody_link_ok = dtc_custody_ref.length > 0 && dtc_custody_ref !== 'none';

  // Fed/DTC eligibility: field is true AND cusip class is a known eligible class
  const cusip_upper   = cusip_class.toUpperCase();
  const cusip_eligible = CUSIP_CLASS_DTC_ELIGIBLE.some(c => cusip_upper.includes(c));
  const fed_eligible_ok = fed_eligible && cusip_eligible;

  // ComposerX DAML lifecycle coverage: check required events present
  const lcSet = new Set(lifecycle_events.map(e => e.toLowerCase().replace(/[- ]/g, '_')));
  const daml_lifecycle_gaps = REQUIRED_LIFECYCLE_EVENTS.filter(req => !lcSet.has(req));
  const daml_template_ok    = DAML_TEMPLATE_PATTERN.test(composerx_daml_template);
  const daml_lifecycle_ok   = daml_lifecycle_gaps.length === 0 && daml_template_ok;

  // Atomic DvP readiness: custody link + Fed eligible → can proceed to 507
  const dvp_ready = custody_link_ok && fed_eligible_ok;

  // Programmable collateral reuse: policy is 'allowed' or 'conditional'
  const collateral_reuse_ok = ['allowed', 'conditional'].includes(collateral_reuse_policy);

  const all_ok = custody_link_ok && fed_eligible_ok && daml_lifecycle_ok && dvp_ready;
  const verdict = all_ok ? 'ISSUANCE_READY' : 'GAPS_FOUND';

  const compliance_flags = [all_ok ? 'DTC_TREASURY_VALIDATED' : 'DTC_TREASURY_GAPS'];
  if (custody_link_ok)   compliance_flags.push('DTC_CUSTODY_LINKED');
  if (fed_eligible_ok)   compliance_flags.push('FED_ELIGIBLE');
  if (daml_lifecycle_ok) compliance_flags.push('DAML_LIFECYCLE_COMPLETE');
  if (collateral_reuse_ok) compliance_flags.push('COLLATERAL_REUSE_ELIGIBLE');

  const output_payload = {
    custody_link_ok,
    fed_eligible: fed_eligible_ok,
    daml_lifecycle_gaps,
    daml_template_ok,
    dvp_ready,
    collateral_reuse_ok,
    verdict,
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
