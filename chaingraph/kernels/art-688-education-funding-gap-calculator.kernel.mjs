/**
 * art-688-education-funding-gap-calculator.kernel.mjs
 *
 * EDUCATION-FUNDING-BUILD-1 (EDUCATION-FUNDING-BUILD-SPEC.md) -- deterministic
 * education-funding arithmetic over caller-declared synthetic inputs. A GAP
 * CALCULATOR, never advice: there is no account, no plan record, no market
 * data, no beneficiary registry, and no clock inside compute(). The caller
 * declares the funding goal, the horizon in years, an assumed annual return,
 * the current balance, and (optionally) an overfunded rollover cap; this
 * kernel only grows the balance at the declared rate and subtracts.
 *
 * FUNCTIONS (per the spec):
 *   - Future value of the current balance at the declared return:
 *     fv = current_balance * (1 + annual_return_pct/100)^years, rounded to
 *     2 decimal places, half-up (a declared convention, repeated in trace).
 *   - Funding gap vs the declared goal: gap = goal - fv, 2dp half-up.
 *   - Verdict: "GAP_COMPUTED" when the grown balance is below the goal
 *     (funding_gap > 0); "GOAL_MET" when the grown balance meets or exceeds
 *     it (funding_gap <= 0). On the overfunded path, when a rollover_cap was
 *     declared, the trace carries an overfunded-to-Roth rollover note naming
 *     the DECLARED cap. The cap is a caller declaration, never a constant
 *     this kernel owns; the dated primary-text provenance for the statutory
 *     lifetime cap lives in the node metadata, not in this file.
 *   - Contribution solver: explicitly OUT OF SCOPE for v1 (spec follow-on).
 *
 * NEVER GUESS, NEVER DEFAULT. An absent or out-of-range input resolves to the
 * fail-closed payload -- every output field null, each offending field named
 * in domain_errors and in the trace -- never a silently repaired projection.
 *
 * SCOPE FENCE (advice-perimeter doctrine, PLATFORM-DOORS 4.4; wealthtech
 * framing is binding copy per the spec). This kernel computes compound-growth
 * and subtraction arithmetic over caller-declared synthetic inputs. It is NOT
 * financial advice, NOT a savings recommendation, NOT a 529 plan evaluation,
 * and NOT a tax determination: it never recommends a contribution, a plan, or
 * a rollover. Naming carries no optimizer or advisor vocabulary anywhere.
 * Funding and investment decisions belong to the caller and its advisers.
 *
 * Output payload shape: exactly { fv_current_balance, funding_gap, trace,
 * overall } on a computable path (the canonical pinned shape; extra keys
 * would move the execution_hash), and the same fields nulled plus a
 * domain_errors[] array on the fail-closed path (the flag-mirror member: a
 * caveat carrier, truthy exactly when inputs were refused).
 *
 * ROUNDING DECLARATION: every emitted monetary value is rounded to 2 decimal
 * places, half-up; the convention is restated in the trace.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute() (as-of
 * is an input by construction: nothing here reads a date). Runs unmodified in
 * the QuickJS-ng guest (no TextEncoder/atob/btoa/URL anywhere in this file).
 *
 * Spec: EDUCATION-FUNDING-BUILD-SPEC.md (canonical preimage, execution_hash
 * pinned at staging: d0ed28680e17ad9a20bd29e5881bd054f4888ff40b7cee9d22e8efb9dda28ab6).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-688-education-funding-gap-calculator';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_education_funding_gap_calculator',
  mandate_type: 'compliance_control',
  gpu: false,
};

// Human phrasing per domain error code -- composes the fail-closed trace.
const ERROR_PHRASES = {
  INVALID_GOAL: 'goal must be a number in (0, 1000000000]',
  INVALID_YEARS: 'years must be an integer in [1, 100]',
  INVALID_RETURN: 'annual_return_pct must be a finite number in [-10, 30]',
  INVALID_BALANCE: 'current_balance must be a finite number in [0, 1000000000]',
  INVALID_ROLLOVER_CAP: 'rollover_cap, when present, must be a finite number in [0, 1000000000]',
};

// Half-up rounding to dp decimal places (declared rounding convention). The
// scale factor is built by iterated multiplication, never Math.pow: IEEE 754
// multiplication is exactly specified, so this stays engine-deterministic
// where Math.pow is implementation-defined (kernel-determinism gate).
function roundHalfUp(x, dp) {
  let m = 1;
  for (let i = 0; i < dp; i++) m *= 10;
  const scaled = x * m;
  const r = scaled < 0 ? -Math.floor(-scaled + 0.5) : Math.floor(scaled + 0.5);
  return r / m;
}

// Deterministic integer-exponent power by repeated multiplication (years is a
// validated integer in [1, 100], so this is at most 100 exactly-specified IEEE
// 754 multiplies -- no Math.pow, no engine-approximated transcendental).
function powInt(base, exp) {
  let result = 1;
  for (let i = 0; i < exp; i++) result *= base;
  return result;
}

function isMoney(v, min, max) {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];
  const compliance_flags = [];

  const goal = pp.goal;
  if (!isMoney(goal, 0.01, 1000000000)) domain_errors.push('INVALID_GOAL');

  const years = pp.years;
  if (typeof years !== 'number' || !Number.isInteger(years) || years < 1 || years > 100) {
    domain_errors.push('INVALID_YEARS');
  }

  const rate = pp.annual_return_pct;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < -10 || rate > 30) {
    domain_errors.push('INVALID_RETURN');
  }

  const balance = pp.current_balance;
  if (!isMoney(balance, 0, 1000000000)) domain_errors.push('INVALID_BALANCE');

  const rolloverCap = pp.rollover_cap;
  const capOk = rolloverCap === undefined || (isMoney(rolloverCap, 0, 1000000000) && rolloverCap !== null);
  if (!capOk) domain_errors.push('INVALID_ROLLOVER_CAP');

  if (domain_errors.length > 0) {
    const reasons = domain_errors.map((c) => ERROR_PHRASES[c]).join('; ');
    compliance_flags.push('DOMAIN_ERROR');
    for (const code of domain_errors) compliance_flags.push(`EDUFUND_${code}`);
    return {
      output_payload: {
        fv_current_balance: null,
        funding_gap: null,
        trace: `fail-closed: ${reasons}; no funding-gap computation performed -- correct the named inputs and resubmit. Education funding arithmetic over caller-declared synthetic inputs only: not financial advice, not a savings recommendation, and not a tax determination.`,
        overall: null,
        domain_errors,
      },
      compliance_flags,
    };
  }

  const growth = powInt(1 + rate / 100, years);
  const fv = roundHalfUp(balance * growth, 2);
  const gap = roundHalfUp(goal - fv, 2);

  // Trace factor string: the growth factor as its shortest exact-enough
  // decimal (1.05, not (1 + 5/100)); canonical-trace format per the spec.
  const factorStr = String(Number((1 + rate / 100).toFixed(10)));

  let overall;
  let trace;
  if (gap > 0) {
    overall = 'GAP_COMPUTED';
    trace = `${balance} * ${factorStr}^${years} = ${fv} (2dp half-up); gap = ${goal} - ${fv} = ${gap}`;
  } else {
    overall = 'GOAL_MET';
    const surplus = roundHalfUp(-gap, 2);
    trace = `${balance} * ${factorStr}^${years} = ${fv} (2dp half-up); gap = ${goal} - ${fv} = ${gap} (goal met by ${surplus})`;
    if (rolloverCap !== undefined) {
      trace += `; overfunded-to-Roth rollover note: the DECLARED lifetime rollover cap is ${roundHalfUp(rolloverCap, 2)} -- a caller declaration echoed here, never a determination that any rollover is available or advisable`;
    }
  }

  return {
    output_payload: {
      fv_current_balance: fv,
      funding_gap: gap,
      trace,
      overall,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
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
}
