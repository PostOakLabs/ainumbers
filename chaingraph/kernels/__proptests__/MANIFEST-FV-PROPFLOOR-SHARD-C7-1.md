# FV-PROPFLOOR-SHARD-C7-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C7-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file
floor properties themselves (termination bound, boundedness, decision-table/differential re-derivation,
metamorphic/permutation-invariance checks, and ULP-boundary forcing for the float-sensitive rows). No row
received deeper manual review beyond this mechanical gate; the signer's attestation, when it is added,
covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-211-prediction-market-analyzer` | `3db60f420ca07f2d35c4aa2707c39a13b6e04399b65f0924f3e1c71d1b619885` | yes | present (entry_price clamp bounds, 0/-0, denormal forecast_prob into fdlibm `log`) | n/a — no iterative solver | 4/4 pass |
| 2 | `art-215-reg-z-appendix-j-apr` | `23d06ce0530f333676cee2d8435ec0f6622170fc8040d471151cd64a01025225` | yes | present (bracket-search edges: zero finance charge, unrepayable schedule, odd-days fraction at 0/near-1, denormal loan amount) | **iterative solver (bracketed bisection)** — convergence-or-report stated per trial (P1); iterations bounded <= BISECT_STEPS=200 (P2); independently re-derived rate matches the kernel's converged rate (P3, differential) | 3/3 pass |
| 3 | `art-216-trid-tolerance-cure` | `9be448c7f2f02ca2d2b223550734fe431b0dacf6d93db36ccae0cb6963e83cb3` | yes | present ($0.005 zero-tolerance slack boundary, 10% cumulative threshold boundary, 0/-0/denormal fee amounts) | n/a — no iterative solver | 2/2 pass |
| 4 | `art-23-visa-trusted-agent-protocol-inspector` | `121d2bbc225f22b9f647b43ef1310b168a6b6bd0a3e0d1e45dba0bc500fc213a` | no | n/a (float:no, direct read confirmed — Signature-Input string parsing and integer weight arithmetic only) | n/a — no iterative solver | 1/1 pass |
| 5 | `art-236-build-ai-decision-log-record` | `38e616aa1627146cb9496fe598eea7869de615e58bcc59363e22fc24da851e1c` | no | n/a (float:no, direct read confirmed — `confidence` is clamped/rounded for display only, never combined into a derived threshold comparison) | n/a — no iterative solver | 4/4 pass |
| 6 | `art-24-mastercard-agentic-token-builder` | `c3fc5f06ba67952f984a4b92f4a19b72dc85afedb761aaa7dace3b61ae13cc1e` | no | n/a (float:no, direct read confirmed — field-presence lint, integer score arithmetic) | n/a — no iterative solver | 1/1 pass |
| 7 | `art-25-a2a-agent-card-validator` | `31f05f94d1769d1602bf8a182a0c58acbc94caa2292ed294d99233f5ba0d3e1b` | no | n/a (float:no, direct read confirmed — field-presence/array-shape lint, integer score arithmetic) | n/a — no iterative solver | 1/1 pass |
| 8 | `art-251-compute-parametric-trigger-payout` | `21c850de44ea52edcd069ddb042c208ec8d8df8175a09b3fc3c9478245db8158` | yes | present (threshold exact-equality edge, linear_index fraction 0/1 edges, degenerate zero-span, denormal-scale index values, negative zero) | n/a — no iterative solver | 3/3 pass |
| 9 | `art-253-run-illustration-selfsupport-test` | `7752a4c0f60362741de571e3a2ec25b3797b26ca9da1f2d301742e230dc2a91e` | yes | present (account-value == 0 pass/fail edge, lapse-support 1.1x threshold, persistence-factor degenerate cases, denormal-scale account value) | n/a — no iterative solver (lapse-persistence is a bounded finite product, not a root-finding loop) | 2/2 pass |
| 10 | `art-256-validate-openids-homeowners-record` | `1b6e89be4bc17a5622e6bd5153cc9520c91514b8c0ddd89759d30ffae9bd3c5e` | **yes (CORRECTED)** | present (0.5 coverage-ratio threshold exact/over edge, coverage-limit >= 0 sign edge, denormal-scale dwelling limit) | n/a — no iterative solver | 2/2 pass |

**6 of 10 kernels are float-sensitive** — this is a **correction** against the WU row's own triage-table
classification (5 float:yes / 5 float:no). Re-confirming each kernel's float-sensitivity against its own
`.kernel.mjs` source per FIX-2 discipline found that `art-256-validate-openids-homeowners-record`, tabled
as float:no, contains a genuine float division compared to a fixed threshold —
`coverage.other_structures_limit / coverage.dwelling_limit > 0.5` (L114-118 of the kernel) — exactly the
`x/y` vs. threshold shape ULP-boundary forcing targets. It is floored here as float-sensitive with ULP
cases at the 0.5 ratio boundary and the coverage-limit sign edge, rather than inherited uncritically as
float:no. The other 9 kernels' classifications (5 yes: `art-211`, `art-215`, `art-216`, `art-251`,
`art-253`; 4 no: `art-23`, `art-236`, `art-24`, `art-25`) matched the WU triage table and were independently
re-confirmed against source, no correction needed.

**Iterative solver:** `art-215-reg-z-appendix-j-apr` is the shard's WU-flagged highest-risk convergence
claim (Reg Z Appendix J actuarial-rate bracketed bisection). Its floor states convergence-or-report per
trial (a rate is reported only when a sign-change bracket was actually established and narrowed;
otherwise `apr_pct` is null and `APR_NOT_BRACKETED`/`APR_DID_NOT_CONVERGE` is raised — never a silently
wrong rate), a hard termination bound (iterations never exceed the kernel's own `BISECT_STEPS=200`), and
an independent differential re-derivation (a from-scratch reference bisection over the same (b)(8)
equation, built without reusing the kernel's own solver code, converges to the same rate within a
generous tolerance). No other kernel in this shard contains an iterative solver; the convergence-or-report
property is stated as not-applicable for the remaining 9, per-item above, rather than assumed absent.

**Termination:** every kernel's compute path is bounded by a caller-supplied array length (events, fees,
tier_table, account_values/lapse_rates, human_accountability_records, skills) or a fixed small
enum/algorithm table (venue list, bucket types, REQUIRED_SECTIONS, VALID_POLICY_TYPES). Only `art-215`
runs an iterative numerical search (bracketed bisection); its termination bound is BISECT_STEPS=200,
verified directly (P2) rather than inferred from array length. `art-253`'s lapse-persistence product is a
bounded finite loop (`min(lapse_rates.length, 20)`), not a root-finding iteration, and is floored as
"n/a — no iterative solver" accordingly.

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above.

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
