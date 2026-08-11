# FV-PROPFLOOR-SHARD-C20-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C20-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file
floor properties themselves (termination bound, boundedness, differential re-derivation,
metamorphic/permutation-invariance checks, and — for the 9 float-sensitive kernels — mandatory
ULP-boundary forcing). No row received deeper manual review beyond this mechanical gate; the signer's
attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | fixture_oracle |
|---|---|---|:---:|:---:|:---:|
| 1 | `art-426-cecl-ecl-calculator` | `9a98c77973cb3285c9bdfc463a55813e7c81982d27ba8f46b0ade1ff92962b75` | **yes** | **yes** — clamp01 boundary (0/-0/1/±ULP/denormal) forced across all 3 methods (warm/dcf/loss_rate) | 4/4 pass |
| 2 | `art-427-discount-window-capacity` | `b7fb2d160f36179a5229300a2a696fd22589ca237f2ab5083b3c816b61e48e16` | **yes** | **yes** — margin_pct clamp(0,100) boundary + zero-denominator coverage_pct gate forced, incl. negative-zero | 3/3 pass |
| 3 | `art-429-var-backtest-traffic-light` | `765f96e73a152b3b54b409f6389b9a7d6e0ec513b97865360a1c824db24a8fd3` | no | n/a (float:no, direct read confirmed — strict `<` integer exception count feeding a fixed lookup table, no rounding/division) — forced categorical boundary cases used instead (exception_count 0/4/5/9/10/11/250, the exact Basel zone edges) | 3/3 pass |
| 4 | `art-431-fdic-assessment-rate-calculator` | `89a1737e3b746125d8176caaca4b49f654b15ce9bb4aa31d36623864a5faf5b7` | **yes** | **yes** — total_score clamp(0,100) boundary + floor/cap clamp boundary forced (0/-0/±ULP/denormal) | 3/3 pass |
| 5 | `art-437-fr2052a-inflow-outflow-classifier` | `1b70870b6e84023dbc3139967374e5aeede9b27bf5de515017554704d04a17e5` | **yes** | **yes** — maturity_days <= max_days bucket-boundary compare forced (0/-0/±ULP/denormal) | 3/3 pass |
| 6 | `art-442-nmd-behavioral-repricing-mapper` | `8ebc318c72c432a4069b429e0d8e6a46991ee35df7fd9c6b7148e1ff8960606d` | **yes** | **yes** — clamp01(beta/allocation) boundary + ALLOC_TOLERANCE (0.001) sums-to-one boundary forced | 3/3 pass |
| 7 | `art-443-irrbb-basis-risk-nii-shock-calculator` | `701a0152c59e366809bea8593b240c652e7c3c3986993f5d2c0c185ed03e621e` | **yes** | **yes** — zero-parallelNii denominator gate + materiality-threshold boundary forced (0/-0/±ULP) | 3/3 pass |
| 8 | `art-444-collateral-haircut-engine` | `df45ee6bf180aaff93ab11fb4ecc6a162319842bc3a73ca432dc90d14c931a67` | **yes** | **yes** — timeScale(holding_period_days) boundary (0/-0/±ULP/denormal) + 100%-combined-haircut clamp forced | 3/3 pass |
| 9 | `art-445-credit-concentration-topn-sector` | `e804851599dab3fed1edcc45f8351fb75a7af0de1ac4bd7b51a21ac32c34cfee` | **yes** | **yes** — zero-portfolio denominator gate + single-name/sector limit-breach threshold boundary forced | 4/4 pass |
| 10 | `art-446-counterparty-internal-limit-check` | `4b222e099bedce272b5741a1299c63886b19820ad6192e036157660ee061fa9c` | **yes** | **yes** — zero-approved-limit denominator gate + breach (`>`) and warning (`>=`) threshold boundaries forced (0/-0/±ULP) | 4/4 pass |

**9 of 10 kernels are float-sensitive** (`art-426`, `art-427`, `art-431`, `art-437`, `art-442`, `art-443`,
`art-444`, `art-445`, `art-446`) — this matches the WU row's own triage-table classification (9/10), and
each was independently re-confirmed against its own `.kernel.mjs` source per FIX-2 discipline rather than
inherited uncritically. No corrections were needed. ULP-boundary forcing (threshold ±1 ULP, 0, negative
zero, denormals, `x/y*y !== x`-shaped cases) is present in all 9. The remaining kernel
(`art-429-var-backtest-traffic-light`) uses forced categorical boundary cases at the exact Basel
green/yellow/red zone edges in place of ULP-forcing, per spec §3's float:no row.

**Termination:** every kernel's compute loop is bounded by a caller-supplied array length (segments,
scenarios, collateral_positions, runnable_liabilities, observations, rate_brackets, rows,
nmd_segments, index_exposures, collateral_items, exposures, counterparties). No kernel in this shard
contains an iterative solver — the convergence-or-report property (§3, class C) is **confirmed NOT
APPLICABLE for all 10 kernels in this shard**, stated per-item in each file's header comment.

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
