# FV-PROPFLOOR-SHARD-C12-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**⛔ DUPLICATE-ITEM CORRECTION (found during this row's build, not by the row's own kernel list):**
`art-268-compute-cdd-ownership-25pct` was named in this row's WU kernel list, but it was **already
floored by `board/done/FV-PROPFLOOR-SHARD-C9-1.md`** (merged earlier, PR #1116) — its
`__proptests__/art-268-compute-cdd-ownership-25pct.proptest.mjs` file already exists on `origin/main`
with fixture-oracle, ULP-forcing, cycle-guard termination, and permutation-invariance checks, and
`check-fv-floor-coverage.mjs` does not list it as unfloored. This row's own draft of that file was
**discarded, not merged** — the shard-disjointness invariant means a kernel WU never overwrites another
shard's already-landed file. **This shard therefore delivers 9 NEW floor files, not 10**; the 10th named
kernel is a pre-existing duplicate, noted here rather than silently omitted (per board check-off
discipline: a skipped item gets an explicit note, never a silent gap).

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C12-1`, enumerated below by kernel id and
kernel-source digest (`sha256sum` of the `.kernel.mjs` file, matching the header comment in each
`.proptest.mjs` file).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file (`art-55` excludes the
`merkle_root` field from the diff, documented in-file — it is filled by the async `buildArtifact()`
wrapper this floor never calls, not a harness weakening; `art-268`'s `compute()` returns `output_payload`
directly rather than a `{output_payload, compliance_flags}` tuple, confirmed by direct read and handled
accordingly); (2) the property-file floor properties themselves (termination bound, boundedness,
metamorphic/permutation-invariance/idempotence checks, and — for the 3 float-sensitive kernels — mandatory
ULP-boundary forcing). No row received deeper manual review beyond this mechanical gate; the signer's
attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence/termination property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-587-finp2p-ledger-proof-verifier` | `3c844292a3af41f9d432ae70b2573143e1de22d82b2ddda19f531d233ec06d5f` | no | n/a (float:no, direct read confirmed — pure bitwise/BigInt secp256k1+keccak/sha3 hashing over caller strings, no caller float parameters) | n/a — no iterative solver; termination bounded by input length (fixed 17-field pass + O(sig length) hex parse) | 3/3 pass |
| 2 | `art-33-mcp-server-self-attestation-pack` | `0fa24d32f68661ef9900f03ddab76d94fc674c6cf4327d809bd7bd5d2451c316` | no | n/a (float:no, direct read confirmed — integer weight sums, `Math.round(100*got/max)` only) | n/a — no iterative solver; termination bounded by `inputSchema.properties` key count | 1/1 pass |
| 3 | `art-38-tempo-onchain-aml` | `9e0872728a1ce51e8fe58bb13bec82cc382a97584cd3fb9517db6f621072bbc7` | no | n/a (float:no, direct read confirmed — `Number()`-coerced USD amounts compared with plain `>=` against integer thresholds) | n/a — no iterative solver; termination bounded by `transfers` array length | 1/1 pass |
| 4 | `art-55-trade-document-provenance-verifier` | `1328cfacdcf71d0f8ba4acb5a20ac1da41eccca4e7b940bea943d4de82db2193` | no | n/a (float:no, direct read confirmed — fixed absolute-cent/percentage tolerance bands treated categorically per spec §3's class-C default, not an ULP claim) | n/a — no iterative solver; termination bounded by `documents` array length | 1/1 pass (`merkle_root` excluded from diff, documented in-file — async-filled by `buildArtifact()`, not by `compute()`) |
| 5 | `art-91-ownership-50pct-aggregator` | `f1505eeba83572c78e56a22d102dca7aae6db7cbefab4c87b98653969f191037` | **yes** | **yes** — 0/-0/±ULP/denormal forced around the 50.0 threshold, plus a two-hop chain forcing the accumulated product within 1 ULP of 0.5 either side | **explicit, stated below** — BFS with a `visited` Set bound, tested against a deliberately cyclic graph (not merely a length-bounded loop) | 1/1 pass |
| 6 | `art-92-screening-list-coverage-checker` | `d06a7bacc78c3440e850fc8bccdfc7b270f66c39e0a30d4696c558cf6e24e169` | no | n/a (float:no, direct read confirmed — `Math.round()` integer percentages, fixed integer penalty steps 15/10) | n/a — no iterative solver; termination bounded by `lists_screened`/`sectoral_lists` array length | 1/1 pass |
| 7 | `art-93-fuzzy-match-calibration-scorer` | `280862d6b27e8364c05290b99e446bb8938364dc1c03fb90835464743ef0cdc8` | **yes** | **yes** — 0/-0/±ULP/denormal forced around the match threshold, across all 3 similarity algorithms | n/a — no iterative solver (Levenshtein DP table, not an iterative numeric solver); termination bounded by string-length product, tested with adversarially long strings | 1/1 pass |
| 8 | `art-95-circumvention-diligence-assessor` | `75587c9e280c8c0b45a80f7846a3c176999cf769b7f62fd36dc96e732b79a75b` | no | n/a (float:no, direct read confirmed — integer weight-table sum, `Math.round()` integer percentage only) | n/a — no iterative solver; termination bounded by `dd_evidence` array length | 1/1 pass |
| 9 | `art-96-no-russia-clause-pack-builder` | `cf2d6111233a0f8a580756c5e1c03e7832d67ddf9c6582393a9c90d819dbaa7a` | no | n/a (float:no, direct read confirmed — integer required/total ratio only) | n/a — no iterative solver; termination bounded by `evidence_required` array length × fixed checklist size | 1/1 pass |
| 10 | `art-268-compute-cdd-ownership-25pct` | — | — | — | **⛔ DUPLICATE — already floored by `FV-PROPFLOOR-SHARD-C9-1` (PR #1116), pre-existing on `origin/main`** | not re-run; existing file untouched |

**2 of the 9 newly-floored kernels are float-sensitive** (`art-91`, `art-93`) — the WU row's own
triage-table named 3 (adding `art-268`), but `art-268` turned out to be a pre-existing duplicate (see
above), so this row's own new-file float-sensitive count is 2/9. Each was independently re-confirmed
against its own `.kernel.mjs` source per FIX-2 discipline rather than inherited uncritically. No
corrections were needed. ULP-boundary forcing (threshold ±1 ULP, 0, negative zero, denormals, chained-
fraction-near-threshold cases) is present in both property files. The other 7 new kernels use forced
categorical boundary cases in place of ULP-forcing, per spec §3's float:no row.

**Termination:** 8 of the 9 newly-floored kernels' compute loops are bounded by a caller-supplied array
length (receipts, transfers, documents, dd_evidence, evidence_required, lists_screened, synthetic_pairs,
inputSchema.properties) with no recursion. **One kernel requires its own explicit statement:**
- `art-91-ownership-50pct-aggregator` walks the ownership graph via BFS with a `visited` Set — its bound
  is the Set, not the edge-array length, so a cyclic graph (tested explicitly, including a dense
  15-node/210-edge fully-connected adversarial case) still terminates in at most `nodes.length` dequeues.
  This is the flagship scrutiny item in this shard's 9 new files.

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 9 new kernels above.

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
