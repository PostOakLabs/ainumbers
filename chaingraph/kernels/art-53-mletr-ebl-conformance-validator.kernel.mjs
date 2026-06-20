/**
 * art-53-mletr-ebl-conformance-validator.kernel.mjs
 * Wave 12 — MLETR / eBL Conformance & Enforceability Validator.
 * Validates an electronic transferable record against MLETR functional-equivalence
 * tests (Arts. 10–12) and scores cross-corridor legal enforceability.
 * Pure decision kernel — no DOM, no window, no Date.now().
 * Spec: WORKFLOW-CANDIDATES-WAVE12_2026-06-19.md §2.2.
 * Citations: UNCITRAL MLETR; UK ETDA 2023; France Decree 2025-811; Singapore ETA.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-53-mletr-ebl-conformance-validator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'validate_mletr_record',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// MLETR functional-equivalence test scores (0=fail, 2=partial, 4=pass)
const TEST_SCORES = {
  singularity: { 'single-authoritative-copy': 4, 'token': 4, 'registry-control': 3, 'unclear': 0 },
  control:     { 'exclusive-control-cryptographic': 4, 'platform-custody': 2, 'multi-party-unclear': 0 },
  integrity:   { 'hash-chain': 4, 'digital-signature': 4, 'platform-log': 2, 'none': 0 },
  reliability: { 'qualified-trust-service': 4, 'platform-attested': 2, 'self-asserted': 0 },
};

// MLETR jurisdiction adoption status (verified Jan 2026; check UNCITRAL table for updates)
const JX_STATUS = {
  'UK': 'adopted',           // Electronic Trade Documents Act 2023
  'Singapore': 'adopted',   // Electronic Transactions Act
  'UAE': 'adopted',
  'France': 'adopted',      // Decree No. 2025-811 — first EU member full transposition
  'Bahrain': 'adopted',
  'Japan': 'adopted',       // Commercial Code amendment, FY2026 implementation
  'India': 'adopted',       // 2025 MLETR-aligned legislation
  'US': 'aligned',          // UCC Art. 7 / UETA alignment
  'Germany': 'aligned',
  'other-adopted': 'adopted',
  'other': 'not-adopted',
};

// Preferred governing-law choices for weaker corridors
const PREFERRED_GL = ['UK', 'Singapore', 'UAE', 'France'];

const pick = (table, val, dflt = 0) => (val in table ? table[val] : dflt);
const pct  = (raw4) => +(raw4 / 4 * 100).toFixed(1);
const letter = (s) => (s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'F');

const REMEDIATION = {
  singularity: 'Implement a single authoritative-copy mechanism — token-based registry or designated system of record per MLETR Art. 10.',
  control:     'Establish exclusive control via cryptographic key assignment (not shared-platform access) per MLETR Art. 11.',
  integrity:   'Add hash-chain or digital-signature integrity to the electronic record per MLETR Art. 10.',
  reliability: 'Upgrade to a qualified trust service or platform-attested reliability standard per MLETR Art. 12.',
};

const ARTICLES = {
  singularity: 'MLETR Art. 10 — singularity / authoritative copy',
  control:     'MLETR Art. 11 — exclusive control',
  integrity:   'MLETR Art. 10 — integrity of the electronic record',
  reliability: 'MLETR Art. 12 — reliability of the issuing system',
};

export function compute(pp) {
  const {
    record_type            = 'ebl',
    singularity_mechanism  = 'registry-control',
    control_method         = 'platform-custody',
    integrity_method       = 'digital-signature',
    reliability_standard   = 'platform-attested',
    origin_jurisdiction    = 'mletr-adopted',
    dest_jurisdiction      = 'mletr-adopted',
    platform               = '',
    governing_law          = 'UK',
  } = pp;

  // Score each MLETR functional-equivalence test
  const raw = {
    singularity: pick(TEST_SCORES.singularity, singularity_mechanism),
    control:     pick(TEST_SCORES.control,     control_method),
    integrity:   pick(TEST_SCORES.integrity,   integrity_method),
    reliability: pick(TEST_SCORES.reliability, reliability_standard),
  };

  const test_results = {};
  for (const [k, score4] of Object.entries(raw)) {
    const score = pct(score4);
    const grade = letter(score);
    const result = score4 >= 4 ? 'pass' : score4 >= 2 ? 'partial' : 'fail';
    test_results[k] = {
      score,
      grade,
      result,
      article: ARTICLES[k],
      remediation: result !== 'pass' ? REMEDIATION[k] : null,
    };
  }

  const avg_score = +(Object.values(raw).reduce((a, b) => a + b, 0) / 4 / 4 * 100).toFixed(1);
  const conformance_grade = letter(avg_score);

  // Enforceability matrix
  const ox = JX_STATUS[origin_jurisdiction] ?? 'not-adopted';
  const dx = JX_STATUS[dest_jurisdiction]   ?? 'not-adopted';
  let enforceability_tier;
  if (ox === 'adopted' && dx === 'adopted')                    enforceability_tier = 'strong';
  else if (ox === 'not-adopted' || dx === 'not-adopted')       enforceability_tier = 'weak';
  else                                                          enforceability_tier = 'conditional'; // one or both 'aligned'

  // Governing law recommendation
  let governing_law_recommendation;
  if (enforceability_tier === 'strong') {
    governing_law_recommendation = `${governing_law} governing law is consistent with both MLETR-adopted jurisdictions — no change needed.`;
  } else if (enforceability_tier === 'conditional') {
    governing_law_recommendation = `Consider specifying ${PREFERRED_GL[0]} or ${PREFERRED_GL[1]} governing law to strengthen enforceability where one corridor is only MLETR-aligned.`;
  } else {
    governing_law_recommendation = `Weak corridor — specify ${PREFERRED_GL[0]}, ${PREFERRED_GL[1]}, or ${PREFERRED_GL[2]} governing law and ensure the eBL terms expressly incorporate MLETR-equivalent requirements. Paper fallback may be required.`;
  }

  const remediation_checklist = Object.entries(test_results)
    .filter(([, v]) => v.result !== 'pass')
    .map(([k, v]) => ({ test: k, grade: v.grade, article: v.article, action: v.remediation }));

  const compliance_flags = [];
  Object.entries(test_results).forEach(([k, v]) => {
    if (v.result === 'fail') compliance_flags.push(`MLETR_NONCONFORMANT_${k.toUpperCase()}`);
  });
  if (enforceability_tier === 'weak')         compliance_flags.push('CORRIDOR_NOT_ENFORCEABLE');
  if (enforceability_tier === 'weak')         compliance_flags.push('PAPER_FALLBACK_REQUIRED');
  if (conformance_grade === 'D' || conformance_grade === 'F') compliance_flags.push('LOW_CONFORMANCE');

  const output_payload = {
    conformance_grade,
    conformance_score: avg_score,
    test_results,
    enforceability_tier,
    corridor_matrix: {
      origin: origin_jurisdiction,
      dest:   dest_jurisdiction,
      origin_status: ox,
      dest_status:   dx,
      verdict: enforceability_tier,
    },
    governing_law_recommendation,
    remediation_checklist,
    status_table_asof: '2026-01-01',
    note: 'Verify jurisdiction status against the current UNCITRAL MLETR status table before relying on this assessment. Educational tool — not legal advice.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':          'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version:  '0.4.0',
    mandate_type:        meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
