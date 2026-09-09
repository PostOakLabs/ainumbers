# Parametric Trigger Adjudication

Gated two-step chain for parametric insurance trigger adjudication and cat bond term validation. Step 1 evaluates the parametric trigger (threshold / tiered / linear_index) and emits trigger_hit and payout_amount. Gate on /trigger_hit: if false (trigger not fired), the chain ends - no payout, no bond validation needed. If true (default), Step 2 validates the cat bond trigger terms (attachment/exhaustion ordering, pro-rata arithmetic, layer position). Outputs a tamper-evident trigger receipt anchored at anchor.ainumbers.co/mcp for neutral dispute adjudication per IAIS ICP 19. ZERO PII BY CONSTRUCTION.

- Page: https://ainumbers.co/chaingraph/chains/parametric-trigger-adjudication.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/parametric-trigger-adjudication.md

## Workflow chain: Parametric Trigger Adjudication

Gated two-step chain for parametric insurance trigger adjudication and cat bond term validation. Step 1 evaluates the parametric trigger (threshold / tiered / linear_index) and emits trigger_hit and payout_amount. Gate on /trigger_hit: if false (trigger not fired), the chain ends - no payout, no bond validation needed. If true (default), Step 2 validates the cat bond trigger terms (attachment/exhaustion ordering, pro-rata arithmetic, layer position). Outputs a tamper-evident trigger receipt anchored at anchor.ainumbers.co/mcp for neutral dispute adjudication per IAIS ICP 19. ZERO PII BY CONSTRUCTION.

Domain: Insurance & Reinsurance

### Steps

1. art-251-compute-parametric-trigger-payout
   Trigger evaluation result including trigger_hit boolean, payout_amount, trigger_fraction, and trigger_receipt. Gate on /trigger_hit: false exits - no payout triggered. Default (true): proceed to cat bond term validation.
2. art-252-validate-cat-bond-trigger-terms
   Cat bond layer position (BELOW_ATTACHMENT / WITHIN_LAYER / ABOVE_EXHAUSTION), pro-rata factor, and payout_amount. Final stage - anchor both execution_hashes for a two-node trigger receipt.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
