import { executionHash } from './_hash.mjs';

// art-660 — Compile NAV-Error Evidence Pack: pure citation-bundle kernel.
//
// NAV / Fund-Administration Computation Lineage vertical (NAV-LINEAGE-BUILD-SPEC.md, NAV-error evidence pack section).
// Packages one already-produced art-373-recompute-fund-nav receipt and one already-produced
// art-374-test-nav-error-materiality receipt -- cited by execution_hash, and the materiality
// verdict/error/policy fields ECHOED VERBATIM from the caller-supplied art-374 output_payload,
// NEVER RECOMPUTED -- into a CSSF Circular 24/856-shaped disclosure bundle: what happened, when
// it was detected, the materiality threshold applied, the affected period, and the correction.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): this pack CITES the referenced
// art-373/art-374 receipts; it performs ZERO NAV recomputation and ZERO materiality-threshold
// arithmetic of its own (that is art-373's and art-374's job respectively -- see
// art-374-test-nav-error-materiality.kernel.mjs's own threshold/BigInt math, none of which is
// duplicated here). It makes no claim of CSSF 24/856 compliance and is not a regulatory filing --
// informative citation only, matching the convention already established on art-373/art-374 for
// the 40-Act/UCITS references. The affected_period/error/correction/notification fields are
// caller-supplied and asserted (zero-egress, no CSSF submission of any kind).
//
// Primary-text citations (SO #38): research/clause-snapshots/CSSF24-856-NAV-error-2026-08-27.excerpt.md
// (points E1-E7) and research/clause-snapshots/CSSF24-856-FAQ-2026-08-27.excerpt.md (F1-F4).

const TOOL_ID = 'art-660-compile-nav-error-evidence-pack';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compile_nav_error_evidence_pack',
  mandate_type: 'compliance_mandate', gpu: false,
};

const NOT_PROVEN = [
  { item: 'Underlying receipt re-verification', detail: 'This kernel cites the supplied nav_ref/materiality_ref execution_hash + tool_id pairs; it does not re-run art-373\'s NAV recomputation arithmetic or re-derive art-374\'s materiality verdict. See CSSF24-856-NAV-error-2026-08-27.excerpt.md E1/E2.' },
  { item: 'Materiality verdict authenticity', detail: 'materiality_verdict, error and declared_policy/industry_convention fields are copied VERBATIM from the caller-supplied materiality_ref.output_payload. This kernel does not verify that the supplied output_payload actually corresponds to the cited execution_hash, and performs zero materiality-threshold arithmetic of its own (art-374 owns that computation).' },
  { item: 'CSSF 24/856 compliance / regulatory filing', detail: 'This bundle cites prior receipts\' verdicts and caller-asserted correction/notification facts; it is not a regulatory filing, not a determination that a NAV error legally occurred under Circular CSSF 24/856, and not evidence the declared inputs were accurate. Never a compliance attestation.' },
  { item: 'Correction/compensation/notification execution', detail: 'affected_period, correction and notification fields are caller-supplied and asserted. This kernel performs no verification that compensation was actually paid, that a notification was actually filed with the CSSF, or that the declared correction method was correctly applied (CSSF24-856-NAV-error-2026-08-27.excerpt.md E3-E7).' },
];

function s(v) { return String(v == null ? '' : v).trim(); }

// Normalizes a receipt-citation ref: must carry a non-empty execution_hash. tool_id is
// optional and, when absent, falls back to the well-known canonical upstream tool_id --
// mirrors art-562-compile-model-risk-lineage-pack.kernel.mjs's normalizeRef() convention.
function normalizeRef(ref, canonicalToolId) {
  if (!ref || typeof ref !== 'object') return null;
  const execution_hash = s(ref.execution_hash);
  if (!execution_hash) return null;
  const tool_id = s(ref.tool_id) || canonicalToolId;
  return { execution_hash, tool_id };
}

// Normalizes an array of supplementary receipt refs (positions/pricing receipts, prior-
// period art-373 calls). Each entry must carry a role label and an execution_hash.
function normalizeSupplementary(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const execution_hash = s(item.execution_hash);
    if (!execution_hash) continue;
    out.push({ role: s(item.role) || 'supplementary', tool_id: s(item.tool_id) || null, execution_hash });
  }
  return out;
}

// Echoes the fields a CSSF 24/856-shaped disclosure needs from the cited art-374 receipt's
// own output_payload -- a plain object-shape copy, never a recomputation. Returns nulls
// (never throws, never fabricates) when the caller did not supply materiality_ref.output_payload
// or it doesn't carry the expected art-374 shape.
function echoMaterialityOutput(output_payload) {
  if (!output_payload || typeof output_payload !== 'object') return null;
  return {
    materiality_verdict: output_payload.materiality_verdict ?? null,
    error: output_payload.error ?? null,
    declared_policy: output_payload.declared_policy ?? null,
    industry_convention: output_payload.industry_convention ?? null,
    reprocessing_need_indicated: output_payload.reprocessing_need_indicated ?? null,
  };
}

/**
 * compute(pp) — pure NAV-error-evidence-pack citation kernel.
 * pp: {
 *   fund_id: string,
 *   detection_date: string,
 *   nav_ref: { execution_hash: string, tool_id?: string },
 *   materiality_ref: { execution_hash: string, tool_id?: string, output_payload?: object },
 *   affected_period?: { start_date?: string, end_date?: string, days?: number|string },
 *   correction?: {
 *     correction_method?: 'accounting'|'economic'|string,   // caller-declared, CSSF24-856 vocabulary (E4)
 *     compensation_paid_without_delay?: boolean,             // E5
 *     de_minimis_applied?: boolean,                          // E6, FAQ F4
 *     financial_intermediary_pass_through?: boolean,         // E6
 *   },
 *   notification?: {
 *     notified_to_cssf?: boolean,
 *     notification_date?: string,
 *   },
 *   supplementary_receipts?: [ { role: string, execution_hash: string, tool_id?: string } ],
 * }
 */
export function compute(pp) {
  pp = pp || {};
  const fund_id = s(pp.fund_id) || null;
  const detection_date = s(pp.detection_date) || null;

  const navRef = normalizeRef(pp.nav_ref, 'art-373-recompute-fund-nav');
  const materialityRefRaw = pp.materiality_ref;
  const materialityRef = normalizeRef(materialityRefRaw, 'art-374-test-nav-error-materiality');

  let structural_error = null;
  if (!fund_id) structural_error = 'fund_id is required.';
  else if (!detection_date) structural_error = 'detection_date is required.';
  else if (!navRef) structural_error = 'nav_ref.execution_hash is required (cite the art-373-recompute-fund-nav receipt).';
  else if (!materialityRef) structural_error = 'materiality_ref.execution_hash is required (cite the art-374-test-nav-error-materiality receipt).';

  const cited_receipts = [];
  if (navRef) cited_receipts.push({ ...navRef, role: 'nav_recompute' });
  if (materialityRef) cited_receipts.push({ ...materialityRef, role: 'materiality_test' });
  const supplementary = normalizeSupplementary(pp.supplementary_receipts);
  for (const ref of supplementary) cited_receipts.push(ref);

  const materialityOutput = structural_error ? null : echoMaterialityOutput(materialityRefRaw && materialityRefRaw.output_payload);

  const period = pp.affected_period || {};
  const affected_period = {
    start_date: s(period.start_date) || null,
    end_date: s(period.end_date) || null,
    days: period.days != null ? Number(period.days) : null,
  };

  const correctionIn = pp.correction || {};
  const correction = {
    correction_method: s(correctionIn.correction_method) || null,
    compensation_paid_without_delay: typeof correctionIn.compensation_paid_without_delay === 'boolean' ? correctionIn.compensation_paid_without_delay : null,
    de_minimis_applied: typeof correctionIn.de_minimis_applied === 'boolean' ? correctionIn.de_minimis_applied : null,
    financial_intermediary_pass_through: typeof correctionIn.financial_intermediary_pass_through === 'boolean' ? correctionIn.financial_intermediary_pass_through : null,
  };

  const notificationIn = pp.notification || {};
  const notification = {
    notified_to_cssf: typeof notificationIn.notified_to_cssf === 'boolean' ? notificationIn.notified_to_cssf : null,
    notification_date: s(notificationIn.notification_date) || null,
    // Fixed informative citation of CSSF24-856-NAV-error-2026-08-27.excerpt.md E7 (point 158) —
    // never a computed deadline date, mirrors art-374's own informative-constant pattern.
    notification_window_weeks: { min: 4, max: 8, basis: 'CSSF Circular 24/856 point 158 (no-compensation case); informative citation only, not a computed deadline.' },
  };

  const compliance_flags = [];
  const warnings = [];
  if (structural_error) {
    compliance_flags.push('NAV_ERROR_PACK_STRUCTURAL_ERROR');
    warnings.push(structural_error);
  } else {
    compliance_flags.push('NAV_ERROR_PACK_COMPILED');
    const verdict = materialityOutput ? materialityOutput.materiality_verdict : null;
    if (verdict === 'MATERIAL') compliance_flags.push('NAV_ERROR_PACK_MATERIAL_CITED');
    else if (verdict === 'IMMATERIAL') compliance_flags.push('NAV_ERROR_PACK_IMMATERIAL_CITED');
    else if (verdict === 'INDETERMINATE') compliance_flags.push('NAV_ERROR_PACK_INDETERMINATE_CITED');
    else {
      compliance_flags.push('NAV_ERROR_PACK_MATERIALITY_OUTPUT_NOT_SUPPLIED');
      warnings.push('materiality_ref.output_payload was not supplied; materiality_verdict/error/declared_policy could not be echoed.');
    }
    if (supplementary.length === 0) {
      compliance_flags.push('NAV_ERROR_PACK_NO_SUPPLEMENTARY_RECEIPTS');
      warnings.push('no supplementary receipts (positions/pricing/prior-period NAV) were cited.');
    }
    compliance_flags.push('NAV_ERROR_PACK_INPUTS_SUPPLIED_NOT_VERIFIED');
  }

  const output_payload = {
    fund_id,
    detection_date,
    structural_error,
    materiality_verdict: materialityOutput ? materialityOutput.materiality_verdict : null,
    error: materialityOutput ? materialityOutput.error : null,
    declared_policy: materialityOutput ? materialityOutput.declared_policy : null,
    industry_convention: materialityOutput ? materialityOutput.industry_convention : null,
    reprocessing_need_indicated: materialityOutput ? materialityOutput.reprocessing_need_indicated : null,
    affected_period,
    correction,
    notification,
    cited_receipts,
    warnings,
    not_proven: NOT_PROVEN,
    fence: 'This pack CITES the supplied nav_ref/materiality_ref receipts (execution_hash + tool_id) and ECHOES the materiality verdict/error/policy fields verbatim from the caller-supplied materiality_ref.output_payload; it performs zero NAV recomputation and zero materiality-threshold arithmetic of its own, and it makes no claim of CSSF Circular 24/856 compliance -- informative citation only.',
    regulatory_framework: 'CSSF Circular 24/856 (Luxembourg, "Protection of investors in case of an NAV calculation error, an instance of non-compliance with the investment rules and other errors at UCI level", in force from 1 January 2025) and its Version 1 FAQ (24 December 2024) are cited as informative context for this disclosure bundle\'s shape (see research/clause-snapshots/CSSF24-856-NAV-error-2026-08-27.excerpt.md and CSSF24-856-FAQ-2026-08-27.excerpt.md); this kernel makes no compliance claim under either.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
