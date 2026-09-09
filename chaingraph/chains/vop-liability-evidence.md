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
