# PRIOR-ART TIMELINE — OpenChainGraph public record (compiled 2026-07-16)

Purpose: dated, evidence-backed public-disclosure record for (a) counsel review vs Attested Intelligence patent app 19/433,835 and any future filings in the receipt space, (b) pitch-deck appendix, (c) standing defensive-publication register. Every entry is verifiable from public git history (github.com/PostOakLabs/ainumbers), live URLs, and the Zenodo archive.

## The timeline (all dates from git commit history / PR merges, public repo)

| Date | Event | Evidence |
|---|---|---|
| 2026-05-06 | Public repo genesis; ainumbers.co live (initial tool suite) | commits `395ce83`/`dca90e4`, PostOakLabs/ainumbers |
| 2026-06-12 | Session-level derivation, same day as first commit: Claude Chat/Cowork "WebGPU" session (exploring WebGPU-viz value) → `ARTIFACTS-V1_2026-06-12.md` (hash-anchored, chainable, AP2-export definition) → escalated same session to `CHAINGRAPH-V1_2026-06-12.md`, canonical | Tim-supplied session screenshots, see `PRIOR-ART-EVIDENCE-BUNDLE-2026-07-19.md` "Ours" table |
| 2026-06-12 | First `chaingraph.json` committed — signed deterministic-compute receipts (`execution_hash` over RFC 8785 JCS `{policy_parameters, output_payload}`) live on site | commits `3a82979`/`332bb28` |
| 2026-06-15 | ChainGraph v0.1→v0.2 upgrade + renamed to OpenChainGraph in all public-facing text (name collision avoidance); internal protocol identifiers unchanged | Session-dated (Tim-supplied screenshots); public spec page changelog now dates both entries, PR #497/commit `5d399cf`, 2026-07-21 |
| 2026-06-21 | **OpenChainGraph v0.4 standard published** — SPEC.md SSOT + JSON schema + conformance gates, public repo + live site | PR #12, commit `00b4dbb` |
| 2026-06 (following) | v0.4 conformance vectors for adopter self-test (PR #18) · v0.4.1 W3C VC 2.0 export profile §13.11 (PR #26) | tagged PRs |
| ~2026-06→07 | §16 proof binding (eddsa-jcs-2022), §18 ZK proving recipes + progressive 100% groth16 coverage, §20 anchors (RFC 3161/OTS/Merkle), §22 Work Mandates (ML-1/ML-2), §23 input attestations — all public SPEC.md revisions w/ PR trail | SPEC.md changelog + PR history |
| **2026-07-10** | **Three defensive publications live at ainumbers.co/disclosures/** (PR #205): (1) *Deterministic Gated Workflow Chains* (2) *Passkey-Signed Work Mandate Compilation* (3) *Receipt-to-Timestamp-Anchor Binding* — plus in-toto predicate publication | commit `43e4229`, live URLs under /disclosures/ |
| **2026-07-13** | **Zenodo DOI minted: 10.5281/zenodo.21343520** — timestamped archival of the disclosures/spec record (PR #240) | commit `43fbc2b`, doi.org/10.5281/zenodo.21343520 |
| 2026-07-14 | 341/341 live deterministic nodes ZK-proven (100%), publicly surfaced on site | site + board record |

## Position vs Attested Intelligence app 19/433,835 (filed 2025-12-28) — for counsel

**Honest framing (do not overclaim):** their filing date PRECEDES our public repo genesis (2026-05-06). Our position is therefore NOT "we predate their priority date." It is:

1. **Independent development, architecturally distinct.** Their spec (as publicly observable 2026-07): proxy/mediator-signed governance artifacts over MCP transport calls — the mediator wraps the pipe. OCG: the deterministic computation itself is the attestor — canonical-hash receipts over declared compute, byte-identical replay, ZK proofs of execution, work-mandate authority binding, human+agent parity. Different mechanism, different object attested.
2. **Prior art against continuations/broadening.** Our public record (v0.4 standard 2026-06-21, disclosures 2026-07-10, DOI 2026-07-13) is citable prior art against any LATER-filed claims or continuation applications attempting to cover deterministic-compute receipts, mandate compilation, or receipt-anchor binding.
3. **Their claims are unpublished.** US applications publish ~18 months from filing (~Jun 2027) absent early publication. Action: docket a check for publication of 19/433,835; counsel reviews claims then. Until then we know only their public spec + marketing.
4. **The three 2026-07-10 defensive publications were built for exactly this** — they place the named mechanisms unambiguously in the public domain with an archival DOI.
5. **Spec-congruence observation (recorded 2026-07-16, from fetch of attestedintelligence.com/spec):** their public AGA spec's core mechanism set — JCS-canonical JSON receipts, SHA-256 arguments hashing, Ed25519 over canonical form, previous-receipt-hash chaining, Merkle-rooted evidence bundles w/ proofs, SHA-256-pinned multi-toolchain conformance corpus — is substantially congruent with OCG features publicly shipped BEFORE the spec page's observable publication (execution_hash = JCS+SHA-256 since 2026-06-12 public; eddsa-jcs-2022 §16; §20.1 Merkle; §15 conformance gates; §21.4 chains). Their PATENT priority date still precedes our repo; but the public-spec congruence + our earlier public shipping dates are relevant to claim scope and to any assertion posture. Hand counsel this observation with both URLs + archive.org captures (ACTION: snapshot their spec page to archive.org NOW, dated).
6. Also noted: ML-DSA-65 is only an OPTIONAL hybrid profile in their spec, not primary — PQ-parity concern from the competitor scan is softer than first read.

## Standing practice (adopted today)
- Every novel mechanism that ships → assess for a /disclosures/ defensive publication in the same wave (cheap; the 07-10 trio is the template). Candidates from today's staged work when built: quantization_parity declaration · seeded-stochastic receipt profile · worksurface step-receipt chaining · VoP warning-display receipt.
- Zenodo record refresh when disclosures are added (new DOI version).
- This file = the register; update on every disclosure event. Live docs never archive.
