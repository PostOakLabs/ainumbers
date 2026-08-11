# FV-PROPFLOOR-SHARD-C9-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C9-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file
floor properties themselves (termination bound, boundedness, decision-table/differential re-derivation,
metamorphic/permutation-invariance checks, and mandatory ULP-boundary forcing for the 3 float-sensitive
kernels). No row received deeper manual review beyond this mechanical gate; the signer's attestation,
when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-268-compute-cdd-ownership-25pct` | `72d31eade30d2b17b71e7c4f70b150a51b2415b2950b8b4a5240eb92f8bec23a` | **yes** | present — 25% threshold: exact/±1ULP, 0, negative-zero, denormal (5e-320) | n/a — no iterative solver; recursion is memoized + cycle-guarded, bounded by distinct entity count | 2/2 pass |
| 2 | `art-274-compile-work-mandate` | `ea85405e77c5118fc3a13920831a7ff78212bceecaff1c5fb9ac01473ffe343b` | no | n/a (float:no, direct read confirmed — pure structural transform, only arithmetic is integer array-index math); forced categorical cases used instead | n/a — no iterative solver | 3/3 pass |
| 3 | `art-275-genius-reserve-disclosure-checker` | `421d77f3a3fe5502015611da58ebfbd257190a4016adad518ddd32dea7e1bfd0` | **yes** | present — coverage-ratio 100% threshold: exact, ±1ULP, zero-liabilities guard, negative-zero, denormal | n/a — no iterative solver, all loops bounded by assets.length | 5/5 pass |
| 4 | `art-278-reputation-score-aggregator` | `850b121b034535af7d822a1c012531859fee30aa0dedfdac945790272d446068` | **yes** | present — ±0.5 composite threshold: exact, ±1ULP, zero/negative-zero half-life guard, denormal dims, out-of-range clamp | n/a — no iterative solver, decay weighting is a closed-form per-item computation, not a solver loop | 5/5 pass |
| 5 | `art-279-state-proof-verifier` | `caa5182df0a6f1fb56dbca66f0c08d5e4eb9988ba471c5b427719273ea3d6632` | no | n/a (float:no, direct read confirmed — RLP/nibble/keccak bitwise walk, no floats); forced categorical cases used instead | n/a — no iterative solver; **verifier kernel**: walk loop bounded by `proofNodes.length`, hard-capped at MAX_PROOF_NODES=32 before the walk starts, no recursion | 4/4 pass |
| 6 | `art-280-reserve-proof-verifier` | `9a44a8b6d21f0ba1ee172222c28125d7263777d94f96a76bc65393e293655f09` | no | n/a (float:no, direct read confirmed — Merkle-sum walk is integer/decimal sum + string hash, no float comparator); forced categorical cases used instead | n/a — no iterative solver; **verifier kernel**: walk loop bounded by `path.length`, hard-capped at MAX_PATH_DEPTH=40 before the walk starts, no recursion | 5/5 pass |
| 7 | `art-284-did-webvh-log-verifier` | `97e3a600e8c080411e3c7477f14202093f2f440ff63e7f4658c9ca832ff5e803` | no | n/a (float:no, direct read confirmed — regex/string parsing and integer sequence compare only); forced categorical cases used instead | n/a — no iterative solver; **verifier kernel**: single-pass loop bounded by `boundedLog.length` = min(input length, max_entries, HARD_MAX_ENTRIES=500), no recursion | 5/5 pass |
| 8 | `art-285-acdc-delegation-chain-verifier` | `58fc9897fea15f5879a213626ec451bbb0cff2e91ceb475bd0f833684244bbcb` | no | n/a (float:no, direct read confirmed — SAID/edge string-equality checks only); forced categorical cases used instead | n/a — no iterative solver; **verifier kernel**: two flat loops each bounded by `bounded.length` = min(credentials.length, max_chain_depth, HARD_MAX_DEPTH=50), no recursion | 5/5 pass |
| 9 | `art-286-anchored-extract-verifier` | `7934427c04943b1f295a5d7e95cb214c7d73be32aeb2262a89791462f513a9af` | no | n/a (float:no, direct read confirmed — SHA-256 bitwise Merkle walk + string-equality anchor-class dispatch, no floats); forced categorical cases used instead | n/a — no iterative solver; **verifier kernel**: walk loop bounded by `path.length`, hard-capped at MAX_PATH_DEPTH=40 before the walk starts, no recursion | 7/7 pass |
| 10 | `art-288-map-iso20022-to-evm-calldata` | `4181a160659a5d2f880b1fd8bce92735686ae56106b8b90c584c8eda135a059b` | no | n/a (float:no, direct read confirmed — string coercion/lookup only, amount handling is regex/string-based minor-unit conversion, never a float parse) | n/a — no iterative solver, loop bounded by caller-supplied ABI-input array length | 2/2 pass |

**3 of 10 kernels are float-sensitive** (`art-268`, `art-275`, `art-278`) — this matches the WU row's own
triage-table classification, and each was independently re-confirmed against its own `.kernel.mjs` source
per FIX-2 discipline rather than inherited uncritically. No corrections were needed. All 3 received
mandatory ULP-boundary forcing (threshold ±1 ULP, 0, negative zero, denormal-scale values) per spec §3.
The other 7 kernels are float:no and received forced categorical boundary cases in place of ULP forcing.

**Termination (verifier-kernel bound argument, per WU row instruction):** `art-279`, `art-280`, `art-284`,
`art-285`, and `art-286` are chain/proof-walk verifier kernels. Each was independently checked for its
own bound: none use recursion — every walk is a single bounded `for` loop whose iteration count is
capped by an explicit constant checked *before* the loop starts (MAX_PROOF_NODES=32 for art-279,
MAX_PATH_DEPTH=40 for art-280 and art-286, HARD_MAX_ENTRIES=500 for art-284, HARD_MAX_DEPTH=50 for
art-285). `art-268`'s recursion (indirect-ownership walk) IS bounded differently — memoized + a
cycle-guard `Set`, so depth is bounded by the number of distinct entity ids, never by an explicit
constant, and this distinction is stated per-item in the manifest table rather than assumed uniform
across the shard. The remaining 4 kernels (`art-274`, `art-275`, `art-278`, `art-288`) have no
recursion and no chain-walk — their termination bound is a flat array-length loop, confirmed
NOT APPLICABLE for the class-C "convergence-or-report" property (no iterative numerical solver in any
of the 10), stated per-item above rather than assumed absent.

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row). Confirmed via
`node scripts/check-fv-floor-coverage.mjs --summary` on this branch: all 10 kernels above are FLOORED
(kernel_digest_at_authoring header matches current kernel source for each — live: 582, floored: 179,
including 169 pre-existing + these 10 new). `node scripts/run-proptests.mjs` passes 199/199.

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
