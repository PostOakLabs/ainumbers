import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-252-validate-cat-bond-trigger-terms';
const TOOL_VERSION = '1.0.0';

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mandate_type: 'compliance_mandate', gpu: false };

// Cat bond trigger term validation: attachment/exhaustion ordering, pro-rata reduction,
// and layer exhaustion arithmetic.
// Cat bonds outstanding: $63.9B (Q1 2026), record $25.6B issuance in 2025.
// ZERO PII: layer terms, reported loss, coverage amounts only.

const TABLE_VERSION = 'CAT-BOND-TRIGGER-TERMS-V1.0-2025';
const TABLE_SOURCE  = 'ISDA/IAIS cat bond trigger definitions; Swiss Re sigma 1/2024; ARTEMIS.bm cat bond market data Q1 2026; NAIC catastrophe bond guidelines';

export function compute(params) {
  const p = params || {};

  const reported_loss      = _finite(p.reported_loss, 0);       // insured loss amount
  const attachment_point   = _finite(p.attachment_point, 0);    // bond begins paying
  const exhaustion_point   = _finite(p.exhaustion_point, 0);    // bond fully exhausted
  const coverage_amount    = _finite(p.coverage_amount, 0);     // bond face value
  const pro_rata_enabled   = p.pro_rata_enabled !== false;       // default: true
  const second_loss_amount = _finite(p.second_loss_amount, 0);  // for cascading triggers

  // Validate term ordering
  const terms_valid = attachment_point > 0 && exhaustion_point > attachment_point;
  const layer_width = terms_valid ? _round2(exhaustion_point - attachment_point) : 0;
  const implied_coverage = layer_width; // coverage_amount should equal layer_width in practice

  // Attachment: reported_loss >= attachment_point
  const attachment_breached = reported_loss >= attachment_point;

  // Exhaustion: reported_loss >= exhaustion_point
  const exhaustion_reached = attachment_breached && reported_loss >= exhaustion_point;

  // Pro-rata payout within the layer
  let payout_amount   = 0;
  let pro_rata_factor = 0;
  let excess_above_attachment = 0;

  if (attachment_breached && terms_valid && coverage_amount > 0) {
    if (exhaustion_reached) {
      // Full layer payment
      pro_rata_factor = 1;
      payout_amount   = _round2(coverage_amount);
    } else if (pro_rata_enabled && layer_width > 0) {
      // Pro-rata: proportion of layer penetrated
      excess_above_attachment = _round2(reported_loss - attachment_point);
      pro_rata_factor = _round4(excess_above_attachment / layer_width);
      payout_amount   = _round2(coverage_amount * pro_rata_factor);
    } else {
      // Binary trigger without pro-rata
      pro_rata_factor = 1;
      payout_amount   = _round2(coverage_amount);
    }
  } else if (attachment_breached && terms_valid && coverage_amount === 0) {
    // Use layer_width as coverage
    excess_above_attachment = _round2(reported_loss - attachment_point);
    if (exhaustion_reached) {
      payout_amount   = _round2(layer_width);
      pro_rata_factor = 1;
    } else if (pro_rata_enabled && layer_width > 0) {
      pro_rata_factor = _round4(excess_above_attachment / layer_width);
      payout_amount   = _round2(layer_width * pro_rata_factor);
    }
  }

  excess_above_attachment = _round2(reported_loss > attachment_point ? reported_loss - attachment_point : 0);

  // Layer position diagnostics
  const layer_position =
    !attachment_breached       ? 'BELOW_ATTACHMENT'   :
    exhaustion_reached         ? 'ABOVE_EXHAUSTION'   :
    pro_rata_factor > 0        ? 'WITHIN_LAYER'       : 'AT_ATTACHMENT';

  // Cascade: if second_loss_amount provided, check if aggregate exceeds attachment
  const cascade_attachment_check =
    second_loss_amount > 0
      ? (reported_loss + second_loss_amount) >= attachment_point
      : null;

  // Term integrity checks
  const issues = [];
  if (!terms_valid) issues.push('attachment_point must be positive and less than exhaustion_point');
  if (attachment_point <= 0) issues.push('attachment_point must be > 0');
  if (exhaustion_point <= attachment_point) issues.push('exhaustion_point must exceed attachment_point');
  if (coverage_amount < 0) issues.push('coverage_amount must be >= 0');

  return {
    attachment_breached,
    exhaustion_reached,
    payout_amount,
    pro_rata_factor,
    layer_position,
    layer_width,
    excess_above_attachment,
    terms_valid,
    coverage_amount_used: coverage_amount > 0 ? coverage_amount : layer_width,
    implied_coverage,
    cascade_attachment_check,
    issues,
    table_version:   TABLE_VERSION,
    table_source:    TABLE_SOURCE,
    regulatory_basis:'ISDA/IAIS cat bond trigger definitions; Swiss Re sigma cat bond trigger methodology (indemnity / industry loss index / parametric / modelled loss). Layer arithmetic per standard IAIS ICP 13 reinsurance principles.',
    pii_note:        'ZERO PII: layer terms and aggregate loss amounts only. No policyholder, claimant, or event-specific personal data enters this kernel.',
    not_legal_advice:'Not legal or actuarial advice. Final payout determination requires review of the controlling bond indenture and independent loss verification.',
  };
}

function _finite(v, def) {
  const n = Number(v);
  return (isFinite(n) && !isNaN(n)) ? n : def;
}

function _round4(v) { return Math.round(v * 10000) / 10000; }
function _round2(v) { return Math.round(v * 100)   / 100;   }

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const output_payload = compute(pp);
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
    compliance_flags: [],
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
