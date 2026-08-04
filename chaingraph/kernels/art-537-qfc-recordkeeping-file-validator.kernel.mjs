/**
 * art-537-qfc-recordkeeping-file-validator.kernel.mjs
 * BILLABLES-WAVE2-BUILD-SPEC.md §6 (family (d), second sibling) — validates the institution's own
 * 12 CFR part 371 qualified-financial-contract recordkeeping FILE (the position/counterparty/collateral
 * record set the appendix to part 371 requires) against its published record layout, and reconciles the
 * file's declared totals against a caller-supplied control-total summary.
 *
 * SAME FILE-SHAPE DISCIPLINE AS art-535-fdic370-output-file-validator, NOT A THIRD PATTERN. TWO SEPARATE
 * QUESTIONS, NEVER COLLAPSED. Whether the file is SHAPED correctly (every declared row carries the
 * fields the appendix requires, and no position identifier repeats) is a structural question, checked
 * first. Whether the file's declared totals AGREE with the institution's own control-total summary is an
 * accuracy question, checked second and reported separately. A shape problem never gets silently
 * absorbed into a totals figure, and a totals mismatch never gets silently absorbed into a shape verdict
 * -- each lands in its own named output, exactly art-535's split.
 *
 * FILE-SHAPE VALIDATION, ART-535'S EXACT DISCIPLINE REUSED. Every FILE ROW this kernel cannot validate
 * is reported in `file_structure_errors[]`, naming the missing or malformed field. Nothing is dropped
 * and nothing is repaired: a row missing a required field, carrying a malformed notional or collateral
 * amount, or repeating a position identifier already seen in a conforming row, is reported by row
 * reference and excluded from the totals this kernel computes from the file -- never guessed into a
 * total.
 *
 * POSITION AND COUNTERPARTY IDENTIFIERS ARE ENUMERABLE, SO THEY ARRIVE PRE-SALTED (§25). Unlike
 * art-535's ownership-right-and-capacity code (a small closed vocabulary, never salted), a QFC position
 * identifier and counterparty identifier are enumerable low-entropy identifiers within the meaning of
 * §25.1 -- the tool page salts them (`sha256-salted@1`) before this kernel ever sees them. The kernel
 * treats both as opaque already-salted strings: it uses a position identifier only to detect a repeated
 * position across rows, and a counterparty identifier only to count distinct counterparties. Nothing
 * branches on either string's content, and no salt or raw identifier ever enters `policy_parameters`.
 *
 * QFC TYPE AND CURRENCY CODE STAY OPAQUE. Exactly as art-535 holds no table of part 330 ownership
 * categories, this kernel holds no table of part 371 QFC contract-type codes or currency codes. A code
 * table would go stale and would amount to counterparty-risk-classification advice -- out of scope here
 * for the same reason it is out of scope in art-535.
 *
 * THE CONTROL-TOTAL SUMMARY IS A REQUIRED RECONCILIATION TARGET, NEVER ASSUMED. Without a supplied
 * `control_totals` summary there is nothing to reconcile the file's totals against, so this kernel
 * reports `did_not_run` naming that precondition rather than guessing a tie-out. Where the supplied
 * summary itself is missing one of the four figures this kernel ties (position count, distinct
 * counterparty count, aggregate notional, aggregate collateral), that figure is reported as its own
 * mismatch -- an unconfirmable tie-out is never reported as a clean one.
 *
 * ROLLUP (spec §6, SPEC.md §27.4 closed enum, reused exactly, the same conforms/structural-error/
 * tie-out-mismatch mapping as §5's FDIC370 node, no new vocabulary). File conforms and every tied total
 * agrees ⇒ `auto_pass`. Any file_structure_errors entry ⇒ `review_required`, regardless of how the
 * totals compare -- a shape problem is checked first and takes precedence, because a malformed row can
 * itself be the reason a total looks like it ties out. Only once the file shape is clean does a totals
 * mismatch route to `escalate`, a first-class finding that is never silently reconciled.
 *
 * DECISION OUTCOME (SPEC.md §27.4/§27.10). Emits `output_payload.decision.gate_policy` (the
 * `$defs/haGatePolicy` value above) and the sibling `output_payload.decision.execution_state`
 * (`ran` / `did_not_run` / `ran_stale` -- this kernel never has cause to report `ran_stale`, `as_of_date`
 * being the only date carried and never compared to a clock). Both live inside `output_payload`, inside
 * the §4 hash preimage -- no hash-excluded field.
 *
 * NO SUBMITTABILITY CLAIM, NO RECORDKEEPING-ADEQUACY ADVICE (§27.7). This validates a file's shape and
 * ties its totals to a supplied control-total summary. It is not a filing, it does not produce the part
 * 371 appendix submission format, it carries no claim that the FDIC or the institution's primary
 * regulator would accept the file as satisfying part 371, and it offers no advice on whether a contract
 * is in fact a covered QFC.
 *
 * FIXED POINT MONEY, INTEGER MINOR UNITS ONLY. Every notional and collateral amount on a file row and in
 * the supplied control-total summary is an integer number of minor units. No floating point arithmetic
 * is performed anywhere in this file. A non-integer or negative amount is never coerced or rounded -- it
 * is reported as a malformed field (file row) or a mismatch (control-total summary), never silently
 * repaired.
 *
 * FINITE GATE. Zero file rows, an absent control_totals summary, and a row missing every field each
 * resolve to a DEFINED result. No branch emits NaN, Infinity, null money, or an undefined verdict.
 *
 * PII: position and counterparty identifiers are §25-salted before they reach this kernel; QFC type and
 * currency code are opaque strings; row references only. Fixtures are SYNTHETIC (CONTRACT §1.3).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: BILLABLES-WAVE2-BUILD-SPEC.md §6 · art-535-fdic370-output-file-validator (reused file-shape
 * discipline, not reused code) · 12 CFR 371 and its appendix.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-537-qfc-recordkeeping-file-validator';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'validate_qfc_recordkeeping_file', mandate_type: 'compliance_control', gpu: false };

const BOUNDARY = 'This validates the shape of a supplied 12 CFR part 371 qualified-financial-contract recordkeeping file against the appendix\'s published record layout and ties the file\'s declared totals to a supplied control-total summary. It is not a filing, it does not produce the part 371 appendix submission format, it carries no claim that the FDIC or the institution\'s primary regulator would accept the file, and it offers no advice on whether a particular contract is a covered QFC. That determination is made under 12 CFR part 371 by the institution and its counsel, never here.';
const NO_RULE_TABLE = 'QFC type and currency code on each file row are opaque strings. Nothing in this computation branches on the text of either, and no table of part 371 QFC contract-type codes or currency codes is held here.';
const SALTING_NOTE = 'Position identifier and counterparty identifier are enumerable low-entropy identifiers within the meaning of SPEC.md section 25.1. Both arrive at this kernel already salted (sha256-salted@1); the kernel uses each only to detect a repeated position or count distinct counterparties, and no raw identifier or salt ever enters this computation.';

const REQUIRED_FILE_ROW_FIELDS = [
  'position_id',
  'counterparty_id',
  'qfc_type',
  'currency_code',
  'notional_minor_units',
  'collateral_minor_units',
];
const REQUIRED_CONTROL_TOTAL_FIELDS = [
  'position_count',
  'distinct_counterparty_count',
  'notional_minor_units',
  'collateral_minor_units',
];

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function str(v, fallback) { return isNonEmptyString(v) ? v.trim() : fallback; }
function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function isoDateOrNull(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null; }
function nonNegIntOrNull(v) { return Number.isSafeInteger(v) && v >= 0 ? v : null; }

export function compute(pp) {
  pp = pp || {};

  const as_of_date = isoDateOrNull(pp.as_of_date);
  const institution_ref = str(pp.institution_ref, 'UNSTATED');

  // ── Validate every file row's shape. Nothing dropped, nothing repaired. ────────────────────────
  const suppliedRows = arr(pp.file_records).map((r) => obj(r));
  const file_structure_errors = [];
  const conforming = [];
  const seenPositions = Object.create(null);

  for (let i = 0; i < suppliedRows.length; i++) {
    const r = suppliedRows[i];
    const row_ref = str(r.row_ref, `ROW-${i + 1}`);
    const position_id = isNonEmptyString(r.position_id) ? r.position_id.trim() : null;

    const flag = (missing_field, reason) => {
      file_structure_errors.push({ row_ref, position_id, missing_field, reason });
    };

    let firstMissing = null;
    for (const field of REQUIRED_FILE_ROW_FIELDS) {
      if (field === 'position_id') {
        if (position_id === null) { firstMissing = field; break; }
        continue;
      }
      if (field === 'counterparty_id' || field === 'qfc_type' || field === 'currency_code') {
        if (!isNonEmptyString(r[field])) { firstMissing = field; break; }
        continue;
      }
      if (nonNegIntOrNull(r[field]) === null) { firstMissing = field; break; }
    }
    if (firstMissing !== null) {
      flag(firstMissing, `The row is missing or carries a malformed value for ${firstMissing}. The part 371 appendix record layout requires this field on every row, and a malformed value is reported rather than coerced or dropped.`);
      continue;
    }
    if (seenPositions[position_id]) {
      flag('position_id', `The position identifier ${position_id} already appears on a conforming row (${seenPositions[position_id]}). The part 371 appendix reports one row per position; a repeated position identifier is a file-shape defect, never merged silently into one total.`);
      continue;
    }
    seenPositions[position_id] = row_ref;
    conforming.push({
      row_ref,
      position_id,
      counterparty_id: r.counterparty_id.trim(),
      qfc_type: r.qfc_type.trim(),
      currency_code: r.currency_code.trim(),
      notional_minor_units: r.notional_minor_units,
      collateral_minor_units: r.collateral_minor_units,
    });
  }

  // ── File totals, computed ONLY from conforming rows. ────────────────────────────────────────────
  const distinctCounterparties = new Set(conforming.map((r) => r.counterparty_id));
  const file_totals = {
    position_count: conforming.length,
    distinct_counterparty_count: distinctCounterparties.size,
    notional_minor_units: conforming.reduce((t, r) => t + r.notional_minor_units, 0),
    collateral_minor_units: conforming.reduce((t, r) => t + r.collateral_minor_units, 0),
  };

  // ── Reconcile against the supplied control-total summary. Never assumed, never silently reconciled.
  const controlIn = pp.control_totals;
  const control_totals_supplied = controlIn !== undefined && controlIn !== null && typeof controlIn === 'object' && !Array.isArray(controlIn);
  const control_totals = control_totals_supplied ? obj(controlIn) : null;

  const mismatches = [];
  let totals_mismatch = false;
  if (control_totals_supplied) {
    for (const field of REQUIRED_CONTROL_TOTAL_FIELDS) {
      const fileVal = file_totals[field];
      const controlVal = nonNegIntOrNull(control_totals[field]);
      if (controlVal === null) {
        mismatches.push({ field, file_value: fileVal, control_value: null, reason: 'The supplied control-total summary is missing or carries a malformed value for this field, so the tie-out cannot be confirmed. An unconfirmable tie-out is reported as a mismatch, never as a pass.' });
        totals_mismatch = true;
      } else if (fileVal !== controlVal) {
        mismatches.push({ field, file_value: fileVal, control_value: controlVal, reason: 'The file\'s declared total for this field does not equal the tied control-total summary.' });
        totals_mismatch = true;
      }
    }
  }

  // ── Decision. Structural errors take precedence over a totals check (spec §6). ──────────────────
  const compliance_flags = [];
  let gate_policy = null;
  let execution_state;
  let reason = null;

  if (!control_totals_supplied) {
    execution_state = 'did_not_run';
    reason = 'no_control_totals_supplied: the file\'s totals cannot be reconciled without a tied control-total summary.';
    compliance_flags.push('QFCFILE_NO_CONTROL_TOTALS_SUPPLIED');
  } else {
    execution_state = 'ran';
    if (file_structure_errors.length > 0) {
      gate_policy = 'review_required';
      compliance_flags.push('QFCFILE_STRUCTURE_ERRORS_PRESENT');
    } else if (totals_mismatch) {
      gate_policy = 'escalate';
      compliance_flags.push('QFCFILE_TOTALS_MISMATCH');
    } else {
      gate_policy = 'auto_pass';
      compliance_flags.push('QFCFILE_CONFORMS_AND_TOTALS_TIE_OUT');
    }
  }
  if (file_structure_errors.length === 0 && suppliedRows.length > 0) compliance_flags.push('QFCFILE_ALL_ROWS_CONFORM');
  if (suppliedRows.length === 0) compliance_flags.push('QFCFILE_NO_ROWS_SUPPLIED');

  // ── Rationale. ───────────────────────────────────────────────────────────────────────────────
  const rationale = [];
  rationale.push(`Part 371 recordkeeping file validation for institution reference ${institution_ref}${as_of_date === null ? ' with no as-of date supplied' : ` as of ${as_of_date}`}, over ${suppliedRows.length} supplied file row${suppliedRows.length === 1 ? '' : 's'}.`);
  rationale.push(file_structure_errors.length === 0
    ? `Every supplied row conforms to the part 371 appendix record layout: ${conforming.length} row${conforming.length === 1 ? '' : 's'} carried every required field and no position identifier repeated.`
    : `${file_structure_errors.length} row${file_structure_errors.length === 1 ? '' : 's'} did not conform and ${file_structure_errors.length === 1 ? 'is' : 'are'} excluded from the file totals, each with the defect named: ${file_structure_errors.map((e) => `${e.row_ref} (${e.missing_field})`).join(', ')}.`);
  if (!control_totals_supplied) {
    rationale.push(reason);
  } else if (mismatches.length === 0) {
    rationale.push('The file\'s totals tie out exactly against the supplied control-total summary across every tied field.');
  } else {
    rationale.push(`${mismatches.length} tied field${mismatches.length === 1 ? '' : 's'} did not reconcile against the supplied control-total summary, reported individually rather than netted: ${mismatches.map((m) => `${m.field} (file ${m.file_value}, control ${m.control_value})`).join(', ')}.`);
  }
  rationale.push(NO_RULE_TABLE);
  rationale.push(SALTING_NOTE);
  rationale.push(BOUNDARY);

  const output_payload = {
    as_of_date,
    institution_ref,
    file_totals,
    file_structure_errors,
    conforming_row_count: conforming.length,
    supplied_row_count: suppliedRows.length,
    control_totals_supplied,
    control_totals,
    mismatches,
    totals_mismatch,
    decision: { gate_policy, execution_state, reason },
    qfc_code_handling: NO_RULE_TABLE,
    identifier_salting: SALTING_NOTE,
    rationale,
    boundary: BOUNDARY,
    note: 'Deterministic 12 CFR part 371 recordkeeping-file shape validator and totals reconciler. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing. It validates the file\'s own declared rows against the part 371 appendix record layout and ties the file\'s totals to a supplied control-total summary, reporting a shape defect and a totals mismatch as two separate, never-merged findings. It holds no QFC-type or currency-code rule table and is not a filing.',
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
