import { executionHash } from './_hash.mjs';

// art-636-globe-transition-deferred-tax-tracker — GloBE Article 9.1 transition deferred-tax
// tracker. Per-item recast of pre-regime deferred tax attributes under the Article 9.1
// transition rules, plus the jurisdictional roll-forward total.
//
// Spec (with the retrieved clause text, the pinned digests and both findings):
//   research/PILLAR2-DTTRANSITION-K-1.spec.md  (workspace root, untracked)
//
// Rule sources, both retrieved and sha256-pinned by the building row on 2026-08-17:
//   A. OECD GloBE Model Rules (Pillar Two), December 2021 — Article 9.1 (9.1.1–9.1.3).
//   B. OECD Administrative Guidance on Article 9.1, approved 13 January 2025 — revised
//      Commentary paragraphs 6.4, 8–8.12 and 10.8, and worked Example 9.1.2-1.
// Article numbering note: the transitional SBIE rate schedule is Article 9.2, not 9.1;
// Article 9.1 is the deferred-tax transition this kernel implements. See the spec file's
// finding 1. No operative source text is reproduced here — paragraph references only.
//
// WHAT THIS KERNEL DOES
//   Article 9.1.1: attributes are taken into account at the lower of the Minimum Rate or
//   the applicable domestic tax rate. A deferred tax asset recorded below the Minimum Rate
//   may be taken at the Minimum Rate where the taxpayer demonstrates it is attributable to
//   a GloBE Loss — the one path on which a recast exceeds the uncapped figure. Valuation and
//   accounting-recognition adjustments are disregarded.
//   Article 9.1.2: an attribute is excluded where a declared exclusion limb holds and, for
//   the date-keyed limbs, the attribute arose strictly after the cut-off.
//   Article 9.1.3: an intra-group transfer after the cut-off and before the Transition Year
//   is recast on the disposing entity's carrying value.
//
// WHAT THIS KERNEL DOES NOT DO — verify-only, never tax advice. It does not characterize an
// attribute, does not decide whether an arrangement is governmental, does not decide whether
// a GloBE-Loss demonstration succeeds, and does not compute the Grace Period or Grace Period
// Limitation (Commentary 8.8-8.12), which govern deferred tax expense on reversal in later
// years under a different computation. Characterization stays with the filer: where one is
// absent the item carries manual_review_required.
//
// EVERY year-indexed or guidance-dependent value — the Minimum Rate, the cut-off date, the
// Transition Year start and the enabled exclusion set — arrives inside policy_parameters, so
// execution_hash binds the rule vintage and a guidance change never moves kernel_digest.
//
// DETERMINISM: compute() is a pure function of pp. No Date, no Math.random, no network, no
// filesystem, no TextEncoder/atob/btoa/URL. Dates are compared as YYYYMMDD integer keys
// parsed by hand. Zero network, zero PII.

const TOOL_ID = 'art-636-globe-transition-deferred-tax-tracker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'track_globe_transition_deferred_tax',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ---------------------------------------------------------------------------
// Declared constants. MAX_DTA_ITEMS bounds the item array as a KERNEL CONSTANT,
// never a policy parameter — a parameter-driven loop bound is the GPU-cycle
// static pre-screen's SLOW shape, and an over-length input is a named error
// rather than a longer loop.
// ---------------------------------------------------------------------------
const MAX_DTA_ITEMS = 500;
const MONEY_PRECISION = 2;
const RATE_PRECISION = 10;

const CANONICAL_ORDER = 'arising_date asc, attribute_type asc, carrying_amount asc, input_index asc';

const ATTRIBUTE_TYPES = [
  'deferred_tax_asset',
  'deferred_tax_asset_from_globe_loss',
  'deferred_tax_liability',
];

// Declared evaluation order. The first enabled limb that holds supplies
// exclusion_reason, so the reported code is deterministic when more than one
// limb would hold on the same item.
const EXCLUSION_CODES = [
  'EXCL_NOT_REFLECTABLE_UNDER_AFAS',            // Commentary 6.4 as revised (not date-keyed)
  'EXCL_CH3_ITEM_POST_CUTOFF',                  // Art 9.1.2 + Commentary 8, 8.1, 8.2
  'EXCL_GOVERNMENTAL_ARRANGEMENT_POST_CUTOFF',  // Commentary 8.3, 8.4, 8.5(a)
  'EXCL_RETROACTIVE_ELECTION_POST_CUTOFF',      // Commentary 8.5(b)
  'EXCL_NEW_CIT_BASIS_STEP_UP_POST_CUTOFF',     // Commentary 8.5(c)
];

// The three Commentary 8.5 categories, whose exclusion leaves the separate
// Grace Period determination unmade (Commentary 8.8-8.12, out of scope).
const PARA_8_5_CODES = [
  'EXCL_GOVERNMENTAL_ARRANGEMENT_POST_CUTOFF',
  'EXCL_RETROACTIVE_ELECTION_POST_CUTOFF',
  'EXCL_NEW_CIT_BASIS_STEP_UP_POST_CUTOFF',
];

const POW10 = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10];

// ---------------------------------------------------------------------------
// Deterministic helpers, inlined (never imported — RIDER-KERNEL's
// inline-_detmath-never-import rule).
// ---------------------------------------------------------------------------

// half_up: ties round AWAY FROM ZERO, both signs. -0 is normalized to 0 so a
// signed zero can never reach the output payload or the canonical preimage.
function roundAt(x, p) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return 0;
  const f = POW10[p];
  const scaled = x * f;
  const nearest = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
  const out = nearest / f;
  return out === 0 ? 0 : out;
}

function isFiniteNumber(v) { return typeof v === 'number' && Number.isFinite(v); }
function isBool(v) { return v === true || v === false; }

function daysInMonth(y, m) {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  if (m === 4 || m === 6 || m === 9 || m === 11) return 30;
  return 31;
}

// "YYYY-MM-DD" -> YYYYMMDD integer, or null when the string is not a real
// calendar date. No Date object is constructed anywhere in this kernel.
function dateKey(s) {
  if (typeof s !== 'string' || s.length !== 10) return null;
  if (s.charAt(4) !== '-' || s.charAt(7) !== '-') return null;
  for (let i = 0; i < 10; i++) {
    if (i === 4 || i === 7) continue;
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return null;
  }
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > daysInMonth(y, m)) return null;
  return y * 10000 + m * 100 + d;
}

// rounding_steps is a CONSTANT four entries on every path, including every
// error path — P28's step-count parity, and P27's anti-fabrication: neither
// Article 9.1 nor the January-2025 guidance specifies a rounding mode or
// precision anywhere, so every oracle is the literal declared-silent string.
function roundingSteps() {
  return [
    { step: 'cap_rate_selection', expression: 'min(minimum_rate, domestic_tax_rate)', precision: RATE_PRECISION, mode: 'half_up', oracle: 'declared — clause silent' },
    { step: 'temporary_difference_derivation', expression: 'basis_amount / recorded_at_rate', precision: MONEY_PRECISION, mode: 'half_up', oracle: 'declared — clause silent' },
    { step: 'per_item_recast', expression: 'temporary_difference * rate_applied', precision: MONEY_PRECISION, mode: 'half_up', oracle: 'declared — clause silent' },
    { step: 'jurisdictional_roll_forward_sum', expression: 'canonical-order sum of the reported per-item recasts', precision: MONEY_PRECISION, mode: 'half_up', oracle: 'declared — clause silent' },
  ];
}

function errorResult(code, note, flags) {
  return {
    output_payload: {
      constants_version: null,
      minimum_rate: null,
      cutoff_date: null,
      transition_year_start_date: null,
      exclusion_rules: [],
      canonical_order: CANONICAL_ORDER,
      items: null,
      item_count: 0,
      items_excluded: 0,
      items_capped: 0,
      items_uplifted: 0,
      items_in_error: 0,
      items_manual_review: 0,
      jurisdictional_roll_forward_total: null,
      total_is_complete: false,
      error_code: code,
      note,
      rounding_steps: roundingSteps(),
    },
    compliance_flags: flags,
  };
}

// ---------------------------------------------------------------------------
// Per-item evaluation.
// ---------------------------------------------------------------------------
function evaluateItem(raw, idx, ctx) {
  const item = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

  const rec = {
    input_index: idx,
    attribute_type: null,
    arising_date: typeof item.arising_date === 'string' ? item.arising_date : null,
    arising_date_key: null,
    carrying_amount: isFiniteNumber(item.carrying_amount) ? item.carrying_amount : null,
    basis_amount: null,
    basis_source: null,
    recorded_at_rate: isFiniteNumber(item.recorded_at_rate) ? item.recorded_at_rate : null,
    domestic_tax_rate: isFiniteNumber(item.domestic_tax_rate) ? item.domestic_tax_rate : null,
    cap_rate: null,
    rate_applied: null,
    temporary_difference: null,
    recast_amount: null,
    capped: false,
    uplifted: false,
    excluded: false,
    exclusion_reason: null,
    manual_review_required: false,
    review_reasons: [],
    error_code: null,
  };

  // --- attribute type: closed enum, exactly what the retrieved text closes ---
  if (ATTRIBUTE_TYPES.indexOf(item.attribute_type) === -1) {
    rec.error_code = 'ERR_UNKNOWN_ATTRIBUTE_TYPE';
    rec.manual_review_required = true;
    rec.review_reasons.push('attribute_type is not one of the three declared values');
    return rec;
  }
  rec.attribute_type = item.attribute_type;

  // --- arising date ---
  const aKey = dateKey(item.arising_date);
  if (aKey === null) {
    rec.error_code = 'ERR_ARISING_DATE_INVALID';
    rec.manual_review_required = true;
    rec.review_reasons.push('arising_date is not a YYYY-MM-DD calendar date');
    return rec;
  }
  rec.arising_date_key = aKey;
  const postCutoff = aKey > ctx.cutoffKey; // Art 9.1.2: strictly AFTER the cut-off

  // --- characterization completeness: absent characterization is the filer's,
  //     never inferred, never defaulted to false (Art 9.1.2 / Commentary 8.x) ---
  const charKeys = [
    'arises_from_chapter3_excluded_item',
    'arises_from_governmental_arrangement',
    'arises_from_retroactive_election',
    'arises_from_new_cit_basis_step_up',
    'reflectable_under_authorised_accounting_standard',
  ];
  for (let i = 0; i < charKeys.length; i++) {
    if (!isBool(item[charKeys[i]])) {
      rec.manual_review_required = true;
      rec.review_reasons.push('characterization absent: ' + charKeys[i]);
    }
  }

  // --- Article 9.1.2 / Commentary 6.4 exclusion, in declared code order ---
  for (let i = 0; i < EXCLUSION_CODES.length && rec.exclusion_reason === null; i++) {
    const code = EXCLUSION_CODES[i];
    if (ctx.enabled.indexOf(code) === -1) continue;
    let holds = false;
    if (code === 'EXCL_NOT_REFLECTABLE_UNDER_AFAS') {
      holds = item.reflectable_under_authorised_accounting_standard === false;
    } else if (code === 'EXCL_CH3_ITEM_POST_CUTOFF') {
      holds = item.arises_from_chapter3_excluded_item === true && postCutoff;
    } else if (code === 'EXCL_GOVERNMENTAL_ARRANGEMENT_POST_CUTOFF') {
      holds = item.arises_from_governmental_arrangement === true && postCutoff;
    } else if (code === 'EXCL_RETROACTIVE_ELECTION_POST_CUTOFF') {
      holds = item.arises_from_retroactive_election === true && postCutoff;
    } else if (code === 'EXCL_NEW_CIT_BASIS_STEP_UP_POST_CUTOFF') {
      holds = item.arises_from_new_cit_basis_step_up === true && postCutoff;
    }
    if (holds) rec.exclusion_reason = code;
  }

  if (item.arises_under_newly_enacted_cit === true) {
    // Commentary 8.7's five-year pre-enactment loss test needs dates this node
    // does not take. Declared unapplied rather than silently approximated.
    rec.manual_review_required = true;
    rec.review_reasons.push('NEWLY_ENACTED_CIT_FIVE_YEAR_TEST_NOT_APPLIED');
  }

  if (rec.exclusion_reason !== null) {
    // Excluded from the Article 9.1.1 computation: contributes EXACTLY zero, and
    // is still reported, never merely omitted.
    rec.excluded = true;
    rec.recast_amount = 0;
    if (PARA_8_5_CODES.indexOf(rec.exclusion_reason) !== -1) {
      rec.manual_review_required = true;
      rec.review_reasons.push('GRACE_PERIOD_DETERMINATION_NOT_MADE');
    }
    return rec;
  }

  // --- basis, in declared precedence:
  //     reported carrying amount -> valuation-adjustment gross -> Art 9.1.3 basis
  if (!isFiniteNumber(item.carrying_amount)) {
    rec.error_code = 'ERR_CARRYING_AMOUNT_MISSING';
    rec.manual_review_required = true;
    rec.review_reasons.push('carrying_amount is not a finite number');
    return rec;
  }
  let basis = item.carrying_amount;
  let basisSource = 'reported_carrying_amount';

  if (item.valuation_adjustment_reflected === true) {
    // Art 9.1.1 final sentence: the impact of a valuation or accounting
    // recognition adjustment is disregarded. Requires the gross figure; its
    // absence is a named error, never a silently un-adjusted recast.
    if (!isFiniteNumber(item.carrying_amount_gross_of_valuation_adjustment)) {
      rec.error_code = 'ERR_GROSS_CARRYING_AMOUNT_MISSING';
      rec.manual_review_required = true;
      rec.review_reasons.push('valuation adjustment declared reflected but no gross carrying amount supplied');
      return rec;
    }
    basis = item.carrying_amount_gross_of_valuation_adjustment;
    basisSource = 'gross_of_valuation_adjustment';
  }

  if (item.arises_from_intra_group_transfer === true) {
    if (ctx.transitionKey === null) {
      rec.error_code = 'ERR_TRANSITION_YEAR_START_MISSING';
      rec.manual_review_required = true;
      rec.review_reasons.push('Art 9.1.3 window needs transition_year_start_date');
      return rec;
    }
    // Art 9.1.3: after the cut-off AND before the commencement of a Transition Year.
    if (postCutoff && aKey < ctx.transitionKey) {
      if (!isFiniteNumber(item.disposing_entity_carrying_value)) {
        rec.error_code = 'ERR_INTRA_GROUP_BASIS_MISSING';
        rec.manual_review_required = true;
        rec.review_reasons.push('Art 9.1.3 applies but disposing_entity_carrying_value was not supplied');
        return rec;
      }
      basis = item.disposing_entity_carrying_value;
      basisSource = 'disposing_entity_carrying_value';
    }
  } else if (!isBool(item.arises_from_intra_group_transfer)) {
    rec.manual_review_required = true;
    rec.review_reasons.push('characterization absent: arises_from_intra_group_transfer');
  }

  rec.basis_amount = basis;
  rec.basis_source = basisSource;

  // --- rates ---
  if (!isFiniteNumber(item.recorded_at_rate) || item.recorded_at_rate <= 0) {
    rec.error_code = 'ERR_RECORDED_RATE_NOT_POSITIVE';
    rec.manual_review_required = true;
    rec.review_reasons.push('recorded_at_rate must be a finite number greater than zero to derive the temporary difference');
    return rec;
  }
  if (!isFiniteNumber(item.domestic_tax_rate) || item.domestic_tax_rate < 0) {
    rec.error_code = 'ERR_DOMESTIC_RATE_MISSING';
    rec.manual_review_required = true;
    rec.review_reasons.push('domestic_tax_rate must be a finite non-negative number');
    return rec;
  }

  // rounding step 1 — the Art 9.1.1 lower-of rate
  const capRate = roundAt(Math.min(ctx.minimumRate, item.domestic_tax_rate), RATE_PRECISION);
  rec.cap_rate = capRate;

  // The general rule is a CAP, not an upward re-measurement. An attribute already
  // recorded at or below the lower-of rate is left where it is — Example 9.1.2-1
  // states this from the other side ("no recast because ... recorded at or below
  // the Minimum Rate"), and it is what leaves sentence three's GloBE-Loss uplift
  // any work to do. Applying the lower-of rate unconditionally would re-rate
  // below-rate assets upward and make that sentence redundant.
  let rateApplied = roundAt(Math.min(capRate, item.recorded_at_rate), RATE_PRECISION);
  const upliftEligible = rec.attribute_type === 'deferred_tax_asset_from_globe_loss'
    && item.recorded_at_rate < ctx.minimumRate;
  if (upliftEligible) {
    if (item.globe_loss_demonstrated === true) {
      // Art 9.1.1 third sentence — the express, evidence-gated exception. This is
      // the ONLY path on which a recast exceeds the uncapped figure.
      rateApplied = roundAt(ctx.minimumRate, RATE_PRECISION);
      rec.uplifted = true;
    } else {
      rec.manual_review_required = true;
      rec.review_reasons.push('GLOBE_LOSS_UPLIFT_CLAIMED_WITHOUT_DEMONSTRATION');
    }
  }
  rec.rate_applied = rateApplied;
  rec.capped = rateApplied < item.recorded_at_rate;

  // rounding step 2 — temporary difference implied by the recorded attribute
  rec.temporary_difference = roundAt(basis / item.recorded_at_rate, MONEY_PRECISION);
  // rounding step 3 — the recast
  rec.recast_amount = roundAt(rec.temporary_difference * rateApplied, MONEY_PRECISION);

  return rec;
}

// Total order — input_index is the final tiebreak, so no two items compare
// equal and the order can never fall back to input order.
function canonicalCompare(a, b) {
  const ak = a.arising_date_key === null ? -1 : a.arising_date_key;
  const bk = b.arising_date_key === null ? -1 : b.arising_date_key;
  if (ak !== bk) return ak < bk ? -1 : 1;
  const at = a.attribute_type === null ? '' : a.attribute_type;
  const bt = b.attribute_type === null ? '' : b.attribute_type;
  if (at !== bt) return at < bt ? -1 : 1;
  const ac = a.carrying_amount === null ? -Infinity : a.carrying_amount;
  const bc = b.carrying_amount === null ? -Infinity : b.carrying_amount;
  if (ac !== bc) return ac < bc ? -1 : 1;
  return a.input_index < b.input_index ? -1 : 1;
}

export function compute(pp) {
  pp = pp !== null && typeof pp === 'object' && !Array.isArray(pp) ? pp : {};
  const flags = [];

  const constants_version = typeof pp.constants_version === 'string' ? pp.constants_version : null;
  if (constants_version === null) flags.push('DTT_CONSTANTS_VERSION_ABSENT');

  if (!isFiniteNumber(pp.minimum_rate) || pp.minimum_rate <= 0) {
    flags.push('DTT_ERROR');
    return errorResult('ERR_MINIMUM_RATE_MISSING',
      'minimum_rate must be supplied as a finite positive policy parameter; it is never a kernel constant.', flags);
  }
  const cutoffKey = dateKey(pp.cutoff_date);
  if (cutoffKey === null) {
    flags.push('DTT_ERROR');
    return errorResult('ERR_CUTOFF_DATE_INVALID',
      'cutoff_date must be supplied as a YYYY-MM-DD policy parameter.', flags);
  }
  const transitionSupplied = pp.transition_year_start_date !== undefined && pp.transition_year_start_date !== null;
  const transitionKey = transitionSupplied ? dateKey(pp.transition_year_start_date) : null;
  if (transitionSupplied && transitionKey === null) {
    flags.push('DTT_ERROR');
    return errorResult('ERR_TRANSITION_YEAR_START_INVALID',
      'transition_year_start_date, when supplied, must be a YYYY-MM-DD policy parameter.', flags);
  }

  const rawRules = Array.isArray(pp.exclusion_rules) ? pp.exclusion_rules : null;
  if (rawRules === null) {
    flags.push('DTT_ERROR');
    return errorResult('ERR_EXCLUSION_RULES_MISSING',
      'exclusion_rules must be supplied as a versioned array of named exclusion codes.', flags);
  }
  for (let i = 0; i < rawRules.length; i++) {
    if (EXCLUSION_CODES.indexOf(rawRules[i]) === -1) {
      flags.push('DTT_ERROR');
      return errorResult('ERR_UNKNOWN_EXCLUSION_RULE',
        'exclusion_rules carries a code this kernel does not implement; a guidance change is a parameter version bump against a kernel that knows the code.', flags);
    }
  }
  const enabled = EXCLUSION_CODES.filter(function (c) { return rawRules.indexOf(c) !== -1; });

  const rawItems = Array.isArray(pp.items) ? pp.items : null;
  if (rawItems === null) {
    flags.push('DTT_ERROR');
    return errorResult('ERR_ITEMS_MISSING', 'items must be supplied as an array of deferred tax attributes.', flags);
  }
  if (rawItems.length > MAX_DTA_ITEMS) {
    // Named error, never a longer loop and never a silent truncation.
    flags.push('DTT_ERROR');
    flags.push('DTT_MAX_DTA_ITEMS_EXCEEDED');
    return errorResult('ERR_MAX_DTA_ITEMS_EXCEEDED',
      'items exceeds the declared MAX_DTA_ITEMS bound of ' + MAX_DTA_ITEMS + '; no recast was computed.', flags);
  }

  const ctx = { minimumRate: pp.minimum_rate, cutoffKey: cutoffKey, transitionKey: transitionKey, enabled: enabled };

  const records = [];
  for (let i = 0; i < rawItems.length; i++) records.push(evaluateItem(rawItems[i], i, ctx));
  records.sort(canonicalCompare);

  // rounding step 4 — canonical-order sum of the REPORTED recasts. Summing the
  // already-rounded reported values and re-rounding at the same precision is
  // idempotent, so the total is byte-identical to their sum, never "within
  // tolerance".
  let running = 0;
  let itemsInError = 0, itemsExcluded = 0, itemsCapped = 0, itemsUplifted = 0, itemsManual = 0;
  const items = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.error_code !== null) itemsInError++;
    if (r.excluded) itemsExcluded++;
    if (r.capped) itemsCapped++;
    if (r.uplifted) itemsUplifted++;
    if (r.manual_review_required) itemsManual++;
    if (typeof r.recast_amount === 'number') running = running + r.recast_amount;
    items.push({
      input_index: r.input_index,
      attribute_type: r.attribute_type,
      arising_date: r.arising_date,
      carrying_amount: r.carrying_amount,
      basis_amount: r.basis_amount,
      basis_source: r.basis_source,
      recorded_at_rate: r.recorded_at_rate,
      domestic_tax_rate: r.domestic_tax_rate,
      cap_rate: r.cap_rate,
      rate_applied: r.rate_applied,
      temporary_difference: r.temporary_difference,
      recast_amount: r.recast_amount,
      capped: r.capped,
      uplifted: r.uplifted,
      excluded: r.excluded,
      exclusion_reason: r.exclusion_reason,
      manual_review_required: r.manual_review_required,
      review_reasons: r.review_reasons,
      error_code: r.error_code,
    });
  }
  const total = roundAt(running, MONEY_PRECISION);

  if (itemsExcluded > 0) flags.push('DTT_ITEMS_EXCLUDED');
  if (itemsCapped > 0) flags.push('DTT_ITEMS_CAPPED');
  if (itemsUplifted > 0) flags.push('DTT_GLOBE_LOSS_UPLIFT_APPLIED');
  if (itemsManual > 0) flags.push('DTT_MANUAL_REVIEW_REQUIRED');
  if (itemsInError > 0) { flags.push('DTT_ITEMS_IN_ERROR'); flags.push('DTT_TOTAL_INCOMPLETE'); }
  flags.push('DTT_TRANSITION_RECAST_COMPUTED');

  return {
    output_payload: {
      constants_version: constants_version,
      minimum_rate: pp.minimum_rate,
      cutoff_date: pp.cutoff_date,
      transition_year_start_date: transitionKey === null ? null : pp.transition_year_start_date,
      exclusion_rules: enabled,
      canonical_order: CANONICAL_ORDER,
      items: items,
      item_count: items.length,
      items_excluded: itemsExcluded,
      items_capped: itemsCapped,
      items_uplifted: itemsUplifted,
      items_in_error: itemsInError,
      items_manual_review: itemsManual,
      jurisdictional_roll_forward_total: total,
      total_is_complete: itemsInError === 0,
      error_code: null,
      note: 'Recomputes the Article 9.1 transition recast from caller-declared attributes and versioned policy parameters. Characterization and any GloBE-Loss demonstration stay with the filer. Grace Period treatment under Commentary 8.8-8.12 is a separate determination this node does not make.',
      rounding_steps: roundingSteps(),
    },
    compliance_flags: flags,
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
