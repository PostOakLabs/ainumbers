import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-461-control-test-evidence-composer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compose_control_test_evidence',
  mandate_type: 'compliance_control', gpu: false,
};

// SOX 404 / ICFR control-test evidence composer (art-461). Takes a caller-declared
// population hash, an attribute sample (item ids, e.g. from art-458), and a
// per-item pass/fail test-result set, and reconciles them into ONE test-conclusion
// artifact: coverage (did every sampled item get tested), exception count vs a
// caller-set tolerable-deviation threshold, and a test conclusion. It never
// samples, never selects items, and never judges severity or materiality of a
// deviation -- those are §22.11/§27 approval-record acts. This kernel only
// reconciles declared facts into a conclusion + an exception candidate list.
//
// HA wiring (SOX 404 / PCAOB AS 1215): the caller-declared tester_id is recorded
// under the §27.1 `preparer` role; gate_status is fixed at `review_required` --
// every control test requires a §27.4 reviewer approval record regardless of
// outcome, this is standard walkthrough-and-test practice, not conditional on
// exceptions. When exception_count > 0 the artifact flags a deficiency
// CANDIDATE (classification_pending: true) -- severity classification (control
// deficiency / significant deficiency / material weakness) and its reason_code
// are entered as a separate §27.2 approval record by a human reviewer, never
// computed here. Workpaper completeness framing only, not legal advice.
export function compute(pp) {
  pp = pp || {};
  const s = (v) => String(v == null ? '' : v).trim();
  const n = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };

  const control_id = s(pp.control_id);
  const population_hash = s(pp.population_hash);
  const reporting_period = s(pp.reporting_period) || null;
  const tester_id = s(pp.tester_id);
  const tolerable_exception_count = Math.max(0, Math.trunc(n(pp.tolerable_exception_count, 0)));

  const sample = Array.isArray(pp.sample) ? pp.sample : [];
  const test_results = Array.isArray(pp.test_results) ? pp.test_results : [];

  const sampleIds = sample.map((it) => s(it && it.item_id)).filter(Boolean);
  const sampleIdSet = new Set(sampleIds);

  const resultMap = new Map();
  test_results.forEach((r) => {
    const item_id = s(r && r.item_id);
    if (!item_id) return;
    const result = s(r && r.result).toLowerCase();
    resultMap.set(item_id, result === 'pass' || result === 'fail' ? result : 'invalid');
  });

  const missing_results = sampleIds.filter((id) => !resultMap.has(id));
  const extra_results = [...resultMap.keys()].filter((id) => !sampleIdSet.has(id));
  const coverage_complete = missing_results.length === 0 && sampleIds.length > 0;

  const tested_sample_ids = sampleIds.filter((id) => resultMap.has(id));
  const exception_items = tested_sample_ids.filter((id) => resultMap.get(id) === 'fail');
  const pass_count = tested_sample_ids.filter((id) => resultMap.get(id) === 'pass').length;
  const fail_count = exception_items.length;

  const sample_size = sampleIds.length;
  const tested_count = tested_sample_ids.length;
  const exception_count = fail_count;
  const exception_rate = sample_size > 0 ? exception_count / sample_size : 0;
  const within_tolerance = coverage_complete && exception_count <= tolerable_exception_count;

  const test_conclusion = !coverage_complete
    ? 'incomplete'
    : (within_tolerance ? 'operating_effectively' : 'exception_noted');

  const deficiency = exception_count > 0
    ? { classification_pending: true, exception_count, exception_items, reason_code: null }
    : null;

  const compliance_flags = ['ICFR_CONTROL_TEST_EVALUATED'];
  if (test_conclusion === 'operating_effectively') compliance_flags.push('ICFR_CONTROL_EFFECTIVE');
  else if (test_conclusion === 'incomplete') compliance_flags.push('ICFR_TEST_COVERAGE_INCOMPLETE');
  else compliance_flags.push('ICFR_DEFICIENCY_CANDIDATE');

  return {
    output_payload: {
      control_id: control_id || null,
      population_hash: population_hash || null,
      reporting_period,
      sample_size,
      tested_count,
      missing_results,
      extra_results,
      coverage_complete,
      pass_count,
      fail_count,
      exception_count,
      exception_rate,
      tolerable_exception_count,
      within_tolerance,
      test_conclusion,
      tester_role: 'preparer',
      tester_id: tester_id || null,
      gate_status: 'review_required',
      deficiency,
      not_a_severity_judgment: 'This artifact reconciles declared sample coverage and exception count against a tolerable-deviation threshold. Deficiency severity (control / significant / material weakness) and its reason_code are a human reviewer approval record (SPEC.md §27.2), never computed here.',
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.4/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
