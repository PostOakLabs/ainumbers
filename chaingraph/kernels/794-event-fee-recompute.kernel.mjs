import { executionHash } from './_hash.mjs';

// 794-event-fee-recompute — recomputes event-contract trading fees per fill and per
// order from an effective-dated venue fee profile, and diffs the recompute against a
// caller-reported fee. Venue-neutral: the fee family and its parameters are DATA
// (effective-dated profile rows), Kalshi / Polymarket global / Polymarket US are
// shipped profile rows, and `generic` takes every parameter from the caller.
//
// Fee families (closed set): parabolic (theta x C x p x (1-p)), multiplier
// (parabolic x series multiplier), linear (theta x C), flat (fixed micro per
// contract), rebate_share (maker rebate = declared share of the taker-equivalent
// fee; never a negative theta), combo (legs[] priced by the profile rule per leg).
//
// Rounding and the accumulator (Kalshi profile): per-fill trade fee rounded to the
// profile's fill unit; rounding overpayment carries across the order's fills in an
// accumulator and is rebated in increments of the order rounding unit, capped so a
// fill's net fee cannot go negative. Without an accumulator profile the carry is 0.
//
// Integer arithmetic only. Every fee path is BigInt: theta numerators/denominators
// are integers, prices are integer micro-dollars (1e-6 USD), and intermediate
// products exceed 2^53 for real order sizes. No floats anywhere in a fee path.
//
// Refusals (reachable, fixture-covered): an unknown profile id; a malformed as_of;
// any order_label or outcome label that looks like an account id, order id,
// address or hash (identifier-like values are never echoed); malformed order
// fields; generic profile without declared params; inputs outside the bounded
// domain (<= 100 orders, <= 500 fills total, contracts <= 1e9).
//
// Pure ECMA-262: no Date.now/Math.random/network/filesystem; no Math.pow on fee
// paths. compute() is a pure function of pp.

const TOOL_ID = '794-event-fee-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'recompute_event_contract_fee',
  mandate_type: 'compliance_control', gpu: false,
};

// ---------- integer helpers (BigInt everywhere in fee paths) ----------
const MICRO = 1000000n;
const B = (n) => BigInt(n);
function ceilDiv(a, b) { // a >= 0, b > 0
  return (a + b - 1n) / b;
}
function roundHalfUpDiv(a, b) { // a >= 0, b > 0; ties round up
  return (2n * a + b) / (2n * b);
}
function snapToUnit(x, unit) { // x >= 0, unit >= 1
  if (unit === 1n) return x;
  return roundHalfUpDiv(x, unit) * unit;
}
// BigInt-safe output: values up to 2^53-1 stay numbers, larger become decimal strings
function numOut(v) {
  return v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString();
}

// ---------- profile table (effective-dated DATA rows) ----------
// Row shape mirrors Kalshi GET /series/fee_changes (series_ticker, fee_type,
// fee_multiplier, scheduled_ts) as effective-dated rows; a scheduled change is one
// new row. Profiles are ALSO shipped as a data file at
// chaingraph/kernels/fixtures/794-event-fee-recompute.profiles.json (the zkVM guest
// cannot read files, so this table is the embedded copy).
const KALSHI_PIN = 'docs.kalshi.com/getting_started/fee_rounding + kalshi.com/fee-schedule (pinned 2026-10-31; snapshots sha256 706043bc / fb7b72c8)';
const PM_GLOBAL_PIN = 'docs.polymarket.com/trading/fees (pinned 2026-10-31; snapshot sha256 2b2b8dcc)';
const PM_US_PIN = 'CFTC 40.6(d) weekly notifications 2026-07-07 and 2026-09-29 (pinned 2026-10-31; snapshots sha256 2fef3084 / 9860f229)';
const PM_US_PRE_PIN = 'research/kalshi-event-contract-rows-2026-10-30 section 2 (theta 0.05 before the 2026-07-07 filing; research-sourced, caller-overridable)';

const PROFILES = {
  kalshi: {
    venue_label: 'Kalshi', accumulator: true,
    source_pin: KALSHI_PIN,
    rows: [{
      effective_from: '1970-01-01', effective_to: null,
      family: 'multiplier',
      theta_taker: { num: 7, den: 100 },       // $0.07-$1.75 taker per 100 contracts -> theta 0.07 of par
      theta_maker: { num: 0, den: 1 },         // most markets: no maker fees ("-" on the pinned schedule)
      theta_maker_combo: { num: 7, den: 200 }, // combos: maker fees = 50% of taker (pinned)
      series_multiplier: { num: 1, den: 1 },
      fill_rounding_unit_micro: 1,             // per-fill trade fee ceil to $0.000001 (pinned)
      order_rounding_unit_micro: 10000,        // non-direct member $0.01 rebate grid (pinned)
      rounding_mode: 'ceil',
    }],
  },
  polymarket_global: {
    venue_label: 'Polymarket (global)', accumulator: false,
    source_pin: PM_GLOBAL_PIN,
    category_theta: {
      crypto: { num: 7, den: 100 }, sports: { num: 1, den: 20 },
      finance: { num: 1, den: 25 }, politics: { num: 1, den: 25 },
      economics: { num: 1, den: 20 }, culture: { num: 1, den: 20 },
      weather: { num: 1, den: 20 }, other: { num: 1, den: 20 },
      mentions: { num: 1, den: 25 }, tech: { num: 1, den: 25 },
      combos: { num: 1, den: 20 },
    },
    category_rebate_bp: {
      crypto: 2000, sports: 1500, finance: 2500, politics: 2500,
      economics: 2500, culture: 2500, weather: 2500, other: 2500,
      mentions: 2500, tech: 2500, combos: 0,
    },
    rows: [{
      effective_from: '1970-01-01', effective_to: null,
      family: 'parabolic',
      theta_taker: { num: 1, den: 1 }, // placeholder; the CATEGORY table above governs taker theta
      theta_maker: { num: 0, den: 1 },
      series_multiplier: { num: 1, den: 1 },
      fill_rounding_unit_micro: 10,    // fees rounded to 5 decimal places (pinned)
      order_rounding_unit_micro: 0,    // no order accumulator on the global venue
      rounding_mode: 'round_half_up',
      floor_min_fee_micro: 10,         // smallest fee charged is 0.00001 USDC; smaller rounds to zero (pinned)
    }],
  },
  polymarket_us: {
    venue_label: 'Polymarket US', accumulator: false,
    source_pin: PM_US_PIN,
    combo_surcharge_from: '2026-09-25', // combo taker Fee = C*p*[0.0695(1-p) + 0.04(1-p)^4] (pinned letter 2026-09-29, Exhibit A)
    rows: [
      {
        effective_from: '1970-01-01', effective_to: '2026-07-06',
        family: 'parabolic',
        theta_taker: { num: 5, den: 100 },
        theta_maker: { num: 0, den: 1 },
        series_multiplier: { num: 1, den: 1 },
        fill_rounding_unit_micro: 10, order_rounding_unit_micro: 0,
        rounding_mode: 'ceil',
        source_pin: PM_US_PRE_PIN,
      },
      {
        effective_from: '2026-07-07', effective_to: '2026-09-16',
        family: 'parabolic',
        theta_taker: { num: 6, den: 100 }, // letter 2026-07-07: taker coefficient raised 0.05 -> 0.06 (pinned)
        theta_maker: { num: 0, den: 1 },
        series_multiplier: { num: 1, den: 1 },
        fill_rounding_unit_micro: 10, order_rounding_unit_micro: 0,
        rounding_mode: 'ceil',
      },
      {
        effective_from: '2026-09-17', effective_to: null,
        family: 'parabolic',
        theta_taker: { num: 695, den: 10000 }, // letter 2026-09-29: straight trades Fee = 0.0695*C*p*(1-p) (pinned)
        theta_maker: { num: 0, den: 1 },
        series_multiplier: { num: 1, den: 1 },
        fill_rounding_unit_micro: 10, order_rounding_unit_micro: 0,
        rounding_mode: 'ceil',
      },
    ],
  },
};

const GENERIC_FAMILIES = ['parabolic', 'multiplier', 'linear', 'flat', 'rebate_share', 'combo'];
const MAX_ORDERS = 100;
const MAX_FILLS_TOTAL = 500;
const MAX_CONTRACTS = 1000000000;

// ---------- refusal helpers ----------
function looksIdentifierLike(s) {
  if (typeof s !== 'string' || s.length === 0) return false;
  if (/^0x[0-9a-fA-F]+$/.test(s)) return true;       // hex address / tx hash
  if (/^[0-9a-fA-F]{16,}$/.test(s)) return true;     // bare hex hash
  if (/\d{12,}/.test(s)) return true;                // long digit run (account / order id)
  if (s.length >= 32 && !/\s/.test(s)) return true;  // opaque hash-like blob
  return false;
}
function isPosInt(x) { return typeof x === 'number' && Number.isInteger(x) && x >= 1; }

// ISO YYYY-MM-DD calendar-date check (pure arithmetic, no Date)
function isCalendarDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = +m[1]; const mo = +m[2]; const d = +m[3];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return d <= dim;
}

function refuse(flags, because, field, extra) {
  flags.push('REFUSED_MALFORMED_OR_IDENTIFIER_INPUT');
  const payload = {
    verdict: 'refused',
    refused_because: because,
    manual_review_required: true,
    evidence: { record_type: 'event_contract_fee_recompute', tool_id: TOOL_ID, tool_version: TOOL_VERSION, refused: true },
  };
  if (field !== null && field !== undefined) payload.refused_field = field;
  if (extra) Object.assign(payload, extra);
  return { output_payload: payload, compliance_flags: flags };
}

// ---------- effective-row selection (ISO date strings compare lexicographically) ----------
function selectRow(rows, asOf) {
  let hit = null;
  for (const r of rows) {
    if (asOf >= r.effective_from && (!r.effective_to || asOf <= r.effective_to)) hit = r;
  }
  return hit; // latest matching row wins
}

// ---------- raw fee numerator/denominator per fill (exact BigInt, micro-dollars) ----------
function rawFillFee(row, theta, C, pm, usComboActive) {
  if (usComboActive) {
    // Fee = C x p x [0.0695(1-p) + 0.04(1-p)^4] dollars:
    // micro = C * pm * (695*(1e6-pm)*1e16 + 4*(1e6-pm)^4) / 1e26
    const oneMinus = MICRO - B(pm);
    const num = B(C) * B(pm) * (695n * oneMinus * 10000000000000000n + 4n * oneMinus * oneMinus * oneMinus * oneMinus);
    return { num, den: 100000000000000000000000000n };
  }
  const family = row.family;
  const mult = row.series_multiplier || { num: 1, den: 1 };
  if (family === 'flat') {
    const flat = row.flat_fee_micro !== undefined ? B(row.flat_fee_micro) : 0n;
    return { num: flat * B(C) * B(mult.num), den: B(mult.den), exact: true };
  }
  if (family === 'linear') {
    return { num: B(theta.num) * B(C) * MICRO * B(mult.num), den: B(theta.den) * B(mult.den) };
  }
  // parabolic / multiplier / rebate_share taker-equivalent: theta x C x p x (1-p)
  return {
    num: B(theta.num) * B(C) * B(pm) * (MICRO - B(pm)) * B(mult.num),
    den: B(theta.den) * MICRO * B(mult.den),
  };
}

function roundFee(num, den, mode, unitBig, floorMinBig) {
  let x = mode === 'round_half_up' ? roundHalfUpDiv(num, den) : ceilDiv(num, den);
  x = snapToUnit(x, unitBig);
  if (floorMinBig > 0n && x < floorMinBig) x = 0n; // below the minimum fee rounds to zero (pinned Polymarket rule)
  return x;
}

// ---------- compute ----------
export function compute(pp) {
  pp = pp || {};
  const flags = [];

  // -- profile id --
  const profileId = pp.profile;
  if (typeof profileId !== 'string') return refuse(flags, 'profile_must_be_a_string', 'profile');
  const shipped = Object.prototype.hasOwnProperty.call(PROFILES, profileId);
  if (!shipped && profileId !== 'generic') {
    flags.push('REFUSED_UNKNOWN_PROFILE');
    return refuse(flags, 'unknown_profile', 'profile', { requested_profile: profileId });
  }

  // -- as_of --
  const asOf = pp.as_of;
  if (typeof asOf !== 'string' || !isCalendarDate(asOf)) {
    return refuse(flags, 'as_of_must_be_iso_date', 'as_of');
  }

  // -- orders list --
  const orders = pp.orders;
  if (!Array.isArray(orders) || orders.length < 1) return refuse(flags, 'orders_must_be_nonempty_array', 'orders');
  if (orders.length > MAX_ORDERS) return refuse(flags, 'orders_exceed_bounded_domain_100', 'orders');

  // -- generic params / caller-declared effective rows --
  let genActive = null;
  if (profileId === 'generic') {
    const params = pp.params;
    if (!params || typeof params !== 'object') return refuse(flags, 'generic_profile_requires_params', 'params');
    if (Array.isArray(params.rows)) {
      for (const r of params.rows) {
        if (!r || typeof r.effective_from !== 'string' || !GENERIC_FAMILIES.includes(r.fee_family)) {
          return refuse(flags, 'generic_row_missing_effective_from_or_family', 'params.rows');
        }
      }
      genActive = selectRow(params.rows, asOf);
      if (!genActive) return refuse(flags, 'no_generic_row_effective_at_as_of', 'params.rows');
    } else if (typeof params.fee_family !== 'string' || !GENERIC_FAMILIES.includes(params.fee_family)) {
      return refuse(flags, 'generic_fee_family_unknown', 'params.fee_family');
    } else {
      genActive = params;
    }
  }

  // -- resolve the effective venue row + theta by role --
  const prof = shipped ? PROFILES[profileId] : null;
  let row = null;
  let rowPin = null;
  let catTheta = null;
  let rebateBp = null;
  let usComboActive = false;
  if (shipped) {
    row = selectRow(prof.rows, asOf);
    if (!row) return refuse(flags, 'no_profile_row_effective_at_as_of', 'as_of');
    rowPin = row.source_pin !== undefined ? row.source_pin : prof.source_pin;
    if (profileId === 'polymarket_global') {
      const cat = typeof pp.category === 'string' && pp.category !== '' ? pp.category : 'other';
      if (!Object.prototype.hasOwnProperty.call(prof.category_theta, cat)) {
        return refuse(flags, 'unknown_category', 'category', { requested_category: cat });
      }
      catTheta = prof.category_theta[cat];
      rebateBp = prof.category_rebate_bp[cat];
      if (cat === 'combos') row = Object.assign({}, row, { family: 'parabolic' });
    }
    if (profileId === 'polymarket_us' && prof.combo_surcharge_from && asOf >= prof.combo_surcharge_from) {
      usComboActive = true;
    }
  }

  const family = shipped ? row.family : genActive.fee_family;
  const effMult = shipped
    ? (row.series_multiplier || { num: 1, den: 1 })
    : (genActive.series_multiplier_num !== undefined
      ? { num: genActive.series_multiplier_num, den: genActive.series_multiplier_den !== undefined ? genActive.series_multiplier_den : 1 }
      : { num: 1, den: 1 });
  const roundingMode = shipped ? row.rounding_mode : genActive.rounding_mode;
  const fillUnit = shipped ? row.fill_rounding_unit_micro : genActive.fill_rounding_unit_micro;
  let orderUnit = shipped ? row.order_rounding_unit_micro : (genActive.order_rounding_unit_micro !== undefined ? genActive.order_rounding_unit_micro : 0);
  if (profileId === 'kalshi' && pp.balance_precision_micro === 100) orderUnit = 100; // direct member $0.0001 grid (pinned)
  if (roundingMode !== 'ceil' && roundingMode !== 'round_half_up') return refuse(flags, 'rounding_mode_must_be_ceil_or_round_half_up', 'rounding_mode');
  if (!(typeof fillUnit === 'number' && Number.isInteger(fillUnit) && fillUnit >= 1)) return refuse(flags, 'fill_rounding_unit_micro_must_be_positive_int', 'fill_rounding_unit_micro');
  if (!(typeof orderUnit === 'number' && Number.isInteger(orderUnit) && orderUnit >= 0)) return refuse(flags, 'order_rounding_unit_micro_must_be_nonnegative_int', 'order_rounding_unit_micro');
  const acc = shipped ? (profileId === 'kalshi' && prof.accumulator && orderUnit > 0) : (orderUnit > 0 && genActive.accumulator === true);

  function thetaFor(role, kind) {
    if (!shipped) {
      // flat prices a fixed micro amount per contract; theta does not apply
      if (genActive.fee_family === 'flat') return { num: 0, den: 1 };
      const isMaker = role === 'maker';
      const num = isMaker && genActive.theta_maker_num !== undefined ? genActive.theta_maker_num : genActive.theta_taker_num;
      const den = isMaker && genActive.theta_maker_den !== undefined ? genActive.theta_maker_den : genActive.theta_taker_den;
      if (!Number.isInteger(num) || !Number.isInteger(den) || den <= 0 || num < 0) return null;
      return { num, den };
    }
    if (profileId === 'polymarket_global') {
      if (role === 'maker') return { num: 0, den: 1 };
      return catTheta;
    }
    if (profileId === 'polymarket_us') return role === 'maker' ? { num: 0, den: 1 } : row.theta_taker;
    // kalshi: combo maker fills price at 50% of taker; most-series maker fees are 0
    if (role === 'maker') return kind === 'combo' ? row.theta_maker_combo : row.theta_maker;
    return row.theta_taker;
  }
  const takerTheta = thetaFor('taker', 'standard');
  const makerTheta = thetaFor('maker', 'standard');
  if (!takerTheta || !makerTheta) return refuse(flags, 'theta_num_den_must_be_nonnegative_integers', 'theta');

  // rebate_share: maker rebate = declared share of the taker-equivalent fee, never a negative theta
  let rebateShareBp = null;
  if (family === 'rebate_share') {
    if (shipped) return refuse(flags, 'rebate_share_family_is_generic_only', 'fee_family');
    rebateShareBp = genActive.rebate_share_bp;
    if (!Number.isInteger(rebateShareBp) || rebateShareBp < 0 || rebateShareBp > 10000) {
      return refuse(flags, 'rebate_share_bp_must_be_0_to_10000', 'rebate_share_bp');
    }
  }
  if (family === 'flat' && !shipped && !Number.isInteger(genActive.flat_fee_micro)) {
    return refuse(flags, 'flat_family_requires_flat_fee_micro', 'flat_fee_micro');
  }

  // -- per-order computation --
  let fillsTotal = 0;
  const perOrder = [];
  let totalFee = 0n;
  let fillsSum = 0n;

  for (let oi = 0; oi < orders.length; oi++) {
    const o = orders[oi] || {};
    const label = o.order_label;
    if (typeof label !== 'string' || label.length === 0 || label.length > 64) {
      return refuse(flags, 'order_label_must_be_short_opaque_string', 'orders[' + oi + '].order_label');
    }
    if (looksIdentifierLike(label)) {
      flags.push('IDENTIFIER_LIKE_FIELD_REFUSED');
      return refuse(flags, 'identifier_like_order_label_refused', 'orders[' + oi + '].order_label', { requested_profile: profileId });
    }
    const role = o.role;
    if (role !== 'taker' && role !== 'maker') return refuse(flags, 'role_must_be_taker_or_maker', 'orders[' + oi + '].role');
    const kind = o.kind === undefined ? 'standard' : o.kind;
    if (kind !== 'standard' && kind !== 'combo') return refuse(flags, 'kind_must_be_standard_or_combo', 'orders[' + oi + '].kind');

    // outcomes: 2 or more opaque labels declare a multi-outcome market
    if (o.outcomes !== undefined) {
      if (!Array.isArray(o.outcomes) || o.outcomes.length < 2) {
        return refuse(flags, 'outcomes_must_have_at_least_two_entries', 'orders[' + oi + '].outcomes');
      }
      for (let k = 0; k < o.outcomes.length; k++) {
        const lab = o.outcomes[k];
        if (typeof lab !== 'string' || lab.length === 0 || lab.length > 64) {
          return refuse(flags, 'outcome_label_must_be_short_opaque_string', 'orders[' + oi + '].outcomes[' + k + ']');
        }
        if (looksIdentifierLike(lab)) {
          flags.push('IDENTIFIER_LIKE_FIELD_REFUSED');
          return refuse(flags, 'identifier_like_outcome_label_refused', 'orders[' + oi + '].outcomes[' + k + ']');
        }
      }
    }

    // fills: legs[] for combo orders, fills[] otherwise
    let fillGroups;
    if (kind === 'combo') {
      if (!Array.isArray(o.legs) || o.legs.length < 1) return refuse(flags, 'combo_order_requires_legs', 'orders[' + oi + '].legs');
      fillGroups = o.legs.map((leg, li) => ({ fills: leg && leg.fills, at: 'orders[' + oi + '].legs[' + li + '].fills' }));
    } else {
      fillGroups = [{ fills: o.fills, at: 'orders[' + oi + '].fills' }];
    }

    const perFill = [];
    let orderFee = 0n;
    let tradeSum = 0n;
    let rebateTotal = 0n;
    let carry = 0n; // the order's rounding accumulator after the last fill
    const theta = thetaFor(role, kind);
    if (!theta) return refuse(flags, 'theta_num_den_must_be_nonnegative_integers', 'theta');
    const unitBig = B(fillUnit);
    const floorMinBig = shipped && row.floor_min_fee_micro !== undefined ? B(row.floor_min_fee_micro) : (!shipped && genActive.floor_min_fee_micro !== undefined ? B(genActive.floor_min_fee_micro) : 0n);

    for (const group of fillGroups) {
      if (!Array.isArray(group.fills) || group.fills.length < 1) return refuse(flags, 'fills_must_be_nonempty_array', group.at);
      for (let fi = 0; fi < group.fills.length; fi++) {
        const f = group.fills[fi] || {};
        if (!isPosInt(f.contracts) || f.contracts > MAX_CONTRACTS) return refuse(flags, 'contracts_must_be_integer_1_to_1e9', group.at + '[' + fi + '].contracts');
        if (!(typeof f.price_micro === 'number' && Number.isInteger(f.price_micro) && f.price_micro >= 1 && f.price_micro <= 999999)) {
          return refuse(flags, 'price_micro_must_be_integer_1_to_999999', group.at + '[' + fi + '].price_micro');
        }
        fillsTotal++;
        if (fillsTotal > MAX_FILLS_TOTAL) return refuse(flags, 'fills_exceed_bounded_domain_500', group.at);
        const usComboThisFill = profileId === 'polymarket_us' && usComboActive && kind === 'combo';
        const raw = rawFillFee(shipped ? row : genActive, theta, f.contracts, f.price_micro, usComboThisFill);
        let trade;
        if (raw.exact) {
          trade = raw.num / raw.den; // flat family: exact micro per contract
        } else {
          trade = roundFee(raw.num, raw.den, roundingMode, unitBig, floorMinBig);
        }
        let roundingFee = 0n;
        let rebate = 0n;
        let net = trade;
        if (acc) {
          // Pinned Kalshi mechanics, modelled on the buy side per the pinned worked
          // example: rounding overpayment carries in the order accumulator; the
          // rebate is paid in order_unit increments, capped so a fill's net fee
          // stays >= 0.
          const rem = (B(f.contracts) * B(f.price_micro) + trade) % B(orderUnit);
          roundingFee = rem === 0n ? 0n : B(orderUnit) - rem;
          carry = carry + roundingFee;
          const gross = trade + roundingFee;
          rebate = (carry / B(orderUnit)) * B(orderUnit);
          if (rebate > gross) rebate = gross;
          carry = carry - rebate;
          net = gross - rebate;
        } else if (family === 'rebate_share' && role === 'maker') {
          const takerRaw = rawFillFee(shipped ? row : genActive, takerTheta, f.contracts, f.price_micro, false);
          const takerEquiv = roundFee(takerRaw.num, takerRaw.den, roundingMode, unitBig, floorMinBig);
          rebate = (takerEquiv * B(rebateShareBp)) / B(10000);
          if (rebate > trade) rebate = trade;
          net = trade - rebate;
        }
        tradeSum = tradeSum + trade;
        rebateTotal = rebateTotal + rebate;
        orderFee = orderFee + net;
        fillsSum = fillsSum + net;
        perFill.push({
          contracts: f.contracts,
          price_micro: f.price_micro,
          trade_fee_micro: numOut(trade),
          rounding_fee_micro: numOut(roundingFee),
          rebate_micro: numOut(rebate),
          net_fee_micro: numOut(net),
        });
      }
    }

    let feeCheck = null;
    if (o.reported_fee_minor !== undefined) {
      if (!(typeof o.reported_fee_minor === 'number' && Number.isInteger(o.reported_fee_minor) && o.reported_fee_minor >= 0)) {
        return refuse(flags, 'reported_fee_minor_must_be_nonnegative_integer', 'orders[' + oi + '].reported_fee_minor');
      }
      const rep = B(o.reported_fee_minor);
      feeCheck = orderFee === rep ? 'MATCH' : (orderFee < rep ? 'OVERCHARGE' : 'UNDERCHARGE');
      if (feeCheck === 'MATCH') flags.push('FEE_CHECK_MATCH');
      if (feeCheck === 'OVERCHARGE') flags.push('FEE_CHECK_OVERCHARGE');
      if (feeCheck === 'UNDERCHARGE') flags.push('FEE_CHECK_UNDERCHARGE');
    }

    // conservation: order fee equals the fill trade fees plus the net carried rounding
    const conservationOk = orderFee === tradeSum + carry;
    perOrder.push({
      order_label: label,
      role,
      kind,
      fills_in: perFill.length,
      per_fill: perFill,
      trade_fees_micro: numOut(tradeSum),
      rebate_total_micro: numOut(rebateTotal),
      order_fee_micro: numOut(orderFee),
      carry_micro: numOut(carry),
      conservation_ok: conservationOk,
      reported_fee_minor: o.reported_fee_minor,
      fee_check: feeCheck,
    });
    totalFee = totalFee + orderFee;
  }

  const payload = {
    verdict: 'completed',
    profile_id: profileId,
    venue_label: shipped ? prof.venue_label : 'caller-declared',
    source_pin: shipped ? rowPin : 'caller-declared parameters',
    as_of: asOf,
    fee_family: family,
    effective_theta: { taker: takerTheta, maker: makerTheta },
    series_multiplier: effMult,
    rounding_mode: roundingMode,
    fill_rounding_unit_micro: fillUnit,
    order_rounding_unit_micro: orderUnit,
    accumulator: acc,
    rebate_share_bp: rebateShareBp,
    per_order: perOrder,
    total_fee_micro: numOut(totalFee),
    fills_net_sum_micro: numOut(fillsSum),
    conservation_ok: perOrder.every((po) => po.conservation_ok),
    evidence: { record_type: 'event_contract_fee_recompute', tool_id: TOOL_ID, tool_version: TOOL_VERSION, refused: false },
  };
  if (profileId === 'polymarket_global') {
    payload.category = typeof pp.category === 'string' && pp.category !== '' ? pp.category : 'other';
  }
  if (profileId === 'kalshi') payload.effective_date_pinned = false; // no primary source states a schedule effective date
  return { output_payload: payload, compliance_flags: flags };
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
