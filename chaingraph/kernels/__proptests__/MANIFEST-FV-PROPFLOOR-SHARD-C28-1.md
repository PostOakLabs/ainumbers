# FV-PROPFLOOR-SHARD-C28-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C28-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function, re-derived
independently at authoring time via the mandatory `FV-FLOOR-DIGEST-STALE-1` tool-call step and diffed
against every drafted header before this manifest was written — all 10 reproduced exactly).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent
fixture-oracle gate — the property file's `compute()` (or, for the one §25 private-input node,
`buildArtifact()` against the private witness reconstructed from the `.disclosure.json` sidecar) output
diffed against every vector in that kernel's own `chaingraph/kernels/fixtures/<id>.fixtures.json`,
pass/fail recorded per file; (2) the property-file floor properties themselves (termination bound,
boundedness, differential re-derivation, metamorphic/permutation-invariance or monotone-append checks,
and — for the 3 float-sensitive kernels — mandatory ULP-boundary forcing). No row received deeper manual
review beyond this mechanical gate; the signer's attestation, when it is added, covers exactly this basis
and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

**⛔⛔ TWO CORRECTIONS TO THE WU ROW'S TRIAGE TABLE (per FIX-2 discipline).** The WU row declared 5
kernels float-sensitive (`art-539`, `art-541`, `art-543`, `art-557`, `art-558`) and 5 not (`art-544`,
`art-548`, `art-559`, `art-563`, `art-564`). Direct source read, confirmed with a targeted grep sweep for
every division/rounding/BigInt operator across all 10 kernel files, found the correct split is **3
float-sensitive** (`art-539-asset-liability-coverage`, `art-541-best-execution-recompute`,
`art-543-csdr-penalty-recompute`) and **7 not** — both `art-557` and `art-558` were mis-triaged:

- `art-557-record-index-constituents` — **yes → no**. Direct read found ZERO numeric arithmetic on any
  echoed field: `normalizeConstituent()` only passes `security_id`/`name`/`sector`/`country` through
  unchanged. The sole numeric operation anywhere in the file is the integer comparison
  `selection_universe_size < constituent_count` — no division, multiplication, or rounding.
- `art-558-record-fund-positions` — **yes → no**. Direct read found ZERO numeric arithmetic anywhere in
  the file: `normalizeHolding()` only type-checks `quantity` (`typeof h.quantity === 'number' &&
  Number.isFinite(h.quantity)`) and echoes it verbatim; `shares_outstanding` is likewise only validated
  (`>0`), never summed, divided, multiplied, or rounded. There is no price field in this kernel at all —
  that arithmetic belongs to the downstream `art-373-recompute-fund-nav` node this kernel's own header
  comment explicitly defers to.

`art-557` and `art-558` are structural twins (both pure attestation kernels: SUPPLIED-and-ASSERTED
constituent/holdings snapshots, zero-egress, zero arithmetic on any echoed numeric field) — both being
mis-triaged the same direction, by the same margin, is consistent with a single triage-table authoring
slip across the pair rather than two independent misreadings.

The 5 WU-declared-`no` kernels (`art-544`, `art-548`, `art-559`, `art-563`, `art-564` — all
structural/comparison-only or integer-cents-only per direct read) and the 3 WU-declared-`yes` kernels
that were confirmed correct (`art-539`, `art-541`, `art-543`, all genuine IEEE-754
division/multiplication/rounding chains feeding a decision or accumulated total) needed no correction.

The net effect is a shift from 5/10 to 3/10 float-sensitive — two mis-triaged kernels (`art-557`,
`art-558`), not a relabeling of the whole set. Property files were authored against the corrected
classification throughout, not the WU table.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-539-asset-liability-coverage` | `a80285b47c468275f244648e19b225f0e740ed20c7f8925e658514529f807919` | **yes** | **yes** — forced around the `coverage_ratio===1.0` COVERED/SHORTFALL threshold (exact boundary, 1 ULP below), the `liabilities===0` finite-gate (never a division artifact), negative-zero liabilities, a denormal asset amount, and an `x/y*y!==x` shaped assets/liabilities pair | n/a — no iterative solver; every loop is bounded by `assets.length`/`liabilities.length` | 3/3 pass |
| 2 | `art-541-best-execution-recompute` | `3fe3f8f91aee95249b6c690837eac8476621b70688946d1417dda593e4c1915c` | **yes** | **yes** — forced around the `price_improvement_bps===0` `at_or_better` threshold (exact boundary on both the buy/nbbo_ask and sell/nbbo_bid legs), a denormal NBBO pair, an invalid-execution-price rejection at the `-0` boundary, and an `x/y*y!==x` shaped nbbo_ask/execution_price pair | n/a — no iterative solver; `fill_count` bounded by `min(fills.length, FILL_SET_CEILING=5000)` | 3/3 pass |
| 3 | `art-543-csdr-penalty-recompute` | `b2b0ccaae79b05facefac2e7c9a2294abd353bd1978a163471dc45d28a8ed371` | **yes** | **yes** — forced around `partial_settled_pct` exactly 0 and 1 (the latter is a catastrophic-cancellation shape: `penalty_amount = gross_penalty - partial_credit` collapses to ~0), a denormal `reference_price`, negative-zero `reference_price`, `fail_days===0`, and an `x/y*y!==x` shaped `reference_price` — the shipped golden fixture itself already carries visible float noise (`gross_penalty: 12312.500000000002`), confirming genuine IEEE-754 accumulation in this kernel's un-rounded arithmetic chain | n/a — no iterative solver; `determinations` bounded by `open_fails.length` | 3/3 pass |
| 4 | `art-544-slate-report-validator` | `f3131b76454e25a6937e8ccf56a7df819601565117e2e365621eef97e5aa1d9b` | no | n/a (float:no, direct read confirmed — every numeric check is a direct `Number.isFinite()`/`>`/`>=` structural comparison, zero division/multiplication/rounding; forced categorical boundary cases used instead: quantity 0 vs 1, negative vs zero `collateral_value`, `security_identifier` length 5/6/12/13 boundaries, unparseable `effective_date`, empty `reports`) | n/a — no iterative solver; `violations` bounded by `reports.length` | 5/5 pass |
| 5 | `art-548-vop-readiness-diagnostic` | `9d9df2ce31e5a6665cd88ed8ad73de1b8f1ca8cb79273dab000d5ea53ef8fa76` | no | n/a (float:no, direct read confirmed — `classifyVopReadiness()` performs zero arithmetic on `match_score`, only direct `>=` comparisons against caller-supplied thresholds; forced categorical boundary cases used instead: `match_score` exactly at each threshold, no `match_score` supplied, an unrecognized `psp_vop_response_code`). §25 `ocg-private-input@1` node — `compute(pp)` is a deliberate decoy stub per SPEC.md §18.3; the real verdict runs only inside `buildArtifact()` against the private witness, verified via the P0 decoy-contract check | n/a — no iterative solver; O(1) single-witness classification | 3/3 pass |
| 6 | `art-557-record-index-constituents` | `9fa0ed744db004c384a593d82dbf01220683bac4c5daef6601790bfb5ffbd175` | no (WU row said yes — corrected, see above) | n/a (float:no, direct read confirmed — pure attestation kernel, the sole numeric operation is an integer `selection_universe_size < constituent_count` comparison; forced categorical boundary cases used instead: missing `index_id`/`as_of_date`/`eligibility_criteria_ref`, empty `constituents`, `selection_universe_size` below/at the constituent count, one constituent missing `security_id`) | n/a — no iterative solver; `constituents` echoed 1:1, bounded by input length | 3/3 pass |
| 7 | `art-558-record-fund-positions` | `131eac7aaf5e372e1965aa999e673311441ba0a4febdaab6db2acae582e9496f` | no (WU row said yes — corrected, see above) | n/a (float:no, direct read confirmed — zero numeric arithmetic anywhere in the file, the structural twin of `art-557`; forced categorical boundary cases used instead: missing `fund_id`/`valuation_date`, empty `holdings`, `shares_outstanding` at/below zero, non-numeric `quantity`, one holding missing `security_id`) | n/a — no iterative solver; `holdings` echoed 1:1, bounded by input length | 3/3 pass |
| 8 | `art-559-attest-calc-agent-independence` | `68c476b24ca693447d4153a954653832e6a9a62a35f2e0da3ac578eb163f74b0` | no | n/a (float:no, direct read confirmed — pure string/enum/boolean logic, zero numeric arithmetic anywhere in the file; forced categorical boundary cases used instead: missing `relationship_declaration`, unknown commitment scheme, malformed `sha256:` commitment, `trigger_ref.tool_id` outside the allowed 3, empty `interested_parties`) | n/a — no iterative solver; `interested_parties`/`rejected_inputs` bounded by input length plus a fixed small constant of structural checks | 4/4 pass |
| 9 | `art-563-mt9xx-camt-statement-migration-mapper` | `79089ccf4a9ef55d91ff82ddba35cc5faa5878ec105312739ff7a2518a33f0f5` | no | n/a (float:no, direct read confirmed — every amount is parsed as INTEGER cents via `parseInt(...,10)`, never `parseFloat`, never a division; every downstream sum/difference is plain integer arithmetic; forced categorical boundary cases used instead: missing `:20:`/`:25:`/`:60F:`/`:62F:` fields, MT942's declared no-closing-balance exemption, a `:86:` narrative exactly at/one-over the 390-char MT limit, a malformed comma-less amount string, balanced vs. mismatched `60F+61=62F`) | n/a — no iterative solver; `parseFields()` loops over the input's line-split array (the string-length-recursion/data-dependent-loop shape §3 calls out explicitly), `entries` bounded by the number of `:61:` tag-line fields, itself bounded by input string length — a metamorphic monotone-append check confirms appending one more well-formed `:61:`/`:86:` pair never decreases `entries.length` | 4/4 pass |
| 10 | `art-564-ucp-checkout-payload-lint` | `828c4890e7f551a049a00ccacf21c33350300f9b10d047e2d05904d0f97e5c62` | no | n/a (float:no, direct read confirmed — `isSafeInt()` REQUIRES `Number.isSafeInteger()` for every amount/quantity, so the kernel's own design rejects non-integer amounts as a lint finding rather than doing float arithmetic on them; forced categorical boundary cases used instead, including the non-integer-amount case itself: absent payload, unknown `ucp.version` capping the verdict at `UNKNOWN_VERSION` regardless of otherwise-clean structure, quantity 0 vs 1, exactly-one-subtotal/-total vs miscounted cardinality, non-integer amount) | n/a — no iterative solver; `findings` bounded by a finite function of the fixed required-field count plus `line_items.length`/`totals.length` | 5/5 pass |

**3 of 10 kernels are float-sensitive** (`art-539`, `art-541`, `art-543`) — this is a **one-kernel
correction** to the WU row's own triage-table classification, netting from 5 to 3 (see the correction
detail above). ULP-boundary forcing (threshold ±1 ULP, 0, negative zero, denormals, `x/y*y !== x`-shaped
cases) is present in all 3 genuinely float-sensitive files. The other 7 kernels use forced categorical
boundary cases in place of ULP-forcing, per spec §3's float:no row.

**Known floor observation, disclosed not papered over (`art-541`):** `avg_price_improvement_bps` is a
floating SUM of already-rounded per-fill `price_improvement_bps` values divided then rounded — IEEE-754
addition is not associative, and a direct probe (documented in the property file's own P4 header comment)
found a genuine ±0.01 order-dependent difference in roughly 0.8% of permutation trials at the magnitudes
this floor exercises. `fill_count`/`scored_count`/`rejected_count`/`pct_at_or_better` are exact
integer-ratio aggregates and were confirmed order-independent across every trial; only the floating-sum
`avg_price_improvement_bps` field is compared with a 0.01 tolerance in the permutation-invariance
property, and this is stated here rather than silently widened without comment.

**Termination:** every kernel's compute loop is bounded by a caller-supplied array length (`assets`/
`liabilities`, `fills`, `open_fails`, `reports`, `constituents`, `holdings`, `interested_parties`) or a
fixed-shape/O(1) computation (`art-548`'s single-witness classification). `art-563`'s `parseFields()` is
the one string-length-recursion/data-dependent-loop shape named in spec §3's class-C row explicitly —
bounded by the input message's line-split length, with a metamorphic monotone-append property confirming
`entries.length` never decreases as well-formed `:61:`/`:86:` pairs are appended. No kernel in this shard
required an explicit convergence-or-report-shaped statement beyond simple length/array bounding — none of
the 10 contains an iterative solver.

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
