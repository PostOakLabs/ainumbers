# FV-PROPFLOOR-SHARD-C2-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C2-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file
floor properties themselves (termination bound, boundedness, decision-table/differential re-derivation,
metamorphic/permutation-invariance checks, and — for every float-sensitive row — explicit ULP-boundary
forcing at the kernel's own documented threshold constants). No row received deeper manual review beyond
this mechanical gate; the signer's attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-10-amla-transaction-typology-risk-scorer` | `c02483af798b9da4593d70b071619e12487bbd02e21b016eb9d46ced84c5ab90` | yes | yes (P5, 9 forced cases) | n/a — no iterative solver | 1/1 pass |
| 2 | `art-11-vop-batch-match-rate-analyser` | `dc6cecdac12b5053afc065404fa713ef895d66b7721806ce245957a45a7011c6` | yes | yes (P5, 5 forced cases, using the kernel's own exact-match/empty-string special cases) | n/a — no iterative solver | 3/3 pass |
| 3 | `art-102-crypto-asset-whitepaper-linter` | `0d1c9a8705e0308f72420985fe902d83fa6bf9181650ec1939bfcc4d60dfd150` | no | n/a (float:no exception, per WU row) | n/a — no iterative solver | 1/1 pass |
| 4 | `art-104-tfr-travel-rule-batch-validator` | `5d9d7105b7d6a2e1265f3c02ee2c2b2bb573c7d0e5fc816dac04771392117b30` | no | n/a (float:no exception, per WU row) | n/a — no iterative solver | 1/1 pass |
| 5 | `art-106-tempo-subscription-reconciler` | `1995b8044643af3b0040b0141b607050d90479fefaa911f9b9134eecc99cf250` | yes | yes (P5, 8 forced cases) | n/a — no iterative solver | 2/2 pass |
| 6 | `art-109-dtc-tokenized-treasury` | `1064b510a277f498468a1e9a05d051d01137cda668f04abae974c0db753376fc` | no | n/a (float:no exception, per WU row) | n/a — no iterative solver | 2/2 pass |
| 7 | `art-110-arc-partner-stablecoin-onboarding` | `4c76567c95da056626e68881f858c95c745ad333d94f0fbe078b53ac95ca3f49` | no | n/a (float:no exception, per WU row) | n/a — no iterative solver | 2/2 pass |
| 8 | `art-111-arc-corridor-jurisdiction-router` | `71061d2cb76db82787091a1621aabb6fdba5b88d31db5d6b378f9ea1b5826f72` | no | n/a (float:no exception, per WU row) | n/a — no iterative solver | 2/2 pass |
| 9 | `art-116-product-lineage-builder` | `c90285303f490a09ce2e73fc197bc99fb23ca31e2db96426f18f373ba021c574` | yes | yes (P5, 5 forced cases) | n/a — no iterative solver | 1/1 pass |
| 10 | `art-117-product-authenticity-verifier` | `eccd83a646d2c8ea26dd08a3afd2982697f9bef25047dba10eff238e27f185d4` | no | n/a (float:no exception, per WU row) | n/a — no iterative solver | 2/2 pass |

**4 of 10 kernels are float-sensitive** (art-10, art-11, art-106, art-116) — ULP-boundary forcing present
in every one, per this shard row's own mandatory instruction. **6 are the WU row's declared float:no
exceptions** (art-102, art-104, art-109, art-110, art-111, art-117) — no ULP-forcing required or
attempted for those.

**Termination:** every kernel's compute loop is bounded by the caller-supplied array length (transactions,
payees, transfer_batch, draws, stages, corridor_legs, ownership_transfers) or by a fixed small set of
known enum/category values (REQUIRED_SECTIONS, REQUIRED_LIFECYCLE_EVENTS, REGIME_TABLE). None of the 10
contain an iterative numerical solver; **the "convergence-or-report" property (§3, class C) is therefore
confirmed NOT APPLICABLE for all 10 kernels in this shard**, stated per-item above rather than assumed
absent.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row). Confirmed via
`node scripts/check-fv-floor-coverage.mjs --summary` on this branch: all 10 kernels above are FLOORED
(kernel_digest_at_authoring header matches current kernel source for each), and `node
scripts/run-proptests.mjs` passes 41/41 (10 new + 31 pre-existing).

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
