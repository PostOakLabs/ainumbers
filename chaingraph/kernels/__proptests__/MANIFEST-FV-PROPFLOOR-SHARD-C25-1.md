# FV-PROPFLOOR-SHARD-C25-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C25-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function, re-derived
independently at authoring time via the mandatory `FV-FLOOR-DIGEST-STALE-1` tool-call step and diffed
against every drafted header before this manifest was written — all 10 reproduced exactly).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent
fixture-oracle gate — the property file's `compute()` output diffed against every vector in that
kernel's own `chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the
property-file floor properties themselves (termination bound, boundedness, differential
re-derivation, metamorphic/permutation-invariance checks, and — for the 5 float-sensitive kernels —
mandatory ULP-boundary forcing). No row received deeper manual review beyond this mechanical gate;
the signer's attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

**⛔⛔ SIX CORRECTIONS TO THE WU ROW'S TRIAGE TABLE (per FIX-2 discipline) — the largest correction set
of this wave.** The WU row declared 7 kernels float-sensitive (`art-507`, `art-498`, `art-509`,
`art-510`, `art-508`, `art-512`, `art-515`) and 3 not (`art-497`, `art-513`, `art-514`). Direct source
read, confirmed with a targeted grep sweep for every division/rounding/BigInt-fixed-point operator
across all 10 kernel files, found the correct split is **5 float-sensitive** (`art-498`, `art-509`,
`art-508`, `art-513`, `art-514`) **and 5 not** (`art-507`, `art-497`, `art-510`, `art-512`, `art-515`):

- `art-507-determine-deposit-insurance-coverage` — **yes → no**. Every amount is an integer minor unit
  and every arithmetic operation is integer add/subtract/multiply; there is no division, no percentage,
  and no `display()`/`toFixed()` formatting step anywhere in the file.
- `art-510-build-art5-diligence-evidence` — **yes → no**. Zero numeric arithmetic of any kind: every
  field is a string, boolean, array, or integer count. Date comparisons are lexicographic string
  comparisons on ISO `yyyy-mm-dd`, never parsed as numbers or `Date` objects.
- `art-512-check-mica-reserve-disclosure` — **yes → no**. The kernel's own header claims (and the
  source confirms) money is 100% BigInt fixed-point (`toFixed`/`mulFixed`/`divFixed`/
  `roundFixedToString`, all BigInt `*`/`/`, zero IEEE-754 rounding). The file's only `Number` division
  is the proleptic-Gregorian calendar conversion, bounded to small integer year/month/day magnitudes
  where double-precision arithmetic is exact and which never touches the reserve-coverage money path.
- `art-515-build-allocation-decision-receipt` — **yes → no**. Same BigInt-fixed-point shape as
  `art-512`. The only `Number(...)` conversions extract the SIGN of a BigInt difference for a sort
  comparator, which BigInt-to-Number conversion preserves at any magnitude — no precision loss can
  flip a comparator's ordering.
- `art-513-public-money-settlement-receipt` — **no → yes**. `r2(v) = Math.round(v*100)/100` is real
  IEEE-754 arithmetic feeding `expected_credit`/`at_par_discrepancy`, which are then compared against
  an `EPS = 0.01` tolerance to set `PMR_AT_PAR` vs `PMR_SHORTFALL` — an epsilon-tolerance decision
  boundary, the same shape §3 requires ULP-forcing for.
- `art-514-conditional-relief-collateral-receipt` — **no → yes**. `r2(position_size * (charge_pct /
  100))` is computed independently for `applicable_capital_charge` and `revocation_capital_charge`,
  and their difference gates `revocation_exposure_material` via a `> 0` comparison — two independently
  rounded values compared for equality-adjacent boundary crossing is genuinely ULP-sensitive.

The net effect is a shift from 7/10 to 5/10 float-sensitive, not merely a relabeling — the corrected
classification changes which 5 kernels received mandatory ULP-boundary forcing versus forced
categorical boundary cases, and property files were authored against the corrected classification
throughout, not the WU table.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-507-determine-deposit-insurance-coverage` | `af6ead608e9e4066d16c80dc91534582c71e82ff5d9fc556cb6c9444a00b15d1` | no (WU row said yes — corrected, see above) | n/a (float:no, direct read confirmed — pure integer minor-unit arithmetic, no division anywhere; forced categorical boundary cases used instead: exact-allowance boundary, one-unit-over, negative/non-integer balance, empty input) | n/a — no iterative solver; every loop is bounded by `account_records.length` | 14/14 pass |
| 2 | `art-497-validator-change-control-receipt` | `54af35dcf6e35f959764ddf334f63dafbdf57047a8f810e47e3f980586a861b3` | no | n/a (float:no, direct read confirmed — the only float division (`r2` `share_of_total_pct`) is a display-only informational field never used in any branch, exception, or compliance_flag; forced categorical boundary cases at each change_type's exact-equality branches and the quorum threshold used instead) | n/a — no iterative solver; O(1) single-record evaluation | 4/4 pass |
| 3 | `art-498-reward-flow-related-party` | `6c287e9bd9cecbd2b1b9cc99b8431526e5225a29aa44b21f63831f5814b58da1` | **yes** | **yes** — 0/-0/±ULP/denormal forced around `minor()`'s `Math.round(n*100)` conversion boundary (incl. the classic 0.145 binary-representation case) and the materiality-threshold `>=` comparison, plus x·y÷y≠x case | n/a — no iterative solver; recipients deduped and bounded by input array length | 5/5 pass |
| 4 | `art-509-recompute-payment-waterfall` | `79ba683f5f9684c6c7ab2b2cfe7cdd8546591b5de200da9f10a3bb9637e408f1` | **yes** | **yes** — forced around `display()`'s `Math.trunc(abs/100)` safe-integer division boundary (values from 0 up to `Number.MAX_SAFE_INTEGER`, confirmed exact round-trip) and the ratio cross-multiplication safe-integer overflow edge | n/a — no iterative solver; sequential allocation bounded by `priority_ladder.length` | 5/5 pass |
| 5 | `art-510-build-art5-diligence-evidence` | `72798cbb71379e42e0b388c97b0781d1189fd20a06e289e2bbff86254b0dd17e` | no (WU row said yes — corrected, see above) | n/a (float:no, direct read confirmed — zero numeric arithmetic anywhere in the file; forced categorical boundary cases used instead: bare-year citation rejection, self-approval flag, inverted/absent period bounds, empty input) | n/a — no iterative solver; `duty_results` bounded by shipped-duty-count plus declared additional duties | 5/5 pass |
| 6 | `art-508-recompute-bordereau` | `400131baae5bef4da3dcb65a389b7eae6ef0e310ab7d91747a5a89bb26666102` | **yes** | **yes** — forced around `display()`'s `Math.trunc(abs/100)` safe-integer division boundary (same shape as `art-509`) and the `utilisation_basis_points` `product = consumed*10000` safe-integer overflow guard (confirmed it falls back to `null` rather than a silently wrong value when unsafe) | n/a — no iterative solver; per-currency footing bounded by `rows.length` | 6/6 pass |
| 7 | `art-512-check-mica-reserve-disclosure` | `3123cd816d8e2879a6ea052f973621b149340b5cd6072232bf2666e1bbe9c333` | no (WU row said yes — corrected, see above) | n/a (float:no, direct read confirmed — 100% BigInt fixed-point money math, zero IEEE-754 rounding; forced categorical boundary cases used instead: zero circulation, empty reserve, exact coverage boundary, 8dp-truncation-not-rounding, malformed-amount-string) | n/a — no iterative solver; `class_totals`/`missed_periods` bounded by `reserve_components.length`/`disclosure_dates.length` | 7/7 pass |
| 8 | `art-513-public-money-settlement-receipt` | `3a5d8a2058fde07defccc3491be7a54c5ef221c869295059f337ffe08db4dd03` | **yes (WU row said no — corrected, see above)** | **yes** — forced around the `EPS=0.01` at-par tolerance boundary (exact/inside/outside on both sides), the classic 0.1+0.2 binary-representation case, 0, -0, ±ULP, denormal, and x·y÷y≠x cases | n/a — no iterative solver; rails/fees bounded by input array length | 5/5 pass |
| 9 | `art-514-conditional-relief-collateral-receipt` | `b4e574eae79a1ae5d3d37e79cb155af73e2d4d9a14b9e346737a1b9c144daefa` | **yes (WU row said no — corrected, see above)** | **yes** — forced around the equal-applicable/revocation-percentage zero-delta boundary (confirmed `revocation_capital_delta` is exactly 0 and `revocation_exposure_material` is exactly `false` for 5 distinct percentage values incl. 1/3 and a x·y÷y≠x-derived percentage), plus 0/-0/denormal `position_size` cases | n/a — no iterative solver; `conditions` bounded by input array length, never filtered | 6/6 pass |
| 10 | `art-515-build-allocation-decision-receipt` | `cfa8312a00a78e19af8654199d3cfbc6224cc85e41ade3919d9eca0e60f46b40` | no (WU row said yes — corrected, see above) | n/a (float:no, direct read confirmed — 100% BigInt fixed-point money math, same shape as `art-512`; forced categorical boundary cases used instead: duplicate inventory id, zero/negative obligation, unknown objective, empty input) | **explicit, stated below** — the greedy allocation loop in `buildOptimal` is bounded by `eligibleItems.length`, tested directly including the early-break-on-`remaining<=0` path against a deliberately oversized obligation | 8/8 pass |

**5 of 10 kernels are float-sensitive** (`art-498`, `art-509`, `art-508`, `art-513`, `art-514`) — this
is a **six-way correction** to the WU row's own triage-table classification, netting from 7 to 5 (see
the correction detail above). ULP-boundary forcing (threshold ±1 ULP, 0, negative zero, denormals,
`x/y*y !== x`-shaped cases) is present in all 5 genuinely float-sensitive files. The other 5 kernels use
forced categorical boundary cases in place of ULP-forcing, per spec §3's float:no row.

**Termination:** every kernel's compute loop is bounded by a caller-supplied array length
(account_records, authorizing_identities, recipients, priority_ladder/available_funds, duty_declarations
/additional_duties, rows, reserve_components/disclosure_dates, rails/fees, conditions, eligibility_
schedule/inventory_snapshot) or is O(1) fixed-shape work (`art-497`'s single-record evaluation). **One
kernel required an explicit convergence-or-report-shaped statement beyond simple array-length
bounding**, per §3's class-C row:
- `art-515-build-allocation-decision-receipt`'s greedy allocation loop in `buildOptimal` is bounded by
  `eligibleItems.length` and breaks early once `remaining <= 0n`; tested directly against a deliberately
  oversized obligation amount (`999999999.99` against a two-item, low-value inventory) to confirm the
  loop terminates at the ordered-list exhaustion bound rather than looping on the unmet remainder.

**Known floor observation, disclosed not papered over:** `art-514-conditional-relief-collateral-
receipt`'s `revocation_capital_delta` is computed from two INDEPENDENTLY `r2()`-rounded charge values
rather than from a single division of the percentage difference. The floor's P4 property forced five
distinct equal-percentage cases (including `1/3` and an `x/y*y !== x`-derived percentage) and found
`revocation_capital_delta` was exactly `0` in every case at the trial magnitudes used — i.e. no ULP
defect was found, but the property exists specifically because the two-step independent-rounding shape
could in principle produce a spurious non-zero delta at other magnitudes, and this floor is the
tripwire that would catch it if the code ever changes.

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row).

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
