# Instant Payments Compliance

FedNow service lookup and reachability > instant payment limits assessment > pay-by-bank prototyping: composite instant payments compliance mandate.

- Page: https://ainumbers.co/chaingraph/chains/instant-payments-compliance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/instant-payments-compliance.md

## Workflow chain: Instant Payments Compliance

FedNow service lookup and reachability > instant payment limits assessment > pay-by-bank prototyping: composite instant payments compliance mandate.

Domain: Cross-Border & Instant Payments

### Steps

1. 06-fednow-lookup
   fednow_reachability and participant_status feed Stage 2 instant payment limits
2. 17-instant-payment-limits
   limit_analysis and velocity_constraints feed Stage 3 pay-by-bank prototyping
3. 08-pay-by-bank-prototyper
   pay_by_bank_design and composite_instant_payments_mandate - final instant payments mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
