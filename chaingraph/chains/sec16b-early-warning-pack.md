# Section 16(b) Early-Warning Pack

Evidence pack for the recipient side of a Section 16(b) short-swing demand letter, built for an issuer's general counsel or an insider's own counsel. Stage 1 recomputes the matchable-pair short-swing profit figure from a declared list of the insider's own transactions in the issuer's equity security, using the lowest-in/highest-out construction, and compares the recomputed figure against a number the demand letter claims where one is supplied. Stage 2 wraps that receipt in a shareable evidence bundle stamped with the SPEC.md SIDECAR.1 tier label the caller's declared gate results qualify it for. Every transaction is declared by the caller: the pack reads no Form 4/5 filing and no brokerage record, so it evidences whether the declared transaction list produces the claimed figure, never that the declared transactions are complete or accurate. It does not compute a Rule 144 volume-limitation check, which is a named follow-on tool, and it is not legal advice.

- Page: https://ainumbers.co/chaingraph/chains/sec16b-early-warning-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sec16b-early-warning-pack.md

## Workflow chain: Section 16(b) Early-Warning Pack

Evidence pack for the recipient side of a Section 16(b) short-swing demand letter, built for an issuer's general counsel or an insider's own counsel. Stage 1 recomputes the matchable-pair short-swing profit figure from a declared list of the insider's own transactions in the issuer's equity security, using the lowest-in/highest-out construction, and compares the recomputed figure against a number the demand letter claims where one is supplied. Stage 2 wraps that receipt in a shareable evidence bundle stamped with the SPEC.md SIDECAR.1 tier label the caller's declared gate results qualify it for. Every transaction is declared by the caller: the pack reads no Form 4/5 filing and no brokerage record, so it evidences whether the declared transaction list produces the claimed figure, never that the declared transactions are complete or accurate. It does not compute a Rule 144 volume-limitation check, which is a named follow-on tool, and it is not legal advice.

Domain: Securities Compliance & Corporate Governance

### Steps

1. art-573-section16b-short-swing-profit-recompute
   Stage 1, the recompute. A declared list of the insider's own transactions in the issuer's equity security matched under the Smolowe/Gratz lowest-in/highest-out construction within a day-count approximation of the statutory less-than-six-months window, with the recomputed matched-pair total compared against a demand-letter figure where one is supplied, and a MATCHES, DIVERGES, or INDETERMINATE verdict.
2. art-408-evidence-bundle-tier-labeler
   Stage 2, the evidence bundle. The Stage 1 receipt's execution hash wrapped in a shareable bundle stamped with the SPEC.md SIDECAR.1 tier label the caller's declared gate results qualify it for. The label re-expresses declared gate outcomes and mints no new trust claim. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
