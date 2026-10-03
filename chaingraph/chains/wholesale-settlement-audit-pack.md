# Wholesale Tokenized Settlement Audit Pack

W-G convergence terminal. Merkle integrity over the settlement decision set (cry-04) -> one Merkle-root audit receipt (cry-05) -> regulator/custodian-framed cover memo (ptg-01). Other chains can feed in.

- Page: https://ainumbers.co/chaingraph/chains/wholesale-settlement-audit-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/wholesale-settlement-audit-pack.md

## Workflow chain: Wholesale Tokenized Settlement Audit Pack

W-G convergence terminal. Merkle integrity over the settlement decision set (cry-04) -> one Merkle-root audit receipt (cry-05) -> regulator/custodian-framed cover memo (ptg-01). Other chains can feed in.

Domain: Wholesale Settlement

### Steps

1. cry-04-merkle-batch-verifier
   batch integrity (H1) feeds the aggregator
2. cry-05-agent-action-audit-trail-aggregator
   Merkle-root receipt (H2) feeds the memo generator
3. ptg-01-ap2-prompt-template-generator
   Exports composite audit pack with Merkle-root execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: For the examiner file on this settlement batch, what briefing does the evidence pack draft, and for whom?
Run the AINumbers MCP tool `run_chain` with {"chain":"wholesale-settlement-audit-pack"} and read `ptg-01-ap2-prompt-template-generator.generated_prompt`.
Re-run with `inputs` for `ptg-01-ap2-prompt-template-generator`, reusing the values that result echoed, with `audience` set to "regulator". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/wholesale-settlement-audit-pack.html
