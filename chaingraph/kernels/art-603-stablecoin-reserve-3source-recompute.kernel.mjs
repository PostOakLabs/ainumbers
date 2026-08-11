// art-603 — Stablecoin Reserve 3-Source Recompute: pure decision kernel.
//
// research/SPEC-STABLECOIN-3SRC-1.md §1-§8. Recomputes reserve ratio, WAM
// (weighted-average maturity), and per-holding GENIUS eligible-asset match
// from three INDEPENDENTLY-SOURCED, caller-declared legs, then reconciles
// them against each other. Not re-specifying PACKS-STABLECOIN-1's art-582
// (1:1 coverage + report-timeliness check) or art-584 (Merkle-sum PoR) —
// this node is the granular per-asset-class + cross-source reconcile that
// neither of those covers.
//
// ⛔⛔ THIS KERNEL NEVER USES A WORD IMPLYING THIRD-PARTY SIGN-OFF, ANYWHERE
// (kernel, page copy, manifest) — this is a RECOMPUTE. We recalculate
// reserve ratio, WAM, and per-holding eligible-asset match from published
// figures and report whether three independently-sourced numbers
// reconcile. Never a solvency or compliance conclusion, never "satisfies
// GENIUS", never "audit"/"examination".
//
// Verdict vocabulary (spec §1, fixed, no other form emitted):
//   Per-requirement recompute checks (reserve ratio, WAM ceiling):
//     MET | NOT_MET | INDETERMINATE
//   Per-holding GENIUS eligible-asset flag:
//     MATCHES_CRITERION | DOES_NOT_MATCH | INDETERMINATE
//   Cross-source reconcile checks:
//     RECONCILED | DISCREPANT | INDETERMINATE
//   overall_determination: worst-of rollup (MET|NOT_MET|INDETERMINATE
//   vocabulary), across every check in §4-§7. ⛔ No `overall_eligibility`
//   field of any kind — §6's per-holding flags are a LIST, never merged
//   into a single compliance boolean.
//
// THREE LEGS (spec §2), each independently sourced, each optional at the
// type level — a missing leg drives every check that depends on it to
// INDETERMINATE, never a fabricated pass (art-584's `!reserveProofRaw ->
// INDETERMINATE` pattern, mirrored here):
//   Leg A — issuer's own published reserve report, extended with a
//           per-asset-class breakdown. User-pasted, zero-fetch, zero-PII.
//   Leg B — EDGAR N-MFP Part 1 (series-level summary) ONLY — never Part 3's
//           per-security schedule (spec §8: that schedule is a repeating
//           nested structure for security-level surveillance, out of scope
//           by deliberate field-scope narrowing, not by dropping the leg).
//   Leg C — on-chain supply, DECLARED input only (spec §2: no RPC call, no
//           light-client read — same posture as art-582's onchain_supply_check,
//           promoted here from informational to a first-class reconcile leg).
//
// AS-OF SEMANTICS (spec §3, load-bearing): all three legs are measured at
// different instants by construction. Every leg's as_of and source_digest
// is echoed verbatim, never collapsed into one date. max_as_of_skew_days is
// computed per relevant leg-pair; a reconcile check whose relevant skew
// exceeds MAX_AS_OF_SKEW_DAYS (10, one-third of the GENIUS monthly cadence
// art-582 already uses — a DESIGN CHOICE, not a statutory number, restated
// here) reads INDETERMINATE rather than silently comparing as if same-date.
// Never "as of today" anywhere in the output — every date is one of the
// three declared as_of values or a computed skew between them.
//
// DETERMINISM: no `Date.now()`, no clock read, no locale-sensitive call, no
// host crypto (SHA-256 is the inlined pure-JS implementation already proven
// in art-199/200/206/210/280/286/602 — crypto.subtle is banned in the zkVM
// guest), called from a SYNCHRONOUS `compute()` (the art-476 lesson in
// board/RIDER-KERNEL.md). `Date.parse` IS used for day-gap arithmetic
// between two CALLER-SUPPLIED ISO dates (same pattern as art-582's
// `daysBetween`) — this never reads a machine clock, only parses declared
// strings, so it stays fully deterministic given fixed inputs.
//
// BOUNDED INPUTS (art-201 lesson): asset_breakdown is capped at
// MAX_ASSET_LINES; oversized breakdowns are refused with a named flag, never
// silently truncated (a truncated breakdown would understate reserves).

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-603-stablecoin-reserve-3source-recompute';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'recompute_stablecoin_reserve_3source',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// ── bounded-input limits (exec-check-friendly, art-201 lesson) ──────────────
const MAX_ASSET_LINES = 64;

// ── design-choice constants, stated as such per spec §3/§5/§7 ──────────────
const MAX_AS_OF_SKEW_DAYS = 10;          // spec §3 — one-third of GENIUS monthly cadence, not statutory
const WAM_CEILING_DAYS = 20;             // spec §5 — OCC NPRM detail, re-verify at build time, not final rule
const NPRM_CONCENTRATION_CEILING_PCT = 40; // spec §6 — OCC NPRM detail, per-institution concentration
const RESERVE_TOTAL_TOLERANCE_PCT = 0.5; // breakdown-vs-top-line internal consistency, design choice
const RECONCILE_TOLERANCE_PCT = 0.5;     // cross-leg numeric reconcile tolerance, design choice
const WAM_CROSSCHECK_TOLERANCE_DAYS = 2; // disclosure-recomputed vs EDGAR-reported WAM, design choice

// ── Inlined pure-JS SHA-256 (no crypto.subtle, no TextEncoder) ─────────────
// Same implementation proven in art-199/200/206/210/280/286/602.

function _utf8Bytes(str) {
  const s = String(str);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const hi = c, lo = s.charCodeAt(++i);
      const cp = 0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(out);
}

function _sha256(bytes) {
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ]);
  const msgLen = bytes.length;
  const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[msgLen] = 0x80;
  const bitLen = msgLen * 8;
  for (let i = 0; i < 8; i++) padded[paddedLen - 8 + i] = Number((BigInt(bitLen) >> BigInt(56 - i * 8)) & 0xffn);
  let [h0,h1,h2,h3,h4,h5,h6,h7] = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let cs = 0; cs < paddedLen; cs += 64) {
    const W = new Uint32Array(64);
    for (let i = 0; i < 16; i++) { const j = cs + i * 4; W[i] = (padded[j] << 24) | (padded[j+1] << 16) | (padded[j+2] << 8) | padded[j+3]; }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i-15], 7) ^ rotr(W[i-15], 18) ^ (W[i-15] >>> 3);
      const s1 = rotr(W[i-2], 17) ^ rotr(W[i-2], 19) ^ (W[i-2] >>> 10);
      W[i] = (W[i-16] + s0 + W[i-7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = [h0,h1,h2,h3,h4,h5,h6,h7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25), ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22), maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  const r = new Uint8Array(32);
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach(function(v, i) { const j = i * 4; r[j] = v >>> 24; r[j+1] = (v >>> 16) & 0xff; r[j+2] = (v >>> 8) & 0xff; r[j+3] = v & 0xff; });
  return r;
}

function _sha256Hex(str) {
  return Array.from(_sha256(_utf8Bytes(str))).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── day-gap arithmetic between two CALLER-SUPPLIED ISO dates. Parses
//    declared strings only, never a machine clock — same pattern as
//    art-582's daysBetween. ───────────────────────────────────────────────
function daysBetween(isoA, isoB) {
  const a = Date.parse(isoA);
  const b = Date.parse(isoB);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

// ── GENIUS Act statutory eligible-asset enumeration (spec §6, 8 items).
//    Verify verbatim against enacted text at build time before shipping —
//    this is the kernel's copy of that enumeration, keyed for caller input.
//    Item 7 is the catch-all: ALWAYS INDETERMINATE, never auto-matched. An
//    explicit 'non_eligible' key lets a caller assert a line is OUTSIDE the
//    statutory set (DOES_NOT_MATCH); any other unrecognized key is ambiguous
//    and routes to INDETERMINATE, never guessed. ─────────────────────────
const ELIGIBLE_ASSET_ITEMS = {
  us_coin_and_currency:                      { item: 1, label: 'U.S. coins and currency' },
  federal_reserve_account_balance:           { item: 2, label: 'Federal Reserve account balances' },
  insured_demand_deposit:                    { item: 3, label: 'Demand deposits / insured shares at insured depository institutions' },
  treasury_bill_93d_or_less:                 { item: 4, label: 'Treasury bills with 93 days or less remaining maturity' },
  short_term_repo_collateralized_treasuries: { item: 5, label: 'Short-term repurchase/reverse-repurchase agreements collateralized by Treasuries' },
  government_mmf_solely_foregoing:           { item: 6, label: 'Government money market funds invested solely in the foregoing' },
  other_occ_approved:                        { item: 7, label: 'Other similarly liquid, federal-government-issued assets as approved by the OCC (catch-all)' },
  tokenized_foregoing:                       { item: 8, label: 'Tokenized forms of the foregoing' },
};
const NPRM_ELIGIBLE_ASSET_REF = 'GENIUS Act statutory eligible-asset enumeration (8 items) — sourced from statute text, pre-final-rule disclosure per GENIUS-FINALRULE-CHECK-1; catch-all item 7 always INDETERMINATE, never auto-matched.';

function flagAssetClass(assetClass) {
  if (assetClass === 'non_eligible') {
    return { verdict: 'DOES_NOT_MATCH', item: null, label: null, detail: 'Caller explicitly declared this line outside the statutory eligible-asset enumeration.' };
  }
  const known = ELIGIBLE_ASSET_ITEMS[assetClass];
  if (!known) {
    return { verdict: 'INDETERMINATE', item: null, label: null, detail: `asset_class "${assetClass ?? ''}" does not match a recognized statutory enumeration key or "non_eligible" — ambiguous, never guessed.` };
  }
  if (known.item === 7) {
    return { verdict: 'INDETERMINATE', item: 7, label: known.label, detail: 'Item 7 is the catch-all ("other similarly liquid, federal-government-issued assets as approved by the OCC") — a human judgment call, always INDETERMINATE, never auto-matched.' };
  }
  return { verdict: 'MATCHES_CRITERION', item: known.item, label: known.label, detail: `Matches statutory eligible-asset item ${known.item}: ${known.label}.` };
}

const NOT_PROVEN = [
  { item: 'Figure truthfulness', detail: 'This tool recomputes arithmetic on disclosed figures; it does not verify the underlying figures are true. Whether Leg A, Leg B, or Leg C\'s declared numbers are accurate is the declaring party\'s responsibility, not something this recomputation can determine.' },
  { item: 'Reserve composition completeness', detail: 'A per-asset-class breakdown that sums correctly to the stated total does not prove the breakdown lists every holding — an omitted line and an inflated line on another can cancel out undetected.' },
  { item: 'Snapshot currency', detail: 'Each leg is a point-in-time figure at its own declared as_of date. No leg is compared against "today" — this tool has no clock.' },
  { item: 'GENIUS compliance opinion', detail: 'Per-holding eligible-asset flags report criteria-match only. This tool produces no compliance opinion, no audit, and no examination — a reader wanting one is told this explicitly, never given a merged eligibility boolean.' },
  { item: 'PCAOB audit opinion', detail: 'This tool performs no audit and carries no PCAOB or other audit-firm opinion; it is a recompute-and-reconcile check only.' },
];

/**
 * compute(pp) — pure stablecoin reserve 3-source recompute + reconcile.
 * pp: {
 *   max_as_of_skew_days?: number,   // override design-choice default (10)
 *   leg_a?: {
 *     report_period?: string, period_end_date?: string, as_of?: string,
 *     source_digest?: string,
 *     total_reserves_usd?: number,
 *     outstanding_tokens_reported?: number, token_price?: number,
 *     reserves_in_fund_fraction?: number|null,  // 0-1, discloses Leg-B-fund share of reserves
 *     asset_breakdown?: [{ asset_class: string, amount_usd: number, maturity_bucket_days?: number|null }],
 *   } | null,
 *   leg_b?: {
 *     as_of?: string, source_digest?: string, accession_number?: string,
 *     total_net_assets?: number, nav_per_share?: number, shares_outstanding?: number,
 *     wam_days?: number, wal_days?: number, filing_date?: string,
 *   } | null,
 *   leg_c?: { as_of?: string, source_digest?: string, onchain_supply?: number } | null,
 * }
 */
export function compute(pp) {
  const params = (pp !== null && typeof pp === 'object') ? pp : {};
  const maxSkew = Number.isFinite(Number(params.max_as_of_skew_days)) ? Number(params.max_as_of_skew_days) : MAX_AS_OF_SKEW_DAYS;

  const legARaw = params.leg_a ?? null;
  const legBRaw = params.leg_b ?? null;
  const legCRaw = params.leg_c ?? null;

  const legAPresent = legARaw !== null && typeof legARaw === 'object';
  const legBPresent = legBRaw !== null && typeof legBRaw === 'object';
  const legCPresent = legCRaw !== null && typeof legCRaw === 'object';

  const legA = legAPresent ? legARaw : {};
  const legB = legBPresent ? legBRaw : {};
  const legC = legCPresent ? legCRaw : {};

  // ── echo each leg's as_of / source_digest verbatim, never collapsed ────
  const leg_a_echo = { as_of: legA.as_of ?? null, source_digest: legA.source_digest ?? null, report_period: legA.report_period ?? null, period_end_date: legA.period_end_date ?? null };
  const leg_b_echo = { as_of: legB.as_of ?? null, source_digest: legB.source_digest ?? null, accession_number: legB.accession_number ?? null, filing_date: legB.filing_date ?? null };
  const leg_c_echo = { as_of: legC.as_of ?? null, source_digest: legC.source_digest ?? null };

  // ── §3 as-of skew: pairwise gaps between whichever leg pairs have both
  //    dates present; max_as_of_skew_days_global is the largest of those. ──
  const skewAB = (legAPresent && legBPresent && legA.as_of && legB.as_of) ? Math.abs(daysBetween(legA.as_of, legB.as_of) ?? NaN) : null;
  const skewAC = (legAPresent && legCPresent && legA.as_of && legC.as_of) ? Math.abs(daysBetween(legA.as_of, legC.as_of) ?? NaN) : null;
  const skewBC = (legBPresent && legCPresent && legB.as_of && legC.as_of) ? Math.abs(daysBetween(legB.as_of, legC.as_of) ?? NaN) : null;
  const validSkews = [skewAB, skewAC, skewBC].filter((s) => s !== null && !Number.isNaN(s));
  const max_as_of_skew_days_global = validSkews.length > 0 ? Math.max(...validSkews) : null;

  function skewGate(skew, legPairLabel) {
    if (skew === null || Number.isNaN(skew)) return { gated: false, verdict: null, detail: `${legPairLabel} as_of skew unavailable (one or both dates missing) — not silently compared.` };
    if (skew > maxSkew) return { gated: true, verdict: 'INDETERMINATE', detail: `${legPairLabel} as_of skew is ${skew} day(s), exceeding the ${maxSkew}-day threshold. Not compared as if same-date.` };
    return { gated: false, verdict: null, detail: `${legPairLabel} as_of skew is ${skew} day(s), within the ${maxSkew}-day threshold.` };
  }

  const compliance_flags = [];

  // ── §4 Reserve-ratio recompute ──────────────────────────────────────────
  const breakdownRaw = Array.isArray(legA.asset_breakdown) ? legA.asset_breakdown : [];
  const breakdownTooLarge = breakdownRaw.length > MAX_ASSET_LINES;
  const breakdown = breakdownTooLarge ? [] : breakdownRaw.slice(0, MAX_ASSET_LINES);
  if (breakdownTooLarge) {
    compliance_flags.push('ASSET_BREAKDOWN_TOO_LARGE');
  }

  let reserveRatio = { verdict: 'INDETERMINATE', detail: 'Leg A not supplied. Reserve ratio cannot be recomputed.' };
  let total_reserves_usd_recomputed = null;
  let breakdown_sum_consistency = null;
  let total_liabilities_usd = null;
  let coverage_ratio_pct = null;

  if (legAPresent) {
    if (breakdownTooLarge) {
      reserveRatio = { verdict: 'INDETERMINATE', detail: `asset_breakdown has more than ${MAX_ASSET_LINES} lines and was refused rather than summed in part.` };
    } else if (breakdown.length === 0) {
      reserveRatio = { verdict: 'INDETERMINATE', detail: 'Leg A supplied no per-asset-class breakdown. Reserve ratio recompute requires it (this is a recompute of the breakdown, not a restatement of a single top-line figure).' };
    } else {
      total_reserves_usd_recomputed = breakdown.reduce((sum, line) => sum + Number(line?.amount_usd ?? 0), 0);
      total_reserves_usd_recomputed = parseFloat(total_reserves_usd_recomputed.toFixed(2));

      const statedTotal = legA.total_reserves_usd != null ? Number(legA.total_reserves_usd) : null;
      if (statedTotal !== null) {
        const deltaPct = total_reserves_usd_recomputed > 0
          ? Math.abs(statedTotal - total_reserves_usd_recomputed) / total_reserves_usd_recomputed * 100
          : (statedTotal === 0 ? 0 : null);
        const withinTolerance = deltaPct !== null && deltaPct <= RESERVE_TOTAL_TOLERANCE_PCT;
        breakdown_sum_consistency = {
          stated_total_reserves_usd: statedTotal,
          recomputed_from_breakdown_usd: total_reserves_usd_recomputed,
          delta_pct: deltaPct === null ? null : parseFloat(deltaPct.toFixed(4)),
          within_tolerance: withinTolerance,
        };
        if (!withinTolerance) compliance_flags.push('RESERVE_BREAKDOWN_SUM_MISMATCH');
      }

      const tokens = Number(legA.outstanding_tokens_reported ?? 0);
      const price = Number(legA.token_price ?? 1);
      total_liabilities_usd = parseFloat((tokens * price).toFixed(2));

      if (tokens <= 0) {
        reserveRatio = { verdict: 'INDETERMINATE', detail: 'outstanding_tokens_reported is missing or non-positive — coverage ratio cannot be computed.' };
      } else {
        coverage_ratio_pct = parseFloat(((total_reserves_usd_recomputed / total_liabilities_usd) * 100).toFixed(4));
        if (coverage_ratio_pct >= 100) {
          reserveRatio = { verdict: 'MET', detail: `Recomputed reserves (${total_reserves_usd_recomputed}) cover ${coverage_ratio_pct.toFixed(2)}% of liabilities (${total_liabilities_usd}), computed from the per-asset-class breakdown, not the stated top-line figure.` };
        } else {
          reserveRatio = { verdict: 'NOT_MET', detail: `Recomputed reserves (${total_reserves_usd_recomputed}) cover only ${coverage_ratio_pct.toFixed(2)}% of liabilities (${total_liabilities_usd}), computed from the per-asset-class breakdown.` };
        }
      }
    }
  }

  // ── §5 WAM (weighted-average maturity) recompute — two independent
  //    sources, cross-checked, never blended ───────────────────────────────
  let wamFromDisclosure = { value_days: null, verdict: 'INDETERMINATE', detail: 'Leg A not supplied. WAM-from-disclosure cannot be computed.' };
  if (legAPresent && breakdown.length > 0 && !breakdownTooLarge) {
    const allHaveMaturity = breakdown.every((line) => line?.maturity_bucket_days !== undefined && line?.maturity_bucket_days !== null && Number.isFinite(Number(line.maturity_bucket_days)));
    if (!allHaveMaturity) {
      wamFromDisclosure = { value_days: null, verdict: 'INDETERMINATE', detail: 'At least one asset_breakdown line lacks maturity_bucket_days. WAM-from-disclosure is not computed by dropping the line and rescaling — that manufactures a number.' };
    } else {
      const totalAmount = breakdown.reduce((s, l) => s + Number(l.amount_usd ?? 0), 0);
      if (totalAmount <= 0) {
        wamFromDisclosure = { value_days: null, verdict: 'INDETERMINATE', detail: 'asset_breakdown amounts sum to zero or less. WAM-from-disclosure is undefined.' };
      } else {
        const weighted = breakdown.reduce((s, l) => s + Number(l.amount_usd ?? 0) * Number(l.maturity_bucket_days ?? 0), 0);
        const wamDays = parseFloat((weighted / totalAmount).toFixed(4));
        wamFromDisclosure = { value_days: wamDays, verdict: null, detail: `Weighted-average maturity recomputed from the per-asset-class breakdown: ${wamDays.toFixed(2)} days.` };
      }
    }
  }

  let wamFromEdgar = { value_days: null, wam_source: 'edgar_nmfp_reported', detail: 'Leg B not supplied. wam_days extraction unavailable.' };
  if (legBPresent && legB.wam_days != null && Number.isFinite(Number(legB.wam_days))) {
    wamFromEdgar = { value_days: Number(legB.wam_days), wam_source: 'edgar_nmfp_reported', detail: `wam_days extracted directly from the N-MFP Part 1 series summary (accession ${legB.accession_number ?? 'unknown'}). Extraction, not a recompute.` };
  } else if (legBPresent) {
    wamFromEdgar = { value_days: null, wam_source: 'edgar_nmfp_reported', detail: 'Leg B supplied but wam_days field is missing or non-numeric.' };
  }

  // WAM cross-check (§5 third bullet, §7 Reconcile 3) — skew-gated on A-B.
  const skewABGate = skewGate(skewAB, 'Leg A vs Leg B');
  let wamCrossCheck = { verdict: 'INDETERMINATE', detail: 'WAM cross-check requires both wam_from_disclosure and wam_from_edgar to be numeric.' };
  if (skewABGate.gated) {
    wamCrossCheck = { verdict: 'INDETERMINATE', detail: skewABGate.detail };
  } else if (wamFromDisclosure.value_days !== null && wamFromEdgar.value_days !== null) {
    const deltaDays = Math.abs(wamFromDisclosure.value_days - wamFromEdgar.value_days);
    if (deltaDays <= WAM_CROSSCHECK_TOLERANCE_DAYS) {
      wamCrossCheck = { verdict: 'RECONCILED', detail: `Disclosure-recomputed WAM (${wamFromDisclosure.value_days.toFixed(2)}d) and EDGAR-reported WAM (${wamFromEdgar.value_days.toFixed(2)}d) are within the ${WAM_CROSSCHECK_TOLERANCE_DAYS}-day tolerance. This comparison is directional, not exact, when the named fund holds only part of the issuer's reserves.` };
    } else {
      wamCrossCheck = { verdict: 'DISCREPANT', detail: `Disclosure-recomputed WAM (${wamFromDisclosure.value_days.toFixed(2)}d) and EDGAR-reported WAM (${wamFromEdgar.value_days.toFixed(2)}d) diverge by ${deltaDays.toFixed(2)}d, exceeding the ${WAM_CROSSCHECK_TOLERANCE_DAYS}-day tolerance. Directional caveat applies here too.` };
    }
  }

  // WAM ceiling check (§5 last bullet) — best-available: disclosure-recomputed preferred, EDGAR-reported fallback.
  const bestWam = wamFromDisclosure.value_days !== null ? { value: wamFromDisclosure.value_days, wam_source: 'disclosure_recomputed' } : (wamFromEdgar.value_days !== null ? { value: wamFromEdgar.value_days, wam_source: 'edgar_nmfp_reported' } : null);
  let wamCeiling;
  if (bestWam === null) {
    wamCeiling = { verdict: 'INDETERMINATE', wam_source: null, detail: 'Neither WAM source is usable — ceiling check cannot be evaluated.', ceiling_days: WAM_CEILING_DAYS, ceiling_ref: 'OCC NPRM detail (research/GENIUS-FINALRULE-CHECK-2026-08-07.md) — NPRM, not final rule, re-verify at build time.' };
  } else if (bestWam.value <= WAM_CEILING_DAYS) {
    wamCeiling = { verdict: 'MET', wam_source: bestWam.wam_source, detail: `Best-available WAM (${bestWam.value.toFixed(2)}d, source: ${bestWam.wam_source}) is at or below the ${WAM_CEILING_DAYS}-day ceiling.`, ceiling_days: WAM_CEILING_DAYS, ceiling_ref: 'OCC NPRM detail (research/GENIUS-FINALRULE-CHECK-2026-08-07.md) — NPRM, not final rule, re-verify at build time.' };
  } else {
    wamCeiling = { verdict: 'NOT_MET', wam_source: bestWam.wam_source, detail: `Best-available WAM (${bestWam.value.toFixed(2)}d, source: ${bestWam.wam_source}) exceeds the ${WAM_CEILING_DAYS}-day ceiling.`, ceiling_days: WAM_CEILING_DAYS, ceiling_ref: 'OCC NPRM detail (research/GENIUS-FINALRULE-CHECK-2026-08-07.md) — NPRM, not final rule, re-verify at build time.' };
  }

  // ── §6 GENIUS eligible-asset flag — per-holding, criteria-match only.
  //    TWO SEPARATE ARRAYS, never merged: the statutory 8-item flag list,
  //    and the OCC NPRM concentration detail. ⛔ No overall_eligibility. ───
  const genius_eligible_holdings = breakdown.map((line, idx) => {
    const flag = flagAssetClass(line?.asset_class);
    return {
      line_index: idx,
      asset_class: line?.asset_class ?? null,
      amount_usd: Number.isFinite(Number(line?.amount_usd)) ? Number(line.amount_usd) : null,
      verdict: flag.verdict,
      statutory_item: flag.item,
      statutory_item_label: flag.label,
      detail: flag.detail,
      ref: NPRM_ELIGIBLE_ASSET_REF,
    };
  });

  // OCC NPRM concentration detail — separate array, per-institution, provisional (spec §6).
  const provisional_nprm_detail = [];
  if (legAPresent && breakdown.length > 0 && total_reserves_usd_recomputed !== null && total_reserves_usd_recomputed > 0) {
    const byInstitution = new Map();
    for (const line of breakdown) {
      const key = line?.institution ?? line?.asset_class ?? 'unspecified';
      byInstitution.set(key, (byInstitution.get(key) ?? 0) + Number(line?.amount_usd ?? 0));
    }
    for (const [institution, amount] of byInstitution) {
      const pctOfTotal = parseFloat(((amount / total_reserves_usd_recomputed) * 100).toFixed(4));
      provisional_nprm_detail.push({
        institution,
        amount_usd: parseFloat(amount.toFixed(2)),
        pct_of_recomputed_reserves: pctOfTotal,
        exceeds_concentration_ceiling: pctOfTotal > NPRM_CONCENTRATION_CEILING_PCT,
        provisional_nprm_detail: true,
        ceiling_pct: NPRM_CONCENTRATION_CEILING_PCT,
        ref: 'OCC NPRM concentration detail (≤40% at any one eligible institution) — proposed-rule detail, not statute, kept visibly separate from the statutory eligible-asset list.',
      });
    }
  }

  // ── §7 Three-source reconcile — the deliverable ─────────────────────────
  const skewACGate = skewGate(skewAC, 'Leg A vs Leg C');

  // Reconcile 1 — reserves vs MMF assets. Only meaningful if the issuer discloses fraction-in-fund.
  let reconcile1;
  const fraction = legA.reserves_in_fund_fraction;
  if (skewABGate.gated) {
    reconcile1 = { check: 'reserves_vs_mmf_assets', verdict: 'INDETERMINATE', detail: skewABGate.detail };
  } else if (!legAPresent || !legBPresent || total_reserves_usd_recomputed === null || legB.total_net_assets == null) {
    reconcile1 = { check: 'reserves_vs_mmf_assets', verdict: 'INDETERMINATE', detail: 'Requires both a recomputed reserve total (Leg A) and total_net_assets (Leg B).' };
  } else if (fraction === undefined || fraction === null) {
    reconcile1 = { check: 'reserves_vs_mmf_assets', verdict: 'INDETERMINATE', detail: 'Issuer does not disclose what fraction of reserves sit in the named fund (reserves_in_fund_fraction). Not assumed to be 100%.' };
  } else {
    const expectedInFund = total_reserves_usd_recomputed * Number(fraction);
    const netAssets = Number(legB.total_net_assets);
    const deltaPct = netAssets > 0 ? Math.abs(expectedInFund - netAssets) / netAssets * 100 : null;
    const within = deltaPct !== null && deltaPct <= RECONCILE_TOLERANCE_PCT;
    reconcile1 = {
      check: 'reserves_vs_mmf_assets',
      verdict: within ? 'RECONCILED' : 'DISCREPANT',
      detail: `Reserves attributed to the fund (${expectedInFund.toFixed(2)}, ${(Number(fraction) * 100).toFixed(2)}% of recomputed reserves) vs Leg B total_net_assets (${netAssets}): delta ${deltaPct === null ? 'n/a' : deltaPct.toFixed(4) + '%'}, tolerance ${RECONCILE_TOLERANCE_PCT}%.`,
      as_of_skew_days: skewAB,
    };
  }

  // Reconcile 2 — liabilities vs on-chain supply. Skew-gated on A-C.
  let reconcile2;
  if (skewACGate.gated) {
    reconcile2 = { check: 'liabilities_vs_onchain_supply', verdict: 'INDETERMINATE', detail: skewACGate.detail };
  } else if (!legAPresent || !legCPresent || legC.onchain_supply == null) {
    reconcile2 = { check: 'liabilities_vs_onchain_supply', verdict: 'INDETERMINATE', detail: 'Requires both outstanding_tokens_reported (Leg A) and onchain_supply (Leg C).' };
  } else {
    const reported = Number(legA.outstanding_tokens_reported ?? 0);
    const onchain = Number(legC.onchain_supply);
    const deltaPct = reported > 0 ? Math.abs(onchain - reported) / reported * 100 : (onchain === 0 ? 0 : null);
    const within = deltaPct !== null && deltaPct <= RECONCILE_TOLERANCE_PCT;
    reconcile2 = {
      check: 'liabilities_vs_onchain_supply',
      verdict: within ? 'RECONCILED' : 'DISCREPANT',
      detail: `Reported outstanding tokens (${reported}) vs declared on-chain supply (${onchain}): delta ${deltaPct === null ? 'n/a' : deltaPct.toFixed(4) + '%'}, tolerance ${RECONCILE_TOLERANCE_PCT}%.`,
      as_of_skew_days: skewAC,
    };
  }

  // Reconcile 3 — WAM cross-check, computed above.
  const reconcile3 = { check: 'wam_cross_check', verdict: wamCrossCheck.verdict, detail: wamCrossCheck.detail, as_of_skew_days: skewAB };

  const reconciles = [reconcile1, reconcile2, reconcile3];

  // ── overall_determination — worst-of rollup across every check in
  //    §4-§7, MET|NOT_MET|INDETERMINATE vocabulary (spec §7). Per-holding
  //    GENIUS flags fold into the SAME worst-of tiering (DOES_NOT_MATCH
  //    counts as the bad tier, MATCHES_CRITERION as the good tier) but are
  //    never separately surfaced as an eligibility field. ─────────────────
  const BAD = new Set(['NOT_MET', 'DISCREPANT', 'DOES_NOT_MATCH']);
  const allVerdicts = [
    reserveRatio.verdict,
    wamCeiling.verdict,
    ...genius_eligible_holdings.map((h) => h.verdict),
    ...reconciles.map((r) => r.verdict),
  ];
  let overall_determination;
  if (allVerdicts.some((v) => BAD.has(v))) overall_determination = 'NOT_MET';
  else if (allVerdicts.some((v) => v === 'INDETERMINATE')) overall_determination = 'INDETERMINATE';
  else overall_determination = 'MET';

  if (overall_determination === 'NOT_MET') compliance_flags.push('STABLECOIN_3SRC_NOT_MET');
  if (overall_determination === 'INDETERMINATE') compliance_flags.push('STABLECOIN_3SRC_INDETERMINATE');
  if (overall_determination === 'MET') compliance_flags.push('STABLECOIN_3SRC_MET');
  if (reserveRatio.verdict === 'NOT_MET') compliance_flags.push('RESERVE_RATIO_DEFICIENCY');
  if (reconciles.some((r) => r.verdict === 'DISCREPANT')) compliance_flags.push('CROSS_SOURCE_DISCREPANCY');
  if (genius_eligible_holdings.some((h) => h.verdict === 'DOES_NOT_MATCH')) compliance_flags.push('GENIUS_NON_ELIGIBLE_HOLDING_DECLARED');
  if (provisional_nprm_detail.some((d) => d.exceeds_concentration_ceiling)) compliance_flags.push('NPRM_CONCENTRATION_CEILING_EXCEEDED');

  const output_payload = {
    overall_determination,
    leg_a: leg_a_echo,
    leg_b: leg_b_echo,
    leg_c: leg_c_echo,
    max_as_of_skew_days_global,
    as_of_skew_pairs: { leg_a_vs_leg_b: skewAB, leg_a_vs_leg_c: skewAC, leg_b_vs_leg_c: skewBC },
    as_of_skew_threshold_days: maxSkew,
    reserve_ratio: {
      verdict: reserveRatio.verdict,
      detail: reserveRatio.detail,
      total_reserves_usd_recomputed,
      breakdown_sum_consistency,
      total_liabilities_usd,
      coverage_ratio_pct,
    },
    wam: {
      wam_from_disclosure: wamFromDisclosure,
      wam_from_edgar: wamFromEdgar,
      wam_cross_check: wamCrossCheck,
      wam_ceiling_check: wamCeiling,
    },
    genius_eligible_holdings,
    provisional_nprm_detail,
    reconciles,
    not_proven: NOT_PROVEN,
    determination_note: 'overall_determination is a worst-of rollup of independent recompute-and-reconcile checks on disclosed figures. It is never a solvency claim, never an audit opinion, and never "satisfies GENIUS" — it states whether recomputed arithmetic, WAM, and three independently-sourced figures are internally consistent with each other, and nothing about whether the declared figures are themselves true.',
    regulatory_framework: 'GENIUS Act reserve-composition recompute (statute-derived eligible-asset enumeration + OCC NPRM concentration/WAM detail, see art-582/art-06/art-275 for the pre-issuance/statutory-restatement/report-timeliness siblings); SEC EDGAR N-MFP Part 1 series summary (U.S. government work, freely usable); not a PCAOB audit, not a third-party sign-off, not an examination.',
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
