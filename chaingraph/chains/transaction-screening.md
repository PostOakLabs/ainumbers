# Transaction Screening and Rule-Building

Sanctions screening > FATF travel rule > fraud investigation.

- Page: https://ainumbers.co/chaingraph/chains/transaction-screening.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/transaction-screening.md

## Workflow chain: Transaction Screening and Rule-Building

Sanctions screening > FATF travel rule > fraud investigation.

Domain: Financial Crime & KYC

### Steps

1. 43-batch-sanctions-screening
   screening_results and hit_list feed T222 travel rule check
2. 222-fatf-travel-rule-checker
   travel_rule_status and originator_flags feed T80 fraud investigation
3. 80-fraud-investigation-lab
   Exports transaction screening Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
