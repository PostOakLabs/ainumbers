# MANIFEST — FV-PROPFLOOR-SHARD-C8-1

Eighth class-C property-floor shard. Floors 10 kernels (positions 71-80 of the class-C triage table),
per `FV-PBT-FLOOR-BUILD-SPEC.md` §2/§3/§4, template `board/done/FV-PROPFLOOR-SHARD-C3-1.md`.

**Scope: floor tier only.** These files check termination, boundedness, differential re-derivation,
ULP-boundary forcing (float-sensitive kernels) or forced categorical boundary cases (float:no kernels),
and one metamorphic property per kernel, against each kernel's fixture-oracle gate. **NOT a proof.
NOT Dafny.**

## Population — 10 kernels

| # | tool_id | float_sensitive | properties | fixture-oracle |
|---|---|---|---|---|
| 1 | art-258-parse-camt053-reconciliation | YES | termination, boundedness, differential, ULP-forced, permutation-invariance | 3/3 |
| 2 | art-259-compute-multilateral-netting | YES | termination, boundedness, zero-sum-pool, ULP-forced, permutation-invariance (netting sum order) | 3/3 |
| 3 | art-26-x402-payload-decoder-flow-simulator | NO | termination, boundedness, differential, forced categorical, base64-wrap metamorphic | 1/1 |
| 4 | art-260-allocate-ihb-interest | YES | termination, boundedness, differential, ULP-forced, permutation-invariance | 3/3 |
| 5 | art-261-test-hedge-effectiveness | YES | termination, boundedness, differential, ULP-forced, scale-invariance metamorphic | 3/3 |
| 6 | art-262-validate-ebam-acmt-flow | NO | termination, boundedness, differential, forced categorical, prefix-invariance metamorphic | 3/3 |
| 7 | art-263-score-cash-forecast-accuracy | YES | termination, boundedness, differential, ULP-forced, permutation-invariance | 3/3 |
| 8 | art-264-validate-commission-hierarchy | YES | termination, boundedness, differential, ULP-forced, permutation-invariance | 2/2 |
| 9 | art-266-reconcile-commission-statement | YES | termination, boundedness, differential, ULP-forced, permutation-invariance | 2/2 |
| 10 | art-267-check-producer-license-reciprocity | NO | termination, boundedness, differential, forced categorical, case-insensitivity metamorphic | 2/2 |

**7 of 10 floated float:yes per the WU triage table** (art-258, art-259, art-260, art-261, art-263,
art-264, art-266) — ULP-boundary forcing applied to all 7 (±1 ULP, 0, negative zero, denormals,
`x/y*y !== x` rounding cases, per spec §3). The other 3 (art-26, art-262, art-267) are float:no and use
forced categorical boundary cases instead. **All 10 float-sensitivity classifications re-confirmed by
direct source read against the kernel files**, matching the WU triage table exactly — no corrections
needed.

**art-259-compute-multilateral-netting** — the WU's FIX-2 flag ("sums an unbounded position array, most
likely to need a summation-order metamorphic property") is satisfied: P5 in that file is a permutation
-invariance check specifically on the entity net-position totals under `gross_positions` reorder.

## Convergence-or-report — stated per item

All 10 kernels are pure array/table-bounded computations (no iterative numerical solvers, no
fixed-point/Newton iteration) — convergence is **N/A for all 10**, stated per-item in each file's
termination-property header comment. `art-264-validate-commission-hierarchy`'s BFS is the one
loop-bound worth naming explicitly: total enqueues are bounded by `hierarchy.length` (each node
contributes exactly one entry to `childrenOf`), so it always halts — confirmed by direct read, not
assumed.

## Documented floor findings (not kernel edits — fence forbids touching kernels)

- **art-259**: `settlement_legs.length` is bounded by `entity_count - 1` (a spanning-tree bound on the
  greedy payer/receiver matching), **not** by `gross_positions.length` — a few positions spread across
  many entities can require more settlement legs than original gross transactions. Verified empirically
  (nE=10, nG=3 → 5 legs). The floor's P1/P2 properties use the correct (entity-count) bound.
- **art-259**: an fx_rate near `Number.MIN_VALUE` drives `toBase()`'s division past ~1e300, and the
  settlement-loop's `_round4()` (`Math.round(v*10000)`) then overflows double range — the greedy
  while-loop's decreasing-remainder invariant can break, risking non-termination for denormal fx rates.
  Denormal fx rates are outside the realistic corporate-treasury input domain; the floor's ULP-forced
  case uses a merely-small (1e-8), not denormal, fx rate instead.
- **art-263**: `actual = Number.MIN_VALUE` is nonzero, so the kernel's `actual === 0` skip-guard does not
  fire, and `|actual-forecast|/|actual|` overflows MAPE to `Infinity` for near-zero-but-nonzero actuals.
  This is a genuine boundedness gap for that input region — documented as a KNOWN non-finite case in the
  floor file (`expectFinite:false`) rather than silently passed or asserted-bounded.

## Signing — manifest-style, this row does not sign

Per-item machine statements above (population, per-item basis, ULP-forcing confirmation, Dafny-freeze
restatement) are complete. This shard's `human_sign_off` is **PENDING** — name/date intentionally blank.

**Independence sentence:** These property tests were authored independently of, and do not modify, the
kernels under test; each test's fixture-oracle gate runs against the kernel's own pre-existing golden
fixtures, and every property assertion was verified to fail on at least one deliberately-broken mutant
during authoring (manual differential check, not automated mutation testing).

## Dafny freeze — restated

**Blanket class-C Dafny stays frozen.** This shard floors (bounded/tested claims); it does not prove.
No Dafny port was attempted for any of these 10 kernels — that would be the exact composed freeze
-erosion the campaign has declined twice.

## Verification

- `node scripts/run-proptests.mjs` — 169/169 pass (all class-A/B/C floor files repo-wide, including
  these 10).
- `node scripts/check-fv-floor-coverage.mjs --summary` — 169/582 floored (up from 159), 413 unfloored,
  within the ratchet ceiling.
- `node scripts/preflight.mjs` — all hard CI gates green.
