# FV-PROPFLOOR-SHARD-C1-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C1-1`, enumerated below by kernel id and
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

| # | kernel_id | kernel_digest (`sha256:`) | proptest_file_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `504-settlement-risk-capital-optimizer` | `57a3a1bd70235be6b46ba6d177b784665e1480eb8f0c59047d84f3498611cfe8` | `46aaf601959dcedbdef6e663898e1b8f4410dd204c7949f660e2562da5537131` | yes | yes (P5, 5 forced cases) | n/a — no iterative solver | 1/1 pass |
| 2 | `509-canton-party-allowlist-validator` | `83887e461c79e0e1d5966dc6ad1887b4f0e205494e6dda2381001970b364930a` | `0c9ef42c117f1ff00e324149f2fee7315f0aa4c82892db138522d91063b53f16` | no | n/a (float:no exception, per WU row) | n/a — no iterative solver | 1/1 pass |
| 3 | `512-tokenized-security-lifecycle-validator` | `f17b5982d127f5ae1fcc3d3dc4be5844c49a6c73de4e12e41815b25215350270` | `d73735eabd88e1a7ffae0bfd947cc342a0d17bd72e5ff4dd21748ce4c97fa896` | no | n/a (float:no exception, per WU row) | n/a — no iterative solver | 1/1 pass |
| 4 | `513-margin-call-collateral-mobilizer` | `d7af04d366f7112be98e4d1735226212639a7f1ffcc97014858f47e83c9c79f3` | `169f24056367368232bd5e29650f2dac69d141b70c1937f5dce9ea6647924de4` | yes | yes (P5, 9 forced cases) | n/a — no iterative solver | 1/1 pass |
| 5 | `art-01-ap2-mandate-chain-validator` | `623495f9378cb65cb88c889831f43c2c82c8844af29dfaa32e3a5d1e6cfa5337` | `9af530db3ac45328934c583a5a0e978fa9eec93622183f39435885755f5d6546` | yes | yes (P4, 5 forced cases) | n/a — no iterative solver | 3/3 pass |
| 6 | `art-02-agent-spend-policy-simulator` | `236e163038383b05b4d5d18a1d3cf7d32a974a1035496ab1c00fbad3e84f412a` | `50b60ca72147239f6bb7900c0adb8ec4568eb7c564740dc03083da515842588c` | yes | yes (P5, threshold-classifier forced) | n/a — PRNG loop is bounded by clamped `n_txns` [10,2000], not iterative-convergent | 1/1 pass |
| 7 | `art-04-agent-identity-attestation-checker` | `f4e9e5aed913e80c7f97e3d0d2501e7349c523de4ffd433a1d29081620197b1f` | `47408ff3f48219e97a78761f82eebc6da087be485cf33923c9753c5a5f37c3ec` | no | n/a (float:no exception, per WU row) | n/a — no iterative solver | 3/3 pass |
| 8 | `art-05-eu-ai-act-credit-scoring-conformity` | `fcb93e8040bc73e15337abc8b67a8e70b03cd115900de0221cee4a2bf125136f` | `3df147256483ab37fe029bf77c6176ca53e4b254e061593ce901ea938b9e4619` | yes | yes (P5, 4 forced cases) | n/a — no iterative solver | 1/1 pass |
| 9 | `art-06-genius-act-reserve-attestation` | `8e520c99a42e6c53799b4c14a5d31d7face65414f1d0fd590a089488f621dc24` | `7ba54ab1a2de73bdaa7b338212d76e389aaf260f47edd92cb04671390d7b8e0e` | yes | yes (P4, 4 forced cases) | n/a — no iterative solver | 1/1 pass |
| 10 | `art-08-en16931-einvoice-batch-validator` | `2ae638995633cb25dd6ef2c645f6246c8aef863054019213ba1424a7509c4c7e` | `c3e0d664b042b3b03e910dff836c2f7030e54181608bddcef4d84dc406f762fb` | yes | yes (P5, threshold-classifier forced) | n/a — LCG loop is bounded by clamped `n_invoices` [10,2000], not iterative-convergent | 1/1 pass |

**7 of 10 kernels are float-sensitive** (504, 513, art-01, art-02, art-05, art-06, art-08) — ULP-boundary
forcing present in every one, per this shard row's own mandatory instruction. **3 are the WU row's
declared float:no exceptions** (509, 512, art-04) — no ULP-forcing required or attempted for those.

**Termination:** every kernel's compute loop is bounded either by the caller-supplied array length
(504, 509, 512, 513, art-04, art-05, art-06) or by a clamped simulation-count parameter enforced by the
kernel itself (`n_txns` / `n_invoices` clamped to [10, 2000] — art-02, art-08). None of the 10 contain an
iterative numerical solver; **the "convergence-or-report" property (§3, class C) is therefore confirmed
NOT APPLICABLE for all 10 kernels in this shard**, stated per-item above rather than assumed absent.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row). Confirmed via
`node scripts/check-fv-floor-coverage.mjs --summary` on this branch: all 10 kernels above are FLOORED
(kernel_digest_at_authoring header matches current kernel source for each).

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
