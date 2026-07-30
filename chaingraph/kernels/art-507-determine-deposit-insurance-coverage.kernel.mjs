/**
 * art-507-determine-deposit-insurance-coverage.kernel.mjs
 * Assurance Waves programme (FDIC370-BUILD-SPEC.md §1, FDIC370-K-1) — insured and uninsured
 * deposit amounts by ownership right and capacity, under 12 CFR part 370.
 *
 * WHAT THIS DECIDES. Given account records that each name an ownership right and capacity code, an
 * aggregation group, and a balance in minor units, plus a caller-supplied standard maximum deposit
 * insurance amount, it decides for each aggregation group how much is insured and how much is the
 * uninsured remainder, rolls those into per-code and institution-wide totals, and lists every record
 * whose coverage cannot be calculated from the fields supplied. That is the whole computation.
 *
 * THE OUTPUT SHAPE IS THE ONE THE RULE ASKS FOR. Section 370.10 requires a deposit insurance
 * coverage summary report carrying the number of deposit accounts and different account holders by
 * ownership right and capacity code, the count and dollar amount of fully insured accounts, the
 * count of accounts holding uninsured deposits, and the deposit accounts for which the information
 * technology system cannot calculate deposit insurance coverage. Those five are computed here as
 * first-class outputs rather than left for a reader to assemble, and the last of them is why
 * `undeterminable_records` is a headline output and not an error channel.
 *
 * THE SMDIA IS AN INPUT AND IS NEVER BAKED IN. No statutory amount appears anywhere in this file.
 * A maintained figure is a duty that silently goes false the moment it moves, and a kernel that
 * carries one is asserting a statutory fact it is not entitled to assert. With no SMDIA supplied,
 * NOTHING is estimated: every record becomes undeterminable naming `smdia`, and the totals report
 * zero insured rather than a guess. This is the same discipline that keeps a concentration limit out
 * of art-445 and a quorum threshold out of art-494.
 *
 * NO PART 330 RULE TABLE, DELIBERATELY. Which ownership rights and capacities exist, and how many
 * separate insurance allowances a given group is entitled to, are determinations under 12 CFR part
 * 330 that belong to the institution and its counsel. This kernel therefore never interprets an
 * ownership right and capacity code: the code is an OPAQUE STRING used only for grouping and
 * reporting, exactly as section 370.10 asks for it. The number of insurance allowances a group
 * receives is `coverage_units`, derived from the caller's own per-record fields, never from a table
 * held here. Nothing branches on the text of a code. A maintained rule table would go stale, would
 * amount to deposit insurance advice, and is out of scope.
 *
 * FIXED POINT MONEY, INTEGER MINOR UNITS ONLY. Every balance and the SMDIA are integer minor units.
 * No floating point arithmetic is performed on money anywhere in this file, so no representation
 * error can enter a total. A balance that is not a safe integer is not coerced and not rounded: the
 * record is undeterminable naming `balance`, because silently repairing a malformed money value is
 * how a wrong number acquires a confident total.
 *
 * ALTERNATIVE RECORDKEEPING IS UNDETERMINABLE HERE, BY CONSTRUCTION AND NOT BY FAILURE. Under
 * section 370.4(b), (c) and (d) the beneficial ownership detail sits with a third party, and section
 * 370.3 contemplates the FDIC supplying that detail after failure. The institution's own system
 * cannot calculate coverage for those accounts, so they land in `undeterminable_records` naming the
 * field that is missing. That is the correct answer, and it is precisely the section 370.10(v)
 * population.
 *
 * EVERY UNDETERMINABLE RECORD NAMES THE MISSING FIELD. There is no bare `judgment_required` on this
 * surface. A reader is told which field to go and get, by name, for every record, because "we could
 * not calculate 4,812 accounts" is not actionable and "these 4,812 accounts are missing
 * beneficiary_count" is.
 *
 * THE CERTIFICATION ASSERTION IS THE CALLER'S, NEVER OURS. Section 370.10 requires an annual
 * certification confirming that the institution tested its information technology system during the
 * preceding twelve months, signed by the chief executive officer or the chief operating officer.
 * That assertion and its date arrive as caller input, are echoed unchanged, and are NEVER computed
 * from a clock and NEVER represented as something this kernel verified. The signature over that
 * certification is evaluated by art-503 as a section 27 approval record at threshold N=1 bound to
 * the chief executive or chief operating officer role. No second certification surface is built
 * here, and this kernel evaluates no signature.
 *
 * COVERED STATUS IS NOT ASSERTED. Whether an institution has the two million or more deposit
 * accounts that make it a covered institution under section 370.2 is a caller declaration, echoed
 * with its own basis stated. This kernel never counts accounts to reach that conclusion and never
 * tells an institution whether the rule applies to it.
 *
 * NO SUBMITTABILITY CLAIM (§27.7). Output here is arithmetic over supplied records. It is not a
 * filing, it is not in the section 370.10 submission format, it carries no claim that the FDIC would
 * accept it, and it is not deposit insurance advice.
 *
 * NO CLOCK. `as_of_date` is a caller input and the only instant this kernel knows. There is no
 * `last_reviewed` and no `valid_until` derived from now plus a window. Dates are carried as strings
 * and never parsed, so no timezone can move a number.
 *
 * NO CITATION IS EMITTED. Under the §5 estate rule a regulatory citation is a §28 pinned object
 * carrying a verified `in_force_from`, or there is none. Part 370 is named in prose for the reader;
 * no pinned citation object is emitted, because pinning one on an unverified in-force date would be
 * a statutory determination this kernel is not entitled to make.
 *
 * NO COVERAGE RATIO IS PUBLISHED. Counts and amounts only, never a proportion of anything.
 *
 * FINITE GATE. An empty record set, an absent SMDIA, a zero balance, a missing aggregation group and
 * a malformed balance each resolve to a DEFINED result. No branch emits NaN, Infinity, null money or
 * an undefined verdict.
 *
 * PII: opaque account and group references only. No names, no addresses, no account numbers, no tax
 * identifiers. Fixtures are SYNTHETIC (CONTRACT §1.3).
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: FDIC370-BUILD-SPEC.md §1/§2/§3 · SAFEGUARDING-CASS15-BUILD-SPEC.md §5 ·
 * GENIUS-CERT-BUILD-SPEC.md §1 (art-503 reuse) · 12 CFR 370.2/370.3/370.4/370.10.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-507-determine-deposit-insurance-coverage';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'determine_deposit_insurance_coverage', mandate_type: 'compliance_control', gpu: false };

const BOUNDARY = 'This computes insured and uninsured amounts from the account records supplied to it. It carries no claim that the Federal Deposit Insurance Corporation would accept the result, it does not serve as a filing, it does not produce the submission format section 370.10 prescribes, and it offers no deposit insurance advice. Whether coverage is correct for any particular depositor is decided under 12 CFR part 330 by the institution and its counsel, never here.';
const SMDIA_IS_INPUT = 'The standard maximum deposit insurance amount is supplied by the caller and no statutory amount is held in this kernel. A maintained figure would go stale the moment it moved and would assert a statutory fact this surface is not entitled to assert. With no amount supplied nothing is estimated: every record is reported as undeterminable naming smdia.';
const NO_RULE_TABLE = 'Ownership right and capacity codes are opaque strings used for grouping and reporting only. Nothing in this computation branches on the text of a code, and no table of part 330 ownership categories or allowance rules is held here. How many separate insurance allowances a group is entitled to arrives as coverage_units, derived from the caller record, because that determination belongs to the institution and its counsel.';
const COVERED_STATUS_BASIS = 'Whether this institution has the two million or more deposit accounts that make it a covered institution under section 370.2 is a caller declaration. No account census is performed here and no covered status is asserted by this surface.';
const CERTIFICATION_BASIS = 'The section 370.10 certification confirms that the institution tested its information technology system during the preceding twelve months and is signed by the chief executive officer or the chief operating officer. That confirmation and its date are caller-supplied assertions. They are echoed unchanged, they are never computed from a clock, and nothing here verifies that any testing occurred. The signature itself is evaluated as a section 27 approval record at threshold N=1 by art-503-build-dual-control-certification; no certification surface is built here.';
const ALTERNATIVE_RECORDKEEPING_BASIS = 'Where an account is maintained under the alternative recordkeeping provisions of section 370.4, the beneficial ownership detail sits with a third party and section 370.3 contemplates the Corporation supplying it after failure. The institution system cannot calculate coverage for those accounts from its own records, so they are reported as undeterminable rather than estimated. That is the correct answer under the rule, not a failure of this computation.';

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function str(v, fallback) { return isNonEmptyString(v) ? v.trim() : fallback; }
function strOrNull(v) { return isNonEmptyString(v) ? v.trim() : null; }
function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
/** ISO yyyy-mm-dd prefix, or null. No Date parsing, so no clock is read and no timezone applies. */
function isoDateOrNull(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null; }
/** Integer minor units, or null. A non-integer money value is NEVER coerced or rounded. */
function minorUnitsOrNull(v) { return Number.isSafeInteger(v) ? v : null; }
/** A count of one or more, or null. Zero is not a usable allowance multiplier. */
function positiveIntOrNull(v) { return Number.isSafeInteger(v) && v >= 1 ? v : null; }

export function compute(pp) {
  pp = pp || {};

  // ── Caller-supplied frame. No clock, no statutory amount, no covered-status determination. ────
  const as_of_date = isoDateOrNull(pp.as_of_date);
  const institution_ref = str(pp.institution_ref, 'UNSTATED');
  const currency = str(pp.currency, 'UNSTATED');
  const minor_unit_scale = positiveIntOrNull(pp.minor_unit_scale);

  const smdia = minorUnitsOrNull(pp.smdia);
  const smdia_present = smdia !== null && smdia >= 0;
  const smdia_applied = smdia_present ? smdia : null;

  const covered_declared = pp.covered_institution_declared;
  const covered_institution = {
    declared_by_caller: covered_declared === true ? true : covered_declared === false ? false : null,
    declared_deposit_account_count: minorUnitsOrNull(pp.declared_deposit_account_count),
    asserted_here: false,
    basis: COVERED_STATUS_BASIS,
  };

  // ── The §370.10 certification assertion. Caller's, echoed, never computed and never verified. ─
  const certIn = obj(pp.certification_assertion);
  const certification_assertion = {
    testing_performed_in_preceding_twelve_months: certIn.testing_performed_in_preceding_twelve_months === true
      ? true
      : certIn.testing_performed_in_preceding_twelve_months === false ? false : null,
    assertion_date: isoDateOrNull(certIn.assertion_date),
    signer_role: str(certIn.signer_role, 'UNSTATED'),
    assertion_present: certIn.testing_performed_in_preceding_twelve_months !== undefined,
    computed_here: false,
    verified_here: false,
    signature_evaluated_by: 'art-503-build-dual-control-certification',
    signature_threshold_n: 1,
    basis: CERTIFICATION_BASIS,
  };

  // ── Triage every record. Nothing is silently dropped and nothing is silently repaired. ────────
  const supplied = arr(pp.account_records).map((r) => obj(r));
  const undeterminable_records = [];
  const determinable = [];

  for (let i = 0; i < supplied.length; i++) {
    const r = supplied[i];
    const account_ref = str(r.account_ref, `ACCOUNT-${i + 1}`);
    const orc = strOrNull(r.ownership_right_and_capacity);
    const balance = minorUnitsOrNull(r.balance);
    const exception_flag = r.exception_flag === true;
    const alternative_recordkeeping = r.alternative_recordkeeping === true;
    const pass_through_eligible = r.pass_through_eligible === true;
    const per_beneficiary_coverage = r.per_beneficiary_coverage === true || pass_through_eligible;
    const beneficiary_count = positiveIntOrNull(r.beneficiary_count);
    const group = strOrNull(r.insurance_aggregation_key);

    /** Record an undeterminable account. `missing_field` is ALWAYS a named field, never bare. */
    const undeterminable = (missing_field, reason) => {
      undeterminable_records.push({
        account_ref,
        ownership_right_and_capacity: orc,
        missing_field,
        reason,
        balance_minor_units: balance,
        exception_flag,
        alternative_recordkeeping,
        pass_through_eligible,
      });
    };

    if (!smdia_present) {
      undeterminable('smdia', 'No standard maximum deposit insurance amount was supplied. No statutory amount is held in this kernel, so no insured amount can be calculated for any account and none is estimated.');
      continue;
    }
    if (orc === null) {
      undeterminable('ownership_right_and_capacity', 'The record names no ownership right and capacity code. Section 370.10 reports coverage by that code and insurance allowances attach to it, so coverage cannot be calculated without one.');
      continue;
    }
    if (balance === null) {
      undeterminable('balance', 'The balance is absent or is not an integer number of minor units. Money is fixed point here and a malformed balance is never coerced or rounded, because a silently repaired figure produces a confident total that is wrong.');
      continue;
    }
    if (balance < 0) {
      undeterminable('balance', 'The balance is negative. A negative deposit balance is not an insurable amount, so it is reported rather than netted into a total where it would quietly reduce the uninsured figure.');
      continue;
    }
    if (alternative_recordkeeping) {
      undeterminable('beneficial_ownership_detail_from_alternative_recordkeeping_entity', ALTERNATIVE_RECORDKEEPING_BASIS);
      continue;
    }
    if (exception_flag) {
      undeterminable('exception_resolution', 'The record is flagged as an exception, so the fields needed to calculate its coverage are not settled. An exception resolves to a stated coverage treatment or it remains undeterminable; it is never assumed to be fully insured.');
      continue;
    }
    if (group === null) {
      undeterminable('insurance_aggregation_key', 'The record names no aggregation group. Balances held in the same ownership right and capacity by the same holder combine before an allowance is applied, so an account that cannot be placed in a group cannot be given an insured amount.');
      continue;
    }
    if (per_beneficiary_coverage && beneficiary_count === null) {
      undeterminable('beneficiary_count', pass_through_eligible
        ? 'The record is flagged pass-through eligible, so its allowance depends on the number of beneficial owners, and no usable beneficiary count of one or more was supplied. Pass-through coverage is never assumed for an unstated number of beneficiaries.'
        : 'The record is flagged for per-beneficiary coverage and no usable beneficiary count of one or more was supplied, so the number of allowances the group receives cannot be established.');
      continue;
    }

    determinable.push({
      account_ref,
      orc,
      group,
      balance,
      per_beneficiary_coverage,
      pass_through_eligible,
      coverage_units: per_beneficiary_coverage ? beneficiary_count : 1,
    });
  }

  // ── Group aggregation. Balances combine per (code, group) BEFORE any allowance is applied. ────
  const groupKeys = [];
  const groupIndex = {};
  for (const d of determinable) {
    // Length-prefixed so the join is injective: a code or holder ref containing the
    // separator can never collide two distinct groups into one.
    const key = `${d.orc.length}:${d.orc}:${d.group}`;
    if (groupIndex[key] === undefined) {
      groupIndex[key] = { orc: d.orc, group: d.group, accounts: [], aggregated_balance: 0, coverage_units: 0, pass_through: false };
      groupKeys.push(key);
    }
    const g = groupIndex[key];
    g.accounts.push(d);
    g.aggregated_balance += d.balance;
    // A group's allowance count is the LARGEST stated for it, never a sum across its accounts:
    // repeating the same beneficiary set on five accounts does not multiply the allowance.
    if (d.coverage_units > g.coverage_units) g.coverage_units = d.coverage_units;
    if (d.pass_through_eligible) g.pass_through = true;
  }

  const groups = [];
  for (const key of groupKeys) {
    const g = groupIndex[key];
    const allowance = smdia_applied * g.coverage_units;
    const insured = g.aggregated_balance < allowance ? g.aggregated_balance : allowance;
    const uninsured = g.aggregated_balance - insured;
    groups.push({
      ownership_right_and_capacity: g.orc,
      insurance_aggregation_key: g.group,
      account_count: g.accounts.length,
      account_refs: g.accounts.map((a) => a.account_ref),
      aggregated_balance_minor_units: g.aggregated_balance,
      coverage_units: g.coverage_units,
      allowance_minor_units: allowance,
      insured_minor_units: insured,
      uninsured_minor_units: uninsured,
      fully_insured: uninsured === 0,
      pass_through_applied: g.pass_through,
    });
  }

  // ── Roll up by ownership right and capacity code — the §370.10 reporting axis. ────────────────
  const codeKeys = [];
  const codeIndex = {};
  const undeterminableByCode = {};
  for (const u of undeterminable_records) {
    const code = u.ownership_right_and_capacity === null ? 'UNSTATED' : u.ownership_right_and_capacity;
    undeterminableByCode[code] = (undeterminableByCode[code] || 0) + 1;
  }
  for (const g of groups) {
    const code = g.ownership_right_and_capacity;
    if (codeIndex[code] === undefined) {
      codeIndex[code] = {
        ownership_right_and_capacity: code,
        deposit_account_count: 0,
        distinct_account_holder_count: 0,
        aggregated_balance_minor_units: 0,
        insured_minor_units: 0,
        uninsured_minor_units: 0,
        fully_insured_account_count: 0,
        accounts_with_uninsured_deposits_count: 0,
      };
      codeKeys.push(code);
    }
    const c = codeIndex[code];
    c.deposit_account_count += g.account_count;
    c.distinct_account_holder_count += 1;
    c.aggregated_balance_minor_units += g.aggregated_balance_minor_units;
    c.insured_minor_units += g.insured_minor_units;
    c.uninsured_minor_units += g.uninsured_minor_units;
    if (g.fully_insured) c.fully_insured_account_count += g.account_count;
    else c.accounts_with_uninsured_deposits_count += g.account_count;
  }
  const by_ownership_right_and_capacity = codeKeys.map((code) => {
    const c = codeIndex[code];
    return {
      ownership_right_and_capacity: c.ownership_right_and_capacity,
      deposit_account_count: c.deposit_account_count,
      distinct_account_holder_count: c.distinct_account_holder_count,
      aggregated_balance_minor_units: c.aggregated_balance_minor_units,
      insured_minor_units: c.insured_minor_units,
      uninsured_minor_units: c.uninsured_minor_units,
      fully_insured_account_count: c.fully_insured_account_count,
      accounts_with_uninsured_deposits_count: c.accounts_with_uninsured_deposits_count,
      undeterminable_account_count: undeterminableByCode[c.ownership_right_and_capacity] || 0,
    };
  });

  // ── Institution-wide summary. The five §370.10(b) report items, computed not assembled. ───────
  let total_balance = 0;
  let total_insured = 0;
  let total_uninsured = 0;
  let fully_insured_accounts = 0;
  let accounts_with_uninsured = 0;
  let determinable_accounts = 0;
  for (const c of by_ownership_right_and_capacity) {
    total_balance += c.aggregated_balance_minor_units;
    total_insured += c.insured_minor_units;
    total_uninsured += c.uninsured_minor_units;
    fully_insured_accounts += c.fully_insured_account_count;
    accounts_with_uninsured += c.accounts_with_uninsured_deposits_count;
    determinable_accounts += c.deposit_account_count;
  }

  const coverage_summary = {
    ownership_right_and_capacity_code_count: by_ownership_right_and_capacity.length,
    distinct_account_holder_count: groups.length,
    deposit_accounts_supplied: supplied.length,
    deposit_accounts_determined: determinable_accounts,
    fully_insured_account_count: fully_insured_accounts,
    accounts_with_uninsured_deposits_count: accounts_with_uninsured,
    undeterminable_account_count: undeterminable_records.length,
    aggregated_balance_minor_units: total_balance,
    insured_minor_units: total_insured,
    uninsured_minor_units: total_uninsured,
    currency,
    minor_unit_scale,
  };

  // ── Which undeterminable fields a reader must go and get, named and counted. ──────────────────
  const missingFieldKeys = [];
  const missingFieldIndex = {};
  for (const u of undeterminable_records) {
    if (missingFieldIndex[u.missing_field] === undefined) {
      missingFieldIndex[u.missing_field] = 0;
      missingFieldKeys.push(u.missing_field);
    }
    missingFieldIndex[u.missing_field] += 1;
  }
  const undeterminable_by_missing_field = missingFieldKeys.map((f) => ({ missing_field: f, account_count: missingFieldIndex[f] }));

  // ── Rationale. ───────────────────────────────────────────────────────────────────────────────
  const rationale = [];
  rationale.push(`Deposit insurance coverage computed for institution reference ${institution_ref}${as_of_date === null ? ' with no as-of date supplied' : ` as of ${as_of_date}`}, over ${supplied.length} supplied deposit account record${supplied.length === 1 ? '' : 's'}.`);
  if (smdia_present) {
    rationale.push(`The standard maximum deposit insurance amount applied is ${smdia_applied} minor units, supplied by the caller. ${SMDIA_IS_INPUT}`);
  } else {
    rationale.push(`No standard maximum deposit insurance amount was supplied, so no account could be given an insured amount and every supplied record is reported as undeterminable naming smdia. ${SMDIA_IS_INPUT}`);
  }
  rationale.push(`${determinable_accounts} account${determinable_accounts === 1 ? '' : 's'} across ${groups.length} aggregation group${groups.length === 1 ? '' : 's'} and ${by_ownership_right_and_capacity.length} ownership right and capacity code${by_ownership_right_and_capacity.length === 1 ? '' : 's'} were determined: ${total_insured} minor units insured and ${total_uninsured} uninsured against an aggregated balance of ${total_balance}.`);
  rationale.push(`${fully_insured_accounts} account${fully_insured_accounts === 1 ? ' is' : 's are'} fully insured and ${accounts_with_uninsured} hold${accounts_with_uninsured === 1 ? 's' : ''} uninsured deposits. Balances combine within an ownership right and capacity for the same holder before an allowance is applied, and a group receives the largest allowance count stated for it rather than the sum across its accounts, so repeating a beneficiary set across accounts never multiplies coverage.`);
  if (undeterminable_records.length > 0) {
    rationale.push(`${undeterminable_records.length} account${undeterminable_records.length === 1 ? '' : 's'} could not be calculated and ${undeterminable_records.length === 1 ? 'is' : 'are'} reported individually with the missing field named: ${undeterminable_by_missing_field.map((m) => `${m.missing_field} (${m.account_count})`).join(', ')}. Section 370.10 asks for exactly this population, so it is a reported result rather than an error.`);
  } else {
    rationale.push('Every supplied account carried the fields needed to calculate its coverage, so the undeterminable population is empty.');
  }
  rationale.push(NO_RULE_TABLE);
  rationale.push(CERTIFICATION_BASIS);
  rationale.push(COVERED_STATUS_BASIS);
  rationale.push(BOUNDARY);

  // ── Flags. A finding repeated across records is one flag, never a count wearing a flag's name. ─
  const compliance_flags = [];
  compliance_flags.push(undeterminable_records.length === 0 && determinable_accounts > 0 ? 'FDIC370_COVERAGE_DETERMINED_FOR_ALL_SUPPLIED_ACCOUNTS' : 'FDIC370_COVERAGE_NOT_DETERMINED_FOR_ALL_SUPPLIED_ACCOUNTS');
  if (!smdia_present) compliance_flags.push('FDIC370_SMDIA_ABSENT_NOTHING_ESTIMATED');
  if (undeterminable_records.length > 0) compliance_flags.push('FDIC370_UNDETERMINABLE_RECORDS_PRESENT');
  if (total_uninsured > 0) compliance_flags.push('FDIC370_UNINSURED_DEPOSITS_PRESENT');
  if (undeterminable_records.some((u) => u.alternative_recordkeeping)) compliance_flags.push('FDIC370_ALTERNATIVE_RECORDKEEPING_ACCOUNTS_PRESENT');
  if (undeterminable_records.some((u) => u.exception_flag)) compliance_flags.push('FDIC370_EXCEPTION_ACCOUNTS_PRESENT');
  if (groups.some((g) => g.pass_through_applied)) compliance_flags.push('FDIC370_PASS_THROUGH_COVERAGE_APPLIED');
  compliance_flags.push(certification_assertion.assertion_present ? 'FDIC370_CERTIFICATION_ASSERTION_CALLER_SUPPLIED_NOT_VERIFIED' : 'FDIC370_CERTIFICATION_ASSERTION_ABSENT');
  compliance_flags.push('FDIC370_COVERED_STATUS_NOT_ASSERTED');
  if (as_of_date === null) compliance_flags.push('FDIC370_AS_OF_DATE_ABSENT');
  if (supplied.length === 0) compliance_flags.push('FDIC370_NO_ACCOUNT_RECORDS_SUPPLIED');

  const output_payload = {
    as_of_date,
    institution_ref,
    smdia_applied,
    smdia_is_caller_supplied: true,
    smdia_basis: SMDIA_IS_INPUT,
    covered_institution,
    certification_assertion,
    coverage_summary,
    by_ownership_right_and_capacity,
    aggregation_groups: groups,
    undeterminable_records,
    undeterminable_by_missing_field,
    ownership_code_handling: NO_RULE_TABLE,
    alternative_recordkeeping_handling: ALTERNATIVE_RECORDKEEPING_BASIS,
    money_representation: 'All amounts are integer minor units and all arithmetic is fixed point. No floating point operation is performed on money, and a balance that is not an integer is reported as undeterminable rather than coerced or rounded.',
    rationale,
    boundary: BOUNDARY,
    note: 'Deterministic deposit insurance coverage determination by ownership right and capacity. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing. It computes insured and uninsured amounts from supplied records against a caller-supplied standard maximum deposit insurance amount, and it names the missing field for every account it cannot calculate. It holds no part 330 rule table, asserts no covered status, verifies no certification, reads no clock, and is not a filing and not deposit insurance advice.',
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
