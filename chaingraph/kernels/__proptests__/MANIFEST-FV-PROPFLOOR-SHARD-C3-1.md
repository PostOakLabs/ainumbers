# FV-PROPFLOOR-SHARD-C3-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C3-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file
floor properties themselves (termination bound, boundedness, decision-table/differential re-derivation,
metamorphic/permutation-invariance checks). No row received deeper manual review beyond this mechanical
gate; the signer's attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-119-traceability-lot-code-linker` | `9c508df29c7b972a6c75f1ad355d117b4554a2b3faebc82012baddb301528df5` | no | n/a (float:no, direct read confirmed — pure string-equality/boolean lineage logic) | n/a — no iterative solver | 2/2 pass |
| 2 | `art-12-acp-checkout-conformance-validator` | `4ee210e9f360aea1ea09609253ca4e223bc00065d42aa2a672f4ffb5a866afc2` | no | n/a (float:no, direct read confirmed — decision-table rule engine; the one numeric "amount precision" check counts decimal digits of a caller string, no float comparison) | n/a — no iterative solver | 3/3 pass |
| 3 | `art-120-recall-trace-resolver` | `572a3d1b5f06617e9230439c2f639209dc51f1969e4f7fa9709c23349334b9b2` | no | n/a (float:no, direct read confirmed — string-equality edge filtering + integer counting) | n/a — no iterative solver | 1/1 pass |
| 4 | `art-123-c2pa-manifest-validator` | `e2191fb2c1cfcbbec083616921861612aebe0dd75f823fe782a6fc1d301f70c8` | no | n/a (float:no, direct read confirmed — label-membership boolean logic) | n/a — no iterative solver | 3/3 pass |
| 5 | `art-124-content-credential-signature-verifier` | `e9897ef4cb8f7cf9529ef898e949895809edb037f346eb0a0557216bb3875fd1` | no | n/a (float:no, direct read confirmed — WebCrypto `verify()` returns boolean; surrounding logic is pure boolean/set-membership) | n/a — no iterative solver | 4/4 pass |
| 6 | `art-125-provenance-ingredient-tree-resolver` | `a1c4a8356fca87be9f173fb8e17477148c292da0bd3ee408c0c9e88eea8b9054` | no | n/a (float:no, direct read confirmed — string-prefix + presence checks, integer counting) | n/a — no iterative solver | 3/3 pass |
| 7 | `art-129-webbotauth-signature-verifier` | `6e54e84c5d83d433fc37b31030c1fd5bc32d029f016f7ab3ea0a37883b3f8615` | no | n/a (float:no, direct read confirmed — only arithmetic is integer-second clock-skew comparison, no floats) | n/a — no iterative solver | 4/4 pass |
| 8 | `art-130-signature-directory-validator` | `3826cbd5f7c8d26075aaa4ebe3fa0b1f62f959e159a28b2eb6a153d6f307efcb` | no | n/a (float:no, direct read confirmed — path-equality + array boolean logic) | n/a — no iterative solver | 3/3 pass |
| 9 | `art-131-signature-agent-card-validator` | `02cc79e6816db16e1e31ee80ce2bf4101ab8959fbb51653651ac1a84084b1134` | no | n/a (float:no, direct read confirmed — field-presence + array boolean logic) | n/a — no iterative solver | 3/3 pass |
| 10 | `art-135-cyclonedx-sbom-validator` | `3f160ab65134e8918e39f71151aed591c8cd27e82ed90f22cff146f7fa75fcd1` | no | n/a (float:no, direct read confirmed — string-equality/set-membership + array-index counting) | n/a — no iterative solver | 2/2 pass |

**0 of 10 kernels are float-sensitive** — this matches the WU row's own triage-table classification
(0/10, no ULP-forcing required this shard), and each was independently re-confirmed against its own
`.kernel.mjs` source per FIX-2 discipline rather than inherited uncritically. No corrections were needed.

**Termination:** every kernel's compute loop is bounded by the caller-supplied array length (events,
edges, items, assertions, ingredients, covered_components, keys, dependencies) or by a fixed small set
of known enum/algorithm/rule tables (CTES, ISO4217, ALG_ALLOW, REQUIRED field lists). None of the 10
contain an iterative numerical solver; **the "convergence-or-report" property (§3, class C) is therefore
confirmed NOT APPLICABLE for all 10 kernels in this shard**, stated per-item above rather than assumed
absent.

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row). Confirmed via
`node scripts/check-fv-floor-coverage.mjs --summary` on this branch: all 10 kernels above are FLOORED
(kernel_digest_at_authoring header matches current kernel source for each — live: 582, floored: 68,
including 58 pre-existing + these 10 new). `node scripts/run-proptests.mjs` passes 68/68.

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
