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
| Wayback `/spec` first attempt | 2026-07-19 02:04:47 — captured THEIR app's error page (evidence spec page unreachable that day) | web.archive.org/web/20260719020447 — retry owed |

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
| Claude Chat/Cowork session provenance — independent conceptual derivation predating `chaingraph.json` commit same day | Session-dated 2026-06-12 (session list timestamps). "WebGPU" session: exploring WebGPU-viz M&A value → wrote `ARTIFACTS-V1_2026-06-12.md` (definition gate: valid AP2 export, MCP endpoint, exports a decision not context, chainable, hash-anchored) → same session escalated to `CHAINGRAPH-V1_2026-06-12.md`, marked canonical. Separate "Chaingraph implementation" session same day built PTG-01 off that doc and pushed. Chain: WebGPU-visual exploration → hash-anchored/chainable/AP2-export concept → ChainGraph v1 spec, same calendar day as the first `chaingraph.json` commit (3a82979/332bb28). Renamed OpenChainGraph by 2026-06-15 (session "OpenChainGraph 0.2 upgrade plan" already uses the name). | Tim-supplied screenshots, session titles "WebGPU," "ARTIFICATSv1 views M&A value," "Chaingraph implementation," "Workflow composition spec," all dated Jun 12–15 in the session-list UI. 16 screenshot files saved at `evidence/2026-06-12-prior-art/` (01-16, descriptive filenames, session-list + in-session captures). Local-only git commit (no remote, not pushed) for hash/timestamp: `c27714ebf02d1c397c3a9d8d851a6cc7e69cfe9f`, 2026-07-20 21:33:43 -0400. |

## Outstanding (manual steps, not yet done)

1. ~~Snapshot `/patent`, `/docs`, PyPI project page~~ — done 2026-07-20 (Wayback + archive.today, table above). PyPI Wayback capture unconfirmed-readable, archive.today PyPI capture (`archive.is/A4Dav`) stands in.
2. SSRN abstract=6866422 PDF — download, hash it, anchor via our §20 RFC 3161 TSA tools. Posted/revised dates now recorded; PDF hash+anchor still open.
3. Perma.cc captures — `/spec`, `/about`, SSRN abstract.
4. ghostarchive.org third-archive pass, same URLs.
5. Retry Wayback `/spec`.

## Cross-reference

`PRIOR-ART-TIMELINE-2026-07-16.md:26` — update its open ACTION line to point here once steps above close.
