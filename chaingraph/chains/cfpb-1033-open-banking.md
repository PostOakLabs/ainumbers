# CFPB 1033 Open Banking Compliance

Institution classification > data-rights scope > TPPP authorisation mapping: composite CFPB 1033 open-banking mandate.

- Page: https://ainumbers.co/chaingraph/chains/cfpb-1033-open-banking.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/cfpb-1033-open-banking.md

## Workflow chain: CFPB 1033 Open Banking Compliance

Institution classification > data-rights scope > TPPP authorisation mapping: composite CFPB 1033 open-banking mandate.

Domain: Open Banking / Open Finance

### Steps

1. 165-cfpb-1033-institution-classifier
   institution_classification and covered_data_types feed Stage 2 data-rights scoping
2. 166-cfpb-1033-data-rights-scoper
   data_rights_scope and consumer_entitlements feed Stage 3 TPPP mapping
3. 167-cfpb-1033-tppp-mapper
   tppp_authorisation_map and compliance_gaps - final CFPB 1033 mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
