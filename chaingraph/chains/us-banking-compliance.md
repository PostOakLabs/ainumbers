# US Consumer-Banking Compliance

HMDA reportability > BSA/SAR filing adequacy > Reg E dispute timelines > Durbin interchange analysis > consumer-banking compliance mandate.

- Page: https://ainumbers.co/chaingraph/chains/us-banking-compliance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/us-banking-compliance.md

## Workflow chain: US Consumer-Banking Compliance

HMDA reportability > BSA/SAR filing adequacy > Reg E dispute timelines > Durbin interchange analysis > consumer-banking compliance mandate.

Domain: Consumer & Wealth Compliance

### Steps

1. 444-hmda-reportability-checker
   reportable_loans and data_gaps feed Stage 2 BSA/SAR check
2. 445-bsa-sar-filing-adequacy-checker
   sar_adequacy_flags feed Stage 3 Reg E workflow
3. 442-reg-e-dispute-workflow-builder
   dispute_timelines feed Stage 4 Durbin analysis
4. 443-durbin-amendment-interchange-analyzer
   Exports consumer-banking compliance Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
