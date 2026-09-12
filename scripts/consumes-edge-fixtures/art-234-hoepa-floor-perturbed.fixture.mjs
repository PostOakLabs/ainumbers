// SO #34c RED control for scripts/check-consumes-edges.mjs (CONSUMES-EDGE-CHECK-1,
// mutation-adequacy house rule): ONE pinned value perturbed in a scratch copy.
//
// This fixture mirrors the per-year probe shape check-consumes-edges.mjs's
// probeArt234() measures through art-234-test-hoepa-high-cost's own compute()
// — points-and-fees floor/pct and the two APR spread thresholds per year, at
// the same small-loan probe point — with EXACTLY ONE value changed:
//
//     2026 points_fees_floor: 1380 → 1379
//
// (art-234 pins 1380 from FR 2025-22773; art-220's hoepa table publishes the
// same figure. 1379 is a plausible-looking stale figure — the defect shape the
// checker exists to catch.) The unperturbed run classifies art-234's 2026
// entries BYTE-EQUAL; with this fixture the comparator MUST fire MISMATCH and
// name year 2026, field points_fees_floor, consumer 1379 vs supplier 1380.
// If it does not, the checker's sensitivity is broken and its green means
// nothing. This file is a FIXTURE: imported by the selftest only, imported by
// nothing in the estate, edits no kernel.
//
// Re-derived 2026-09-12 (ART234-HOEPA-2025-FIX-1 + ART220-HOEPA-2025-CONSTANT-FIX-1,
// both in PR #1862): the 2025 floor moved 1345 → 1348 in BOTH kernels per FR 2024-27553
// (89 FR 95080), so this fixture's 2025 pin moved with them and the single perturbation
// stays the 2026 one. The values below were read back from probeArt234() against the
// corrected kernels, never hand-typed.

export const meta = {
  fixture: 'art-234-hoepa-floor-perturbed',
  perturbation: '2026 points_fees_floor 1380 → 1379 (one pinned value)',
  basedOn: 'chaingraph/kernels/art-234-test-hoepa-high-cost.kernel.mjs HOEPA_PF + HOEPA_APR as measured at the small-loan probe point',
};

export const probe = {
  2021: {
    points_fees_floor: 1380, // art-234's silent fallback applies 2026 values — same as the real kernel
    points_fees_pct: 5,
    rate_spread_first_lien_pp: 6.5,
    rate_spread_sub_lien_pp: 8.5,
  },
  2022: {
    points_fees_floor: 1380,
    points_fees_pct: 5,
    rate_spread_first_lien_pp: 6.5,
    rate_spread_sub_lien_pp: 8.5,
  },
  2023: {
    points_fees_floor: 1380,
    points_fees_pct: 5,
    rate_spread_first_lien_pp: 6.5,
    rate_spread_sub_lien_pp: 8.5,
  },
  2024: {
    points_fees_floor: 1380,
    points_fees_pct: 5,
    rate_spread_first_lien_pp: 6.5,
    rate_spread_sub_lien_pp: 8.5,
  },
  2025: {
    points_fees_floor: 1348, // real pin, FR 2024-27553 (89 FR 95080) — matches art-220
    points_fees_pct: 5,
    rate_spread_first_lien_pp: 6.5,
    rate_spread_sub_lien_pp: 8.5,
  },
  2026: {
    points_fees_floor: 1379, // ← THE PERTURBATION (real pin: 1380)
    points_fees_pct: 5,
    rate_spread_first_lien_pp: 6.5,
    rate_spread_sub_lien_pp: 8.5,
  },
};
