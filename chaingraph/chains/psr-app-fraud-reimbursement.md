# PSR APP Fraud Reimbursement

PSR reimbursement workflow building > fraud-score simulation > payment failure analysis: composite PSR APP fraud reimbursement mandate.

- Page: https://ainumbers.co/chaingraph/chains/psr-app-fraud-reimbursement.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/psr-app-fraud-reimbursement.md

## Workflow chain: PSR APP Fraud Reimbursement

PSR reimbursement workflow building > fraud-score simulation > payment failure analysis: composite PSR APP fraud reimbursement mandate.

Domain: Fraud & Dispute

### Steps

1. 257-psr-reimbursement-workflow-builder
   reimbursement_workflow and eligibility_criteria feed Stage 2 fraud score simulation
2. 04-fraud-score-simulator
   fraud_score and detection_confidence feed Stage 3 payment failure analyser
3. 20-failure-analyser
   failure_analysis and composite_psr_mandate - final PSR APP fraud reimbursement mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
