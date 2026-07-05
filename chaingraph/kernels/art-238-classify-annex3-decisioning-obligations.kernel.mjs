import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-238-classify-annex3-decisioning-obligations';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_annex3_decisioning_obligations',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ─── EU AI Act Annex III 5(b)/(5)(c) Decisioning Obligations Classifier ──────
// EXTENDS run_ai_act_highrisk_fit (art-64): that node performs the broad
// 12-question A-F diagnostic and high-risk classification. THIS node extends it
// with FS-specific decisioning payload for Annex III 5(b) creditworthiness and
// 5(c) life/health insurance pricing:
//   - Art 12(2) logging requirements (decision records, retention ≥ 6 months)
//   - Art 26(6) deployer duties (fundamental rights impact, oversight)
//   - FRIA (Fundamental Rights Impact Assessment) trigger
//   - EU AI Act database registration obligation
//   - Aug 2026 enforcement dates
//
// RELATIONSHIP: Feed run_ai_act_highrisk_fit (art-64) first to confirm the base
// high-risk classification. Then use this node to resolve the FS-specific Art 12
// and Art 26 obligations. Do NOT re-run base classification here — consume the
// is_high_risk signal passed in by the caller.
//
// Disambiguation: classify_annex3_decisioning_obligations resolves FS-specific
// Art 12 / Art 26 obligations for Annex III 5(b)/(5)(c) systems. It is NOT
// run_ai_act_highrisk_fit (art-64) which performs the base high-risk A-F
// classification across all Annex III categories.
//
// Regulatory basis:
//   EU AI Act (Reg. 2024/1689) Annex III 5(b), 5(c); Art 12(2); Art 26(6); Art 27(1)
//   Digital Omnibus (provisional agreement 7 May 2026): enforcement -> 2 Dec 2027 (verify)
//   table_version: "EU-AIA-ANNEX3-FS-2024-1689-R1"

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeBool(v) { return v === true || v === 'true' || v === 1; }

const ANNEX3_FS_CATEGORIES = ['5b_creditworthiness', '5c_life_health_insurance_pricing', 'other', 'unknown'];

export function compute(pp) {
  pp = pp || {};

  const is_high_risk        = safeBool(pp.is_high_risk);
  const annex3_category     = safeStr(pp.annex3_category || 'unknown').toLowerCase();
  const deployer_role       = safeStr(pp.deployer_role || '').toLowerCase(); // 'provider', 'deployer', 'both', 'unknown'
  const has_human_oversight = safeBool(pp.has_human_oversight);
  const fria_completed      = safeBool(pp.fria_completed);
  const db_registered       = safeBool(pp.db_registered);
  const logging_implemented = safeBool(pp.logging_implemented);

  // ── Empty / out-of-scope guard ─────────────────────────────────────────────
  if (!is_high_risk) {
    return {
      output_payload: {
        is_high_risk: false,
        annex3_category: annex3_category || 'unknown',
        scope_verdict: 'OUT_OF_SCOPE',
        scope_note: 'System classified as NOT high-risk by run_ai_act_highrisk_fit (art-64). Art 12 logging and Art 26 deployer obligations do not apply to this system. Re-run base classification if use case changes.',
        obligations: [],
        art12_logging_required: false,
        fria_required: false,
        db_registration_required: false,
        art26_deployer_duties_apply: false,
        compliance_gaps: [],
        do_now: [],
        regulatory_basis: 'EU AI Act (Reg. 2024/1689) Annex III 5(b), 5(c); Art 12(2); Art 26(6)',
        table_version: 'EU-AIA-ANNEX3-FS-2024-1689-R1',
        enforcement_dates: {
          original: '2026-08-02',
          digital_omnibus_proposed: '2027-12-02',
          note: 'Digital Omnibus (provisional agreement 7 May 2026) proposes Annex III high-risk obligations to 2 Dec 2027. Verify current AI Act status.',
        },
      },
      compliance_flags: ['OUT_OF_SCOPE_NOT_HIGH_RISK'],
    };
  }

  // ── Annex III 5(b)/(5)(c) specific obligations ────────────────────────────
  const is_5b = annex3_category.includes('5b') || annex3_category.includes('credit');
  const is_5c = annex3_category.includes('5c') || annex3_category.includes('insurance');
  const is_fs = is_5b || is_5c;

  const obligations = [];
  const do_now = [];
  const compliance_gaps = [];

  // Art 12(2) — Logging
  obligations.push({
    article: 'Art 12(2)',
    obligation: 'Log inputs, outputs, timestamps, model version, override flags, natural-person-ID field. Retain >= 6 months.',
    status: logging_implemented ? 'IMPLEMENTED' : 'REQUIRED',
  });
  if (!logging_implemented) {
    compliance_gaps.push('Art 12(2): logging not yet implemented');
    do_now.push('Implement Art 12-conformant decision log records (use build_ai_decision_log_record).');
  }

  // Art 26(6) — Deployer duties
  const art26_apply = deployer_role === 'deployer' || deployer_role === 'both' || !deployer_role || deployer_role === 'unknown';
  if (art26_apply) {
    obligations.push({
      article: 'Art 26(6)',
      obligation: 'Deployer: conduct FRIA before deployment for Annex III 5(b)/(5)(c) systems. Maintain human oversight mechanism.',
      status: (fria_completed && has_human_oversight) ? 'IMPLEMENTED' : 'REQUIRED',
    });
    if (!fria_completed) {
      compliance_gaps.push('Art 26(6): FRIA not completed');
      do_now.push('Complete Fundamental Rights Impact Assessment (FRIA) before deployment.');
    }
    if (!has_human_oversight) {
      compliance_gaps.push('Art 26(6): human oversight mechanism not in place');
      do_now.push('Implement human oversight mechanism (Art 26(6)) — must be present at deployment.');
    }
  }

  // Art 27(1) — EU database registration
  obligations.push({
    article: 'Art 27(1)',
    obligation: is_5b ? 'Register creditworthiness AI system in EU AI Act public database before deployment.' :
                is_5c ? 'Register life/health insurance pricing AI system in EU AI Act public database before deployment.' :
                'Register high-risk AI system in EU AI Act public database before deployment.',
    status: db_registered ? 'IMPLEMENTED' : 'REQUIRED',
  });
  if (!db_registered) {
    compliance_gaps.push('Art 27(1): EU AI Act database registration not completed');
    do_now.push('Register in EU AI Act public database at https://database.ai.ec.europa.eu before deployment.');
  }

  const scope_verdict = is_fs ? (is_5b ? 'ANNEX3_5B_CREDITWORTHINESS' : 'ANNEX3_5C_LIFE_HEALTH_INSURANCE') : 'ANNEX3_HIGH_RISK_OTHER_FS';
  const all_implemented = compliance_gaps.length === 0;

  const compliance_flags = [];
  if (compliance_gaps.length > 0) compliance_flags.push('COMPLIANCE_GAPS_PRESENT');
  if (!logging_implemented) compliance_flags.push('ART12_LOGGING_NOT_IMPLEMENTED');
  if (!fria_completed && art26_apply) compliance_flags.push('FRIA_NOT_COMPLETED');
  if (!db_registered) compliance_flags.push('EU_DB_REGISTRATION_PENDING');
  if (!has_human_oversight && art26_apply) compliance_flags.push('HUMAN_OVERSIGHT_ABSENT');

  const output_payload = {
    is_high_risk: true,
    annex3_category,
    scope_verdict,
    is_5b_creditworthiness: is_5b,
    is_5c_life_health_insurance: is_5c,
    art12_logging_required: true,
    fria_required: art26_apply,
    db_registration_required: true,
    art26_deployer_duties_apply: art26_apply,
    obligations,
    compliance_gaps,
    do_now,
    all_obligations_met: all_implemented,
    enforcement_readiness: all_implemented ? 'READY' : 'NOT_READY',
    regulatory_basis: 'EU AI Act (Reg. 2024/1689) Annex III 5(b), 5(c); Art 12(2) (decision logging); Art 26(6) (deployer duties + FRIA); Art 27(1) (EU database registration)',
    extends_tool: 'run_ai_act_highrisk_fit (art-64)',
    extends_note: 'This node extends run_ai_act_highrisk_fit with FS-specific Art 12 and Art 26 obligations. Run art-64 first to confirm is_high_risk=true.',
    table_version: 'EU-AIA-ANNEX3-FS-2024-1689-R1',
    enforcement_dates: {
      original: '2026-08-02',
      digital_omnibus_proposed: '2027-12-02',
      note: 'Digital Omnibus (provisional agreement 7 May 2026) proposes Annex III high-risk obligations to 2 Dec 2027. Verify current AI Act status.',
    },
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
