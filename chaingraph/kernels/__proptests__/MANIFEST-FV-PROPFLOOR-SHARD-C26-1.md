# FV-PROPFLOOR-SHARD-C26-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C26-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function, run and pasted
verbatim per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's `FV-FLOOR-DIGEST-STALE-1` clause, executed via:
```
node -e "const{sourceDigest}=await import('./chaingraph/kernels/_buildid.mjs');const fs=await import('node:fs');const ids=[...10 kernel ids...];for (const id of ids) console.log(id, await sourceDigest(fs.readFileSync('chaingraph/kernels/'+id+'.kernel.mjs','utf8')));" --input-type=module
```
run from `repo/` inside this shard's worktree, output pasted verbatim below).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file floor
properties themselves (termination bound, boundedness, differential re-derivation, metamorphic/
permutation-invariance checks, forced categorical boundary cases at every float:no kernel's real decision
boundary, and ULP-boundary forcing at every float:yes kernel's threshold); (3) an independent re-read of
each kernel's own `.kernel.mjs` source to confirm its float-sensitivity classification, per
`FV-PBT-FLOOR-BUILD-SPEC.md`'s FIX-2 discipline. No row received deeper manual review beyond this
mechanical gate; the signer's attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## ⛔⛔ FLOAT-SENSITIVITY CORRECTIONS — the WU row's table did not survive direct source read (FIX-2)

**This shard's corrections run in BOTH directions**, which the shard's own dispatch note flagged as
mandatory to check: *"C23-1 found one kernel marked float:no that IS float-sensitive, and C24-1 found
FOUR marked float:yes with zero floating-point arithmetic."* Both patterns recur here.

### Direction 1 — WU said float:yes, kernel is actually integer-only fixed-point money math (6 corrections)

`art-516-daily-reconciliation-attestation`, `art-518-bulk-disbursement-integrity`,
`art-519-payment-data-migration-completeness`, `art-521-settlement-asset-backing-invariant`,
`art-525-nway-balance-closure-check`, `art-526-report-gl-reconciliation` — **all six carry an explicit
docstring declaring fixed-point integer money math** ("FIXED-POINT MONEY MATH... no floating-point
arithmetic anywhere in compute()" or, for art-525, "MINOR UNITS... exact integer addition and
subtraction — no floating-point residue"). Every amount in each of the six is coerced through a
`Number.isSafeInteger`-gated helper (`toMinorUnits()` / `minorInt()`), and every threshold compare in
each kernel is integer-vs-integer. `art-521` additionally contains one division
(`value_in_circulation_minor_units * backing_ratio_bps / 10000`) that is immediately `Math.trunc()`'d to
an integer before any comparison — its property file (P3) independently re-derives this exact formula as
a differential check to guard against precision loss on the multiply/divide, since that is the one place
in the shard where a genuine floating-point *computation step* (not threshold) occurs even though the
kernel's own claim of "no floating-point arithmetic" holds for every comparison. All six are corrected to
**float:no** and floored with forced categorical boundary cases at each kernel's real integer decision
boundary instead of a fabricated ULP claim.

### Direction 2 — WU said float:no, kernel actually has a genuine unguarded float threshold (2 corrections)

`art-523-identity-proofing-assurance-level` and `art-524-source-arrival-freshness-register` **were
mis-classified float:no by the WU table and are corrected to float:YES here.**

- `art-523`: the criterion-met test is the bare compare `match.strength >= minStrength`, where both
  operands pass through `safeNum()` — a plain `Number(v)` coerced only by a `Number.isFinite` guard, no
  integer restriction. The kernel's own docstring calls `strength` "a caller-normalized 0-100 scale," not
  an integer scale, and there is no cross-multiplication safeguard of the kind `art-494`
  (correctly float:no, per the C24 manifest) uses to keep its own threshold compare rounding-safe.
- `art-524`: `reconcileSource()` performs two unguarded float compares — `observed_as_of >
  expected_as_of` (the `late` flag) and `(referenceAsOf - observed_as_of) > freshness_threshold_hours`
  (the `stale` flag) — over caller-declared numeric reference points that pass through `n()`, again a
  bare `Number(v)` with only a `Number.isFinite` guard.

Both are floored with **mandatory ULP-boundary forcing** (threshold ±1 ULP, 0, negative zero, denormals,
plus an `x/y*y !== x`-style representable-but-imprecise case for art-523) per spec §3, in addition to the
class-C termination/boundedness/differential properties every kernel in this shard receives.

### Unchanged (2 kernels — WU table agreed, independently re-confirmed)

`art-517-audit-trail-completeness` (every numeric input passes through `safeInt()`, which
`Math.trunc()`s — integer-only, confirmed float:no) and `art-520-operator-exit-data-portability` (pure
tri-state/string classification plus one `Math.trunc()`'d integer field — confirmed float:no).

**Net result: 2 of 10 kernels are float-sensitive on direct source read (art-523, art-524) — not the WU
row's stated 7/10.** Every kernel was independently re-checked against its own `.kernel.mjs` source per
FIX-2 discipline rather than inherited uncritically from the table, in both directions.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive (corrected) | boundary treatment | fixture_oracle |
|---|---|---|:---:|---|:---:|
| 1 | `art-516-daily-reconciliation-attestation` | `cd7f7a7436413bdff06e19d14156760a6a8401f9e48a936fa26a9e3b60b6a3d8` | **no — CORRECTED from WU row's yes** | forced categorical boundary cases at the integer ageing tolerance (exact vs +1 day) and the absence-instrument prior_period_exceptions gate | 5/5 pass |
| 2 | `art-517-audit-trail-completeness` | `10ff11fc5e0034422df62658e0ca6d0c810e4f3a171d94f3a5be120cf5dfec41` | no (WU table agreed) | forced categorical boundary cases at MAX_SEQ_RANGE (20000 vs 20001) and the retention-days equality boundary | 6/6 pass |
| 3 | `art-518-bulk-disbursement-integrity` | `3c590d0a9987e270cb032c31ba74642ab9a7f3dab1f9fd32eca587058484bfba` | **no — CORRECTED from WU row's yes** | forced categorical boundary cases at the per-payee limit (exact vs +1 minor unit) and the absence-instrument prior_run_payee_refs gate | 9/9 pass |
| 4 | `art-519-payment-data-migration-completeness` | `d9e4f0984fd3d85463ece41f052a47bf3b98fed2df72e38ab131273cacd5d587` | **no — CORRECTED from WU row's yes** | forced categorical boundary cases at the value-variance tolerance (exact vs +1 minor unit) and the single-partition partition_inconsistent exclusion | 6/6 pass |
| 5 | `art-520-operator-exit-data-portability` | `f788f6feb29648cf1c09156f55bc79fa0da7511e5ce55547e00b893c8f6e826b` | no (WU table agreed) | forced categorical boundary cases on the tri-state absence-instrument rule (true/false/undeclared as distinct verdicts) and the operator-claim-unsupported condition | 5/5 pass |
| 6 | `art-521-settlement-asset-backing-invariant` | `2c62975ee6e29f7fd6568274a00305cd6d0043e1c89119d37e1e5d16ce3371ef` | **no — CORRECTED from WU row's yes** | forced categorical boundary cases at the integer backing threshold (exact vs -1 minor unit) and the vacuous/segregated backing_model switch; differential re-derivation of the bps formula added to guard the one multiply/divide step | 9/9 pass |
| 7 | `art-523-identity-proofing-assurance-level` | `f691517dd02006a5787bea91055d22c567fb6049e1f3d15c3bb2a474032cd335` | **YES — CORRECTED from WU row's no** | **ULP-boundary forcing** on `strength >= min_strength` (0, -0, Number.EPSILON, denormal, exact/±1-ULP boundary, `(0.1+0.2)*100`-style imprecise value), plus forced categorical for IAL_DEFINITION_INSUFFICIENT vs IAL_SHORTFALL | 3/3 pass |
| 8 | `art-524-source-arrival-freshness-register` | `27d4e48514eb2b1eed2231094e43e116be6b1457bbd2be49c4c5eca810550c64` | **YES — CORRECTED from WU row's no** | **ULP-boundary forcing** on both `late` (observed_as_of vs expected_as_of) and `stale` ((reference-observed) vs threshold) compares (0, -0, exact/±1-ULP boundary), plus forced categorical for the four source_status outcomes | 3/3 pass |
| 9 | `art-525-nway-balance-closure-check` | `43bb37390c65a71cf845232d1f01cd24d40f3ddadba827618355b0386bfb82c9` | **no — CORRECTED from WU row's yes** | forced categorical boundary cases at the closure-residual tolerance and the fewer-than-3-systems / duplicate-system-id refusal gates | 3/3 pass |
| 10 | `art-526-report-gl-reconciliation` | `ac0706aea54457a53cc1f56d8642d7b5f4bf09c4377b8bc7d1e52562a9d59e12` | **no — CORRECTED from WU row's yes** | forced categorical boundary cases at the per-account residual tolerance (exact vs +1 minor unit) and the three did_not_run priority gates (cadence_refused / gl_not_yet_closed / gl_stale) | 4/4 pass |

**2 of 10 kernels are float-sensitive on direct source read** (art-523, art-524) — a correction from the
WU row's stated 7/10, recorded above in both directions. Every kernel was independently re-confirmed
against its own `.kernel.mjs` source per FIX-2 discipline rather than inherited uncritically from the
table.

**Termination:** every kernel's output is bounded by a caller-supplied array length (exceptions,
payee_records, partitions, data_categories/declared_components/dependencies, buffers/movements,
evidence_items/criteria, expected_sources/observed_arrivals, systems, accounts) or a fixed enumeration cap
(art-517's sequence range is hard-capped at `MAX_SEQ_RANGE=20000`, reporting `UNDECIDABLE` beyond it;
art-525's system set is hard-capped at `MAX_SYSTEMS=12`, refusing to run beyond it). No kernel in this
shard contains an iterative numeric solver, so no convergence-or-report property applies to any of the
10 — confirmed per-item by direct read, none omitted.

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
