/**
 * art-65-ai-conformity-pack-builder.kernel.mjs
 * Wave 15 — AI Act Conformity Pack Builder (Annex IV + CE marking / EU Declaration of Conformity).
 * The flagship PROVIDER tool: scores Annex IV technical-documentation completeness,
 * selects the right conformity-assessment route (internal control vs notified body),
 * gates CE-marking readiness, and emits a DoC skeleton.
 * PREPARE-AHEAD: these obligations are confirmed for 2 Dec 2027 (Digital Omnibus
 * provisional agreement 7 May 2026) or original 2 Aug 2026 if the Omnibus is not
 * formally adopted before that date. Verify current AI Act timeline before relying
 * on either date.
 *
 * Citations (verify before citing):
 *   EU AI Act Arts 11 (technical documentation), 16 (provider obligations),
 *   17 (quality-management system), 43 (conformity assessment for Annex III systems),
 *   47 (EU declaration of conformity), 48 (CE marking), Annex IV (mandatory sections).
 *   Digital Omnibus on AI (provisional agreement 7 May 2026) — confirms Annex III
 *   high-risk financial services financial-standing/credit-scoring/insurance-pricing
 *   deferred to 2 Dec 2027. Verify formal-adoption status.
 *   EDUCATIONAL: outputs are decision-support drafts, not legal conformity certificates.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-65-ai-conformity-pack-builder';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'build_ai_conformity_pack',
  mandate_type: 'model_governance',
  gpu:          false,
};

// ─── Annex IV sections ────────────────────────────────────────────────────────
// Based on EU AI Act Annex IV — verify against consolidated text before citing.
const ANNEX_IV_SECTIONS = [
  { id: 'description', label: 'System description, version, and intended purpose (Annex IV §1)' },
  { id: 'design',      label: 'Design specifications and development process (Annex IV §2)' },
  { id: 'training',    label: 'Training data, training methodology, and dataset practices (Annex IV §3)' },
  { id: 'validation',  label: 'Validation and testing procedures + performance metrics (Annex IV §4)' },
  { id: 'standards',   label: 'Applicable harmonised standards or common specifications complied with (Annex IV §5)' },
  { id: 'qa',          label: 'Quality management system documentation (Art 17) (Annex IV §6)' },
  { id: 'risk',        label: 'Art 9 risk-management system documentation (Annex IV §7)' },
  { id: 'changes',     label: 'Post-market monitoring plan + substantial-modification log (Annex IV §8)' },
  { id: 'copies',      label: 'Conformity assessment procedure applied (Annex IV §9)' },
  { id: 'declaration', label: 'EU declaration of conformity reference (Annex IV §10)' },
];

const STATUS_SCORE = { complete: 4, partial: 2, missing: 0 };
const pick   = (t, v, d = 0) => (v in t ? t[v] : d);
const letter = s => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');

export function compute(pp) {
  const {
    system          = { name: '', role: 'provider', annex_iii_use_case: 'credit-scoring' },
    technical_documentation = [],  // [{section, status, evidence_ref}]
    conformity_route        = 'internal-control',
    risk_mgmt_system        = 'none',
    data_governance         = 'none',
    accuracy_robustness_cyber = 'none',
    quality_management      = 'none',
  } = pp;

  // ── Annex IV scoring ──
  const tdMap = {};
  for (const td of technical_documentation) {
    if (td.section) tdMap[td.section] = td;
  }

  const annex_iv_gaps = [];
  let tdTotal = 0;
  let tdCount = 0;
  for (const sec of ANNEX_IV_SECTIONS) {
    const entry = tdMap[sec.id];
    const status = entry?.status ?? 'missing';
    const score  = pick(STATUS_SCORE, status);
    tdTotal += score;
    tdCount += 4; // max per section
    if (status !== 'complete') {
      annex_iv_gaps.push({
        section:     sec.id,
        label:       sec.label,
        status,
        evidence_ref: entry?.evidence_ref ?? null,
        remediation: `Complete ${sec.label}. Verify requirement against EU AI Act Annex IV consolidated text.`,
      });
    }
  }
  const annex_iv_score = +(tdTotal / tdCount * 100).toFixed(1);
  const annex_iv_grade = letter(annex_iv_score);

  // ── Articles 9/10/15/17 ──
  const artScores = {
    art9:  pick({ full: 4, partial: 2, none: 0 }, risk_mgmt_system),
    art10: pick({ full: 4, partial: 2, none: 0 }, data_governance),
    art15: pick({ full: 4, partial: 2, none: 0 }, accuracy_robustness_cyber),
    art17: pick({ full: 4, partial: 2, none: 0 }, quality_management),
  };
  const artMean = Object.values(artScores).reduce((a, b) => a + b, 0) / Object.keys(artScores).length;
  const art_score = +(artMean / 4 * 100).toFixed(1);
  const art_grade = letter(art_score);

  // ── Conformity route validation ──
  // Internal control is permitted for most Annex III FS use cases (Art 43 — verify against text).
  // Notified body required if no harmonised standards or system is novel/high-risk tier.
  const conformity_route_note = conformity_route === 'notified-body'
    ? 'Notified-body route selected. Identify an EU-notified body for AI systems (Art 43). No notified bodies formally designated as of verification date 2026-06-20 — verify current status with EU AI Office.'
    : 'Internal-control route selected. Permitted for high-risk systems where harmonised standards exist or Art 43(4) conditions are met. Verify applicability against consolidated Art 43 text. Decision-support note — not a legal determination.';

  // ── CE-marking readiness ──
  const ce_ready = annex_iv_score >= 85
    && art_score >= 70
    && technical_documentation.length >= ANNEX_IV_SECTIONS.length;

  const ce_readiness_note = ce_ready
    ? 'CE-marking prerequisites appear met based on scoring. Conduct formal conformity assessment and sign the EU Declaration of Conformity (Art 47-48) before affixing the CE marking. Decision-support only.'
    : 'CE-marking prerequisites NOT met — Annex IV technical documentation and/or Articles 9/10/15/17 obligations have gaps. Address gaps before conformity assessment.';

  // ── DoC skeleton ──
  const declaration_of_conformity_skeleton = {
    note: 'DECISION-SUPPORT SKELETON ONLY — not a legally-binding EU Declaration of Conformity. Prepare and sign the actual declaration following EU AI Act Art 47 requirements. Have it reviewed by qualified legal counsel.',
    template: {
      declaration_number: '[ASSIGN — unique identifier]',
      provider_name:      system.name || '[Provider legal name]',
      provider_address:   '[Provider registered address]',
      system_name:        system.name || '[AI system name and version]',
      annex_iii_use_case: system.annex_iii_use_case || '[Annex III use case]',
      applicable_regulation: 'EU AI Act (Reg. 2024/1689)',
      conformity_route:   conformity_route,
      harmonised_standards: '[List applicable harmonised standards, or state: none yet published]',
      notified_body:      conformity_route === 'notified-body' ? '[Notified body name, number, certificate]' : 'N/A — internal control route',
      declaration_date:   '[Date of declaration]',
      signatory:          '[Authorised representative name and role]',
      statement:          'The AI system described above conforms to Regulation (EU) 2024/1689 and the applicable conformity assessment procedure has been carried out.',
    },
  };

  // ── Compliance flags ──
  const compliance_flags = [];
  if (annex_iv_grade === 'D' || annex_iv_grade === 'F') compliance_flags.push('ANNEX_IV_INCOMPLETE');
  if (conformity_route === 'notified-body')              compliance_flags.push('NOTIFIED_BODY_REQUIRED');
  if (!ce_ready)                                         compliance_flags.push('NOT_CE_READY');
  if (artScores.art9 < 4)                                compliance_flags.push('ART9_RISK_MGMT_GAP');
  if (artScores.art10 < 4)                               compliance_flags.push('ART10_DATA_GOVERNANCE_GAP');

  const overall_score = +(annex_iv_score * 0.55 + art_score * 0.45).toFixed(1);
  const overall_grade = letter(overall_score);

  const output_payload = {
    system: { name: system.name, role: system.role, annex_iii_use_case: system.annex_iii_use_case },
    conformity_grade:  overall_grade,
    annex_iv_score,
    annex_iv_grade,
    annex_iv_gaps,
    conformity_route,
    conformity_route_note,
    articles_status: {
      art9:  { status: risk_mgmt_system,         score: artScores.art9,  label: 'Art 9 Risk-Management System' },
      art10: { status: data_governance,           score: artScores.art10, label: 'Art 10 Data Governance' },
      art15: { status: accuracy_robustness_cyber, score: artScores.art15, label: 'Art 15 Accuracy/Robustness/Cybersecurity' },
      art17: { status: quality_management,        score: artScores.art17, label: 'Art 17 Quality-Management System' },
    },
    ce_ready,
    ce_readiness_note,
    declaration_of_conformity_skeleton,
    applicable_date_note: 'Annex III high-risk obligations: Digital Omnibus proposes 2 Dec 2027 (provisional agreement 7 May 2026). Verify formal-adoption status against Official Journal before relying on this date. Original date: 2 Aug 2026.',
    note: 'PREPARE-AHEAD — Decision-support draft for conformity-pack planning. Outputs are not legal conformity certificates or CE-marking authorisations. Verify all Art/Annex references against EU AI Act (Reg. 2024/1689) consolidated text at https://eur-lex.europa.eu/eli/reg/2024/1689/oj.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    compute_mode:       'server',
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
