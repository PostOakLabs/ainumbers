# Card Programme

Launch readiness > interchange qualification > PCI-DSS scope > 3DS/EMV compliance > scheme fee benchmarking.

- Page: https://ainumbers.co/chaingraph/chains/card-programme.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/card-programme.md

## Workflow chain: Card Programme

Launch readiness > interchange qualification > PCI-DSS scope > 3DS/EMV compliance > scheme fee benchmarking.

Domain: Card & Payment Economics

### Steps

1. 163-card-programme-launch-readiness-checker
   readiness_score and gap_list feed Stage 2 interchange qualification
2. 225-visa-mc-interchange-qualification-tester
   ic_category and qualification_flags feed Stage 3 PCI scope
3. 226-pci-dss-v4-scope-wizard
   scope_components and cde_boundaries feed Stage 4 3DS/EMV check
4. 228-3ds-emv-compliance-checker
   compliance_status and exemptions feed Stage 5 scheme benchmarking
5. 233-card-scheme-fee-benchmarking
   Exports card programme Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
