# Visa TAP Agent Verification (RFC 9421 Web Bot Auth + Nonce + JWKS Pin)

Four independent verification facts about a caller-captured Visa TAP-shaped agent request: the RFC 9421 Ed25519 Web Bot Auth signature base (art-129), the request's nonce format/freshness/replay-set membership per TAP's 8-minute window (art-593), a caller-pinned SHA-256 digest match against the caller-supplied JWKS directory document (art-609), and the directory's own shape plus keyid resolution (art-130, reused unmodified). Verification only - zero network, zero key hosting, never a facilitator or transaction-path role.

- Page: https://ainumbers.co/chaingraph/chains/visa-tap-agent-verification.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/visa-tap-agent-verification.md

## Workflow chain: Visa TAP Agent Verification (RFC 9421 Web Bot Auth + Nonce + JWKS Pin)

Four independent verification facts about a caller-captured Visa TAP-shaped agent request: the RFC 9421 Ed25519 Web Bot Auth signature base (art-129), the request's nonce format/freshness/replay-set membership per TAP's 8-minute window (art-593), a caller-pinned SHA-256 digest match against the caller-supplied JWKS directory document (art-609), and the directory's own shape plus keyid resolution (art-130, reused unmodified). Verification only - zero network, zero key hosting, never a facilitator or transaction-path role.

Domain: AI & Agent Governance

### Steps

1. art-129-webbotauth-signature-verifier
   Ed25519 signature verdict over the RFC 9421 signature base establishes whether the caller-captured request signature is genuine, ahead of the nonce and directory checks below.
2. art-593-webbotauth-nonce-replay-check
   Nonce format, the TAP created/expires spread, and caller-supplied replay-set membership are assessed next - a separate fact about the same captured request, independent of the signature verdict above.
3. art-609-jwks-pinned-directory-check
   The caller-supplied JWKS directory document's canonical digest is checked against the caller's own out-of-band pinned digest before the directory's internal shape is trusted by the next step.
4. art-130-signature-directory-validator
   Terminal stage: JWKS directory shape and keyid resolution are validated on the same pinned document, completing the four-fact TAP verification surface.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
