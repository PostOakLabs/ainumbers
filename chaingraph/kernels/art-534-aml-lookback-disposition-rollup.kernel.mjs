import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-534-aml-lookback-disposition-rollup';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'roll_up_aml_lookback_disposition',
  mandate_type: 'compliance_control', gpu: false,
};

// AML consent-order lookback DISPOSITION ROLLUP (art-534). BILLABLES-WAVE2-BUILD-SPEC.md
// SS3 family (b). Closes the loop art-470 (lookback-completeness-reconciler) and art-471
// (disposition-sampling-frame) leave open: art-470 proves the RE-SCREENING extract was
// complete, art-471 builds a deterministic SAMPLE of the resulting dispositions for
// independent review -- neither one checks that a disposition was actually RECORDED for
// every sampled item, that a filed/no-SAR determination carries a rationale, or that the
// sample frame's declared population size still reconciles to art-470's completeness
// population. This node is that closure layer, not a re-implementation of either upstream
// kernel: art-470/471 outputs are consumed only as the two population-size inputs named
// below, never recomputed.
//
// THREE-AXIS ROLLUP.
//   1. disposition_coverage  -- does every item in the DECLARED sample frame (sample_frame_size,
//      art-471's own output) carry a recorded disposition. Denominator is the frame's declared
//      size, never the caller's supplied item count, so a caller who simply omits the missing
//      items cannot manufacture 100% coverage over a shrunken population.
//   2. disposition_rationale_presence -- every 'sar_filed' or 'no_sar' determination cites a
//      non-empty rationale_reference. 'escalated' items are still under review and are not
//      held to this bar.
//   3. population_to_sample tie-out -- art-471's declared sample_frame_population_size must
//      equal art-470's declared population_size. A mismatch means the sample was drawn against
//      a population that no longer matches the reconciled lookback population, and is reported
//      as an unresolved discrepancy rather than silently ignored.
//
// SS27.4 GATE MAPPING (spec-fixed, no new vocabulary): full coverage + rationale present on
// every filed/no-SAR item -> auto_pass. Any missing disposition, evaluated as of a caller-
// declared as_of point on/after the lookback's declared close date -> escalate. A tie-out
// failure or an explicit caller-declared sampling-frame discrepancy flag -> hold (this is the
// art-470<->471 population loop; it blocks ahead of coverage/rationale because a disposition
// rolled up against the wrong population is not yet trustworthy to grade). Otherwise, a
// disposition present without its required rationale -> review_required.
//
// SS25 SALTING (customer_id, alert_id). Both cross this kernel already salted: caller supplies
// a `sha256:`-prefixed sha256-salted@1 COMMITMENT string (SS25.1), never the plaintext
// identifier. This kernel never sees, requests, or computes over the plaintext -- it is a
// closure-arithmetic kernel over commitments and their attached disposition metadata, exactly
// as art-470 counts records and never touches PII. buildArtifact() declares a top-level
// private_inputs[] entry (SS25.0) per validly-shaped commitment so a verifier knows those two
// pointers are commitments, not cleartext; a value that does NOT match the `sha256:<64-hex>`
// shape is rejected rather than trusted, and that item is excluded from the private_inputs
// declaration (never declared as a commitment when it might be a leaked plaintext).
//
// FINITE GATE. Absent lookback_close_date / population_size / sample_frame_population_size /
// sample_frame_size resolves to a defined did_not_run/hold outcome, never NaN or a silent
// zero. Deterministic arithmetic and string checks only -- no clock, no randomness, no network.

const COMMITMENT_RE = /^sha256:[0-9a-f]{64}$/;
const DISPOSITIONS = new Set(['sar_filed', 'no_sar', 'escalated']);
const RATIONALE_REQUIRED = new Set(['sar_filed', 'no_sar']);

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function isSafeNonNegInt(v) { return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0; }
function isoDateOrNull(v) {
  if (typeof v !== 'string' || v.trim().length === 0) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? v : null;
}

function emptyResult(reason, base, flags) {
  return {
    output_payload: {
      decision: { gate_policy: 'hold', execution_state: 'did_not_run', reason },
      lookback_id: base.lookback_id ?? null,
      lookback_close_date: base.lookback_close_date ?? null,
      as_of: base.as_of ?? null,
      population_size: base.population_size ?? null,
      sample_frame_population_size: base.sample_frame_population_size ?? null,
      sample_frame_size: base.sample_frame_size ?? null,
      population_tie_out_holds: false,
      sampling_frame_discrepancy_flag: base.sampling_frame_discrepancy_flag === true,
      sampled_item_count: 0,
      disposition_coverage_pct: null,
      missing_disposition_count: 0,
      rationale_presence_pct: null,
      items_missing_rationale: [],
      items: [],
      rejected_inputs: base.rejected_inputs ?? [],
    },
    compliance_flags: flags,
    private_input_pointers: [],
  };
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const lookback_id = isNonEmptyString(pp.lookback_id) ? pp.lookback_id.trim() : null;

  const lookback_close_date = isoDateOrNull(pp.lookback_close_date);
  if (pp.lookback_close_date !== undefined && lookback_close_date === null) {
    rejected_inputs.push({ where: 'lookback_close_date', reason: 'not a parseable ISO-8601 date', supplied: String(pp.lookback_close_date) });
  }
  const as_of = isoDateOrNull(pp.as_of);
  if (pp.as_of !== undefined && as_of === null) {
    rejected_inputs.push({ where: 'as_of', reason: 'not a parseable ISO-8601 date', supplied: String(pp.as_of) });
  }

  const population_size = isSafeNonNegInt(pp.population_size) ? pp.population_size : null;
  if (!isSafeNonNegInt(pp.population_size)) rejected_inputs.push({ where: 'population_size', reason: 'absent or not a non-negative safe integer', supplied: pp.population_size === undefined ? null : pp.population_size });

  const sample_frame_population_size = isSafeNonNegInt(pp.sample_frame_population_size) ? pp.sample_frame_population_size : null;
  if (!isSafeNonNegInt(pp.sample_frame_population_size)) rejected_inputs.push({ where: 'sample_frame_population_size', reason: 'absent or not a non-negative safe integer', supplied: pp.sample_frame_population_size === undefined ? null : pp.sample_frame_population_size });

  const sample_frame_size = isSafeNonNegInt(pp.sample_frame_size) ? pp.sample_frame_size : null;
  if (!isSafeNonNegInt(pp.sample_frame_size)) rejected_inputs.push({ where: 'sample_frame_size', reason: 'absent or not a non-negative safe integer', supplied: pp.sample_frame_size === undefined ? null : pp.sample_frame_size });

  const base = { lookback_id, lookback_close_date, as_of, population_size, sample_frame_population_size, sample_frame_size, sampling_frame_discrepancy_flag: pp.sampling_frame_discrepancy_flag === true, rejected_inputs };

  if (!lookback_close_date || population_size === null || sample_frame_population_size === null || sample_frame_size === null) {
    return emptyResult('required_lookback_or_frame_input_not_declared', base, ['AML_ROLLUP_REQUIRED_INPUT_NOT_DECLARED']);
  }

  const itemsIn = Array.isArray(pp.sampled_items) ? pp.sampled_items : [];
  if (itemsIn.length > sample_frame_size) {
    rejected_inputs.push({ where: 'sampled_items', reason: 'more items supplied than the declared sample_frame_size', supplied: itemsIn.length });
  }

  const items = [];
  const private_input_pointers = [];
  let missing_disposition_count = 0;
  let with_disposition_count = 0;
  let requires_rationale_count = 0;
  let has_rationale_count = 0;
  const items_missing_rationale = [];

  for (let i = 0; i < itemsIn.length; i++) {
    const row = itemsIn[i] || {};
    const customer_id = typeof row.customer_id === 'string' ? row.customer_id : '';
    const alert_id = typeof row.alert_id === 'string' ? row.alert_id : '';
    const customer_id_valid = COMMITMENT_RE.test(customer_id);
    const alert_id_valid = COMMITMENT_RE.test(alert_id);
    if (!customer_id_valid) rejected_inputs.push({ where: `sampled_items[${i}].customer_id`, reason: 'expected a SS25 sha256-salted@1 commitment (sha256:<64-hex>), not plaintext', supplied: null });
    if (!alert_id_valid) rejected_inputs.push({ where: `sampled_items[${i}].alert_id`, reason: 'expected a SS25 sha256-salted@1 commitment (sha256:<64-hex>), not plaintext', supplied: null });
    if (customer_id_valid) private_input_pointers.push({ pointer: `/sampled_items/${i}/customer_id`, commitment: customer_id, commitment_scheme: 'sha256-salted@1' });
    if (alert_id_valid) private_input_pointers.push({ pointer: `/sampled_items/${i}/alert_id`, commitment: alert_id, commitment_scheme: 'sha256-salted@1' });

    const disposition = DISPOSITIONS.has(row.disposition) ? row.disposition : null;
    const rationale_reference = isNonEmptyString(row.rationale_reference) ? row.rationale_reference.trim() : null;
    const identity_ok = customer_id_valid && alert_id_valid;
    const has_disposition = identity_ok && disposition !== null;
    const requires_rationale = has_disposition && RATIONALE_REQUIRED.has(disposition);
    const has_rationale = requires_rationale && rationale_reference !== null;

    if (has_disposition) with_disposition_count++; else missing_disposition_count++;
    if (requires_rationale) {
      requires_rationale_count++;
      if (has_rationale) has_rationale_count++;
      else items_missing_rationale.push(alert_id_valid ? alert_id : `sampled_items[${i}]`);
    }

    items.push({ index: i, identity_ok, disposition, has_rationale_reference: rationale_reference !== null, rationale_required: requires_rationale, rationale_ok: !requires_rationale || has_rationale });
  }
  // Items in the declared frame that were never even supplied are missing dispositions too.
  missing_disposition_count += Math.max(0, sample_frame_size - itemsIn.length);

  const disposition_coverage_pct = sample_frame_size > 0
    ? Math.round((with_disposition_count / sample_frame_size) * 10000) / 100 : 100;
  const rationale_presence_pct = requires_rationale_count > 0
    ? Math.round((has_rationale_count / requires_rationale_count) * 10000) / 100 : 100;

  const population_tie_out_holds = population_size === sample_frame_population_size;
  const sampling_frame_discrepancy_flag = pp.sampling_frame_discrepancy_flag === true;

  const full_coverage = missing_disposition_count === 0;
  const rationale_complete = items_missing_rationale.length === 0;
  const closeDatePassed = as_of !== null && as_of >= lookback_close_date;

  const compliance_flags = ['AML_LOOKBACK_DISPOSITION_ROLLUP_EVALUATED'];
  if (!population_tie_out_holds) compliance_flags.push('AML_POPULATION_TO_SAMPLE_TIE_OUT_FAILED');
  if (sampling_frame_discrepancy_flag) compliance_flags.push('AML_SAMPLING_FRAME_DISCREPANCY_DECLARED');
  if (!full_coverage) compliance_flags.push('AML_DISPOSITION_COVERAGE_INCOMPLETE');
  if (!rationale_complete) compliance_flags.push('AML_DISPOSITION_RATIONALE_MISSING');
  if (rejected_inputs.length > 0) compliance_flags.push('AML_ROLLUP_INPUTS_REJECTED');

  let gate_policy, execution_state = 'ran', reason = null;
  if (!population_tie_out_holds || sampling_frame_discrepancy_flag) {
    gate_policy = 'hold';
    reason = !population_tie_out_holds ? 'population_to_sample_tie_out_failed' : 'sampling_frame_discrepancy_declared';
  } else if (!full_coverage && closeDatePassed) {
    gate_policy = 'escalate';
    reason = 'missing_disposition_past_lookback_close_date';
    compliance_flags.push('AML_MISSING_DISPOSITION_PAST_CLOSE_DATE');
  } else if (!full_coverage || !rationale_complete) {
    gate_policy = 'review_required';
    reason = !full_coverage ? 'disposition_coverage_incomplete' : 'disposition_rationale_missing';
  } else {
    gate_policy = 'auto_pass';
    compliance_flags.push('AML_LOOKBACK_DISPOSITION_ROLLUP_CLEAN');
  }

  return {
    output_payload: {
      decision: { gate_policy, execution_state, reason },
      lookback_id, lookback_close_date, as_of,
      population_size, sample_frame_population_size, sample_frame_size,
      population_tie_out_holds, sampling_frame_discrepancy_flag,
      sampled_item_count: itemsIn.length,
      disposition_coverage_pct, missing_disposition_count,
      rationale_presence_pct, items_missing_rationale,
      items, rejected_inputs,
    },
    compliance_flags,
    private_input_pointers,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags, private_input_pointers } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  const artifact = {
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
  if (private_input_pointers.length > 0) artifact.private_inputs = private_input_pointers;
  return artifact;
}
