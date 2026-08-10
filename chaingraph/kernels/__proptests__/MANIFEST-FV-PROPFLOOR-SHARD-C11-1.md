# FV-PROPFLOOR-SHARD-C11-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness. `art-325-tvm-irr`'s
bisection solver shape made it the single most tempting kernel in this shard to over-claim on; the floor
here states its iteration cap and convergence-or-report contract, and stops there.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C11-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file
floor properties themselves (termination bound, boundedness, differential re-derivation,
metamorphic/permutation-invariance checks, and — for the 4 float-sensitive kernels — mandatory
ULP-boundary forcing). No row received deeper manual review beyond this mechanical gate; the signer's
attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-307-claim-dispute-bundle-builder` | `1daef6202ad1566e6f94d6f395e4e645e4d15288589e2864a84c2c2e33415211` | no | n/a (float:no, direct read confirmed — averaging feeds a plain threshold compare, no ULP-boundary claim made) | n/a — no iterative solver | 3/3 pass |
| 2 | `art-308-pld-disclosure-pack-builder` | `4d73f240d1e0e36ad7081116436c2a27d5b2c23d184cc4269306079ed753ccfb` | no | n/a (float:no, direct read confirmed — string sort/join and array filter only) | n/a — no iterative solver | 3/3 pass |
| 3 | `art-309-parametric-index-deriver` | `69501cd554f59d8ca92176964a10773dad63d5b7c1e4ae06af5eda6fbe9d29c6` | **yes** | **yes** — 0/-0/±ULP/denormal/x·y÷y≠x forced across all 5 aggregation modes | n/a — no iterative solver | 6/6 pass |
| 4 | `art-31-a2a-x402-extension-mandate-validator` | `8136ed46e50029be28e18bd1ec82e60c057b1b12a749df5dc4f847a012b5dddf` | no | n/a (float:no per WU triage, direct read confirmed — the one numeric compare (CON-01) uses a fixed 1e-9 tolerance constant, floored via forced categorical boundary cases instead of an ULP claim) | n/a — no iterative solver | 1/1 pass |
| 5 | `art-317-rhc-multiplier-reconciler` | `429e977403062feed23c749598080acc370be7c4fbe83704b1c1884bccc3a94f` | **yes** | **yes** — ±EPS(1e-9)/0/-0/denormal forced around the ratio_match threshold | n/a — no iterative solver | 3/3 pass |
| 6 | `art-318-rhc-regime-mapper` | `a254b7eb00a32b29a66ec968198d5fcaf29bff88a1a9881739f2a25b5ec59856` | no | n/a (float:no, direct read confirmed — pure string-equality/Array.includes boolean logic, no arithmetic) | n/a — no iterative solver | 2/2 pass |
| 7 | `art-32-a2a-agent-card-trust-chain-validator` | `b559ef728aacf8aa3f1ee6cb9db684bf7b32b917bafcbcacb0cc88c16c76c008` | no | n/a (float:no, direct read confirmed — string/array/boolean logic, integer day-count compare only) | n/a — no iterative solver | 1/1 pass |
| 8 | `art-322-rhc-ap-redemption-stress` | `043b1b5c17986181cd446d5ffa5594209cc4cf4e29416c72e3a47a436160ea2d` | no | n/a (float:no, direct read confirmed — fixed-integer threshold compare (100000) only, floored via forced categorical boundary case) | n/a — no iterative solver | 2/2 pass |
| 9 | `art-324-tvm-npv` | `73ed269fd294aec7d9ff692c40383f59d38689eac424726d8c135c52ff8c78a2` | **yes** | **yes** — rate=-1/±ULP/0/-0/denormal forced, plus t-offset denormal forcing | n/a — no iterative solver (closed-form summation, deterministic Taylor-series `myPow`) | 4/4 pass |
| 10 | `art-325-tvm-irr` | `ce6c2877623d0c8092e2ec9a670ce48ce411824ec8006e77f813ecce62070b6d` | **yes** | **yes** — tolerance 0/-0/±ULP/denormal forced, plus bracket-edge forcing near the known root | **explicit, mandatory, stated below** — bisection over a declared `[bracket_lo, bracket_hi]` with a hard `max_iterations` cap; asserted both that `iterations` never exceeds the cap and that non-convergence is always reported (`converged:false`) rather than silently truncated, including a deliberately pathological 2-iteration case | 2/2 pass |

**4 of 10 kernels are float-sensitive** (`art-309`, `art-317`, `art-324`, `art-325`) — this matches the
WU row's own triage-table classification (4/10), and each was independently re-confirmed against its own
`.kernel.mjs` source per FIX-2 discipline rather than inherited uncritically. No corrections were needed.
ULP-boundary forcing (threshold ±1 ULP, 0, negative zero, denormals, `x/y*y !== x`-shaped cases) is
present in all 4 property files. The other 6 kernels use forced categorical boundary cases in place of
ULP-forcing, per spec §3's float:no row.

**Termination:** every kernel's compute loop is bounded by a caller-supplied array length (receipts,
event_log, target_jurisdictions, skills, delegation_chain, authorised_participants, cash_flows) or by a
fixed small set of known check-code/enum tables (PRESUMPTION_TRIGGERS, AGGREGATIONS, CARD field lists).
**`art-325-tvm-irr` is the one exception requiring its own explicit statement**: it is an iterative
bisection solver, and its termination bound is not the input array length but the caller-declared
`max_iterations` hard cap — `iterations` never exceeds that cap in any of the 4,001 trials run, and the
kernel's own `for (iter = 1; iter <= maxIterations; iter++)` loop makes this a structural (not merely
observed) guarantee. **The "convergence-or-report" property (§3, class C) is therefore CONFIRMED
APPLICABLE AND TESTED for `art-325` alone in this shard** (the other 9 kernels have no iterative solver
and the property is confirmed not applicable for them, stated per-item above).

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above, including `art-325-tvm-irr` despite
its solver shape being the most tempting one in the shard.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row). Confirmed via
`node scripts/check-fv-floor-coverage.mjs --summary` on this branch: live kernels: 582, floored: 209
(199 pre-existing + these 10 new). `node scripts/run-proptests.mjs` passes 229/229.

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
