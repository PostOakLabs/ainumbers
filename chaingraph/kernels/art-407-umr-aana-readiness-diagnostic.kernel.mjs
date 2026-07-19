import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-407-umr-aana-readiness-diagnostic';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'run_umr_aana_readiness',
  mandate_type: 'agent_guardrail_mandate', gpu: false,
};

// UMR (uncleared margin rules) readiness diagnostic, per AT-CLEARING-WAVE-SPEC.md
// CW-2. Determines AANA in-scope status against the regulatory threshold, flags
// counterparties whose CALLER-DECLARED estimated initial margin crosses the
// regulatory IM threshold (documentation/custody must be ready for those), and
// grades readiness. This node does NOT compute SIMM initial margin -- SIMM is a
// licensed ISDA methodology; estimated_im_eur per counterparty is always a
// caller declaration, never derived here from risk-class sensitivities. This is
// an eligibility/readiness checker, not a SIMM engine. Thresholds are pinned
// constants (constants_version + vintage), echoed in the output so a stale
// caller can see what vintage was used -- never fetched, never silently
// re-derived. Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new
// Date(), no Math.random.

// Regulatory thresholds (BCBS-IOSCO UMR framework, as adopted in US/EU/UK
// implementations): AANA in-scope >EUR 8bn (measured group-wide, March/April
// average per local rule); IM threshold EUR 50m (below = exempt from posting/
// collecting regulatory IM even if in scope). Phases 1-6 are all live as of
// this vintage -- there is no remaining phase-in gate, only the AANA + IM
// threshold gates below.
const THRESHOLDS = {
  aana_in_scope_eur: 8_000_000_000,
  im_threshold_eur: 50_000_000,
  constants_version: '2026-07-19.umr-bcbs-iosco-v1',
  vintage: '2026-07-19',
};

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r2(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }

const DOC_SCORE = { executed: 2, in_progress: 1, not_started: 0 };
const grade = (s) => (s >= 1.75 ? 'A' : s >= 1.25 ? 'B' : s >= 0.75 ? 'C' : s >= 0.25 ? 'D' : 'F');

export function compute(pp) {
  pp = pp || {};
  const aanaEur = safeNum(pp.aana_group_eur, 0);
  const counterpartiesRaw = Array.isArray(pp.counterparties) ? pp.counterparties : [];

  const compliance_flags = [];
  const in_scope_aana = aanaEur > THRESHOLDS.aana_in_scope_eur;
  compliance_flags.push(in_scope_aana ? 'UMR_IN_SCOPE_AANA' : 'UMR_OUT_OF_SCOPE_AANA');
  if (counterpartiesRaw.length === 0) compliance_flags.push('UMR_NO_COUNTERPARTIES_DECLARED');

  const counterparties = counterpartiesRaw.map((c) => {
    const counterparty_id = String((c && c.counterparty_id) || '').trim();
    const estimated_im_eur = safeNum(c && c.estimated_im_eur, 0);
    const documentation_status = ['executed', 'in_progress', 'not_started'].includes(c && c.documentation_status)
      ? c.documentation_status : 'not_started';
    const custodian_ready = !!(c && c.custodian_ready);
    const over_im_threshold = in_scope_aana && estimated_im_eur > THRESHOLDS.im_threshold_eur;

    const readiness_components = [DOC_SCORE[documentation_status], custodian_ready ? 2 : 0];
    const readiness_avg = readiness_components.reduce((a, b) => a + b, 0) / readiness_components.length;
    const readiness_grade = over_im_threshold ? grade(readiness_avg) : 'N/A';

    return {
      counterparty_id,
      estimated_im_eur: r2(estimated_im_eur),
      documentation_status,
      custodian_ready,
      over_im_threshold,
      readiness_grade,
    };
  });

  const over_threshold = counterparties.filter((c) => c.over_im_threshold);
  const gaps = over_threshold.filter((c) => c.documentation_status !== 'executed' || !c.custodian_ready);
  if (over_threshold.length > 0) compliance_flags.push('UMR_COUNTERPARTIES_OVER_IM_THRESHOLD');
  if (gaps.length > 0) compliance_flags.push('UMR_READINESS_GAPS_OPEN');

  const remediation_checklist = gaps.map((c) => ({
    counterparty_id: c.counterparty_id,
    action: c.documentation_status !== 'executed' && !c.custodian_ready
      ? 'Execute the ISDA/CSA UMR documentation and stand up segregated custodian connectivity before regulatory IM applies.'
      : c.documentation_status !== 'executed'
        ? 'Execute the ISDA/CSA UMR documentation for this counterparty.'
        : 'Stand up segregated custodian connectivity for this counterparty.',
  }));

  const overall_score = over_threshold.length > 0
    ? over_threshold.reduce((a, c) => a + (DOC_SCORE[c.documentation_status] + (c.custodian_ready ? 2 : 0)), 0) / (over_threshold.length * 2)
    : null;
  const overall_grade = !in_scope_aana ? 'N/A' : over_threshold.length === 0 ? 'N/A' : grade(overall_score);

  const output_payload = {
    aana_group_eur: r2(aanaEur),
    aana_in_scope_threshold_eur: THRESHOLDS.aana_in_scope_eur,
    im_threshold_eur: THRESHOLDS.im_threshold_eur,
    constants_version: THRESHOLDS.constants_version,
    thresholds_vintage: THRESHOLDS.vintage,
    in_scope_aana,
    counterparty_count: counterparties.length,
    counterparties,
    counterparties_over_im_threshold: over_threshold.length,
    overall_grade,
    remediation_checklist,
    note: 'Eligibility/readiness diagnostic for the BCBS-IOSCO uncleared margin rules (UMR). Estimated IM per counterparty is a caller declaration, never a SIMM computation -- SIMM is a licensed ISDA methodology, not reproduced here. Not legal or margin advice.',
    disambiguation: 'This receipt attests our computation over the AANA and per-counterparty inputs the caller declared -- it does not audit or verify those inputs, and is not a determination that any entity is in or out of UMR scope.',
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
