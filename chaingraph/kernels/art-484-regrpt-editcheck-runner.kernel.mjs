/**
 * art-484-regrpt-editcheck-runner.kernel.mjs
 * Assurance Waves program (REGRPT-EDITCHECK-BUILD-SPEC.md §1, RGEC-K-1) — published
 * regulatory-report edit-check EVALUATOR.
 *
 * FFIEC publishes validity and quality edit-check criteria (Excel + PDF) ahead of each
 * quarter-end Call Report submission cycle; the EBA publishes an analogous ITS validation-rules
 * list for its taxonomies. Both rule sets are freely downloadable — no Reporting Central /
 * FR Y-14 access gate stands between a filer (or a stranger evaluating a sample instance) and a
 * result (REGRPT-EDITCHECK-BUILD-SPEC.md §0 adoption contract).
 *
 * DELIBERATE SCOPE LIMIT — THE KERNEL IS THE EVALUATOR, NEVER A RULE LIBRARY. Unlike
 * art-434-call-report-edit-check-gate (a CURATED, HARDCODED battery of ~10 checks against the
 * specific art-432/art-433 Schedule RC/RC-R output shape), this kernel bakes in NO rule content
 * at all. Every rule — its published edit id, its type, its operands, its tolerance — arrives as
 * `policy_parameters.rule_set`, exactly as a filer would paste in that quarter's published
 * criteria file. The kernel only knows HOW to evaluate seven rule shapes (arithmetic identity,
 * cross-schedule tie-out, sign/domain constraint, mandatory-field completeness, closed-domain
 * membership, conditional presence, conditional prohibition) against a
 * caller-supplied report instance's cell values. A rule set baked into kernel source is a build
 * defect per the spec's kill-criteria — rule sets version every cycle.
 *
 * F3 (suppression is first-class): the EBA publishes rules DEACTIVATED for inaccuracies or IT
 * issues, with deactivation scripts. Running a stood-down rule and reporting a failure the
 * regulator itself switched off is the fastest way to lose a user's trust. `policy_parameters
 * .suppressions` (an array of `{edit_id, reason}`) is evaluated BEFORE any rule executes; a
 * suppressed rule is never run, its status is "suppressed", and the artifact records exactly
 * which suppressions were applied plus which never matched a rule (so a stale suppression list
 * is visible, not silent).
 *
 * Rule types evaluated (each keyed by `edit_id`, the published FFIEC/EBA identifier):
 *   - arithmetic_identity: sum(component_refs' values) == target_ref's value, within tolerance.
 *   - cross_schedule_tie_out: ref_a's value == ref_b's value, within tolerance (same figure must
 *     agree across two schedules/templates).
 *   - sign_domain: ref's value satisfies a domain constraint (non_negative / non_positive / range).
 *   - mandatory_field: ref must be present (declared in the instance) and non-null/non-empty.
 *   - enum_membership: ref's value is a member of the rule's `allowed_values`, optionally only
 *     when a `when` predicate over other refs in the same row holds.
 *   - conditional_required: ref must be present and non-empty WHEN the `when` predicate holds.
 *     Distinct from mandatory_field, which is unconditional.
 *   - conditional_prohibited: ref's value must NOT be a member of `forbidden_values` when the
 *     `when` predicate holds.
 *
 * THE `when` PREDICATE (FR2052A-DEPTH-BUILD-SPEC.md §3.1). A predicate reads other cell refs in
 * the SAME caller-supplied instance and nothing else. Leaf form `{ref, op, value|values}` with
 * op in {equals, not_equals, in, not_in, present, absent, non_empty, empty, gt, gte, lt, lte};
 * composite forms `{all_of:[...]}`, `{any_of:[...]}`, `{not:{...}}`, nested to MAX_WHEN_DEPTH.
 * The three conditional shapes are generic, not FR 2052a-specific: FFIEC validity edits and EBA
 * ITS validation rules both express conditional presence and closed-domain membership, which is
 * why they extend this evaluator rather than forking a second one.
 *
 * A predicate that CANNOT BE EVALUATED because the RULE is malformed (no `ref`, unknown `op`, a
 * non-finite bound on a numeric comparison, an empty all_of/any_of, nesting past the depth limit)
 * is a rule-configuration defect: the finding fails and RULE_PREDICATE_INVALID is flagged. A
 * predicate that is well-formed but does not hold against the supplied DATA is not a defect --
 * the rule is simply not applicable to that row, and the finding passes with a message saying so.
 * Per-finding status stays exactly {pass, fail, suppressed}; this kernel mints no new vocabulary.
 *
 * C-A-V (GAO Completeness / Accuracy / Validity) is a classification OF THE RULE TYPE, not a new
 * status field. CAV_BY_RULE_TYPE below carries the full seven-type mapping. It is EMITTED on
 * findings from the three conditional shapes only: the four shapes above shipped with a proven
 * groth16 receipt, and adding a field to their findings would move their output payload. A later
 * deliberate hash-moving row may widen emission to all seven; until then the mapping is complete
 * in source and the emitted subset is the additive half.
 *
 * Zero PII — cell values are structural report figures (dollar amounts, ratios, counts), not
 * personal data. Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: REGRPT-EDITCHECK-BUILD-SPEC.md §1 (RGEC-K-1, art-484). Findings:
 * ASSURANCE-WAVE2-ADOPTION-FINDINGS-2026-07-27.md F2/F3.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-484-regrpt-editcheck-runner';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'run_regrpt_edit_checks', mandate_type: 'regulatory_reporting', gpu: false };

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function isFiniteNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function normArray(v) { return Array.isArray(v) ? v : []; }

function buildCellMap(cells) {
  const map = new Map();
  for (const c of cells) {
    if (!c || typeof c !== 'object') continue;
    const ref = safeStr(c.cell_ref);
    if (!ref) continue;
    map.set(ref, { value: c.value, schedule: safeStr(c.schedule) || null, line_item: safeStr(c.line_item) || null });
  }
  return map;
}

function cellValue(cellMap, ref) {
  const cell = cellMap.get(ref);
  return cell ? cell.value : undefined;
}

function evalArithmeticIdentity(rule, cellMap) {
  const componentRefs = normArray(rule.component_refs).map(safeStr).filter(Boolean);
  const targetRef = safeStr(rule.target_ref);
  const tolerance = isFiniteNum(rule.tolerance) ? Math.abs(rule.tolerance) : 0;
  const missing = [...componentRefs, targetRef].filter((r) => !cellMap.has(r));
  if (missing.length > 0) {
    return { status: 'fail', computed_value: null, reported_value: null, message: `Missing cell reference(s) in report instance: ${missing.join(', ')}.` };
  }
  let sum = 0;
  for (const r of componentRefs) {
    const v = cellValue(cellMap, r);
    if (!isFiniteNum(v)) return { status: 'fail', computed_value: null, reported_value: null, message: `Component ${r} is not a finite numeric value.` };
    sum += v;
  }
  const reported = cellValue(cellMap, targetRef);
  if (!isFiniteNum(reported)) return { status: 'fail', computed_value: sum, reported_value: null, message: `Target ${targetRef} is not a finite numeric value.` };
  const diff = Math.abs(sum - reported);
  const pass = diff <= tolerance;
  return {
    status: pass ? 'pass' : 'fail',
    computed_value: sum,
    reported_value: reported,
    message: pass
      ? `Sum of ${componentRefs.join(' + ')} agrees with ${targetRef} within tolerance ${tolerance}.`
      : `Sum of ${componentRefs.join(' + ')} = ${sum} disagrees with reported ${targetRef} = ${reported} (difference ${diff.toFixed(6)} exceeds tolerance ${tolerance}).`,
  };
}

function evalCrossScheduleTieOut(rule, cellMap) {
  const refA = safeStr(rule.ref_a);
  const refB = safeStr(rule.ref_b);
  const tolerance = isFiniteNum(rule.tolerance) ? Math.abs(rule.tolerance) : 0;
  const missing = [refA, refB].filter((r) => !cellMap.has(r));
  if (missing.length > 0) {
    return { status: 'fail', computed_value: null, reported_value: null, message: `Missing cell reference(s) in report instance: ${missing.join(', ')}.` };
  }
  const a = cellValue(cellMap, refA);
  const b = cellValue(cellMap, refB);
  if (!isFiniteNum(a) || !isFiniteNum(b)) return { status: 'fail', computed_value: null, reported_value: null, message: `${refA} and/or ${refB} is not a finite numeric value.` };
  const diff = Math.abs(a - b);
  const pass = diff <= tolerance;
  return {
    status: pass ? 'pass' : 'fail',
    computed_value: a,
    reported_value: b,
    message: pass
      ? `${refA} (${a}) ties out to ${refB} (${b}) within tolerance ${tolerance}.`
      : `${refA} (${a}) disagrees with ${refB} (${b}); difference ${diff.toFixed(6)} exceeds tolerance ${tolerance}.`,
  };
}

function evalSignDomain(rule, cellMap) {
  const ref = safeStr(rule.ref);
  const domain = safeStr(rule.domain);
  if (!cellMap.has(ref)) return { status: 'fail', computed_value: null, reported_value: null, message: `Missing cell reference in report instance: ${ref}.` };
  const v = cellValue(cellMap, ref);
  if (!isFiniteNum(v)) return { status: 'fail', computed_value: null, reported_value: v ?? null, message: `${ref} is not a finite numeric value.` };
  let pass; let domainDesc;
  if (domain === 'non_negative') { pass = v >= 0; domainDesc = '>= 0'; }
  else if (domain === 'non_positive') { pass = v <= 0; domainDesc = '<= 0'; }
  else if (domain === 'positive') { pass = v > 0; domainDesc = '> 0'; }
  else if (domain === 'range') {
    const min = isFiniteNum(rule.min) ? rule.min : -Infinity;
    const max = isFiniteNum(rule.max) ? rule.max : Infinity;
    pass = v >= min && v <= max;
    domainDesc = `in [${rule.min ?? '-inf'}, ${rule.max ?? '+inf'}]`;
  } else {
    return { status: 'fail', computed_value: v, reported_value: v, message: `Unknown domain "${domain}" for rule.` };
  }
  return {
    status: pass ? 'pass' : 'fail',
    computed_value: v,
    reported_value: v,
    message: pass ? `${ref} (${v}) satisfies domain ${domainDesc}.` : `${ref} (${v}) violates domain ${domainDesc}.`,
  };
}

function evalMandatoryField(rule, cellMap) {
  const ref = safeStr(rule.ref);
  const present = cellMap.has(ref);
  if (!present) return { status: 'fail', computed_value: null, reported_value: null, message: `${ref} is not present in the report instance.` };
  const v = cellValue(cellMap, ref);
  const isEmpty = v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  return {
    status: isEmpty ? 'fail' : 'pass',
    computed_value: null,
    reported_value: v ?? null,
    message: isEmpty ? `${ref} is present but empty/null.` : `${ref} is present and non-empty.`,
  };
}

// --- Conditional rule shapes (FR2052A-DEPTH-BUILD-SPEC.md §3.1) --------------------------------

// GAO Completeness / Accuracy / Validity, keyed by rule type. Complete for all seven shapes; see
// the header for why only the three conditional shapes emit it on their findings today.
const CAV_BY_RULE_TYPE = {
  mandatory_field: 'completeness',
  conditional_required: 'completeness',
  arithmetic_identity: 'accuracy',
  cross_schedule_tie_out: 'accuracy',
  sign_domain: 'validity',
  enum_membership: 'validity',
  conditional_prohibited: 'validity',
};

const MAX_WHEN_DEPTH = 8;

function isEmptyVal(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

// Deterministic rendering of a cell/rule value for finding messages.
function fmtVal(v) {
  if (v === undefined) return 'absent';
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

// Value equality for closed-domain membership. Strings compare trimmed and case-sensitive;
// everything else compares strictly. Deliberately NO cross-type coercion -- silently matching the
// number 3 against the published code "3" would hide a genuine type defect in the instance.
function sameValue(a, b) {
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();
  return a === b;
}

function listVals(arr) { return arr.map(fmtVal).join(', '); }

// Evaluate a `when` predicate against the same row's cells.
// Returns { ok, holds, desc }: ok=false means the RULE is malformed (a configuration defect);
// ok=true with holds=false means the rule is well-formed and simply not applicable to this row.
function evalWhen(when, cellMap, depth) {
  if (depth > MAX_WHEN_DEPTH) return { ok: false, holds: false, desc: `predicate nests deeper than ${MAX_WHEN_DEPTH}` };
  if (!when || typeof when !== 'object' || Array.isArray(when)) return { ok: false, holds: false, desc: 'predicate is not an object' };

  if (Array.isArray(when.all_of)) {
    if (when.all_of.length === 0) return { ok: false, holds: false, desc: 'all_of is empty' };
    const parts = [];
    let holds = true;
    for (const sub of when.all_of) {
      const r = evalWhen(sub, cellMap, depth + 1);
      if (!r.ok) return { ok: false, holds: false, desc: r.desc };
      parts.push(r.desc);
      if (!r.holds) holds = false;
    }
    return { ok: true, holds, desc: `all of (${parts.join('; ')})` };
  }

  if (Array.isArray(when.any_of)) {
    if (when.any_of.length === 0) return { ok: false, holds: false, desc: 'any_of is empty' };
    const parts = [];
    let holds = false;
    for (const sub of when.any_of) {
      const r = evalWhen(sub, cellMap, depth + 1);
      if (!r.ok) return { ok: false, holds: false, desc: r.desc };
      parts.push(r.desc);
      if (r.holds) holds = true;
    }
    return { ok: true, holds, desc: `any of (${parts.join('; ')})` };
  }

  if (when.not !== undefined) {
    const r = evalWhen(when.not, cellMap, depth + 1);
    if (!r.ok) return { ok: false, holds: false, desc: r.desc };
    return { ok: true, holds: !r.holds, desc: `not (${r.desc})` };
  }

  const ref = safeStr(when.ref);
  const op = safeStr(when.op);
  if (!ref) return { ok: false, holds: false, desc: 'predicate is missing "ref"' };
  const present = cellMap.has(ref);
  const v = cellValue(cellMap, ref);

  if (op === 'present') return { ok: true, holds: present, desc: `${ref} is present` };
  if (op === 'absent') return { ok: true, holds: !present, desc: `${ref} is absent` };
  if (op === 'non_empty') return { ok: true, holds: present && !isEmptyVal(v), desc: `${ref} is present and non-empty` };
  if (op === 'empty') return { ok: true, holds: !present || isEmptyVal(v), desc: `${ref} is absent or empty` };

  if (op === 'equals' || op === 'not_equals') {
    if (!('value' in when)) return { ok: false, holds: false, desc: `predicate on ${ref} with op "${op}" is missing "value"` };
    const hit = present && sameValue(v, when.value);
    return { ok: true, holds: op === 'equals' ? hit : !hit, desc: `${ref} ${op === 'equals' ? '==' : '!='} ${fmtVal(when.value)}` };
  }

  if (op === 'in' || op === 'not_in') {
    const values = normArray(when.values);
    if (values.length === 0) return { ok: false, holds: false, desc: `predicate on ${ref} with op "${op}" has no "values"` };
    let hit = false;
    if (present) { for (const cand of values) { if (sameValue(v, cand)) { hit = true; break; } } }
    return { ok: true, holds: op === 'in' ? hit : !hit, desc: `${ref} ${op === 'in' ? 'in' : 'not in'} [${listVals(values)}]` };
  }

  if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') {
    if (!isFiniteNum(when.value)) return { ok: false, holds: false, desc: `predicate on ${ref} with op "${op}" has a non-finite "value"` };
    // A non-numeric or absent cell makes the comparison FALSE, not malformed: that is data, not
    // a defect in the published rule.
    let holds = false;
    if (isFiniteNum(v)) {
      if (op === 'gt') holds = v > when.value;
      else if (op === 'gte') holds = v >= when.value;
      else if (op === 'lt') holds = v < when.value;
      else holds = v <= when.value;
    }
    const sym = op === 'gt' ? '>' : op === 'gte' ? '>=' : op === 'lt' ? '<' : '<=';
    return { ok: true, holds, desc: `${ref} ${sym} ${when.value}` };
  }

  return { ok: false, holds: false, desc: `unknown predicate op "${op}"` };
}

// conditional_required / conditional_prohibited: the predicate is the whole point, so its absence
// is a rule defect. enum_membership: the predicate is optional (§3.1 "optionally conditioned").
function whenRequired(rule, cellMap) {
  if (rule.when === undefined || rule.when === null) return { ok: false, holds: false, desc: 'rule declares no "when" predicate' };
  return evalWhen(rule.when, cellMap, 0);
}
function whenOptional(rule, cellMap) {
  if (rule.when === undefined || rule.when === null) return { ok: true, holds: true, desc: 'unconditional' };
  return evalWhen(rule.when, cellMap, 0);
}

function malformed(type, desc) {
  return {
    status: 'fail', computed_value: null, reported_value: null, rule_defect: true,
    cav: CAV_BY_RULE_TYPE[type], message: `Rule cannot be evaluated: ${desc}.`,
  };
}

function notApplicable(type, desc, reported) {
  return {
    status: 'pass', computed_value: null, reported_value: reported === undefined ? null : reported,
    cav: CAV_BY_RULE_TYPE[type], message: `Not applicable: condition (${desc}) does not hold for this row.`,
  };
}

function evalEnumMembership(rule, cellMap) {
  const type = 'enum_membership';
  const ref = safeStr(rule.ref);
  if (!ref) return malformed(type, 'rule is missing "ref"');
  const allowed = normArray(rule.allowed_values);
  if (allowed.length === 0) return malformed(type, `rule on ${ref} declares no "allowed_values"`);
  const cond = whenOptional(rule, cellMap);
  if (!cond.ok) return malformed(type, cond.desc);
  const v = cellValue(cellMap, ref);
  if (!cond.holds) return notApplicable(type, cond.desc, v);
  if (!cellMap.has(ref)) {
    return { status: 'fail', computed_value: null, reported_value: null, cav: CAV_BY_RULE_TYPE[type], message: `Missing cell reference in report instance: ${ref}.` };
  }
  let member = false;
  for (const cand of allowed) { if (sameValue(v, cand)) { member = true; break; } }
  return {
    status: member ? 'pass' : 'fail',
    computed_value: null,
    reported_value: v === undefined ? null : v,
    cav: CAV_BY_RULE_TYPE[type],
    message: member
      ? `${ref} (${fmtVal(v)}) is a member of the permitted values [${listVals(allowed)}].`
      : `${ref} (${fmtVal(v)}) is not a member of the permitted values [${listVals(allowed)}].`,
  };
}

function evalConditionalRequired(rule, cellMap) {
  const type = 'conditional_required';
  const ref = safeStr(rule.ref);
  if (!ref) return malformed(type, 'rule is missing "ref"');
  const cond = whenRequired(rule, cellMap);
  if (!cond.ok) return malformed(type, cond.desc);
  if (!cond.holds) return notApplicable(type, cond.desc, cellValue(cellMap, ref));
  if (!cellMap.has(ref)) {
    return { status: 'fail', computed_value: null, reported_value: null, cav: CAV_BY_RULE_TYPE[type], message: `${ref} is required when ${cond.desc}, and is not present in the report instance.` };
  }
  const v = cellValue(cellMap, ref);
  const empty = isEmptyVal(v);
  return {
    status: empty ? 'fail' : 'pass',
    computed_value: null,
    reported_value: v === undefined ? null : v,
    cav: CAV_BY_RULE_TYPE[type],
    message: empty
      ? `${ref} is required when ${cond.desc}, and is present but empty/null.`
      : `${ref} is required when ${cond.desc}, and is present and non-empty.`,
  };
}

function evalConditionalProhibited(rule, cellMap) {
  const type = 'conditional_prohibited';
  const ref = safeStr(rule.ref);
  if (!ref) return malformed(type, 'rule is missing "ref"');
  const forbidden = normArray(rule.forbidden_values);
  if (forbidden.length === 0) return malformed(type, `rule on ${ref} declares no "forbidden_values"`);
  const cond = whenRequired(rule, cellMap);
  if (!cond.ok) return malformed(type, cond.desc);
  const v = cellValue(cellMap, ref);
  if (!cond.holds) return notApplicable(type, cond.desc, v);
  // Nothing reported cannot be a prohibited value. Whether the field ought to have been reported
  // at all is a conditional_required question, deliberately kept in its own rule.
  if (!cellMap.has(ref) || isEmptyVal(v)) {
    return { status: 'pass', computed_value: null, reported_value: v === undefined ? null : v, cav: CAV_BY_RULE_TYPE[type], message: `${ref} reports no value when ${cond.desc}, so no prohibited value is present.` };
  }
  let hit = false;
  for (const cand of forbidden) { if (sameValue(v, cand)) { hit = true; break; } }
  return {
    status: hit ? 'fail' : 'pass',
    computed_value: null,
    reported_value: v,
    cav: CAV_BY_RULE_TYPE[type],
    message: hit
      ? `${ref} (${fmtVal(v)}) is prohibited when ${cond.desc}; prohibited values are [${listVals(forbidden)}].`
      : `${ref} (${fmtVal(v)}) is not among the values prohibited when ${cond.desc} [${listVals(forbidden)}].`,
  };
}

const EVALUATORS = {
  arithmetic_identity: evalArithmeticIdentity,
  cross_schedule_tie_out: evalCrossScheduleTieOut,
  sign_domain: evalSignDomain,
  mandatory_field: evalMandatoryField,
  enum_membership: evalEnumMembership,
  conditional_required: evalConditionalRequired,
  conditional_prohibited: evalConditionalProhibited,
};

export function compute(pp) {
  pp = pp || {};
  const instance = pp.report_instance && typeof pp.report_instance === 'object' ? pp.report_instance : {};
  const cells = normArray(instance.cells);
  const cellMap = buildCellMap(cells);

  const ruleSetIn = pp.rule_set && typeof pp.rule_set === 'object' ? pp.rule_set : {};
  const rules = normArray(ruleSetIn.rules);
  const rule_set_version = safeStr(ruleSetIn.version) || null;
  const rule_set_source = safeStr(ruleSetIn.source) || null;

  const suppressionsIn = normArray(pp.suppressions);
  const suppressionByEditId = new Map();
  for (const s of suppressionsIn) {
    if (!s || typeof s !== 'object') continue;
    const edit_id = safeStr(s.edit_id);
    if (!edit_id) continue;
    suppressionByEditId.set(edit_id, safeStr(s.reason) || 'No reason given.');
  }

  const findings = [];
  const compliance_flags = [];
  const appliedEditIds = new Set();
  let passCount = 0; let failCount = 0; let suppressedCount = 0;

  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') continue;
    const edit_id = safeStr(rule.edit_id);
    const type = safeStr(rule.type);
    const schedule = safeStr(rule.schedule) || null;
    const description = safeStr(rule.description) || null;
    const severity = safeStr(rule.severity) || 'error';
    if (!edit_id) continue;
    appliedEditIds.add(edit_id);

    if (suppressionByEditId.has(edit_id)) {
      suppressedCount += 1;
      findings.push({
        edit_id, type: type || null, schedule, severity, description,
        status: 'suppressed', computed_value: null, reported_value: null,
        message: `Suppressed: ${suppressionByEditId.get(edit_id)}`,
      });
      continue;
    }

    const evaluator = EVALUATORS[type];
    if (!evaluator) {
      failCount += 1;
      compliance_flags.push('UNKNOWN_RULE_TYPE');
      findings.push({
        edit_id, type: type || null, schedule, severity, description,
        status: 'fail', computed_value: null, reported_value: null,
        message: `Unknown rule type "${type}" — cannot evaluate.`,
      });
      continue;
    }

    const result = evaluator(rule, cellMap);
    if (result.status === 'pass') passCount += 1; else failCount += 1;
    if (result.status === 'fail') compliance_flags.push(`EDIT_CHECK_FAILED:${edit_id}`);
    if (result.rule_defect === true) compliance_flags.push('RULE_PREDICATE_INVALID');
    // Built field-by-field rather than spread: the evaluator result carries the internal
    // `rule_defect` marker, which is a flag input and never part of a finding.
    const finding = {
      edit_id, type, schedule, severity, description,
      status: result.status,
      computed_value: result.computed_value ?? null,
      reported_value: result.reported_value ?? null,
      message: result.message,
    };
    // Emitted by the three conditional shapes only -- see the header note on byte-identity.
    if (result.cav) finding.cav = result.cav;
    findings.push(finding);
  }

  const staleSuppressions = [...suppressionByEditId.keys()].filter((id) => !appliedEditIds.has(id));

  const summary = {
    total_rules: rules.length,
    applied: passCount + failCount,
    suppressed: suppressedCount,
    pass: passCount,
    fail: failCount,
    stale_suppression_count: staleSuppressions.length,
    overall_pass: failCount === 0,
  };

  const seen = new Set();
  const flags = [];
  for (const f of compliance_flags) { if (!seen.has(f)) { seen.add(f); flags.push(f); } }
  if (staleSuppressions.length > 0) flags.push('STALE_SUPPRESSION_LIST');

  const output_payload = {
    rule_set_version,
    rule_set_source,
    suppressions_applied: [...suppressionByEditId.entries()].map(([edit_id, reason]) => ({ edit_id, reason })),
    stale_suppressions: staleSuppressions,
    findings,
    summary,
    compliance_flags: flags,
    note: 'Evaluates a caller-supplied published edit-check rule set (FFIEC validity/quality edits or EBA ITS validation rules) against a caller-supplied report instance. The kernel is the evaluator; it carries no rule content of its own. Findings are keyed by the published edit id for round-trip into the issuer\'s own vocabulary.',
  };

  return { output_payload, compliance_flags: flags };
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
