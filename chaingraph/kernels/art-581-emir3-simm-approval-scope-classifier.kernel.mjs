/**
 * art-581-emir3-simm-approval-scope-classifier.kernel.mjs
 *
 * CAPMKT wave (CAPMKT-WAVE-BUILD-SPEC.md §7, CAPMKT-SIMMCLASS-1) -- classifies
 * which EMIR 3 initial-margin (IM) model-approval obligations apply to a
 * caller-declared counterparty profile, for the end-2026 EBA/NCA rollout.
 *
 * ZERO SIMM METHODOLOGY CONTENT (licensing, ledger row 2026-08-06). This
 * kernel does NOT compute or reproduce any ISDA SIMM risk weight, correlation,
 * bucket, or sensitivity math, and reproduces no ISDA document. It classifies
 * REGULATORY OBLIGATIONS under EMIR (as amended by Regulation (EU) 2024/2987,
 * "EMIR 3") -- who must seek NCA/EBA approval, for what, and by when --
 * from counterparty-declared facts only. Methodology-level verification of
 * an actual IM model is deliberately absent from this tool; state that
 * plainly wherever this classifier's result is shown. No ISDA endorsement
 * is expressed or implied by any output of this kernel.
 *
 * CITATIONS (article-cited, verified current as of build date 2026-08-07;
 * re-verify at any reuse -- the RTS below is at CONSULTATION stage, not final):
 *   - EMIR Art. 11(12a) (inserted by Regulation (EU) 2024/2987 "EMIR 3",
 *     in force 24 Dec 2024): counterparties subject to the bilateral
 *     initial-margin requirement must obtain prior authorisation from their
 *     competent authority (NCA) before using, or adopting a change to, a
 *     model for initial-margin calculation. Pro forma models (the kernel
 *     treats ISDA SIMM as the pro forma-model case, per EBA's published
 *     opinion) have their elements and general aspects centrally validated
 *     by EBA; the NCA's role covers first the pro forma central-validation
 *     linkage and, for a proprietary/internal model, the full authorisation.
 *   - EMIR Art. 11(15): EBA, with ESMA, establishes supervisory procedures
 *     for the initial and ongoing validation of IM-model risk-management
 *     procedures under Art. 11. Implementing RTS/Guidelines were under
 *     public consultation 17 Mar - 17 Jun 2026 (EBA); NOT finalised at
 *     build date -- treat any NCA-timeline figure below as the published
 *     process expectation, not settled binding text.
 *   - EBA's central pro forma-model validation function became operational
 *     1 March 2026; NCAs were to submit their list of SIMM-intending
 *     entities to EBA by end-January 2026; annual application-data updates
 *     from firms are due to their NCA by end-March each year; SIMM
 *     applicants were to complete onboarding onto the EBA validation
 *     system by end-August 2026; EBA's initial SIMM-scope decision was
 *     expected by end-2026.
 *
 * Kernel is a PURE function of caller-declared facts, including the
 * evaluation date (as_of_date) -- it never reads the system clock, so the
 * same policy_parameters always produce the same verdict set.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-581-emir3-simm-approval-scope-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_emir3_simm_approval_scope',
  mandate_type: 'compliance_mandate', gpu: false,
};

const ONBOARDING_WINDOW_CLOSE = '2026-08-31'; // EBA-published SIMM-applicant onboarding cutoff, lexicographic YYYY-MM-DD compare

const MODEL_TYPES = new Set(['isda_simm', 'internal_model', 'none']);
const MODEL_STATUSES = new Set(['new_application', 'modification', 'already_authorised', 'not_applicable']);

function verdictObj(obligation_id, description, verdict, basis) {
  return { obligation_id, description, verdict, basis };
}

export function compute(pp) {
  const {
    counterparty_type = 'financial_counterparty',
    subject_to_bilateral_im = false,
    model_type = 'none',
    model_status = 'not_applicable',
    competent_authority_declared = false,
    as_of_date = '2026-08-07',
  } = pp;

  const safe_model_type = MODEL_TYPES.has(model_type) ? model_type : 'none';
  const safe_model_status = MODEL_STATUSES.has(model_status) ? model_status : 'not_applicable';
  const safe_subject = !!subject_to_bilateral_im;
  const safe_ca_declared = !!competent_authority_declared;
  const safe_date = /^\d{4}-\d{2}-\d{2}$/.test(as_of_date) ? as_of_date : '2026-08-07';

  const obligations = [];

  // 1 -- prior NCA authorisation before using/changing an IM model (Art. 11(12a))
  {
    const inScopeFacts = safe_subject && safe_model_type !== 'none'
      && (safe_model_status === 'new_application' || safe_model_status === 'modification');
    if (!inScopeFacts) {
      obligations.push(verdictObj(
        'NCA_PRIOR_AUTHORISATION', 'Prior NCA authorisation before using/changing an IM model',
        'OUT_OF_SCOPE', 'EMIR Art. 11(12a): no new-model application or model change declared, or entity not subject to the bilateral IM requirement.',
      ));
    } else if (!safe_ca_declared) {
      obligations.push(verdictObj(
        'NCA_PRIOR_AUTHORISATION', 'Prior NCA authorisation before using/changing an IM model',
        'INDETERMINATE', 'EMIR Art. 11(12a) obligation facts are met, but no home competent authority is declared -- the applicable NCA timeline cannot be resolved.',
      ));
    } else {
      obligations.push(verdictObj(
        'NCA_PRIOR_AUTHORISATION', 'Prior NCA authorisation before using/changing an IM model',
        'IN_SCOPE', 'EMIR Art. 11(12a): counterparty is subject to the bilateral IM requirement and declares a new model or a model change requiring prior NCA authorisation.',
      ));
    }
  }

  // 2 -- EBA central validation of pro forma model elements/general aspects (Art. 11(12a))
  {
    if (safe_model_type === 'isda_simm') {
      obligations.push(verdictObj(
        'EBA_CENTRAL_VALIDATION_PROFORMA', 'EBA central validation of pro forma model elements/general aspects',
        'IN_SCOPE', 'EMIR Art. 11(12a): the pro forma model case -- elements and general aspects are validated centrally by EBA rather than separately by each NCA.',
      ));
    } else {
      obligations.push(verdictObj(
        'EBA_CENTRAL_VALIDATION_PROFORMA', 'EBA central validation of pro forma model elements/general aspects',
        'OUT_OF_SCOPE', 'EMIR Art. 11(12a): declared model is not the pro forma-model case, so EBA central validation of general elements does not apply.',
      ));
    }
  }

  // 3 -- recurring annual application-data update to the home NCA (end-March)
  {
    if (safe_model_type === 'isda_simm' && safe_model_status === 'already_authorised') {
      obligations.push(verdictObj(
        'ANNUAL_APPLICATION_DATA_UPDATE', 'Annual application-data update to home NCA (end-March)',
        'IN_SCOPE', 'EBA validation process under EMIR Art. 11(15) supervisory procedures: an already-authorised SIMM user submits an annual update of application data to its NCA.',
      ));
    } else if (safe_model_type === 'isda_simm' && safe_model_status === 'new_application') {
      obligations.push(verdictObj(
        'ANNUAL_APPLICATION_DATA_UPDATE', 'Annual application-data update to home NCA (end-March)',
        'INDETERMINATE', 'EBA validation process under EMIR Art. 11(15): entity declares a new SIMM application not yet authorised -- whether the annual-update cycle applies before initial authorisation completes is not resolved by this classifier.',
      ));
    } else {
      obligations.push(verdictObj(
        'ANNUAL_APPLICATION_DATA_UPDATE', 'Annual application-data update to home NCA (end-March)',
        'OUT_OF_SCOPE', 'No already-authorised or pending ISDA SIMM use declared.',
      ));
    }
  }

  // 4 -- 2026 EBA validation-system onboarding window for SIMM applicants (by end-Aug 2026)
  {
    if (safe_model_type !== 'isda_simm' || safe_model_status === 'not_applicable') {
      obligations.push(verdictObj(
        'EBA_ONBOARDING_WINDOW_2026', '2026 EBA validation-system onboarding window for SIMM applicants',
        'OUT_OF_SCOPE', 'No ISDA SIMM use declared, so the EBA RIM Model Validation System onboarding window does not apply.',
      ));
    } else if (safe_date > ONBOARDING_WINDOW_CLOSE) {
      obligations.push(verdictObj(
        'EBA_ONBOARDING_WINDOW_2026', '2026 EBA validation-system onboarding window for SIMM applicants',
        'INDETERMINATE', 'Declared evaluation date is after the published end-August 2026 EBA onboarding cutoff; whether a late-onboarding path exists is not settled at consultation stage (RTS/Guidelines still in draft as of build date).',
      ));
    } else {
      obligations.push(verdictObj(
        'EBA_ONBOARDING_WINDOW_2026', '2026 EBA validation-system onboarding window for SIMM applicants',
        'IN_SCOPE', 'SIMM applicant on or before the published end-August 2026 EBA RIM Model Validation System onboarding cutoff.',
      ));
    }
  }

  const compliance_flags = ['EMIR3_SIMM_SCOPE_ASSESSED'];
  for (const o of obligations) {
    compliance_flags.push('EMIR3_' + o.obligation_id + '_' + o.verdict);
  }

  const output_payload = {
    obligations,
    counterparty_type,
    subject_to_bilateral_im: safe_subject,
    model_type: safe_model_type,
    model_status: safe_model_status,
    competent_authority_declared: safe_ca_declared,
    as_of_date: safe_date,
    methodology_verification: 'deliberately_absent',
    isda_endorsement: false,
  };
  return { output_payload, compliance_flags };
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
