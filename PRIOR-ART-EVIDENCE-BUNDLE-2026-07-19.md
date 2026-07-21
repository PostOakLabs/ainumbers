# Prior-art evidence bundle — 2026-07-19

Companion to `PRIOR-ART-TIMELINE-2026-07-16.md` and `PRIOR-ART-EVIDENCE-PLAN-2026-07-19.md`. Neutral, dated-artifact framing only — no originality claims about any person or entity. Every row below is instrument-verified (CT log, arXiv, GitHub API, git log) with a timestamp and source, not asserted from memory.

## Related prior art (concepts OCG builds on, not attestedintelligence.com-specific)

General provenance/versioning/verifiable-compute concepts predate both OCG and attestedintelligence.com by years (W3C PROV-DM 2013, SLSA, in-toto, FSMA 204 food-traceability) — see `chaingraph/ocg-industries.html`, which cites these standards directly. OCG does not claim to have invented hash-chained receipts, verifiable computation, or agent-identity attestation as concepts. The items below are the closest specific prior art identified so far, each pre-dating OCG's repo (2026-05-06):

| Item | What | Date | Source |
|---|---|---|---|
| VOUCH protocol | Open standard, AI agent identity/accountability, hash-chained credentials | Repo created 2025-11-30; public launch (Businesswire, "Agent Checkpoint") 2026-02-24 | github.com/vouch-protocol/vouch (GitHub API `created_at`); businesswire.com/news/home/20260224311936 |
| TCU — "Trusted Compute Units: A Framework for Chained Verifiable Computations" | TU Berlin (Castillo, Heiss, Werner, Tai) — chained verifiable computation framework | arXiv v1 submitted 2025-04-22 | arxiv.org/abs/2504.15717 |
| "A Framework for Cryptographic Verifiability of End-to-End AI Pipelines" | Balan, Learney, Wood — cryptographic verifiability across AI pipeline lifecycle | arXiv v1 submitted 2025-03-28 | arxiv.org/abs/2503.22573 |
| Microsoft Agent Governance Toolkit — "Independently Verifiable Compliance Receipts" | Proposal doc: signed receipts, hash-chain, Ed25519, EU AI Act Art. 12 framing | First commit 2026-04-22 | github.com/microsoft/agent-governance-toolkit (commit `3433fa7`) — proposal-stage, not shipped; date is close to OCG repo's 2026-05-06, flagged as marginal, not a strong prior-art claim |

**Convergent-field note:** Microsoft AGT's pre/post-execution seals + hash-chain (commit `3433fa7`, 2026-04-22) predate OCG's repo (2026-05-06) and are independent of attestedintelligence.com — third party arriving at the same receipt-chain shape, strengthens the convergent-field position (multiple independent teams converging on hash-chained signed receipts, not one party copying another).

**Note on "FCU" paper:** you referenced a TU Berlin zkVM/FCU paper — closest match found is the TCU paper above (Castillo/Heiss/Werner/Tai). Flag if a different paper was meant; will re-search with corrected title/acronym.

## Theirs — attestedintelligence.com (instrument-verified)

| Fact | Date | Instrument/source |
|---|---|---|
| Site public existence begins | 2026-02-27 02:44:08 UTC | CT log, Let's Encrypt R12, crt.sh (no earlier cert exists) |
| USPTO patent application 19/433,835, "Systems and Methods for Generating and Enforcing Attested Governance Artifacts" | Filed 2025-12-28 | attestedintelligence.com/patent; predates their site CT and OCG's repo |
| PyPI package `aga-governance` | Earliest release 0.1.0, 2026-03-20T22:37:31Z (later yanked); current 0.2.6 | pypi.org/pypi/aga-governance/json |
| SSRN paper, "Attested Governance: Runtime Integrity for Autonomous Systems," 45 pages | Posted 20 Jun 2026; last revised 27 Jun 2026 | ssrn.com/abstract=6866422 (Tim, manual capture — Cloudflare blocks automated fetch) |
| SSRN PDF (abstract=6866422) — hashed + RFC 3161 anchored, two independent TSAs | Anchored 2026-07-21T16:32:13.000Z | sha256:d43de630b9007890ef79e05fa8b2c6a5902b003d391ddc2928ca7ce79bb817ec — anchored via anchor.ainumbers.co (§20 tooling): DigiCert TSA (timestamp.digicert.com, serial 7b3e7172eb6d496b2ea5c38e4053c9ba) + Sigstore TSA (timestamp.sigstore.dev, serial 4ad9af2ba149e804ce6df0423f4a37733a2473fb), both rfc3161-tst tokens, gen_time 2026-07-21T16:32:13.000Z; verify at anchor.ainumbers.co/verify.html or `openssl ts -verify` |
| Company/founder | Attested Intelligence Holdings LLC, founded by Jack Brennan, US-based | attestedintelligence.com/about (archived) |
| Tech approach — explicitly no ZKP/TEE | "AGA does not rely on Trusted Execution Environments, Zero-Knowledge Proofs, or specialized hardware" — hash-linked receipts + Ed25519/ML-DSA-65 signatures + Merkle checkpoints only; states ZKP is "complementary," answers a different question ("did the AI compute correctly?" vs "did the system stay within constraints?") | attestedintelligence.com/technology (archived) — material differentiator from OCG's zkVM/kernel-proof approach, not overlapping prior art on that axis |
| Wayback `/about` snapshot (2026-07-19 capture) | 2026-07-19 02:46:11 UTC | web.archive.org/web/20260719024611/https://attestedintelligence.com/about |
| Wayback `/about` re-capture (2026-07-20, higher fidelity) | 2026-07-20 01:35:36 UTC | web.archive.org/web/20260720013536/https://attestedintelligence.com/about |
| Wayback `/patent` | 2026-07-20 01:28:26 UTC | web.archive.org/web/20260720012826/https://attestedintelligence.com/patent |
| Wayback `/docs` | 2026-07-20 01:30:57 UTC | web.archive.org/web/20260720013057/https://attestedintelligence.com/docs |
| Wayback `/technology` | 2026-07-20 01:37:38 UTC | web.archive.org/web/20260720013738/https://attestedintelligence.com/technology |
| Wayback PyPI `aga-governance` project page | 2026-07-20 01:33:02 UTC (attempted — served Wayback client-challenge on re-check, not confirmed readable) | web.archive.org/web/20260720013302/https://pypi.org/project/aga-governance/ |
| archive.today snapshots (2026-07-19) | Captured 2026-07-19 | archive.is/kGgKX, archive.is/RUXjw |
| archive.today snapshots (2026-07-20, patent/docs/pypi) | Captured 2026-07-20 | archive.ph/GU9PM (patent), archive.is/yQPlu (docs), archive.is/A4Dav (pypi) |
| Wayback `/spec` first attempt | 2026-07-19 02:04:47 — captured THEIR app's error page (evidence spec page unreachable that day) | web.archive.org/web/20260719020447 — a pattern-of-unreachability data point, superseded by the retry below |
| Wayback `/spec` retry — succeeded | 2026-07-21 16:33:48 UTC — captured real page content ("Specification and Benchmarks \| Attested Intelligence"), not an error page | web.archive.org/web/20260721163348/https://attestedintelligence.com/spec |
| ghostarchive.org third-archive pass — `/spec`, `/about`, SSRN abstract | Captured 2026-07-21 | ghostarchive.org/archive/qXMzw (spec), ghostarchive.org/archive/wDIlA (about), ghostarchive.org/archive/5hLzc (SSRN abstract=6866422, 16:37:14 UTC) |

## Ours — ainumbers.co / OCG (instrument-verified)

| Fact | Date | Instrument/source |
|---|---|---|
| ainumbers.co earliest CT cert | 2025-03-27T21:28:18 UTC (Let's Encrypt R10) | crt.sh |
| mcp.ainumbers.co earliest CT cert | 2026-06-06T23:57:46 UTC (Google Trust Services WE1) | crt.sh |
| anchor.ainumbers.co earliest CT cert | 2026-07-02T21:10:29 UTC (Google Trust Services WE1) | crt.sh |
| Repo initial commit | 2026-05-06 (395ce83) | `git log --reverse` |
| SPEC.md — OCG v0.4 SSOT landed | 2026-06-21 (00b4dbb) | `git log --follow chaingraph/standard/SPEC.md` |
| `execution_hash` concept, earliest commit | 2026-05-21 (a8dba0e) | `git log -S "execution_hash"` |
| §20 Anchor Binding / `anchor_bindings`, v0.7.0 | 2026-07-02 (20a600a) | `git log -S "anchor_bindings"` |
| Zenodo DOI 10.5281/zenodo.21343520 | publication_date 2026-07-10; deposit registered 2026-07-13T18:48:04Z | zenodo.org/api/records/21343520 |
| Claude Chat/Cowork session provenance — independent conceptual derivation predating `chaingraph.json` commit same day | Session-dated 2026-06-12 (session list timestamps). "WebGPU" session: exploring WebGPU-viz M&A value → wrote `ARTIFACTS-V1_2026-06-12.md` (definition gate: valid AP2 export, MCP endpoint, exports a decision not context, chainable, hash-anchored) → same session escalated to `CHAINGRAPH-V1_2026-06-12.md`, marked canonical. Separate "Chaingraph implementation" session same day built PTG-01 off that doc and pushed. Chain: WebGPU-visual exploration → hash-anchored/chainable/AP2-export concept → ChainGraph v1 spec, same calendar day as the first `chaingraph.json` commit (3a82979/332bb28). Renamed OpenChainGraph 2026-06-15 (sessions "OpenChainGraph 0.2 upgrade plan" + "OpenChainGraph naming migration"). v0.2→v0.3 and v0.3→v0.3.1 both landed 2026-06-18 (sessions "OpenChainGraph standards integration" + "Openchaingraph v0.3.1 update"). | Tim-supplied screenshots, session titles "WebGPU," "ARTIFICATSv1 views M&A value," "Chaingraph implementation," "Workflow composition spec," "OpenChainGraph 0.2 upgrade plan," "OpenChainGraph naming migration," "OpenChainGraph standards integration," "Openchaingraph v0.3.1 update," dated Jun 12–19 in the session-list UI. 27 screenshot files saved at `evidence/2026-06-12-prior-art/` (01-27, descriptive filenames, session-list + in-session captures). Local-only git commits (no remote, not pushed): `c27714e` (2026-07-20 21:33:43 -0400, files 01-16), `49c934d` (SHA-record follow-up), `272ff6e` (file 17), `153f781` (files 18-20), plus one for files 21-27 (v0.3/v0.3.1 sessions). Public spec-page changelog dates now match: v0.1/v0.1→v0.2 via PR #497 (commit `5d399cf`), v0.2→v0.3/v0.3→v0.3.1 via PR #513 (commit `886940a`), both deployed 2026-07-21. |

## Outstanding (manual steps, not yet done)

1. ~~Snapshot `/patent`, `/docs`, PyPI project page~~ — done 2026-07-20 (Wayback + archive.today, table above). PyPI Wayback capture unconfirmed-readable, archive.today PyPI capture (`archive.is/A4Dav`) stands in.
2. ~~SSRN abstract=6866422 PDF — download, hash it, anchor via our §20 RFC 3161 TSA tools.~~ — done 2026-07-21 (table above): sha256 + DigiCert/Sigstore RFC3161 anchors via anchor.ainumbers.co.
3. **Perma.cc captures — `/spec`, `/about`, SSRN abstract — BLOCKED, needs Tim.** Perma.cc requires an authenticated account to mint links (free tier included); account creation/sign-in is outside this session's fence (prohibited action for the automated session). Ghostarchive (step 4) supplies a third independent archive for the same three URLs in the interim — Perma.cc remains open if Tim wants the library-backed citation-grade link specifically.
4. ~~ghostarchive.org third-archive pass, same URLs.~~ — done 2026-07-21 (table above): `/spec`, `/about`, SSRN abstract all captured.
5. ~~Retry Wayback `/spec`.~~ — done 2026-07-21 (table above): retry succeeded, real page content captured.

## Cross-reference

`PRIOR-ART-TIMELINE-2026-07-16.md:28` — updated 2026-07-21 to point here (see that file's item 5 ACTION line).
