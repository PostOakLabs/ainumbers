/**
 * art-519-payment-data-migration-completeness.kernel.mjs
 * INBOUND-EVIDENCE-BUILD-SPEC.md §6.4 (RFP §4.4, CDGPSS202601) -- payment data migration
 * completeness.
 *
 * ⛔ THIS IS NOT A REGIME-SPECIFIC MIGRATION TOOL. `art-161` assesses VIDA recapitulative
 * statement migration, `art-393` lints x402 v2 protocol migration, `art-86` plans TLS/PKI
 * migration, `rca-03` validates ISO 20022 PostalAddress24 fields on pacs.008 messages
 * (country-specific postcode/PLZ/ZIP rules), and `101-iso20022-migration-scorer` scores a
 * bank's SELF-ASSESSED migration READINESS across 7 maturity dimensions -- a survey, not
 * a completeness verifier over actual counts. None of the five reconciles a source system
 * against a target system by declared partition, count, and control total. That is the
 * whole of this kernel: a generic completeness verifier that takes caller-declared
 * per-partition record counts and control totals -- for ANY migration, any record type,
 * any partition scheme -- and verifies the move was complete, value-preserving, and
 * reconcilable.
 *
 * MIGR_PARTITION_INCONSISTENT IS THE POINT. A migration can net out clean in aggregate
 * while individual partitions do not -- one partition over-counted, another
 * under-counted, the errors cancelling in the grand total. That total is exactly the
 * number a rushed go-live sign-off looks at. This kernel computes the aggregate from the
 * SUM of the declared partitions and separately verifies every partition individually, so
 * a net-zero aggregate sitting on top of broken partitions cannot pass silently.
 *
 * MIGR_SAMPLED_ONLY IS NEVER PRESENTED AS MIGR_COMPLETE. Where a partition declares
 * `sample_verification.sampled === true`, only a sample of that partition's records was
 * independently checked -- the count/value arithmetic can still net to zero (the
 * declared counts and totals reconcile), but that arithmetic result is a residual-risk
 * statement, not proof every record moved. Any sampled partition suppresses
 * MIGR_COMPLETE for the whole migration; MIGR_SAMPLED_ONLY fires instead.
 *
 * REGION-PORTABLE BY CONSTRUCTION (§6.9). No country, currency, agency, rail, or statute
 * is named anywhere in this file. `currency`, partition labels, and every count/total are
 * caller-declared policy inputs -- the same kernel runs unchanged for a second,
 * structurally different jurisdiction (see the fixtures for two such cases).
 *
 * NO DATA INGESTION. This kernel never reads a source or target dataset -- the caller
 * supplies counts, control totals, declared transformation rules, and which fields were
 * observed to change value, all already produced by their own migration tooling.
 *
 * FIXED-POINT MONEY MATH (CONTRACT money convention, art-499 pattern). Every amount
 * crosses the boundary as an integer number of minor units. No floating-point arithmetic
 * anywhere in compute(): sums, differences, and tolerance comparisons are integer
 * operations; display strings come from integer division, never toFixed() on a float.
 * A non-integer, non-finite, or absent amount is coerced to 0 and named in
 * `rejected_inputs[]`, never silently dropped and never propagated as NaN.
 *
 * FINITE GATE. Zero partitions, an all-zero partition, and an absent exclusion/sample
 * block each resolve to a DEFINED verdict. No branch can emit NaN, Infinity,
 * null-as-a-number, or an undefined status.
 *
 * NO CLOCK. `as_of` is a caller input; compute() never reads a clock.
 *
 * PII: partition labels and exclusion reason codes are opaque declared strings. No
 * account holder, beneficiary, employee, or citizen identity of any kind enters this
 * kernel, and no record contents are ever read -- only caller-declared counts and totals.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: INBOUND-EVIDENCE-BUILD-SPEC.md §6.4 (RFP §4.4).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-519-payment-data-migration-completeness';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'verify_migration_completeness', mandate_type: 'attestation_mandate', gpu: false };

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function isSafeIntAmount(v) { return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v); }
function isoDateOrNull(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }

/** Integer coercion with an explicit rejection record. Never a silent drop, never NaN. */
function toMinorUnits(v, where, rejected) {
  if (isSafeIntAmount(v)) return v;
  if (v === undefined || v === null || v === '') { rejected.push({ where, reason: 'absent', supplied: null }); return 0; }
  rejected.push({
    where,
    reason: typeof v === 'number' ? 'not a safe integer number of minor units' : `expected an integer number of minor units, got ${typeof v}`,
    supplied: typeof v === 'number' && Number.isFinite(v) ? v : String(v),
  });
  return 0;
}
function toCount(v, where, rejected) {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0) return v;
  if (v === undefined || v === null || v === '') { rejected.push({ where, reason: 'absent', supplied: null }); return 0; }
  rejected.push({ where, reason: 'expected a non-negative integer count', supplied: typeof v === 'number' ? v : String(v) });
  return 0;
}
function display(minor) {
  const neg = minor < 0;
  const abs = neg ? -minor : minor;
  const whole = Math.trunc(abs / 100);
  const frac = abs - whole * 100;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(2, '0');
}

function normalizeExclusions(list, partitionLabel, rejected) {
  const arr = Array.isArray(list) ? list : [];
  return arr.map((e, i) => {
    e = e && typeof e === 'object' ? e : {};
    const reason_code = isNonEmptyString(e.reason_code) ? e.reason_code.trim() : null;
    if (!reason_code) rejected.push({ where: `partitions[${partitionLabel}].known_exclusions[${i}].reason_code`, reason: 'absent', supplied: null });
    const excluded_record_count = toCount(e.excluded_record_count, `partitions[${partitionLabel}].known_exclusions[${i}].excluded_record_count`, rejected);
    const excluded_value_minor_units = toMinorUnits(e.excluded_value_minor_units, `partitions[${partitionLabel}].known_exclusions[${i}].excluded_value_minor_units`, rejected);
    return { reason_code: reason_code || 'unclassified', excluded_record_count, excluded_value_minor_units, excluded_value_display: display(excluded_value_minor_units) };
  });
}

function computePartition(raw, index, rejected) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const partition_label = isNonEmptyString(raw.partition_label) ? raw.partition_label.trim() : `PARTITION-${index + 1}`;

  const source_record_count = toCount(raw.source_record_count, `partitions[${partition_label}].source_record_count`, rejected);
  const source_control_total_minor_units = toMinorUnits(raw.source_control_total_minor_units, `partitions[${partition_label}].source_control_total_minor_units`, rejected);
  const target_record_count = toCount(raw.target_record_count, `partitions[${partition_label}].target_record_count`, rejected);
  const target_control_total_minor_units = toMinorUnits(raw.target_control_total_minor_units, `partitions[${partition_label}].target_control_total_minor_units`, rejected);

  const known_exclusions = normalizeExclusions(raw.known_exclusions, partition_label, rejected);
  const excluded_record_count = known_exclusions.reduce((a, e) => a + e.excluded_record_count, 0);
  const excluded_value_minor_units = known_exclusions.reduce((a, e) => a + e.excluded_value_minor_units, 0);

  const expected_target_record_count = source_record_count - excluded_record_count;
  const expected_target_value_minor_units = source_control_total_minor_units - excluded_value_minor_units;

  const count_variance = target_record_count - expected_target_record_count;
  const value_variance_minor_units = target_control_total_minor_units - expected_target_value_minor_units;

  const sv = raw.sample_verification && typeof raw.sample_verification === 'object' ? raw.sample_verification : {};
  const sampled = sv.sampled === true;
  const sample_size = sampled ? toCount(sv.sample_size, `partitions[${partition_label}].sample_verification.sample_size`, rejected) : 0;
  const sample_discrepancies_found = sampled ? toCount(sv.discrepancies_found, `partitions[${partition_label}].sample_verification.discrepancies_found`, rejected) : 0;

  const count_complete = count_variance === 0;

  return {
    partition_label,
    source_record_count, source_control_total_minor_units, source_control_total_display: display(source_control_total_minor_units),
    target_record_count, target_control_total_minor_units, target_control_total_display: display(target_control_total_minor_units),
    known_exclusions, excluded_record_count, excluded_value_minor_units, excluded_value_display: display(excluded_value_minor_units),
    expected_target_record_count, expected_target_value_minor_units, expected_target_value_display: display(expected_target_value_minor_units),
    count_variance, value_variance_minor_units, value_variance_display: display(value_variance_minor_units),
    count_complete, value_complete: false, partition_complete: false,
    sampled, sample_size, sample_discrepancies_found,
  };
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const migration_id = isNonEmptyString(pp.migration_id) ? pp.migration_id.trim() : null;
  const as_of = isoDateOrNull(pp.as_of);
  const currency = isNonEmptyString(pp.currency) ? pp.currency.trim().toUpperCase() : 'USD';
  const reconciliation_tolerance_minor_units = (typeof pp.reconciliation_tolerance_minor_units === 'number' && Number.isFinite(pp.reconciliation_tolerance_minor_units) && pp.reconciliation_tolerance_minor_units >= 0)
    ? Math.trunc(pp.reconciliation_tolerance_minor_units) : 0;

  const partitionsIn = Array.isArray(pp.partitions) ? pp.partitions : [];
  const partitions = partitionsIn.map((p, i) => computePartition(p, i, rejected_inputs));

  // Value completeness is judged against the declared tolerance; count completeness is
  // always exact -- a partial record is not "within tolerance", it is a break.
  for (const part of partitions) {
    part.value_complete = Math.abs(part.value_variance_minor_units) <= reconciliation_tolerance_minor_units;
    part.partition_complete = part.count_complete && part.value_complete;
  }

  const partitions_with_variance = partitions.filter((p) => !p.partition_complete);
  const count_variance_partitions = partitions.filter((p) => !p.count_complete);
  const value_variance_partitions = partitions.filter((p) => !p.value_complete);

  // --- Aggregate vs partition consistency -- ⭐ THE POINT ---
  // The aggregate is the SUM of the declared partitions. A migration whose aggregate
  // nets to zero while one or more partitions individually break is the classic
  // undetected failure: errors of opposite sign cancelling in the grand total.
  const aggregate_count_variance = partitions.reduce((a, p) => a + p.count_variance, 0);
  const aggregate_value_variance_minor_units = partitions.reduce((a, p) => a + p.value_variance_minor_units, 0);
  const aggregate_count_complete = aggregate_count_variance === 0;
  const aggregate_value_complete = Math.abs(aggregate_value_variance_minor_units) <= reconciliation_tolerance_minor_units;
  const aggregate_complete = aggregate_count_complete && aggregate_value_complete;
  const all_partitions_complete = partitions.length > 0 && partitions.every((p) => p.partition_complete);
  // Fires only when there IS more than one partition to net across -- a single-partition
  // migration cannot exhibit this failure mode by construction.
  const partition_inconsistent = partitions.length > 1 && aggregate_complete && !all_partitions_complete;

  // --- Transformation coverage: fields observed changed with no declared rule ---
  const declaredRulesIn = Array.isArray(pp.declared_transformation_rules) ? pp.declared_transformation_rules : [];
  const declared_transformation_rules = declaredRulesIn.map((r, i) => {
    r = r && typeof r === 'object' ? r : {};
    const field = isNonEmptyString(r.field) ? r.field.trim() : null;
    if (!field) rejected_inputs.push({ where: `declared_transformation_rules[${i}].field`, reason: 'absent', supplied: null });
    const description = isNonEmptyString(r.description) ? r.description.trim() : null;
    return { field: field || `UNLABELLED-${i + 1}`, description: description || null };
  });
  const declaredFieldSet = new Set(declared_transformation_rules.map((r) => r.field));

  const observedChangedIn = Array.isArray(pp.observed_changed_fields) ? pp.observed_changed_fields : [];
  const observed_changed_fields = observedChangedIn.filter((f) => isNonEmptyString(f)).map((f) => f.trim());
  const undeclared_transformed_fields = observed_changed_fields.filter((f) => !declaredFieldSet.has(f));

  // --- Residual risk where only sampling was performed ---
  const sampled_partitions = partitions.filter((p) => p.sampled);
  const any_sampled_only = sampled_partitions.length > 0;
  const sample_discrepancies_total = sampled_partitions.reduce((a, p) => a + p.sample_discrepancies_found, 0);

  const arithmetic_complete = partitions.length > 0 && all_partitions_complete && !partition_inconsistent && undeclared_transformed_fields.length === 0;
  // MIGR_COMPLETE requires full verification, not merely clean arithmetic over a sampled
  // partition -- a sample is a residual-risk statement, never a completeness verdict.
  const migration_complete = arithmetic_complete && !any_sampled_only;

  const compliance_flags = [];
  if (count_variance_partitions.length > 0) compliance_flags.push('MIGR_COUNT_VARIANCE');
  if (value_variance_partitions.length > 0) compliance_flags.push('MIGR_VALUE_VARIANCE');
  if (partition_inconsistent) compliance_flags.push('MIGR_PARTITION_INCONSISTENT');
  if (undeclared_transformed_fields.length > 0) compliance_flags.push('MIGR_UNDECLARED_TRANSFORM');
  if (any_sampled_only) compliance_flags.push('MIGR_SAMPLED_ONLY');
  if (rejected_inputs.length > 0) compliance_flags.push('MIGR_INPUTS_REJECTED');
  if (migration_complete) compliance_flags.push('MIGR_COMPLETE');

  const rationale = [];
  rationale.push(partitions.length > 0
    ? `${partitions.length} declared partition${partitions.length === 1 ? '' : 's'} evaluated; ${partitions.length - partitions_with_variance.length} of ${partitions.length} reconcile in both count and value within the declared ${display(reconciliation_tolerance_minor_units)} ${currency} tolerance.`
    : 'No partitions were declared; there is nothing to reconcile.');
  rationale.push(aggregate_complete
    ? `Aggregate (sum of declared partitions) reconciles: count variance ${aggregate_count_variance}, value variance ${display(aggregate_value_variance_minor_units)} ${currency}.`
    : `Aggregate does NOT reconcile: count variance ${aggregate_count_variance}, value variance ${display(aggregate_value_variance_minor_units)} ${currency}.`);
  if (partition_inconsistent) rationale.push(`The aggregate reconciles while ${partitions_with_variance.length} of ${partitions.length} individual partitions do not -- this is the failure the aggregate alone conceals.`);
  if (undeclared_transformed_fields.length > 0) rationale.push(`${undeclared_transformed_fields.length} observed changed field(s) have no declared transformation rule: ${undeclared_transformed_fields.join(', ')}.`);
  if (any_sampled_only) rationale.push(`${sampled_partitions.length} of ${partitions.length} partition(s) were verified by sampling only (${sample_discrepancies_total} discrepancy(ies) found in-sample) -- this is a residual-risk statement, not a completeness verdict, and suppresses MIGR_COMPLETE for the migration as a whole.`);
  rationale.push('This is a deterministic reconciliation over caller-declared source/target counts and control totals. It does not read the source or target dataset and is not a determination that any underlying data quality control has been met.');

  const output_payload = {
    migration_id, as_of, currency, reconciliation_tolerance_minor_units,
    partition_count: partitions.length,
    partitions,
    partitions_with_variance_count: partitions_with_variance.length,
    aggregate_count_variance,
    aggregate_value_variance_minor_units,
    aggregate_value_variance_display: display(aggregate_value_variance_minor_units),
    aggregate_complete,
    all_partitions_complete,
    partition_inconsistent,
    declared_transformation_rules,
    observed_changed_field_count: observed_changed_fields.length,
    undeclared_transformed_fields,
    sampled_partition_count: sampled_partitions.length,
    sample_discrepancies_total,
    any_sampled_only,
    migration_complete,
    rejected_inputs,
    rationale,
    note: 'Deterministic payment data migration completeness verifier over caller-declared per-partition source/target record counts and control totals, known exclusions with reasons, declared transformation rules, and observed changed fields. Checks per-partition and aggregate-vs-partition completeness (a reconciling aggregate over broken partitions is the finding), transformation coverage, and flags any partition verified by sampling only as a residual-risk statement rather than a completeness verdict. Never reads a source or target dataset.',
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
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
