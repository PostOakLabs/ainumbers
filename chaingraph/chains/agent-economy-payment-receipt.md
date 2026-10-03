# AP2 PaymentReceipt Verification & HNP Guardrail

W-B. PaymentReceipt-to-mandate verification + Human-Not-Present autonomy gate (ART-62) -> mandate-chain re-validation (art-01) -> receipt aggregation (cry-05). Verifies an autonomous AP2 payment after the fact: valid receipt, intact mandate chain, in-policy autonomy.

- Page: https://ainumbers.co/chaingraph/chains/agent-economy-payment-receipt.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/agent-economy-payment-receipt.md

## Workflow chain: AP2 PaymentReceipt Verification & HNP Guardrail

W-B. PaymentReceipt-to-mandate verification + Human-Not-Present autonomy gate (ART-62) -> mandate-chain re-validation (art-01) -> receipt aggregation (cry-05). Verifies an autonomous AP2 payment after the fact: valid receipt, intact mandate chain, in-policy autonomy.

Domain: Agent Economy

### Steps

1. art-62-ap2-payment-receipt-verifier
   receipt_verdict and hnp_verdict (H1) feed the mandate-chain validator
2. art-01-ap2-mandate-chain-validator
   mandate-chain verdict (H2) feeds the aggregator
3. cry-05-agent-action-audit-trail-aggregator
   Exports composite payment-receipt artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: After an agent payment executes, what is the one session receipt root we can hand our auditor?
Run the AINumbers MCP tool `run_chain` with {"chain":"agent-economy-payment-receipt"} and read `cry-05-agent-action-audit-trail-aggregator.session_receipt_root`.
Re-run with `inputs` for `cry-05-agent-action-audit-trail-aggregator`, reusing the values that result echoed, with `artifacts` changed so one executed payment receipt joins the evidence. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/agent-economy-payment-receipt.html
