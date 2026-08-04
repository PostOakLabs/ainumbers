/**
 * art-535-fdic370-output-file-validator.kernel.mjs
 * BILLABLES-WAVE2-BUILD-SPEC.md §5 (family (c)) — validates the institution's own 12 CFR part 370
 * deposit-insurance-coverage OUTPUT FILE (the section 370.10 coverage summary report structure)
 * against its published record layout, and reconciles the file's declared totals against a supplied
 * art-507-determine-deposit-insurance-coverage recompute.
 *
 * TWO SEPARATE QUESTIONS, NEVER COLLAPSED. Whether the file is SHAPED correctly (every declared row
 * carries the fields section 370.10 requires, and no ownership right and capacity code repeats) is a
 * structural question, checked first. Whether the file's declared totals AGREE with the institution's
 * own art-507 coverage recompute is an accuracy question, checked second and reported separately. A
 * shape problem never gets silently absorbed into a totals figure, and a totals mismatch never gets
 * silently absorbed into a shape verdict -- each lands in its own named output.
 *
 * FILE-SHAPE VALIDATION, ART-507'S EXACT DISCIPLINE GENERALIZED TO FILE SHAPE. art-507 reports every
 * account record it cannot calculate coverage for in `undeterminable_records`, naming the missing
 * field. This kernel reports every FILE ROW it cannot validate the same way, in
 * `file_structure_errors[]`, naming the missing or malformed field. Nothing is dropped and nothing is
 * repaired: a row missing a required field, carrying a malformed count or amount, or repeating an
 * ownership right and capacity code already seen in a conforming row, is reported by row reference
 * and excluded from the totals this kernel computes from the file -- never guessed into a total.
 *
 * OWNERSHIP RIGHT AND CAPACITY CODES STAY OPAQUE. Exactly as in art-507, the code on each row is used
 * only to detect a repeated code across rows; nothing branches on its text and no table of part 330
 * ownership categories is held here. That table would go stale and would amount to deposit insurance
 * advice -- out of scope here for the same reason it is out of scope in art-507.
 *
 * THE ART-507 RESULT IS A REQUIRED RECONCILIATION TARGET, NEVER ASSUMED. Without a supplied art-507
 * recompute there is nothing to reconcile the file's totals against, so this kernel reports
 * `did_not_run` naming that precondition rather than guessing a tie-out. Where the supplied recompute
 * itself is missing one of the four figures this kernel ties (fully-insured account count, insured
 * amount, accounts-with-uninsured-deposits count, uninsured amount), that figure is reported as its
 * own mismatch -- an unconfirmable tie-out is never reported as a clean one.
 *
 * ROLLUP (spec §5, SPEC.md §27.4 closed enum, reused exactly, no new vocabulary). File conforms and
 * every tied total agrees ⇒ `auto_pass`. Any file_structure_errors entry ⇒ `review_required`,
 * regardless of how the totals compare -- a shape problem is checked first and takes precedence,
 * because a malformed row can itself be the reason a total looks like it ties out. Only once the file
 * shape is clean does a totals mismatch route to `escalate`, a first-class finding that is never
 * silently reconciled into the passing total.
 *
 * DECISION OUTCOME (STPFWD-1, SPEC.md §27.4/§27.10). Emits `output_payload.decision.gate_policy` (the
 * `$defs/haGatePolicy` value above) and the sibling `output_payload.decision.execution_state`
 * (`ran` / `did_not_run` / `ran_stale` -- this kernel never has cause to report `ran_stale`, `as_of_date`
 * being the only date carried and never compared to a clock). Both live inside `output_payload`, inside
 * the §4 hash preimage -- no hash-excluded field.
 *
 * NO SUBMITTABILITY CLAIM, NO COVERAGE ADVICE (§27.7, spec §5 note). This validates a file's shape and
 * ties its totals to a supplied recompute. It is not a filing, it does not produce the section 370.10
 * submission format, it carries no claim that the FDIC would accept the file, and it offers no deposit
 * insurance advice. F8 small-buyer caveat (art-507): the population this reconciles against is
 * currently zero covered institutions in the revenue-kanban sense -- the completion is specified anyway
 * because it is cheap and closes art-507 into the certification evidence pack.
 *
 * FIXED POINT MONEY, INTEGER MINOR UNITS ONLY. Every amount on a file row and in the supplied art-507
 * result is an integer number of minor units. No floating point arithmetic is performed anywhere in
 * this file. A non-integer or negative amount is never coerced or rounded -- it is reported as a
 * malformed field (file row) or a mismatch (art-507 result), never silently repaired.
 *
 * NO §25 SALTING. This node consumes only ownership-right-and-capacity-code-level aggregate rows and
 * institution-wide totals -- no caller-supplied account-level or customer-level identifier ever enters
 * this schema. If a future caller-supplied field introduces one, it must be salted per §25 before it
 * does; nothing here holds one today.
 *
 * FINITE GATE. Zero file rows, an absent art507_result, and a row missing every field each resolve to a
 * DEFINED result. No branch emits NaN, Infinity, null money, or an undefined verdict.
 *
 * PII: opaque ownership-right-and-capacity codes and row references only. No account, holder, or
 * customer identifier of any kind. Fixtures are SYNTHETIC (CONTRACT §1.3).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: BILLABLES-WAVE2-BUILD-SPEC.md §5 · art-507-determine-deposit-insurance-coverage (reused
 * discipline, not reused code) · 12 CFR 370.2 / 370.10.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-535-fdic370-output-file-validator';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'validate_fdic370_output_file', mandate_type: 'compliance_control', gpu: false };

const BOUNDARY = 'This validates the shape of a supplied 12 CFR part 370 output file against the section 370.10 record layout and ties the file\'s declared totals to a supplied art-507-determine-deposit-insurance-coverage recompute. It is not a filing, it does not produce the section 370.10 submission format, it carries no claim that the FDIC would accept the file, and it offers no deposit insurance advice. Whether coverage is correct for any particular depositor is decided under 12 CFR part 330 by the institution and its counsel, never here.';
const NO_RULE_TABLE = 'Ownership right and capacity codes on each file row are opaque strings, used only to detect a code repeated across rows. Nothing in this computation branches on the text of a code, and no table of part 330 ownership categories or allowance rules is held here.';
const F8_CAVEAT = 'Small-buyer caveat carried forward from art-507: the population this reconciliation currently covers is zero institutions in the revenue-kanban sense. This validator is specified and shipped anyway because it is cheap and completes art-507 into the certification evidence pack.';

const REQUIRED_FILE_ROW_FIELDS = [
  'ownership_right_and_capacity',
  'deposit_account_count',
  'distinct_account_holder_count',
  'fully_insured_account_count',
  'accounts_with_uninsured_deposits_count',
  'insured_minor_units',
  'uninsured_minor_units',
];
const REQUIRED_ART507_FIELDS = [
  'fully_insured_account_count',
  'accounts_with_uninsured_deposits_count',
  'insured_minor_units',
  'uninsured_minor_units',
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
  const seenCodes = Object.create(null);

  for (let i = 0; i < suppliedRows.length; i++) {
    const r = suppliedRows[i];
    const row_ref = str(r.row_ref, `ROW-${i + 1}`);
    const orc = isNonEmptyString(r.ownership_right_and_capacity) ? r.ownership_right_and_capacity.trim() : null;

    const flag = (missing_field, reason) => {
      file_structure_errors.push({ row_ref, ownership_right_and_capacity: orc, missing_field, reason });
    };

    let firstMissing = null;
    for (const field of REQUIRED_FILE_ROW_FIELDS) {
      if (field === 'ownership_right_and_capacity') {
        if (orc === null) { firstMissing = field; break; }
        continue;
      }
      const v = r[field];
      const isCount = field !== 'insured_minor_units' && field !== 'uninsured_minor_units';
      const ok = isCount ? nonNegIntOrNull(v) !== null : nonNegIntOrNull(v) !== null;
      if (!ok) { firstMissing = field; break; }
    }
    if (firstMissing !== null) {
      flag(firstMissing, `The row is missing or carries a malformed value for ${firstMissing}. Section 370.10's coverage summary report requires this field on every row, and a malformed value is reported rather than coerced or dropped.`);
      continue;
    }
    if (seenCodes[orc]) {
      flag('ownership_right_and_capacity', `The ownership right and capacity code ${orc} already appears on a conforming row (${seenCodes[orc]}). Section 370.10 reports one row per code; a repeated code is a file-shape defect, never merged silently into one total.`);
      continue;
    }
    seenCodes[orc] = row_ref;
    conforming.push({
      row_ref,
      ownership_right_and_capacity: orc,
      deposit_account_count: r.deposit_account_count,
      distinct_account_holder_count: r.distinct_account_holder_count,
      fully_insured_account_count: r.fully_insured_account_count,
      accounts_with_uninsured_deposits_count: r.accounts_with_uninsured_deposits_count,
      insured_minor_units: r.insured_minor_units,
      uninsured_minor_units: r.uninsured_minor_units,
    });
  }

  // ── File totals, computed ONLY from conforming rows. ────────────────────────────────────────────
  const file_totals = conforming.reduce((t, r) => ({
    deposit_account_count: t.deposit_account_count + r.deposit_account_count,
    distinct_account_holder_count: t.distinct_account_holder_count + r.distinct_account_holder_count,
    fully_insured_account_count: t.fully_insured_account_count + r.fully_insured_account_count,
    accounts_with_uninsured_deposits_count: t.accounts_with_uninsured_deposits_count + r.accounts_with_uninsured_deposits_count,
    insured_minor_units: t.insured_minor_units + r.insured_minor_units,
    uninsured_minor_units: t.uninsured_minor_units + r.uninsured_minor_units,
  }), { deposit_account_count: 0, distinct_account_holder_count: 0, fully_insured_account_count: 0, accounts_with_uninsured_deposits_count: 0, insured_minor_units: 0, uninsured_minor_units: 0 });

  // ── Reconcile against the supplied art-507 recompute. Never assumed, never silently reconciled. ─
  const art507In = pp.art507_result;
  const art507_supplied = art507In !== undefined && art507In !== null && typeof art507In === 'object' && !Array.isArray(art507In);
  const art507_result = art507_supplied ? obj(art507In) : null;

  const mismatches = [];
  let totals_mismatch = false;
  if (art507_supplied) {
    for (const field of REQUIRED_ART507_FIELDS) {
      const fileVal = file_totals[field];
      const art507Val = nonNegIntOrNull(art507_result[field]);
      if (art507Val === null) {
        mismatches.push({ field, file_value: fileVal, art507_value: null, reason: 'The supplied art-507 result is missing or carries a malformed value for this field, so the tie-out cannot be confirmed. An unconfirmable tie-out is reported as a mismatch, never as a pass.' });
        totals_mismatch = true;
      } else if (fileVal !== art507Val) {
        mismatches.push({ field, file_value: fileVal, art507_value: art507Val, reason: 'The file\'s declared total for this field does not equal the tied art-507 recompute.' });
        totals_mismatch = true;
      }
    }
  }

  // ── Decision. Structural errors take precedence over a totals check (spec §5). ──────────────────
  const compliance_flags = [];
  let gate_policy = null;
  let execution_state;
  let reason = null;

  if (!art507_supplied) {
    execution_state = 'did_not_run';
    reason = 'no_art507_result_supplied: the file\'s totals cannot be reconciled without a tied art-507-determine-deposit-insurance-coverage recompute result.';
    compliance_flags.push('FDIC370FILE_NO_ART507_RESULT_SUPPLIED');
  } else {
    execution_state = 'ran';
    if (file_structure_errors.length > 0) {
      gate_policy = 'review_required';
      compliance_flags.push('FDIC370FILE_STRUCTURE_ERRORS_PRESENT');
    } else if (totals_mismatch) {
      gate_policy = 'escalate';
      compliance_flags.push('FDIC370FILE_TOTALS_MISMATCH');
    } else {
      gate_policy = 'auto_pass';
      compliance_flags.push('FDIC370FILE_CONFORMS_AND_TOTALS_TIE_OUT');
    }
  }
  if (file_structure_errors.length === 0 && suppliedRows.length > 0) compliance_flags.push('FDIC370FILE_ALL_ROWS_CONFORM');
  if (suppliedRows.length === 0) compliance_flags.push('FDIC370FILE_NO_ROWS_SUPPLIED');

  // ── Rationale. ───────────────────────────────────────────────────────────────────────────────
  const rationale = [];
  rationale.push(`Part 370 output file validation for institution reference ${institution_ref}${as_of_date === null ? ' with no as-of date supplied' : ` as of ${as_of_date}`}, over ${suppliedRows.length} supplied file row${suppliedRows.length === 1 ? '' : 's'}.`);
  rationale.push(file_structure_errors.length === 0
    ? `Every supplied row conforms to the section 370.10 coverage summary report layout: ${conforming.length} row${conforming.length === 1 ? '' : 's'} carried every required field and no ownership right and capacity code repeated.`
    : `${file_structure_errors.length} row${file_structure_errors.length === 1 ? '' : 's'} did not conform and ${file_structure_errors.length === 1 ? 'is' : 'are'} excluded from the file totals, each with the defect named: ${file_structure_errors.map((e) => `${e.row_ref} (${e.missing_field})`).join(', ')}.`);
  if (!art507_supplied) {
    rationale.push(reason);
  } else if (mismatches.length === 0) {
    rationale.push('The file\'s totals tie out exactly against the supplied art-507 recompute across every tied field.');
  } else {
    rationale.push(`${mismatches.length} tied field${mismatches.length === 1 ? '' : 's'} did not reconcile against the supplied art-507 recompute, reported individually rather than netted: ${mismatches.map((m) => `${m.field} (file ${m.file_value}, art-507 ${m.art507_value})`).join(', ')}.`);
  }
  rationale.push(NO_RULE_TABLE);
  rationale.push(F8_CAVEAT);
  rationale.push(BOUNDARY);

  const output_payload = {
    as_of_date,
    institution_ref,
    file_totals,
    file_structure_errors,
    conforming_row_count: conforming.length,
    supplied_row_count: suppliedRows.length,
    art507_supplied,
    art507_result,
    mismatches,
    totals_mismatch,
    decision: { gate_policy, execution_state, reason },
    ownership_code_handling: NO_RULE_TABLE,
    small_buyer_caveat: F8_CAVEAT,
    rationale,
    boundary: BOUNDARY,
    note: 'Deterministic 12 CFR part 370 output-file shape validator and totals reconciler. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing. It validates the file\'s own declared rows against the section 370.10 record layout and ties the file\'s totals to a supplied art-507 recompute, reporting a shape defect and a totals mismatch as two separate, never-merged findings. It holds no part 330 rule table and is not a filing.',
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
