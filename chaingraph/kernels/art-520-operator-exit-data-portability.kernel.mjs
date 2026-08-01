/**
 * art-520-operator-exit-data-portability.kernel.mjs
 * INBOUND-EVIDENCE-BUILD-SPEC.md §6.5 (RFP §1.5, §3.14) — operator exit and data
 * portability.
 *
 * ⛔ THIS DOES NOT AUDIT A SUPPLIER, RATE A VENDOR, OR OPINE ON CONTRACT ENFORCEABILITY.
 * It evaluates whether the CALLER's DECLARED exit posture hangs together: per data
 * category, does an export path exist and in what format; are the named components
 * operator- or supplier-controlled; which dependencies have no declared substitute;
 * is there an escrow arrangement; are notice period and transition-assistance terms
 * declared. No output names or characterises a supplier -- every field is a caller
 * declaration, keyed by opaque category/component/dependency names the caller supplies.
 *
 * THE STRANDED-CATEGORY LIST IS THE DELIVERABLE (§6.5), NOT A RATIO. The
 * operator-control figure is carried as a fraction string ("3/5"), never computed or
 * rendered as a percentage anywhere in this file -- CONTRACT/spec §4 forbids a coverage
 * percentage in reader-facing copy, and the fraction form is what the caller can restate
 * without doing arithmetic the kernel would otherwise be implying as a verdict.
 *
 * UNDECLARED IS A DISTINCT STATE FROM NOT-PORTABLE (STRANDED). A data category whose
 * `export_exists` key is absent (undefined/null) yields verdict UNDECLARED and is
 * counted separately from a category the caller explicitly declared has no export path
 * (verdict STRANDED). Silence is never scored as a failure -- the same absence-instrument
 * discipline as art-516's `prior_period_exceptions`. Every tri-state input in this kernel
 * (export_exists, format_open, controlled_by, single_supplier, substitutable, escrow
 * exists) follows the same rule: true | false | undeclared, never collapsed to a boolean.
 *
 * EXIT_OPERATOR_CLAIM_UNSUPPORTED is the novel output: it fires when the caller declares
 * itself the contractual operator (`contractual_operator: true`) but every component with
 * a DEFINITE (non-undeclared) controlled_by declaration is supplier-controlled -- the gap
 * between a contract's words and an ordinary managed service. It requires at least one
 * definite component declaration; an all-undeclared component set cannot support or refute
 * the claim, so the flag stays silent (an UNDECLARED-shaped exception is raised instead).
 *
 * REGION-PORTABLE BY CONSTRUCTION (§6.9). No country, currency, scheme, ministry, statute,
 * or supplier name is hardcoded anywhere in this file. Every category, component,
 * dependency, and term is a caller-declared string or tri-state -- the same kernel runs
 * unchanged for a second, structurally different exit-obligation regime (see the
 * fixtures for a DORA-shaped and an FFIEC-shaped case).
 *
 * FINITE GATE. An empty category list, an empty component list, an empty dependency list,
 * and every undeclared tri-state each resolve to a DEFINED verdict. No branch can emit
 * NaN, Infinity, null-as-a-number, or an undefined status.
 *
 * NO CLOCK. `as_of` and `last_successful_export` are caller inputs; compute() never reads
 * a clock.
 *
 * PII: opaque category/component/dependency names only. No account holder, employee, or
 * citizen identity of any kind enters this kernel. No supplier, vendor, or product name is
 * emitted -- the caller may declare one as an opaque string, but this kernel does not name
 * or characterise it in any output field.
 *
 * Zero network, zero randomness, zero wall-clock reads inside compute().
 *
 * Spec: INBOUND-EVIDENCE-BUILD-SPEC.md §6.5 (RFP §1.5, §3.14).
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-520-operator-exit-data-portability';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'check_operator_exit_portability', mandate_type: 'attestation_mandate', gpu: false };

function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function isoDateOrNull(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }

/** Tri-state coercion: true | false | undeclared. Never collapsed to a plain boolean --
 * absence (undefined/null) is a DISTINCT, non-failing state from an explicit false. */
function triState(v, where, rejected) {
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (v === undefined || v === null) return 'undeclared';
  rejected.push({ where, reason: 'expected boolean true/false or absent (undeclared)', supplied: typeof v === 'object' ? JSON.stringify(v) : String(v) });
  return 'undeclared';
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];
  const exit_readiness_exceptions = [];

  const as_of = isoDateOrNull(pp.as_of);
  const contractual_operator = triState(pp.contractual_operator, 'contractual_operator', rejected_inputs);

  // --- Data categories: per-category export existence, format, and openness (§6.5) ---
  const categoriesIn = Array.isArray(pp.data_categories) ? pp.data_categories : [];
  const categories = categoriesIn.map((c, i) => {
    c = c && typeof c === 'object' ? c : {};
    const category = isNonEmptyString(c.category) ? c.category.trim() : `UNLABELLED-${i + 1}`;
    const export_exists = triState(c.export_exists, `data_categories[${i}].export_exists`, rejected_inputs);
    const format = isNonEmptyString(c.format) ? c.format.trim() : null;
    const format_open = triState(c.format_open, `data_categories[${i}].format_open`, rejected_inputs);
    const export_cadence = isNonEmptyString(c.export_cadence) ? c.export_cadence.trim() : null;
    const last_successful_export = isoDateOrNull(c.last_successful_export);

    let verdict;
    if (export_exists === 'undeclared') verdict = 'UNDECLARED';
    else if (export_exists === 'false') verdict = 'STRANDED';
    else if (format_open === 'true') verdict = 'PORTABLE';
    else if (format_open === 'false') verdict = 'PORTABLE_PROPRIETARY_FORMAT';
    else verdict = 'PORTABLE_FORMAT_UNDECLARED';

    return { category, export_exists, format, format_open, export_cadence, last_successful_export, verdict };
  });

  const stranded_categories = categories.filter((c) => c.verdict === 'STRANDED');
  const proprietary_format_categories = categories.filter((c) => c.verdict === 'PORTABLE_PROPRIETARY_FORMAT');
  const undeclared_categories = categories.filter((c) => c.verdict === 'UNDECLARED' || c.verdict === 'PORTABLE_FORMAT_UNDECLARED');

  for (const c of stranded_categories) exit_readiness_exceptions.push({ area: 'data_category', name: c.category, detail: 'declared no export path -- stranded' });
  for (const c of proprietary_format_categories) exit_readiness_exceptions.push({ area: 'data_category', name: c.category, detail: `export exists in a declared proprietary format (${c.format || 'format unnamed'})` });
  for (const c of undeclared_categories) exit_readiness_exceptions.push({ area: 'data_category', name: c.category, detail: 'export existence or format openness not declared' });

  // --- Operator- vs supplier-controlled components (§3.14 operator claim) ---
  const componentsIn = Array.isArray(pp.declared_components) ? pp.declared_components : [];
  const components = componentsIn.map((c, i) => {
    c = c && typeof c === 'object' ? c : {};
    const name = isNonEmptyString(c.name) ? c.name.trim() : `UNLABELLED-${i + 1}`;
    let controlled_by = isNonEmptyString(c.controlled_by) ? c.controlled_by.trim().toLowerCase() : null;
    if (controlled_by !== 'operator' && controlled_by !== 'supplier') {
      if (controlled_by !== null) rejected_inputs.push({ where: `declared_components[${i}].controlled_by`, reason: "expected 'operator' or 'supplier'", supplied: controlled_by });
      controlled_by = 'undeclared';
    }
    return { name, controlled_by };
  });
  const operator_controlled_count = components.filter((c) => c.controlled_by === 'operator').length;
  const supplier_controlled_count = components.filter((c) => c.controlled_by === 'supplier').length;
  const undeclared_component_count = components.filter((c) => c.controlled_by === 'undeclared').length;
  const declared_component_count = operator_controlled_count + supplier_controlled_count;
  // Fraction form only -- never a percentage (§4 reader-facing-copy ban applies to this
  // figure specifically, per §6.5's "never as a percentage" instruction).
  const operator_control_ratio_declared = declared_component_count > 0 ? `${operator_controlled_count}/${declared_component_count}` : 'undeclared';

  const operator_claim_unsupported = contractual_operator === 'true' && declared_component_count > 0 && operator_controlled_count === 0;
  if (operator_claim_unsupported) {
    exit_readiness_exceptions.push({ area: 'operator_claim', name: 'contractual_operator', detail: `declared the contractual operator, but all ${declared_component_count} definitively-declared components are supplier-controlled` });
  } else if (contractual_operator === 'true' && declared_component_count === 0) {
    exit_readiness_exceptions.push({ area: 'operator_claim', name: 'contractual_operator', detail: 'declared the contractual operator, but no component control was declared to support or refute the claim' });
  }
  if (undeclared_component_count > 0) exit_readiness_exceptions.push({ area: 'components', name: 'declared_components', detail: `${undeclared_component_count} declared component${undeclared_component_count === 1 ? '' : 's'} with control not stated` });

  // --- Dependencies with substitutability declared per item ---
  const dependenciesIn = Array.isArray(pp.dependencies) ? pp.dependencies : [];
  const dependencies = dependenciesIn.map((d, i) => {
    d = d && typeof d === 'object' ? d : {};
    const name = isNonEmptyString(d.name) ? d.name.trim() : `UNLABELLED-${i + 1}`;
    const single_supplier = triState(d.single_supplier, `dependencies[${i}].single_supplier`, rejected_inputs);
    const substitutable = triState(d.substitutable, `dependencies[${i}].substitutable`, rejected_inputs);
    return { name, single_supplier, substitutable };
  });
  const single_supplier_no_substitute = dependencies.filter((d) => d.single_supplier === 'true' && d.substitutable === 'false');
  for (const d of single_supplier_no_substitute) exit_readiness_exceptions.push({ area: 'dependency', name: d.name, detail: 'single-supplier dependency with no declared substitute' });

  // --- Escrow arrangements ---
  const escrowIn = pp.escrow_arrangements && typeof pp.escrow_arrangements === 'object' ? pp.escrow_arrangements : {};
  const escrow_exists = triState(escrowIn.exists, 'escrow_arrangements.exists', rejected_inputs);
  const escrow_description = isNonEmptyString(escrowIn.description) ? escrowIn.description.trim() : null;
  if (escrow_exists === 'false') exit_readiness_exceptions.push({ area: 'escrow', name: 'escrow_arrangements', detail: 'declared: no escrow arrangement' });
  else if (escrow_exists === 'undeclared') exit_readiness_exceptions.push({ area: 'escrow', name: 'escrow_arrangements', detail: 'escrow arrangement not declared' });

  // --- Notice period and transition-assistance terms, as declared ---
  let notice_period_days = null;
  let notice_period_declared = false;
  if (typeof pp.notice_period_days === 'number' && Number.isFinite(pp.notice_period_days) && pp.notice_period_days >= 0) {
    notice_period_days = Math.trunc(pp.notice_period_days);
    notice_period_declared = true;
  } else if (pp.notice_period_days !== undefined && pp.notice_period_days !== null) {
    rejected_inputs.push({ where: 'notice_period_days', reason: 'expected a non-negative number', supplied: pp.notice_period_days });
  }
  if (!notice_period_declared) exit_readiness_exceptions.push({ area: 'transition', name: 'notice_period_days', detail: 'notice period not declared' });

  const transition_assistance_terms = isNonEmptyString(pp.transition_assistance_terms) ? pp.transition_assistance_terms.trim() : null;
  if (!transition_assistance_terms) exit_readiness_exceptions.push({ area: 'transition', name: 'transition_assistance_terms', detail: 'transition-assistance terms not declared' });

  const portable = stranded_categories.length === 0;

  const compliance_flags = [];
  compliance_flags.push(portable ? 'EXIT_PORTABLE' : 'EXIT_STRANDED_DATA');
  if (proprietary_format_categories.length > 0) compliance_flags.push('EXIT_PROPRIETARY_FORMAT');
  if (escrow_exists === 'false') compliance_flags.push('EXIT_NO_ESCROW');
  if (operator_claim_unsupported) compliance_flags.push('EXIT_OPERATOR_CLAIM_UNSUPPORTED');
  if (rejected_inputs.length > 0) compliance_flags.push('EXIT_INPUTS_REJECTED');

  const rationale = [];
  rationale.push(`${categories.length} declared data categor${categories.length === 1 ? 'y' : 'ies'}: ${stranded_categories.length} stranded (no export path), ${proprietary_format_categories.length} portable in a proprietary format, ${undeclared_categories.length} with export status or format openness undeclared.`);
  rationale.push(portable ? 'No stranded categories declared.' : `${stranded_categories.length} categor${stranded_categories.length === 1 ? 'y has' : 'ies have'} no declared export path.`);
  rationale.push(`Operator-control ratio as declared: ${operator_control_ratio_declared} of definitively-declared components (${undeclared_component_count} undeclared).`);
  if (operator_claim_unsupported) rationale.push('Contractual-operator claim is UNSUPPORTED by the declared component control -- every definitively-declared component is supplier-controlled.');
  if (single_supplier_no_substitute.length > 0) rationale.push(`${single_supplier_no_substitute.length} single-supplier dependenc${single_supplier_no_substitute.length === 1 ? 'y has' : 'ies have'} no declared substitute.`);
  rationale.push(escrow_exists === 'true' ? 'Escrow arrangement declared.' : escrow_exists === 'false' ? 'No escrow arrangement declared.' : 'Escrow arrangement not declared (undeclared, not scored as a failure).');
  rationale.push('This evaluates the declared exit posture only. It does not audit a supplier, rate a vendor, or opine on contract enforceability.');

  const output_payload = {
    as_of,
    contractual_operator,
    categories,
    category_count: categories.length,
    stranded_categories,
    stranded_category_count: stranded_categories.length,
    proprietary_format_categories,
    undeclared_categories,
    portable,
    components,
    operator_controlled_count,
    supplier_controlled_count,
    undeclared_component_count,
    declared_component_count,
    operator_control_ratio_declared,
    operator_claim_unsupported,
    dependencies,
    single_supplier_no_substitute,
    escrow_exists,
    escrow_description,
    notice_period_days,
    notice_period_declared,
    transition_assistance_terms,
    transition_assistance_declared: !!transition_assistance_terms,
    exit_readiness_exceptions,
    rejected_inputs,
    rationale,
    note: 'Deterministic evaluation of a caller-declared operator-exit and data-portability posture: per-category export/format portability with a stranded-category list, declared operator- vs supplier-control of named components (with an unsupported-operator-claim check), single-supplier dependencies with no declared substitute, escrow declaration, and notice/transition terms. Evaluates declarations only -- never a supplier audit, rating, or enforceability opinion.',
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
