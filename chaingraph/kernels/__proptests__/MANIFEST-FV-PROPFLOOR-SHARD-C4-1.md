# FV-PROPFLOOR-SHARD-C4-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C4-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file
floor properties themselves (termination bound, boundedness, decision-table/differential re-derivation,
metamorphic/permutation-invariance checks, and forced ULP-boundary cases where float-sensitive). No row
received deeper manual review beyond this mechanical gate; the signer's attestation, when it is added,
covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-136-slsa-provenance-verifier` | `e68457cfcfc0229b4029a1579bdd6871ecb20daf0abd9743c2627eccb3a51e5d` | no | n/a (float:no, direct read confirmed — string/type/set-membership boolean logic; slsa_build_level uses an integer range clamp, no fractional comparison) | n/a — no iterative solver | 2/2 pass |
| 2 | `art-137-openvex-statement-validator` | `676d999d882d7e4a0d0e97841723ed8a0c8b3440fd079227c910c1945058a0de` | no | n/a (float:no, direct read confirmed — pure string/type/enum-membership boolean logic, no arithmetic) | n/a — no iterative solver | 2/2 pass |
| 3 | `art-138-spdx-sbom-validator` | `72aba0699f8a03e3cc099b887c437ef7f1a801c5284b6e00d616419870a71ef6` | no | n/a (float:no, direct read confirmed — regex/type/set-membership boolean logic + array indexing, no arithmetic) | n/a — no iterative solver | 2/2 pass |
| 4 | `art-142-nis2-art21-gap-checker` | `1e2ae5da118e19c5c3b8960fcc173a82582f8ecc9952ef30fb521b8d5e0a16b7` | no | n/a (float:no, direct read confirmed — compliance_score is Math.round((integer_sum/30)*100) compared against Math.round()'d integer grade thresholds; no fractional value crosses a threshold by float epsilon) | n/a — no iterative solver; fixed 10-measure table, not a loop over unbounded input | 2/2 pass |
| 5 | `art-143-nis2-penalty-exposure-calculator` | `1e050fdce69b0aa2eeb1cbcca0c6b09530edfc86980ab96104181ae460bbb60a` | no | n/a (float:no — **re-examined per this WU row's own flag** that this kernel's "turnover float calc" was the shard's likeliest false "no"; direct read shows every `infringement_types` entry shares the SAME pct/fixed_max per `compute()` call, so `Math.max` never compares two distinct nearby floats, and the mitigation `Math.min(factor_count*0.10, 0.70)` produces a numeric value, not a categorical branch. Confirmed float:no — the shard's real correction landed on art-156 instead, see row 10) | n/a — no iterative solver | 2/2 pass |
| 6 | `art-148-mcp-authorization-metadata-validator` | `3165d9c916ead557ee007631e3a0dd32f84782a04aa5df796c776d31c963bd8b` | no | n/a (float:no, direct read confirmed — regex/type/set-membership boolean logic + array length checks, no arithmetic) | n/a — no iterative solver | 3/3 pass |
| 7 | `art-149-mcp-registry-entry-conformance` | `490f01e12e64fd3fd247586762fcc49a28e499af0f6bff4bbe0cc992e630448e` | no | n/a (float:no, direct read confirmed — regex/type/array-length boolean logic, no arithmetic) | n/a — no iterative solver | 3/3 pass |
| 8 | `art-150-mcp-tool-scope-revocation-auditor` | `43b2320d22c9bb43d9f57049be817347d84f13e34532dbec3d13725872886ba2` | no | n/a (float:no, direct read confirmed — token_age_s is a plain integer-second Unix-timestamp subtraction, compared against an integer max_token_age_s; no division, no fractional threshold) | n/a — no iterative solver | 3/3 pass |
| 9 | `art-152-mcp-task-lifecycle-validator` | `4e79c3b40641330a83eb57be5d97170403a99d2473aed7aa63205b19f116334c` | no | n/a (float:no, direct read confirmed — pure state-machine table lookup, string equality, array membership; no arithmetic anywhere) | n/a — no iterative solver | 3/3 pass |
| 10 | `art-156-emir-counterparty-pairing-reconciler` | `6fcd67412ed75171ed02a708b27a3f74129a434cdb9c66be88c7442e28c03910` | **yes — CORRECTION** | **yes** — boundary (`diff_pct === tol` exactly), ±1 ULP either side, 0-tolerance exact-equality, negative-zero vs positive-zero, and the `Math.max(...,1)` denom-floor case, all forced in `P5_ulp_boundary_forcing_diff_pct_threshold` | n/a — no iterative solver | 2/2 pass |

**1 of 10 kernels is float-sensitive** — this is a **correction to the WU row's own triage-table
classification** (0/10). The WU row's own instruction ("do not inherit the classification uncritically...
`art-143`... is the one most likely to be a false `no`; check it first") flagged the right *shape* of risk
but the wrong kernel: direct source read shows `art-143`'s arithmetic never affects a categorical branch
(row 5 above), while `art-156-emir-counterparty-pairing-reconciler` computes a percentage-difference
(`diff_pct = (|an-bn|/denom)*100`) and makes a genuine threshold decision `diff_pct <= tol` against a
caller-supplied `numeric_tolerance_pct` — the exact B-class "fixed-threshold-tier agreement" shape this
spec's ULP-forcing mandate applies to regardless of class (§3). ULP-boundary forcing was added for
`art-156` (row 10, property P5) per spec. All other 9 kernels were independently re-confirmed against
their own `.kernel.mjs` source per FIX-2 discipline rather than inherited uncritically; no further
corrections were needed.

**Termination:** every kernel's compute loop or lookup is bounded by the caller-supplied array/field-list
length (subjects, statements, packages, tool_grants, transitions, matching_fields) or by a fixed small
table (SLSA/OpenVEX/SPDX field checklists, the fixed 10-item NIS2 Art.21 measure table, the fixed 4-item
MCP-metadata/registry checklists, the fixed MCP task-lifecycle state machine). None of the 10 contain an
iterative numerical solver; **the "convergence-or-report" property (§3, class C) is therefore confirmed
NOT APPLICABLE for all 10 kernels in this shard**, stated per-item above rather than assumed absent.

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row). Confirmed via
`node scripts/check-fv-floor-coverage.mjs --summary` on this branch: all 10 kernels above are FLOORED
(kernel_digest_at_authoring header matches current kernel source for each — live: 582, floored: 88,
including 78 pre-existing + these 10 new). `node scripts/run-proptests.mjs` passes 88/88.

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
