# FV-PROPFLOOR-SHARD-C19-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C19-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the `.kernel.mjs` source as authored, matching the header comment in
each `.proptest.mjs` file).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output (or, for `art-413` and `art-424`, its `buildArtifact()`
output, since both are async/private-input-shaped nodes whose `compute()` alone never reaches the
cryptographically-verified result — confirmed by direct comparison against that kernel's own golden
fixtures, which record the fully populated artifact) diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json` (`art-413` additionally against its
`.disclosure.json` private-witness sidecar), pass/fail recorded per file; (2) the property-file floor
properties themselves (termination bound, boundedness, differential re-derivation, metamorphic/
permutation-invariance checks as applicable, and — for the 1 float-sensitive kernel — mandatory
ULP-boundary forcing). No row received deeper manual review beyond this mechanical gate; the signer's
attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## ⚠ Correction to the WU row's float-sensitivity table (FIX-2 discipline)

The WU row (`board/done/FV-PROPFLOOR-SHARD-C19-1.md`) listed **2** of these 10 kernels as float-sensitive
(`art-413-screen-sanctions-private`, `art-425-large-exposures-limit-check`). Per this spec's FIX-2
instruction — "confirm float-sensitivity and shape against each kernel's own source before relying on the
table" — both were independently re-confirmed against their own `.kernel.mjs` source, and the table is
**wrong for one of the two**:

- **`art-425-large-exposures-limit-check` — CONFIRMED float-sensitive.** Genuine division
  (`exposurePct = (net_exposure_total_musd / tier1_capital_musd) * 100`) compared against a 25%/15%
  threshold. ULP-boundary forcing applied (below).
- **`art-413-screen-sanctions-private` — NOT float-sensitive, table corrected.** Direct read of the full
  151-line kernel shows the verdict math is pure string substring-matching (`probe.includes(sdn)`) over a
  fixed 3-name test SDN list, with plain integer increment counting (`hit_count++`). The only non-string
  operation in the file is `parseInt(...,16)` for hex-to-byte salt decoding inside the SHA-256 commitment
  helper — no division, no ratio, no threshold arithmetic anywhere the screening verdict depends on. This
  file therefore uses forced categorical boundary cases for `art-413`, not ULP forcing, and **only 1 of the
  10 kernels in this shard is float-sensitive**, not 2.

This correction is a direct application of FIX-2, not a deviation from it — the spec explicitly
anticipates the table being wrong and instructs re-confirmation over inheritance.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | termination/convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-400-check-official-statement-completeness` | `031039a46c60763e68a297e2d0cb28799aa5de6df00d9cd56926d73092ab6b30` | no | n/a (float:no, direct read confirmed — pure present/absent checklist counting, no arithmetic; forced categorical boundary cases used — empty arrays, all-complete, CDU element-complete-but-flag-false) | n/a — no iterative solver; termination bounded by the fixed 12-element `REQUIRED_ELEMENTS` / 15-element `MATERIAL_EVENT_CATEGORIES` tables (single linear walks, no recursion) | 3/3 pass |
| 2 | `art-402-validate-regf-call-frequency` | `49d5b68d9b602859352499b88b4a3748a4eb06f8c6e3e58b98c6198ca136bc9f` | no | n/a (float:no, direct read confirmed — every date is parsed to integer epoch-ms and every comparison is integer day-index arithmetic; forced categorical boundary cases used — exactly-7-in-7-days no-trip, 8th-call trip, quiet-period gap of exactly 1/7/8 days, unparseable timestamp) | n/a — no iterative solver; termination bounded by `calls.length` per debt group (the O(n²) 7-in-7 window walk and O(n²) quiet-period backward scan are both bounded by the per-debt call count, no recursion) | 5/5 pass |
| 3 | `art-403-check-debt-validation-notice` | `7587d455f6bdc2449925d27d42cc07a2660c799f4670d238cb0793af19d274fa` | no | n/a (float:no, direct read confirmed — response-period math is pure integer-day arithmetic via a hand-rolled civil-date algorithm, never fractional; forced categorical boundary cases used — unparseable mailing date, itemization-after-mailing flag, zero/negative mailing_assumption_days clamp) | n/a — no iterative solver; termination bounded by the fixed 10-element `REQUIRED_ELEMENTS` table (single linear walk) | 5/5 pass |
| 4 | `art-405-check-private-student-loan-disclosures` | `75fd46391316b49459fd5cfc046cdfc162076a32e0f76268ed539ffb43e3bd6e` | no | n/a (float:no, direct read confirmed — civilFromDays/dayOfWeek are pure integer-day-count algorithms, no fractional arithmetic anywhere; forced categorical boundary cases used — Friday final_disclosure_date with no holidays hand-verified against the shipped rescission math, unparseable date, IDR-out-of-scope invariant) | **explicit convergence-or-report property stated and tested:** the `while (businessDaysCounted < 3)` rescission loop is the file's one unbounded construct — bounded to `3 + 2*ceil((3+|holiday_dates|)/5)` iterations since it only skips Sat/Sun plus a FINITE declared `holiday_dates` set; tested directly with a 40-entry holiday_dates set (40 consecutive dates) and confirmed the loop still terminates and returns exactly 3 business days, never hangs | 5/5 pass |
| 5 | `art-408-evidence-bundle-tier-labeler` | `4bffde8c450663ed6c3f2e2d7f8671638c0277be7be5f9e9717598f5911b88f8` | no | n/a (float:no, direct read confirmed — pure boolean cumulative-gate logic and array filter/map, no arithmetic; forced categorical boundary cases used — all-gates-false → UNLABELED, envelope-only → OCG-Verify ceiling even with a spuriously-true prove gate, empty human_accountability_records → null bundle) | n/a — no iterative solver; termination bounded by `proof_refs.length` / `human_accountability_records.length` (single filter passes, no recursion) | 11/11 pass |
| 6 | `art-410-clause-coverage-scorer` | `43e9115f892a58de62567becc360a463707b7aa621dc6743cee3bda398be3d4d` | no | n/a (float:no, direct read confirmed — a genuine division exists (`coverage_pct`) but every tier-boundary compare runs AFTER `Math.round()` has collapsed the value to an exact integer-over-100, so no ULP window can flip a tier decision; forced categorical boundary cases used instead — exactly 100%/80%/50% coverage hand-verified, zero clauses, id-less entries dropped) | n/a — no iterative solver; termination bounded by `clauses.length` (single filter/map pass) | 5/5 pass |
| 7 | `art-413-screen-sanctions-private` | `2af360c0c70be73aaad6a5c1ac72f0718d6480b7b8d524a8d929b684532805e2` | no (WU row said yes — corrected above) | n/a (float:no on re-confirmation — see correction section) — forced categorical boundary cases used — empty party list, every-party-hits, case-sensitivity toggle | n/a — no iterative solver; termination bounded by the private `parties.length` (single linear substring-match scan, no recursion) | 2/2 pass (via `buildArtifact()` against the `.disclosure.json` private witness — §25 ocg-private-input@1 node; decoy `compute()` contract independently checked) |
| 8 | `art-418-idv-verification-failure-incident-composer` | `90527f7f3f2c9cb095cea22dcaef24642147eb19350d1a0d12bc4eeccc168822` | no | n/a (float:no, direct read confirmed — pure string/regex/enum-coercion logic and one filter loop, no arithmetic; forced categorical boundary cases used — missing session_receipt, malformed receipt_hash, unknown failure_type/severity_class coercion defaults, no cross-link) | n/a — no iterative solver; termination bounded by `session_evidence.length` (single filter pass, no recursion) | 4/4 pass |
| 9 | `art-424-witness-cosignature-verifier` | `d9ed5d3a0780e192b9d8f56ff41b6893ab74c516128dfca643191e9a76324caf` | no | n/a (float:no, direct read confirmed — the entire file including the vendored Keccak/ML-DSA crypto block is integer/bitwise/string logic; forced categorical boundary cases used — empty checkpoint_note, threshold 0, threshold exceeding witness_keys.length, non-base64 consistency_proof entry) | **explicit termination property stated and tested:** `compute()`'s synchronous precondition-validation path is exercised directly (not the async signature-verification continuation, which the fixture oracle covers via real signed vectors) — fuzzed with arbitrary-length/garbage `checkpoint_note` strings up to 50,000 chars and confirmed `compute()` never throws and always terminates (parseNote is one bounded split/filter pass, no recursion) | 9/9 pass (via `buildArtifact()` against real ed25519/ML-DSA-44 signed fixtures) |
| 10 | `art-425-large-exposures-limit-check` | `eea6976089a31b050d82c8bc25f5fb90f8f7e2b464627acc89bb16e5d58c859e` | **yes** | **yes** — 0/-0/±ULP/denormal forced at the 25%/15% limit-percentage thresholds, on `tier1_capital_musd`, on gross exposure, plus a `1/3*25`-shaped `x/y*y!==x` rounding-artifact case and a `MAX_SAFE_INTEGER` overflow-guard case | n/a — no iterative solver; termination bounded by `counterparties.length` (the connected-group rollup is a single `Map` pass, no recursion) | 4/4 pass |

**1 of 10 kernels is float-sensitive** (`art-425`) — this CORRECTS the WU row's own triage-table
classification of 2/10 (see correction section above); `art-413` was independently re-confirmed against
its own `.kernel.mjs` source per FIX-2 discipline and found not float-sensitive. ULP-boundary forcing
(threshold ±1 ULP, 0, negative zero, denormals, `x/y*y!==x`-shaped cases) is present in `art-425`'s
property file. The other 9 kernels use forced categorical boundary cases in place of ULP-forcing, per
spec §3's float:no row.

**Termination:** every kernel's compute path is bounded by a caller-supplied array/string length
(os_elements, material_event_categories_covered, calls, notice_elements, application/approval/
final_elements, holiday_dates, proof_refs, human_accountability_records, clauses, parties,
checkpoint_note/consistency_proof, session_evidence, counterparties) or, for `art-405`, by a finite
declared set bounding a `while` loop's skip count (see convergence-or-report note in row 4). Two kernels
(`art-405`, `art-424`) required an explicit convergence-or-report / termination-bound statement beyond a
plain array-length bound, per §3's class-C requirement; both are documented in their rows above.

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above — `art-424`'s vendored ML-DSA/Keccak
crypto block made it the most tempting kernel here to over-claim on; resisted, floor only.

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
