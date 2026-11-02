import { executionHash } from './_hash.mjs';

// 784-cbr-data-return-validator — aggregate correspondent-banking data return validator.
// Validates a bank's or money transfer operator's PERIODIC AGGREGATE return (counts of active
// correspondents, relationships opened/terminated, corridor volumes and values by key currency)
// against a profile-driven illustrative template, and rolls up message-quality readiness from
// aggregate summaries (per-message linting itself lives in lint_cbpr_structured_address and
// lint_lei_payment_binding; this kernel never reimplements their rules).
//
// AGGREGATE-ONLY CONTRACT: inputs are counts, sums, currency codes, country codes, period dates
// and enumerated institution types ONLY. An institution is a profile-local pseudonymous code
// (FI-NNN form). Any string leaf outside the enumerations and the pseudonymous-code pattern is
// REFUSED, naming the JSON path only and never echoing the value. Output carries paths, rule ids,
// verdicts and computed aggregates only.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no network, no
// filesystem, no TextEncoder/atob/btoa/URL (zkVM guest subset).

const TOOL_ID = '784-cbr-data-return-validator';
const TOOL_VERSION = '1.0.0';
const TEMPLATE_VERSION = 'CBR-DATA-RETURN-ILLUSTRATIVE-V1';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'validate_cbr_data_return',
  mandate_type: 'compliance_mandate', gpu: false,
};

// ---------------------------------------------------------------------------
// Profile definitions (inline: compute() must stay a self-contained pure function
// for the zkVM guest; a profile is a named input enum, not a side file).
// ---------------------------------------------------------------------------
const PROFILES = {
  generic: {
    key_currencies: ['USD', 'EUR', 'GBP'],   // watch set: global value-share leaders
    required_key_currencies: [],             // generic: at least one currency block, no forced set
    institution_types: ['bank', 'mto', 'other_non_bank'],
  },
  pacific: {
    key_currencies: ['USD', 'AUD', 'NZD'],   // settlement currencies of the Pacific programme
    required_key_currencies: ['USD', 'AUD', 'NZD'], // pacific profile requires all three reported
    institution_types: ['bank', 'mto', 'other_non_bank'],
  },
};

const PROFILE_NAMES = ['generic', 'pacific'];
const INSTITUTION_TYPES = ['bank', 'mto', 'other_non_bank'];
const INSTITUTION_CODE_RE = /^FI-[0-9]{3}$/;
const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// Concentration / tolerance policy (illustrative template settings, stated in output).
const TOP_SHARE_THRESHOLD = 0.80;   // flag when one corridor holds > 80% of outbound value
const HHI_THRESHOLD = 0.50;         // flag when Herfindahl-Hirschman index over corridor shares > 0.50
const VALUE_TOLERANCE_PCT = 0.005;  // corridor-sum vs stated-total value tolerance: 0.5%, floor 1
const COUNT_TOLERANCE = 0;          // counts must sum exactly
const MAX_PERIOD_DAYS = 400;        // a periodic return covers at most ~13 monthly cycles
const MIN_PERIOD_YEAR = 2011;
const MAX_PERIOD_YEAR = 2100;

// Readiness roll-up bands (illustrative, computed from supplied aggregate summaries).
const READINESS_HIGH_FS = 85, READINESS_HIGH_LEI = 70;
const READINESS_MED_FS = 60, READINESS_MED_LEI = 40;

// ISO 4217 alpha-3 currency codes (active list).
const ISO4217 = new Set(('AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES VND VUV WST XAF XAG XAU XBA XBB XBC XBD XCD XCG XDR XOF XPD XPF XPT XSU XTS XUA XXX YER ZAR ZMW ZWL').split(' '));

// ISO 3166-1 alpha-2 country codes (officially assigned + exceptionally reserved).
const ISO3166 = new Set(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' '));

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function isCountInt(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}
function isNonNegNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}
function parseDate(s) {
  // strict YYYY-MM-DD real calendar date -> {y,m,d,utc} or null
  if (typeof s !== 'string' || !DATE_RE.test(s)) return null;
  const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const utc = Date.UTC(y, m - 1, d);
  const dt = new Date(utc);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return { y, m, d, utc };
}
function pct(part, whole) {
  // deterministic percentage rounded to one decimal; 0 on empty population
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.round((1000 * part) / whole) / 10;
}
function round4(x) {
  return Math.round(x * 10000) / 10000;
}

// String-leaf discipline walk. Every string leaf must be one of:
//   profile enum | institution_type enum | ISO 4217 | ISO 3166-1 | date-shaped (period only)
//   | FI-NNN pseudonymous code (institution_code only).
// Anything else is collected for refusal (path only, value NEVER captured).
function collectForeignStringLeaves(node, path, out) {
  if (typeof node === 'string') {
    let ok = false;
    if (path === 'profile') ok = PROFILE_NAMES.indexOf(node) !== -1;
    else if (path === 'institution_type') ok = INSTITUTION_TYPES.indexOf(node) !== -1;
    else if (path === 'institution_code') ok = INSTITUTION_CODE_RE.test(node);
    else if (path === 'period.start' || path === 'period.end') ok = DATE_RE.test(node);
    else if (/\.currency$/.test(path) || /(^|\.|\])currency$/.test(path)) ok = ISO4217.has(node);
    else if (/\.country$/.test(path) || /(^|\.|\])country$/.test(path)) ok = ISO3166.has(node);
    if (!ok) out.push(path);
    return;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      collectForeignStringLeaves(node[i], path === '' ? '[' + i + ']' : path + '[' + i + ']', out);
    }
    return;
  }
  if (isPlainObject(node)) {
    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i++) {
      collectForeignStringLeaves(node[keys[i]], path === '' ? keys[i] : path + '.' + keys[i], out);
    }
  }
}

// Non-string/non-number leaf discipline (booleans, nested junk where scalars belong)
// is a TYPE violation (path only), collected in the same walk. R4 (absent equals
// explicit null): a null leaf is treated exactly like an absent one -- every consumer
// already treats non-objects as missing -- so null never changes the answer.
function collectTypeViolations(node, path, out) {
  if (typeof node === 'string' || typeof node === 'number') return;
  if (node === null || node === undefined) return;
  if (typeof node === 'boolean') {
    out.push(path);
    return;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) collectTypeViolations(node[i], path === '' ? '[' + i + ']' : path + '[' + i + ']', out);
    return;
  }
  if (isPlainObject(node)) {
    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i++) collectTypeViolations(node[keys[i]], path === '' ? keys[i] : path + '.' + keys[i], out);
  }
}

// ---------------------------------------------------------------------------
// compute
// ---------------------------------------------------------------------------
export function compute(pp) {
  pp = pp || {};

  const violations = [];   // {path, rule_id, source} — sorted before return
  const flags = [];        // {flag_id, path, currency?, ...computed detail} — sorted before return

  // ---- 0. string-leaf refusal (aggregate-only contract) --------------------
  const foreign = [];
  collectForeignStringLeaves(pp, '', foreign);
  let refused = null;
  if (foreign.length > 0) {
    foreign.sort();
    refused = { path: foreign[0], reason_code: 'STRING_LEAF_OUTSIDE_ENUMERATION' };
  }

  // ---- 1. type discipline (booleans/nulls where scalars belong) ------------
  const typeBad = [];
  collectTypeViolations(pp, '', typeBad);
  typeBad.sort();
  for (const p of typeBad) violations.push({ path: p, rule_id: 'TYPE_DISCIPLINE', source: 'type' });

  // ---- 2. required fields --------------------------------------------------
  const profileName = typeof pp.profile === 'string' ? pp.profile : '';
  const profile = PROFILES[profileName] || null;
  if (!profile) violations.push({ path: 'profile', rule_id: 'REQ-PROFILE', source: 'required_fields' });
  if (typeof pp.institution_type !== 'string' || INSTITUTION_TYPES.indexOf(pp.institution_type) === -1) {
    violations.push({ path: 'institution_type', rule_id: 'REQ-INSTITUTION-TYPE', source: 'required_fields' });
  }
  if (typeof pp.institution_code !== 'string' || !INSTITUTION_CODE_RE.test(pp.institution_code)) {
    violations.push({ path: 'institution_code', rule_id: 'REQ-INSTITUTION-CODE', source: 'required_fields' });
  }
  if (!isPlainObject(pp.period) || typeof pp.period.start !== 'string' || typeof pp.period.end !== 'string') {
    violations.push({ path: 'period', rule_id: 'REQ-PERIOD', source: 'required_fields' });
  }
  if (!Array.isArray(pp.currencies) || pp.currencies.length === 0) {
    violations.push({ path: 'currencies', rule_id: 'REQ-CURRENCY-BLOCK', source: 'required_fields' });
  }

  // ---- 3. period sanity ----------------------------------------------------
  let periodDays = null;
  if (isPlainObject(pp.period) && typeof pp.period.start === 'string' && typeof pp.period.end === 'string') {
    const s = parseDate(pp.period.start);
    const e = parseDate(pp.period.end);
    if (!s) violations.push({ path: 'period.start', rule_id: 'PERIOD-SANITY', source: 'period' });
    if (!e) violations.push({ path: 'period.end', rule_id: 'PERIOD-SANITY', source: 'period' });
    if (s && e) {
      if (e.utc < s.utc) violations.push({ path: 'period.end', rule_id: 'PERIOD-SANITY', source: 'period' });
      if (s.y < MIN_PERIOD_YEAR || s.y > MAX_PERIOD_YEAR || e.y < MIN_PERIOD_YEAR || e.y > MAX_PERIOD_YEAR) {
        violations.push({ path: 'period', rule_id: 'PERIOD-SANITY', source: 'period' });
      }
      periodDays = Math.round((e.utc - s.utc) / 86400000);
      if (periodDays > MAX_PERIOD_DAYS) {
        violations.push({ path: 'period', rule_id: 'PERIOD-SANITY', source: 'period' });
      }
    }
  }

  // ---- 4. per-currency checks ----------------------------------------------
  const seenCurrencies = [];
  const currencyBlocks = Array.isArray(pp.currencies) ? pp.currencies : [];
  for (let ci = 0; ci < currencyBlocks.length; ci++) {
    const c = currencyBlocks[ci];
    const cpath = 'currencies[' + ci + ']';
    if (!isPlainObject(c)) {
      violations.push({ path: cpath, rule_id: 'REQ-CURRENCY-BLOCK', source: 'required_fields' });
      continue;
    }
    if (typeof c.currency === 'string') {
      if (seenCurrencies.indexOf(c.currency) !== -1) {
        violations.push({ path: cpath + '.currency', rule_id: 'CURRENCY-DUPLICATE', source: 'internal_consistency' });
      }
      seenCurrencies.push(c.currency);
    }

    for (const f of ['opening_correspondents', 'active_correspondents', 'opened', 'terminated_restricted']) {
      if (!isCountInt(c[f])) violations.push({ path: cpath + '.' + f, rule_id: 'REQ-NUMERIC-FIELD', source: 'required_fields' });
    }

    // roll-forward: opening + opened - terminated == active (closing)
    if (isCountInt(c.opening_correspondents) && isCountInt(c.opened) &&
        isCountInt(c.terminated_restricted) && isCountInt(c.active_correspondents)) {
      const expect = c.opening_correspondents + c.opened - c.terminated_restricted;
      if (expect !== c.active_correspondents) {
        violations.push({ path: cpath + '.active_correspondents', rule_id: 'COUNT-ROLLFORWARD', source: 'internal_consistency' });
      }
    }

    // corridors
    const corridors = Array.isArray(c.corridors) ? c.corridors : null;
    if (!corridors || corridors.length === 0) {
      violations.push({ path: cpath + '.corridors', rule_id: 'REQ-CORRIDORS', source: 'required_fields' });
    } else {
      const seenCountries = [];
      let sumOBCount = 0, sumIBCount = 0, sumOBValue = 0, sumIBValue = 0;
      let corridorValuesOk = true;
      for (let ki = 0; ki < corridors.length; ki++) {
        const k = corridors[ki];
        const kpath = cpath + '.corridors[' + ki + ']';
        if (!isPlainObject(k)) {
          violations.push({ path: kpath, rule_id: 'REQ-CORRIDORS', source: 'required_fields' });
          continue;
        }
        if (typeof k.country === 'string' && seenCountries.indexOf(k.country) !== -1) {
          violations.push({ path: kpath + '.country', rule_id: 'CORRIDOR-DUPLICATE', source: 'internal_consistency' });
        }
        if (typeof k.country === 'string') seenCountries.push(k.country);

        if (!isCountInt(k.outbound_count)) { violations.push({ path: kpath + '.outbound_count', rule_id: 'REQ-NUMERIC-FIELD', source: 'required_fields' }); }
        if (!isCountInt(k.inbound_count)) { violations.push({ path: kpath + '.inbound_count', rule_id: 'REQ-NUMERIC-FIELD', source: 'required_fields' }); }
        if (!isNonNegNumber(k.outbound_value)) { violations.push({ path: kpath + '.outbound_value', rule_id: 'REQ-NUMERIC-FIELD', source: 'required_fields' }); corridorValuesOk = false; }
        if (!isNonNegNumber(k.inbound_value)) { violations.push({ path: kpath + '.inbound_value', rule_id: 'REQ-NUMERIC-FIELD', source: 'required_fields' }); corridorValuesOk = false; }

        if (isCountInt(k.outbound_count)) sumOBCount += k.outbound_count;
        if (isCountInt(k.inbound_count)) sumIBCount += k.inbound_count;
        if (isNonNegNumber(k.outbound_value)) sumOBValue += k.outbound_value;
        if (isNonNegNumber(k.inbound_value)) sumIBValue += k.inbound_value;
      }

      // stated totals cross-check (tolerance: counts exact, values 0.5% floor 1)
      if (isPlainObject(c.totals)) {
        if (isCountInt(c.totals.outbound_count) && Math.abs(sumOBCount - c.totals.outbound_count) > COUNT_TOLERANCE) {
          violations.push({ path: cpath + '.totals.outbound_count', rule_id: 'CORRIDOR-SUM-COUNT', source: 'internal_consistency' });
        }
        if (isCountInt(c.totals.inbound_count) && Math.abs(sumIBCount - c.totals.inbound_count) > COUNT_TOLERANCE) {
          violations.push({ path: cpath + '.totals.inbound_count', rule_id: 'CORRIDOR-SUM-COUNT', source: 'internal_consistency' });
        }
        if (corridorValuesOk && isNonNegNumber(c.totals.outbound_value)) {
          const tol = Math.max(1, VALUE_TOLERANCE_PCT * c.totals.outbound_value);
          if (Math.abs(sumOBValue - c.totals.outbound_value) > tol) {
            violations.push({ path: cpath + '.totals.outbound_value', rule_id: 'CORRIDOR-SUM-VALUE', source: 'internal_consistency' });
          }
        }
        if (corridorValuesOk && isNonNegNumber(c.totals.inbound_value)) {
          const tol = Math.max(1, VALUE_TOLERANCE_PCT * c.totals.inbound_value);
          if (Math.abs(sumIBValue - c.totals.inbound_value) > tol) {
            violations.push({ path: cpath + '.totals.inbound_value', rule_id: 'CORRIDOR-SUM-VALUE', source: 'internal_consistency' });
          }
        }
      }

      // concentration over outbound-value corridor shares
      if (corridorValuesOk && sumOBValue > 0) {
        const shares = corridors
          .filter((k) => isPlainObject(k) && isNonNegNumber(k.outbound_value))
          .map((k) => k.outbound_value / sumOBValue);
        const top = Math.max.apply(null, shares);
        let hhi = 0;
        for (const s of shares) hhi += s * s;
        if (top > TOP_SHARE_THRESHOLD) {
          flags.push({ flag_id: 'CONCENTRATION_TOP_CORRIDOR', path: cpath, currency: typeof c.currency === 'string' ? c.currency : null, top_corridor_share: round4(top), threshold: TOP_SHARE_THRESHOLD });
        }
        if (hhi > HHI_THRESHOLD) {
          flags.push({ flag_id: 'CONCENTRATION_HHI', path: cpath, currency: typeof c.currency === 'string' ? c.currency : null, hhi: round4(hhi), threshold: HHI_THRESHOLD });
        }
      }
    }
  }

  // ---- 5. key-currency watch (profile-driven) -------------------------------
  if (profile) {
    for (const req of profile.required_key_currencies) {
      if (seenCurrencies.indexOf(req) === -1) {
        violations.push({ path: 'currencies', rule_id: 'REQ-KEY-CURRENCY', source: 'required_fields' });
        break; // one violation names the requirement; the missing set is in profile_definition
      }
    }
    for (let ci = 0; ci < currencyBlocks.length; ci++) {
      const c = currencyBlocks[ci];
      if (!isPlainObject(c)) continue;
      if (profile.key_currencies.indexOf(c.currency) === -1) continue;
      if (isCountInt(c.active_correspondents)) {
        if (c.active_correspondents === 1) {
          flags.push({ flag_id: 'KEY_CURRENCY_SINGLE_CORRESPONDENT', path: 'currencies[' + ci + ']', currency: c.currency, active_correspondents: 1 });
        } else if (c.active_correspondents === 0) {
          violations.push({ path: 'currencies[' + ci + '].active_correspondents', rule_id: 'KEY-CURRENCY-NO-CORRESPONDENT', source: 'key_currency_watch' });
        }
      }
    }
  }

  // ---- 6. message-quality readiness roll-up (supplied summaries only) -------
  let readiness = { status: 'not_supplied' };
  const mq = pp.message_quality;
  if (mq !== undefined && mq !== null) {
    if (!isPlainObject(mq)) {
      violations.push({ path: 'message_quality', rule_id: 'REQ-MESSAGE-QUALITY', source: 'required_fields' });
    } else {
      const need = ['messages_linted', 'fully_structured', 'hybrid', 'unstructured', 'lei_linted', 'lei_valid'];
      let countsOk = true;
      for (const f of need) {
        if (!isCountInt(mq[f])) {
          violations.push({ path: 'message_quality.' + f, rule_id: 'REQ-NUMERIC-FIELD', source: 'required_fields' });
          countsOk = false;
        }
      }
      if (countsOk) {
        if (mq.fully_structured + mq.hybrid + mq.unstructured !== mq.messages_linted) {
          violations.push({ path: 'message_quality', rule_id: 'MESSAGE-QUALITY-SUM', source: 'message_quality' });
        }
        if (mq.lei_valid > mq.lei_linted) {
          violations.push({ path: 'message_quality.lei_valid', rule_id: 'MESSAGE-QUALITY-SUM', source: 'message_quality' });
        }
        const fsPct = pct(mq.fully_structured, mq.messages_linted);
        const hyPct = pct(mq.hybrid, mq.messages_linted);
        const unPct = pct(mq.unstructured, mq.messages_linted);
        const leiPct = pct(mq.lei_valid, mq.lei_linted);
        const leiCoveragePct = pct(mq.lei_linted, mq.messages_linted);
        let band = 'LOW';
        if (fsPct >= READINESS_HIGH_FS && leiPct >= READINESS_HIGH_LEI) band = 'HIGH';
        else if (fsPct >= READINESS_MED_FS && leiPct >= READINESS_MED_LEI) band = 'MEDIUM';
        readiness = {
          status: 'supplied',
          messages_linted: mq.messages_linted,
          fully_structured_pct: fsPct,
          hybrid_pct: hyPct,
          unstructured_pct: unPct,
          valid_lei_pct: leiPct,
          lei_coverage_pct: leiCoveragePct,
          band,
        };
      } else {
        readiness = { status: 'not_supplied' };
      }
    }
  }

  // ---- assemble -------------------------------------------------------------
  violations.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.rule_id < b.rule_id ? -1 : a.rule_id > b.rule_id ? 1 : 0));
  flags.sort((a, b) => (a.flag_id < b.flag_id ? -1 : a.flag_id > b.flag_id ? 1 : a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const rules_checked = [
    'CONCENTRATION_HHI',
    'CONCENTRATION_TOP_CORRIDOR',
    'CORRIDOR-DUPLICATE',
    'CORRIDOR-SUM-COUNT',
    'CORRIDOR-SUM-VALUE',
    'COUNT-ROLLFORWARD',
    'CURRENCY-DUPLICATE',
    'ENUM_STRING_LEAVES',
    'KEY-CURRENCY-NO-CORRESPONDENT',
    'KEY_CURRENCY_SINGLE_CORRESPONDENT',
    'MESSAGE-QUALITY-SUM',
    'PERIOD-SANITY',
    'REQ-CORRIDORS',
    'REQ-CURRENCY-BLOCK',
    'REQ-INSTITUTION-CODE',
    'REQ-INSTITUTION-TYPE',
    'REQ-KEY-CURRENCY',
    'REQ-MESSAGE-QUALITY',
    'REQ-NUMERIC-FIELD',
    'REQ-PERIOD',
    'REQ-PROFILE',
    'TYPE_DISCIPLINE',
  ];

  const output_payload = {
    valid: !refused && violations.length === 0,
    refused,
    violations,
    flags,
    warn_count: flags.length,
    readiness,
    rules_checked,
    profile: profileName || null,
    template_version: TEMPLATE_VERSION,
    profile_definition: {
      key_currencies: profile ? profile.key_currencies.slice() : [],
      required_key_currencies: profile ? profile.required_key_currencies.slice() : [],
      top_share_threshold: TOP_SHARE_THRESHOLD,
      hhi_threshold: HHI_THRESHOLD,
      value_tolerance_pct: VALUE_TOLERANCE_PCT,
      count_tolerance: COUNT_TOLERANCE,
      max_period_days: MAX_PERIOD_DAYS,
    },
    computed: {
      currencies_reported: seenCurrencies.length,
      period_days: periodDays,
    },
    pii_note: 'Aggregate-only return: counts, sums, currency codes, country codes, period dates and enumerated institution types. Institutions appear only as profile-local pseudonymous codes (FI-NNN form). No customer, counterparty, correspondent or institution names, BIC, LEI or account identifiers are accepted; any string leaf outside the enumerations is refused by JSON path with the value never echoed. Use synthetic or anonymised data only.',
    disambiguation: 'validate_cbr_data_return validates an AGGREGATE periodic data return against an illustrative profile-driven template. Per-message ISO 20022 address linting lives in lint_cbpr_structured_address (art-241) and per-message LEI/transparency linting in lint_lei_payment_binding (art-246); this node accepts only their aggregate summaries as input values and never reimplements their rules. This template is illustrative and is not any official project data collection template or resilience index.',
  };

  const compliance_flags = [];
  if (refused) compliance_flags.push('FREE_TEXT_LEAF_REFUSED');
  if (!refused && violations.length > 0) compliance_flags.push('RETURN_HAS_VIOLATIONS');
  const seenFlagIds = [];
  for (const f of flags) {
    if (seenFlagIds.indexOf(f.flag_id) === -1) { seenFlagIds.push(f.flag_id); compliance_flags.push(f.flag_id); }
  }

  return { output_payload, compliance_flags };
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
