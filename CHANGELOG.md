# Changelog

Notable changes to [AINumbers](https://ainumbers.co) — the OpenChainGraph compliance suite (source: [https://github.com/PostOakLabs/ainumbers](https://github.com/PostOakLabs/ainumbers)).

> **Scope of this file.** GENERATED from this repository's local git history —
> first-parent merge commits into `main`, plus repository tags — by
> `node scripts/gen-changelog.mjs`, with classifications committed in
> `scripts/changelog-seed.json`. It is a pure function of tracked inputs: no
> network, no wall clock, and **no hand edits** (edit the seed, then regenerate).
> **It under-reports by construction:** only merge commits and tags are visible
> to it, so changes landed by **direct pushes to `main`** — including the
> post-merge regeneration commits of the derived-artifacts bot — do not create
> entries. Recent landings have been largely direct pushes. Tags are under-
> reported in one environment too: a **tag-less CI checkout** (GitHub's ephemeral
> merge-group queue fetches no tag refs) renders with **no tag version scopes**,
> while merge-commit entries still classify. Classified entries
> are fail-closed forward: a merge commit missing from the seed fails the
> generator (and the freshness gate) until it is classified there.

## Unreleased

### Added

- 2026-08-16 — Register art-621 and land silent-degrade fixes ([#1296](https://github.com/PostOakLabs/ainumbers/pull/1296))
- 2026-08-13 — Assemble the held-draft subset of proven nodes (#1228, #1221, #1220) ([#1229](https://github.com/PostOakLabs/ainumbers/pull/1229))
- 2026-08-13 — Assemble six proven nodes, register mica-register-crosscheck, land #1215 and #1216 ([#1218](https://github.com/PostOakLabs/ainumbers/pull/1218))
- 2026-08-12 — Assemble six ETHMATH nodes and land held drafts #1197 and #1211 ([#1212](https://github.com/PostOakLabs/ainumbers/pull/1212))
- 2026-08-10 — Add the art-591 x402 Signer Recovery Verifier node ([#1137](https://github.com/PostOakLabs/ainumbers/pull/1137))
- 2026-08-09 — Add a coverage ratchet gate for the formal-verification property-test floor ([#1087](https://github.com/PostOakLabs/ainumbers/pull/1087))
- 2026-08-08 — Assemble legal-operations nodes art-588 and art-589 into the graph ([#1070](https://github.com/PostOakLabs/ainumbers/pull/1070))
- 2026-08-07 — Assemble art-587 (finp2p-ledger-proof-verifier) into the graph ([#1052](https://github.com/PostOakLabs/ainumbers/pull/1052))
- 2026-08-07 — Assemble art-562 (model-risk-lineage-pack) into the graph ([#1041](https://github.com/PostOakLabs/ainumbers/pull/1041))
- 2026-08-07 — Assemble capital-markets nodes art-575..581 into the graph ([#1031](https://github.com/PostOakLabs/ainumbers/pull/1031))
- 2026-08-06 — Add the art-572 multi-garnishment-stacking-recompute node ([#993](https://github.com/PostOakLabs/ainumbers/pull/993))
- 2026-08-06 — Add the art-563 MT9xx/CAMT statement-migration mapper node ([#980](https://github.com/PostOakLabs/ainumbers/pull/980))
- 2026-08-05 — Add clause-binding kernel infrastructure, content-ID round-trip, and SCITT receipt export ([`ade08dcb1`](https://github.com/PostOakLabs/ainumbers/commit/ade08dcb1e9505c7e919e7fc81dcab5225750e76))
- 2026-08-04 — Add the cross-border CCP monitoring chain (draft PR #949) ([`ad2ef1aea`](https://github.com/PostOakLabs/ainumbers/commit/ad2ef1aea1ce272b968274c1dbe95ed2fea3d86c))
- 2026-08-04 — Add cross-border verification-of-payee kernels (draft PR #924) ([`0e1c78799`](https://github.com/PostOakLabs/ainumbers/commit/0e1c78799cda2dd40d13b9b801f97d010c57e654))
- 2026-08-04 — Fold traditional-finance operations nodes art-543..547 and three chains into the graph ([#951](https://github.com/PostOakLabs/ainumbers/pull/951))
- 2026-08-04 — Fold exchange-assurance nodes, chain, and hub into the graph ([`c173797b6`](https://github.com/PostOakLabs/ainumbers/commit/c173797b6fe47fa01bf3170318162b35ade5ce4e))
- 2026-08-04 — Pick up the art-544 slate-report-validator kernel from a parallel landing ([`0c8a0297c`](https://github.com/PostOakLabs/ainumbers/commit/0c8a0297c4764858d14a24549a3380b9baf373ed))
- 2026-08-04 — Add the Reg W 23A/23B testing-cycle bill-payment chain ([`4dd7fdb54`](https://github.com/PostOakLabs/ainumbers/commit/4dd7fdb547ec3f5583d34391d551de9c0fd640ca))
- 2026-08-04 — Add the QFC recordkeeping-cycle bill-payment chain ([`24c2f93f5`](https://github.com/PostOakLabs/ainumbers/commit/24c2f93f5fb6b8db66382f17092907260390bb1f))
- 2026-08-04 — Add the AML lookback-closure-cycle bill-payment chain ([`9cb89a50a`](https://github.com/PostOakLabs/ainumbers/commit/9cb89a50aca95ff790a2149ee4dad380fc0eff7e))
- 2026-08-04 — Add the MRA consent-order-closure-cycle bill-payment chain ([`172138642`](https://github.com/PostOakLabs/ainumbers/commit/1721386426d6dab9dc93fd02593d1e32396f891e))
- 2026-08-04 — Add the QFC bill-payment kernel ([`1c7acfd61`](https://github.com/PostOakLabs/ainumbers/commit/1c7acfd61afad4c1565d7e283d485f9934e7ef5a))
- 2026-08-04 — Add the Reg W bill-payment kernel ([`4489b64fb`](https://github.com/PostOakLabs/ainumbers/commit/4489b64fb03242aee33fc6f917d69012022adac1))
- 2026-08-04 — Add the FDIC 370 bill-payment kernel ([`32e1c7ffa`](https://github.com/PostOakLabs/ainumbers/commit/32e1c7ffa28eef5543bf776ff5cdf907bea01afa))
- 2026-08-04 — Add the AML bill-payment kernel ([`6a3387bab`](https://github.com/PostOakLabs/ainumbers/commit/6a3387babef745deec86f4fd30aadcda2870ac42))
- 2026-08-04 — Add the stablecoin reserve scorecard chain (PR #895) ([`d051b13b9`](https://github.com/PostOakLabs/ainumbers/commit/d051b13b9c18df7e821b7b988c3a6a904dadceb3))
- 2026-08-04 — Add the agentic payment mandate lint chain (PR #898) ([`36428729f`](https://github.com/PostOakLabs/ainumbers/commit/36428729f6b955c05cce627c382708650e0e3989))
- 2026-08-03 — Land the government-payment-programme-assurance chain ([#874](https://github.com/PostOakLabs/ainumbers/pull/874))
- 2026-08-03 — Add the government-payments RFP evidence hub ([#872](https://github.com/PostOakLabs/ainumbers/pull/872))
- 2026-08-02 — Assemble the model-validation-cycle SR 26-2 citation shard ([#830](https://github.com/PostOakLabs/ainumbers/pull/830))
- 2026-08-02 — Assemble art-524/525/526 into the graph ([#820](https://github.com/PostOakLabs/ainumbers/pull/820))
- 2026-08-01 — Add the government-payment lifecycle chain ([`5d1f9fd5e`](https://github.com/PostOakLabs/ainumbers/commit/5d1f9fd5e924b3f345fe5ca6351004d0c4fcaeab))
- 2026-08-01 — Add the allocation-decision receipt chain ([`c0f003cf1`](https://github.com/PostOakLabs/ainumbers/commit/c0f003cf18e1e0c919a67d29eb0d6f331921937f))
- 2026-08-01 — Add the conditional-relief collateral chain ([`0a984538d`](https://github.com/PostOakLabs/ainumbers/commit/0a984538d99f3a8f5219671d5f4288501fa0ad64))
- 2026-08-01 — Add the public-money settlement receipt chain ([`7afb8aab3`](https://github.com/PostOakLabs/ainumbers/commit/7afb8aab3640b8fd12899d24ca8b635a4c1053ac))
- 2026-08-01 — Add the art-514 conditional-relief collateral receipt shard (PR #784) ([`d6257c0bf`](https://github.com/PostOakLabs/ainumbers/commit/d6257c0bf67b615c828d57375625e40d3bdd3893))
- 2026-08-01 — Add the art-513 public-money settlement receipt shard (PR #783) ([`d1eeebe0b`](https://github.com/PostOakLabs/ainumbers/commit/d1eeebe0bdf72876928a03f631e39e5c64ce1883))
- 2026-07-30 — Add art-499 and art-500 UK CASS 15 safeguarding nodes ([#731](https://github.com/PostOakLabs/ainumbers/pull/731))
- 2026-07-30 — Add the art-492 vendor-neutral settlement finality classifier ([#730](https://github.com/PostOakLabs/ainumbers/pull/730))
- 2026-07-30 — Add the art-494 ICM quorum-forgery classifier ([#728](https://github.com/PostOakLabs/ainumbers/pull/728))
- 2026-07-27 — Attach compute proofs for assurance nodes art-480..art-491 (PR #687) ([`5d6771cd8`](https://github.com/PostOakLabs/ainumbers/commit/5d6771cd8c10d636c5ec2577c16938473509f678))
- 2026-07-27 — Add model-validation kernels art-488/489 (assurance wave 2) ([`7c1fff399`](https://github.com/PostOakLabs/ainumbers/commit/7c1fff399a6156ca674cbd84abb2389e29128e66))
- 2026-07-27 — Add FATCA/CRS submission-check and remediation kernels (assurance wave 2) ([`ab0fe2545`](https://github.com/PostOakLabs/ainumbers/commit/ab0fe25456a0480185a60e9ae83a030cf66771ee))
- 2026-07-27 — Add regulatory-reporting edit-check and variance-explainer kernels (assurance wave 2) ([`e39a8fd23`](https://github.com/PostOakLabs/ainumbers/commit/e39a8fd23f4c5d7d0a546743a1357eda3c93c934))
- 2026-07-27 — Add EMIR reconciliation and break-ageing kernels (assurance wave 2) ([`dc59231a4`](https://github.com/PostOakLabs/ainumbers/commit/dc59231a476a0820e29cf5fc458695cf6d852667))
- 2026-07-27 — Add risk-data aggregation and quality-scorecard kernels (assurance wave 2) ([`356d3a42f`](https://github.com/PostOakLabs/ainumbers/commit/356d3a42f8b30f6da8075856da955eac547a768d))
- 2026-07-27 — Add control-applicability and assessor-independence kernels (assurance wave 2) ([`5dd7e8c81`](https://github.com/PostOakLabs/ainumbers/commit/5dd7e8c8117ce6fd92d6ece8073983c1d68c35ca))
- 2026-07-26 — Make the xBRL-CSV exporter read the EBA taxonomy JSON at runtime ([`d82c048db`](https://github.com/PostOakLabs/ainumbers/commit/d82c048db8bc1a4b6c393a92062d613153f6ea9c))
- 2026-07-26 — Land the xBRL-CSV runtime exporter (PR #669) ([`693258030`](https://github.com/PostOakLabs/ainumbers/commit/6932580305ffefdf43b3eb1347f676073f4a6d5a))
- 2026-07-26 — Land held retrospective-adjustment sets #661 and #663 ([#665](https://github.com/PostOakLabs/ainumbers/pull/665))
- 2026-07-26 — Land held retrospective adjustments (PR #659) ([#660](https://github.com/PostOakLabs/ainumbers/pull/660))
- 2026-07-26 — Add the FR Y-9C Schedule HC/HC-R capital chain with hedge-accounting record validation (#658) ([`b7039eebf`](https://github.com/PostOakLabs/ainumbers/commit/b7039eebfacf589745c875842969695663fa3b39))
- 2026-07-26 — Prove art-476: splice the risc0 groth16 receipt (PR #657) ([`42e964e78`](https://github.com/PostOakLabs/ainumbers/commit/42e964e7854c6a386fe4808beb4813881f405b53))
- 2026-07-25 — Land the hedge-accounting conversion nodes (PR #650) ([`7e2b1c68f`](https://github.com/PostOakLabs/ainumbers/commit/7e2b1c68f9322d6217d83a3c7609512488775362))
- 2026-07-25 — Add groth16 proofs for 7 deferred nodes (#646) ([`b0a983376`](https://github.com/PostOakLabs/ainumbers/commit/b0a98337667083cb714ccd03f76b18fda9e90ba2))
- 2026-07-25 — Re-prove art-293/295/296 with groth16 (draft PR #622) ([`f3342ec69`](https://github.com/PostOakLabs/ainumbers/commit/f3342ec6929c8c516c44dbad70d8a0de5e6d8bc9))
- 2026-07-24 — Add the ICFR control-test cycle chain (#595) ([`4ab72f39a`](https://github.com/PostOakLabs/ainumbers/commit/4ab72f39a90318a5d43d88cd4e08aa142d44a416))
- 2026-07-24 — Add the art-457 GLOBE GIR composer kernel (#593) ([`12fbbde6f`](https://github.com/PostOakLabs/ainumbers/commit/12fbbde6f55036c7378a45067af2c26777af5522))
- 2026-07-24 — Add the art-465 workpaper bundle composer and substantive-procedure-cycle chain ([#598](https://github.com/PostOakLabs/ainumbers/pull/598))
- 2026-07-24 — Add the DORA compliance kernel (assurance wave) ([`e07381401`](https://github.com/PostOakLabs/ainumbers/commit/e073814015ee1c640d402e6d2998bc68faa4291a))
- 2026-07-24 — Add the CbCR kernel (assurance wave) ([`283b925f5`](https://github.com/PostOakLabs/ainumbers/commit/283b925f563b76a6dadcd9967765e4647144f4d5))
- 2026-07-24 — Add the hedge-accounting retrospective kernel (assurance wave) ([`f2479e124`](https://github.com/PostOakLabs/ainumbers/commit/f2479e1245cd5d9598fc5b6219266d457d52996a))
- 2026-07-24 — Add reconciliation kernels: JE ruleset screen, recalc suite, confirmation matcher (assurance wave) ([`e28a4f223`](https://github.com/PostOakLabs/ainumbers/commit/e28a4f223cd4c0f97cef9e8bb41c7e6aac5257d3))
- 2026-07-24 — Add the Pillar 2 kernel (assurance wave) ([`604b38b83`](https://github.com/PostOakLabs/ainumbers/commit/604b38b83a488e0c1de627a82f34a236fc73a95c))
- 2026-07-24 — Land bank-kernel proof batch 4: model-validation nodes art-450/451/453 ([`d31bb83bb`](https://github.com/PostOakLabs/ainumbers/commit/d31bb83bb6e8677eb628f4c03dcc429024313c02))
- 2026-07-23 — Add model-passport lifecycle nodes (art-450/451/452) ([#578](https://github.com/PostOakLabs/ainumbers/pull/578))
- 2026-07-23 — Add the art-452 ML training-data lineage record node ([#577](https://github.com/PostOakLabs/ainumbers/pull/577))
- 2026-07-23 — Add insurance kernels art-448/449 (PR #572) ([`a05c6fa3e`](https://github.com/PostOakLabs/ainumbers/commit/a05c6fa3eb98f612e329d8741d6a50178a0ca87a))
- 2026-07-23 — Add the secrets-management kernel art-447 (PR #568) ([`49654d0e0`](https://github.com/PostOakLabs/ainumbers/commit/49654d0e00d3ec194c8a265b58090d10ad7953ef))
- 2026-07-23 — Add the concentration-risk kernel art-445 (PR #573) ([`680e5fe12`](https://github.com/PostOakLabs/ainumbers/commit/680e5fe128aa371659af4057b988569c57749769))
- 2026-07-23 — Add the haircut kernel art-444 (PR #569) ([`2d0ec8226`](https://github.com/PostOakLabs/ainumbers/commit/2d0ec822614b51d1b04d9739cca6c95182f95ee5))
- 2026-07-23 — Add IRRBB kernels art-442/443 (PR #571) ([`7988bd740`](https://github.com/PostOakLabs/ainumbers/commit/7988bd7405732d82de8597fba71e436b5d7b9c27))
- 2026-07-23 — Add the FR Y-14 kernel art-439 (PR #570) ([`5fa8b9fa4`](https://github.com/PostOakLabs/ainumbers/commit/5fa8b9fa4f1c3857a788d823a78761df17949bbb))
- 2026-07-23 — Add the art-446 counterparty internal limit-check kernel ([#567](https://github.com/PostOakLabs/ainumbers/pull/567))
- 2026-07-23 — Add the FR 2052a inflow/outflow bucket classifier (art-437) (#557) ([`1d4a7dd5b`](https://github.com/PostOakLabs/ainumbers/commit/1d4a7dd5b4748fbefe59de363ab3c3afe566d94f))
- 2026-07-23 — Add FR Y-9C Schedule HC and HC-R kernels (art-435/436) (#555) ([`ac32e941c`](https://github.com/PostOakLabs/ainumbers/commit/ac32e941cf9a36ecef6bf05b0640e419dbff1da9))
- 2026-07-23 — Add FFIEC Call Report 031 Schedule RC/RC-R kernels with an edit-check gate (art-432/433/434) (#554) ([`57dd9cee4`](https://github.com/PostOakLabs/ainumbers/commit/57dd9cee4f0945332517b7b1737c4d985af0a0cc))
- 2026-07-23 — Add the cyber-incident-clock kernel (art-428) ([`69d5559a1`](https://github.com/PostOakLabs/ainumbers/commit/69d5559a1b5d9abdd2225265d1939d12bd8e000f))
- 2026-07-23 — Add the large-exposures limit-check kernel (art-425) ([`f09c3f4e5`](https://github.com/PostOakLabs/ainumbers/commit/f09c3f4e5825d6c287b028c43e8efa7e2c749ff2))
- 2026-07-21 — Add a consistency-proof mode to art-424 with a fresh proof, superseding #524 (PR #529) ([`673cd16e7`](https://github.com/PostOakLabs/ainumbers/commit/673cd16e7bcb9c1338385773261adb595371ca86))
- 2026-07-20 — Prove the art-418 and art-424 nodes (#480) ([`13a95281a`](https://github.com/PostOakLabs/ainumbers/commit/13a95281a35810b92acab5d251e0fa683741b975))
- 2026-07-20 — Land the art-394 x402 deferred-handshake-validator golden fixture (#473) ([`81fc950af`](https://github.com/PostOakLabs/ainumbers/commit/81fc950af583392fbd156c49a77c3b8834cf68ef))
- 2026-07-20 — Land the zk-prove batch 7 nodes (art-396..398 and others) ([`635adda4a`](https://github.com/PostOakLabs/ainumbers/commit/635adda4a8997b608221caffe72510c1a10d9249))
- 2026-07-20 — Add the identity-verification session receipt builder and evidence chain (draft PR #462) ([`4bbc2e90e`](https://github.com/PostOakLabs/ainumbers/commit/4bbc2e90e1f0437500ae629fe9ed0352b401ece7))
- 2026-07-19 — Land zk proof batch 11c (amortization schedule, Fedwire address sweep, GLOBE top-up tax nodes) ([`87a2933cb`](https://github.com/PostOakLabs/ainumbers/commit/87a2933cb77f0c2b94be7c828b161f9cca9369e9))
- 2026-07-19 — Land zk proof batch 11b (RAROC, DSCR, embedded-insurance pricing nodes) ([`f45fac4a8`](https://github.com/PostOakLabs/ainumbers/commit/f45fac4a83f15c1eb14e13bc0db788f8ab4f9845))
- 2026-06-28 — Prove section 18 Class-C (ICU) nodes art-47/86/107 with a deterministic en-US formatter ([#85](https://github.com/PostOakLabs/ainumbers/pull/85))
- 2026-06-28 — Compute-integrity proofs, batch 5 (26 nodes, final) ([#82](https://github.com/PostOakLabs/ainumbers/pull/82))
- 2026-06-28 — Compute-integrity proofs, batch 4 (40 nodes) ([#81](https://github.com/PostOakLabs/ainumbers/pull/81))
- 2026-06-28 — Compute-integrity proofs, batch 3 (40 nodes) ([#80](https://github.com/PostOakLabs/ainumbers/pull/80))
- 2026-06-28 — Compute-integrity proofs, batch 2 (40 nodes) ([#79](https://github.com/PostOakLabs/ainumbers/pull/79))
- 2026-06-28 — Compute-integrity proofs, batch 1 (33 nodes) ([#78](https://github.com/PostOakLabs/ainumbers/pull/78))
- 2026-06-28 — Compute-integrity proofs, batch 0 (first 4 nodes) ([#77](https://github.com/PostOakLabs/ainumbers/pull/77))
- 2026-06-27 — Adopt Kernel Identity Binding suite-wide (v0.6 Phase 1) ([#76](https://github.com/PostOakLabs/ainumbers/pull/76))
- 2026-06-27 — AI-governance wave (ISO 42001, NIST RMF, GPAI): 6 nodes, 2 chains ([#67](https://github.com/PostOakLabs/ainumbers/pull/67))
- 2026-06-26 — ViDA - VAT in the Digital Age (art-159..164): 192 nodes, 224 chains ([#59](https://github.com/PostOakLabs/ainumbers/pull/59))
- 2026-06-25 — Wave 22 OCG Provenance: 11 nodes art-112..122, 4 chains ([#47](https://github.com/PostOakLabs/ainumbers/pull/47))
- 2026-06-25 — v0.5 Phase 1: proof binding on 199 chain pages plus CI gate ([`93abb1df9`](https://github.com/PostOakLabs/ainumbers/commit/93abb1df9d6dba2f28a0d223f7ae1b1cc08db616))
- 2026-06-25 — OCG v0.5 proof binding ([#38](https://github.com/PostOakLabs/ainumbers/pull/38))
- 2026-06-22 — Add the OpenAPI artifact, docs.ainumbers.co portal, MCP SDK docs, and M&amp;A framing ([`393553cd3`](https://github.com/PostOakLabs/ainumbers/commit/393553cd3bf8e515e05a342baca491a4b81562d0))
- 2026-06-20 — Add the CI dead-link gate: block new dangling internal links ([#2](https://github.com/PostOakLabs/ainumbers/pull/2))

### Changed

- 2026-08-05 — Assemble PRs #859 and #957 into the graph and regenerate ([#960](https://github.com/PostOakLabs/ainumbers/pull/960))
- 2026-08-03 — Re-home the pending-commercialization solutions page ([#878](https://github.com/PostOakLabs/ainumbers/pull/878))
- 2026-08-03 — Sync utility_tools count 37 to 38 for build_evidence_pack ([#865](https://github.com/PostOakLabs/ainumbers/pull/865))
- 2026-08-01 — Sync the landing branch with main ahead of the inbound-payments landing ([`ac82a6dce`](https://github.com/PostOakLabs/ainumbers/commit/ac82a6dce4b80842818d5594e6cc0fd64b1dceab))
- 2026-07-27 — Update the art-78 CSDR penalty calculator and refresh its receipt (PR #702) ([`0c5f84c14`](https://github.com/PostOakLabs/ainumbers/commit/0c5f84c14f10c5d3e869b66fe51215448abe0e1d))
- 2026-07-24 — Sync the assurance landing branch with main ([`db8b2512f`](https://github.com/PostOakLabs/ainumbers/commit/db8b2512f3a1b57bcef0c8d800c0dff205abd052))
- 2026-07-23 — Update the GENIUS Act reserve-disclosure checker with fixtures ([`90f854403`](https://github.com/PostOakLabs/ainumbers/commit/90f8544039fd0c9145dc6136110acad06e15c2db))
- 2026-06-28 — Refresh the interactive OpenChainGraph explainer to v0.6 (20 stages) ([#88](https://github.com/PostOakLabs/ainumbers/pull/88))
- 2026-06-28 — Refresh the whitepaper section 18 from defined to deployed ([#86](https://github.com/PostOakLabs/ainumbers/pull/86))
- 2026-06-28 — Add tiered annotation for 8 deferred proof nodes (compute_proof_ready) ([#84](https://github.com/PostOakLabs/ainumbers/pull/84))
- 2026-06-23 — Homepage: agent-first rewrite (1368 to 513 lines) ([#33](https://github.com/PostOakLabs/ainumbers/pull/33))
- 2026-06-21 — Bump checkout and setup-node Actions to v5 (Node 24) ([#10](https://github.com/PostOakLabs/ainumbers/pull/10))

### Fixed

- 2026-08-02 — Regenerate catalog.json to close the 561-vs-567 manifest drift ([#831](https://github.com/PostOakLabs/ainumbers/pull/831))
- 2026-08-01 — Fix the art-518 bulk-disbursement-integrity kernel and fixtures (#795) ([`92820a50c`](https://github.com/PostOakLabs/ainumbers/commit/92820a50c6049226895dca2870f772752abac667))
- 2026-07-26 — Fix the art-336 LTV-ratio kernel and its proof state ([`304ce7fca`](https://github.com/PostOakLabs/ainumbers/commit/304ce7fca5653c421927240afb5f6b33755cb3ed))
- 2026-07-24 — Complete the reverse trade-finance cross-link: link T420-427 from the eBL guide ([#604](https://github.com/PostOakLabs/ainumbers/pull/604))
- 2026-07-20 — Make stripDiacritics guest-safe in the art-376 payee-name-match kernel (#475) ([`bdb7bb641`](https://github.com/PostOakLabs/ainumbers/commit/bdb7bb64138add96ddd319bdbf496ebdea785922))
- 2026-07-09 — Emit compliance_flags as a string array per OCG v0.4 schema, not an object map ([#199](https://github.com/PostOakLabs/ainumbers/pull/199))
- 2026-06-28 — Prove section 18 Class-B nodes art-106/108/110 (lazy proof import) ([#83](https://github.com/PostOakLabs/ainumbers/pull/83))
- 2026-06-26 — Add the why-openchain-graph page for the dead-link gate ([#61](https://github.com/PostOakLabs/ainumbers/pull/61))
- 2026-06-26 — Sync count sentinels after the Wave 29 merge ([#60](https://github.com/PostOakLabs/ainumbers/pull/60))
- 2026-06-23 — Hub search correction ([#37](https://github.com/PostOakLabs/ainumbers/pull/37))
- 2026-06-21 — Fix 8 stale tool-ID labels in tool-chains.html ([#11](https://github.com/PostOakLabs/ainumbers/pull/11))
- 2026-06-21 — Fix chaingraph art-* links ([#9](https://github.com/PostOakLabs/ainumbers/pull/9))
- 2026-06-21 — Fix guide-hub husk links ([#8](https://github.com/PostOakLabs/ainumbers/pull/8))
- 2026-06-21 — Repoint stale sibling-pager links to current tool numbers (24 remaining) ([#7](https://github.com/PostOakLabs/ainumbers/pull/7))
- 2026-06-21 — Repoint tools/guides card links to verified successors ([#6](https://github.com/PostOakLabs/ainumbers/pull/6))
- 2026-06-21 — Repoint 23 tool-chains dead links to verified successors ([#5](https://github.com/PostOakLabs/ainumbers/pull/5))
- 2026-06-21 — Fix 63 tools/ nav-depth dead links ([#4](https://github.com/PostOakLabs/ainumbers/pull/4))
- 2026-06-20 — Fix 19 dead homepage and sitemap guide links ([#3](https://github.com/PostOakLabs/ainumbers/pull/3))
- 2026-06-20 — Fix 16 dead links in the wts/dtc/aer chain pages ([#1](https://github.com/PostOakLabs/ainumbers/pull/1))

### Security

- 2026-07-26 — Fix stored XSS in the art-545 SD-JWT workbench innerHTML rendering (PR #664) ([`c4610e418`](https://github.com/PostOakLabs/ainumbers/commit/c4610e41831c62b1be3484630728e749915c7fc2))

<!-- GENERATED FILE — DO NOT HAND-EDIT. Regenerate: node scripts/gen-changelog.mjs -->
