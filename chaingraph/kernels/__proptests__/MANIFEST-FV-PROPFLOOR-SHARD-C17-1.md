# FV-PROPFLOOR-SHARD-C17-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C17-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function, matching the header
comment in each `.proptest.mjs` file).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output (or, for `art-371`/`art-376`, `compute()`'s return value
directly, since those two kernels return the flat result object as the output_payload with no
`{output_payload, compliance_flags}` wrapper — confirmed by direct read and cross-checked against the
fixture file's own shape; and for `art-377`, its async `buildArtifact()` output, since `compute()` alone
leaves `session_receipts`/`chain_genesis_hash`/`final_receipt_hash` null pending WebCrypto hash-chaining)
diffed against every vector in that kernel's own `chaingraph/kernels/fixtures/<id>.fixtures.json`,
pass/fail recorded per file; (2) the property-file floor properties themselves (termination bound,
boundedness, metamorphic/permutation-invariance/symmetry/tamper-evidence checks as applicable, and — for
the 6 float-sensitive kernels — mandatory ULP-boundary forcing). No row received deeper manual review
beyond this mechanical gate; the signer's attestation, when it is added, covers exactly this basis and no
more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | termination/convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-365-compute-globe-topup-tax` | `61005e8a2c5064428596c27408e9e130d086857f783b8cee8cead6c131883589` | **yes** | **yes** — 0/-0/±ULP/denormal forced independently on `income` and `taxes` around the GLOBE_MIN_RATE 0.15 ETR threshold, and on `payroll`/`assets` feeding SBIE (denormal-vs-eps combined magnitude-mismatch overflow explicitly excluded as a distinct, non-ULP concern — see file header note) | n/a — no iterative solver; termination bounded by the caller-supplied `jurisdictions` array length (single map/reduce pass, no recursion) | 3/3 pass |
| 2 | `art-368-compute-fx-netting-positions` | `665538f1e6305877bc876b3bd1bf4fcc797a890efabe8855d1dd82f9375af8ce` | **yes** | **yes** — 0/-0/±ULP/denormal forced on `spot` (incl. non-positive-spot compliance-flag boundary), `fwd_bps`, and `vol_30d` | n/a — no iterative solver; termination bounded by the caller-supplied `positions` array length (single map/reduce pass, no recursion) | 3/3 pass |
| 3 | `art-369-run-rate-shock-ladder` | `de868c58a20dd6f595ff271e2b5eb0aef3b83b50ba4c011b4cb0cbd7adf2e5a8` | **yes** | **yes** — 0/-0/±ULP/denormal forced on all 6 `repricing_gaps` bucket values and `nii_12m_gap` | n/a — no iterative solver; termination bounded by the fixed 6-bucket/4-magnitude ladder (compile-time bounded) plus the caller-supplied `shock_presets` array length (unbounded, tested up to 300 elements) | 3/3 pass |
| 4 | `art-371-simulate-var-monte-carlo` | `a17b594a1ac141b237872b6bfe650a14016c9345d353a15e811ee5fd929c7d40` | **yes** | **yes** — 0/-0/±ULP/denormal forced on `correlation` at its `[0,0.95]` clamp boundary and on `portfolio_value_mm` | **HARD-CLAMP termination, proven structurally**: `n_paths`/`n_assets` caller inputs are clamped to `[100,20000]`/`[2,10]` BEFORE the simulation loop runs — proven with `n_assets=1e9`/`n_paths=1e9` and negative/fractional inputs, all landing inside the clamped range every time. Plus a dedicated seed-determinism metamorphic property (identical `policy_parameters` incl. seed reproduce a byte-identical `output_payload` on repeat invocation). | 2/2 pass |
| 5 | `art-373-recompute-fund-nav` | `dd168befbc8f209ebaaead9384463b9db7403081df5a4d6573fa140e27518edf` | **yes** | **yes** — re-confirmed by direct read: arithmetic path is BigInt fixed-point (float-free), BUT the caller-input parse stage (`toFixed()`'s `String(value)`→decimal-regex) is float-sensitive at IEEE-754 boundary magnitudes; 0/-0/eps/denormal/1e21-scientific-notation forced on `quantity` and `price` independently (documented finding: scientific-notation inputs are silently coerced to `"0"` by the decimal-regex parse, never a throw/NaN — this is the caller-input-parse-boundary ULP concern for an otherwise float-free kernel) | n/a — no iterative solver; termination bounded by the caller-supplied `holdings`/`accruals`/`liabilities` array lengths (single map/reduce pass, no recursion) | 5/5 pass |
| 6 | `art-375-compute-fund-expense-ratios` | `d484127d5ba4c00d555525dc57dce0c6ca46b9b3858cac4067d8f34f6a408353` | **yes** | **yes** — same caller-input-parse-boundary concern and forcing as `art-373` (byte-identical `toFixed()`), applied to `average_net_assets`/`gross_expense_components[].amount`/`waivers[].percent`. ⛔ **Documented, not-clamped finding**: `percent_of_remaining` waivers with a declared `percent>1` (over 100%) are NOT clamped against the remaining base and drive `net_expense_total` negative — confirmed by direct execution and asserted as the expected (unclamped) behavior in a dedicated property, not silently ignored | n/a — no iterative solver; termination bounded by the caller-supplied `gross_expense_components`/`waivers` array lengths (single map/reduce pass, no recursion) | 6/6 pass |
| 7 | `art-376-score-payee-name-match` | `716f7830e5536a578ce53985898933e973e43e8cd13d2250c51fbf1b47a9ef7d` | no | n/a (float:no, direct read confirmed — score is an integer 0-100 via floor integer division only, no float comparison anywhere; forced categorical boundary cases used instead — empty strings, identical strings, entity-suffix stripping, diacritic normalization, disjoint strings, token-reorder) | n/a — no iterative solver; termination bounded by the O(la·lb) Levenshtein DP over the two caller-supplied string lengths (tested up to 2000-char strings, DP row-swap keeps memory bounded by `min(la,lb)+1`) | 7/7 pass |
| 8 | `art-377-build-vop-session-receipt` | `d619c9291ada5776fcb8a4c066262349bc41aaf73ab36c10e60ad02b0aa72b44` | no | n/a (float:no, direct read confirmed — string/enum normalization and hash chaining only; forced categorical boundary cases used instead — empty attempts, undeclared consumer_action, undeclared match_result.source, all four warning severities) | n/a — no iterative solver; termination bounded by the caller-supplied `attempts` array length (single map pass, `normalizeAttempt()` has no internal loop). **Plus a dedicated tamper-evidence differential property against the async `buildArtifact()` hash chain**: editing any single attempt changes every downstream `receipt_hash` and leaves every prior receipt's hash unchanged; two sessions with byte-identical first attempts but distinct `session_id` diverge from receipt #0 (genesis-anchoring, exercised directly, not merely asserted) | 4/4 pass (via `buildArtifact()`, not `compute()` alone — see basis-of-review note above) |
| 9 | `art-378-quarterly-test-evidence-composer` | `a211c8ebffdf9378aeb958e003bbee2077aa0a667c4db474e3fa5c0ae6e60e1a` | no | n/a (float:no, direct read confirmed — `pass_rate=passed/total` is the only division, used ONLY in a sign compare (`delta<0`), never an equality/ULP-sensitive threshold; forced categorical boundary cases used instead — empty tests array, forbidden `determinism_class` coercion, chain-tamper detection via `declared_prior_pack_digest` mismatch, regression-sign detection, `ha_evidence_bundle` presence gated on `subject_hash`) | n/a — no iterative solver; termination bounded by the caller-supplied `tests` array length (single map/reduce pass, no recursion) | 5/5 pass |
| 10 | `art-379-agent-incident-record-composer` | `6b17b7b3344b853baf9681947aab0c38ae76691022becffec36df51a5d0c5c79` | no | n/a (float:no, direct read confirmed — zero arithmetic, only string/enum normalization and a regex shape check; forced categorical boundary cases used instead — missing `agent_identity`, forbidden `severity_class`/`remediation.status` coercion, well-formed vs malformed cross-link hash shapes, mixed valid/invalid evidence array) | n/a — no iterative solver; termination bounded by the caller-supplied `session_evidence` array length (single filter pass, no recursion) | 4/4 pass |

**6 of 10 kernels are float-sensitive** (`art-365`, `art-368`, `art-369`, `art-371`, `art-373`, `art-375`)
— this matches the WU row's own triage-table classification (6/10) exactly, and each was independently
re-confirmed against its own `.kernel.mjs` source per FIX-2 discipline rather than inherited uncritically.
`art-373`/`art-375` were given particular scrutiny since both are BigInt fixed-point kernels explicitly
designed to be float-free in their arithmetic path — but the WU row's float:yes tag was confirmed correct
on direct read because the caller-INPUT parse stage (`toFixed()`) is itself float-sensitive at IEEE-754
boundary magnitudes (scientific-notation coercion-to-zero, confirmed by direct execution), which is
exactly the class of finding ULP-boundary forcing exists to surface. No corrections to the row's own
classification were needed. ULP-boundary forcing (threshold ±1 ULP, 0, negative zero, denormals,
`x/y*y!==x`-shaped cases) is present in all 6 float-sensitive property files. The other 4 kernels use
forced categorical boundary cases in place of ULP-forcing, per spec §3's float:no row.

**Termination:** 9 of the 10 kernels' compute paths are bounded by a caller-supplied array/string length
(jurisdictions, positions, shock_presets, holdings/accruals/liabilities, gross_expense_components/waivers,
the two Levenshtein string lengths, attempts, tests, session_evidence) — each tested at large sizes
(300-2000 elements/chars) with no timeout or unbounded growth. **One kernel required its own explicit
clamp-not-loop-length statement:** `art-371-simulate-var-monte-carlo`'s `n_paths`/`n_assets` are HARD
CLAMPED to `[100,20000]`/`[2,10]` before the simulation loop runs — proven structurally with
`n_assets=1e9`/`n_paths=1e9` and negative/fractional caller inputs, all landing inside the clamped range
every time (P1). Convergence-or-report is not applicable to any of the 10 kernels — none contains an
iterative numeric solver (bisection, Newton's method, or similar).

**Two documented (not remediated) findings, in scope for a FLOOR row per its own fence — no kernel edit
made:**
- `art-373-recompute-fund-nav`: caller-supplied `quantity`/`price` values that JS renders in scientific
  notation (e.g. `1e21`, `Number.MIN_VALUE`) are silently coerced to `"0"` by the fixed-point decimal-regex
  parse, rather than throwing or preserving magnitude. The kernel never crashes and every output stays a
  finite decimal string (P4 asserts exactly this — no throw, no NaN); the magnitude-fidelity loss itself is
  named here, not fixed.
- `art-375-compute-fund-expense-ratios`: a `percent_of_remaining` waiver with a declared `percent>1` (over
  100%) is not clamped against the remaining expense base and drives `net_expense_total` negative
  (confirmed by direct execution: `percent:1.5` on a $100k remaining base yields `remaining_after:
  "-50000.00000000"`). P3b asserts this actual (unclamped) behavior rather than a false
  always-non-negative invariant.

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
