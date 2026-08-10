# FV-PROPFLOOR-SHARD-C6-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C6-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file
floor properties themselves (termination bound, boundedness, differential re-derivation against an
independent re-implementation where practical, and metamorphic/order/representation-invariance checks).
No row received deeper manual review beyond this mechanical gate; the signer's attestation, when it is
added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-20-acp-ucp-product-feed-conformance-auditor` | `6fcabf3a24030e00fb8df1723c7c77039066139306f2100a0bb8a97b53eb07c8` | no | n/a (float:no, direct read confirmed — `calcScore()` uses `Math.round` over an integer ratio, no fractional-threshold comparison) | n/a — no iterative solver | 1/1 pass |
| 2 | `art-200-license-election-verifier` | `a0aa948c199ee9e9b22b9f8c9e710dba6a6762acfa6cee243e6f2a9669dab881` | no | n/a (float:no, direct read confirmed — inlined SHA-256 is 32-bit unsigned integer arithmetic only, no IEEE-754 operation anywhere in the file) | n/a — no iterative solver | 4/4 pass |
| 3 | `art-201-iscc-content-code-generator` | `4dfd4472b91697eea65c4241ac425e012eeff7afe0d270e7da548a4904d9b4bc` | **CORRECTED: no** (WU triage table listed float:yes; direct read finds only integer bit-ops (BLAKE3/xxhash32/base32) and BigInt modular arithmetic in `minhash()` — no IEEE-754 division or fractional-threshold comparison anywhere) | n/a per correction above | n/a — no iterative solver (content-defined chunking is bounded by content byte length, tested directly) | 4/4 pass |
| 4 | `art-204-license-compatibility-checker` | `bfd5a5f39b32798e40fc9cc82a2029d902936a511baf42cbd99668b985cf56ae` | no | n/a (float:no, direct read confirmed — fixed static `LICENSE_DB` lookup + boolean rule checks only, no arithmetic) | n/a — no iterative solver | 4/4 pass |
| 5 | `art-205-license-terms-assembler` | `bebb5b6028df2c00c50d629078971ca09785b5ca51b473d2515c05becc4ca1aa` | no | n/a (float:no, direct read confirmed — pure string substitution into fixed templates, no arithmetic) | n/a — no iterative solver | 3/3 pass |
| 6 | `art-206-rights-record-builder` | `8f35e055dceefb5e3f15d1f661ea140e9414f44f8804e17f8a67f35739d0bfc2` | **CORRECTED: no** (WU triage table listed float:yes; direct read finds `term_years` is stored verbatim with no threshold comparison or division, and the only other numeric work is the inlined SHA-256's 32-bit unsigned integer arithmetic) | n/a per correction above | n/a — no iterative solver | 3/3 pass |
| 7 | `art-208-royalty-split-validator` | `e264583d242ab0d715775d7f1ac1a87d7a26916f3fa44a5082a6c2facfa61705` | **yes — CONFIRMED** (percent-mode share sum compared against a `0.001` tolerance via `Math.abs(sum-total)<=tolerance`; the WU row itself flagged this kernel as "most likely to have real division worth double-checking") | **yes** — forced cases: exact match, literal-boundary values that IEEE-754 rounds just outside tolerance (100.001/99.999 → `Math.abs()` = 0.0010000000000047748, a genuine ULP-rounding finding recorded in the property file), a genuinely-within-tolerance value (100.0005), the classic 33.33+33.33+33.34 non-associativity case, zero, negative zero, and a denormal-scale (`Number.MIN_VALUE`) noise share | n/a — no iterative solver, rule loops bounded by `entries.length` | 4/4 pass |
| 8 | `art-209-nft-metadata-validator` | `f44568d42f15c3115cd7fa67045fb18872ae4cc0ba789b6bede70f9448176a1b` | no | n/a (float:no, direct read confirmed — schema/regex checks only, no arithmetic) | n/a — no iterative solver | 4/4 pass |
| 9 | `art-21-agent-traffic-acceptance-policy-builder` | `6243000aa7fa78f35081606c6c9c5dd114268e7a28e879dcb7f96f2be704cd76` | no | n/a (float:no, direct read confirmed — `assessGuardrails()` is pure comparison/branch logic over integers and enums) | n/a — no iterative solver | 1/1 pass |
| 10 | `art-210-ipfs-cid-computer` | `dac326da6a1226cfd8f7e34a91e43143f1b9721fe0de9210224b8cb275eef503` | no | n/a (float:no, direct read confirmed — inlined SHA-256 + base32 codec, 32-bit unsigned integer arithmetic only) | n/a — no iterative solver | 4/4 pass |

**1 of 10 kernels is float-sensitive (`art-208`), confirmed by direct read — matching the WU row's own
flag that it was "the one most likely to have real division worth double-checking." The WU row's triage
table additionally listed `art-200`, `art-201`, and `art-206` as float-sensitive; direct read of all
three found no IEEE-754 arithmetic anywhere in their source (integer/BigInt/string/hash operations
only), so `art-201` and `art-206` are CORRECTED to float:no here (`art-200` was already correctly no per
the table's own footnote pattern seen in prior shards). These corrections are stated per-item above
rather than silently inherited, per FIX-2 discipline** (`FV-PBT-FLOOR-BUILD-SPEC.md` §3: "confirm
float-sensitivity against each kernel's own source before relying on the table").

**Termination:** every kernel's compute path is bounded either by a FIXED constant (schema field
counts, template counts, rights-vector field counts, guardrail-branch counts — art-20, art-200,
art-204, art-206, art-21) or by the caller-supplied input's own length with no recursion or
data-dependent divergence (content-defined chunking bounded by content bytes for art-201, entries.length
for art-208, attributes.length for art-209, text length for art-210, field-value lengths for art-205).
None of the 10 contain an iterative numerical solver; **the "convergence-or-report" property (§3, class
C) is therefore confirmed NOT APPLICABLE for all 10 kernels in this shard**, stated per-item above rather
than assumed absent.

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row). Confirmed via
`node scripts/check-fv-floor-coverage.mjs --summary` on this branch: live: 582, floored: 129 (119
pre-existing + these 10 new). `node scripts/run-proptests.mjs` passes 129/129.

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
