# FV-PROPFLOOR-SHARD-C30-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C30-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function, re-derived via the
mandated executed command per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's `FV-FLOOR-DIGEST-STALE-1` addendum and
independently diffed against every header below — 10/10 match).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file floor
properties themselves (termination bound, boundedness, a differential re-derivation against an
independently-written reimplementation, metamorphic/permutation-invariance checks, and — for the
float-sensitive kernels — mandatory ULP-boundary forcing). No row received deeper manual review beyond
this mechanical gate; the signer's attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## ⛔⛔ FIX-2 float-sensitivity corrections — restated per-item basis, RIGOROUS

The WU row's own triage table listed 6/10 kernels as float-sensitive: `art-575`, `art-577`, `art-578`,
`art-579`, `art-560`, `art-561`. **Direct source read of all 10 kernels found the table wrong in FIVE
places** — the largest correction count of any propfloor shard to date (prior shards: C23-1 found 1,
C24-1 found 4, C25-1 found 6, C27-1 found 5). Every correction below is backed by a specific line of
kernel source, not a heuristic guess:

| kernel | table said | corrected to | evidence |
|---|---|---|---|
| `art-575-tmpg-fails-charge-recompute` | yes | **no** | Kernel's own docstring: "recomputed charges round to the nearest minor unit (round-half-up) so every comparison is exact integer arithmetic." Every field gated through `posInt()`/`nonNegInt()`/`bpsRate()` (`Number.isSafeInteger`). `roundHalfUpRatio()` is `Math.floor(numerator/denominator)` over always-integer operands — an exact-integer-division-with-remainder pattern, not a continuous quotient. No 0/-0/denormal/x·y÷y≠x case exists to force. Floored instead with a distinct large-magnitude overflow-boundedness probe (P5), since this kernel — unlike its sibling `art-579` — places no explicit cap below `Number.isSafeInteger`, so a genuinely large `par_amount_minor × days_failed` product can exceed 2^53. That is a boundedness concern, not a fabricated ULP claim. |
| `art-577-exchange-fee-tier-recompute` | yes | **no** | Kernel's own docstring: "every rate and every money amount is an integer number of micro-dollars... every operation here is exact integer arithmetic -- no floating-point residue." Direct inspection confirms **zero division operators anywhere in `compute()`** — the invoice recompute is pure integer multiply-then-add, the diff is integer subtraction, both tolerance and cap comparisons are integer `<=`/`>`. |
| `art-578-etf-pcf-basket-verification` | yes | **no** | Kernel's own docstring: "Every cash figure is an integer minor unit... Non-integer input is REJECTED rather than coerced." Zero division operators; every check is integer multiply/add/`===`/`<=`. |
| `art-579-stock-loan-rebate-recompute` | yes | **no** | Kernel's own docstring: "all arithmetic below is exact integer arithmetic with explicit round-half-up (money) or round-up (collateral requirement) rules, never floating-point residue." **The one kernel in this shard that explicitly ENGINEERS AWAY the overflow risk its siblings above merely happen not to hit**: `MAX_VALUE_MINOR = 10_000_000_000` is documented in-source as bounding "every multiply below to a safe integer," together with `MAX_RATE_BPS = 20_000`, capping every product at ≤2e14 — safely under 2^53 with wide headroom. `roundDiv`/`ceilDiv` are both integer-floor operations. |
| `art-584-proof-of-reserves-verifier` | no | **YES** | The Merkle-sum hash walk is integer/string hashing (no float risk), but `coverageRatioPct = parseFloat(((reserveSum/liabilitySum)*100).toFixed(4))` and `deltaPct = parseFloat((Math.abs(published-reserveSum)/reserveSum*100).toFixed(4))` are genuine continuous floating-point division, gated by `withinTolerance = deltaPct <= COVERAGE_TOLERANCE_PCT` (0.01) — a real ULP-boundary-relevant decision threshold. `leaf_balance`/`leaf_sum` are caller-declared `Number(v)` with no integer coercion and no sign restriction (unrestricted, signed, continuous). ULP-boundary forcing added at the exact 0.01% tolerance boundary, the reserveSum=0 special case, negative/negative-zero/denormal leaf sums (P5). |

**`art-576-emir3-active-account-representativeness-classifier`** was re-confirmed as float:no (table
correct, no change) but is called out because it is NOT a rubber stamp: `annualizedCount = (rawCount *
12) / pp.reference_period_months` compared against a fixed threshold of 5 is a genuine float division.
Checked for real ULP risk and found not to carry one at any realistic `reference_period_months`
magnitude, because IEEE-754 division is correctly rounded — when the true rational quotient is exactly
an integer (including the decision boundary, 5), the computed double equals that integer exactly. Floored
via a forced categorical boundary case at the exact annualized-count=5 point instead of a fabricated ULP
claim (P5 in that file).

**`art-583-beacon-seeded-fair-sampling-deriver`** and **`art-589-redline-round-classifier`** were
re-confirmed as float:no (table correct) — pure HMAC-SHA256/bitwise integer arithmetic and pure string/DP
array logic respectively, with zero floating-point operations of any kind.

**`art-560-oracle-price-aggregation`** and **`art-561-currency-basket-index`** were re-confirmed as
float:yes (table correct) — both perform genuine continuous floating-point arithmetic (weighted means,
percentile interpolation, FX-rate/weight-sum division) with mandatory ULP-boundary forcing present.

**Net result: 3/10 kernels float-sensitive in this shard** (`art-560`, `art-561`, `art-584`) — down from
the table's stated 6/10, with one kernel moving in the opposite direction (`art-584`, no→yes). This
matches the shape of `FV-PROPFLOOR-SHARD-C27-1`'s finding (5/10 corrected, net 3/10 final) — the WU
row's float-sensitivity table continues to be unreliable in both directions, and re-confirmation by
direct source read remains mandatory per FIX-2, never optional.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing / floor treatment | convergence property | fixture_oracle |
|---|---|---|:---:|---|:---:|:---:|
| 1 | `art-575-tmpg-fails-charge-recompute` | `14e3887cf72bab31d7ba429fce3f50695fd92a5bf06a7db441520862bfd55efc` | **no** (corrected from yes) | forced categorical + a distinct large-magnitude overflow-boundedness probe (par_amount_minor near `Number.MAX_SAFE_INTEGER`), never a fabricated ULP claim | n/a — no iterative solver | 3/3 pass |
| 2 | `art-576-emir3-active-account-representativeness-classifier` | `61ccaaf1ba92ae118685760e5c4c2d2196095b159dd005a1e79d115d31e544c6` | no (re-confirmed) | forced categorical boundary at the exact annualized-count=5 decision point (the one genuine division present), plus the EUR 6bn threshold boundary | n/a — no iterative solver | 5/5 pass |
| 3 | `art-577-exchange-fee-tier-recompute` | `caed451dceca161ee2dd898a0aee48ceeaee497d39ac0eab2963ebad4437f5d8` | **no** (corrected from yes) | forced categorical + large-magnitude probe (zero division operators exist in this kernel) | n/a — no iterative solver | 3/3 pass |
| 4 | `art-578-etf-pcf-basket-verification` | `8490d544bbc1bcf3f211e1b3e65eb5f0d9d5e83522bb6baba6486139e802d40d` | **no** (corrected from yes) | forced categorical + large-magnitude probe (zero division operators exist in this kernel) | n/a — no iterative solver | 3/3 pass |
| 5 | `art-579-stock-loan-rebate-recompute` | `76e2d848ba285ccf040cc4dbbef50f1caf5a2a24922ef89765eaf246faa5abc1` | **no** (corrected from yes) | forced categorical incl. the MAX_VALUE_MINOR engineered-bound boundary itself (confirms no overflow at the documented max) | n/a — no iterative solver | 3/3 pass |
| 6 | `art-583-beacon-seeded-fair-sampling-deriver` | `00bf25e2ac76c12d2bc9de448a1c9d767c67581310b599637d193d2f949b708a` | no (re-confirmed) | forced categorical (float:no; HMAC-DRBG is pure integer/bitwise arithmetic) | **explicit, mandatory, stated below** — rejection-sampling walk bounded by `MAX_DRAWS = item_count*10`; asserted `draws_used` never exceeds the cap and that exhaustion is always reported (`INDETERMINATE`/`DRAW_CAP_EXHAUSTED`), including a forced item_count=1/sample_size>1 near-exhaustion case | 3/3 pass |
| 7 | `art-584-proof-of-reserves-verifier` | `852795237d7839b503e955db5db49f8d87ff6dc9edeb5a31687fca2e6f660b66` | **yes** (corrected from no) | mandatory ULP-boundary forcing on the 0.01% coverage-tolerance decision, reserveSum=0 special case, negative/negative-zero/denormal leaf sums — present and verified | n/a — no iterative solver (Merkle-sum walk is bounded by MAX_PATH_DEPTH=40, tested at and beyond the cap) | 7/7 pass |
| 8 | `art-589-redline-round-classifier` | `5af85fdf37a3ae3ab73a616adad96621f2fc811520c30cafb6404da7d71393c6` | no (re-confirmed) | forced categorical, all 5 classification states + round-chain rules (pure string/DP, zero float ops) | n/a — no iterative solver; LCS DP table dimension structurally bounded by word counts, tested via a reconstruction differential | 8/8 pass |
| 9 | `art-560-oracle-price-aggregation` | `ba126694afd24428319b321cbc06447608573deb30aaa75f5905a25146b3b91f` | **yes** (re-confirmed) | mandatory ULP-boundary forcing on the outlier-deviation threshold, stake-weighted-median half-point compare, price>0 admission gate, denormal price, negative-zero confidence — present and verified | n/a — no iterative solver; unbounded `submissions[]` array (no MAX cap in this kernel) tested at N=5000 for continued finiteness | 7/7 pass |
| 10 | `art-561-currency-basket-index` | `84f9b197e0b2e11acc54f7bb0ac50a30db1e80f22e33238395093d9ac9887921` | **yes** (re-confirmed) | mandatory ULP-boundary forcing on the target-weight-sum 0.001 tolerance gate, the derive-mode division, negative-zero/denormal usd_rate — present and verified, incl. a genuine SILENT-NULL finding (documented, not masked — see below) | n/a — no iterative solver; unbounded `components[]` array (no MAX cap in this kernel) tested at N=3000 for continued finiteness | 6/6 pass |

**3 of 10 kernels are float-sensitive** in the corrected classification (`art-560`, `art-561`,
`art-584`) — this does NOT match the WU row's own triage-table count of 6/10; the discrepancy is the
FIX-2 correction documented in the table above, independently re-confirmed against each kernel's own
`.kernel.mjs` source per FIX-2 discipline rather than inherited uncritically. ULP-boundary forcing
(threshold ±1 ULP, 0, negative zero, denormals, `x/y*y !== x`-shaped cases) is present in all 3.
The other 7 kernels use forced categorical boundary cases in place of ULP-forcing, per spec §3's
float:no row — three of them (`art-575`, `art-577`, `art-578`) additionally carry a large-magnitude
overflow-boundedness probe as an extra safety net beyond the minimum requirement, since their
multiplicands are not capped below `Number.isSafeInteger` the way `art-579`'s explicitly are.

**A genuine finding, documented not masked (`art-561`, P5(b)):** deriving a component's fixed amount as
`target_weight * index_value_at_rebase / rebase_usd_rate` with a denormal `rebase_usd_rate`
(`Number.MIN_VALUE`) overflows the division to `+Infinity`. The kernel's own `r()` rounding helper gates
every emitted figure through `Number.isFinite`, converting that `Infinity` to `null` rather than letting
it leak into the JSON payload — but `structural_error` stays `null` too (the weight-sum gate that sets it
does not itself involve this division), so this is a genuine SILENT-NULL path: no error is raised, no
NaN/Infinity leaks out, but `index_value`/`fixed_amount` both come back `null` instead of a number for a
pathologically small `rebase_usd_rate`. Floored as observed behavior (the property asserts "never
Infinity/NaN, only a finite number or `null`" — which holds) rather than asserted as a defect to fix, since
a kernel edit is out of scope for this floor row.

**Termination:** every kernel's compute loop or recursion is bounded either by a caller-supplied array
length (fails, trades, volume_lines, pcf.lines/cash_in_lieu, loans/daily_marks, submissions, components,
segments) or by a fixed small enum/class table. **`art-583-beacon-seeded-fair-sampling-deriver` and
`art-584-proof-of-reserves-verifier` are the two exceptions requiring their own explicit statement:**
`art-583`'s rejection-sampling draw walk is bounded by the caller-declared-derived `MAX_DRAWS =
item_count*10` hard cap (a structural, not merely observed, guarantee — `draw < MAX_DRAWS` is the loop's
own condition), confirmed never exceeded across 1,501 trials including a forced near-exhaustion case;
`art-584`'s two Merkle-sum path walks are each bounded by the caller-supplied `path[]` array length,
capped at `MAX_PATH_DEPTH=40` with `INDETERMINATE` returned (not an unbounded walk) beyond it — tested
both at and one step beyond the cap. `art-560` and `art-561` place NO array-length cap on
`submissions[]`/`components[]` respectively (confirmed by direct read — no `.slice()` truncation anywhere
in either kernel), so their floor files additionally test at N=5000/N=3000 to confirm continued
finiteness well beyond any fixture-tested size, rather than merely asserting an untested bound.

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
