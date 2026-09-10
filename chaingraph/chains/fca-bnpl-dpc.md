# FCA BNPL Digital Private Credit

FCA DPC scope classification > DPC creditworthiness assessment > consumer duty DPC mapping: composite FCA BNPL/DPC mandate.

- Page: https://ainumbers.co/chaingraph/chains/fca-bnpl-dpc.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/fca-bnpl-dpc.md

## Workflow chain: FCA BNPL Digital Private Credit

FCA DPC scope classification > DPC creditworthiness assessment > consumer duty DPC mapping: composite FCA BNPL/DPC mandate.

Domain: Consumer & Wealth Compliance

### Steps

1. 329-fca-dpc-scope-classifier
   dpc_scope and authorisation_requirements feed Stage 2 creditworthiness assessment
2. 330-fca-dpc-creditworthiness-assessment-builder
   creditworthiness_methodology and affordability_checks feed Stage 3 consumer duty mapping
3. 331-fca-consumer-duty-dpc-mapper
   consumer_duty_obligations and composite_dpc_mandate - final FCA BNPL/DPC mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
