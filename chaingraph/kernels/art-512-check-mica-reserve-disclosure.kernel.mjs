// art-512 — Check MiCA Reserve Disclosure: pure decision kernel.
//
// MICA-ART30-DISCLOSURE-BUILD-SPEC.md §1-§3. Checks a token issuer's PUBLISHED
// reserve disclosure — the amount in circulation, and the value and composition
// of the reserve — against the composition, concentration, segregation and
// publication-cadence terms THE READER SUPPLIES. Deterministic and
// backward-looking: it reads what was published and compares it to declared
// rules. There is no simulation anywhere in this file.
//
// DISTINCT FROM THREE SHIPPED SURFACES (state this on the page too):
//   rca-02-mica-reserve-stress          is a Monte Carlo redemption stress under
//                                       Article 36: 1,000 paths x 90 days, a fan
//                                       chart and a breach probability. That is a
//                                       forward-looking simulation of whether the
//                                       reserve survives a run. This node asks a
//                                       different question entirely, and answers
//                                       it deterministically. Its simulation is
//                                       NOT imported and its kernel is NOT edited.
//   art-105-mica-token-service-scoper    scopes which MiCA services apply.
//   tools/332-mica-casp-authorization-checker checks authorisation.
//                                       Neither reads a reserve disclosure.
//
// SIGN-OFF REUSE, NO NEW MACHINERY: where a named human attests this check, the
// §27 threshold surface is art-503-build-dual-control-certification. This kernel
// builds NO second certification or threshold evaluator; it emits the receipt.
//
// HARD FENCE (receipt MUST record this, copy MUST lead with it): the eligible
// asset classes, the concentration limits, the minimum segregated percentage,
// the acceptable custodian types and the disclosure cadence are every one of
// them CALLER INPUTS, transcribed from the terms the reader is holding the
// issuer to. This kernel ships NO reporting template, no eligible-asset table,
// no issuer library and no "current rules" claim — zero lookups of any kind
// (zero-egress by contract). `disclosure_ref` + `rules_version` are pinned in
// the artifact and visible on screen, so a later rule change makes an old
// receipt DATED, not wrong.
//
// WHY NO TEMPLATE SHIPS: the reporting templates are this regime's churn risk,
// exactly as the securitisation templates were. A bundled template is a
// standing duty to chase someone else's revisions, and it goes silently false
// the day it is not chased.
//
// REGIME CONTEXT, NAMED IN PROSE ONLY — no pinned citation object is emitted,
// because under the shared estate rule a regulatory citation is a §28 pinned
// object carrying a verified `in_force_from`, or there is none. Verified
// 2026-08-01 against the primary consolidated text of Regulation (EU) 2023/1114
// on EUR-Lex (CELEX 32023R1114): Article 30(1) requires the issuer to disclose,
// in a publicly and easily accessible place on its website, the amount of
// asset-referenced tokens in circulation and the value and composition of the
// reserve of assets referred to in Article 36, "updated at least monthly";
// Article 36(2)-(3) require the reserve to be legally and operationally
// segregated from the issuer's estate and from other reserves, so that creditors
// have no recourse to it in insolvency; Article 37(3) has the reserve assets held
// in custody by a crypto-asset service provider, a credit institution or an
// investment firm, and Article 37(1)(d)-(e) require concentration of custodians
// and of reserve assets to be avoided; Article 54(a) requires at least 30% of
// funds received for e-money tokens to be deposited in separate accounts in
// credit institutions, with the remainder invested per Article 54(b).
//
// TWO INHERITED FACTS WERE MEASURED FALSE AND ARE NOT ENCODED HERE:
//   (1) "MiCA applies in full from 1 July 2026" is wrong. Article 149(2) applies
//       the Regulation from 30 December 2024, and Article 149(3) applies Titles
//       III and IV — which contain Article 30 — from 30 June 2024. 1 July 2026 is
//       the Article 143(3) end of the transitional window for crypto-asset
//       service providers, a different subject.
//   (2) "Weekly disclosure for significant tokens" appears in secondary
//       commentary and is NOT in the Regulation. The only weekly figure in the
//       relevant text is Article 36(4)(b)'s WEEKLY MATURITIES input to a
//       liquidity technical standard, which is not a publication cadence. This
//       is precisely why `cadence_days` is a caller input and not a constant.
//
// DETERMINISM: no clock anywhere — `as_of` and the cadence window are inputs.
// Money is fixed-point BigInt parsed from decimal strings, never float
// multiplication. Dates are parsed strictly and converted with Date.UTC, a pure
// function of its arguments. Finite gates cover zero tokens in circulation and
// an empty reserve; neither can produce NaN. `execution_hash` comes from
// `_hash.mjs` and is never hand-built.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-512-check-mica-reserve-disclosure';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'check_mica_reserve_disclosure',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// ── fixed-point money math (BigInt, no floats) ────────────────────────────
const SCALE_EXP = 8;
const SCALE = 10n ** BigInt(SCALE_EXP);

function toFixed(value) {
  let s = String(value ?? 0).trim();
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  else if (s.startsWith('+')) { s = s.slice(1); }
  if (!/^[0-9]*\.?[0-9]*$/.test(s) || s === '' || s === '.') s = '0';
  let [intPart, fracPart = ''] = s.split('.');
  if (intPart === '') intPart = '0';
  if (fracPart.length > SCALE_EXP) fracPart = fracPart.slice(0, SCALE_EXP); // truncate, never round up
  fracPart = fracPart.padEnd(SCALE_EXP, '0');
  let mag = BigInt(intPart + fracPart);
  if (neg) mag = -mag;
  return mag;
}

function mulFixed(a, b) { return (a * b) / SCALE; }
function divFixed(a, b) { return b === 0n ? 0n : (a * SCALE) / b; }

function roundFixedToString(value, places, mode) {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const divisor = 10n ** BigInt(SCALE_EXP - places);
  let q = abs / divisor;
  const r = abs % divisor;
  const twiceR = r * 2n;
  if (mode === 'truncate') {
    // q already truncated toward zero
  } else if (mode === 'half_even') {
    if (twiceR > divisor || (twiceR === divisor && q % 2n === 1n)) q += 1n;
  } else {
    // 'half_up' (default) — round half away from zero
    if (twiceR >= divisor) q += 1n;
  }
  let qs = q.toString();
  let result;
  if (places === 0) {
    result = qs;
  } else {
    qs = qs.padStart(places + 1, '0');
    result = `${qs.slice(0, -places)}.${qs.slice(-places)}`;
  }
  return (neg && q !== 0n) ? `-${result}` : result;
}

function fixedToPlainString(value, places) { return roundFixedToString(value, places, 'truncate'); }

// ── strict date handling, as INTEGER ARITHMETIC ONLY. The `Date` object does
//    not appear anywhere in this file, in any form: no `Date.now()`, no
//    `new Date()`, not even `Date.UTC`. Days-from-civil and civil-from-days
//    below are the standard proleptic-Gregorian conversions, pure functions of
//    their arguments, identical on every runtime and immune to the host's
//    timezone, locale and clock. ─────────────────────────────────────────────
function daysFromCivil(y, m, d) {
  const yy = y - (m <= 2 ? 1 : 0);
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;                                   // [0, 399]
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1; // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z) {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;                                // [0, 146096]
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: y + (m <= 2 ? 1 : 0), m, d };
}

function parseIsoDay(s) {
  const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? '').trim());
  if (!mm) return null;
  const y = Number(mm[1]), mo = Number(mm[2]), d = Number(mm[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const day = daysFromCivil(y, mo, d);
  const back = civilFromDays(day);
  // Round-trip rejects 2026-02-30 and friends without a calendar table.
  if (back.y !== y || back.m !== mo || back.d !== d) return null;
  return day;
}

function dayToIso(day) {
  const c = civilFromDays(day);
  return `${String(c.y).padStart(4, '0')}-${String(c.m).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`;
}

// EMT default only. Deliberately the single regime constant in this file, it is
// labelled at source in the payload (`min_segregated_pct_source`) and shown on
// screen, and it applies ONLY when the caller declared nothing. For an
// asset-referenced token there is no default at all: an absent minimum raises
// judgment_required naming the field rather than inventing a threshold.
const EMT_DEFAULT_MIN_SEGREGATED_PCT = '30';

const NOT_PROVEN = [
  { item: 'Rule accuracy', detail: 'The eligible asset classes, concentration limits, minimum segregated percentage, acceptable custodian types and disclosure cadence are every one of them caller-supplied and asserted. This kernel ships no reporting template and no eligible-asset table, performs no lookups of any kind (zero-egress), and does not verify these rules against the regulation, a technical standard, or any supervisory expectation.' },
  { item: 'Disclosure accuracy', detail: 'The amount in circulation, the component amounts, the custodian types, the segregation markers and the publication dates are taken as given from the disclosure being checked. This kernel does not verify that the published document says what was transcribed from it, nor that the reserve exists.' },
  { item: 'Valuation', detail: 'Component amounts are asserted at the values supplied. No independent valuation, haircut, or mark to market is performed, and no market data is read.' },
  { item: 'Compliance', detail: 'Every verdict here is against the CALLER\'s declared rules. This is not a determination that the issuer complies with MiCA or with anything else, not legal advice, and not a submission to any authority. A finding can equally originate from a rule this run had wrong.' },
];

/**
 * compute(pp) — pure MiCA reserve-disclosure check.
 * pp: {
 *   issuer_id?, disclosure_ref?, rules_version?, as_of?,
 *   token_type: 'ART' | 'EMT',
 *   tokens_in_circulation: number|string,
 *   reserve_components: [{ component_id?, asset_class, amount, custodian_type?, segregated?: bool }],
 *   declared_rules: {
 *     eligible_asset_classes?: string[],
 *     concentration_limits?: { [asset_class]: number|string },   // percent of reserve total
 *     acceptable_custodian_types?: string[],
 *     min_segregated_pct?: number|string,                        // percent
 *     cadence_days?: number,
 *   },
 *   disclosure_dates?: string[],        // ISO YYYY-MM-DD, the dates actually published
 *   window_start?: string, window_end?: string,   // cadence window; window_end defaults to as_of
 *   rounding?: { decimal_places: number, mode: 'half_up'|'half_even'|'truncate' },
 * }
 */
export function compute(pp) {
  const rounding = pp.rounding ?? {};
  const decimalPlaces = Number.isInteger(rounding.decimal_places) ? rounding.decimal_places : 2;
  const roundingMode = ['half_up', 'half_even', 'truncate'].includes(rounding.mode) ? rounding.mode : 'half_up';

  const rules = pp.declared_rules ?? {};
  const components = Array.isArray(pp.reserve_components) ? pp.reserve_components : [];
  const tokenType = pp.token_type === 'EMT' ? 'EMT' : (pp.token_type === 'ART' ? 'ART' : null);

  const compliance_flags = [];
  const judgmentFields = [];

  if (tokenType === null) {
    judgmentFields.push({
      field: 'token_type',
      reason: 'token_type must be declared as "ART" (asset-referenced token) or "EMT" (e-money token). It carries no default: the EMT minimum segregated percentage is applied only to an e-money token, and guessing the token type would silently apply or withhold that minimum.',
      supplied: pp.token_type ?? null,
    });
  }

  // ── 1. COVERAGE ───────────────────────────────────────────────────────
  const circulationFixed = toFixed(pp.tokens_in_circulation);
  let reserveTotalFixed = 0n;
  for (const c of components) reserveTotalFixed += toFixed(c?.amount);

  // finite gate #1: zero (or negative) tokens in circulation. A ratio against
  // zero is undefined, so it resolves to null and is flagged — never NaN and
  // never a silent 0 that would read as "no coverage".
  const circulationPositive = circulationFixed > 0n;
  if (!circulationPositive) compliance_flags.push('MICA_CIRCULATION_ZERO');

  // finite gate #2: an empty or zero-valued reserve. The total is a defined 0
  // and the shortfall is the whole amount in circulation.
  const reserveEmpty = components.length === 0 || reserveTotalFixed <= 0n;
  if (reserveEmpty) compliance_flags.push('MICA_RESERVE_EMPTY');

  const coverageRatioFixed = circulationPositive ? divFixed(reserveTotalFixed, circulationFixed) : null;
  const surplusFixed = reserveTotalFixed - circulationFixed;
  const covered = circulationPositive ? reserveTotalFixed >= circulationFixed : null;
  if (covered === true) compliance_flags.push('MICA_RESERVE_COVERED');
  else if (covered === false) compliance_flags.push('MICA_RESERVE_SHORTFALL');

  // ── 2. COMPOSITION ────────────────────────────────────────────────────
  const eligibleClasses = Array.isArray(rules.eligible_asset_classes) ? rules.eligible_asset_classes.map(String) : [];
  const eligibleDeclared = eligibleClasses.length > 0;
  if (!eligibleDeclared) {
    judgmentFields.push({
      field: 'declared_rules.eligible_asset_classes',
      reason: 'No eligible asset classes were declared, so no component can be judged eligible or ineligible. This kernel ships no eligible-asset table and will not supply one: the list is the reader\'s, transcribed from the terms the issuer is being held to.',
      supplied: rules.eligible_asset_classes ?? null,
    });
  }

  // Class totals, in first-appearance order — a stable order that does not
  // depend on object key iteration or on a locale-sensitive sort.
  const classOrder = [];
  const classTotals = new Map();
  for (const c of components) {
    const cls = String(c?.asset_class ?? '');
    if (!classTotals.has(cls)) { classTotals.set(cls, 0n); classOrder.push(cls); }
    classTotals.set(cls, classTotals.get(cls) + toFixed(c?.amount));
  }

  // Every component outside the declared list is LISTED, never dropped, and its
  // amount stays inside reserve_total: silently excluding it would flatter the
  // coverage figure by exactly the amount in question.
  const ineligible_components = [];
  if (eligibleDeclared) {
    components.forEach((c, i) => {
      const cls = String(c?.asset_class ?? '');
      if (!eligibleClasses.includes(cls)) {
        ineligible_components.push({
          index: i,
          component_id: c?.component_id ?? null,
          asset_class: cls,
          amount: fixedToPlainString(toFixed(c?.amount), decimalPlaces),
          reason: 'asset_class is not in the caller\'s declared eligible_asset_classes',
        });
      }
    });
  }
  if (ineligible_components.length > 0) compliance_flags.push('MICA_INELIGIBLE_ASSET');

  const ineligibleTotalFixed = ineligible_components.reduce((acc, x) => acc + toFixed(x.amount), 0n);
  const eligibleReserveTotalFixed = reserveTotalFixed - ineligibleTotalFixed;
  const eligibleCoverageRatioFixed = circulationPositive ? divFixed(eligibleReserveTotalFixed, circulationFixed) : null;

  // Concentration limits are declared as a percentage of the reserve total, per
  // asset class. Keys are read in sorted order so the output does not depend on
  // the caller's object key order.
  const limitsRaw = (rules.concentration_limits && typeof rules.concentration_limits === 'object' && !Array.isArray(rules.concentration_limits))
    ? rules.concentration_limits
    : {};
  const limitKeys = Object.keys(limitsRaw).sort();
  const HUNDRED = toFixed(100);
  const concentration_breaches = [];
  const class_totals = classOrder.map((cls) => {
    const totalFixed = classTotals.get(cls);
    const pctFixed = reserveTotalFixed > 0n ? mulFixed(divFixed(totalFixed, reserveTotalFixed), HUNDRED) : 0n;
    return {
      asset_class: cls,
      amount: fixedToPlainString(totalFixed, decimalPlaces),
      pct_of_reserve: roundFixedToString(pctFixed, decimalPlaces, roundingMode),
      limit_pct: limitKeys.includes(cls) ? String(limitsRaw[cls]) : null,
    };
  });
  for (const cls of limitKeys) {
    if (!classTotals.has(cls)) continue;
    const totalFixed = classTotals.get(cls);
    const pctFixed = reserveTotalFixed > 0n ? mulFixed(divFixed(totalFixed, reserveTotalFixed), HUNDRED) : 0n;
    const limitFixed = toFixed(limitsRaw[cls]);
    if (pctFixed > limitFixed) {
      concentration_breaches.push({
        asset_class: cls,
        amount: fixedToPlainString(totalFixed, decimalPlaces),
        pct_of_reserve: roundFixedToString(pctFixed, decimalPlaces, roundingMode),
        limit_pct: roundFixedToString(limitFixed, decimalPlaces, roundingMode),
        excess_pct: roundFixedToString(pctFixed - limitFixed, decimalPlaces, roundingMode),
      });
    }
  }
  if (concentration_breaches.length > 0) compliance_flags.push('MICA_CONCENTRATION_BREACH');

  // ── 3. SEGREGATION ────────────────────────────────────────────────────
  let segregatedFixed = 0n;
  for (const c of components) if (c?.segregated === true) segregatedFixed += toFixed(c?.amount);
  const segregationPctFixed = reserveTotalFixed > 0n ? mulFixed(divFixed(segregatedFixed, reserveTotalFixed), HUNDRED) : 0n;

  const minPctDeclared = rules.min_segregated_pct !== undefined && rules.min_segregated_pct !== null && String(rules.min_segregated_pct).trim() !== '';
  let minSegregatedPctApplied = null;
  let minSegregatedPctSource = 'not_declared';
  if (minPctDeclared) {
    minSegregatedPctApplied = String(rules.min_segregated_pct);
    minSegregatedPctSource = 'caller_declared';
  } else if (tokenType === 'EMT') {
    minSegregatedPctApplied = EMT_DEFAULT_MIN_SEGREGATED_PCT;
    minSegregatedPctSource = 'default_emt_30';
    compliance_flags.push('MICA_SEGREGATION_MINIMUM_DEFAULTED');
  } else {
    judgmentFields.push({
      field: 'declared_rules.min_segregated_pct',
      reason: 'No minimum segregated percentage was declared and the token is not an e-money token, so no default applies. The 30% figure is an e-money-token rule and applying it to an asset-referenced token would be an invented threshold, not a check.',
      supplied: rules.min_segregated_pct ?? null,
    });
  }

  const minSegregatedFixed = minSegregatedPctApplied === null ? null : toFixed(minSegregatedPctApplied);
  const meetsMinimum = minSegregatedFixed === null ? null : segregationPctFixed >= minSegregatedFixed;
  if (meetsMinimum === false) compliance_flags.push('MICA_SEGREGATION_SHORT');

  const acceptableCustodians = Array.isArray(rules.acceptable_custodian_types) ? rules.acceptable_custodian_types.map(String) : [];
  const custodiansDeclared = acceptableCustodians.length > 0;
  const undeclared_custodian_components = [];
  if (custodiansDeclared) {
    components.forEach((c, i) => {
      const ct = c?.custodian_type === undefined || c?.custodian_type === null ? '' : String(c.custodian_type);
      if (!acceptableCustodians.includes(ct)) {
        undeclared_custodian_components.push({
          index: i,
          component_id: c?.component_id ?? null,
          asset_class: String(c?.asset_class ?? ''),
          custodian_type: ct === '' ? null : ct,
          amount: fixedToPlainString(toFixed(c?.amount), decimalPlaces),
          reason: ct === ''
            ? 'no custodian_type was supplied for this component'
            : 'custodian_type is not one the caller declared acceptable',
        });
      }
    });
  }
  if (undeclared_custodian_components.length > 0) compliance_flags.push('MICA_CUSTODIAN_NOT_DECLARED');

  // ── 4. CADENCE ────────────────────────────────────────────────────────
  const cadenceDaysRaw = rules.cadence_days;
  const cadenceDays = Number(cadenceDaysRaw ?? NaN);
  const cadenceDeclared = Number.isFinite(cadenceDays) && cadenceDays > 0;
  if (!cadenceDeclared) {
    judgmentFields.push({
      field: 'declared_rules.cadence_days',
      reason: 'No publication cadence was declared, so no gap can be measured. The cadence is a caller input on purpose: it is the term the reader is holding the issuer to, and encoding one here would be a bundled rule that goes silently false when it changes.',
      supplied: cadenceDaysRaw ?? null,
    });
  }

  const rawDates = Array.isArray(pp.disclosure_dates) ? pp.disclosure_dates : [];
  const invalid_disclosure_dates = [];
  const dayList = [];
  rawDates.forEach((s, i) => {
    const d = parseIsoDay(s);
    if (d === null) invalid_disclosure_dates.push({ index: i, supplied: s === undefined ? null : String(s) });
    else dayList.push(d);
  });
  if (invalid_disclosure_dates.length > 0) compliance_flags.push('MICA_DISCLOSURE_DATE_UNPARSEABLE');
  const orderedDays = [...new Set(dayList)].sort((a, b) => a - b);

  const windowStartDay = parseIsoDay(pp.window_start);
  const windowEndDay = parseIsoDay(pp.window_end ?? pp.as_of);

  // Each period with no publication is named individually: the gap that opens
  // it, the gap that closes it, and how many days it ran. A count alone would
  // not tell the reader WHICH month went unpublished.
  const missed_periods = [];
  if (cadenceDeclared) {
    if (windowStartDay !== null && orderedDays.length > 0 && orderedDays[0] - windowStartDay > cadenceDays) {
      missed_periods.push({
        from: dayToIso(windowStartDay),
        to: dayToIso(orderedDays[0]),
        gap_days: orderedDays[0] - windowStartDay,
        cadence_days: cadenceDays,
        kind: 'window_open_to_first_publication',
      });
    }
    for (let i = 1; i < orderedDays.length; i++) {
      const gap = orderedDays[i] - orderedDays[i - 1];
      if (gap > cadenceDays) {
        missed_periods.push({
          from: dayToIso(orderedDays[i - 1]),
          to: dayToIso(orderedDays[i]),
          gap_days: gap,
          cadence_days: cadenceDays,
          kind: 'between_publications',
        });
      }
    }
    if (windowEndDay !== null && orderedDays.length > 0 && windowEndDay - orderedDays[orderedDays.length - 1] > cadenceDays) {
      missed_periods.push({
        from: dayToIso(orderedDays[orderedDays.length - 1]),
        to: dayToIso(windowEndDay),
        gap_days: windowEndDay - orderedDays[orderedDays.length - 1],
        cadence_days: cadenceDays,
        kind: 'last_publication_to_window_close',
      });
    }
    if (orderedDays.length === 0 && windowStartDay !== null && windowEndDay !== null && windowEndDay - windowStartDay > cadenceDays) {
      missed_periods.push({
        from: dayToIso(windowStartDay),
        to: dayToIso(windowEndDay),
        gap_days: windowEndDay - windowStartDay,
        cadence_days: cadenceDays,
        kind: 'no_publication_in_window',
      });
    }
  }
  if (missed_periods.length > 0) compliance_flags.push('MICA_DISCLOSURE_GAP');

  if (judgmentFields.length > 0) compliance_flags.push('ESCALATION_RAISED');
  compliance_flags.push('MICA_RESERVE_CHECKED');

  const judgment_required = judgmentFields.length === 0 ? null : {
    fields: judgmentFields,
    reason: 'One or more declared rules were absent, so the corresponding check was not performed. An absent rule is reported as unresolved, never defaulted into a pass.',
  };

  const rationale = [];
  rationale.push(circulationPositive
    ? `Reserve total of ${fixedToPlainString(reserveTotalFixed, decimalPlaces)} checked against ${fixedToPlainString(circulationFixed, decimalPlaces)} of tokens in circulation.`
    : 'Tokens in circulation is zero or negative, so the coverage ratio is undefined and is reported as null by the finite gate, not as zero.');
  rationale.push(reserveEmpty
    ? 'The reserve is empty or totals zero at the values supplied, so the entire amount in circulation is a shortfall.'
    : `The reserve carries ${components.length} declared component${components.length === 1 ? '' : 's'} across ${classOrder.length} asset class${classOrder.length === 1 ? '' : 'es'}.`);
  rationale.push(eligibleDeclared
    ? (ineligible_components.length > 0
        ? (ineligible_components.length === 1
            ? '1 component falls outside the declared eligible classes and is listed on its own; its amount remains inside the reserve total, because excluding it would flatter the coverage figure.'
            : `${ineligible_components.length} components fall outside the declared eligible classes and are listed individually; their amounts remain inside the reserve total, because excluding them would flatter the coverage figure.`)
        : 'Every component sits inside the declared eligible asset classes.')
    : 'No eligible asset classes were declared, so composition was not judged.');
  rationale.push(concentration_breaches.length > 0
    ? (concentration_breaches.length === 1
        ? '1 asset class exceeds the declared concentration limit, named with its excess.'
        : `${concentration_breaches.length} asset classes exceed the declared concentration limit, each named with its excess.`)
    : (limitKeys.length > 0 ? 'No declared concentration limit is exceeded.' : 'No concentration limits were declared, so no limit was tested.'));
  rationale.push(minSegregatedPctApplied === null
    ? 'No minimum segregated percentage applies: none was declared and the token is not an e-money token, so no default was invented.'
    : `Segregated proportion is ${roundFixedToString(segregationPctFixed, decimalPlaces, roundingMode)}% against a minimum of ${minSegregatedPctApplied}% (${minSegregatedPctSource === 'caller_declared' ? 'declared by the caller' : 'the e-money-token default, applied only because the caller declared nothing'}).`);
  rationale.push(custodiansDeclared
    ? (undeclared_custodian_components.length > 0
        ? (undeclared_custodian_components.length === 1
            ? '1 component sits with a custodian type the caller did not declare acceptable, and is named.'
            : `${undeclared_custodian_components.length} components sit with a custodian type the caller did not declare acceptable, each named.`)
        : 'Every component sits with a custodian type the caller declared acceptable.')
    : 'No acceptable custodian types were declared, so custodian type was not tested.');
  rationale.push(!cadenceDeclared
    ? 'No cadence was declared, so publication gaps were not measured.'
    : (missed_periods.length > 0
        ? (missed_periods.length === 1
            ? `1 period ran longer than the declared ${cadenceDays}-day cadence with no publication, named with its dates.`
            : `${missed_periods.length} periods ran longer than the declared ${cadenceDays}-day cadence with no publication, each named with its dates.`)
        : `Every interval between publications is within the declared ${cadenceDays}-day cadence.`));
  rationale.push('Every verdict above is against the rules supplied with this run. It is not a determination that the issuer complies, not legal advice, and not a submission.');

  const output_payload = {
    issuer_id: pp.issuer_id ?? null,
    disclosure_ref: pp.disclosure_ref ?? null,
    rules_version: pp.rules_version ?? null,
    as_of: pp.as_of ?? null,
    token_type: tokenType,
    rounding: { decimal_places: decimalPlaces, mode: roundingMode },
    judgment_required,
    coverage: {
      tokens_in_circulation: fixedToPlainString(circulationFixed, decimalPlaces),
      reserve_total: fixedToPlainString(reserveTotalFixed, decimalPlaces),
      eligible_reserve_total: fixedToPlainString(eligibleReserveTotalFixed, decimalPlaces),
      coverage_ratio: coverageRatioFixed === null ? null : roundFixedToString(coverageRatioFixed, decimalPlaces + 2, roundingMode),
      eligible_coverage_ratio: eligibleCoverageRatioFixed === null ? null : roundFixedToString(eligibleCoverageRatioFixed, decimalPlaces + 2, roundingMode),
      surplus_or_shortfall: fixedToPlainString(surplusFixed, decimalPlaces),
      covered,
      circulation_positive: circulationPositive,
      reserve_empty: reserveEmpty,
    },
    composition: {
      eligible_asset_classes_declared: eligibleClasses,
      class_totals,
      ineligible_components,
      ineligible_total: fixedToPlainString(ineligibleTotalFixed, decimalPlaces),
      concentration_breaches,
    },
    segregation: {
      segregated_amount: fixedToPlainString(segregatedFixed, decimalPlaces),
      segregation_pct: roundFixedToString(segregationPctFixed, decimalPlaces, roundingMode),
      min_segregated_pct_applied: minSegregatedPctApplied,
      min_segregated_pct_source: minSegregatedPctSource,
      meets_declared_minimum: meetsMinimum,
      undeclared_custodian_components,
      acceptable_custodian_types_declared: acceptableCustodians,
    },
    cadence: {
      cadence_days_declared: cadenceDeclared ? cadenceDays : null,
      window_start: windowStartDay === null ? null : dayToIso(windowStartDay),
      window_end: windowEndDay === null ? null : dayToIso(windowEndDay),
      disclosure_dates_ordered: orderedDays.map(dayToIso),
      invalid_disclosure_dates,
      missed_periods,
    },
    sign_off: {
      surface: 'art-503-build-dual-control-certification',
      note: 'Where a named human attests this check, the dual-control certification surface is the one to use. This kernel emits the receipt and evaluates no threshold of its own.',
    },
    rationale,
    not_proven: NOT_PROVEN,
    fence: 'Eligible asset classes, concentration limits, the minimum segregated percentage, acceptable custodian types and the disclosure cadence are every one of them a caller input, transcribed from the terms the reader is holding the issuer to. This kernel ships no reporting template, no eligible-asset table and no issuer library, and performs no lookups of any kind (zero-egress by contract). disclosure_ref and rules_version are pinned so a later rule change makes an old receipt dated, not wrong.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
