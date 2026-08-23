import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-235-test-hpml-escrow';
const TOOL_VERSION = '2.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'test_hpml_escrow',
  mandate_type: 'compliance_mandate', gpu: false,
};

// BEHAVIOUR ONLY. Every paragraph reference, clause digest and retrieval date for the rules
// encoded below lives in this node's metadata (description / regulatory_basis /
// cited_clause_digest), never in this file.
//
// WHAT THIS KERNEL DECIDES, in evaluation order:
//   1. Is the transaction a higher-priced mortgage loan? APR minus APOR against a tiered
//      spread threshold (standard first lien / jumbo first lien / subordinate lien).
//   2. Does an escrow account have to be established? Only first-lien higher-priced
//      transactions carry the requirement; subordinate liens never do.
//   3. Five categorical carve-outs remove the requirement outright, ahead of any
//      creditor-size arithmetic: cooperative shares, initial-construction financing, a
//      bridge loan of twelve months or less, a reverse mortgage, and a PACE transaction.
//   4. Two alternative small-originator exemption paths. Both are CONJUNCTIVE and both are
//      denied when any leg they need is unanswered:
//        path 1 — FOUR legs: (A) an area test, (B) a transferred-transaction count,
//                 (C) a total-assets test against an indexed limit, and (D) the creditor
//                 and its affiliates maintain no other escrow accounts outside two
//                 carve-outs. Leg (D) is a RESTRICTION: omitting it grants the exemption to
//                 creditors the rule denies it to, which is the defect this rebuild closes.
//        path 2 — an insured depository institution or insured credit union route: an
//                 institution-only asset test (affiliates NOT counted), a first-lien
//                 principal-dwelling transaction count that DOES include portfolio-retained
//                 loans, and legs (A) and (D) of path 1.
//   5. A forward-commitment override. A loan subject at consummation to a commitment to be
//      acquired by a person who does not itself satisfy either exemption path must escrow
//      anyway, notwithstanding paths 1 and 2 — unless a categorical carve-out already
//      applied.
//   6. A LIMITED exemption for dwellings in a common interest community whose governing
//      association maintains a master insurance policy. It removes the INSURANCE-PREMIUM
//      component only. The property-tax escrow survives it. Treating it as a total
//      exemption is the second defect this rebuild closes.
//
// LOOK-BACK. Legs (A), (B) and (C) are each satisfied if EITHER candidate year qualifies:
// the year immediately preceding consummation always, and the year before that when the
// application was received before April 1 of the consummation year. That is a DISJUNCTION
// over years, not a single-year lookup, so each of those legs takes a preceding-year input
// and an optional next-to-last-year input.
//
// THRESHOLDS. The two asset limits are indexed annually and are therefore DATED TABLE
// ENTRIES keyed on the consummation year, with a caller-supplied versioned-parameter
// override in the same shape art-637 uses. A year the table does not cover and that the
// caller does not supply is INDETERMINATE — never a silent default to a stale figure.
// The two transaction counts are fixed statutory figures and are plain constants.
//
// CONSERVATIVE DIRECTION. Every unanswerable leg denies the exemption rather than granting
// it, and raises manual_review_required. An exemption that cannot be evidenced is not an
// exemption.
//
// DETERMINISM: compute() is a pure function of pp — no Date.now(), no Math.random(), no
// network, no filesystem, no transcendentals, no unbounded loops. It runs unmodified inside
// the QuickJS-ng zkVM guest, which lacks TextEncoder/atob/btoa/URL; none is used here.

// Spread tiers. Structural statutory percentages, not indexed, unchanged since 2014.
const HPML_SPREADS = {
  first_lien_standard_pp: 1.5,
  first_lien_jumbo_pp: 2.5,
  subordinate_lien_pp: 3.5,
};

// Fixed statutory transaction counts. Neither is indexed.
const TRANSFERRED_FIRST_LIEN_TXN_LIMIT = 2000;
const FIRST_LIEN_PRINCIPAL_DWELLING_TXN_LIMIT = 1000;

// Indexed asset limits, keyed on the calendar year of consummation. Only years whose
// published figure has been retrieved appear here; an absent year is indeterminate unless
// the caller supplies the limit as a versioned parameter.
const SMALL_ORIGINATOR_ASSET_LIMIT_BY_YEAR = {
  2026: 2_785_000_000,
};
const INSURED_INSTITUTION_ASSET_LIMIT_BY_YEAR = {
  2026: 12_485_000_000,
};

// The two escrow-maintenance carve-outs leg (D) allows, echoed so a reader can see exactly
// what the caller was asked to attest to.
const CARVE_OUT_APPLICATION_WINDOW_FROM = '2010-04-01';
const CARVE_OUT_APPLICATION_WINDOW_BEFORE = '2021-06-17';

// Input names retired by this rebuild. Each encoded a wrong figure or a wrong unit, so a
// caller still sending one is held for review rather than silently reinterpreted.
const RETIRED_INPUT_KEYS = [
  'creditor_assets_under_2b',
  'loan_count_under_500',
  'is_rural_or_underserved',
  'property_is_condo_master_policy',
];

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function r4(v) { return Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0; }

/** Strict finite number. Rejects strings, booleans, null and undefined alike. */
function num(v) { return (typeof v === 'number' && Number.isFinite(v)) ? v : null; }

/** Strict boolean. Returns null when the caller did not answer at all. */
function bool(v) { return typeof v === 'boolean' ? v : null; }

/** ISO calendar date, exactly YYYY-MM-DD, with in-range month and day. */
function isoDate(v) {
  if (typeof v !== 'string' || v.length !== 10) return null;
  if (v[4] !== '-' || v[7] !== '-') return null;
  for (let i = 0; i < 10; i++) {
    if (i === 4 || i === 7) continue;
    const c = v.charCodeAt(i);
    if (c < 48 || c > 57) return null;
  }
  const mm = Number(v.slice(5, 7));
  const dd = Number(v.slice(8, 10));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return v;
}

/**
 * Reads one versioned threshold parameter. Accepts either a bare number or the
 * (value, effective_from, effective_to, source, source_digest) tuple, the same shape
 * art-637 reads — one versioning pattern across the estate, never a second.
 */
function readVersionedParam(raw) {
  if (num(raw) !== null) return { value: raw, provenance: null };
  if (raw && typeof raw === 'object' && num(raw.value) !== null) {
    return {
      value: raw.value,
      provenance: {
        effective_from: typeof raw.effective_from === 'string' ? raw.effective_from : null,
        effective_to: typeof raw.effective_to === 'string' ? raw.effective_to : null,
        source: typeof raw.source === 'string' ? raw.source : null,
        source_digest: typeof raw.source_digest === 'string' ? raw.source_digest : null,
      },
    };
  }
  return { value: null, provenance: null };
}

/**
 * Resolves an indexed limit for one calendar year: caller-supplied versioned parameter
 * first, then the dated table, then nothing.
 */
function resolveLimit(table, callerParam, year) {
  const supplied = readVersionedParam(callerParam);
  if (supplied.value !== null) {
    return { value: supplied.value, source: 'caller_versioned_parameter', provenance: supplied.provenance };
  }
  const tabled = Object.prototype.hasOwnProperty.call(table, String(year)) ? table[String(year)] : null;
  if (num(tabled) !== null) {
    return { value: tabled, source: 'dated_table_' + year, provenance: null };
  }
  return { value: null, source: 'unresolved', provenance: null };
}

export function compute(pp) {
  pp = pp || {};
  const notes = [];
  let manualReview = false;

  const apr_pct = safeNum(pp.apr_pct, 0);
  const apor_pct = safeNum(pp.apor_pct, 0);
  const lien_type = pp.lien_type === 'subordinate' ? 'subordinate' : 'first';
  const is_jumbo = Boolean(pp.is_jumbo);
  const year = Math.round(safeNum(pp.year, 2026));

  // ---- Retired-input tripwire -------------------------------------------------------
  const retiredPresent = [];
  for (const k of RETIRED_INPUT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(pp, k)) retiredPresent.push(k);
  }
  if (retiredPresent.length > 0) {
    manualReview = true;
    notes.push('Retired input key(s) present and IGNORED: ' + retiredPresent.join(', ') + '. Each encoded a superseded figure, a wrong counting unit, or a carve-out that is narrower than the rule. Re-send under the current input names before relying on this result.');
  }

  // ---- 1. Higher-priced test --------------------------------------------------------
  let spread_threshold, spread_basis;
  if (lien_type === 'subordinate') {
    spread_threshold = HPML_SPREADS.subordinate_lien_pp;
    spread_basis = 'subordinate_lien_3.5pp';
  } else if (is_jumbo) {
    spread_threshold = HPML_SPREADS.first_lien_jumbo_pp;
    spread_basis = 'first_lien_jumbo_2.5pp';
  } else {
    spread_threshold = HPML_SPREADS.first_lien_standard_pp;
    spread_basis = 'first_lien_standard_1.5pp';
  }
  const apr_spread = r4(apr_pct - apor_pct);
  const is_hpml = apr_spread >= spread_threshold - 1e-5;

  // ---- 2. Baseline escrow obligation ------------------------------------------------
  const escrow_in_scope = is_hpml && lien_type === 'first';

  // ---- Look-back grace --------------------------------------------------------------
  const applicationDate = isoDate(pp.application_received_date);
  const declaredGrace = bool(pp.application_received_before_april_1);
  let grace = false;
  let graceSource = 'not_claimed';
  if (applicationDate !== null) {
    grace = applicationDate < (String(year) + '-04-01');
    graceSource = 'derived_from_application_received_date';
  } else if (declaredGrace !== null) {
    grace = declaredGrace;
    graceSource = 'caller_declared_boolean';
  }

  // ---- Leg (A): area test ------------------------------------------------------------
  // Kept a caller-attested boolean by design: the underlying rural/underserved
  // determination runs off census-block and county datasets that cannot be evaluated
  // in-kernel. That boundary is declared, not silently assumed.
  const legA_preceding = bool(pp.rural_or_underserved_preceding_year);
  const legA_nextToLast = bool(pp.rural_or_underserved_next_to_last_year);

  // ---- Leg (B): transferred first-lien covered transactions, creditor AND affiliates --
  // Counts only transactions sold, assigned or otherwise transferred to another person, or
  // subject at consummation to a commitment to be acquired. Portfolio-retained loans are
  // OUTSIDE this count.
  const legB_preceding = num(pp.first_lien_covered_txns_sold_or_transferred_count);
  const legB_nextToLast = num(pp.first_lien_covered_txns_sold_or_transferred_count_next_to_last_year);

  // ---- Leg (C): total assets of creditor plus affiliates against the indexed limit ----
  const legC_preceding = num(pp.creditor_and_affiliate_total_assets);
  const legC_nextToLast = num(pp.creditor_and_affiliate_total_assets_next_to_last_year);
  const thresholdParams = (pp.threshold_parameters && typeof pp.threshold_parameters === 'object') ? pp.threshold_parameters : {};
  const smallLimit = resolveLimit(SMALL_ORIGINATOR_ASSET_LIMIT_BY_YEAR, thresholdParams.small_originator_asset_limit, year);
  const smallLimitPrior = resolveLimit(SMALL_ORIGINATOR_ASSET_LIMIT_BY_YEAR, thresholdParams.small_originator_asset_limit_next_to_last_year, year - 1);

  // ---- Leg (D): no other escrow accounts maintained, outside two carve-outs -----------
  const maintainsOther = bool(pp.maintains_escrow_for_serviced_loans);
  const withinCarveOuts = bool(pp.serviced_escrows_within_carve_outs);
  const carveOutPriorHpml = bool(pp.carve_out_pre_june_2021_first_lien_hpml_escrows);
  const carveOutDistressed = bool(pp.carve_out_distressed_consumer_accommodation_escrows);

  // Which exemption path is the caller actually claiming? Legs (A) and (D) are SHARED by
  // both paths, so their presence alone does not mean the four-leg path is being claimed —
  // an institution claiming the alternative path must supply them too. Only inputs unique
  // to the four-leg path (its count and its assets test) claim it unambiguously.
  const isInsuredInstitution = bool(pp.creditor_is_insured_depository_or_credit_union);
  const fourLegOwnInputsPresent = (
    legB_preceding !== null || legB_nextToLast !== null ||
    legC_preceding !== null || legC_nextToLast !== null
  );
  const sharedLegInputsPresent = (
    legA_preceding !== null || legA_nextToLast !== null ||
    maintainsOther !== null || withinCarveOuts !== null
  );
  const smallCreditorInputsPresent = fourLegOwnInputsPresent
    || (sharedLegInputsPresent && isInsuredInstitution !== true);

  function evalLegA() {
    if (legA_preceding === true) return true;
    if (grace && legA_nextToLast === true) return true;
    if (legA_preceding === null && (!grace || legA_nextToLast === null)) return null;
    return false;
  }
  function evalLegB() {
    if (legB_preceding !== null && legB_preceding <= TRANSFERRED_FIRST_LIEN_TXN_LIMIT) return true;
    if (grace && legB_nextToLast !== null && legB_nextToLast <= TRANSFERRED_FIRST_LIEN_TXN_LIMIT) return true;
    if (legB_preceding === null && (!grace || legB_nextToLast === null)) return null;
    return false;
  }
  function evalLegC() {
    if (legC_preceding !== null && smallLimit.value !== null && legC_preceding < smallLimit.value) return true;
    if (grace && legC_nextToLast !== null && smallLimitPrior.value !== null && legC_nextToLast < smallLimitPrior.value) return true;
    const primaryAnswerable = legC_preceding !== null && smallLimit.value !== null;
    const graceAnswerable = grace && legC_nextToLast !== null && smallLimitPrior.value !== null;
    if (!primaryAnswerable && !graceAnswerable) return null;
    return false;
  }
  function evalLegD() {
    if (maintainsOther === null) return null;
    if (maintainsOther === false) return true;
    if (withinCarveOuts !== true) return false;
    // The caller says every maintained escrow sits inside a carve-out. At least one of the
    // two carve-outs has to be named, otherwise the attestation names nothing.
    if (carveOutPriorHpml !== true && carveOutDistressed !== true) return null;
    return true;
  }

  let legA = null, legB = null, legC = null, legD = null;
  let smallStatus = 'not_claimed';
  let smallSatisfied = false;
  if (escrow_in_scope && smallCreditorInputsPresent) {
    legA = evalLegA();
    legB = evalLegB();
    legC = evalLegC();
    legD = evalLegD();
    const legs = [legA, legB, legC, legD];
    if (legs.some((l) => l === false)) {
      smallStatus = 'not_satisfied';
    } else if (legs.some((l) => l === null)) {
      smallStatus = 'incomplete';
      manualReview = true;
      const missing = [];
      if (legA === null) missing.push('area test (A)');
      if (legB === null) missing.push('transferred first-lien transaction count (B)');
      if (legC === null) missing.push('total assets against the indexed limit (C)');
      if (legD === null) missing.push('no other escrow accounts maintained (D)');
      notes.push('Small-originator exemption NOT granted: ' + missing.join('; ') + ' could not be evaluated from the inputs supplied. All four legs are required and an unevaluable leg denies the exemption.');
    } else {
      smallStatus = 'satisfied';
      smallSatisfied = true;
    }
  }

  // ---- Alternative path: insured depository institution or insured credit union -------
  // Its asset test counts the institution ALONE; its transaction count counts the creditor
  // and its affiliates and DOES include portfolio-retained first-lien principal-dwelling
  // loans, which is the opposite of leg (B) above.
  const insAssets = num(pp.insured_institution_total_assets);
  const insAssetsNextToLast = num(pp.insured_institution_total_assets_next_to_last_year);
  const insCount = num(pp.first_lien_principal_dwelling_covered_txns_count);
  const insCountNextToLast = num(pp.first_lien_principal_dwelling_covered_txns_count_next_to_last_year);
  const insLimit = resolveLimit(INSURED_INSTITUTION_ASSET_LIMIT_BY_YEAR, thresholdParams.insured_institution_asset_limit, year);
  const insLimitPrior = resolveLimit(INSURED_INSTITUTION_ASSET_LIMIT_BY_YEAR, thresholdParams.insured_institution_asset_limit_next_to_last_year, year - 1);

  function evalInsA() {
    if (insAssets !== null && insLimit.value !== null && insAssets <= insLimit.value) return true;
    if (grace && insAssetsNextToLast !== null && insLimitPrior.value !== null && insAssetsNextToLast <= insLimitPrior.value) return true;
    const primaryAnswerable = insAssets !== null && insLimit.value !== null;
    const graceAnswerable = grace && insAssetsNextToLast !== null && insLimitPrior.value !== null;
    if (!primaryAnswerable && !graceAnswerable) return null;
    return false;
  }
  function evalInsB() {
    if (insCount !== null && insCount <= FIRST_LIEN_PRINCIPAL_DWELLING_TXN_LIMIT) return true;
    if (grace && insCountNextToLast !== null && insCountNextToLast <= FIRST_LIEN_PRINCIPAL_DWELLING_TXN_LIMIT) return true;
    if (insCount === null && (!grace || insCountNextToLast === null)) return null;
    return false;
  }

  let insA = null, insB = null, insC = null;
  let insStatus = 'not_claimed';
  let insSatisfied = false;
  if (escrow_in_scope && isInsuredInstitution === true) {
    insA = evalInsA();
    insB = evalInsB();
    // Leg (C) of this path is legs (A) and (D) of the four-leg path, taken together.
    const borrowedA = legA === null ? evalLegA() : legA;
    const borrowedD = legD === null ? evalLegD() : legD;
    if (borrowedA === null || borrowedD === null) insC = null;
    else insC = borrowedA === true && borrowedD === true;
    const legs = [insA, insB, insC];
    if (legs.some((l) => l === false)) {
      insStatus = 'not_satisfied';
    } else if (legs.some((l) => l === null)) {
      insStatus = 'incomplete';
      manualReview = true;
      notes.push('Insured-institution exemption NOT granted: one or more of its three legs could not be evaluated from the inputs supplied. An unevaluable leg denies the exemption.');
    } else {
      insStatus = 'satisfied';
      insSatisfied = true;
    }
  }

  // ---- 3. Categorical carve-outs, ahead of both size paths ----------------------------
  const CATEGORICAL = [
    ['secured_by_cooperative_shares', 'cooperative_shares'],
    ['finances_initial_construction_of_dwelling', 'initial_construction'],
    ['is_bridge_loan_twelve_months_or_less', 'bridge_loan_twelve_months_or_less'],
    ['is_reverse_mortgage', 'reverse_mortgage'],
    ['is_pace_transaction', 'pace_transaction'],
  ];
  let categorical_exemption = null;
  if (escrow_in_scope) {
    for (const [key, label] of CATEGORICAL) {
      if (pp[key] === true) { categorical_exemption = label; break; }
    }
  }

  // ---- 5. Forward-commitment override -------------------------------------------------
  const subjectToCommitment = bool(pp.subject_to_commitment_to_be_acquired);
  const acquirerQualifies = bool(pp.acquiring_person_satisfies_exemption_conditions);

  // ---- Assemble the verdict ------------------------------------------------------------
  let escrow_required = escrow_in_scope;
  let escrow_exemption = null;
  let escrow_exemption_basis = null;
  let forward_commitment_override_applied = false;

  if (escrow_in_scope) {
    if (categorical_exemption !== null) {
      escrow_required = false;
      escrow_exemption = 'categorical_' + categorical_exemption;
      escrow_exemption_basis = 'Categorical carve-out: the transaction is outside the escrow requirement entirely (' + categorical_exemption.replace(/_/g, ' ') + '). No creditor-size test is reached.';
    } else if (smallSatisfied || insSatisfied) {
      const pathKey = smallSatisfied ? 'rural_or_underserved_small_creditor' : 'insured_depository_or_credit_union_small_originator';
      if (subjectToCommitment === true && acquirerQualifies !== true) {
        forward_commitment_override_applied = true;
        escrow_required = true;
        if (acquirerQualifies === null) {
          manualReview = true;
          notes.push('Forward-commitment override applied on an UNANSWERED acquirer test: the loan is subject at consummation to a commitment to be acquired, and it was not stated whether the acquiring person itself satisfies an exemption path. The override is applied because an unevidenced acquirer cannot lift a requirement.');
        } else {
          notes.push('Forward-commitment override applied: the creditor satisfies an exemption path, but the loan is subject at consummation to a commitment to be acquired by a person who does not, so the escrow account is required notwithstanding that path.');
        }
      } else {
        escrow_required = false;
        escrow_exemption = pathKey;
        escrow_exemption_basis = smallSatisfied
          ? 'Four-leg small-originator exemption satisfied: area test met; no more than ' + TRANSFERRED_FIRST_LIEN_TXN_LIMIT + ' first-lien covered transactions sold, assigned or otherwise transferred by the creditor and its affiliates in a qualifying look-back year; total assets of creditor and affiliates below the indexed limit; and no other escrow accounts maintained outside the two carve-outs.'
          : 'Insured depository institution or insured credit union exemption satisfied: institution assets at or below the indexed limit; no more than ' + FIRST_LIEN_PRINCIPAL_DWELLING_TXN_LIMIT + ' first-lien principal-dwelling covered transactions extended by the creditor and its affiliates, portfolio-retained loans included; and the area and no-other-escrows legs both met.';
      }
    }
  }

  // ---- 6. Limited exemption: insurance premiums only ------------------------------------
  const cicMasterPolicy = pp.property_in_common_interest_community_with_master_policy === true;
  let escrow_property_taxes_required = escrow_required;
  let escrow_insurance_premiums_required = escrow_required;
  let escrow_limited_exemption = null;
  let escrow_limited_exemption_basis = null;
  if (escrow_required && cicMasterPolicy) {
    escrow_insurance_premiums_required = false;
    escrow_limited_exemption = 'common_interest_community_master_policy';
    escrow_limited_exemption_basis = 'LIMITED exemption only: where the governing association maintains a master policy insuring all dwellings, insurance premiums need not be included in the escrow account. The escrow account itself is still required, and property taxes must still be escrowed.';
  }

  const compliance_flags = [];
  if (is_hpml) compliance_flags.push('HPML_LOAN');
  if (escrow_required) compliance_flags.push('HPML_ESCROW_REQUIRED');
  if (escrow_exemption) compliance_flags.push('HPML_ESCROW_EXEMPTION_APPLIES');
  if (escrow_limited_exemption) compliance_flags.push('HPML_ESCROW_INSURANCE_PREMIUMS_EXEMPT_TAXES_STILL_REQUIRED');
  if (forward_commitment_override_applied) compliance_flags.push('HPML_ESCROW_FORWARD_COMMITMENT_OVERRIDE');
  if (is_hpml && lien_type === 'subordinate') compliance_flags.push('HPML_SUBORDINATE_NO_ESCROW');
  if (smallStatus === 'incomplete' || insStatus === 'incomplete') compliance_flags.push('HPML_ESCROW_EXEMPTION_INPUTS_INCOMPLETE');
  if (retiredPresent.length > 0) compliance_flags.push('HPML_RETIRED_INPUT_KEY_PRESENT');
  if (manualReview) compliance_flags.push('HPML_MANUAL_REVIEW_REQUIRED');

  const output_payload = {
    is_hpml,
    escrow_required,
    escrow_property_taxes_required,
    escrow_insurance_premiums_required,
    escrow_exemption,
    escrow_exemption_basis,
    escrow_limited_exemption,
    escrow_limited_exemption_basis,
    categorical_exemption,
    forward_commitment_override_applied,
    small_originator_test: {
      status: smallStatus,
      leg_a_area: legA,
      leg_b_transferred_txn_count: legB,
      leg_c_assets: legC,
      leg_d_no_other_escrows: legD,
      transferred_txn_limit: TRANSFERRED_FIRST_LIEN_TXN_LIMIT,
      asset_limit_applied: smallLimit.value,
      asset_limit_source: smallLimit.source,
      asset_limit_provenance: smallLimit.provenance,
    },
    insured_institution_test: {
      status: insStatus,
      leg_a_assets: insA,
      leg_b_first_lien_principal_dwelling_count: insB,
      leg_c_area_and_no_other_escrows: insC,
      txn_limit: FIRST_LIEN_PRINCIPAL_DWELLING_TXN_LIMIT,
      asset_limit_applied: insLimit.value,
      asset_limit_source: insLimit.source,
      asset_limit_provenance: insLimit.provenance,
    },
    look_back: {
      application_before_april_1_grace: grace,
      grace_source: graceSource,
      candidate_years: grace ? [year - 1, year - 2] : [year - 1],
    },
    carve_out_window: {
      applications_received_from: CARVE_OUT_APPLICATION_WINDOW_FROM,
      applications_received_before: CARVE_OUT_APPLICATION_WINDOW_BEFORE,
      distressed_consumer_accommodations: true,
    },
    apr_spread_pct: apr_spread,
    apr_pct: r4(apr_pct),
    apor_pct: r4(apor_pct),
    lien_type,
    is_jumbo,
    spread_threshold_pct: spread_threshold,
    spread_threshold_basis: spread_basis,
    year,
    manual_review_required: manualReview,
    retired_input_keys_present: retiredPresent,
    compliance_notes: notes,
    input_contract_version: 'HPML-ESCROW-INPUTS-2',
    table_version: 'HPML-ESCROW-2026-08-19',
    consumes: 'art-220 (lookup_reg_z_thresholds) supplies the higher-priced spread table. The spread tiers are structural statutory percentages and are not indexed; the two asset limits ARE indexed annually and are carried as dated table entries here.',
    note: 'The escrow requirement reaches first-lien higher-priced transactions only; subordinate liens are never in scope. escrow_required is the account; escrow_property_taxes_required and escrow_insurance_premiums_required are its two components, and the common-interest-community master-policy exemption removes the insurance component ALONE. APOR must be supplied by the caller from the FFIEC weekly table. For the high-cost trigger test use art-234 (test_hoepa_high_cost), not this node.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
