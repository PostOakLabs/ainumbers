import { executionHash } from './_hash.mjs';

// art-702-runway-goal-path — goal-seek over a fixed monthly cash model: the smallest
// change in price, growth or burn that reaches a declared goal, ranked by least
// effort. The model is a finite horizon of integer months: revenue starts at the
// declared base (optionally price-uplifted) and grows at a constant month-over-month
// rate from month 2; burn is derived once from the declared base and a burn-cut
// basis-point value and then held constant; cash accumulates net each month. The
// first month where cash goes below zero is the cash-out month, interpolated in
// basis points of a month as (m-1)*10000 + floor(prev_cash*10000/(-net)); cash
// landing exactly on zero is not a cash-out. A grid search walks every combination
// of the three declared lever grids, keeps the scenarios that meet the goal, and
// ranks them by effort ascending (sum of weight*lever, half-up over 100), then by
// burn_cut, then price_uplift, then growth_add, all ascending. The all-zero lever
// scenario is always evaluated and reported as the baseline. All money is an
// integer count of minor units and all rates are integer basis points; rounding is
// half-up, applied once per month step for revenue and once per scenario for burn.
// No Date, no clock, no randomness, no text encoding: a pure function of integers.

const TOOL_ID = 'art-702-runway-goal-path';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'find_runway_goal_path',
  mandate_type: 'compliance_control', gpu: false,
};

const GOAL_TYPES = ['runway_months', 'solvent_through_horizon', 'breakeven_by_month', 'ending_cash_at_least'];
const LEVER_KEYS = ['price_uplift_bp', 'growth_add_bp', 'burn_cut_bp'];
const MAX_GRID_VALUES = 12;
const SCOPE_NOTE =
  'One revenue line, constant burn, no financing events, no churn model, and no tax. ' +
  'Integer minor units and integer basis points only; rounding is half-up, applied once per month step.';

// ---------- refusal plumbing ----------

/** @type {(reason: string, text: string) => { output_payload: object, compliance_flags: string[] }} */
function refused(reason, text) {
  const domain_errors = [{ code: reason, text }];
  const flags = [];
  if (domain_errors.length > 0) flags.push('ART702_INPUT_REFUSED');
  return {
    output_payload: {
      baseline: null,
      baseline_meets_goal: false,
      candidates: [],
      scenarios_evaluated: 0,
      none_found_reason: null,
      refusal_reason: reason,
      domain_errors,
      scope_note: SCOPE_NOTE,
    },
    compliance_flags: flags,
  };
}

const NO_CANDIDATE_REASON = 'No lever combination inside the declared grids reaches the declared goal.';

// ---------- integer rounding ----------

/** half-up for a non-negative numerator over a positive denominator */
function roundHalfUpDiv(num, den) {
  return Math.floor((num + Math.floor(den / 2)) / den);
}

// ---------- validation ----------

/** @type {(v: unknown) => boolean} non-negative integer minor-unit money */
function isMoney(v) { return typeof v === 'number' && Number.isInteger(v) && v >= 0; }

/** @type {(v: unknown) => boolean} non-negative integer basis-point rate or lever */
function isBp(v) { return typeof v === 'number' && Number.isInteger(v) && v >= 0; }

/** @type {(grid: unknown) => boolean} sorted non-descending, integers >= 0, at most 12 values */
function isLeverGrid(grid) {
  if (!Array.isArray(grid) || grid.length > MAX_GRID_VALUES) return false;
  for (let i = 0; i < grid.length; i++) {
    if (!isBp(grid[i])) return false;
    if (i > 0 && grid[i] < grid[i - 1]) return false;
  }
  return true;
}

/** @type {(pp: object) => { output_payload: object, compliance_flags: string[] } | null} */
function validate(pp) {
  if (!isMoney(pp.cash_minor)) {
    return refused('REFUSED_NON_INTEGER_MONEY', 'cash_minor must be a non-negative integer count of minor units');
  }
  if (!isMoney(pp.monthly_revenue_minor)) {
    return refused('REFUSED_NON_INTEGER_MONEY', 'monthly_revenue_minor must be a non-negative integer count of minor units');
  }
  if (!isMoney(pp.monthly_burn_minor)) {
    return refused('REFUSED_NON_INTEGER_MONEY', 'monthly_burn_minor must be a non-negative integer count of minor units');
  }
  if (typeof pp.revenue_growth_bp !== 'number' || !Number.isInteger(pp.revenue_growth_bp)) {
    return refused('REFUSED_NON_INTEGER_RATE', 'revenue_growth_bp must be an integer basis-point rate');
  }
  if (pp.revenue_growth_bp < -10000) {
    return refused('REFUSED_GROWTH_BELOW_MINUS_10000', 'revenue_growth_bp must not be below -10000');
  }
  if (typeof pp.horizon_months !== 'number' || !Number.isInteger(pp.horizon_months) || pp.horizon_months < 1 || pp.horizon_months > 60) {
    return refused('REFUSED_HORIZON_OUT_OF_RANGE', 'horizon_months must be an integer between 1 and 60');
  }
  const goal = pp.goal;
  if (!goal || typeof goal !== 'object' || !GOAL_TYPES.includes(goal.type)) {
    return refused('REFUSED_UNKNOWN_GOAL_TYPE', 'goal.type must be one of runway_months, solvent_through_horizon, breakeven_by_month, ending_cash_at_least');
  }
  if (goal.type !== 'solvent_through_horizon') {
    if (typeof goal.value !== 'number' || !Number.isInteger(goal.value) || goal.value < (goal.type === 'ending_cash_at_least' ? 0 : 1)) {
      return refused('REFUSED_NON_INTEGER_GOAL', 'goal.value must be an integer' + (goal.type === 'ending_cash_at_least' ? ' of at least zero' : ' of at least one') + ' for goal.type ' + goal.type);
    }
  }
  const levers = pp.levers;
  if (!levers || typeof levers !== 'object') {
    return refused('REFUSED_BAD_LEVER_GRID', 'levers must be an object with price_uplift_bp, growth_add_bp and burn_cut_bp arrays');
  }
  for (const key of LEVER_KEYS) {
    if (!isLeverGrid(levers[key])) {
      return refused('REFUSED_BAD_LEVER_GRID', 'levers.' + key + ' must be a sorted array of non-negative integer basis points with at most ' + MAX_GRID_VALUES + ' values');
    }
  }
  const weights = pp.effort_weights;
  if (!weights || typeof weights !== 'object') {
    return refused('REFUSED_BAD_EFFORT_WEIGHTS', 'effort_weights must be an object with price_uplift_bp, growth_add_bp and burn_cut_bp keys');
  }
  for (const key of LEVER_KEYS) {
    if (!isBp(weights[key])) {
      return refused('REFUSED_BAD_EFFORT_WEIGHTS', 'effort_weights.' + key + ' must be a non-negative integer');
    }
  }
  if (typeof pp.max_candidates !== 'number' || !Number.isInteger(pp.max_candidates) || pp.max_candidates < 1) {
    return refused('REFUSED_BAD_MAX_CANDIDATES', 'max_candidates must be an integer of at least one');
  }
  return null;
}

// ---------- scenario simulation ----------

/**
 * One scenario over the fixed cash model. Month 1 uses rev0 as given; growth
 * applies from month 2. Burn is derived once and held constant. Cash accumulates
 * net each month; the first month where cash < 0 is interpolated in basis points
 * of a month. Cash landing exactly on zero is not a cash-out.
 * @returns {{ runway_bp_of_month: number|null, breakeven_month: number|null, ending_cash_minor: number, solvent_through_horizon: boolean }}
 */
function simulateScenario(base, price, growthAdd, burnCut) {
  let rev = roundHalfUpDiv(base.revenue * (10000 + price), 10000);
  const g = base.growthBp + growthAdd;
  const burn = roundHalfUpDiv(base.burn * (10000 - burnCut), 10000);
  let cash = base.cash;
  let runwayBp = null;
  let breakevenMonth = null;
  for (let m = 1; m <= base.horizon; m++) {
    if (m > 1) rev = roundHalfUpDiv(rev * (10000 + g), 10000);
    if (breakevenMonth === null && rev >= burn) breakevenMonth = m;
    const prevCash = cash;
    const net = rev - burn;
    cash += net;
    if (runwayBp === null && cash < 0) {
      runwayBp = (m - 1) * 10000 + Math.floor((prevCash * 10000) / (-net));
    }
  }
  return {
    runway_bp_of_month: runwayBp,
    breakeven_month: breakevenMonth,
    ending_cash_minor: cash,
    solvent_through_horizon: runwayBp === null,
  };
}

/** @type {(goal: object, s: object) => boolean} */
function meetsGoal(goal, s) {
  if (goal.type === 'runway_months') {
    return s.runway_bp_of_month === null || s.runway_bp_of_month >= goal.value * 10000;
  }
  if (goal.type === 'solvent_through_horizon') {
    return s.runway_bp_of_month === null;
  }
  if (goal.type === 'breakeven_by_month') {
    return s.breakeven_month !== null && s.breakeven_month <= goal.value;
  }
  return s.ending_cash_minor >= goal.value; // ending_cash_at_least
}

// ---------- compute ----------

/**
 * compute(pp) — pure goal-seek over the declared cash model domain.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const bad = validate(pp);
  if (bad) return bad;

  const base = {
    cash: pp.cash_minor,
    revenue: pp.monthly_revenue_minor,
    burn: pp.monthly_burn_minor,
    growthBp: pp.revenue_growth_bp,
    horizon: pp.horizon_months,
  };
  const goal = pp.goal;
  const weights = pp.effort_weights;
  const priceGrid = pp.levers.price_uplift_bp;
  const growthGrid = pp.levers.growth_add_bp;
  const burnGrid = pp.levers.burn_cut_bp;
  const flags = [];

  const baseline = simulateScenario(base, 0, 0, 0);
  const baselineMeets = meetsGoal(goal, baseline);

  // Full grid search: every combination of the three lever grids.
  const qualifying = [];
  let evaluated = 0;
  for (const price of priceGrid) {
    for (const growth of growthGrid) {
      for (const burnCut of burnGrid) {
        evaluated++;
        const s = simulateScenario(base, price, growth, burnCut);
        if (!meetsGoal(goal, s)) continue;
        const effort = roundHalfUpDiv(
          weights.price_uplift_bp * price + weights.growth_add_bp * growth + weights.burn_cut_bp * burnCut,
          100,
        );
        qualifying.push({
          levers: { price_uplift_bp: price, growth_add_bp: growth, burn_cut_bp: burnCut },
          effort,
          runway_bp_of_month: s.runway_bp_of_month,
          breakeven_month: s.breakeven_month,
          ending_cash_minor: s.ending_cash_minor,
        });
      }
    }
  }

  // Least-effort ranking; ties break by burn_cut, then price_uplift, then
  // growth_add, all ascending — a fixed declared order.
  qualifying.sort((a, b) =>
    (a.effort - b.effort) ||
    (a.levers.burn_cut_bp - b.levers.burn_cut_bp) ||
    (a.levers.price_uplift_bp - b.levers.price_uplift_bp) ||
    (a.levers.growth_add_bp - b.levers.growth_add_bp));
  const candidates = qualifying.slice(0, pp.max_candidates);

  if (baselineMeets) flags.push('ART702_BASELINE_MEETS_GOAL');
  if (candidates.length === 0) flags.push('ART702_NO_CANDIDATE_FOUND');

  return {
    output_payload: {
      baseline: {
        runway_bp_of_month: baseline.runway_bp_of_month,
        solvent_through_horizon: baseline.solvent_through_horizon,
        breakeven_month: baseline.breakeven_month,
        ending_cash_minor: baseline.ending_cash_minor,
      },
      baseline_meets_goal: baselineMeets,
      candidates,
      scenarios_evaluated: evaluated,
      none_found_reason: candidates.length === 0 ? NO_CANDIDATE_REASON : null,
      scope_note: SCOPE_NOTE,
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
