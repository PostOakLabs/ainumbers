# FV-PROPFLOOR-SHARD-C13-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files below claim totality or formal correctness. `art-326-tvm-xirr`'s
bisection root-find over irregularly-dated cash flows made it the single most tempting kernel in this
shard to over-claim on; the floor here states its iteration cap and convergence-or-report contract, and
stops there.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C13-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file
floor properties themselves (termination bound, boundedness, differential/metamorphic checks, and — for
the 3 float-sensitive kernels — mandatory ULP-boundary forcing). No row received deeper manual review
beyond this mechanical gate; the signer's attestation, when it is added, covers exactly this basis and no
more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-274-compile-work-mandate` | `dfaeb21e94c9b39448879e93b1365cb0b50c1251a16b57a90133275b8739d6ad` | no | n/a (float:no, direct read confirmed — array-length index math, string pointer equality, integer checkpoint arithmetic only) | n/a — no iterative solver | 3/3 pass |
| 2 | `art-275-genius-reserve-disclosure-checker` | `0f28358a1106be5fd951174ff9984a32af17133642481706a056f43ce6fe0d22` | **yes** | **yes** — coverage-ratio=1 boundary, ±1 ULP, zero/-0/denormal/huge values, and the 20%-swing threshold forced | n/a — no iterative solver | 5/5 pass |
| 3 | `art-278-reputation-score-aggregator` | `7d2c98e83ecc6bbe23df123d45d26fe3f2b31d5dc6484e5983f535fdbd271c86` | **yes** | **yes** — dims extremes incl. ±0/EPSILON/denormals, decay half-life underflow, weight_hint denormals, ±0.5 compliance-flag threshold forced (at the kernel's actual `.toFixed(6)`-observable resolution, not raw EPSILON, per a real absorption effect the property file states explicitly) | n/a — no iterative solver | 5/5 pass |
| 4 | `art-279-state-proof-verifier` | `cdf00978c1f9c8e64aa49fd927d7dab925a232f49b3f745381396674785ce592` | no | n/a (float:no, direct read confirmed — pure byte/nibble/uint32-lane bitwise Keccak-f[1600] + RLP/hex-prefix decode, no float ops) | n/a — no iterative solver | 4/4 pass |
| 5 | `art-280-reserve-proof-verifier` | `309081fd66892352af23884e11bc1173c96b88fc3bbebe8ffce1db60bb235dba` | no | n/a (float:no, direct read confirmed — Merkle-sum walk + hand-rolled SHA-256 hex hashing over integer/whole-USD Numbers) | n/a — no iterative solver | 5/5 pass |
| 6 | `art-284-did-webvh-log-verifier` | `e224c8b26c16b08b7d1cbb8bd0c036358387aa3c7c091ba3cd25f769c2d5d888` | no | n/a (float:no, direct read confirmed — JCS-canonicalize + SHA-256 self-hash + regex versionId parse + Ed25519 verify, no float arithmetic) | n/a — no iterative solver | 5/5 pass |
| 7 | `art-285-acdc-delegation-chain-verifier` | `c2e7514896d7266effdbb7716fefc7f39377a555f3f45bb847ec9250a184c7db` | no | n/a (float:no, direct read confirmed — string/hash equality checks and array-length bound math only) | n/a — no iterative solver | 5/5 pass |
| 8 | `art-286-anchored-extract-verifier` | `7532df2eced1bf011b8bb608c7ca0038e116d7d554d5439e90d09905d997091c` | no | n/a (float:no, direct read confirmed — SHA-256 bitwise arithmetic and string-equality anchor-class dispatch only) | n/a — no iterative solver | 7/7 pass |
| 9 | `art-288-map-iso20022-to-evm-calldata` | `c434dd10ec7cc8e96757d0f1679f3dc90861bb065ca053bfa7646a8afa6e0a6c` | no | n/a (float:no, direct read confirmed — decimal-to-minor-units conversion is string/regex-based via `toUint256MinorUnits`, never a float parse/compare) | n/a — no iterative solver | 2/2 pass |
| 10 | `art-326-tvm-xirr` | `3248ec11b6d575a1795556fc220cc80b0f59b917cf7753117589a66df18b53a6` | **yes** | **yes** — tolerance 0/-0/EPSILON/near-threshold/denormal/1e-300 forced, plus bracket-edge and same-date (zero-elapsed-time) forcing | **explicit, mandatory, stated below** — bisection root-find over irregularly-dated cash flows with a hard `max_iterations` cap; asserted both that `iterations` never exceeds the cap and that non-convergence is always reported (`converged:false`) rather than silently truncated, including a deliberately pathological 2-iteration case AND an all-inflow no-sign-change-in-bracket case | 1/1 pass |

**3 of 10 kernels are float-sensitive** (`art-275`, `art-278`, `art-326`) — this matches the WU row's own
triage-table classification (3/10), and each was independently re-confirmed against its own `.kernel.mjs`
source per FIX-2 discipline rather than inherited uncritically. No corrections were needed. ULP-boundary
forcing (threshold ±1 ULP, 0, negative zero, denormals, `x/y*y !== x`-shaped cases) is present in all 3.
The other 7 kernels use forced categorical boundary cases in place of ULP-forcing, per spec §3's float:no
row.

**Termination:** every kernel's compute loop is bounded by a caller-supplied array length (mandate steps,
asset arrays, attestations, proof nodes, storage slots, Merkle proof path, log entries, delegation chain,
anchor path, cash_flows) or by a fixed small enum/config table. **`art-326-tvm-xirr` is the one exception
requiring its own explicit statement**: it is an iterative bisection solver over irregularly-dated cash
flows, and its termination bound is not the input array length but the caller-declared `max_iterations`
hard cap — `iterations` never exceeds that cap in any trial run (including the deliberately pathological
2-iteration and no-sign-change cases), and the kernel's own bounded iteration loop makes this a structural
(not merely observed) guarantee. **The "convergence-or-report" property (§3, class C) is therefore
CONFIRMED APPLICABLE AND TESTED for `art-326` alone in this shard** (the other 9 kernels have no
iterative solver and the property is confirmed not applicable for them, stated per-item above).

**Differential/metamorphic checks** were applied where the kernel's shape made one cheap to construct:
tamper-flips-verdict and truncation-never-falsely-validates checks for the four chain/log/proof verifier
kernels (`art-280`, `art-284`, `art-285`, `art-286`), permutation-invariance of the attestations array for
`art-278`, single-nibble-tamper-never-verifies plus repeat-call determinism for `art-279`, and
determinism/multi-pointer-rejection checks for `art-274`.

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above, including `art-326-tvm-xirr` despite
its solver shape being the most tempting one in the shard.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row). Confirmed via
`node scripts/check-fv-floor-coverage.mjs --summary` on this branch: live kernels: 588, floored: 403
(393 pre-existing + these 10 new). `node scripts/run-proptests.mjs` passes 409/409.

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
