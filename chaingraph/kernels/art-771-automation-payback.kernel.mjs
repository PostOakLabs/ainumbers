// art-771-automation-payback — port of ApexLogics Apex #180 "Automation Payback" (AL-194,
// tool_id 180-automation-payback) inline calcPayback(), landed from the
// APEXPORT-180 porting payload (msi farm lane, GRADES PASS-PENDING-XV 2026-10-18,
// Builder-verifies-at-land: 19/19 payload fixture vectors re-executed through
// compute() matching the stored outputs, APEX-PORT-180-LAND-1).
//
// Source page: https://apexlogics.org/tools/180-automation-payback/
//   fetched 2026-10-13, 37945 bytes,
//   sha256 4931c9a3713fba69d6e614ce3bdb0fc8b01a75e7376ba8bf9916553cb2c91d1b
// Apex HTML line numbers cited below as "line <n>". Target node: art-771
// (reserved by APEX-PORT-ARTNUM-ALLOC-1 for Apex #180; no other holder).
//
// PORTING NOTES
//   * Every expression below is transcribed from the Apex page's calcPayback()
//     (apex180.html lines 343-377) without algebraic rearrangement, so that
//     IEEE-754 double results are bit-identical to the live page. A cross-check
//     harness (verify/parity.mjs) re-runs the Apex expressions verbatim against
//     this kernel over every fixture.
//   * The Apex page carries no tax or regulatory premise. It is gross-dollar
//     arithmetic over user estimates; see CITES.md. Two constants are POLICY
//     PARAMETERS, not facts:
//       - maintenance_haircut_pct (default 20)
//       - weeks_per_month (default 4.33)
//     Both are inputs. Neither is a fetched fact and neither is asserted here.
//   * WEEKS_PER_MONTH official derivation is UNGROUNDED this run — see the
//     comment on that constant and CITES.md "UNGROUNDED:".

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-771-automation-payback';
const TOOL_VERSION = '1.0.0';

// ── Named constants ──────────────────────────────────────────────────────────

// POLICY PARAMETER (not a fact, not fetched). The Apex page states at line 138:
// "The 20% maintenance haircut is the only fixed assumption and it is editable."
// The page default is 20 (apex180.html line 144). We keep 20 as the input default
// because step 7 of the tasking requires the kernel to reproduce LIVE Apex result
// vectors exactly, and 20 is what the live page ships. No official source claims a
// maintenance haircut; none was sought, because the page never asserts one.
const DEFAULT_MAINTENANCE_HAIRCUT_PCT = 20;

// POLICY PARAMETER (not a fact). The Apex page default is 4.33 (apex180.html line
// 146). It is a two-decimal truncation of 52/12 = 4.3333...
//
// UNGROUNDED: the specific quotient 52/12 = 4.3333 used to convert hours-per-week
// to hours-per-month could not be grounded this run. The BLS page that states it
// ("The number of weeks per month is calculated by dividing the total number of
// weeks (52) by the total number of months (12): 52 / 12 = 4.333",
// https://www.bls.gov/opub/mlr/cwc/work-schedules-in-the-national-compensation-survey.pdf)
// returned HTTP 403 to this sandbox on 2026-10-13 and was NOT read, so it is not
// cited. The 52-week-year numerator IS grounded (OPM + State FAM, see CITES.md);
// the division by 12 is not. The numerator-grounded derivation is recorded here
// and the kernel branch is marked, per the tasking rule.
const DEFAULT_WEEKS_PER_MONTH = 4.33;
// Numerator grounded this run (OPM "2,080 hours (the number of hours in 52 workweeks
// of 40 hours)"); the /12 quotient above is not. Never used in compute().
const WEEKS_PER_MONTH_OFFICIAL_DERIVATION = 52 / 12; // 4.333333333333333

// POLICY PARAMETER. Apex page default 24 months (apex180.html line 145).
const DEFAULT_HORIZON_MONTHS = 24;

// Clamp floors, transcribed from the Apex page:
//   line 344  Math.max(0, num('haircut'))
//   line 345  Math.max(1, Math.round(num('horizon')))
//   line 346  Math.max(1, num('weeksMonth'))
const MIN_HAIRCUT_PCT = 0;
const MIN_HORIZON_MONTHS = 1;
const MIN_WEEKS_PER_MONTH = 1;

// Display precision constants. Apex line 388 and line 433 use
// Math.round(v*10)/10 for break-even months and hours; Apex line 427 uses
// Math.round(v*100)/100 for money. Both are Math.round, which in ECMA-262 rounds
// half toward +Infinity (Math.round(-0.5) === -0, Math.round(-1.5) === -1), NOT
// half-away-from-zero. This is preserved exactly; see DIFFERS.md row D-04.
const USD_DECIMALS = 2;
const MONTHS_DECIMALS = 1;

// Apex line 349: an empty candidate name renders as this literal.
const UNNAMED_CANDIDATE = 'Unnamed candidate';

// Apex lines 407-419: three mutually exclusive verdict branches.
const VERDICT_ALL_CLEAR = 'ALL_CLEAR';
const VERDICT_MIXED = 'MIXED_LIST';
const VERDICT_NONE_CLEAR = 'NO_CANDIDATE_CLEARS';

// AINumbers-side additions, NOT Apex behaviour. The Apex page stamps
// lastResult.timestamp with new Date().toISOString() (apex180.html line 436).
// compute() therefore takes an explicit as_of input (APEXPORT-110B pattern) so the
// kernel reads no clock and stays deterministic and zkVM-promotable. buildArtifact()
// takes `now` from its caller, exactly as art-328 / art-324 do.
const DEFAULT_AS_OF = '2026-10-13';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_automation_payback',
  mandate_type: 'analytics_mandate', gpu: false,
};

// ── Pure helpers (no Date, no random, no engine transcendentals) ─────────────

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

// Coercion for the three GLOBAL controls. The Apex page reads them with
//   function num(id) { const v = parseFloat(document.getElementById(id).value);
//                       return isNaN(v) ? 0 : v; }                       (line 333-336)
// so an unparseable box yields 0 and is then clamped, while the documented
// default applies only when the field is ABSENT from the payload (which is the
// state the page's HTML value= attribute puts the control in). safeNum alone
// would wrongly substitute the default for an unparseable value; apexCoerce
// reproduces the page exactly. See DIFFERS.md row D-06.
function apexCoerce(v, dflt) {
  if (v === undefined || v === null || v === '') return dflt;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0; // num() -> 0 on unparseable
}

function r(v, dp) {
  const f = Math.pow(10, dp);
  return Number.isFinite(v) ? Math.round(v * f) / f : 0;
}
const r2 = (v) => r(v, USD_DECIMALS);
const r1 = (v) => r(v, MONTHS_DECIMALS);

// ISO calendar date, no Date object (mirrors art-704's isIsoDate).
function isIsoDate(v) {
  if (typeof v !== 'string' || v.length !== 10 || v.charAt(4) !== '-' || v.charAt(7) !== '-') return false;
  for (let i = 0; i < 10; i++) {
    if (i === 4 || i === 7) continue;
    const c = v.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  const y = Number(v.slice(0, 4)), m = Number(v.slice(5, 7)), d = Number(v.slice(8, 10));
  if (m < 1 || m > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= dim;
}

// ── Ported compute ──────────────────────────────────────────────────────────
//
// Direct transcription of Apex calcPayback() lines 343-377. Read the Apex source
// alongside: every clamp, comparator and operator below is 1:1.
//
//   value        = hours * weeks * rate + errCost              (line 359)
//   recurring    = sub * (1 + haircut)                         (line 360)
//   buildMonthly = build / horizon                             (line 361)
//   tco          = recurring + buildMonthly                    (line 362)
//   net          = value - tco                                 (line 363)
//   recoverable  = value - recurring                           (line 364)
//   breakeven    = recoverable > 0 ? build / recoverable : null (line 365)
//   keep         = net >= 0                                    (line 366)
//   horizonNet   = value*horizon - (build + recurring*horizon) (line 367)
//
// Note the maintenance haircut is applied to `recurring` (the subscription) ONLY.
// It is NOT applied to the amortised build. And `recoverable` excludes buildMonthly,
// so break-even ignores the amortisation entirely. Both are Apex behaviour, kept as-is.
//
// Sorting: Apex line 370 `sort((a,b) => b.net - a.net)` and line 377
// `sort((a,b) => a.breakeven - b.breakeven)`. Array.prototype.sort has been
// stability-guaranteed since ES2019, so equal keys preserve input order
// deterministically. `fastest` is drawn from `ranked` (already net-sorted), so a
// break-even tie resolves to the higher-net candidate, not the earlier input row.

export function compute(pp) {
  pp = pp || {};
  const compliance_flags = [];

  // ── globals ──
  const rawHaircut = apexCoerce(pp.maintenance_haircut_pct, DEFAULT_MAINTENANCE_HAIRCUT_PCT);
  const rawHorizon = apexCoerce(pp.horizon_months, DEFAULT_HORIZON_MONTHS);
  const rawWeeks = apexCoerce(pp.weeks_per_month, DEFAULT_WEEKS_PER_MONTH);

  // line 344 / 345 / 346
  const haircut = Math.max(MIN_HAIRCUT_PCT, rawHaircut) / 100;
  const horizon = Math.max(MIN_HORIZON_MONTHS, Math.round(rawHorizon));
  const weeks = Math.max(MIN_WEEKS_PER_MONTH, rawWeeks);

  if (rawHaircut < MIN_HAIRCUT_PCT) compliance_flags.push('HAIRCUT_CLAMPED_TO_FLOOR');
  if (rawHorizon < MIN_HORIZON_MONTHS) compliance_flags.push('HORIZON_CLAMPED_TO_FLOOR');
  if (!Number.isInteger(rawHorizon)) compliance_flags.push('HORIZON_ROUNDED_TO_WHOLE_MONTHS');
  if (rawWeeks < MIN_WEEKS_PER_MONTH) compliance_flags.push('WEEKS_PER_MONTH_CLAMPED_TO_FLOOR');

  // ── rows ── lines 348-355 ──
  const input = Array.isArray(pp.candidates) ? pp.candidates : [];
  const rows = input.map(function (c) {
    c = c || {};
    return {
      name: c.name || UNNAMED_CANDIDATE, // line 349
      hours: Math.max(0, safeNum(c.hours_saved_per_week, 0)), // line 350
      rate: Math.max(0, safeNum(c.loaded_hourly_rate_usd, 0)), // line 351
      errCost: Math.max(0, safeNum(c.error_cost_avoided_usd_month, 0)), // line 352
      build: Math.max(0, safeNum(c.build_cost_usd, 0)), // line 353
      sub: Math.max(0, safeNum(c.subscription_usd_month, 0)), // line 354
    };
  });

  // line 356: the page alerts and returns on an empty list.
  if (rows.length < 1) {
    compliance_flags.push('NO_CANDIDATES');
    return {
      output_payload: {
        as_of: isIsoDate(pp.as_of) ? pp.as_of : null,
        haircut_pct: r2(haircut * 100),
        horizon_months: horizon,
        weeks_per_month: r2(weeks),
        candidates: [],
        ranked: [],
        keepers: [],
        droppers: [],
        net_keep_mo: 0,
        net_all_mo: 0,
        hours_reclaimed_wk: 0,
        horizon_net_keep: 0,
        horizon_net_all: 0,
        best_candidate: null,
        fastest_breakeven_candidate: null,
        fastest_breakeven_months: null,
        verdict: VERDICT_NONE_CLEAR,
        regulatory_basis: 'none — pure gross-dollar payback arithmetic over user estimates; no tax or regulatory premise',
        note: 'No candidates supplied. The Apex page alerts "Add at least one automation candidate to rank." and returns without rendering results.',
      },
      compliance_flags,
    };
  }

  // ── per-candidate ── lines 358-368 ──
  rows.forEach(function (x) {
    x.value = x.hours * weeks * x.rate + x.errCost; // 359
    x.recurring = x.sub * (1 + haircut); // 360
    x.buildMonthly = x.build / horizon; // 361
    x.tco = x.recurring + x.buildMonthly; // 362
    x.net = x.value - x.tco; // 363
    const recoverable = x.value - x.recurring; // 364
    x.breakeven = recoverable > 0 ? x.build / recoverable : null; // 365  <-- COMPARATOR C1
    x.keep = x.net >= 0; // 366  <-- COMPARATOR C2
    x.horizonNet = x.value * horizon - (x.build + x.recurring * horizon); // 367
  });

  // ── ranking & portfolio ── lines 370-377 ──
  const ranked = rows.slice().sort(function (a, b) { return b.net - a.net; }); // 370  <-- C5
  const keepers = ranked.filter(function (r) { return r.keep; }); // 371
  const droppers = ranked.filter(function (r) { return !r.keep; }); // 372
  const netKeep = keepers.reduce(function (s, x) { return s + x.net; }, 0); // 373
  const netAll = ranked.reduce(function (s, x) { return s + x.net; }, 0); // 374
  const hoursReclaimed = keepers.reduce(function (s, x) { return s + x.hours; }, 0); // 375
  const best = ranked[0]; // 376
  const fastest = ranked.filter(function (x) { return x.breakeven !== null; })
    .sort(function (a, b) { return a.breakeven - b.breakeven; })[0] || null; // 377  <-- C6

  // ── verdict ── lines 407-419 ──
  let verdict;
  if (keepers.length === ranked.length) verdict = VERDICT_ALL_CLEAR; // 407  <-- C3
  else if (keepers.length > 0) verdict = VERDICT_MIXED; // 411  <-- C4
  else verdict = VERDICT_NONE_CLEAR; // 415

  if (!fastest) compliance_flags.push('NO_CANDIDATE_BREAKS_EVEN');

  function shape(x) {
    return {
      name: x.name,
      value_mo: r2(x.value),
      recurring_with_haircut_mo: r2(x.recurring),
      build_amortized_mo: r2(x.buildMonthly),
      tco_mo: r2(x.tco),
      net_mo: r2(x.net),
      breakeven_months: x.breakeven === null ? null : r1(x.breakeven), // line 433
      breakeven_months_exact: x.breakeven === null ? null : r6(x.breakeven),
      call: x.keep ? 'BUILD' : 'SKIP',
      horizon_net: r2(x.horizonNet),
    };
  }
  function r6(v) { return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0; }

  const output_payload = {
    // AINumbers addition: the as-of stamp the Apex page takes from the wall clock.
    as_of: isIsoDate(pp.as_of) ? pp.as_of : null,
    haircut_pct: r2(haircut * 100), // line 429
    horizon_months: horizon, // line 430
    weeks_per_month: r2(weeks), // line 431
    candidates: rows.map(function (x) { // line 432
      return {
        name: x.name,
        hours_saved_wk: r2(x.hours),
        loaded_rate: r2(x.rate),
        error_cost_mo: r2(x.errCost),
        build_cost: r2(x.build),
        subscription_mo: r2(x.sub),
      };
    }),
    ranked: ranked.map(shape), // line 433
    keepers: keepers.map(function (x) { return x.name; }),
    droppers: droppers.map(function (x) { return x.name; }),
    net_keep_mo: r2(netKeep), // line 434
    net_all_mo: r2(netAll),
    hours_reclaimed_wk: r1(hoursReclaimed), // line 435
    horizon_net_keep: r2(keepers.reduce(function (s, x) { return s + x.horizonNet; }, 0)),
    horizon_net_all: r2(ranked.reduce(function (s, x) { return s + x.horizonNet; }, 0)),
    best_candidate: best.name,
    fastest_breakeven_candidate: fastest ? fastest.name : null,
    fastest_breakeven_months: fastest ? r1(fastest.breakeven) : null,
    verdict,
    regulatory_basis: 'none — pure gross-dollar payback arithmetic over user estimates; no tax or regulatory premise',
    note: 'value_mo = hours_saved_wk*weeks_per_month*loaded_rate + error_cost_mo. tco_mo = subscription_mo*(1+haircut_pct/100) + build_cost/horizon_months. net_mo = value_mo - tco_mo. breakeven_months = build_cost/(value_mo - recurring_with_haircut_mo), null when that denominator is not positive. horizon_net = value_mo*horizon_months - (build_cost + recurring_with_haircut_mo*horizon_months), which equals net_mo*horizon_months. The maintenance haircut applies to the subscription only, never to the amortised build. hours_reclaimed_wk sums hours over BUILD candidates only. Ranking is descending net_mo; ties preserve input order (Array.prototype.sort stability, ES2019).',
  };

  return { output_payload, compliance_flags };
}

export function defaults() {
  return {
    as_of: DEFAULT_AS_OF,
    maintenance_haircut_pct: DEFAULT_MAINTENANCE_HAIRCUT_PCT,
    horizon_months: DEFAULT_HORIZON_MONTHS,
    weeks_per_month: DEFAULT_WEEKS_PER_MONTH,
    candidates: [],
  };
}

// The three worked candidates the live page loads on open (apex180.html lines 271-275,
// 546 `loadExample()`). Ported here so the page draft and the fixtures share one source.
export function workedExample() {
  return {
    as_of: DEFAULT_AS_OF,
    maintenance_haircut_pct: DEFAULT_MAINTENANCE_HAIRCUT_PCT,
    horizon_months: DEFAULT_HORIZON_MONTHS,
    weeks_per_month: DEFAULT_WEEKS_PER_MONTH,
    candidates: [
      { name: 'Invoice processing', hours_saved_per_week: 3, loaded_hourly_rate_usd: 45, error_cost_avoided_usd_month: 150, build_cost_usd: 2000, subscription_usd_month: 60 },
      { name: 'Report generation', hours_saved_per_week: 2, loaded_hourly_rate_usd: 55, error_cost_avoided_usd_month: 75, build_cost_usd: 500, subscription_usd_month: 30 },
      { name: 'Data-entry migration', hours_saved_per_week: 5, loaded_hourly_rate_usd: 28, error_cost_avoided_usd_month: 200, build_cost_usd: 3500, subscription_usd_month: 120 },
    ],
  };
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