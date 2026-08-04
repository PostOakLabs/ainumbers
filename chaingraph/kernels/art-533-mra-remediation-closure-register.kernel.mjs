/**
 * art-533-mra-remediation-closure-register.kernel.mjs
 * BILLABLES-WAVE2-BUILD-SPEC.md §1 (Family a, headline gap) — consent-order / MRA
 * remediation closure register.
 *
 * Ingests a caller-declared issue/commitment set (each a consent-order Article or MRA
 * finding: a §25-salted issue id, plain commitment text, a committed date, and a
 * milestone list each naming its own required evidence type) plus a remediation-status
 * feed (per milestone: a closure date and the evidence actually delivered). Computes,
 * per issue:
 *   - milestone completeness -- every committed milestone closed WITH evidence attached
 *     (the C completeness dimension, GAO-25-107721 §10.18);
 *   - evidence validity -- each closed milestone's delivered evidence_type matches what
 *     the milestone itself declares it calls for (the V validity dimension);
 *   - overdue/on-track timing against the issue's own committed_date, evaluated at one
 *     declared evaluated_at moment (the A accuracy-of-schedule dimension, reusing
 *     art-491-ro-remediation-closure.kernel.mjs's cutoff-vs-evaluated arithmetic
 *     unchanged -- see that kernel's compute() for the pattern this retargets).
 *
 * Per-issue interim state is a sibling field (`open`/`closed`/`overdue`, exactly
 * art-491's shape, retained as-is since it precedes the gate). The ROLLUP that reaches
 * the gate emits SPEC.md §27.4's closed enum, at /decision/gate_policy (aggregate) and
 * at /determinations/{i}/decision (per issue): all milestones closed + evidence valid
 * ⇒ auto_pass; a caller-declared root_cause_identified:false flag ⇒ hold (checked
 * first -- an unidentified root cause holds regardless of milestone state); any
 * still-open item past its committed_date + the declared grace window ⇒ escalate;
 * everything else not-yet-fully-closed (open, or closed with missing/invalid evidence,
 * or overdue but still inside the grace window) ⇒ review_required. No supervisory
 * judgment about whether remediation is "appropriate, timely, sustainably" done is made
 * here -- that judgment is the named human's §27 approval record (BILLABLES-WAVE2-
 * BUILD-SPEC.md §2); this kernel supplies the arithmetic the judgment rests on.
 *
 * Reused from art-491 (do not re-derive): per-item closure_status, resubmission-style
 * linkage generalized here to evidence-satisfies-milestone linkage, closure-coverage
 * roll-up, certification-period-style cut-off generalized to per-issue committed_date.
 * art-491's FATCA/CRS-specific fields are NOT copied -- this is a NEW node, not an edit
 * of art-491 (which stays untouched).
 *
 * ⛔⛔ SPEC.md §25 SALTED-COMMITMENT MANDATORY (not optional, unlike art-518's
 * backward-compatible opt-in). An MRA/consent-order issue id is a low-entropy
 * enumerable identifier -- a bare digest is barred by §25.1. `issue_id_commitment_
 * scheme` MUST be exactly "sha256-salted@1"; every `issue_id` (in `issues[]` and in
 * `remediation_status[]`, both places the value sits) MUST be a well-formed
 * `sha256:<64-hex>` commitment -- `"sha256:" + hex(SHA-256(salt || cgCanon(issue_id)))`
 * with a fresh >=256-bit CSPRNG salt the caller generates and retains; the salt is
 * never sent to this kernel and never appears in the artifact. If the scheme is absent
 * or wrong while issues were declared, the run cannot process any issue at all and
 * emits execution_state "did_not_run" (a genuine kill condition, not a routed
 * decision) rather than silently trusting an unsalted or wrongly-scoped identifier. A
 * per-issue issue_id that is not a well-formed commitment is excluded from
 * determinations and recorded in `rejected_inputs`, never silently dropped. Accepted
 * commitments are declared in the artifact's top-level `private_inputs[]` (§25.0), one
 * entry per pointer where the commitment literal actually sits, attached in
 * buildArtifact() AFTER executionHash runs (hash-excluded by construction, §25.2/§25.6).
 *
 * ⛔ PII: this kernel accepts only issue/milestone/evidence identifiers, dates, and
 * plain commitment/description text -- no taxpayer, customer, or personal data of any
 * kind. Demo fixture ships SYNTHETIC data only (CONTRACT §1.3).
 *
 * FINITE GATE. An empty `issues[]` is a genuine vacuous pass (nothing committed, nothing
 * to escalate) -- execution_state "ran", decision "auto_pass" -- distinct from the
 * commitment-scheme kill condition above, which is a caller-input defect, not an empty
 * population. No branch can emit NaN, Infinity, or an undefined status.
 *
 * `overdue_grace_days` is policy input, never a default (art-525-nway-balance-closure-
 * check.kernel.mjs's tolerance-never-defaulted discipline, applied here to the grace
 * window): an unstated grace window would turn every day-one commitment into an
 * immediate escalation candidate the moment it is even slightly late.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute() (all timestamps
 * are caller-declared policy_parameters).
 *
 * Spec: BILLABLES-WAVE2-BUILD-SPEC.md §0 (adoption contract) + §1 (Family a, headline
 * gap).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-533-mra-remediation-closure-register';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'register_mra_remediation_closure', mandate_type: 'attestation_mandate', gpu: false };

const SHA256_SALTED_SCHEME = 'sha256-salted@1';
const SHA256_COMMITMENT_RE = /^sha256:[0-9a-f]{64}$/;
const GATE_SEVERITY = { hold: 4, escalate: 3, review_required: 2, auto_pass: 1 };

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function parseIsoOrNull(s) { if (s == null || s === '') return null; const t = Date.parse(s); return Number.isFinite(t) ? t : null; }
function isoOrNull(ms) { return ms == null ? null : new Date(ms).toISOString(); }
function isCommitment(v) { return typeof v === 'string' && SHA256_COMMITMENT_RE.test(v); }

const HA_NOTE = 'Not yet an approval record. A human reviewer/approver MAY later create a separate, signed approval record over this artifact\'s execution_hash + this issue_id; this kernel does not fabricate or reserve a mutable slot for that record inside its own hashed output.';

const NOTE = 'Deterministic consent-order/MRA remediation-closure register over a caller-declared issue/commitment set, milestone list, and remediation-status feed, evaluated against each issue\'s own committed_date. Reuses the art-491-ro-remediation-closure cutoff-vs-evaluated arithmetic unchanged, retargeted from a certification-period cut-off to a per-issue committed_date. This tool tracks closure and computes a routing decision only; it never itself determines that remediation was appropriate, timely, or sustainable -- that judgment is a named human\'s §27 approval record.';

function emptyResult(reason, extra, flags) {
  return {
    output_payload: {
      decision: { gate_policy: null, execution_state: 'did_not_run', reason },
      register_id: (extra && extra.register_id) || '',
      evaluated_at: (extra && extra.evaluated_at) || null,
      overdue_grace_days: (extra && typeof extra.overdue_grace_days === 'number') ? extra.overdue_grace_days : null,
      issue_count: 0,
      determinations: [],
      closed_count: 0, open_count: 0, overdue_count: 0,
      rejected_inputs: (extra && extra.rejected_inputs) || [],
      note: NOTE,
    },
    compliance_flags: flags,
    private_input_candidates: [],
  };
}

function evaluateMilestone(milestone, closureByKey) {
  const milestone_id = isNonEmptyString(milestone.milestone_id) ? milestone.milestone_id.trim() : '';
  const description = isNonEmptyString(milestone.description) ? milestone.description.trim() : '';
  const required_evidence_type = isNonEmptyString(milestone.required_evidence_type) ? milestone.required_evidence_type.trim() : '';

  const matches = (closureByKey.get(milestone_id) || [])
    .filter((r) => parseIsoOrNull(r.closed_at) != null)
    .sort((a, b) => parseIsoOrNull(a.closed_at) - parseIsoOrNull(b.closed_at));
  const closure = matches.length > 0 ? matches[0] : null;

  const evidence = closure && Array.isArray(closure.evidence) ? closure.evidence.filter((e) => e && typeof e === 'object') : [];
  const has_evidence = evidence.length > 0;
  const evidence_type_match = has_evidence && evidence.some((e) => isNonEmptyString(e.evidence_type) && e.evidence_type.trim() === required_evidence_type);

  let milestone_status;
  if (!closure) milestone_status = 'open';
  else if (!has_evidence) milestone_status = 'closed_missing_evidence';
  else if (!evidence_type_match) milestone_status = 'closed_invalid_evidence';
  else milestone_status = 'closed_valid_evidence';

  return {
    milestone_id, description, required_evidence_type,
    milestone_status,
    closed_at: closure ? isoOrNull(parseIsoOrNull(closure.closed_at)) : null,
    evidence: evidence.map((e) => ({ evidence_id: isNonEmptyString(e.evidence_id) ? e.evidence_id.trim() : null, evidence_type: isNonEmptyString(e.evidence_type) ? e.evidence_type.trim() : null })),
  };
}

export function compute(pp) {
  pp = pp || {};
  const register_id = isNonEmptyString(pp.register_id) ? pp.register_id.trim() : '';
  const evalMs = parseIsoOrNull(pp.evaluated_at);
  const rejected_inputs = [];

  const grace = pp.overdue_grace_days;
  const overdue_grace_days = (typeof grace === 'number' && Number.isFinite(grace) && Number.isInteger(grace) && grace >= 0) ? grace : null;
  if (overdue_grace_days === null) {
    rejected_inputs.push({ where: 'overdue_grace_days', reason: 'absent or not a non-negative integer -- a grace window must be declared, never defaulted', supplied: grace === undefined ? null : grace });
    return emptyResult('overdue_grace_days_not_declared', { register_id, evaluated_at: isoOrNull(evalMs), rejected_inputs }, ['MRA_CLOSURE_KILL_CONDITION_GRACE_DAYS_UNDECLARED']);
  }

  const issuesIn = Array.isArray(pp.issues) ? pp.issues : [];
  const remediationIn = Array.isArray(pp.remediation_status) ? pp.remediation_status : [];

  const declaredScheme = isNonEmptyString(pp.issue_id_commitment_scheme) ? pp.issue_id_commitment_scheme.trim() : null;
  const schemeOk = declaredScheme === SHA256_SALTED_SCHEME;
  if (issuesIn.length > 0 && !schemeOk) {
    rejected_inputs.push({ where: 'issue_id_commitment_scheme', reason: `must be exactly "${SHA256_SALTED_SCHEME}" (SPEC.md §25.1) -- an MRA/consent-order issue id is a low-entropy enumerable identifier and a bare digest is barred`, supplied: declaredScheme });
    return emptyResult('issue_id_commitment_scheme_missing_or_invalid', { register_id, evaluated_at: isoOrNull(evalMs), overdue_grace_days, rejected_inputs }, ['MRA_CLOSURE_KILL_CONDITION_COMMITMENT_SCHEME_INVALID']);
  }

  // Group remediation_status rows by issue_id commitment, then by milestone_id.
  const remediationByIssue = new Map();
  const private_input_candidates = [];
  remediationIn.forEach((r, i) => {
    r = r && typeof r === 'object' ? r : {};
    const issue_id = isNonEmptyString(r.issue_id) ? r.issue_id.trim() : '';
    if (!isCommitment(issue_id)) {
      rejected_inputs.push({ where: `remediation_status[${i}].issue_id`, reason: `not a well-formed ${SHA256_SALTED_SCHEME} commitment`, supplied: issue_id || null });
      return;
    }
    private_input_candidates.push({ pointer: `/remediation_status/${i}/issue_id`, commitment: issue_id, commitment_scheme: SHA256_SALTED_SCHEME });
    if (!remediationByIssue.has(issue_id)) remediationByIssue.set(issue_id, new Map());
    const byMilestone = remediationByIssue.get(issue_id);
    const milestone_id = isNonEmptyString(r.milestone_id) ? r.milestone_id.trim() : '';
    if (!byMilestone.has(milestone_id)) byMilestone.set(milestone_id, []);
    byMilestone.get(milestone_id).push(r);
  });

  const determinations = [];
  issuesIn.forEach((iss, i) => {
    iss = iss && typeof iss === 'object' ? iss : {};
    const issue_id = isNonEmptyString(iss.issue_id) ? iss.issue_id.trim() : '';
    if (!isCommitment(issue_id)) {
      rejected_inputs.push({ where: `issues[${i}].issue_id`, reason: `not a well-formed ${SHA256_SALTED_SCHEME} commitment`, supplied: issue_id || null });
      return;
    }
    private_input_candidates.push({ pointer: `/issues/${i}/issue_id`, commitment: issue_id, commitment_scheme: SHA256_SALTED_SCHEME });

    const commitment_text = isNonEmptyString(iss.commitment_text) ? iss.commitment_text.trim() : '';
    const committedMs = parseIsoOrNull(iss.committed_date);
    const milestonesIn = Array.isArray(iss.milestones) ? iss.milestones : [];
    const closureByKey = remediationByIssue.get(issue_id) || new Map();
    const milestones = milestonesIn.map((m) => evaluateMilestone(m || {}, closureByKey));

    const milestones_total = milestones.length;
    const milestones_valid_count = milestones.filter((m) => m.milestone_status === 'closed_valid_evidence').length;
    const all_milestones_valid = milestones_total > 0 && milestones_valid_count === milestones_total;

    const overdue = !all_milestones_valid && committedMs != null && evalMs != null && evalMs > committedMs;
    const overdue_days = overdue ? Math.floor((evalMs - committedMs) / 86400000) : 0;
    const past_grace = overdue && overdue_days > overdue_grace_days;

    const closure_status = all_milestones_valid ? 'closed' : (overdue ? 'overdue' : 'open');

    const root_cause_identified = typeof iss.root_cause_identified === 'boolean' ? iss.root_cause_identified : true;

    let gate_policy;
    if (root_cause_identified === false) gate_policy = 'hold';
    else if (closure_status === 'closed') gate_policy = 'auto_pass';
    else if (past_grace) gate_policy = 'escalate';
    else gate_policy = 'review_required';

    determinations.push({
      issue_id, commitment_text, committed_date: isoOrNull(committedMs),
      milestones_total, milestones_valid_count, milestones,
      closure_status, overdue_days, root_cause_identified,
      decision: gate_policy,
      ha_note: HA_NOTE,
    });
  });

  const closed_count = determinations.filter((d) => d.closure_status === 'closed').length;
  const overdue_count = determinations.filter((d) => d.closure_status === 'overdue').length;
  const open_count = determinations.filter((d) => d.closure_status === 'open').length;

  const rollup_gate_policy = determinations.length === 0
    ? 'auto_pass'
    : determinations.reduce((worst, d) => (GATE_SEVERITY[d.decision] > GATE_SEVERITY[worst] ? d.decision : worst), 'auto_pass');

  const compliance_flags = ['MRA_CLOSURE_REGISTER_EVALUATED'];
  if (determinations.some((d) => d.decision === 'hold')) compliance_flags.push('MRA_CLOSURE_ISSUE_HOLD_PRESENT');
  if (determinations.some((d) => d.decision === 'escalate')) compliance_flags.push('MRA_CLOSURE_ISSUE_ESCALATE_PRESENT');
  if (determinations.some((d) => d.decision === 'review_required')) compliance_flags.push('MRA_CLOSURE_ISSUE_REVIEW_REQUIRED_PRESENT');
  if (determinations.length > 0 && rollup_gate_policy === 'auto_pass') compliance_flags.push('MRA_CLOSURE_ALL_ISSUES_CLOSED');
  if (rejected_inputs.length > 0) compliance_flags.push('MRA_CLOSURE_INPUTS_REJECTED');

  const output_payload = {
    decision: { gate_policy: rollup_gate_policy, execution_state: 'ran', reason: null },
    register_id,
    evaluated_at: isoOrNull(evalMs),
    overdue_grace_days,
    issue_count: determinations.length,
    determinations,
    closed_count, open_count, overdue_count,
    rejected_inputs,
    note: NOTE,
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
  if (private_input_candidates.length > 0) artifact.private_inputs = private_input_candidates;
  return artifact;
}
