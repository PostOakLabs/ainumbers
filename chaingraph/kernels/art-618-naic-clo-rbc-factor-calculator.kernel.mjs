import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-618-naic-clo-rbc-factor-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'calculate_naic_clo_rbc_factor',
  mandate_type: 'compliance_control', gpu: false,
};

// NAIC LR002 Bonds schedule, Column (2) "CLOs/CBOs/CDOs" pre-tax factor, by SVO Bond Designation
// Category. Source: NAIC Capital Adequacy (E) Task Force, Proposal 2026-12-IRE MOD ("CLO RBC
// Factors"), adopted by the RBC Investment Risk & Evaluation (E) Working Group 2026-06-23,
// Attachment Nine of the June 30, 2026 CADTF meeting materials, page 87 of the retrieved combined
// PDF (research/clause-snapshots/NAIC-2026-12-IRE-CADTF-063026-meeting-materials.pdf,
// sha256:abf6142d11dd79b5e918dc24dd299e5d281c8d7b045e533e97a2e064eea698e2). Values read directly
// off a rendered page image (research/clause-snapshots/NAIC-2026-12-IRE-LR002-page87-CLO-factor-table.png)
// after a first-pass text extraction was found to misalign the (1.D)-(1.F) rows against the wrong
// factor cells -- see research/NAIC-CLO-RBC-K-1.spec.md for the correction record.
const CLO_FACTOR_TABLE = {
  '1.A': 0.00040, '1.B': 0.00050, '1.C': 0.00050, '1.D': 0.00050, '1.E': 0.00170, '1.F': 0.00170, '1.G': 0.00970,
  '2.A': 0.02180, '2.B': 0.03240, '2.C': 0.03280,
  '3.A': 0.15140, '3.B': 0.25150, '3.C': 0.27990,
  '4.A': 0.31300, '4.B': 0.42310, '4.C': 0.56880,
  '5.A': 0.57840, '5.B': 0.66340, '5.C': 0.85120,
  '6': 0.92560,
};

// BSL thin-tranche override (LR002 line 7.2): flat surcharge factor, eligible only for a CLO in
// NAIC Designation Category 2.C or below AND current tranche thickness <= 4%.
const THIN_TRANCHE_OVERRIDE_FACTOR = 0.11770;
const THIN_TRANCHE_THICKNESS_THRESHOLD_PCT = 4;

// Designations at or below 2.C in the LR002 credit-quality ordering -- the override-eligible set.
const OVERRIDE_ELIGIBLE_DESIGNATIONS = new Set([
  '2.C', '3.A', '3.B', '3.C', '4.A', '4.B', '4.C', '5.A', '5.B', '5.C', '6',
]);

const NAIC_CLO_RBC_FACTOR_VINTAGE = '2026-12-IRE, adopted 2026-06-23, YE2026 filing';

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

// Per-tranche lookup + apply. Returns the applied factor, override flag, and the LR002
// ROUND(...,0) dollar requirement -- factor precision carried to 5dp (no rounding before
// multiplication), dollar result rounded to the nearest whole dollar (LR002 kernel formula:
// =ROUND(MAX(0,D10)*F10 + MAX(0,G10)*J10,0)).
function priceTranche(t) {
  const designation = String(t.naic_designation || '').toUpperCase();
  const thickness_pct = safeNum(t.tranche_thickness_pct, null);
  const bacv = Math.max(0, safeNum(t.book_adjusted_carrying_value, 0));
  const claimed_bsl_thin = t.bsl_thin_tranche === true;

  const valid_designation = Object.prototype.hasOwnProperty.call(CLO_FACTOR_TABLE, designation);
  if (!valid_designation) {
    return {
      naic_designation: t.naic_designation ?? null, tranche_thickness_pct: thickness_pct,
      book_adjusted_carrying_value: bacv, override_eligible: false, override_applied: false,
      applied_factor: null, rbc_requirement: 0, error: 'unrecognized_naic_designation',
    };
  }

  const override_eligible = OVERRIDE_ELIGIBLE_DESIGNATIONS.has(designation);
  // Thickness threshold is closed ("<= 4%" per the retrieved instruction text) -- exactly 4%
  // triggers the override.
  const thickness_qualifies = thickness_pct !== null && thickness_pct <= THIN_TRANCHE_THICKNESS_THRESHOLD_PCT;
  const override_applied = override_eligible && claimed_bsl_thin && thickness_qualifies;

  const applied_factor = override_applied ? THIN_TRANCHE_OVERRIDE_FACTOR : CLO_FACTOR_TABLE[designation];
  const rbc_requirement = Math.round(bacv * applied_factor); // ROUND(...,0): nearest whole dollar

  return {
    naic_designation: designation, tranche_thickness_pct: thickness_pct,
    book_adjusted_carrying_value: bacv, override_eligible, override_applied,
    applied_factor, rbc_requirement, error: null,
  };
}

export function compute(pp) {
  pp = pp || {};
  const tranchesIn = Array.isArray(pp.tranches) ? pp.tranches : [];
  const compliance_flags = { NAIC_CLO_RBC_RECOMPUTE: true };

  const tranches = tranchesIn.map(priceTranche);
  const hasError = tranches.some((t) => t.error);
  if (hasError) compliance_flags.UNRECOGNIZED_DESIGNATION_PRESENT = true;
  if (tranches.some((t) => t.override_applied)) compliance_flags.BSL_THIN_TRANCHE_OVERRIDE_APPLIED = true;

  const portfolio_total_bacv = tranches.reduce((a, t) => a + t.book_adjusted_carrying_value, 0);
  const portfolio_total_rbc_requirement = tranches.reduce((a, t) => a + t.rbc_requirement, 0);

  const output_payload = {
    tranches,
    portfolio_total_bacv,
    portfolio_total_rbc_requirement,
    tranche_count: tranches.length,
    naic_clo_rbc_factor_vintage: NAIC_CLO_RBC_FACTOR_VINTAGE,
    verify_note: hasError
      ? 'recompute diverges — review your inputs (one or more tranches carried an unrecognized NAIC designation and were excluded from the priced total)'
      : 'recompute matches the adopted grid',
    scope_note: 'Per-tranche lookup + apply over the LR002 Column (2) CLOs/CBOs/CDOs grid, plus simple portfolio summation. This does not derive a NAIC designation from underlying loan data, does not model the CLO Portfolio Adjustment Factor, and excludes CLO residual tranches (their LR002/AVR line number was not located in the retrieved primary source; see spec scope_statement).',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
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
