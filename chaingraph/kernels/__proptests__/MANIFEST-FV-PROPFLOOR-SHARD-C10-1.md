# FV-PROPFLOOR-SHARD-C10-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C10-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file
floor properties themselves (termination bound, boundedness, decision-table/differential re-derivation,
metamorphic/permutation-invariance checks, and mandatory ULP-boundary forcing for the one float-sensitive
kernel). No row received deeper manual review beyond this mechanical gate; the signer's attestation, when
it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-289-lint-besu-settlement-contract` | `8452fcfb980e34593a3e46cab2d75a620d9e598ea12e618b94c74b04ff1f4ce7` | no | n/a (float:no, direct read confirmed — regex/structural lint over strings and ABI array shapes, no arithmetic) | n/a — no iterative solver | 2/2 pass |
| 2 | `art-291-screen-onledger-transfer-batch` | `8b96056cb0c7a9e5152efaff0a3b8d4eb6cf558db3e7627a0aef99ed7511841b` | no | n/a (float:no, direct read confirmed — name/purpose-code screen is string equality + array membership, no arithmetic on screened amounts) | n/a — no iterative solver | 2/2 pass |
| 3 | `art-292-attest-settlement-orchestrator` | `e62a92dde406825f63c0b95978cb5a1070ed19f539f9c3a665a53cd2257c5ee0` | no | n/a (float:no, direct read confirmed — composite_score is Math.round over small bounded integer got/max pairs; forced-boundary categorical check included) | n/a — no iterative solver | 2/2 pass |
| 4 | `art-293-einvoice-format-validator` | `5daa83b6ade4cbfb782fb404e16e80077c9264bb4f636e9c1d6e564294e89f58` | no | n/a (float:no, direct read confirmed — presence/codelist/cardinality checks, no arithmetic) | n/a — no iterative solver | 6/6 pass |
| 5 | `art-294-einvoice-vat-calc-verifier` | `986d37866299487054398f63d3e4ea13b3ae3c3ccd2e7c315e21d8269f9696e2` | **YES** | **PRESENT** — half-even tie exactly at .5, 0, negative zero, denormal (`Number.MIN_VALUE`), `100/3` and `0.1+0.2` round-trip artifacts, all forced under both `half-up`/`half-even` rounding methods; no negative-zero leakage confirmed | n/a — no iterative solver (single-pass per-line VAT computation) | 4/4 pass |
| 6 | `art-297-agentic-dispute-ce30-linter` | `d3eda08f22ed67d0de0b0d7d5ca2877c9954ecff416aae4cf51d9906260ae374` | no | n/a (float:no, direct read confirmed — digest/transaction_ref string equality and count thresholds) | n/a — no iterative solver | 5/5 pass |
| 7 | `art-30-agent-commerce-conformance-validator` | `48228bd926421bc7b6d0b41aa34880912b7d96d3f048f2865ee2ba72a1b9a2f0` | no | n/a (float:no per triage; direct read found two cross-protocol amount-tolerance checks at fixed 0.005/0.01 thresholds — forced as categorical boundary cases (just-inside/exact/just-outside) rather than full ULP forcing, since the compared values are caller-asserted amounts, not a kernel-computed rounding chain) | n/a — no iterative solver | 2/2 pass |
| 8 | `art-300-aca-226j-response-evidence-pack` | `4d4fb49f4aacbbbdeaa9aa38d119217e3cfd2e5234bb80c9fd6bb055afb5fcc9` | no | n/a (float:no per triage; direct read found exposureDelta = recomputedExposure - irsAssertedEsrp feeding an exact-equality check — forced as categorical boundary cases (exact match, smallest-representable-delta near-miss, negative zero) rather than full ULP forcing, since both operands are caller-supplied whole-dollar-shaped numbers with no internal rounding chain) | n/a — no iterative solver | 5/5 pass |
| 9 | `art-303-aiuc1-control-evidence-linter` | `6f0ccad9827533502bb1df8c0b7beedc187822ea5f7bf07363637c00336b8f21` | no | n/a (float:no, direct read confirmed — coverage fractions are rational over small fixed integer denominators, 23 controls / 2-4 per pillar) | n/a — no iterative solver | 5/5 pass |
| 10 | `art-304-aiuc1-evidence-pack-assembler` | `bde1926d75bbc6dbc37f1d43332bd1684a077131e61b89d6e99929a12b8cf33c` | no | n/a (float:no, direct read confirmed — digest lookup, string equality, integer-rank comparisons only) | n/a — no iterative solver | 3/3 pass |

**1 of 10 kernels is float-sensitive** (`art-294-einvoice-vat-calc-verifier`) — this matches the WU row's
own triage-table classification, and each of the 10 was independently re-confirmed against its own
`.kernel.mjs` source per FIX-2 discipline rather than inherited uncritically. No triage-table correction
was needed for the float-sensitivity call itself; two of the 9 float:no kernels (`art-30`,
`art-300`) were additionally given forced categorical boundary-case tests around their one
amount/exact-equality comparison each, as a conservative strengthening beyond the WU's own minimum bar.

**Termination:** every kernel's compute loop is bounded by the caller-supplied array length (transfers,
line_items, kernel_bindings, checks, disputed_employee_ids, control_evidence, control_mapping, findings)
or by a fixed small set of known enum/rule tables (FORMAT_RULES, AUTOMATABLE_CONTROLS, VALID_PURPOSE_CODES,
STRENGTH_RANK). None of the 10 contain an iterative numerical solver; **the "convergence-or-report"
property (§3, class C) is therefore confirmed NOT APPLICABLE for all 10 kernels in this shard**, stated
per-item above rather than assumed absent.

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row). Confirmed via
`node scripts/check-fv-floor-coverage.mjs --summary` on this branch: live 582, floored 209 (199
pre-existing + these 10 new). `node scripts/run-proptests.mjs` passes 229/229.

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
