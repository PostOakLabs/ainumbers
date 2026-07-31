/**
 * art-509-recompute-payment-waterfall.kernel.mjs
 * Assurance Waves programme (SECURITISATION-WATERFALL-BUILD-SPEC.md §2, SECZ-K-1) — recomputes a
 * securitisation payment waterfall for ONE STATED PERIOD from the available funds and the priority
 * ladder the investor already holds.
 *
 * WHY THIS IS AN INDEPENDENT RECOMPUTATION AND NOT A FOOTING CHECK. A footing check re-adds numbers
 * the reviewer could add by hand from a single published column. This kernel does not do that. It
 * takes the aggregate funds available for the period and the priority ladder from the deal's own
 * transaction documents, and it runs the allocation itself: each step's claim is met in ladder order,
 * capped where the caller declares a cap, until the pool is exhausted. The paid and shortfall figures
 * are DERIVED HERE from the ladder, never lifted from the investor report. Where the caller also
 * supplies what the report says was paid, the two are compared field by field. That comparison is the
 * point: it is only meaningful because the left-hand side was computed independently.
 *
 * EVERYTHING EXTERNAL IS A CALLER INPUT (spec §1, the maintenance guard). The ladder, the caps, the
 * test thresholds and the divert behaviour all come from the caller's own transaction documents.
 * There is no shipped deal library, no bundled ladder, no market-convention threshold, and no rate or
 * index table. The ladder reference the caller pins is echoed into the artifact and rendered on
 * screen, so a later amendment to the deal documents makes an old receipt DATED rather than wrong.
 *
 * NO ARTICLE 7 TEMPLATE SURFACE ANYWHERE (spec §0, locked). ESMA's disclosure templates are in
 * flight, so this kernel reads no template, validates no field set, and asserts conformance with no
 * annex. The ladder comes from the transaction documents, which is exactly why template churn cannot
 * reach this arithmetic. Do not import a template here.
 *
 * RECOMPUTE-ONLY IS ITS OWN STATE. Absent `asserted_allocations` the run is reported as
 * `recompute_only`, never as agreement. A reader holding only the artifact can tell the difference
 * between "we recomputed and it matched" and "nobody gave us anything to match against".
 *
 * ASSERTED-ONLY STEPS ARE MARKED AS SUCH. Some ladder lines are not publicly recomputable: a trustee
 * fee or a senior expense is set by a fee letter that is not a public document. The caller declares
 * such a step `amount_source: "asserted"`, the step is allocated exactly as any other but is reported
 * as an asserted input rather than a recomputed one, and the artifact carries the count. The tool
 * never pretends to have derived a number it was simply handed.
 *
 * DIVERSION IS DECLARED, NEVER INFERRED. A failing test diverts funds only where the caller has
 * declared, on that test, which step ids it suppresses. No default divert behaviour exists here and
 * none is guessed from a test's name. Tests are evaluated BEFORE allocation, from caller-supplied
 * measured values, so the suppression applied is a mechanical consequence of the caller's own
 * declaration and of nothing else.
 *
 * FIXED-POINT MONEY MATH. Every amount crosses the boundary as an INTEGER NUMBER OF MINOR UNITS.
 * There is no floating-point arithmetic in compute(): allocation, capping, shortfall and residual are
 * integer operations, and the 2dp display strings come from integer division plus string padding,
 * never from toFixed() on a float. Ratio tests are compared by CROSS-MULTIPLICATION of caller-supplied
 * integer numerators and denominators, so no division is ever performed on the comparison path.
 *
 * FINITE GATE. Zero available funds, an empty ladder, a zero ratio denominator and a step naming a
 * ledger that was not supplied each resolve to a DEFINED result. No branch can emit NaN, Infinity,
 * null-as-a-number, or an undefined state. A value that is not a usable integer amount is coerced to
 * 0 AND named in `rejected_inputs[]`, never silently dropped.
 *
 * CONFIDENTIALITY (spec §4). The arithmetic needs no loan-level data: aggregate available funds plus
 * a declared ladder is the whole input surface. Unmapped fields on any supplied object are IGNORED
 * and are never echoed into `output_payload`, so a caller who pastes a wider record cannot leak
 * confidential or personal fields into the receipt. Fixtures are SYNTHETIC (CONTRACT §1.3).
 *
 * §28 CLAUSE BINDING (profile `ocg-clause-binding@1`): the rule references this kernel relies on are
 * emitted as §1.2 pinned citation OBJECTS inside output_payload, so they sit inside the
 * execution_hash preimage. Every object carries a full ISO `in_force_from`; a bare year would not
 * satisfy it.
 *
 * NO CLOCK. `period_label` and every date are caller inputs; compute() never reads a clock, and the
 * artifact carries no `last_reviewed` and no `valid_until` derived from now plus a window.
 *
 * THIS IS NOT A COMPLIANCE DETERMINATION. A shortfall or a difference against the investor report is
 * an arithmetic finding about the figures and the ladder supplied here. Whether the deal was paid
 * correctly is for the transaction documents, the cash manager and the trustee, never for this tool.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: SECURITISATION-WATERFALL-BUILD-SPEC.md §0/§1/§2/§4 · SAFEGUARDING-CASS15-BUILD-SPEC.md §5.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-509-recompute-payment-waterfall';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'recompute_payment_waterfall', mandate_type: 'analytics_mandate', gpu: false };

/**
 * §28 pinned citation objects (profile `ocg-clause-binding@1`, §1.2 required members).
 * The Securitisation Regulation applied from 1 January 2019, which is the `in_force_from` used here.
 * A bare year would not satisfy `in_force_from`; these are full ISO dates by construction.
 */
const CITE_MAPPED_BY = 'AINumbers SECZ-K-1';
const CITE_MAPPED_AT = '2026-07-31';
const IN_FORCE_FROM = '2019-01-01';
const SECR_URI = 'https://eur-lex.europa.eu/eli/reg/2017/2402/oj';
function cite(id) {
  return { scheme: 'eu-regulation', id, in_force_from: IN_FORCE_FROM, mapped_by: CITE_MAPPED_BY, mapped_at: CITE_MAPPED_AT, uri: SECR_URI };
}
const CITATIONS = {
  investor_report: cite('Regulation (EU) 2017/2402 Article 7(1)(e)'),
  investor_diligence: cite('Regulation (EU) 2017/2402 Article 5(4)'),
};

/** The basis version pinned in the artifact AND rendered on screen. */
const BASIS = {
  basis_id: 'CALLER-SUPPLIED-LADDER',
  basis_label: 'Priority of payments as declared by the caller from the transaction documents',
  ladder_source: 'transaction_documents',
  template_conformance_checked: false,
  template_note: 'No Article 7 disclosure template is read, validated or asserted anywhere in this tool. The ladder comes from the deal documents the investor already holds.',
  field_set_version: '1.0.0',
};

/** Ratio comparators. Every one is evaluated by integer cross-multiplication, never by division. */
const COMPARATORS = ['gte', 'gt', 'lte', 'lt', 'eq'];

const MINOR_UNIT_EXPONENT = 2;
const MINOR_SCALE = 100;

function isSafeIntAmount(v) {
  return typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v);
}
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
/** 2dp display string from an integer minor-unit amount. Integer division only, no floats. */
function display(minor) {
  const neg = minor < 0;
  const abs = neg ? -minor : minor;
  const whole = Math.trunc(abs / MINOR_SCALE);
  const frac = abs - whole * MINOR_SCALE;
  return (neg ? '-' : '') + String(whole) + '.' + String(frac).padStart(MINOR_UNIT_EXPONENT, '0');
}
function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function str(v, fallback) { return isNonEmptyString(v) ? v.trim() : fallback; }
function strOrNull(v) { return isNonEmptyString(v) ? v.trim() : null; }
function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const period_label = str(pp.period_label, 'UNSTATED');
  const currency = isNonEmptyString(pp.currency) ? pp.currency.trim().toUpperCase() : 'EUR';
  const deal_ref = str(pp.deal_ref, 'UNSTATED');

  // ── The ladder reference, pinned so an amendment dates an old receipt rather than falsifying it. ──
  const ladderRefIn = obj(pp.ladder_ref);
  const ladder_ref = {
    document_ref: str(ladderRefIn.document_ref, 'UNSTATED'),
    section_ref: str(ladderRefIn.section_ref, 'UNSTATED'),
    version: str(ladderRefIn.version, 'UNSTATED'),
    dated: str(ladderRefIn.dated, 'UNSTATED'),
    supplied: pp.ladder_ref !== undefined && pp.ladder_ref !== null,
  };

  // ── Available funds by ledger. A caller who does not split supplies one ledger. ────────────────
  const suppliedFunds = arr(pp.available_funds);
  const ledgers = [];
  const pools = {};
  if (suppliedFunds.length === 0 && isSafeIntAmount(pp.available_funds_minor_units)) {
    // Convenience form: a single unsplit pool supplied as a bare integer.
    ledgers.push({ ledger: 'combined', opening_minor_units: pp.available_funds_minor_units });
    pools.combined = pp.available_funds_minor_units;
  } else {
    for (let i = 0; i < suppliedFunds.length; i++) {
      const f = obj(suppliedFunds[i]);
      const ledger = str(f.ledger, `LEDGER-${i + 1}`);
      const amount = toMinorUnits(
        f.amount_minor_units !== undefined ? f.amount_minor_units : f.amount,
        `available_funds[${i}].amount_minor_units`,
        rejected_inputs,
      );
      if (pools[ledger] === undefined) {
        pools[ledger] = amount;
        ledgers.push({ ledger, opening_minor_units: amount });
      } else {
        // Two rows for one ledger sum, which is the only reading that keeps the pool total honest.
        pools[ledger] += amount;
        for (const l of ledgers) if (l.ledger === ledger) l.opening_minor_units = pools[ledger];
      }
    }
  }
  if (ledgers.length === 0) {
    ledgers.push({ ledger: 'combined', opening_minor_units: 0 });
    pools.combined = 0;
    rejected_inputs.push({ where: 'available_funds', reason: 'absent', supplied: null });
  }
  const default_ledger = ledgers[0].ledger;
  let total_available_minor_units = 0;
  for (const l of ledgers) total_available_minor_units += l.opening_minor_units;

  // ── Tests. Evaluated BEFORE allocation, from caller-supplied measured values and caller-supplied
  //    thresholds. No market convention is baked in and no threshold has a default. ───────────────
  const suppressed_by = {}; // step_id -> test_id that suppressed it
  const test_results = arr(pp.tests).map((raw, i) => {
    const t = obj(raw);
    const test_id = str(t.test_id, `TEST-${i + 1}`);
    const comparatorSupplied = str(t.comparator, '');
    const comparator = COMPARATORS.indexOf(comparatorSupplied) !== -1 ? comparatorSupplied : null;
    if (comparator === null) {
      rejected_inputs.push({
        where: `tests[${i}].comparator`,
        reason: comparatorSupplied === '' ? 'absent' : 'not one of gte, gt, lte, lt, eq',
        supplied: comparatorSupplied === '' ? null : comparatorSupplied,
      });
    }

    // Two shapes are accepted, both integer-only: a money comparison, or a ratio compared by
    // cross-multiplication. A ratio is NEVER divided, so a denominator of zero cannot produce NaN.
    const isRatio = t.measured_numerator !== undefined || t.threshold_numerator !== undefined;
    let outcome;
    let basis_detail;
    let measured = null;
    let threshold = null;

    if (comparator === null) {
      outcome = 'undetermined';
      basis_detail = 'No usable comparator was supplied, so the test cannot be evaluated. It is reported rather than assumed to pass.';
    } else if (isRatio) {
      const mn = toMinorUnits(t.measured_numerator, `tests[${i}].measured_numerator`, rejected_inputs);
      const md = toMinorUnits(t.measured_denominator, `tests[${i}].measured_denominator`, rejected_inputs);
      const tn = toMinorUnits(t.threshold_numerator, `tests[${i}].threshold_numerator`, rejected_inputs);
      const td = toMinorUnits(t.threshold_denominator, `tests[${i}].threshold_denominator`, rejected_inputs);
      measured = { form: 'ratio', numerator: mn, denominator: md };
      threshold = { form: 'ratio', numerator: tn, denominator: td };
      if (md === 0 || td === 0) {
        outcome = 'undetermined';
        basis_detail = 'A ratio denominator supplied for this test is zero, so the ratio is not defined. The test is reported as undetermined rather than resolved in either direction.';
      } else {
        // measured/md ? threshold/td  becomes  mn*td ? tn*md, sign-corrected for negative denominators.
        const flip = (md < 0) !== (td < 0);
        const left = mn * td;
        const right = tn * md;
        const pass = compareInts(flip ? right : left, flip ? left : right, comparator);
        outcome = pass ? 'pass' : 'fail';
        basis_detail = `Ratio test evaluated by integer cross-multiplication against the threshold supplied for it. No division is performed on the comparison path.`;
      }
    } else {
      const mv = toMinorUnits(t.measured_value_minor_units, `tests[${i}].measured_value_minor_units`, rejected_inputs);
      const tv = toMinorUnits(t.threshold_minor_units, `tests[${i}].threshold_minor_units`, rejected_inputs);
      measured = { form: 'amount', amount_minor_units: mv, amount_display: display(mv) };
      threshold = { form: 'amount', amount_minor_units: tv, amount_display: display(tv) };
      outcome = compareInts(mv, tv, comparator) ? 'pass' : 'fail';
      basis_detail = 'Amount test evaluated as an integer minor-unit comparison against the threshold supplied for it.';
    }

    const suppress_step_ids = arr(t.on_fail_suppress_step_ids).map((s) => strOrNull(s)).filter((s) => s !== null);
    const divert_declared = suppress_step_ids.length > 0;
    const divert_applied = outcome === 'fail' && divert_declared;
    if (divert_applied) {
      for (const sid of suppress_step_ids) if (suppressed_by[sid] === undefined) suppressed_by[sid] = test_id;
    }

    return {
      test_id,
      label: str(t.label, test_id),
      basis: str(t.basis, 'Declared by the caller from the transaction documents.'),
      comparator,
      measured,
      threshold,
      outcome,
      basis_detail,
      divert_declared,
      divert_applied,
      suppress_step_ids,
      divert_description: str(t.on_fail_description, divert_declared
        ? 'The caller declared the step ids this test suppresses on failure.'
        : 'The caller declared no diversion for this test, so a failure suppresses nothing. Divert behaviour is never inferred here.'),
    };
  });

  const failed_tests = test_results.filter((t) => t.outcome === 'fail');
  const undetermined_tests = test_results.filter((t) => t.outcome === 'undetermined');

  // ── Sequential allocation down the ladder, in the order supplied, honouring caps. ──────────────
  const steps = [];
  let first_unfunded_step = null;
  const suppliedLadder = arr(pp.priority_ladder);

  for (let i = 0; i < suppliedLadder.length; i++) {
    const s = obj(suppliedLadder[i]);
    const step_id = str(s.step_id, `STEP-${i + 1}`);
    const ledger = str(s.ledger, default_ledger);
    const ledger_known = Object.prototype.hasOwnProperty.call(pools, ledger);
    if (!ledger_known) {
      rejected_inputs.push({
        where: `priority_ladder[${i}].ledger`,
        reason: 'names a ledger that was not supplied in available_funds, so its pool is zero',
        supplied: ledger,
      });
    }

    const claim_minor_units = toMinorUnits(
      s.amount_due_minor_units !== undefined ? s.amount_due_minor_units : s.amount_minor_units,
      `priority_ladder[${i}].amount_due_minor_units`,
      rejected_inputs,
    );
    const capSupplied = s.cap_minor_units !== undefined && s.cap_minor_units !== null;
    const cap_minor_units = capSupplied
      ? toMinorUnits(s.cap_minor_units, `priority_ladder[${i}].cap_minor_units`, rejected_inputs)
      : null;
    const cap_applied = capSupplied && cap_minor_units < claim_minor_units;
    const due_minor_units = cap_applied ? cap_minor_units : claim_minor_units;

    const suppressed_by_test = suppressed_by[step_id] !== undefined ? suppressed_by[step_id] : null;
    const available = ledger_known ? pools[ledger] : 0;
    // A negative claim would let a step ADD to the pool, which no waterfall does. Floor at zero.
    const payable = due_minor_units > 0 ? due_minor_units : 0;
    const paid_minor_units = suppressed_by_test !== null ? 0 : (available < payable ? (available > 0 ? available : 0) : payable);
    const shortfall_minor_units = suppressed_by_test !== null ? 0 : payable - paid_minor_units;
    if (ledger_known) pools[ledger] = available - paid_minor_units;

    const amount_source = s.amount_source === 'asserted' ? 'asserted' : 'recomputed';

    if (first_unfunded_step === null && shortfall_minor_units > 0) first_unfunded_step = step_id;

    steps.push({
      step_id,
      label: str(s.label, step_id),
      basis: str(s.basis, 'Declared by the caller from the transaction documents.'),
      ledger,
      ledger_supplied: ledger_known,
      position: i + 1,
      amount_source,
      claim_minor_units,
      claim_display: display(claim_minor_units),
      cap_minor_units,
      cap_display: cap_minor_units === null ? null : display(cap_minor_units),
      cap_applied,
      due_minor_units: payable,
      due_display: display(payable),
      paid_minor_units,
      paid_display: display(paid_minor_units),
      shortfall_minor_units,
      shortfall_display: display(shortfall_minor_units),
      fully_paid: suppressed_by_test === null && shortfall_minor_units === 0,
      suppressed_by_test,
    });
  }

  const residual_by_ledger = ledgers.map((l) => ({
    ledger: l.ledger,
    opening_minor_units: l.opening_minor_units,
    opening_display: display(l.opening_minor_units),
    residual_minor_units: pools[l.ledger],
    residual_display: display(pools[l.ledger]),
  }));
  let residual_minor_units = 0;
  for (const r of residual_by_ledger) residual_minor_units += r.residual_minor_units;

  let total_paid_minor_units = 0;
  let total_shortfall_minor_units = 0;
  for (const s of steps) { total_paid_minor_units += s.paid_minor_units; total_shortfall_minor_units += s.shortfall_minor_units; }

  const asserted_step_count = steps.filter((s) => s.amount_source === 'asserted').length;
  const recomputed_step_count = steps.length - asserted_step_count;

  // ── Comparison against what the investor report says was paid, where the caller supplied it. ───
  const assertedSupplied = pp.asserted_allocations !== undefined && pp.asserted_allocations !== null;
  const diff = [];
  if (assertedSupplied) {
    const assertedRows = arr(pp.asserted_allocations);
    const seen = [];
    for (let i = 0; i < assertedRows.length; i++) {
      const a = obj(assertedRows[i]);
      const step_id = str(a.step_id, `ASSERTED-${i + 1}`);
      seen.push(step_id);
      const asserted_minor_units = toMinorUnits(
        a.amount_minor_units !== undefined ? a.amount_minor_units : a.paid_minor_units,
        `asserted_allocations[${i}].amount_minor_units`,
        rejected_inputs,
      );
      const match = steps.filter((s) => s.step_id === step_id)[0];
      if (match === undefined) {
        diff.push({
          step_id,
          in_ladder: false,
          recomputed_minor_units: null,
          recomputed_display: null,
          asserted_minor_units,
          asserted_display: display(asserted_minor_units),
          difference_minor_units: null,
          difference_display: null,
          agrees: false,
          detail: 'The investor report names an allocation for a step that is not in the ladder supplied. It is carried here rather than dropped, and the ladder may be incomplete.',
        });
      } else {
        const difference_minor_units = match.paid_minor_units - asserted_minor_units;
        diff.push({
          step_id,
          in_ladder: true,
          recomputed_minor_units: match.paid_minor_units,
          recomputed_display: match.paid_display,
          asserted_minor_units,
          asserted_display: display(asserted_minor_units),
          difference_minor_units,
          difference_display: display(difference_minor_units),
          agrees: difference_minor_units === 0,
          detail: difference_minor_units === 0
            ? 'The independently recomputed allocation equals the allocation the report asserts for this step.'
            : 'The independently recomputed allocation differs from the allocation the report asserts for this step.',
        });
      }
    }
    for (const s of steps) {
      if (seen.indexOf(s.step_id) === -1) {
        diff.push({
          step_id: s.step_id,
          in_ladder: true,
          recomputed_minor_units: s.paid_minor_units,
          recomputed_display: s.paid_display,
          asserted_minor_units: null,
          asserted_display: null,
          difference_minor_units: null,
          difference_display: null,
          agrees: false,
          detail: 'The ladder has this step but the supplied report allocations name no figure for it, so there is nothing to compare against.',
        });
      }
    }
  }

  const comparable = diff.filter((d) => d.difference_minor_units !== null);
  const disagreeing = diff.filter((d) => !d.agrees);
  const comparison_state = !assertedSupplied
    ? 'recompute_only'
    : disagreeing.length === 0 && comparable.length > 0
      ? 'matches'
      : 'differs';

  // ── Rationale. ──────────────────────────────────────────────────────────────────────────────
  const rationale = [];
  rationale.push(`Waterfall recomputed for period ${period_label} on deal reference ${deal_ref}, against the priority ladder pinned as ${ladder_ref.document_ref} ${ladder_ref.section_ref} version ${ladder_ref.version} dated ${ladder_ref.dated}.`);
  rationale.push(`Total available funds of ${display(total_available_minor_units)} ${currency} across ${ledgers.length} ledger${ledgers.length === 1 ? '' : 's'} were allocated down ${steps.length} ladder step${steps.length === 1 ? '' : 's'} in the order supplied, honouring every declared cap.`);
  if (!ladder_ref.supplied) {
    rationale.push('No ladder reference was supplied, so the artifact cannot say which version of the transaction documents this recomputation followed. A receipt without that pin cannot be dated against a later amendment.');
  }
  if (steps.length === 0) {
    rationale.push('No ladder steps were supplied, so nothing was allocated and the whole pool remains as residual. That is an arithmetic result on an empty ladder, not a finding that the deal paid nothing.');
  }
  if (asserted_step_count > 0) {
    rationale.push(`${asserted_step_count} of ${steps.length} step${steps.length === 1 ? '' : 's'} carry an amount the caller declared as ASSERTED rather than recomputed, typically a trustee fee or a senior expense set by a fee letter that is not a public document. Those amounts are allocated exactly as supplied and are reported as asserted inputs, never as figures this tool derived.`);
  }
  rationale.push(first_unfunded_step === null
    ? 'Every step was met in full from the funds available, so no step ran out of money.'
    : `Funds ran out at step ${first_unfunded_step}, which is the first step whose claim could not be met in full. Total shortfall across the ladder is ${display(total_shortfall_minor_units)} ${currency}.`);
  rationale.push(`Residual after the ladder is ${display(residual_minor_units)} ${currency}.`);
  if (test_results.length === 0) {
    rationale.push('No tests were supplied, so no test was evaluated and no diversion was applied.');
  } else {
    rationale.push(`${test_results.length} test${test_results.length === 1 ? '' : 's'} evaluated against caller-supplied thresholds: ${test_results.filter((t) => t.outcome === 'pass').length} pass, ${failed_tests.length} fail, ${undetermined_tests.length} undetermined. No market convention threshold is baked into this tool.`);
    const appliedDiverts = test_results.filter((t) => t.divert_applied);
    if (appliedDiverts.length > 0) {
      rationale.push(`${appliedDiverts.length} failing test${appliedDiverts.length === 1 ? '' : 's'} suppressed the step ids the caller declared against ${appliedDiverts.length === 1 ? 'it' : 'them'}. Divert behaviour is taken from that declaration alone and is never inferred from a test name or a market convention.`);
    }
    const failedNoDivert = failed_tests.filter((t) => !t.divert_declared);
    if (failedNoDivert.length > 0) {
      rationale.push(`${failedNoDivert.length} test${failedNoDivert.length === 1 ? '' : 's'} failed but declared no diversion, so the allocation above is unchanged by ${failedNoDivert.length === 1 ? 'it' : 'them'}. If the transaction documents divert on that failure, supply the suppressed step ids and run again.`);
    }
  }
  rationale.push(comparison_state === 'recompute_only'
    ? 'No asserted allocations were supplied, so this run is RECOMPUTE-ONLY. It states what the ladder produces from the funds supplied. It is not agreement with any investor report, because none was given to compare against.'
    : comparison_state === 'matches'
      ? `The independently recomputed allocation agrees with every one of the ${comparable.length} step${comparable.length === 1 ? '' : 's'} the supplied report allocations name. The left-hand side of that comparison was computed here from the ladder, not lifted from the report.`
      : `The independently recomputed allocation differs from the supplied report allocations on ${disagreeing.length} step${disagreeing.length === 1 ? '' : 's'}. Each difference is listed with both figures. A difference is an arithmetic finding about the ladder and figures supplied here, not a determination that the deal was paid incorrectly.`);
  if (rejected_inputs.length > 0) {
    rationale.push(`${rejected_inputs.length} supplied value${rejected_inputs.length === 1 ? ' was' : 's were'} not usable and ${rejected_inputs.length === 1 ? 'was' : 'were'} treated as zero or as unevaluable. Each one is named in rejected_inputs rather than silently dropped.`);
  }
  rationale.push('No Article 7 disclosure template was read, validated or asserted. The priority of payments used here is the one declared from the transaction documents, which is why a template amendment cannot reach this arithmetic.');

  // ── Flags. ──────────────────────────────────────────────────────────────────────────────────
  const compliance_flags = ['WFALL_RECOMPUTED'];
  compliance_flags.push(comparison_state === 'recompute_only' ? 'WFALL_RECOMPUTE_ONLY' : comparison_state === 'matches' ? 'WFALL_MATCHES' : 'WFALL_DIFFERS');
  if (failed_tests.length > 0) compliance_flags.push('WFALL_TEST_BREACH');
  if (total_shortfall_minor_units > 0) compliance_flags.push('WFALL_SHORTFALL');
  if (total_shortfall_minor_units > 0 || failed_tests.length > 0 || comparison_state === 'differs') compliance_flags.push('ESCALATION_RAISED');
  if (undetermined_tests.length > 0) compliance_flags.push('WFALL_TEST_UNDETERMINED');
  if (asserted_step_count > 0) compliance_flags.push('WFALL_ASSERTED_STEP_PRESENT');
  if (!ladder_ref.supplied) compliance_flags.push('WFALL_LADDER_REF_ABSENT');
  if (steps.length === 0) compliance_flags.push('WFALL_LADDER_EMPTY');
  if (total_available_minor_units === 0) compliance_flags.push('WFALL_NO_AVAILABLE_FUNDS');
  if (rejected_inputs.length > 0) compliance_flags.push('WFALL_INPUTS_REJECTED');

  const output_payload = {
    basis: BASIS,
    period_label,
    deal_ref,
    currency,
    minor_unit_exponent: MINOR_UNIT_EXPONENT,
    ladder_ref,
    available_funds_by_ledger: ledgers.map((l) => ({ ledger: l.ledger, opening_minor_units: l.opening_minor_units, opening_display: display(l.opening_minor_units) })),
    total_available_minor_units,
    total_available_display: display(total_available_minor_units),
    step_count: steps.length,
    recomputed_step_count,
    asserted_step_count,
    steps,
    first_unfunded_step,
    total_paid_minor_units,
    total_paid_display: display(total_paid_minor_units),
    total_shortfall_minor_units,
    total_shortfall_display: display(total_shortfall_minor_units),
    residual_by_ledger,
    residual_minor_units,
    residual_display: display(residual_minor_units),
    test_results,
    comparison_state,
    comparison_basis: 'The recomputed side of every comparison is derived here by running the caller declared ladder against the caller supplied available funds. It is not read from the investor report. A comparison is only meaningful because the two sides have independent provenance.',
    diff,
    rejected_inputs,
    citations: CITATIONS,
    rationale,
    recompute_only_note: 'Where comparison_state is recompute_only, no asserted allocations were supplied and this artifact records what the ladder produces, never agreement with an investor report.',
    no_template_claim: 'This tool reads no Article 7 disclosure template, validates no field set, and asserts conformance with no annex. The priority of payments is taken from the caller transaction documents.',
    note: 'Deterministic securitisation payment waterfall recomputation for one stated period. Single-run and stateless: it holds no records, runs on no schedule, and retains nothing. The allocation is derived here from a caller declared priority ladder and caller supplied available funds, so a comparison against an investor report is an independent recomputation rather than a re-footing of published totals. It forecasts nothing, models no scenario, performs no credit or rating analysis, and makes no assertion about the compliance status of the deal. It is not a regulatory filing and not legal advice.',
  };

  return { output_payload, compliance_flags };
}

/** Integer comparison. Kept out of compute() only for readability; no state, no clock, no floats. */
function compareInts(left, right, comparator) {
  if (comparator === 'gte') return left >= right;
  if (comparator === 'gt') return left > right;
  if (comparator === 'lte') return left <= right;
  if (comparator === 'lt') return left < right;
  return left === right;
}

/** §1.4 pointers: every one roots at output_payload, so each cited object is inside the preimage. */
export const CLAUSE_BINDING_POINTERS = Object.keys(CITATIONS).map((k) => ({
  profile: 'ocg-clause-binding@1',
  pointer: `/output_payload/citations/${k}`,
}));

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    clause_bindings: CLAUSE_BINDING_POINTERS,
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
