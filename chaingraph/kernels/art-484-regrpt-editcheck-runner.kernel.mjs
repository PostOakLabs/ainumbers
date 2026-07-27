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
 * criteria file. The kernel only knows HOW to evaluate four rule shapes (arithmetic identity,
 * cross-schedule tie-out, sign/domain constraint, mandatory-field completeness) against a
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

const EVALUATORS = {
  arithmetic_identity: evalArithmeticIdentity,
  cross_schedule_tie_out: evalCrossScheduleTieOut,
  sign_domain: evalSignDomain,
  mandatory_field: evalMandatoryField,
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
    findings.push({ edit_id, type, schedule, severity, description, ...result });
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
