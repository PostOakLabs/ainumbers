# Allocation/Affirmation Timing & Message Conformance

Allocation/confirmation timing + format conformance vs the 23:00 CET trade-date mandate (ART-81) -> ISO 20022 securities-settlement message linting (ART-82) -> Merkle integrity (cry-04). Covers the binding Dec-2026 same-day machine-readable requirement.

- Page: https://ainumbers.co/chaingraph/chains/settlement-discipline-alloc-affirm.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/settlement-discipline-alloc-affirm.md

## Workflow chain: Allocation/Affirmation Timing & Message Conformance

Allocation/confirmation timing + format conformance vs the 23:00 CET trade-date mandate (ART-81) -> ISO 20022 securities-settlement message linting (ART-82) -> Merkle integrity (cry-04). Covers the binding Dec-2026 same-day machine-readable requirement.

Domain: Settlement Discipline

### Steps

1. art-81-allocation-affirmation-conformance
   on-time rate + flagged events (H1) feed the message linter
2. art-82-securities-settlement-message-linter
   message validation (H2) feeds the verifier
3. cry-04-merkle-batch-verifier
   Exports composite allocation/affirmation artifact with Merkle-root execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
