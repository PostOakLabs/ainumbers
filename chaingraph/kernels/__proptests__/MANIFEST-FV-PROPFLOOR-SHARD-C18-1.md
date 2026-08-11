# FV-PROPFLOOR-SHARD-C18-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C18-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file
floor properties themselves (termination bound, boundedness, differential re-derivation,
metamorphic/permutation-invariance checks, and — for the 3 float-sensitive kernels — mandatory
ULP-boundary forcing). No row received deeper manual review beyond this mechanical gate; the signer's
attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-385-agent-token-scope-checker` | `ceb4b481b11aabd4718fed5d5c1d67fb69a5b58a07e48c5d1be12bbe8113af1a` | no | n/a (float:no, direct read confirmed — every comparison is Date/timestamp ordering, currency string equality, or an integer-shaped amount>cap compare) | n/a — no iterative solver; termination bound is the attenuation_chain array's own length, tested up to 500 elements | 5/5 pass |
| 2 | `art-386-lint-cbom-structure` | `d82c9dafda429dc646d851ed45d680724fa9e2d9c308b29e2d9a6ac10f24c257` | no | n/a (float:no, direct read confirmed — pure string-pattern classification via Array.includes, no arithmetic) | n/a — no iterative solver; termination bound is cbom.components array length, tested up to 5000 elements | 2/2 pass |
| 3 | `art-387-pqc-deadline-ladder-calculator` | `22f4891e4f4169482a7f9026e33d39349cbee9578f4001be24826afadcb85c1c` | no | n/a (float:no, direct read confirmed — fixed-point UTC-midnight millisecond integer arithmetic only, Math.round((b-a)/86400000)) | n/a — no iterative solver; termination bound is inventory array length | 5/5 pass |
| 4 | `art-389-tempo-mainnet-fee-capacity` | `cfa8b47b776f0402746e4968070394d060291ee3afe265412a07fcd2018194ac` | **yes** | **yes** — block_time_seconds forced at 0/-0/±ULP/denormal/1e300, plus a BigInt>MAX_SAFE_INTEGER→Number conversion case for the tps_headroom division path | n/a — no iterative solver; termination bound is payment_mix array length, tested up to 3000 elements | 2/2 pass |
| 5 | `art-394-x402-deferred-handshake-validator` | `86b67fe8bd78c4f98cff644943c97efe820149953edf0080e31c279d760f5994` | no | n/a (float:no, direct read confirmed — score arithmetic is pure integer math clamped [0,100], no ratio/threshold float compare) | n/a — no iterative solver; termination bound is prior_ids array length and the isHttpsUrl character-scan loop, both tested up to large sizes | 6/6 pass |
| 6 | `art-406-cross-venue-margin-estimator` | `43750924c09ef1d6bfd8c815c5452fb6c21d0f7261c5518df2c9781abace1499` | **yes** | **yes** — cross_margin_offset_pct forced at 0/-0/1/1±ULP/denormal, leverage_multiple forced at denormal-near-zero and extreme magnitude | n/a — no iterative solver; termination bound is venue_positions array length, tested up to 3000 elements | 3/3 pass |
| 7 | `art-407-umr-aana-readiness-diagnostic` | `ec1ae85431a3f2dc2a83949b48729db2b98414f0424c360c26bac091556f3bea` | no | n/a (float:no, direct read confirmed — readiness_avg lands only on the discrete set {0,0.5,1,1.5,2} from integer-input division by a constant 2, with grade thresholds far from any of those values — no ULP-adjacency case exists) | n/a — no iterative solver; termination bound is counterparties array length, tested up to 3000 elements | 3/3 pass |
| 8 | `art-396-compute-15c3-3-reserve` | `4d4f69e7fa90f1983449c71e85bbf2446e5dae6ee6b77249b04fa5f8f891223a` | **yes** | **yes** — margin-debit haircut multiplication forced at 0/-0/±ULP/denormal/1e15, plus the aging-exclusion day-count boundary (30 vs 31 days) | n/a — no iterative solver; termination bound is credit_items/debit_items array length, tested up to 3000 elements each | 4/4 pass |
| 9 | `art-397-lint-trace-cat-reports` | `aa77f951451f7ca0f0491377f11ca36e72a6fbe9856e4575cfe2bba60e060379` | no | n/a (float:no, direct read confirmed — all timestamp arithmetic is integer millisecond math, no float compare) | **explicit, mandatory, stated below** — `nextTradingDayStart` is a bounded search loop with a hard `CALENDAR_SEARCH_CAP_DAYS=30` cap; tested against a deliberately pathological all-weekend calendar that exhausts the cap and confirms it reports null (never hangs, never exceeds the cap) | 5/5 pass |
| 10 | `art-399-lint-x12-claim-records` | `b3acb2f4a9c067913ed0abcc7a47a783f033fbb08a6c467341233bae5def2a1f` | no | n/a (float:no, direct read confirmed — the only decimal compare is a fixed BALANCE_TOLERANCE=0.01 band, not a ratio/threshold; forced categorical clearly-within/clearly-outside cases substitute for an ULP claim, deliberately avoiding the 100.01-100 subtraction which is NOT exactly 0.01 in IEEE-754 binary) | n/a — no iterative solver; termination bound is claims/claim_payments array length, tested up to 3000 elements | 3/3 pass |

**3 of 10 kernels are float-sensitive** (`art-389`, `art-406`, `art-396`) — this matches the WU row's own
triage-table classification (3/10), and each was independently re-confirmed against its own `.kernel.mjs`
source per FIX-2 discipline rather than inherited uncritically. No corrections were needed. ULP-boundary
forcing (threshold ±1 ULP, 0, negative zero, denormals, precision-loss-shaped cases) is present in all 3.
The other 7 kernels use forced categorical boundary cases in place of ULP-forcing, per spec §3's float:no
row — including `art-399`, whose forced-boundary design deliberately avoided a numerically-unstable
"exactly at tolerance" literal (`100.01 - 100 !== 0.01` in IEEE-754 binary) in favor of clearly-within/
clearly-outside bands, since a literal ULP-adjacency claim would exceed this kernel's declared float:no
scope.

**Termination:** every kernel's compute loop is bounded by a caller-supplied array length (attenuation_chain,
cbom.components, inventory, payment_mix, covered_components/prior_ids, venue_positions, counterparties,
credit_items/debit_items, cat_events, claims/claim_payments) — tested up to several thousand elements per
kernel with no observed slowdown outside linear scaling. **`art-397-lint-trace-cat-reports` is the one
exception requiring its own explicit statement**: its TRACE-deadline computation includes
`nextTradingDayStart`, a bounded search loop with an EXPLICIT iteration cap
(`CALENDAR_SEARCH_CAP_DAYS = 30`) rather than an input-length bound — the kernel's own source comment
states this cap exists "so it can never hang." **The "convergence-or-report" property (§3, class C) is
therefore CONFIRMED APPLICABLE AND TESTED for `art-397` alone in this shard**: a deliberately pathological
all-weekend calendar was constructed to force cap exhaustion, and the floor file confirms the kernel
reports `null` (deadline_utc/timely) rather than hanging, looping past 30 iterations, or producing NaN.
The other 9 kernels have no bounded-search-with-cap shape and the property is confirmed not applicable for
them, stated per-item above.

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row). Confirmed via
`node scripts/check-fv-floor-coverage.mjs --summary` on this branch: live kernels: 588, floored: 452
(442 pre-existing + these 10 new). `node scripts/run-proptests.mjs` — result recorded at land time in the
board row's check-off (this shard's own 10 files each pass standalone, confirmed individually above).

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
