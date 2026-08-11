# FV-PROPFLOOR-SHARD-C24-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C24-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function, run and pasted
verbatim per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's `FV-FLOOR-DIGEST-STALE-1` clause).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file
floor properties themselves (termination bound, boundedness, differential re-derivation,
metamorphic/permutation-invariance checks, and forced categorical boundary cases at every kernel's real
decision boundary); (3) an independent re-read of each kernel's own `.kernel.mjs` source to confirm its
float-sensitivity classification, per `FV-PBT-FLOOR-BUILD-SPEC.md`'s FIX-2 discipline. No row received
deeper manual review beyond this mechanical gate; the signer's attestation, when it is added, covers
exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## ⛔⛔ FLOAT-SENSITIVITY CORRECTION — the WU row's table did not survive direct source read (FIX-2)

The WU row (`board/done/FV-PROPFLOOR-SHARD-C24-1.md`) classified 4 of these 10 kernels as
float-sensitive — `art-499-check-safeguarding-reconciliation`, `art-500-classify-safeguarding-method`,
`art-501-build-safeguarding-audit-evidence`, `art-503-build-dual-control-certification` — and mandated
ULP-boundary forcing for those 4. **Per the row's own instruction ("Confirm float-sensitivity and shape
against each kernel's own source before relying on the table"), each of the 10 kernels' full `.kernel.mjs`
source was read directly, not inherited from the table. The result: NONE of the 4 labelled float:yes
contain any floating-point arithmetic at all.**

- `art-499-check-safeguarding-reconciliation`'s own header states verbatim: *"FIXED-POINT MONEY MATH...
  there is no floating-point arithmetic anywhere in compute()."* Every amount is coerced through
  `toMinorUnits()`, which requires `Number.isSafeInteger` and rejects (never silently accepts) any
  non-integer value.
- `art-500-classify-safeguarding-method` gates its only two numeric inputs
  (`relevant_funds_high_water_minor_units`, `weeks_observed`) through `toSafeInt()`
  (`Number.isSafeInteger`); every comparison is an integer compare against a fixed integer threshold.
  The rest of the kernel is pure string-enum classification.
- `art-501-build-safeguarding-audit-evidence` performs no numeric arithmetic of any kind — it assembles
  evidence by string/ISO-date-string comparison, array filtering, and `Number.isSafeInteger`-guarded
  counts lifted from supplied input.
- `art-503-build-dual-control-certification`'s only numeric input is `threshold_n`, gated by
  `Number.isSafeInteger(threshold_raw) && threshold_raw >= 1`; the verdict is an integer `>=` compare
  between two non-negative counts.

Because there is no floating-point threshold in any of these 4 kernels, an "ULP-boundary forcing" test
(±1 ULP, denormals, `x/y*y !== x`) would be a fabricated property about arithmetic that does not exist in
the source — it could not fail meaningfully because there is no float boundary to sit near. **This is
corrected to float:no for all 4**, and each is floored instead with **forced categorical boundary cases at
its real (integer/string) decision boundary** — the exact fallback `FV-PBT-FLOOR-BUILD-SPEC.md` §3
prescribes for a float:no kernel. Full per-kernel citation of the disproving source lines is inside each
`.proptest.mjs` file's own header comment.

The remaining 6 kernels' WU-table float:no classification was independently re-confirmed and holds without
correction, with one kernel worth flagging as the closest call in the shard:
`art-494-icm-quorum-forgery-classifier` performs a genuine numeric threshold comparison
(`cum*100 >= total_stake_weight*quorum_pct`) over caller-supplied floats — but the kernel's own source
comment states this is deliberately cross-multiplied "so no division rounding can move the boundary," and
the WU row classifies it float:no. It is floored the same way as the other float:no kernels: with forced
categorical boundary cases at the quorum threshold, per spec §3's float:no fallback, rather than an ULP
claim.

**No kernel in this shard received ULP-boundary forcing, because none of the 10 contains a genuine
floating-point threshold on direct read.** This is a correction to the row's stated count ("4 of these 10
are float-sensitive"), not an omission — every one of the 10 was independently re-checked against its own
source per FIX-2, and the finding is recorded here rather than silently applied.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive (corrected) | boundary treatment | fixture_oracle |
|---|---|---|:---:|---|:---:|
| 1 | `art-491-ro-remediation-closure` | `3a605809e324af32ea025897ba46618e869f3a5701025e98ba5a7ff74a25847e` | no (WU table agreed) | n/a — display-only rounding, never branched on; termination + differential + boundedness + metamorphic append properties | 3/3 pass |
| 2 | `art-494-icm-quorum-forgery-classifier` | `5d1204c5f516f5975687ac3d86c9f9325f1fbac2071cfebf14f55f33094d7c7f` | no (WU table agreed; closest call in shard — genuine cross-multiplied quorum threshold) | forced categorical boundary cases at the quorum threshold (exact match, zero stake, quorum_pct 0/101, single-validator quorum) | 7/7 pass |
| 3 | `art-499-check-safeguarding-reconciliation` | `ee7c278f77ba168b6c221d6a703d01ad0390c884fd1551198e71f423d3fe4554` | **no — CORRECTED from WU row's yes** | forced categorical boundary cases at the integer tolerance threshold (exact match, ±1 minor unit, zero tolerance, negative-tolerance coercion, non-integer/oversized amount rejection) | 5/5 pass |
| 4 | `art-500-classify-safeguarding-method` | `314afddd557143ad20b8ecc8db1f7ebf34c9ff4eded6024723b8cde4d9501938` | **no — CORRECTED from WU row's yes** | forced categorical boundary cases at the audit-exemption integer thresholds (high-water = threshold exactly, weeks = 52/53, non-integer inputs) | 5/5 pass |
| 5 | `art-501-build-safeguarding-audit-evidence` | `5156c7482d1a3d1e1bb5c0a83beeb2ebb542c9e5cd257c31c2007cd8fc4daab8` | **no — CORRECTED from WU row's yes** | forced categorical boundary cases at the audit-period date range (as_of_date at/outside start and end) and the 3-role accountability threshold | 6/6 pass |
| 6 | `art-502-bind-attested-subject` | `8680e25172057485acdc9fae8651fab076d8ebe76824abf35bf75b8f186568fa` | no (WU table agreed) | n/a — pure hashing/string validation; forced categorical boundary cases on digest well-formedness | 5/5 pass |
| 7 | `art-503-build-dual-control-certification` | `a57bc96bcfdea16261374e636c9a22668fd91415abc1e441540e6d48306026b0` | **no — CORRECTED from WU row's yes** | forced categorical boundary cases at the integer threshold_n boundary (exact N, N-1, 0, negative, non-integer) | 13/13 pass |
| 8 | `art-504-classify-carf-reportable` | `7092917c1c069bc0681a899f7807db3b1927a96accc5ac068fee5faa0d0f19dc` | no (WU table agreed) | n/a — pure Set/array/string classification, no numeric boundary exists | 7/7 pass |
| 9 | `art-505-dispose-carf-status-message` | `035ab5ed297070b1f9a69babee5ab27760f0ac1404e3cc2f4383a6816ab39729` | no (WU table agreed) | n/a — pure Map/array/string disposition logic; forced categorical boundary cases on the return-path declaration gate | 8/8 pass |
| 10 | `art-506-classify-t1-posttrade-timing` | `bdca1dc3844ae202963a66ac4fb582aeafa1861b4dc2945696bf1d060d5bf780` | no (WU table agreed) | n/a — all timestamps reduce to integer epoch seconds; forced categorical boundary cases at margin_seconds=0 and the at-risk band edge | 8/8 pass |

**0 of 10 kernels are float-sensitive on direct source read** — a correction from the WU row's stated
4/10, recorded above. Every kernel was independently re-confirmed against its own `.kernel.mjs` source per
FIX-2 discipline rather than inherited uncritically from the table.

**Termination:** every kernel's output is bounded by a caller-supplied array length (notifications,
validator_weights, safeguarding_resource_components, streams, reconciliation_results/accountability_records,
signatory_records, records/transactions, file_errors/record_errors, steps) or a fixed small computation with
no unbounded loop (art-502's hashing is O(1) in structure, always producing an exactly-3-member preimage).
No kernel in this shard contains an iterative numeric solver, so no convergence-or-report property applies
to any of the 10 — confirmed per-item by direct read, none omitted.

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
