/**
 * art-504-classify-carf-reportable.kernel.mjs
 * Assurance Waves program (CARF-DAC8-BUILD-SPEC.md §1, CARF-K-1) — CARF / DAC8
 * reportable-user and reportable-transaction classifier.
 *
 * This is the FATCA-RO shape (art-490 / art-491, FATCA-RO-BUILD-SPEC.md) one asset class
 * over: the regulation's own role name is the approver, every input is a public
 * machine-readable schema, and a status file comes back per submission (art-505 consumes it).
 *
 * WHAT IS POLICY INPUT AND WHAT IS KERNEL SOURCE
 * ----------------------------------------------
 * Nothing about a jurisdiction's transposition is hardcoded here. The caller supplies:
 *   - schema_version                       (the exact CARF XML schema version being prepared)
 *   - reportable_residence_jurisdictions   (which claimed residences this operator's own
 *                                           reporting jurisdiction treats as reportable)
 *   - reportable_transaction_classes       (which transaction classes are in scope)
 *   - due_diligence_rules                  (the due-diligence steps, each keyed by the
 *                                           caller's own published/adopted rule code)
 *   - suppressed_rule_codes                (F3 deactivation list, defaults empty)
 * The kernel is a deterministic evaluator over those declarations. It states no view on how
 * any jurisdiction has transposed CARF or DAC8, computes no tax liability, and gives no advice.
 *
 * DEACTIVATION / SUPPRESSION (F3, CARF-DAC8-BUILD-SPEC.md §3 — BLOCKING design rule)
 * A suppressed rule_code produces NO unsatisfied-step entry at all for any record: it is
 * excluded from evaluation entirely, so a rule the authority has switched off cannot
 * manufacture a false finding. Every suppression applied is echoed in the artifact
 * (suppressed_rule_codes + suppressed_step_count), so the exclusion is itself visible.
 * The input exists and defaults empty even though no CARF deactivation list is published yet.
 *
 * JUDGMENT_REQUIRED IS NEVER A BARE FLAG
 * Every judgment_required entry names what is undetermined, which input resolves it, and who
 * decides (judgment_owner_role, caller-declared). A verdict is never left to fall through.
 *
 * ⛔ PII: records are identified by an OPAQUE caller-supplied record_ref only. This kernel
 * takes no name, no TIN, no address and no date of birth. Claimed tax residences are
 * two-letter jurisdiction codes, which are the classification input, not identity. The demo
 * fixture is SYNTHETIC (CONTRACT §1.3); real taxpayer data must never be entered.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute(). There is no clock:
 * reporting_period is a caller-declared string and nothing is compared against "now".
 *
 * Spec: CARF-DAC8-BUILD-SPEC.md §0 + §1 + §3 (CARF-K-1, art-504).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-504-classify-carf-reportable';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'classify_carf_reportable', mandate_type: 'compliance_mandate', gpu: false };

const ENTITY_TYPES = new Set(['individual', 'entity']);
const SELF_CERT_STATUSES = new Set(['valid', 'missing', 'unreliable', 'pending']);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function strArray(v) {
  return Array.isArray(v) ? v.filter(isNonEmptyString) : [];
}

export function compute(pp) {
  pp = pp || {};
  const reporting_jurisdiction = isNonEmptyString(pp.reporting_jurisdiction) ? pp.reporting_jurisdiction : '';
  const schema_version = isNonEmptyString(pp.schema_version) ? pp.schema_version : '';
  const reporting_period = isNonEmptyString(pp.reporting_period) ? pp.reporting_period : '';
  const judgment_owner_role = isNonEmptyString(pp.judgment_owner_role) ? pp.judgment_owner_role : '';

  const reportable_residence_jurisdictions = strArray(pp.reportable_residence_jurisdictions);
  const reportable_transaction_classes = strArray(pp.reportable_transaction_classes);
  const suppressed_rule_codes = strArray(pp.suppressed_rule_codes);
  const suppressedSet = new Set(suppressed_rule_codes);
  const due_diligence_rules = Array.isArray(pp.due_diligence_rules) ? pp.due_diligence_rules : [];
  const records = Array.isArray(pp.records) ? pp.records : [];

  const residenceSet = new Set(reportable_residence_jurisdictions);
  const classSet = new Set(reportable_transaction_classes);
  const residencesDeclared = reportable_residence_jurisdictions.length > 0;
  const classesDeclared = reportable_transaction_classes.length > 0;

  let suppressed_step_count = 0;
  const judgment_required = [];
  const record_verdicts = [];

  // Who decides a judgment call. Named, never blank: an unnamed decider is itself the
  // first thing a reviewer would challenge.
  const decided_by = judgment_owner_role || 'undeclared (supply judgment_owner_role to name the accountable role)';

  function raiseJudgment(record_ref, question, undetermined_because, resolving_input) {
    judgment_required.push({
      record_ref: record_ref,
      question: question,
      undetermined_because: undetermined_because,
      resolving_input: resolving_input,
      decided_by: decided_by,
    });
  }

  records.forEach((raw, idx) => {
    const r = raw && typeof raw === 'object' ? raw : {};
    const record_ref = isNonEmptyString(r.record_ref) ? r.record_ref : `records[${idx}]`;
    const entity_type = ENTITY_TYPES.has(r.entity_type) ? r.entity_type : null;
    const self_certification_status = SELF_CERT_STATUSES.has(r.self_certification_status) ? r.self_certification_status : null;
    const claimed_tax_residences = strArray(r.claimed_tax_residences);
    const controlling_persons = Array.isArray(r.controlling_persons) ? r.controlling_persons : [];
    const transactions = Array.isArray(r.transactions) ? r.transactions : [];

    const unsatisfied_due_diligence_steps = [];

    function addStep(rule_code, step, detail) {
      if (suppressedSet.has(rule_code)) { suppressed_step_count += 1; return; }
      unsatisfied_due_diligence_steps.push({ rule_code: rule_code, step: step, detail: detail });
    }

    // 1. Structural declarations the classifier cannot proceed without.
    if (entity_type === null) {
      addStep('DD-ENTITYTYPE-001', 'account-holder classification', `entity_type "${r.entity_type}" is not one of individual or entity.`);
    }
    if (self_certification_status === null) {
      addStep('DD-SELFCERT-STATUS-001', 'self-certification collection', `self_certification_status "${r.self_certification_status}" is not one of valid, missing, unreliable or pending.`);
    }

    // 2. Self-certification is the gating due-diligence step in CARF and in DAC8's transposition
    //    of it. Anything other than a valid self-certification leaves reportability undetermined:
    //    the operator cannot know the claimed residence is the one to act on.
    if (self_certification_status === 'missing') {
      addStep('DD-SELFCERT-MISSING-001', 'self-certification collection', 'No self-certification has been obtained for this user.');
    } else if (self_certification_status === 'unreliable') {
      addStep('DD-SELFCERT-UNRELIABLE-001', 'self-certification reasonableness', 'The self-certification on file has been marked unreliable and has not been cured.');
    } else if (self_certification_status === 'pending') {
      addStep('DD-SELFCERT-PENDING-001', 'self-certification collection', 'A self-certification has been requested but not yet received.');
    }
    if (self_certification_status === 'valid' && claimed_tax_residences.length === 0) {
      addStep('DD-RESIDENCE-ABSENT-001', 'claimed residence capture', 'The self-certification is marked valid but declares no tax residence.');
    }

    // 3. Entities: controlling-person data is what makes an entity record classifiable at all
    //    where the caller's own rule set requires it.
    if (entity_type === 'entity' && controlling_persons.length === 0 && r.controlling_persons_required === true) {
      addStep('DD-CONTROLPERSON-ABSENT-001', 'controlling-person identification', 'The record is an entity whose controlling persons are declared required, and none are supplied.');
    }
    const controllingResidences = [];
    controlling_persons.forEach((cpRaw, cpIdx) => {
      const cp = cpRaw && typeof cpRaw === 'object' ? cpRaw : {};
      const cpStatus = SELF_CERT_STATUSES.has(cp.self_certification_status) ? cp.self_certification_status : null;
      const cpRef = isNonEmptyString(cp.controlling_person_ref) ? cp.controlling_person_ref : `${record_ref}.controlling_persons[${cpIdx}]`;
      if (cpStatus !== 'valid') {
        addStep('DD-CONTROLPERSON-SELFCERT-001', 'controlling-person self-certification', `Controlling person ${cpRef} has self_certification_status "${cp.self_certification_status}".`);
      }
      strArray(cp.claimed_tax_residences).forEach((j) => { controllingResidences.push(j); });
    });

    // 4. Caller-declared due-diligence rules (F3 policy input, not kernel source).
    due_diligence_rules.forEach((ruleRaw) => {
      const rule = ruleRaw && typeof ruleRaw === 'object' ? ruleRaw : {};
      const rule_code = rule.rule_code;
      if (!isNonEmptyString(rule_code)) return;
      const applies_to = isNonEmptyString(rule.applies_to) ? rule.applies_to : 'all';
      if (applies_to !== 'all' && applies_to !== entity_type) return;
      const required_field = isNonEmptyString(rule.required_field) ? rule.required_field : '';
      const declared = r.declared_fields && typeof r.declared_fields === 'object' ? r.declared_fields : {};
      const value = required_field ? declared[required_field] : undefined;
      const present = value !== undefined && value !== null && value !== '';
      if (!present) {
        addStep(rule_code, isNonEmptyString(rule.step) ? rule.step : 'caller-declared due-diligence step', isNonEmptyString(rule.description) ? rule.description : `Required field "${required_field}" is absent (rule ${rule_code}).`);
      }
    });

    // 5. Reportable-user determination.
    const allResidences = claimed_tax_residences.concat(controllingResidences);
    const matched_reportable_residences = allResidences.filter((j) => residenceSet.has(j)).sort();
    let user_reportability;
    let user_reason;
    if (!residencesDeclared) {
      user_reportability = 'undetermined';
      user_reason = 'No reportable residence jurisdictions were declared, so no claimed residence can be classified.';
      raiseJudgment(record_ref, 'Is this user a reportable user?', 'The set of residence jurisdictions this reporting jurisdiction treats as reportable has not been declared.', 'reportable_residence_jurisdictions');
    } else if (unsatisfied_due_diligence_steps.length > 0) {
      user_reportability = 'undetermined';
      user_reason = 'One or more due-diligence steps are unsatisfied, so the claimed residence cannot be relied on.';
      raiseJudgment(record_ref, 'Is this user a reportable user?', `Due diligence is incomplete: ${unsatisfied_due_diligence_steps.map((s) => s.rule_code).join(', ')}.`, 'a cured self-certification or the missing field named in each unsatisfied step');
    } else if (matched_reportable_residences.length > 0) {
      user_reportability = 'reportable';
      user_reason = `Claimed residence in ${matched_reportable_residences.join(', ')} is within the declared reportable set.`;
    } else {
      user_reportability = 'not_reportable';
      user_reason = 'No claimed residence, and no controlling-person residence, falls within the declared reportable set.';
    }

    // 6. Transaction classification.
    const transaction_verdicts = transactions.map((tRaw, tIdx) => {
      const t = tRaw && typeof tRaw === 'object' ? tRaw : {};
      const transaction_ref = isNonEmptyString(t.transaction_ref) ? t.transaction_ref : `${record_ref}.transactions[${tIdx}]`;
      const transaction_class = isNonEmptyString(t.transaction_class) ? t.transaction_class : '';
      if (!classesDeclared) {
        raiseJudgment(transaction_ref, 'Is this transaction a reportable transaction?', 'No reportable transaction classes were declared for this reporting jurisdiction.', 'reportable_transaction_classes');
        return { transaction_ref: transaction_ref, transaction_class: transaction_class, reportable: 'undetermined', reason: 'No reportable transaction classes were declared.' };
      }
      if (!transaction_class) {
        raiseJudgment(transaction_ref, 'Is this transaction a reportable transaction?', 'The transaction carries no transaction_class.', 'transaction_class on the transaction record');
        return { transaction_ref: transaction_ref, transaction_class: '', reportable: 'undetermined', reason: 'The transaction carries no transaction_class.' };
      }
      if (user_reportability === 'undetermined') {
        return { transaction_ref: transaction_ref, transaction_class: transaction_class, reportable: 'undetermined', reason: 'The user is not yet classifiable, so the transaction cannot be classified.' };
      }
      if (user_reportability === 'not_reportable') {
        return { transaction_ref: transaction_ref, transaction_class: transaction_class, reportable: 'not_reportable', reason: 'The user is not a reportable user.' };
      }
      if (classSet.has(transaction_class)) {
        return { transaction_ref: transaction_ref, transaction_class: transaction_class, reportable: 'reportable', reason: 'The transaction class is within the declared reportable set for a reportable user.' };
      }
      return { transaction_ref: transaction_ref, transaction_class: transaction_class, reportable: 'not_reportable', reason: 'The transaction class is outside the declared reportable set.' };
    });

    record_verdicts.push({
      record_ref: record_ref,
      entity_type: entity_type,
      user_reportability: user_reportability,
      reason: user_reason,
      matched_reportable_residences: matched_reportable_residences,
      unsatisfied_due_diligence_steps: unsatisfied_due_diligence_steps,
      transaction_verdicts: transaction_verdicts,
    });
  });

  // 7. Aggregate counts. Counts only, never a ratio and never a percentage.
  const user_counts = { reportable: 0, not_reportable: 0, undetermined: 0 };
  const transaction_counts_by_class = {};
  record_verdicts.forEach((v) => {
    user_counts[v.user_reportability] += 1;
    v.transaction_verdicts.forEach((t) => {
      const key = t.transaction_class || '(unclassified)';
      if (!transaction_counts_by_class[key]) transaction_counts_by_class[key] = { reportable: 0, not_reportable: 0, undetermined: 0 };
      transaction_counts_by_class[key][t.reportable] += 1;
    });
  });

  const unsatisfied_step_count = record_verdicts.reduce((n, v) => n + v.unsatisfied_due_diligence_steps.length, 0);

  const compliance_flags = [];
  compliance_flags.push(user_counts.reportable > 0 ? 'CARF_REPORTABLE_USERS_PRESENT' : 'CARF_NO_REPORTABLE_USERS');
  if (judgment_required.length > 0) compliance_flags.push('CARF_JUDGMENT_REQUIRED');
  if (unsatisfied_step_count > 0) compliance_flags.push('CARF_DUE_DILIGENCE_INCOMPLETE');
  if (suppressed_step_count > 0) compliance_flags.push('CARF_SUPPRESSED_RULES_APPLIED');
  if (!residencesDeclared) compliance_flags.push('CARF_REPORTABLE_RESIDENCES_UNDECLARED');
  if (!classesDeclared) compliance_flags.push('CARF_REPORTABLE_CLASSES_UNDECLARED');
  if (records.length === 0) compliance_flags.push('CARF_RECORD_SET_EMPTY');
  if (!schema_version) compliance_flags.push('CARF_SCHEMA_VERSION_UNPINNED');

  const output_payload = {
    reporting_jurisdiction: reporting_jurisdiction,
    schema_version: schema_version,
    reporting_period: reporting_period,
    record_count: records.length,
    record_verdicts: record_verdicts,
    judgment_required: judgment_required,
    judgment_required_count: judgment_required.length,
    user_counts: user_counts,
    transaction_counts_by_class: transaction_counts_by_class,
    unsatisfied_step_count: unsatisfied_step_count,
    reportable_residence_jurisdictions: reportable_residence_jurisdictions,
    reportable_transaction_classes: reportable_transaction_classes,
    suppressed_rule_codes: suppressed_rule_codes,
    suppressed_step_count: suppressed_step_count,
    note: 'Deterministic CARF and DAC8 reportability classifier over a caller-declared record set. The reportable residence set, the reportable transaction classes, the due-diligence rule set and the schema version are pinned policy inputs, never kernel source, so this states no view on how any jurisdiction has transposed CARF or DAC8. A suppressed rule_code produces no unsatisfied step at all for any record. Every undetermined verdict carries a judgment_required entry naming what is undetermined, which input resolves it and who decides. This classifies only: it computes no tax liability, it does not submit or transmit anything, it makes no claim that its output is submittable, and it is not legal or tax advice.',
  };

  return { output_payload, compliance_flags };
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
