/**
 * art-679-orsa-readiness-pack.kernel.mjs
 *
 * ORSA-READINESS-BUILD-1 (ORSA-READINESS-BUILD-SPEC.md) -- deterministic ORSA
 * readiness arithmetic over caller-declared synthetic inputs. A READINESS
 * CHECKER, never a risk assessment and never a filing: there is no undertaking,
 * no risk inventory store, no scenario engine, no supervisor, and no clock
 * inside compute(). The caller declares the required scenario set, the scenario
 * set actually run, and the liquidity-plan documentation flag; this kernel only
 * performs the set difference and flag read and returns them with a trace.
 *
 * FUNCTIONS (per the spec):
 *   - Two-climate-scenario check: scenarios_missing = declared required set
 *     minus the declared run set, preserving required-set order.
 *   - Liquidity-plan flag: liquidity_plan is "DOCUMENTED" when the declared
 *     flag is true, "MISSING" when it is false.
 *   - Overall: "READY" exactly when scenarios_missing is empty AND the
 *     liquidity plan is documented; otherwise "NOT_READY".
 *   - Capital-contingency note and board sign-off record pointer: optional
 *     declared strings, echoed into the trace verbatim when present, never
 *     defaulted and never required.
 *
 * PRIMARY TEXT (SO #38, recorded in-row before any constant landed):
 *   the 2025 Solvency II amending directive, adopted 27 November 2024,
 *   OJ L 28.1.2025, CELEX 32025L0002 (citation lives in the node shard
 *   description; this comment carries articles only).
 *   - Inserted Article 45a(2): "Where the undertaking concerned has material
 *     exposure to climate change risks, the undertaking shall specify at least
 *     two long-term climate change scenarios, including the following: (a) a
 *     long-term climate change scenario where the global temperature increase
 *     remains below two degrees Celsius; (b) a long-term climate change
 *     scenario where the global temperature increase is significantly higher
 *     than two degrees Celsius." -> the orderly/disorderly pair this kernel
 *     checks as a DECLARED required set; the kernel does not decide materiality.
 *   - Inserted Article 144a(2): undertakings "draw up and keep up to date a
 *     liquidity risk management plan covering liquidity analysis over the
 *     short term, projecting the incoming and outgoing cash flows in relation
 *     to their assets and liabilities."
 *   - Documentary dated constant (NOT in the hashed preimage): transposition
 *     deadline 30 January 2027. Measured 2026-09-04; source locator CELEX
 *     32025L0002 final-articles dates page; derive: compare OJ L publication
 *     date 2025-01-28 plus the twenty-four-month transposition period.
 *
 * NEVER GUESS, NEVER DEFAULT. An absent or malformed scenario list or
 * liquidity flag resolves to the fail-closed payload -- every output field
 * null, each offending field named in domain_errors and in the trace -- never
 * a silently repaired assessment and never a defaulted scenario or flag.
 *
 * SCOPE FENCE (advice-perimeter doctrine, PLATFORM-DOORS 4.4). This kernel
 * computes set and flag arithmetic over caller-declared synthetic inputs. It
 * is NOT legal advice, NOT a determination that any undertaking's ORSA
 * satisfies the amending directive, NOT a materiality assessment, and NOT a
 * supervisory submission: it never sends, stages, or files anything anywhere.
 * Readiness judgements belong to the undertaking and its board alone.
 *
 * Output payload shape: exactly { scenarios_missing, liquidity_plan, trace,
 * overall } on a computable path (the canonical pinned shape; extra keys would
 * move the execution_hash), and the same fields nulled plus a domain_errors[]
 * array on the fail-closed path (the flag-mirror member: a caveat carrier,
 * truthy exactly when inputs were refused).
 *
 * ROUNDING DECLARATION: this kernel computes no numbers, so no rounding
 * applies; had a number been computed it would be rounded to 2 decimal places,
 * half-up, per the spec constraint.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute(). Runs
 * unmodified in the QuickJS-ng guest (no TextEncoder/atob/btoa/URL anywhere in
 * this file).
 *
 * Spec: ORSA-READINESS-BUILD-SPEC.md (canonical preimage, execution_hash
 * pinned at staging: 2a945db112b542787fc284bdb549140ba10bd147732126fd7faf052fc5fc52c0).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-679-orsa-readiness-pack';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'compute_orsa_readiness_pack',
  mandate_type: 'compliance_control',
  gpu: false,
};

// Human phrasing per domain error code -- composes the fail-closed trace.
const ERROR_PHRASES = {
  INVALID_SCENARIOS_REQUIRED: 'scenarios_required must be a non-empty array of declared scenario names',
  INVALID_SCENARIOS_RUN: 'scenarios_run must be an array of declared scenario names',
  INVALID_LIQUIDITY_FLAG: 'liquidity_plan_documented must be a boolean (true when the plan is documented, false when it is not)',
  INVALID_OPTIONAL_NOTE: 'capital_contingency_note and board_sign_off_reference, when present, must be non-empty strings',
};

/** A scenario name is a non-empty string. */
function validScenarioName(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

export function compute(pp) {
  pp = pp || {};
  const domain_errors = [];
  const compliance_flags = [];

  // Required scenario set: the declared duties the caller asserts apply.
  const required = pp.scenarios_required;
  if (!Array.isArray(required) || required.length === 0 || !required.every(validScenarioName)) {
    domain_errors.push('INVALID_SCENARIOS_REQUIRED');
  }

  // Run set: what was actually run. May be empty (nothing run yet is a
  // meaningful declared state, not an error).
  const run = pp.scenarios_run;
  if (!Array.isArray(run) || !run.every(validScenarioName)) {
    domain_errors.push('INVALID_SCENARIOS_RUN');
  }

  // Liquidity-plan documentation flag: strict boolean, never coerced.
  const flag = pp.liquidity_plan_documented;
  if (typeof flag !== 'boolean') domain_errors.push('INVALID_LIQUIDITY_FLAG');

  // Optional declared annotations, echoed verbatim when present.
  const capitalNote = pp.capital_contingency_note;
  const boardRef = pp.board_sign_off_reference;
  const capitalOk = capitalNote === undefined || (typeof capitalNote === 'string' && capitalNote.trim().length > 0);
  const boardOk = boardRef === undefined || (typeof boardRef === 'string' && boardRef.trim().length > 0);
  if (!capitalOk || !boardOk) domain_errors.push('INVALID_OPTIONAL_NOTE');

  if (domain_errors.length > 0) {
    const reasons = domain_errors.map((c) => ERROR_PHRASES[c]).join('; ');
    compliance_flags.push('DOMAIN_ERROR');
    for (const code of domain_errors) compliance_flags.push(`ORSA_${code}`);
    return {
      output_payload: {
        scenarios_missing: null,
        liquidity_plan: null,
        trace: `fail-closed: ${reasons}; no readiness verdict computed -- correct the named inputs and resubmit. ORSA readiness arithmetic over caller-declared synthetic inputs only: not legal advice, not a materiality assessment, and not a supervisory submission.`,
        overall: null,
        domain_errors,
      },
      compliance_flags,
    };
  }

  // Set difference, required-set order preserved, duplicate-run tolerant.
  const runSet = new Set(run.map((s) => s.trim()));
  const scenarios_missing = required.filter((s) => !runSet.has(s.trim()));

  const liquidity_plan = flag ? 'DOCUMENTED' : 'MISSING';

  // Trace: the canonical phrasing, plus verbatim optional annotations.
  let trace = `required set minus run set = ${scenarios_missing.length > 0 ? scenarios_missing.join(', ') : 'none'}; liquidity plan flag ${flag}`;
  if (capitalNote !== undefined) trace += `; capital contingency: ${capitalNote.trim()}`;
  if (boardRef !== undefined) trace += `; board sign-off: ${boardRef.trim()}`;

  const overall = scenarios_missing.length === 0 && flag ? 'READY' : 'NOT_READY';

  return {
    output_payload: { scenarios_missing, liquidity_plan, trace, overall },
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
