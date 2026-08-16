import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-635-rate-rec-5pct-threshold-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'classify_rate_rec_5pct_threshold',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ASC 740-10-50-12A, as amended by FASB Accounting Standards Update No. 2023-09, retrieved by
// DISE-SEG-K-3 at claim time from https://storage.fasb.org/ASU%202023-09.pdf (HTTP 200, 578461
// bytes, sha256 97f987a1e86382de1c33210657b45cfd46bdea08ae95f6b3d727c988c3abe33a). Snapshot at
// workspace-root research/clause-snapshots/ASU-2023-09-fasb-DISE-SEG-K-3-2026-08-15.pdf.
// Spec: research/DISE-SEG-K-3.spec.md.
//
// THE COMPARISON IS ABSOLUTE VALUE ON BOTH SIDES, and the authority for that is BC35 of the Update,
// which is the basis for conclusions on THIS threshold. It is NOT inherited from the separate
// income-taxes-paid test of ASC 740-10-50-23 (whose absolute-value reading rests on BC70 and is
// implemented by tools/583). No arithmetic was copied between the two. On the face of the operative
// text, 740-10-50-12A(b)(2) corroborates by requiring separate disclosure where an item's gross
// amount, positive or negative, meets the threshold.
//
// Absolute value on the DENOMINATOR side is what makes the test well defined for a loss making
// entity: under a signed reading a negative base flips the inequality and every verdict inverts. A
// negative pretax income is therefore ordinary here, not degenerate.
//
// rounding_steps: NONE BEFORE COMPARISON. The verdict is decided by exact cross multiplication on
// unrounded inputs. The percentage is never rounded and then compared; pct_of_threshold_base is
// computed strictly after the verdict and never feeds a decision. The cross multiplied form is
// chosen over the naive 0.05 * base because 0.05 and 0.01 are not exactly representable in binary
// while 2000 is: at P=3, R=100, E=0.15 the true ratio is exactly 5 percent, yet 0.05*3 evaluates
// above 0.15 and the naive form returns false on a boundary the clause puts on the inclusive side.
// That removes the error contributed by the threshold constant only. It cannot remove error already
// present in the caller's decimals, and this kernel does not claim otherwise.
//
// float_sensitive: yes.

// The eight categories closed by 740-10-50-12A(a), plus the ninth state the clause itself
// contemplates at 740-10-50-12A(b)(3): an item within none of them. An eight member enum cannot
// express a (b)(3) item at all.
//
// The value is the disaggregation 740-10-50-12A(b) requires of that category. The four categories
// mapping to null appear in none of (b)(1), (b)(2) or (b)(3), so (b) requires no further
// disaggregation of them. For state and local income tax that is confirmed affirmatively by BC39:
// the Board decided not to require further disaggregation under (b) and required the qualitative
// majority disclosure of 740-10-50-12B instead.
const DISAGGREGATION = {
  state_and_local_income_tax_net_of_federal: null,
  foreign_tax_effects: 'by_jurisdiction_and_by_nature',
  effect_of_changes_in_tax_laws_or_rates_enacted_current_period: null,
  effect_of_cross_border_tax_laws: 'by_nature',
  tax_credits: 'by_nature',
  changes_in_valuation_allowances: null,
  nontaxable_or_nondeductible_items: 'by_nature',
  changes_in_unrecognized_tax_benefits: null,
  other_not_listed: 'by_nature',
};

const DISAGGREGATION_CITATION = {
  foreign_tax_effects: 'ASC 740-10-50-12A(b)(2)',
  effect_of_cross_border_tax_laws: 'ASC 740-10-50-12A(b)(1)',
  tax_credits: 'ASC 740-10-50-12A(b)(1)',
  nontaxable_or_nondeductible_items: 'ASC 740-10-50-12A(b)(1)',
  other_not_listed: 'ASC 740-10-50-12A(b)(3)',
  state_and_local_income_tax_net_of_federal: 'ASC 740-10-50-12A(b); ASC 740-10-50-12B',
};

// BC38 records that the Board considered and DECLINED to give guidance on applying the threshold at
// or around break even, or where the domicile has no or minimal statutory rates, and expects the
// entity to apply judgment. This node therefore draws NO numeric break even band: inventing one
// would assert a rule the Board explicitly withheld. The note is standing, the caveat below fires
// only on definite conditions.
const BREAK_EVEN_NOTE =
  'ASU 2023-09 BC38 records that the Board considered and declined to provide guidance on applying ' +
  'the 5 percent threshold where an entity operates at or around break even or is domiciled in a ' +
  'jurisdiction with no or minimal statutory income tax rates, and expects the entity to apply ' +
  'judgment. This node draws no numeric break even band for that reason.';

const ZERO_BASE_CAVEAT =
  'The threshold base is zero, so every amount clears it trivially and a verdict would be an ' +
  'artefact of the degenerate denominator rather than a reading of ASC 740-10-50-12A(b). Reported ' +
  'as not assessable under ASU 2023-09 BC38 rather than divided silently.';

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

export function compute(pp) {
  const raw_category = pp.reconciling_item_category ?? null;
  const category_recognized =
    typeof raw_category === 'string' &&
    Object.prototype.hasOwnProperty.call(DISAGGREGATION, raw_category);
  const reconciling_item_category = category_recognized ? raw_category : null;

  const E = isFiniteNumber(pp.reconciling_item_amount) ? pp.reconciling_item_amount : null;
  const P = isFiniteNumber(pp.pretax_income) ? pp.pretax_income : null;
  const R = isFiniteNumber(pp.statutory_rate_pct) ? pp.statutory_rate_pct : null;
  const entity_is_public_business_entity = pp.entity_is_public_business_entity === true;

  let threshold_base_amount = null;
  let threshold_amount = null;
  let pct_of_threshold_base = null;
  let crosses_5pct_threshold = null;
  let denominator_near_zero_caveat = null;
  let management_judgment_required = false;
  let not_assessable_reason = null;

  // A negative statutory rate is rejected as out of domain. That is a DECLARED engineering guard,
  // not a clause finding: the Update presumes a statutory tax rate and says nothing about a
  // negative one.
  const inputs_valid = E !== null && P !== null && R !== null && R >= 0;

  if (!inputs_valid) {
    management_judgment_required = true;
    not_assessable_reason =
      'reconciling_item_amount, pretax_income and statutory_rate_pct must each be a finite number ' +
      'and statutory_rate_pct must not be negative. One or more fell outside the declared domain, ' +
      'so no threshold verdict is returned.';
  } else {
    const base_product = P * R; // 100 x the threshold base, kept unrounded for the comparison
    const abs_base_product = Math.abs(base_product);

    if (!Number.isFinite(base_product)) {
      management_judgment_required = true;
      denominator_near_zero_caveat = null;
      not_assessable_reason =
        'The product of pretax_income and statutory_rate_pct overflowed to a non finite value, so ' +
        'the threshold base is not representable and no verdict is returned.';
    } else if (abs_base_product === 0) {
      // P === 0, R === 0, or a product that underflowed to zero. All three are the BC38 case.
      threshold_base_amount = 0;
      threshold_amount = 0;
      management_judgment_required = true;
      denominator_near_zero_caveat = ZERO_BASE_CAVEAT;
      not_assessable_reason =
        'Zero threshold base: pretax_income or statutory_rate_pct is zero, or their product ' +
        'underflowed to zero.';
    } else {
      // Display only. Both divisions happen AFTER the verdict is decided and never feed it.
      threshold_base_amount = base_product / 100;
      threshold_amount = base_product / 2000;

      // THE DECISION. Exact cross multiplication, absolute value both sides, per BC35.
      // |E| * 2000 >= |P * R|  is equivalent to  |E| >= |P * R / 2000|  without ever forming the
      // inexact constant 0.05 or dividing.
      const lhs = Math.abs(E) * 2000;
      if (Number.isFinite(lhs)) {
        crosses_5pct_threshold = lhs >= abs_base_product;
      } else {
        // |E| * 2000 overflowed while the base is finite. An effect that large is unambiguously
        // above the threshold, so the verdict is sound even though the scaled value is not
        // representable.
        crosses_5pct_threshold = true;
      }

      // Withholding an unrepresentable display ratio must never withhold a verdict that cross
      // multiplication already decided correctly.
      const pct = (Math.abs(E) / abs_base_product) * 10000;
      pct_of_threshold_base = Number.isFinite(pct) ? pct : null;
    }
  }

  // 740-10-50-12A opens on a public business entity. 740-10-50-13 gives entities other than public
  // business entities a qualitative requirement over the same categories and explicitly does not
  // require a numerical reconciliation, so the separate disclosure obligation of 50-12A cannot
  // attach to them. Returning true for a non public business entity would be a false compliance
  // claim, which is why the arithmetic fact and the legal consequence are separate fields.
  let must_disclose_separately;
  if (!entity_is_public_business_entity) {
    must_disclose_separately = false;
  } else if (crosses_5pct_threshold === null) {
    must_disclose_separately = null;
  } else {
    must_disclose_separately = crosses_5pct_threshold;
  }

  const required_disaggregation = category_recognized ? DISAGGREGATION[raw_category] : null;
  const disaggregation_citation = category_recognized
    ? (DISAGGREGATION_CITATION[raw_category] ?? 'ASC 740-10-50-12A(b)')
    : null;

  let basis;
  if (!entity_is_public_business_entity) {
    basis =
      'ASC 740-10-50-12A applies to a public business entity. entity_is_public_business_entity is ' +
      'false, so the separate disclosure requirement of 50-12A(b) does not attach; ASC 740-10-50-13 ' +
      'requires a qualitative disclosure over the same categories instead and does not require a ' +
      'numerical reconciliation. The threshold arithmetic is still reported for information.';
  } else if (crosses_5pct_threshold === true) {
    basis =
      'The absolute value of the reconciling item effect is equal to or greater than the absolute ' +
      'value of 5 percent of continuing operations pretax income multiplied by the applicable ' +
      'statutory federal or national rate of the domicile jurisdiction, so ASC 740-10-50-12A(b) ' +
      'requires separate disclosure. Comparison taken in absolute amount on both sides per ASU ' +
      '2023-09 BC35.';
  } else if (crosses_5pct_threshold === false) {
    basis =
      'The absolute value of the reconciling item effect is below the absolute value of 5 percent ' +
      'of the threshold base, so ASC 740-10-50-12A(b) does not require separate disclosure of this ' +
      'item at the level of aggregation the caller declared.';
  } else {
    basis =
      'No threshold verdict is returned. ' + (not_assessable_reason ?? '') +
      ' ASC 740-10-50-12C separately requires the entity to explain individual reconciling items ' +
      'and the judgment used in categorising them.';
  }

  const compliance_flags = ['ASC740_RATE_REC_THRESHOLD_CLASSIFIED'];
  if (crosses_5pct_threshold === true) compliance_flags.push('ASC740_RATE_REC_THRESHOLD_MET');
  else if (crosses_5pct_threshold === false) compliance_flags.push('ASC740_RATE_REC_THRESHOLD_NOT_MET');
  if (must_disclose_separately === true) compliance_flags.push('ASC740_RATE_REC_SEPARATE_DISCLOSURE_REQUIRED');
  if (!entity_is_public_business_entity) compliance_flags.push('ASC740_RATE_REC_NON_PBE_QUALITATIVE_ONLY');
  if (denominator_near_zero_caveat !== null) compliance_flags.push('ASC740_RATE_REC_DEGENERATE_BASE');
  if (management_judgment_required) compliance_flags.push('ASC740_RATE_REC_MANUAL_REVIEW_REQUIRED');
  if (!category_recognized) compliance_flags.push('ASC740_RATE_REC_CATEGORY_OUTSIDE_DECLARED_DOMAIN');
  if (required_disaggregation !== null) compliance_flags.push('ASC740_RATE_REC_DISAGGREGATION_REQUIRED');

  return {
    output_payload: {
      reconciling_item_category,
      category_recognized,
      reconciling_item_amount: E,
      pretax_income: P,
      statutory_rate_pct: R,
      entity_is_public_business_entity,
      threshold_base_amount,
      threshold_amount,
      pct_of_threshold_base,
      crosses_5pct_threshold,
      must_disclose_separately,
      required_disaggregation,
      disaggregation_citation,
      denominator_near_zero_caveat,
      management_judgment_required,
      not_assessable_reason,
      break_even_judgment_note: BREAK_EVEN_NOTE,
      citation: 'ASC 740-10-50-12A(a) and (b); ASU 2023-09 BC35 and BC38',
      basis,
    },
    compliance_flags,
  };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
