# FV-PROPFLOOR-SHARD-C5-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C5-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file
floor properties themselves (termination bound, boundedness, differential re-derivation, metamorphic
checks, forced boundary cases); (3) a direct re-read of the kernel's own source to confirm or correct
the WU row's float-sensitivity classification (see "Float-sensitivity re-confirmation" below). No row
received deeper manual review beyond this mechanical gate; the signer's attestation, when it is added,
covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Float-sensitivity re-confirmation (per FIX-2 discipline — mandatory, not inherited uncritically)

The WU row's initial table classified 6 of these 10 kernels as `float:yes` (art-166, art-191, art-192,
art-193, art-194, art-199) and flagged the four hash/receipt kernels explicitly for re-verification:
*"verify the four hash/receipt kernels (art-191/192/193/194) are float-sensitive from actual numeric
fields and not merely from hashing bytes (hashing itself is not float arithmetic)."*

Direct source read of all 10 kernels finds **5 corrections** are required:

- **art-166-eudr-geolocation-plot-validator — CONFIRMED float:yes.** `area_ha >= 4` threshold,
  longitude `[-180,180]` / latitude `[-90,90]` range comparisons, and the polygon-closure
  exact-equality check (`Number(first[0]) === Number(last[0])`) are all raw float comparisons.
- **art-191-conversion-receipt-builder — CORRECTED to float:no.** Pure hex-string/boolean logic; the
  only "SHA-256 arithmetic" is the pure-JS hash's uint32 bitwise/modular integer operations, not
  IEEE-754 float arithmetic. No numeric field is ever compared.
- **art-192-conversion-receipt-verifier — CORRECTED to float:no.** Same pattern as art-191: hex-digest
  comparison and structural checks only.
- **art-193-metadata-sanitization-prover — CORRECTED to float:no.** `bytes_before`/`bytes_after` are
  carried through via `finiteOrNull()` unmodified — never compared or arithmetically combined. All
  decisions are hex-digest equality, enum membership, and array-length counting.
- **art-194-digest-manifest-builder — CORRECTED to float:no.** `total_bytes` is a plain
  `reduce((s,e)=>s+e.bytes,0)` sum with no threshold comparison; summing integer byte counts in
  float64 is exact below 2^53, so even the sum itself carries no meaningful ULP risk.
- **art-199-license-election-certifier — CORRECTED to float:no.** Explicitly "modelled on art-191" in
  its own source comment; same hex/hash/boolean pattern, zero numeric fields.
- **art-169, art-17, art-189, art-190 — CONFIRMED float:no**, matching the WU row's own table (regex/
  boolean logic for art-169; a rounded-integer score threshold for art-17, where the comparison that
  matters is always on an already-`Math.round()`-ed integer, not a raw float — see that file's header
  comment for the full argument; pure string-parsing/hashing for art-189 and art-190).

**Net result: 1 of 10 kernels is float-sensitive (art-166), not 6.** ULP-boundary forcing (spec §3:
±1 ULP, 0, negative zero, denormals, `x/y*y !== x`-shaped cases) is present for art-166 only, per the
"ULP-forcing present" column below. The other 9 kernels use forced **categorical** boundary cases
instead (integer/enum/string-length thresholds relevant to each kernel's own decision logic), which is
the spec's own prescribed floor treatment for `float:no` kernels.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-166-eudr-geolocation-plot-validator` | `8f52903ef0106be3d988c08666ae2f0f87f7e1b19703d6d8c0a4dcfe6fd3079e` | yes (confirmed) | YES — area_ha=4 ±1ULP, lon/lat ±180/±90 ±1ULP, negative zero, polygon-closure ±1ULP + denormal-scale | n/a — no iterative solver | 4/4 pass |
| 2 | `art-169-eudr-supply-chain-traceability-linker` | `5290987894384c3baf43f5a162fb87c964f0ff074535604e4b89001db38a40b7` | no (confirmed) | n/a (categorical: ref-length regex 4/40-char boundary, first-operator toggle) | n/a — no iterative solver | 4/4 pass |
| 3 | `art-17-ap2-mcp-policy-validator` | `c8bd009b480838215fafa652ee90ae0e5439c003a08ca20fc0d5c97819232151` | no (confirmed) | n/a (categorical: score=80 rounded-integer threshold, deprecated ap2_version form) | n/a — no iterative solver | 2/2 pass |
| 4 | `art-189-markdown-document-converter` | `a207d209c504b5fd261aae969d2c9ed362c95df104378ec95e84ce2c4acece89` | no (confirmed) | n/a (categorical: empty input, 6-hash vs 7-hash ATX heading boundary) | n/a — no iterative solver | 3/3 pass |
| 5 | `art-190-tabular-data-converter` | `b25ddec2f77bf9180e134c09369282fa7530ba9218218445c2ba5d469f34b6b9` | no (confirmed) | n/a (categorical: empty/header-only input, duplicate headers, invalid JSON) | n/a — no iterative solver | 3/3 pass |
| 6 | `art-191-conversion-receipt-builder` | `e9c4a6255342b4fb2f2bd3687128e671dad4028f95ca277ee482fabe7b2b83ce` | **no (CORRECTED from WU row's yes)** | n/a (categorical: 63/64-char hex, self-conversion digest equality, PII-key detection) | n/a — no iterative solver | 3/3 pass |
| 7 | `art-192-conversion-receipt-verifier` | `77570734c4be05d8e8a9f816845247675a55ed85b3e6ce17165b857dfd39da02` | **no (CORRECTED from WU row's yes)** | n/a (categorical: malformed receipt, tampered binding, string-vs-object input) | n/a — no iterative solver | 3/3 pass |
| 8 | `art-193-metadata-sanitization-prover` | `2d8ae35efdc10161078c887a54e33ac94a5faba77d639714ebe390c32a9759b0` | **no (CORRECTED from WU row's yes)** | n/a (categorical: all 5 FILE_TYPES, identical-digest-despite-findings edge) | n/a — no iterative solver | 3/3 pass |
| 9 | `art-194-digest-manifest-builder` | `f7773f9cb20b6ccffd83c7dc8eadff91a541c6046f38620c66139db89449959b` | **no (CORRECTED from WU row's yes)** | n/a (categorical: zero entries, malformed hex, path-like name, digest-sort tiebreak) | n/a — no iterative solver | 3/3 pass |
| 10 | `art-199-license-election-certifier` | `72d98f80efe5fb34421fb246ca4e8071db4f48d55a8e4abb445b06414241b441` | **no (CORRECTED from WU row's yes)** | n/a (categorical: known/unknown license family, empty asset_ref/licensor_did) | n/a — no iterative solver | 4/4 pass |

**1 of 10 kernels is float-sensitive** (art-166) — 5 corrections from the WU row's initial 6/10
classification, all independently re-confirmed against each kernel's own `.kernel.mjs` source per
FIX-2 discipline rather than inherited uncritically. See "Float-sensitivity re-confirmation" above for
the full reasoning per correction.

**Termination:** every kernel's compute loop/pipeline is bounded by the caller-supplied array length
(coordinates ring, upstream_dds_refs, findings, entries) or by a fixed small set of known
fields/checks (AP2 required-field list, the 4/5/7-entry check pipelines in art-191/192/199). None of
the 10 contain an iterative numerical solver; **the "convergence-or-report" property (§3, class C) is
therefore confirmed NOT APPLICABLE for all 10 kernels in this shard**, stated per-item above rather
than assumed absent.

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row). Confirmed via
`node scripts/check-fv-floor-coverage.mjs --summary` on this branch: all 10 kernels above are FLOORED
(kernel_digest_at_authoring header matches current kernel source for each — live: 582, floored: 109,
including 99 pre-existing + these 10 new). `node scripts/run-proptests.mjs` passes 109/109.

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
