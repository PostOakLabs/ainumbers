/**
 * art-485-regrpt-variance-explainer.kernel.mjs
 * Assurance Waves program (REGRPT-EDITCHECK-BUILD-SPEC.md §1, RGEC-K-1) — period-over-period
 * regulatory-report variance explainer.
 *
 * Regulatory report review (FFIEC Call Report analytical review, EBA supervisory review) flags
 * line items whose period-over-period movement crosses a materiality threshold as requiring a
 * written explanation. This kernel computes absolute and relative movement per line item across
 * an instance pair (prior vs current), ranks by contribution (largest absolute movement first),
 * and flags which movements breach a policy-supplied materiality threshold. It does NOT judge
 * whether a supplied explanation is adequate — that is a human review-and-approval step (§2
 * gate policy: a flagged variance with no explanation annotation routes to `review_required`).
 * This kernel's output feeds that gate; it is not itself the gate.
 *
 * Materiality thresholds are POLICY INPUT (`policy_parameters.materiality_policy`), never baked
 * into kernel source — the same rule-set-versions-every-cycle discipline as art-484's edit
 * rules. A default threshold applies unless a line-item-specific override is supplied.
 *
 * Zero PII — line items and figures are structural report data, not personal data. Zero
 * network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: REGRPT-EDITCHECK-BUILD-SPEC.md §1 (RGEC-K-1, art-485).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-485-regrpt-variance-explainer';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'explain_regrpt_variance', mandate_type: 'regulatory_reporting', gpu: false };

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function isFiniteNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function normArray(v) { return Array.isArray(v) ? v : []; }

function buildLineItemMap(cells) {
  const map = new Map();
  for (const c of cells) {
    if (!c || typeof c !== 'object') continue;
    const line_item = safeStr(c.line_item);
    if (!line_item) continue;
    map.set(line_item, isFiniteNum(c.value) ? c.value : null);
  }
  return map;
}

export function compute(pp) {
  pp = pp || {};
  const pair = pp.instance_pair && typeof pp.instance_pair === 'object' ? pp.instance_pair : {};
  const prior = pair.prior && typeof pair.prior === 'object' ? pair.prior : {};
  const current = pair.current && typeof pair.current === 'object' ? pair.current : {};
  const prior_as_of = safeStr(prior.as_of) || null;
  const current_as_of = safeStr(current.as_of) || null;

  const priorMap = buildLineItemMap(normArray(prior.cells));
  const currentMap = buildLineItemMap(normArray(current.cells));

  const materiality = pp.materiality_policy && typeof pp.materiality_policy === 'object' ? pp.materiality_policy : {};
  const defaultAbs = isFiniteNum(materiality.default_threshold_abs) ? materiality.default_threshold_abs : 0;
  const defaultPct = isFiniteNum(materiality.default_threshold_pct) ? materiality.default_threshold_pct : 0;
  const overrides = materiality.per_line_overrides && typeof materiality.per_line_overrides === 'object' ? materiality.per_line_overrides : {};
  const policy_version = safeStr(materiality.version) || null;

  const explanationsIn = normArray(pp.explanations);
  const explainedLineItems = new Set(explanationsIn.map((e) => (e && typeof e === 'object' ? safeStr(e.line_item) : '')).filter(Boolean));

  const lineItems = new Set([...priorMap.keys(), ...currentMap.keys()]);
  const compliance_flags = [];

  const variances = [...lineItems].map((line_item) => {
    const priorVal = priorMap.has(line_item) ? priorMap.get(line_item) : null;
    const currentVal = currentMap.has(line_item) ? currentMap.get(line_item) : null;
    const hasBoth = isFiniteNum(priorVal) && isFiniteNum(currentVal);
    const abs_change = hasBoth ? currentVal - priorVal : null;
    const pct_change = hasBoth && priorVal !== 0 ? abs_change / Math.abs(priorVal) : null;

    const override = overrides[line_item] && typeof overrides[line_item] === 'object' ? overrides[line_item] : {};
    const threshold_abs = isFiniteNum(override.abs) ? override.abs : defaultAbs;
    const threshold_pct = isFiniteNum(override.pct) ? override.pct : defaultPct;

    const breachesAbs = abs_change !== null && Math.abs(abs_change) >= threshold_abs && threshold_abs > 0;
    const breachesPct = pct_change !== null && Math.abs(pct_change) >= threshold_pct && threshold_pct > 0;
    const is_material = breachesAbs || breachesPct;
    const has_explanation = explainedLineItems.has(line_item);
    const requires_explanation = is_material && !has_explanation;

    if (requires_explanation) compliance_flags.push(`VARIANCE_UNEXPLAINED:${line_item}`);

    return {
      line_item,
      prior_value: priorVal,
      current_value: currentVal,
      abs_change,
      pct_change,
      threshold_abs,
      threshold_pct,
      is_material,
      has_explanation,
      requires_explanation,
      contribution: abs_change === null ? 0 : Math.abs(abs_change),
    };
  });

  variances.sort((a, b) => b.contribution - a.contribution);
  const ranked = variances.map((v, idx) => ({ ...v, rank: idx + 1 }));

  const materialCount = ranked.filter((v) => v.is_material).length;
  const requiresExplanationCount = ranked.filter((v) => v.requires_explanation).length;
  const totalAbsMovement = ranked.reduce((sum, v) => sum + v.contribution, 0);

  const summary = {
    total_line_items: ranked.length,
    material_count: materialCount,
    requires_explanation_count: requiresExplanationCount,
    total_abs_movement: totalAbsMovement,
    all_material_explained: requiresExplanationCount === 0,
  };

  const seen = new Set();
  const flags = [];
  for (const f of compliance_flags) { if (!seen.has(f)) { seen.add(f); flags.push(f); } }

  const output_payload = {
    prior_as_of,
    current_as_of,
    policy_version,
    variances: ranked,
    summary,
    compliance_flags: flags,
    note: 'Period-over-period variance, ranked by absolute-movement contribution, flagged against a policy-supplied materiality threshold (default plus per-line overrides). Whether a supplied explanation is adequate is a human review step, not judged here; this output feeds that gate.',
  };

  return { output_payload, compliance_flags: flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
