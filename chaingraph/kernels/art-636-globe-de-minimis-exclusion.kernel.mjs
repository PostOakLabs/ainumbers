import { executionHash } from './_hash.mjs';

// art-636-globe-de-minimis-exclusion — the PERMANENT GloBE de minimis EXCLUSION of
// Article 5.5 of the OECD GloBE Model Rules (Pillar Two, December 2021).
//
// THIS IS NOT art-456. Pillar Two carries TWO de minimis rules and they are different:
//   (a) the TRANSITIONAL CbCR SAFE HARBOUR de minimis TEST — a SINGLE fiscal year, taken
//       from the Qualified CbCR, testing revenue and profit-before-tax. That is
//       art-456-globe-safe-harbour-tests, already built and sealed. This kernel does NOT
//       recompute it and must never be read as doing so.
//   (b) the PERMANENT GloBE de minimis EXCLUSION — an Annual Election, tested on GloBE
//       Revenue and GloBE Income or Loss AVERAGED across the current and the two preceding
//       Fiscal Years. That is this kernel, and nothing else in the estate computes it.
//
// PRIMARY TEXT — retrieved, pinned and hashed by PILLAR2-DEMINIMIS-K-1 (SO #38):
//   GloBE Model Rules (Pillar Two), OECD, December 2021, Article 5.5.1-5.5.4 (pp. 32-33)
//     research/clause-snapshots/OECD-GloBE-Model-Rules-Dec2021-oecd-2026-08-17.pdf
//     sha256:796d1a16fad360204a76450f5246e038263ef4bc652356f25d367d4b9389e306
//   Commentary to the GloBE Model Rules, OECD, March 2022, paras 79-96 (pp. 130-134)
//     research/clause-snapshots/OECD-GloBE-Commentary-Mar2022-oecd-2026-08-17.pdf
//     sha256:6296fc4c21df10b33c39f0d02a2762f636349193c35787421caba71f5714ff50
//
// THE FOUR RULES THIS KERNEL ENCODES, each from the text above and NOT from a summary:
//   1. WINDOW — Art 5.5.2: the average is over "the current and the two preceding Fiscal
//      Years". Commentary para 84 names it a three-year average. The window length is a
//      VERSIONED POLICY PARAMETER, never a constant here.
//   2. THRESHOLDS — Art 5.5.1: Average GloBE Revenue "less than EUR 10 million" AND
//      Average GloBE Income or Loss "is a loss or is less than EUR 1 million". Both are
//      STRICT inequalities and both are versioned policy parameters.
//   3. PARTIAL WINDOW — Art 5.5.2, second sentence: where there were no Constituent
//      Entities with GloBE Revenue or GloBE Losses located in the jurisdiction in the first
//      or second preceding Fiscal Year, "such year or years shall be EXCLUDED from the
//      calculation". Commentary para 85 confirms: the year leaves the computation entirely,
//      so the DIVISOR SHRINKS. It is not carried as a zero.
//   4. LOSS-YEAR SIGN — Art 5.5.3(b): the GloBE Income or Loss of a jurisdiction is the Net
//      GloBE Income "if any, or the Net GloBE Loss". Commentary para 91: where the Chapter-3
//      difference "is nil or negative, the outcome is a loss and that is the Net GloBE
//      Loss". Commentary para 84: the current year's value "(whether income or loss)" is
//      averaged. So A LOSS YEAR ENTERS THE AVERAGE AS A SIGNED NEGATIVE, never as zero.
//      Confirmed arithmetically by the OECD's own Example 5.5.2-1, where a Year-3 loss of
//      EUR 200,000 is what drags a (100,000 + 100,000 - 200,000) / 3 average down to zero.
//
// CONJUNCTION — Commentary para 81: the two conditions "are aggregate and cumulative", and
// if the jurisdiction fails ONE of them it is not eligible. Coded as an AND on that
// authority, not on inference.
//
// SCOPE LIMITS, declared rather than silently assumed:
//   - Short Fiscal Years (Art 5.5.2 / Commentary para 86 / Example 5.5.2-1) are annualised
//     by the CALLER. This kernel takes already-annualised per-year amounts.
//   - Currency conversion into EUR (Commentary para 83) is the caller's.
//   - Art 5.5.4's exclusion of Stateless Constituent Entities and Investment Entities from
//     the Art 5.5.3 computations is applied UPSTREAM: the per-year amounts supplied here are
//     already net of them. The kernel echoes the caller's declaration that this was done.
//   - The election itself (Art 5.5.1, an Annual Election) is a FILER JUDGMENT. It enters as
//     a declared input and is echoed back; it is never inferred.
//
// This node RECOMPUTES a declared arithmetic test and reports whether the inputs match the
// thresholds. It is not tax advice and states no filing conclusion.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no
// network, no filesystem. It runs unmodified inside the QuickJS-ng zkVM guest, which is a
// STRICT SUBSET of a browser/Node global environment: TextEncoder/atob/btoa/URL are ALL
// ABSENT. This kernel is pure arithmetic over numbers and needs none of them — the
// scaffold's pure-JS UTF-8 encoder was deleted rather than left as dead weight.

const TOOL_ID = 'art-636-globe-de-minimis-exclusion';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'evaluate_globe_de_minimis_exclusion',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Hard ceiling on the declared averaging window. Art 5.5.2's window is three Fiscal Years;
// this bound exists so a caller-supplied window_years can never drive an unbounded loop
// (GPU-CYCLE-PREFLIGHT-1's static pre-screen: no policy_parameters-driven loop bound).
const MAX_YEARS_CEILING = 10;

/** Finite-number guard — rejects NaN, Infinity, null, booleans and numeric strings alike. */
function isFiniteNumber(v) {
  return typeof v === 'number' && isFinite(v);
}

/**
 * Reads one versioned parameter. Accepts either a bare number or the
 * (value, effective_from, effective_to, source, source_digest) tuple that ACCT-RULEREG-K-1
 * will supply — shape convergence, no blocking dependency on that row.
 */
function readVersionedParam(raw) {
  if (isFiniteNumber(raw)) return { value: raw, provenance: null };
  if (raw && typeof raw === 'object' && isFiniteNumber(raw.value)) {
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
 * compute(pp) — Article 5.5 de minimis exclusion evaluator.
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const flags = [];
  const notes = [];
  let manualReview = false;

  // ---- 1. Versioned policy parameters (Art 5.5.1 thresholds + Art 5.5.2 window) --------
  // Every one of these is an INPUT. None is a constant in kernel math: that is what lets a
  // later threshold or window change ride execution_hash without moving kernel_digest.
  const params = (pp.de_minimis_parameters && typeof pp.de_minimis_parameters === 'object')
    ? pp.de_minimis_parameters
    : {};
  const parameterSetVersion = typeof params.parameter_set_version === 'string'
    ? params.parameter_set_version
    : null;

  const revenueThreshold = readVersionedParam(params.revenue_threshold_eur);
  const incomeThreshold = readVersionedParam(params.income_threshold_eur);
  const windowParam = readVersionedParam(params.averaging_window_years);

  if (revenueThreshold.value === null) {
    manualReview = true;
    flags.push('MISSING_REVENUE_THRESHOLD_PARAMETER');
    notes.push('de_minimis_parameters.revenue_threshold_eur is absent or not a finite number. Art 5.5.1(a) cannot be evaluated without it and no default is supplied.');
  }
  if (incomeThreshold.value === null) {
    manualReview = true;
    flags.push('MISSING_INCOME_THRESHOLD_PARAMETER');
    notes.push('de_minimis_parameters.income_threshold_eur is absent or not a finite number. Art 5.5.1(b) cannot be evaluated without it and no default is supplied.');
  }
  if (windowParam.value === null) {
    manualReview = true;
    flags.push('MISSING_AVERAGING_WINDOW_PARAMETER');
    notes.push('de_minimis_parameters.averaging_window_years is absent or not a finite number. Art 5.5.2 fixes the window at the current and the two preceding Fiscal Years, but the length is carried as a versioned parameter and is not defaulted here.');
  }
  if (parameterSetVersion === null) {
    manualReview = true;
    flags.push('MISSING_PARAMETER_SET_VERSION');
    notes.push('de_minimis_parameters.parameter_set_version is absent. The rule vintage behind the thresholds is undeclared.');
  }

  // ---- 2. max_years — declared AND enforced ------------------------------------------
  const declaredMaxYears = isFiniteNumber(pp.max_years) ? Math.floor(pp.max_years) : null;
  let maxYears = declaredMaxYears === null ? MAX_YEARS_CEILING : declaredMaxYears;
  if (declaredMaxYears === null) {
    manualReview = true;
    flags.push('MISSING_MAX_YEARS_DECLARATION');
    notes.push('max_years was not declared. The kernel ceiling of ' + MAX_YEARS_CEILING + ' applies to bound the input array, and the result is held for review.');
  } else if (declaredMaxYears < 1 || declaredMaxYears > MAX_YEARS_CEILING) {
    maxYears = MAX_YEARS_CEILING;
    manualReview = true;
    flags.push('MAX_YEARS_OUT_OF_RANGE');
    notes.push('Declared max_years ' + declaredMaxYears + ' is outside the enforced range 1..' + MAX_YEARS_CEILING + '. The kernel ceiling applies instead.');
  }

  const windowYears = windowParam.value === null ? null : Math.floor(windowParam.value);
  if (windowYears !== null && windowYears > maxYears) {
    manualReview = true;
    flags.push('WINDOW_EXCEEDS_MAX_YEARS');
    notes.push('Declared averaging window of ' + windowYears + ' Fiscal Years exceeds the enforced max_years bound of ' + maxYears + '.');
  }

  // ---- 3. The per-year input array, bounded --------------------------------------------
  const rawYears = Array.isArray(pp.years) ? pp.years : [];
  if (!Array.isArray(pp.years)) {
    manualReview = true;
    flags.push('MISSING_YEARS_INPUT');
    notes.push('policy_parameters.years is absent or not an array. Per-year GloBE Revenue and GloBE Income or Loss are required and are never defaulted.');
  }
  if (rawYears.length > maxYears) {
    manualReview = true;
    flags.push('YEARS_ARRAY_EXCEEDS_MAX_YEARS');
    notes.push('The years array carries ' + rawYears.length + ' entries against an enforced max_years bound of ' + maxYears + '. Only the first ' + maxYears + ' are read.');
  }
  const years = rawYears.slice(0, maxYears);

  const currentFiscalYear = isFiniteNumber(pp.fiscal_year) ? Math.floor(pp.fiscal_year) : null;
  if (currentFiscalYear === null) {
    manualReview = true;
    flags.push('MISSING_CURRENT_FISCAL_YEAR');
    notes.push('policy_parameters.fiscal_year is absent. Art 5.5.2 anchors the window on the current Fiscal Year, which cannot be identified without it.');
  }

  // ---- 4. Classify each supplied year --------------------------------------------------
  // Art 5.5.2 second sentence: a preceding year with NO Constituent Entities carrying GloBE
  // Revenue or GloBE Losses is EXCLUDED from the computation. Excluded years leave the
  // divisor. A year that is merely MISSING data is a different state and is never inferred
  // to be either an excluded year or a zero.
  const yearRows = [];
  let sumRevenue = 0;
  let sumIncome = 0;
  let includedCount = 0;
  let excludedCount = 0;
  let currentYearSeen = false;

  for (let i = 0; i < years.length; i++) {
    const y = (years[i] && typeof years[i] === 'object') ? years[i] : {};
    const fy = isFiniteNumber(y.fiscal_year) ? Math.floor(y.fiscal_year) : null;
    const isCurrent = fy !== null && currentFiscalYear !== null && fy === currentFiscalYear;
    if (isCurrent) currentYearSeen = true;

    // The caller's Art 5.5.2 declaration for this year.
    const declaredNoCEs = y.no_constituent_entities === true;
    const revenue = isFiniteNumber(y.globe_revenue_eur) ? y.globe_revenue_eur : null;
    const income = isFiniteNumber(y.globe_income_or_loss_eur) ? y.globe_income_or_loss_eur : null;

    if (declaredNoCEs) {
      if (isCurrent) {
        // Art 5.5.2 permits exclusion only for "the first or second preceding Fiscal Year".
        manualReview = true;
        flags.push('CURRENT_YEAR_DECLARED_EXCLUDED');
        notes.push('Fiscal Year ' + fy + ' is the current Fiscal Year and was declared as having no Constituent Entities. Art 5.5.2 permits exclusion only for a preceding Fiscal Year.');
        yearRows.push({ fiscal_year: fy, status: 'invalid_current_year_exclusion', globe_revenue_eur: null, globe_income_or_loss_eur: null, is_loss_year: null });
        continue;
      }
      excludedCount++;
      yearRows.push({
        fiscal_year: fy,
        status: 'excluded_no_constituent_entities',
        globe_revenue_eur: null,
        globe_income_or_loss_eur: null,
        is_loss_year: null,
      });
      continue;
    }

    if (revenue === null || income === null) {
      // Absent data. Never a silent default, never a zero, never an implied exclusion.
      manualReview = true;
      flags.push('MISSING_YEAR_DATA');
      notes.push('Fiscal Year ' + (fy === null ? '(unidentified)' : fy) + ' supplied neither complete amounts nor an Art 5.5.2 no-Constituent-Entities declaration. It is held for review rather than defaulted.');
      yearRows.push({
        fiscal_year: fy,
        status: 'missing_data',
        globe_revenue_eur: revenue,
        globe_income_or_loss_eur: income,
        is_loss_year: null,
      });
      continue;
    }

    // Included. The income term carries its SIGN: a GloBE Loss is negative and pulls the
    // average down (Art 5.5.3(b), Commentary paras 84 and 91).
    sumRevenue += revenue;
    sumIncome += income;
    includedCount++;
    yearRows.push({
      fiscal_year: fy,
      status: 'included',
      globe_revenue_eur: revenue,
      globe_income_or_loss_eur: income,
      is_loss_year: income < 0,
    });
  }

  if (currentFiscalYear !== null && !currentYearSeen) {
    manualReview = true;
    flags.push('CURRENT_FISCAL_YEAR_ABSENT_FROM_YEARS');
    notes.push('No entry in the years array matches the declared current Fiscal Year ' + currentFiscalYear + '. Art 5.5.2 always includes the current Fiscal Year in the average.');
  }

  // ---- 5. Partial window ---------------------------------------------------------------
  // Fewer years than the declared window is a REAL case under Art 5.5.2, not an error. It is
  // only reported. It becomes a review item when the shortfall is unexplained: an excluded
  // year explains itself, a simply-absent year does not.
  const partialWindowUsed = windowYears !== null && includedCount > 0 && includedCount < windowYears;
  const accountedYears = includedCount + excludedCount;
  if (windowYears !== null && accountedYears < windowYears) {
    manualReview = true;
    flags.push('WINDOW_YEARS_UNACCOUNTED');
    notes.push('The declared averaging window is ' + windowYears + ' Fiscal Years but only ' + accountedYears + ' were accounted for (included or declared excluded). The remaining years are neither present nor explained.');
  }

  const declaredInScope = isFiniteNumber(pp.years_jurisdiction_in_scope)
    ? Math.floor(pp.years_jurisdiction_in_scope)
    : null;
  if (declaredInScope !== null && declaredInScope !== includedCount) {
    manualReview = true;
    flags.push('IN_SCOPE_YEAR_COUNT_MISMATCH');
    notes.push('Declared years_jurisdiction_in_scope of ' + declaredInScope + ' does not match the ' + includedCount + ' year(s) actually carrying amounts.');
  }

  // ---- 6. The two averages -------------------------------------------------------------
  // ROUNDING STEP 1 (revenue average) and ROUNDING STEP 2 (income average): Art 5.5.2 states
  // the average and is SILENT on any rounding mode or precision. The declared choice is to
  // divide in IEEE-754 binary64 and apply NO rounding, so the comparison in step 3 sees the
  // full-precision quotient. See rounding_steps in the node shard: the asserted property is
  // that the choice is DECLARED, not that it is more correct than another (P27).
  let averageRevenue = null;
  let averageIncome = null;
  if (includedCount > 0) {
    averageRevenue = sumRevenue / includedCount;
    averageIncome = sumIncome / includedCount;
  } else {
    manualReview = true;
    flags.push('NO_INCLUDED_YEARS');
    notes.push('No Fiscal Year in the window carried amounts, so neither average is defined. Art 5.5.1 cannot be evaluated.');
  }

  // ---- 7. The two conditions (Art 5.5.1) -----------------------------------------------
  // ROUNDING STEP 3 (threshold comparison precision): the comparison is the strict "<" of
  // Art 5.5.1 applied to the unrounded binary64 average. An average EXACTLY equal to a
  // threshold does NOT meet the condition. Clause silent on comparison precision; declared.
  let revenueTestMet = null;
  let incomeTestMet = null;
  let incomeIsLoss = null;

  if (averageRevenue !== null && revenueThreshold.value !== null) {
    revenueTestMet = averageRevenue < revenueThreshold.value;
  }
  if (averageIncome !== null && incomeThreshold.value !== null) {
    // Art 5.5.1(b) states two limbs: the average "is a loss" OR "is less than EUR 1
    // million". Both are evaluated and reported. The loss limb is subsumed arithmetically
    // by the threshold limb for any positive threshold, and is kept explicit so the output
    // maps one-to-one onto the clause rather than onto a simplification of it.
    incomeIsLoss = averageIncome < 0;
    incomeTestMet = incomeIsLoss || averageIncome < incomeThreshold.value;
  }

  // ---- 8. The caller's declarations (Art 5.5.1 election, Art 5.5.4 upstream exclusion) --
  // Both are evaluated BEFORE the conjunction below, because each can raise manualReview and
  // the availability verdict is withheld whenever review is required. Evaluating them after
  // the verdict would grant availability over an input the kernel has already judged
  // incomplete — which is precisely what the property floor's no-silent-defaults leg checks.
  const electionDeclared = typeof pp.election_made === 'boolean' ? pp.election_made : null;
  if (electionDeclared === null) {
    manualReview = true;
    flags.push('ELECTION_NOT_DECLARED');
    notes.push('election_made was not declared. The Art 5.5.1 Annual Election is the Filing Constituent Entity\'s judgment and is never inferred here.');
  }

  const upstreamExclusionDeclared = pp.stateless_and_investment_entities_excluded === true;
  if (!upstreamExclusionDeclared) {
    manualReview = true;
    flags.push('ART_5_5_4_EXCLUSION_NOT_DECLARED');
    notes.push('The caller did not declare that Stateless Constituent Entities and Investment Entities were excluded from the supplied amounts, as Art 5.5.4 requires of the Art 5.5.3 computations.');
  }

  // Commentary para 81: the conditions are "aggregate and cumulative" — a CONJUNCTION.
  const deMinimisAvailable = (revenueTestMet === true && incomeTestMet === true && !manualReview);

  // Deemed-zero is reported only where the conditions match AND the election was declared
  // made. A recomputed arithmetic outcome on declared inputs, not a filing conclusion.
  const deemedZeroTopup = deMinimisAvailable && electionDeclared === true;

  if (deMinimisAvailable && electionDeclared === false) {
    notes.push('The Art 5.5.1 conditions match on the declared inputs, but the election was declared NOT made, so no deemed-zero outcome is reported.');
  }

  if (manualReview) flags.push('MANUAL_REVIEW_REQUIRED');

  return {
    output_payload: {
      jurisdiction: typeof pp.jurisdiction === 'string' ? pp.jurisdiction : null,
      fiscal_year: currentFiscalYear,
      parameter_set_version: parameterSetVersion,
      averaging_window_years: windowYears,
      max_years_enforced: maxYears,
      thresholds_applied: {
        revenue_threshold_eur: revenueThreshold.value,
        revenue_threshold_provenance: revenueThreshold.provenance,
        income_threshold_eur: incomeThreshold.value,
        income_threshold_provenance: incomeThreshold.provenance,
      },
      years_evaluated: yearRows,
      years_included: includedCount,
      years_excluded_no_constituent_entities: excludedCount,
      partial_window_used: partialWindowUsed,
      average_globe_revenue_eur: averageRevenue,
      average_globe_income_eur: averageIncome,
      average_globe_income_is_loss: incomeIsLoss,
      revenue_test_met: revenueTestMet,
      income_test_met: incomeTestMet,
      de_minimis_available: deMinimisAvailable,
      election_made: electionDeclared,
      deemed_zero_topup: deemedZeroTopup,
      manual_review_required: manualReview,
      notes,
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
