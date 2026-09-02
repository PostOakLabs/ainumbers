// FAMILY C — EU AI Act Article 12(2) decision-logging family.
//
// SHARED REGULATORY SUBSTANCE. art-238 PUBLISHES the Art 12(2) obligation for an
// Annex III 5(b)/(5)(c) system — which fields a decision log must carry and how long
// it must be retained. art-236 BUILDS a record intended to satisfy that obligation and
// scores its own Art 12 completeness. The two are consecutive steps of the same chain,
// and art-238's own do_now line names art-236 by mcp_name as the remedy for the gap it
// reports. That makes the relationship explicit: whatever art-238 says Art 12(2)
// requires, art-236 must require before it certifies a record complete.
//
// SELECTION RATIONALE. Enumerated from chaingraph/graph/chains/*.json: the chain
// `ai-decision-log-conformance` (art-238 -> art-236 -> art-237) was the only candidate
// where one kernel publishes an obligation as data and a sibling kernel scores
// conformance to that same obligation. Every other multi-kernel regime family in the
// estate shares thresholds; this one shares a REQUIRED-FIELD SET, which is a different
// and previously untested consistency shape.
//
// THE DECLARED MAPPING, stated openly. art-238 emits its Art 12(2) obligation as one
// prose sentence, not as a field list. Rather than parse that prose, this family
// declares the mapping from each obligation element to the art-236 payload field that
// carries it, and the property then asserts over the mapping. The mapping is the
// harness's own claim and is written here so a reader can disagree with it directly.

import { compute as art236 } from '../art-236-build-ai-decision-log-record.kernel.mjs';
import { compute as art238 } from '../art-238-classify-annex3-decisioning-obligations.kernel.mjs';
import { defineFamily, EXPECT, checker } from './_consistency-harness.mjs';

// art-238's Art 12(2) obligation sentence, element by element, mapped to the art-236
// payload field that carries it. `omittable` records a value a caller can leave out
// while art-236 still emits the record.
const ART12_ELEMENTS = [
  { element: 'inputs', art236_field: 'input_digest', omitted_value: '' },
  { element: 'outputs', art236_field: 'output_digest', omitted_value: '' },
  { element: 'model version', art236_field: 'model_version', omitted_value: '' },
  { element: 'override flags', art236_field: 'override_flag', omitted_value: undefined },
  { element: 'natural-person-ID field', art236_field: 'subject_ref', omitted_value: '' },
];

// The obligation text art-238 actually publishes, quoted so a change to it makes this
// mapping visibly stale rather than silently wrong.
const EXPECTED_OBLIGATION_SUBSTRING = 'Retain >= 6 months';

function art12Obligation() {
  const out = art238({
    is_high_risk: true, annex3_category: '5b_creditworthiness',
    deployer_role: 'deployer',
  }).output_payload;
  return (out.obligations || []).find((o) => o.article === 'Art 12(2)');
}

// A record whose every Art 12(2) element is supplied. Baseline for the omission sweep.
const COMPLETE_RECORD = {
  model_id: 'model-alpha',
  model_version: '2.1.0',
  input_digest: 'a'.repeat(64),
  output_digest: 'b'.repeat(64),
  decision_label: 'CREDIT_APPROVED',
  confidence: 0.9,
  override_flag: true,
  subject_ref: 'case-0001',
  operator_id: 'op-1',
  retention_months: 6,
};

// ── P-C1 ────────────────────────────────────────────────────────────────────
// Exhaustive single-element omission over the declared Art 12(2) element set: for each
// element art-238 says Art 12(2) requires, a record omitting it must not be certified
// COMPLETE by art-236.
function pC1() {
  const c = checker();

  // Guard: the mapping above is written against art-238's published obligation text.
  // If that text no longer says what the mapping assumes, the property is void, not
  // green, so it is checked as a case of its own.
  const obligation = art12Obligation();
  c.check(
    Boolean(obligation) && obligation.obligation.includes(EXPECTED_OBLIGATION_SUBSTRING),
    {
      property: 'P-C1', case: 'mapping-freshness-guard',
      art238_obligation: obligation && obligation.obligation,
      why: 'art-238 no longer publishes the obligation text this mapping was written against',
    },
  );

  for (const el of ART12_ELEMENTS) {
    const pp = { ...COMPLETE_RECORD };
    if (el.omitted_value === undefined) delete pp[el.art236_field];
    else pp[el.art236_field] = el.omitted_value;

    const out = art236(pp).output_payload;
    c.check(out.record_status !== 'COMPLETE' || out.art12_completeness_score < 100, {
      property: 'P-C1', omitted_element: el.element, omitted_field: el.art236_field,
      art236_record_status: out.record_status,
      art236_completeness_score: out.art12_completeness_score,
      art236_missing_fields: out.missing_art12_fields,
      why: 'art-236 certified an Art 12 record complete while omitting an element art-238 says Art 12(2) requires',
    });
  }
  return c.result();
}

// ── P-C2 ────────────────────────────────────────────────────────────────────
// art-238 publishes a minimum retention of six months. Every record art-236 emits must
// carry a retention at least that long, whatever the caller asked for.
function pC2() {
  const c = checker();
  const obligation = art12Obligation();
  const stated = obligation && /Retain >= (\d+) months/.exec(obligation.obligation);
  const minMonths = stated ? Number(stated[1]) : null;

  c.check(Number.isFinite(minMonths), {
    property: 'P-C2', case: 'retention-minimum-parse',
    art238_obligation: obligation && obligation.obligation,
    why: 'could not read a retention minimum out of art-238\'s published obligation',
  });

  for (const asked of [undefined, null, '', -12, 0, 1, 5, 6, 7, 120]) {
    const pp = { ...COMPLETE_RECORD, retention_months: asked };
    const out = art236(pp).output_payload;
    c.check(Number.isFinite(minMonths) && out.retention_months >= minMonths, {
      property: 'P-C2', requested_retention_months: asked,
      art236_retention_months: out.retention_months,
      art238_minimum_months: minMonths,
      why: 'art-236 emitted a retention shorter than the minimum art-238 publishes',
    });
  }
  return c.result();
}

// ── P-C3 ────────────────────────────────────────────────────────────────────
// Scope gating must be consistent in both directions: art-238 asserts an Art 12
// logging obligation exactly when the system is in scope, and never reports gaps or
// obligations for a system it has placed out of scope.
function pC3() {
  const c = checker();
  for (const is_high_risk of [true, false]) {
    for (const annex3_category of ['5b_creditworthiness', '5c_life_health_insurance_pricing', 'other', 'unknown']) {
      for (const deployer_role of ['provider', 'deployer', 'both', 'unknown']) {
        const out = art238({ is_high_risk, annex3_category, deployer_role }).output_payload;
        c.check(out.art12_logging_required === is_high_risk, {
          property: 'P-C3', is_high_risk, annex3_category, deployer_role,
          art12_logging_required: out.art12_logging_required,
          why: 'art-238 Art 12 logging obligation does not track its own scope verdict',
        });
        // Out of scope must mean nothing is asserted, not merely that the headline
        // flag flipped.
        if (!is_high_risk) {
          c.check(
            out.scope_verdict === 'OUT_OF_SCOPE'
            && (out.obligations || []).length === 0
            && (out.compliance_gaps || []).length === 0,
            {
              property: 'P-C3', is_high_risk, annex3_category, deployer_role,
              scope_verdict: out.scope_verdict,
              obligations: (out.obligations || []).length,
              compliance_gaps: (out.compliance_gaps || []).length,
              why: 'art-238 reported obligations or gaps for a system it placed out of scope',
            },
          );
        }
      }
    }
  }
  return c.result();
}

export default defineFamily({
  family: 'C',
  title: 'EU AI Act Art 12(2) logging — obligation publisher art-238 vs record builder art-236',
  chains: ['ai-decision-log-conformance'],
  kernels: [
    'art-238-classify-annex3-decisioning-obligations',
    'art-236-build-ai-decision-log-record',
  ],
  properties: [
    {
      id: 'P-C1-required-field-set-agreement',
      statement: 'A decision-log record omitting any element art-238 publishes as required by Art 12(2) is not certified complete by art-236.',
      // DECLARED BEFORE RUNNING: art-236's completeness set is {model_id, input_digest,
      // output_digest, decision_label}, which omits model version, override flag and
      // the natural-person-ID field that art-238 enumerates. Expect a violation.
      expect: EXPECT.VIOLATION,
      run: pC1,
    },
    {
      id: 'P-C2-retention-floor-agreement',
      statement: 'Every record art-236 emits carries a retention at least as long as the minimum art-238 publishes, whatever the caller requested.',
      expect: EXPECT.HOLDS,
      run: pC2,
    },
    {
      id: 'P-C3-scope-gate-agreement',
      statement: 'art-238 asserts an Art 12 logging obligation exactly when the system is high-risk, and reports no obligations or gaps for an out-of-scope system.',
      expect: EXPECT.HOLDS,
      run: pC3,
    },
  ],
});
