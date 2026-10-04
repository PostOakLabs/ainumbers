# VoP Liability Evidence Pack

Payee name-match score (art-376) into a signed, hash-chained session receipt (art-377) binding the declared match result, the warning shown, and the consumer's action. Produces the evidence a PSP presents in an APP-fraud reimbursement liability review - what the check found and what happened next, not who is at fault.

- Page: https://ainumbers.co/chaingraph/chains/vop-liability-evidence.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/vop-liability-evidence.md

## Workflow chain: VoP Liability Evidence Pack

Payee name-match score (art-376) into a signed, hash-chained session receipt (art-377) binding the declared match result, the warning shown, and the consumer's action. Produces the evidence a PSP presents in an APP-fraud reimbursement liability review - what the check found and what happened next, not who is at fault.

Domain: Fraud & Dispute

### Steps

1. art-376-score-payee-name-match
   declared match score and band (H1) feed the session receipt as the match result
2. art-377-build-vop-session-receipt
   binds the match result to the warning shown and the consumer's action, exports the hash-chained receipt (H2) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A disputed instant payment is in front of us. Which name-match band did the payee verification actually record for the claim?
Run the AINumbers MCP tool `run_chain` with {"chain":"vop-liability-evidence"} and read `art-376-score-payee-name-match.match_band`.
Re-run with `inputs` for `art-376-score-payee-name-match`, reusing the values that result echoed, with `account_name` set to "Northwind Freight Solutions BV". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/vop-liability-evidence.html
