# FV-PROPFLOOR-SHARD-C21-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C21-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` over the file's actual content — the canonical §17
digest function, matching the header comment in each `.proptest.mjs` file).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file floor
properties themselves (termination bound, boundedness, differential/metamorphic identities as applicable,
and — for the 6 float-sensitive kernels — mandatory ULP-boundary forcing). No row received deeper manual
review beyond this mechanical gate; the signer's attestation, when it is added, covers exactly this basis
and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## ⚠ FIX-2 corrections to the WU row's float-sensitivity table

Per the row's own instruction ("confirm float-sensitivity and shape against each kernel's own source
before relying on the table"), each of the 10 kernels was read directly rather than trusting the row's
tags. Two corrections were required — **the net float-sensitive count stays 6/10**, unchanged from the
row's own stated total, because the two corrections offset each other:

- **`art-466-dora-roi-builder`** — row says `float:yes`. Direct read finds **ZERO** floating-point
  arithmetic anywhere in `compute()`: LEI validation is ISO 7064 Mod 97-10 **integer** checksum
  arithmetic (`(remainder*10 + digit) % 97`), and every other check is string/Set/referential-integrity
  logic. **Reclassified to `float:no`.**
- **`art-472-cbcr-builder`** — row says `float:no`. Direct read finds the EDIT-REV consistency check
  (`Math.abs(total_revenue_reported - total_revenue_computed) <= rounding_tolerance`) compares **raw**
  caller floats with no prior rounding step (unlike art-464's r2()-before-compare pattern) — safe from
  ULP noise only because of the default `rounding_tolerance=1`; a caller declaring
  `rounding_tolerance=0` is directly exposed to floating-point addition drift. **Reclassified to
  `float:yes`**, with ULP-boundary forcing added at the `rounding_tolerance=0` edge.

Both corrections are documented in-file, in each proptest file's own header comment, per FIX-2 discipline
(never silently overridden).

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | termination/convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-451-model-outcome-analysis` | `0109055fc8041ae9b972ed952fe72e0763d5a5ae8b30ff92ef63886e762d102f` | **yes** | **yes** — `predicted` divisor forced at 0/-0/±ULP/denormal/±1, plus the predicted===actual===0 branch and the exact-breach-threshold (strict `>`) boundary | n/a — no iterative solver; termination bounded by `observations.length` (single `.map()` + `.filter()`, no recursion), proven with a 5,000-observation array completing with finite aggregates | 3/3 pass |
| 2 | `art-454-globe-jurisdictional-etr` | `b6c161f165c164256e1d59d3de2d7b967aa272e972f8ad8d17648dbb1066ab78` | **yes** | **yes** — `jurisdictional_globe_income` divisor forced at 0/-0/±ULP/denormal around the loss/income boundary, plus the `minimum_rate===etr` exact top-up-owed boundary and ±ULP either side of it | n/a — no iterative solver; termination bounded by `entities.length` (single reduce, no recursion), proven with a 5,000-entity array | 3/3 pass |
| 3 | `art-455-globe-sbie-topup` | `f883e9af5be1a09cf3f90e6d98b8452905bbef712f381adef50876f7ee4a44ab` | **yes** | **yes** — `globe_income===sbie` zero-excess-profit boundary forced at 0/-0/±ULP/denormal, plus the `qdmtt_paid===top_up_tax` over-collection boundary and ±ULP either side of it | n/a — no iterative solver; termination bounded by `policy_rate_table.length` (single linear scan, no recursion), proven with a 5,000-row rate table | 3/3 pass |
| 4 | `art-459-sod-matrix-check` | `991bda6ad22de1f56d310c7cfbe98b6a7a9e4fdace9805007b0cc161d05cd7cd` | no | n/a (float:no, direct read confirmed — pure Set/Map membership and string comparison, zero arithmetic anywhere in `compute()`; forced categorical boundary cases used instead — empty ruleset, empty assignments, self-pair role_a===role_b skipped from the ruleset, duplicate roles within a user's list collapsed via Set, a rule declared in reverse role order) | n/a — no iterative solver; termination bounded by `assignments.length * O(roles²)` pairwise scan (no recursion), proven with 3,000 users each holding the full 7-role pool | 5/5 pass |
| 5 | `art-462-je-ruleset-screen` | `5f9f5a9b7c90cd52f8391fad3645938706315d2271784f07a1fb5a831b588599` | no | n/a (float:no, direct read confirmed — weekday/date logic is pure integer civil-calendar arithmetic, no `Date` object; the sole numeric compare is `amount % roundIncrement === 0`, a discrete equality on caller-raw data rather than a kernel-derived continuous float chain; forced categorical boundary cases used instead — round_number exact-multiple vs one-cent-off, weekend/weekday exact boundary, post_close_date exact boundary vs one day after, malformed ISO date string) | n/a — no iterative solver; termination bounded by `entries.length` (single pass, no recursion), proven with a 4,000-entry array | 3/3 pass |
| 6 | `art-463-recalc-suite` | `d913e4c1ab2a8875f2d19463184c19f2de2051342302d321d03e1c790841c02a` | **yes** | **yes** — zero-denominator guards forced (useful_life=0, shares_basic/diluted=0 → null, never NaN), plus the tolerance-gate `variance===tolAbs` exact boundary (pass) vs one-cent-over (fail), and a denormal-cost case | **stated explicitly, not merely assumed**: each of the 5 recalculation categories is a single bounded `.map()` over its own caller-supplied array; the one loop-shaped item, `ddbBookValue()`'s period-by-period DDB iteration, is bounded by `period_number` clamped to `>=1` via `Math.max(1, Math.trunc(...))` but has **NO declared upper clamp** — this floor states that honestly (proven to complete in bounded wall time at `period_number=200000`, ~1s) rather than silently assuming an upper bound the kernel does not itself enforce | 3/3 pass |
| 7 | `art-464-confirmation-matcher` | `54918b9e1a32a89b38be7118d7fa3e6c5af4fc8dc91a023545a4fdbddb0bec76` | no | n/a (float:no, direct read confirmed — `variance = r2(confirmed_balance - ledger_balance)` r2()-rounds to the cent BEFORE the exact-match/tolerance compare, collapsing sub-cent ULP noise the same way `art-358-simulate-output-floor` was confirmed to in `FV-PROPFLOOR-SHARD-C16-1` — measured directly here, not merely inherited: a confirmed_balance offset by exactly `Number.EPSILON` still rounds `variance` to `0.00` and still reports `EXACT_MATCH`; forced categorical boundary cases used instead — one-cent-off MISMATCH, no-ledger-balance, no-confirmation, duplicate key handling) | n/a — no iterative solver; termination bounded by `confirmations.length + ledger.length` (two linear passes plus a Map join, no recursion), proven with a 3,000-row array | 3/3 pass |
| 8 | `art-466-dora-roi-builder` | `4f605ce91ebec16f4f7e409b383f1f5f273b5f3e0551894aed9765e2b7681d80` | no (**FIX-2 correction from the row's `yes`** — see above) | n/a (float:no; forced categorical boundary cases used instead — LEI mod-97 exact pass/fail by a single trailing character, dangling function→provider reference, contract provider_id disagreeing with its function's own provider_id, whitespace-only mandatory field treated as missing by `safeStr().trim()`) | n/a — no iterative solver; termination bounded by `providers.length + functions.length + contracts.length` (three independent `.map()` passes, no recursion), proven with a 3,000-row array | 3/3 pass |
| 9 | `art-472-cbcr-builder` | `62a04a2495b254beb4938ec0bf7c60631fd7d37bdcb79e12677091656b0cb8ce` | **yes** (**FIX-2 correction from the row's `no`** — see above) | **yes** — the EDIT-REV revenue-sum check forced at `rounding_tolerance=0` with the classic `0.1+0.2` floating-addition shape, the exact-boundary-vs-one-cent-over compare, and 0/-0/denormal revenue values | n/a — no iterative solver; termination bounded by `table1.length + table2.length` (two linear passes, no recursion), proven with a 3,000-row table1 | 3/3 pass |
| 10 | `art-473-interquartile-benchmark` | `cb1ba5cdbe3498d0233716df24c81eefbc4b95386d57e76991a0c0c005b48f49` | **yes** | **yes** — `tested_party_ratio` forced exactly at the q1/q3 quartile boundary and ±ULP either side, n=0/n=1 edges, and the TNMM/Berry zero-denominator guards (revenue/total_cost/operating_expenses=0 → null, never NaN); a genuine narrow finding is documented in-file: dividing by `Number.MIN_VALUE` (the smallest denormal) produces `Infinity`, not `null` — the kernel's guard is a strict `!==0` check, not a finite-result check, and this floor surfaces that observation rather than asserting a false finite-always claim | n/a — no iterative solver; termination bounded by `comparable_ratios.length` (one sort plus O(1) quantile lookups, no recursion), proven with a 5,000-element array | 3/3 pass |

**6 of 10 kernels are float-sensitive** (`art-451`, `art-454`, `art-455`, `art-463`, `art-472`, `art-473`)
— this matches the WU row's own stated count (6/10) exactly, though the specific membership required two
FIX-2 corrections (see above): `art-466` moved from the row's `yes` to `no`, and `art-472` moved from the
row's `no` to `yes`, netting to the same total. ULP-boundary forcing (threshold ±1 ULP, 0, negative zero,
denormals, `x/y*y!==x`-shaped cases where applicable) is present in all 6 float-sensitive property files.
The other 4 kernels use forced categorical boundary cases in place of ULP-forcing, per spec §3's float:no
row.

**Termination:** every kernel's compute path is bounded by a caller-supplied array length
(observations, entities, policy_rate_table, assignments/roles, entries, per-category recalc arrays,
confirmations/ledger, providers/functions/contracts, table1/table2, comparable_ratios) — no recursion
anywhere across the 10 kernels. **One kernel required an explicit, honest caveat rather than a blanket
"bounded" claim:** `art-463-recalc-suite`'s DDB depreciation loop is bounded by the caller-supplied
`period_number` input, clamped only to a floor of 1 (`Math.max(1, Math.trunc(...))`) with **no declared
upper clamp** — this floor states that fact directly (proven to still complete in ~1s at
`period_number=200000`, not a hang, but genuinely unbounded above by kernel construction) rather than
asserting a termination bound the kernel source does not itself guarantee.

Convergence-or-report is not applicable to any of the 10 kernels in this shard — none contains an
iterative numeric solver (bisection, Newton's method, or similar); every kernel's loop bound is either a
caller-array length, a single `.map()`/reduce pass, or (for `art-463`'s DDB item only) a caller-input loop
count with the honest unclamped caveat stated above, confirmed by direct source read per kernel.

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row). Confirmed via
`node scripts/check-fv-floor-coverage.mjs --summary` on this branch: live kernels: 588, floored: 472
(462 pre-existing + these 10 new), unfloored: 116. `node scripts/run-proptests.mjs` passes 498/498.

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
