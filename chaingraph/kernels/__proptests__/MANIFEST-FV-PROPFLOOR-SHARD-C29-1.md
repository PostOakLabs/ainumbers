# FV-PROPFLOOR-SHARD-C29-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C29-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function, re-derived
independently at authoring time via the mandatory `FV-FLOOR-DIGEST-STALE-1` tool-call step and diffed
against every drafted header before this manifest was written — all 10 reproduced exactly, and
independently re-confirmed via `node scripts/check-fv-floor-coverage.mjs --verify-authoring` against
all 10 files, which reported `FV-FLOOR-DIGEST-GATE-1 clean`).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent
fixture-oracle gate — the property file's `compute()` output diffed against every vector in that
kernel's own `chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the
property-file floor properties themselves (termination bound, differential re-derivation of the
kernel's arithmetic, and — for the 7 float-sensitive kernels — mandatory ULP-boundary forcing, or for
the 3 float:no kernels, forced categorical boundary cases). No row received deeper manual review beyond
this mechanical gate; the signer's attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

**⛔⛔ THREE CORRECTIONS TO THE WU ROW'S TRIAGE TABLE (per FIX-2 discipline).** The WU row declared 8
kernels float-sensitive (`art-566`, `art-567`, `art-568`, `art-569`, `art-571`, `art-572`, `art-573`,
`art-574`) and 2 not (`art-565`, `art-570`). Direct source read, confirmed with a targeted grep sweep
for every division/rounding/BigInt-fixed-point operator across all 10 kernel files, found the correct
split is **7 float-sensitive** (`art-568`, `art-569`, `art-570`, `art-571`, `art-572`, `art-573`,
`art-574`) **and 3 not** (`art-565`, `art-566`, `art-567`):

- `art-566-iolta-three-way-reconciliation` — **yes → no**. Every balance, ledger entry, and outstanding
  item is an integer minor unit gated through `minorInt()` (`Number.isSafeInteger`), and every
  arithmetic operation in `compute()` is integer add/subtract only — never multiplication or division.
  The file's only `Number` division (`dayDiff()`'s `Math.round((b-a)/86400000)`) is used solely for an
  outstanding-item's informational `age_days`/`age_bucket` label, never a money value or a pass/fail
  threshold, and both operands are exact multiples of 86400000 apart for any real calendar-date pair,
  so the division is exact and `Math.round` is a no-op.
- `art-567-pe-waterfall-lp-recompute` — **yes → no**. The kernel's own header states it "mirrors
  art-373" — every money and rate value is parsed via `toFixed()` (pure string manipulation, never
  `Number()`) into a BigInt scaled by 10^8, and every downstream operation (`mulFixed`, `divFixed`,
  `fixedToPlainString`, the entire waterfall/catch-up/carry/clawback pipeline) is BigInt arithmetic.
  The file's only `Number` division (`daysBetween()`'s `Math.round((db-da)/86400000)`) derives an
  integer day-count immediately re-fed into `toFixed()` as a BigInt; both operands are safe-integer
  millisecond timestamps for any realistic fund-lifecycle date range, so the division is exact — this
  mirrors the C25 shard's `art-512`/`art-515` correction reasoning for a bounded calendar-conversion
  division that never touches the money path.
- `art-570-ucp600-document-examination-assembler` — **no → yes**. `pctVariance(actual, stated) =
  Math.abs((actual-stated)/stated)*100` is a real IEEE-754 division feeding
  `qty_within_tolerance`/`amount_within_tolerance` directly against the Art. 30 ±5%/10% tolerance gate;
  `amount_exceeds_lc = invoice_amount_minor > lc_amount_minor * (1 + amount_tolerance_pct/100)` and the
  Art. 28(f)(ii) insurance floor (`Math.ceil(cif_cip_value_minor * min_insurance_pct_of_cif / 100)`) are
  two further independent float boundaries. This is the same epsilon-tolerance decision-boundary shape
  the C25 shard corrected `art-513`/`art-514` **to** float:yes for — a percentage-variance float
  division feeding a pass/fail compliance gate is genuinely ULP-sensitive at the tolerance boundary.

The net effect is a shift from 8/10 to 7/10 float-sensitive, not merely a relabeling — the corrected
classification changes which 7 kernels received mandatory ULP-boundary forcing versus forced
categorical boundary cases, and property files were authored against the corrected classification
throughout, not the WU table.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-565-kya-x402-scope-verifier` | `f6c593e542fe2fbd5e4226a231dff7ce88a280d8fa68cc757c9fe6602afe29f3` | no | n/a (float:no, direct read confirmed — every comparison is a string-equality/inclusion check or a digit-only unsigned-integer-string compare, no division or rounding anywhere; forced categorical boundary cases used instead: exact spend-cap boundary, one-unit-over, leading-zero string compare, exact validity-window boundary, case-insensitive matching, each claim missing) | n/a — no iterative solver; exactly 5 check groups always attempted (bounded to {5,6} findings+indeterminate_reasons per P1) | 3/3 pass |
| 2 | `art-566-iolta-three-way-reconciliation` | `891bee3fc15ad70e6efb5440b1b794536e846e9bb77b5a4a9ea06df0153f772a` | no (WU row said yes — corrected, see above) | n/a (float:no, direct read confirmed — 100% integer minor-unit arithmetic, the one Number division is a bounded exact day-count never touching money; forced categorical boundary cases used instead: exact tolerance boundary, one-unit-over, exact-zero negative-balance boundary, day-count aging exactness) | n/a — no iterative solver; bounded by MAX_CLIENTS=60/MAX_OUTSTANDING=200/MAX_ENTRIES_PER_CLIENT=500 | 3/3 pass |
| 3 | `art-567-pe-waterfall-lp-recompute` | `df13afbe5e611661922ccea2123194de8f703a3efa283154ec7af8b7876881e9` | no (WU row said yes — corrected, see above) | n/a (float:no, direct read confirmed — 100% BigInt fixed-point money/rate math mirroring art-373, the one Number division is a bounded exact day-count re-fed into BigInt; forced categorical boundary cases used instead: zero pref_rate, zero carry_pct, exact return-of-capital boundary, missing required inputs) | n/a — no iterative solver; bounded by cashflows.length, fixed 4-tier structure | 3/3 pass |
| 4 | `art-568-securitization-trustee-report-recompute` | `d055891899f36887772e5e5edccb200703d03fa965edd3ea178f6c6933e98578` | **yes** | **yes** — forced around `display()`'s `Math.trunc(abs/100)` safe-integer division boundary (0, -0, ±1, exact multiples of 100 up to Number.MAX_SAFE_INTEGER, x·y÷y≠x-shaped safe-integer sweep), the same shape the C25 shard kept float:yes for on art-509/art-508 | n/a — no iterative solver; bounded by tiers.length/period_collections.length | 5/5 pass |
| 5 | `art-569-muni-arbitrage-spending-exception-checker` | `51f687ecec3fb71291c2dad098f4e0e98618a92218f75eaf7610890d75034ed3` | **yes** | **yes** — forced around `Math.floor(gross*0.03)`'s de-minimis-cap boundary and `Math.ceil((pct/100)*gross)`'s required-gross boundary (0.03 binary-representation residue, exact-percent values, Number.MAX_SAFE_INTEGER-adjacent gross proceeds, x·y÷y≠x-shaped sweep) | n/a — no iterative solver; milestones bounded to ≤5 by the fixed schedule tables, expenditures bounded by MAX_EXPENDITURES=500 | 3/3 pass |
| 6 | `art-570-ucp600-document-examination-assembler` | `b120516d58cfb7d8628e27b1cef81b01dbf298a4724dff8548143c422eb588c3` | **yes (WU row said no — corrected, see above)** | **yes** — forced around `pctVariance()`'s exact ±5%/10% tolerance boundary (one-unit-over/under on both sides, "about" widening, x·y÷y≠x-shaped small values, near-MAX_SAFE_INTEGER zero-variance) and the Art. 28(f)(ii) insurance-floor `Math.ceil` boundary | n/a — no iterative solver; drafts bounded by MAX_DRAFTS=10; `addBankingDays`' while-loop (the class-C centerpiece here) is bounded by the declared 5-banking-day window plus the caller's finite holiday set plus weekends, tested directly with forced categorical holiday/weekend cases | 3/3 pass |
| 7 | `art-571-lease-schedule-recompute-asc842-ifrs16` | `1a566e2d4a8d4a189f06af50533cfa35d5b37c69090587830c7dbffe07c1d9ed` | **yes** | **yes** — forced around the `Math.pow(1+rate, days/365)-1` discount-rate exponentiation boundary (0, denormal-adjacent, and near-1 rates) and the 75%/90% bright-line percentage boundaries, per the kernel's own header statement that "discounting itself uses IEEE-754 double arithmetic" | n/a — no iterative solver; bounded by payment_schedule.length ≤ MAX_PAYMENTS=240 | 3/3 pass |
| 8 | `art-572-multi-garnishment-stacking-recompute` | `40566c4874e0229d5ecd0a9656e3643dfaabfb3bfdc79ddc78a332d900bec3bf` | **yes** | **yes** — forced around `pctOf()`'s `Math.round((minor*pct)/100)` statutory-cap boundary (0, 1, exact multiples of 100, Number.MAX_SAFE_INTEGER) across every child-support tier and the general/HEA-AWG caps, plus `display()`'s `Math.trunc(abs/100)` boundary | n/a — no iterative solver; bounded by orders.length/legally_required_deductions.length | 5/5 pass |
| 9 | `art-573-section16b-short-swing-profit-recompute` | `2bf576ae353041e722a9e64447d9484503c9d7208b320a9338562368f15e41d2` | **yes** | **yes** — forced around `display()`'s `Math.trunc(abs/100)` boundary (0, 1, exact multiples of 100, near-MAX_SAFE_INTEGER prices), the same shape the C25 shard kept float:yes for on art-509/art-508 | n/a — no iterative solver; the lowest-in/highest-out nested matching loop is bounded by transactions.length², breaking early once either side is exhausted | 3/3 pass |
| 10 | `art-574-certified-payroll-prevailing-wage-recompute` | `4da565b656d200c214becb712b820a097894e9edeae66b4275e34854847911c7` | **yes** | **yes** — forced around the `st_hours*base + ot_hours*base*1.5 + (st_hours+ot_hours)*fringe` `Math.round` boundary (0, -0, fractional quarter-hours, a 1/3-hour repeating-decimal case) and the PWA-mode correction-interest `Math.round(deficiency*(rate/100)*(days/365))` boundary (0 days, 1 day, exact-1-year, Number.MAX_SAFE_INTEGER deficiency) | n/a — no iterative solver; bounded by payroll_rows.length/wage_determination.length | 4/4 pass |

**7 of 10 kernels are float-sensitive** (`art-568`, `art-569`, `art-570`, `art-571`, `art-572`,
`art-573`, `art-574`) — this is a **three-way correction** to the WU row's own triage-table
classification, netting from 8 to 7 (see the correction detail above). ULP-boundary forcing (threshold
±1 ULP, 0, negative zero, denormals, `x/y*y !== x`-shaped cases where the kernel's own arithmetic shape
makes them meaningful) is present in all 7 genuinely float-sensitive files. The other 3 kernels use
forced categorical boundary cases in place of ULP-forcing, per spec §3's float:no row.

**Termination:** every kernel's compute loop is bounded by a caller-supplied array length
(account_records/client_ledgers/outstanding_items, cashflows, tiers/period_collections,
expenditure_schedule, drafts + a finite banking-day walk, payment_schedule, orders/deductions,
transactions² with early-exhaustion break, payroll_rows/wage_determination) or is a fixed small number
of check groups (art-565's 5). **No kernel in this shard required an explicit iterative-solver
convergence-or-report statement beyond array-length/nested-loop bounding** — none of the 10 contains a
while-loop with a numeric convergence criterion (the closest candidate, `art-570`'s `addBankingDays`,
is a finite data-dependent walk bounded by the declared window plus a caller-supplied finite holiday
set, tested directly with forced categorical cases rather than a convergence property, since it always
terminates by construction on any finite input).

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
