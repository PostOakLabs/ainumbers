# FV-PROPFLOOR-SHARD-C27-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C27-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function, run per the
mandated executed command and pasted verbatim, never hand-typed).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()`/`buildArtifact()` output diffed against every vector in that
kernel's own `chaingraph/kernels/fixtures/<id>.fixtures.json` (plus the `.disclosure.json` sidecar for the
one §25 private-input node, `art-529`), pass/fail recorded per file; (2) the property-file floor
properties themselves (termination bound, boundedness, differential re-derivation against an independent
reimplementation, metamorphic/permutation-invariance checks, and — for the 3 float-sensitive kernels —
mandatory ULP-boundary forcing); (3) an independent, direct re-read of the kernel's own source against
the WU row's triage table (FIX-2 discipline), which corrected 5 of the 10 classifications (see below). No
row received deeper manual review beyond this mechanical gate; the signer's attestation, when it is
added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-528-cross-ccp-pqd-comparator` | `fd251101f928b941bade8919f9fc8215154f87e82c9ec9e6953ea483c95b82f1` | **yes** (row correct) | **yes** — threshold ratio_pct forced at the exact rounded dataset value ±EPSILON, 0, -0, MIN_VALUE, ±100 across all 4 operators | n/a — no iterative solver | 3/3 pass |
| 2 | `art-529-ccp-default-waterfall-recompute` | `1fa3932e10c166675cb5eaf1c41a165ee448e916df2086e1cf963e95ee4a2f97` | **no — CORRECTED (row said yes)** | n/a (float:no, direct read confirmed — pure integer minor-units Math.min/subtraction, no division/multiplication; §25 private-input node, WebCrypto commitment only) — forced categorical boundary cases used instead | n/a — no iterative solver (sequential, structure-length-bounded absorption) | 3/3 pass |
| 3 | `art-530-default-fund-cover2-sizing` | `4d53619712ff1da614212e1de80b28da3a815322d590e9fa5f7dd3db647c59b2` | **no — CORRECTED (row said yes)** | n/a (float:no, direct read confirmed — kernel's own docstring: "No floating-point arithmetic in compute()"; `Math.trunc(exposure*loss_bps/10000)` truncated integer division) — forced categorical boundary cases used instead | n/a — no iterative solver | 5/5 pass |
| 4 | `art-532-client-porting-check` | `6b3fddf02c09856bc6c1a58454eed2257d8a93d2e0a66af5721811ba315ba5f9` | **no — CORRECTED (row said yes)** | n/a (float:no, direct read confirmed — kernel's own docstring: "no floating-point arithmetic in compute()"; `Math.round(ms_diff/60000)` is exact-integer-ms over a fixed constant) — forced categorical boundary cases used instead | n/a — no iterative solver | 4/4 pass |
| 5 | `art-533-mra-remediation-closure-register` | `ccad868f81e724e7e30de59a9c955f7ba8c69d690fe04fbc6b3984f0e9352f5a` | **no — CORRECTED (row said yes)** | n/a (float:no, direct read confirmed — the only division is `Math.floor(ms_diff/86400000)`, an exact-integer day-count identical in shape to art-402/art-387's already-confirmed float:no day-count pattern; no genuine ULP risk at this granularity) — forced categorical boundary cases used instead | n/a — no iterative solver | 3/3 pass |
| 6 | `art-534-aml-lookback-disposition-rollup` | `2263d143a5cbc54da93c78d3d8fb7d028dd161856f55cf8007414c81efad7778` | no (row correct) | n/a (float:no, direct read confirmed — the two `Math.round(x*10000)/100` pct fields are DISPLAY-ONLY, exactly the art-491 precedent: gate_policy branches on boolean coverage/rationale counts, never on the rounded pct) — forced categorical boundary cases used instead | n/a — no iterative solver | 3/3 pass |
| 7 | `art-535-fdic370-output-file-validator` | `10cb82f1a665d074500af23e512217234c39f79ad7f298e6f12a74eab4e2eeae` | no (row correct) | n/a (float:no, direct read confirmed — kernel's own docstring: "No floating point arithmetic is performed anywhere in this file") — forced categorical boundary cases used instead | n/a — no iterative solver | 4/4 pass |
| 8 | `art-536-reg-w-affiliate-transaction-tester` | `97f5aa7c56c8afd1021f3e175b556a66dfbbf632cee7c0f9f88cf0752eae17a4` | **yes — CORRECTED (row said no)** | **yes** — `single_affiliate_limit_amount`/`aggregate_limit_amount`/`required_collateral` r2-rounded thresholds forced at exact boundary ±0.01/±EPSILON, capital_base/pct producing repeating-binary-fraction limits, null collateral_value, non-numeric amount coerced to 0 | n/a — no iterative solver | 4/4 pass |
| 9 | `art-537-qfc-recordkeeping-file-validator` | `c7d0608caf559ede9bf75c63cee44bcc4cda97cc043ea6c689707e0e956709b9` | no (row correct) | n/a (float:no, direct read confirmed — kernel's own docstring: "No floating point arithmetic is performed anywhere in this file", explicitly reusing art-535's discipline) — forced categorical boundary cases used instead | n/a — no iterative solver | 4/4 pass |
| 10 | `art-538-custody-segregation-ratio` | `8791e2f24a2de92cbb8f32606cebc9fae0e42650fa20eecd57129ecd6c2fd8a8` | **yes** (row correct) | **yes** — the FULLY/UNDER_SEGREGATED 1.0 threshold and the caller-declared over_segregation_ceiling threshold both forced at exact boundary/±0.01, MIN_VALUE/EPSILON/-0 amounts, zero-claims declared-null edge, an x/y·y≠x-shaped 1/3 case | n/a — no iterative solver | 4/4 pass |

**⛔⛔ 5 OF 10 FLOAT-SENSITIVITY CLASSIFICATIONS WERE CORRECTED FROM THE WU ROW'S OWN TRIAGE TABLE, per
FIX-2 direct-source-read discipline — the largest single-shard correction count measured to date on this
campaign:**
- **4 corrected from float:yes → float:no** (`art-529`, `art-530`, `art-532`, `art-533`): three of the
  four kernels carry an explicit docstring statement — "No floating-point arithmetic in compute()" /
  "There is no floating-point arithmetic in compute()" — that the WU row's triage table did not account
  for; the fourth (`art-533`) uses a day-count `Math.floor(ms_diff/86400000)` pattern structurally
  identical to two already-confirmed float:no kernels elsewhere in this codebase (`art-402`, `art-387`).
- **1 corrected from float:no → float:yes** (`art-536`): unlike its money-math siblings in this same
  shard (all of which use integer minor units), `art-536` takes raw `Number(v)` amounts with no integer
  coercion and genuinely divides (`capital_base * (pct/100)`), with every resulting r2-rounded value
  feeding a direct threshold-breach comparison — ULP-boundary forcing was entirely absent before this
  shard and is now present (row 8 above).
- The other 5 kernels' classifications matched the WU row and required no correction.
**Final count for this shard: 3 of 10 float-sensitive** (`art-528`, `art-536`, `art-538`), all with ULP
forcing present, versus the WU row's original (incorrect) 6-of-10 split.

**FIX-2 secondary finding, `art-538-custody-segregation-ratio` (documented, not a defect):** permutation
testing (P4) empirically found that reordering `segregated_assets[]`/`customer_claims[]` can shift a
`total_segregated_musd`/`total_claims_musd` display total by exactly one cent (38 occurrences across 1397
trials) — genuine IEEE-754 summation non-associativity surfacing through the kernel's single
end-of-reduce `r2()` rounding, not a test artifact and not a kernel defect (the underlying unrounded sums
differ by far less than 1e-9; only the display-rounding boundary occasionally flips). This is further
empirical evidence for `art-538`'s float:yes classification. The property file's own P4 comment carries
the full reproduction; the check is tolerant at the kernel's own 1-cent rounding granularity (compared in
integer cents to avoid float-subtraction representation noise in the test itself) and would still catch
any larger, genuine order-dependence.

**Termination:** every kernel's compute loop is bounded by a caller-supplied array length (fields,
segregated_assets/customer_claims, positions/collateral, issues/milestones, sampled_items, transactions,
file_records, members/stress_scenarios) or by the fixed 5-stage waterfall-structure set (`art-529`). No
kernel in this shard is an iterative numeric solver, so the class-C "convergence-or-report" property is
confirmed not applicable for all 10 (stated per-item above, not assumed).

**§25 private-input node (`art-529-ccp-default-waterfall-recompute`):** the real waterfall recompute lives
in `buildArtifact()`, which takes the plaintext member-level witness (defaulter IM, defaulter default-fund
contribution, surviving-member default-fund pool, salt) and commits it via `sha256-salted@1` — never
echoed in `policy_parameters`/`output_payload`. The fixture-oracle gate runs `buildArtifact()` against the
plaintext witness in the `.disclosure.json` sidecar (same shape as `art-413`/`art-415`), and a dedicated
P0 property confirms the decoy `compute(pp)` export never leaks a verdict from `policy_parameters` alone
(SPEC.md §18.3).

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
