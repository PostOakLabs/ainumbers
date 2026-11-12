# ISO 20022 Securities-Settlement Message Conformance

ISO 20022 securities-settlement / penalty message linting (ART-82) -> Merkle integrity over the message batch (cry-04) -> CSD/counterparty-framed cover memo (ptg-01). Scoped to the sese/semt securities family, distinct from the payments CBPR+ migration.

- Page: https://ainumbers.co/chaingraph/chains/settlement-discipline-message-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/settlement-discipline-message-conformance.md

## Workflow chain: ISO 20022 Securities-Settlement Message Conformance

ISO 20022 securities-settlement / penalty message linting (ART-82) -> Merkle integrity over the message batch (cry-04) -> CSD/counterparty-framed cover memo (ptg-01). Scoped to the sese/semt securities family, distinct from the payments CBPR+ migration.

Domain: Settlement Discipline

### Steps

1. art-82-securities-settlement-message-linter
   validation results (H1) feed the verifier
2. cry-04-merkle-batch-verifier
   batch integrity (H2) feeds the memo generator
3. ptg-01-ap2-prompt-template-generator
   Exports composite message-conformance artifact with Merkle-root execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A counterparty sent a sese.023 with an empty body. Does our linter catch the missing mandatory fields before we act on it?
Run the AINumbers MCP tool `run_chain` with {"chain":"settlement-discipline-message-conformance"} and read `art-82-securities-settlement-message-linter.fail_count`.
Re-run with `inputs` for `art-82-securities-settlement-message-linter`, reusing the values that result echoed, with `messages` changed so one received sese.023 carrying an empty body. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/settlement-discipline-message-conformance.html
