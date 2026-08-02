/**
 * art-518-bulk-disbursement-integrity.kernel.mjs
 * INBOUND-EVIDENCE-BUILD-SPEC.md §6.3 (RFP §4.3, CDGPSS202601) — bulk disbursement
 * integrity.
 *
 * ⛔ ZERO COVERAGE IN THE CATALOGUE TODAY (measured 2026-08-01). `art-283-pension-
 * lump-sum-vs-annuity-decision-engine` is a personal-finance decision engine and is
 * UNRELATED -- it is not cited as prior art and not touched by this kernel.
 *
 * SUBJECT: a bulk payment run -- salaries, pensions, social transfers, vendor
 * payments -- is internally consistent and matches its authorization. This kernel
 * attests four independent things about a run the caller already produced: (1) the
 * per-payee records reconcile to the authorized control total in BOTH count and
 * value; (2) any payee refs sharing a caller-supplied duplicate-candidate key are
 * surfaced as clusters; (3) any payee present this run and absent the prior run, or
 * the reverse, is surfaced as roster movement; (4) any single payment or per-payee
 * total breaches a declared limit, including a split-payment shape (multiple
 * sub-limit payments to one payee ref summing past the limit).
 *
 * ⛔⛔ DISB_DUPLICATE_CANDIDATE AND DISB_SPLIT_CANDIDATE ARE CANDIDATES, NOT FINDINGS
 * OF FRAUD -- THIS IS LOAD-BEARING. Two pensioners can legitimately share a
 * duplicate key; a split can be a corrected underpayment; a roster change is
 * ordinary joining and leaving. No string anywhere in this file, in a flag name, a
 * field name, or output prose may allege fraud, misconduct, "ghost" beneficiaries or
 * gaming. DISB_ROSTER_MOVEMENT is movement to be explained, never an accusation.
 *
 * ⛔⛔ ZERO PII, AND THIS IS THE HIGHEST-RISK SURFACE IN THE SPEC. A payee is an
 * opaque ref plus an amount and a rail -- never a name, national-insurance or
 * social-security number, bank account number, address, date of birth, or any
 * demographic field. This kernel never derives a key from identifying data, because
 * doing so would require ingesting it. The key is treated as an opaque string
 * throughout; it is never parsed, decoded, or compared to any other field.
 *
 * ⛔⛔ DUPLICATE-KEY COMMITMENT FORM (SPEC.md §25.0-§25.2, ocg-private-input@1). A
 * bare hash of the key is NOT safe: a payee identifier space is enumerable
 * (national-insurance/social-security numbers are small and structured; name lists
 * are obtainable), so an attacker holding the artifact precomputes the digest of
 * every candidate and recovers the plaintext by table lookup (SPEC.md §25.1). The
 * caller MUST supply `duplicate_key` as a `sha256-salted@1` commitment --
 * `"sha256:" + hex(SHA-256(salt || cgCanon(input_value)))` with a fresh >=256-bit
 * CSPRNG `salt` the caller (the prover) generates and RETAINS; the salt is never
 * sent to this kernel and never appears in the artifact. Declaring
 * `duplicate_key_commitment_scheme: "sha256-salted@1"` in `policy_parameters` opts
 * every `duplicate_key` in the run into this contract: a value that is not a
 * well-formed `sha256:<64-hex>` commitment is REJECTED (excluded from clustering,
 * recorded in `rejected_inputs`), and naming any scheme other than
 * `sha256-salted@1` rejects every declared key the same way -- a verifier MUST
 * reject an unknown scheme rather than treat it as opaque (SPEC.md §25.0). Accepted
 * commitments are declared in the artifact's top-level `private_inputs[]` (§25.0):
 * `pointer` an RFC 6901 pointer into `policy_parameters`, `commitment` the same
 * string that sits at that pointer (§25.2 plaintext-exclusion -- never the
 * plaintext), `commitment_scheme: "sha256-salted@1"`. `duplicate_key_commitment_
 * scheme` is OPTIONAL for backward compatibility with runs that predate this
 * contract -- when absent, `duplicate_key` is treated as an opaque token exactly as
 * before and nothing is declared private.
 *
 * REGION-PORTABLE BY CONSTRUCTION (§6.9). No country, currency, scheme, ministry,
 * or statute is named anywhere in this file. `currency`, both limits, and every
 * figure are caller-declared policy inputs -- the same kernel runs unchanged for a
 * second, structurally different jurisdiction (see the fixtures for two such cases:
 * a Family-Islands-style pension/salary run and a separate vendor-payment run with a
 * different currency, limit structure, and rail set).
 *
 * DESTINATION-TIER CAP (INBOUND-EVIDENCE-BUILD-SPEC.md §10.2 item 1, INBOUND-DISB-
 * TIERWALLET-FIX-1). A retail-CBDC destination account can be capped by KYC tier --
 * a payment that is authorized, funded, and reconciles cleanly can still FAIL TO
 * LAND because the destination wallet is at its balance cap. That is a distinct
 * failure mode from both existing sender-side checks (single_payment_over_limit,
 * run_total_over_limit): those bound what the SENDER may pay out; this bounds what
 * the RECEIVING wallet may hold. An optional per-record `destination_tier_limit_
 * minor_units` declares that payee's tier cap; where a payee's total disbursed
 * amount this run would exceed it, it is flagged `destination_cap_breach` in its
 * own `destination_cap_breaches[]` -- never folded into `limit_breaches`, never a
 * control-total break, never a duplicate-candidate. Absence of the field for a
 * payee stays fully conformant -- no cap check runs for that payee. Where a
 * payee's records disagree on the declared cap, the LOWEST declared value is used
 * (the binding constraint is the tightest tier any record names for that
 * destination).
 *
 * FIXED-POINT MONEY MATH (CONTRACT money convention, art-516 pattern). Every amount
 * crosses the boundary as an integer number of minor units. No floating-point
 * arithmetic anywhere in compute(): sums, differences, and limit comparisons are
 * integer operations; display strings come from integer division, never toFixed()
 * on a float. A non-integer, non-finite, or absent amount is coerced to 0 and named
 * in `rejected_inputs[]`, never silently dropped and never propagated as NaN.
 *
 * FINITE GATE. An empty per-payee record list, an all-zero authorization, and an
 * absent prior-run roster each resolve to a DEFINED verdict. No branch can emit
 * NaN, Infinity, null-as-a-number, or an undefined status.
 *
 * ABSENCE-INSTRUMENT RULE (art-516 pattern, applied to the prior-run roster). If
 * `prior_run_payee_refs` is ABSENT (undefined/null, not merely an empty array),
 * roster movement cannot be evaluated at all -- distinct from a declared empty
 * array, which means the prior run legitimately had zero payees and IS a verifiable
 * baseline. An absent roster never produces a false "no movement" reading.
 *
 * NO CLOCK. `as_of` is a caller input; compute() never reads a clock.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: INBOUND-EVIDENCE-BUILD-SPEC.md §6.3 (RFP §4.3).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-518-bulk-disbursement-integrity';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'attest_bulk_disbursement_integrity', mandate_type: 'attestation_mandate', gpu: false };

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
/** Positive integer limit, or null if absent/invalid -- absence disables that limit's check rather than faking a value. */
function toLimitOrNull(v, where, rejected) {
  if (isSafeIntAmount(v) && v > 0) return v;
  if (v === undefined || v === null) return null;
  rejected.push({ where, reason: 'present but not a positive integer number of minor units', supplied: typeof v === 'number' ? v : String(v) });
  return null;
}

// SPEC.md §25.1 -- the sole commitment scheme this profile version accepts.
const SHA256_SALTED_SCHEME = 'sha256-salted@1';
const SHA256_COMMITMENT_RE = /^sha256:[0-9a-f]{64}$/;

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];

  const run_reference = isNonEmptyString(pp.run_reference) ? pp.run_reference.trim() : null;
  if (!run_reference) rejected_inputs.push({ where: 'run_reference', reason: 'absent', supplied: null });
  const as_of = isoDateOrNull(pp.as_of);
  const currency = isNonEmptyString(pp.currency) ? pp.currency.trim().toUpperCase() : 'USD';

  // --- Authorization (§6.3: authorized control total and payee count) ---
  const auth = pp.authorized_control_total && typeof pp.authorized_control_total === 'object' ? pp.authorized_control_total : {};
  const authorized_payee_count = toCount(auth.payee_count, 'authorized_control_total.payee_count', rejected_inputs);
  const authorized_total_minor_units = toMinorUnits(auth.total_minor_units, 'authorized_control_total.total_minor_units', rejected_inputs);

  // --- Per-payee records: opaque ref, amount, rail, caller-supplied duplicate key. ---
  const recordsIn = Array.isArray(pp.payee_records) ? pp.payee_records : [];
  const per_payee_limit_minor_units = toLimitOrNull(pp.per_payee_limit_minor_units, 'per_payee_limit_minor_units', rejected_inputs);
  const per_run_limit_minor_units = toLimitOrNull(pp.per_run_limit_minor_units, 'per_run_limit_minor_units', rejected_inputs);

  // OPTIONAL, applies to every payee_records[].duplicate_key in this run (SPEC.md §25.0-§25.2,
  // see the file banner). Absent -- exactly today's behaviour: duplicate_key is an opaque token,
  // nothing declared private, byte-identical output for every pre-existing caller. Declared ->
  // sha256-salted@1 is the sole accepted scheme; any other name, or a duplicate_key that is not a
  // well-formed sha256:<64-hex> commitment, is REJECTED and excluded rather than trusted as opaque.
  const declaredScheme = isNonEmptyString(pp.duplicate_key_commitment_scheme) ? pp.duplicate_key_commitment_scheme.trim() : null;
  const schemeKnown = declaredScheme === null || declaredScheme === SHA256_SALTED_SCHEME;
  if (declaredScheme !== null && !schemeKnown) {
    rejected_inputs.push({ where: 'duplicate_key_commitment_scheme', reason: `unknown commitment scheme -- "${SHA256_SALTED_SCHEME}" is the sole scheme accepted (SPEC.md §25.1); every declared duplicate_key in this run is excluded rather than trusted as opaque`, supplied: declaredScheme });
  }

  const records = recordsIn.map((r, i) => {
    r = r && typeof r === 'object' ? r : {};
    const payee_ref = isNonEmptyString(r.payee_ref) ? r.payee_ref.trim() : `UNLABELLED-${i + 1}`;
    if (!isNonEmptyString(r.payee_ref)) rejected_inputs.push({ where: `payee_records[${i}].payee_ref`, reason: 'absent', supplied: null });
    const amount_minor_units = toMinorUnits(r.amount_minor_units, `payee_records[${i}].amount_minor_units`, rejected_inputs);
    const rail = isNonEmptyString(r.rail) ? r.rail.trim() : 'unspecified';
    let duplicate_key = isNonEmptyString(r.duplicate_key) ? r.duplicate_key.trim() : null;
    let is_private_input_commitment = false;
    if (duplicate_key && declaredScheme !== null) {
      if (!schemeKnown) {
        rejected_inputs.push({ where: `payee_records[${i}].duplicate_key`, reason: `declared duplicate_key_commitment_scheme "${declaredScheme}" is not a known commitment scheme`, supplied: duplicate_key });
        duplicate_key = null;
      } else if (!SHA256_COMMITMENT_RE.test(duplicate_key)) {
        rejected_inputs.push({ where: `payee_records[${i}].duplicate_key`, reason: `declared commitment_scheme "${SHA256_SALTED_SCHEME}" but the value is not a well-formed sha256: commitment (^sha256:[0-9a-f]{64}$)`, supplied: duplicate_key });
        duplicate_key = null;
      } else {
        is_private_input_commitment = true;
      }
    }
    // §10.2 item 1 -- optional per-record destination-tier cap. Absence disables the
    // check for this record rather than faking a value (same convention as toLimitOrNull).
    const destination_tier_limit_minor_units = toLimitOrNull(r.destination_tier_limit_minor_units, `payee_records[${i}].destination_tier_limit_minor_units`, rejected_inputs);
    return { payee_ref, amount_minor_units, amount_display: display(amount_minor_units), rail, duplicate_key, is_private_input_commitment, destination_tier_limit_minor_units };
  });

  // §25.0 declaration -- one entry per accepted commitment, pointer indexed to this record's
  // position in policy_parameters.payee_records. Hash-excluded (attached in buildArtifact, after
  // executionHash runs); zero entries is the common case and byte-identical to today's artifact.
  const private_input_candidates = [];
  records.forEach((r, i) => {
    if (r.is_private_input_commitment) {
      private_input_candidates.push({ pointer: `/payee_records/${i}/duplicate_key`, commitment: r.duplicate_key, commitment_scheme: SHA256_SALTED_SCHEME });
    }
  });

  const reconciled_record_count = records.length;
  const reconciled_total_minor_units = records.reduce((a, r) => a + r.amount_minor_units, 0);
  const count_break = reconciled_record_count - authorized_payee_count;
  const value_break_minor_units = reconciled_total_minor_units - authorized_total_minor_units;
  const control_total_reconciled = count_break === 0 && value_break_minor_units === 0;

  // --- Declared exclusions (echoed, never used to net the control total silently). ---
  const exclusionsIn = Array.isArray(pp.declared_exclusions) ? pp.declared_exclusions : [];
  const declared_exclusions = exclusionsIn.map((e, i) => {
    e = e && typeof e === 'object' ? e : {};
    const payee_ref = isNonEmptyString(e.payee_ref) ? e.payee_ref.trim() : `UNLABELLED-EXCLUSION-${i + 1}`;
    const reason_code = isNonEmptyString(e.reason_code) ? e.reason_code.trim() : null;
    if (!reason_code) rejected_inputs.push({ where: `declared_exclusions[${i}].reason_code`, reason: 'absent', supplied: null });
    return { payee_ref, reason_code: reason_code || 'unclassified' };
  });

  // --- Duplicate-candidate clusters, grouped by the caller's opaque duplicate_key. ---
  const byDupKey = new Map();
  for (const r of records) {
    if (!r.duplicate_key) continue;
    if (!byDupKey.has(r.duplicate_key)) byDupKey.set(r.duplicate_key, []);
    byDupKey.get(r.duplicate_key).push(r.payee_ref);
  }
  const duplicate_candidate_clusters = [];
  for (const [duplicate_key, payee_refs] of byDupKey.entries()) {
    if (payee_refs.length > 1) duplicate_candidate_clusters.push({ duplicate_key, payee_refs, member_count: payee_refs.length });
  }

  // --- Per-payee grouping: limit breaches (single payment) and split-candidates
  //     (multiple sub-limit payments to one ref summing past the per-payee limit). ---
  const byPayee = new Map();
  for (const r of records) {
    if (!byPayee.has(r.payee_ref)) byPayee.set(r.payee_ref, []);
    byPayee.get(r.payee_ref).push(r);
  }
  const limit_breaches = [];
  const split_payment_candidates = [];
  if (per_payee_limit_minor_units !== null) {
    for (const [payee_ref, group] of byPayee.entries()) {
      const total = group.reduce((a, r) => a + r.amount_minor_units, 0);
      const anySingleOverLimit = group.some((r) => r.amount_minor_units > per_payee_limit_minor_units);
      if (anySingleOverLimit) {
        limit_breaches.push({ payee_ref, kind: 'single_payment_over_limit', amount_minor_units: total, amount_display: display(total), limit_minor_units: per_payee_limit_minor_units });
      } else if (group.length > 1 && total > per_payee_limit_minor_units) {
        split_payment_candidates.push({ payee_ref, payment_count: group.length, total_minor_units: total, total_display: display(total), limit_minor_units: per_payee_limit_minor_units });
      }
    }
  }
  let per_run_limit_breach = null;
  if (per_run_limit_minor_units !== null && reconciled_total_minor_units > per_run_limit_minor_units) {
    per_run_limit_breach = { kind: 'run_total_over_limit', total_minor_units: reconciled_total_minor_units, total_display: display(reconciled_total_minor_units), limit_minor_units: per_run_limit_minor_units };
  }
  const has_limit_breach = limit_breaches.length > 0 || per_run_limit_breach !== null;

  // --- Destination-tier cap breaches (§10.2 item 1) -- a RECEIVING-side cap, distinct
  //     from the sender-side limit_breaches above. Where a payee's records disagree on
  //     the declared cap, the lowest declared value is the binding constraint. ---
  const destination_cap_breaches = [];
  for (const [payee_ref, group] of byPayee.entries()) {
    const declaredCaps = group.map((r) => r.destination_tier_limit_minor_units).filter((v) => v !== null);
    if (declaredCaps.length === 0) continue;
    const destination_tier_limit_minor_units = Math.min(...declaredCaps);
    const total = group.reduce((a, r) => a + r.amount_minor_units, 0);
    if (total > destination_tier_limit_minor_units) {
      destination_cap_breaches.push({ payee_ref, kind: 'destination_cap_breach', amount_minor_units: total, amount_display: display(total), destination_tier_limit_minor_units });
    }
  }
  const has_destination_cap_breach = destination_cap_breaches.length > 0;

  // --- Roster movement vs the prior run's payee-ref summary. ABSENCE-INSTRUMENT rule. ---
  const priorInputPresent = pp.prior_run_payee_refs !== undefined && pp.prior_run_payee_refs !== null;
  const priorRoster = priorInputPresent && Array.isArray(pp.prior_run_payee_refs) ? pp.prior_run_payee_refs.filter(isNonEmptyString).map((s) => s.trim()) : [];
  if (priorInputPresent && !Array.isArray(pp.prior_run_payee_refs)) {
    rejected_inputs.push({ where: 'prior_run_payee_refs', reason: 'present but not an array', supplied: typeof pp.prior_run_payee_refs });
  }
  const roster_movement_verifiable = priorInputPresent;
  const currentRefs = new Set(records.map((r) => r.payee_ref));
  const priorRefs = new Set(priorRoster);
  const new_this_run = roster_movement_verifiable ? [...currentRefs].filter((ref) => !priorRefs.has(ref)) : [];
  const absent_this_run = roster_movement_verifiable ? [...priorRefs].filter((ref) => !currentRefs.has(ref)) : [];
  const has_roster_movement = roster_movement_verifiable && (new_this_run.length > 0 || absent_this_run.length > 0);

  const compliance_flags = [];
  compliance_flags.push(control_total_reconciled ? 'DISB_RECONCILED' : 'DISB_CONTROL_TOTAL_BREAK');
  if (duplicate_candidate_clusters.length > 0) compliance_flags.push('DISB_DUPLICATE_CANDIDATE');
  if (has_limit_breach) compliance_flags.push('DISB_LIMIT_BREACH');
  if (has_destination_cap_breach) compliance_flags.push('DISB_DESTINATION_CAP_BREACH');
  if (split_payment_candidates.length > 0) compliance_flags.push('DISB_SPLIT_CANDIDATE');
  if (has_roster_movement) compliance_flags.push('DISB_ROSTER_MOVEMENT');
  if (rejected_inputs.length > 0) compliance_flags.push('DISB_INPUTS_REJECTED');

  const rationale = [];
  rationale.push(`Authorized: ${authorized_payee_count} payees, ${display(authorized_total_minor_units)} ${currency}. Run records: ${reconciled_record_count} payees, ${display(reconciled_total_minor_units)} ${currency}.`);
  rationale.push(control_total_reconciled
    ? 'Run reconciles to the authorized control total in both count and value.'
    : `Run does NOT reconcile: count break ${count_break}, value break ${display(value_break_minor_units)} ${currency}.`);
  rationale.push(duplicate_candidate_clusters.length > 0
    ? `${duplicate_candidate_clusters.length} duplicate-candidate cluster(s) share a caller-declared key. These are candidates for review, not findings of fraud or duplication -- shared keys can be legitimate.`
    : 'No payee records share a caller-declared duplicate-candidate key.');
  rationale.push(split_payment_candidates.length > 0
    ? `${split_payment_candidates.length} payee(s) received multiple sub-limit payments summing past the declared per-payee limit. This is a candidate for review, not a finding -- a split can be a corrected underpayment.`
    : 'No payee received multiple sub-limit payments summing past the declared per-payee limit.');
  rationale.push(has_destination_cap_breach
    ? `${destination_cap_breaches.length} payee(s) exceed a declared destination-tier balance cap -- the payment is authorized and funded but cannot land at the receiving wallet's current tier.`
    : 'No payee exceeds a declared destination-tier balance cap.');
  rationale.push(roster_movement_verifiable
    ? `Roster compared against ${priorRoster.length} prior-run payee ref(s): ${new_this_run.length} new this run, ${absent_this_run.length} absent this run. This is movement to be explained, not an accusation.`
    : 'Prior-run payee roster was not supplied, so roster movement cannot be evaluated this cycle. This is reported as unverifiable, never as a clean result.');
  rationale.push('This is an arithmetic attestation over the figures supplied for this run. It does not itself investigate any payee, and no flag here is a determination of fraud, misconduct, or an ineligible beneficiary.');

  const output_payload = {
    run_reference, as_of, currency,
    authorized_payee_count, authorized_total_minor_units, authorized_total_display: display(authorized_total_minor_units),
    reconciled_record_count, reconciled_total_minor_units, reconciled_total_display: display(reconciled_total_minor_units),
    count_break, value_break_minor_units, value_break_display: display(value_break_minor_units),
    control_total_reconciled,
    declared_exclusions,
    duplicate_candidate_cluster_count: duplicate_candidate_clusters.length,
    duplicate_candidate_clusters,
    per_payee_limit_minor_units, per_run_limit_minor_units,
    limit_breaches, per_run_limit_breach, has_limit_breach,
    destination_cap_breaches, has_destination_cap_breach,
    split_payment_candidates,
    roster_movement_verifiable,
    prior_run_payee_count: priorRoster.length,
    new_this_run, absent_this_run,
    has_roster_movement,
    rejected_inputs, rationale,
    note: 'Deterministic bulk disbursement integrity attestation over a caller-supplied authorization, per-payee record set, declared exclusions, and prior-run roster. Attests control-total reconciliation in count and value, surfaces duplicate-candidate clusters and split-payment candidates by the caller\'s own opaque keys, and reports roster movement -- all as candidates and observations for a human reviewer, never as findings of fraud, misconduct, or ineligible beneficiaries.',
  };

  return { output_payload, compliance_flags, private_input_candidates };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags, private_input_candidates } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  const artifact = {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
  // §25.0 -- attached AFTER executionHash, hash-excluded by construction (SPEC.md §25.0/§25.6).
  // Zero candidates (every pre-existing caller) omits the field entirely, not an empty array --
  // matches the other §20/§23/§25 optional declarations already in this envelope.
  if (private_input_candidates.length > 0) artifact.private_inputs = private_input_candidates;
  return artifact;
}
