# Open Banking API Lifecycle

Open Banking API explorer > VRP mandate/SEPA validation > consent compliance audit: composite open banking API lifecycle mandate.

- Page: https://ainumbers.co/chaingraph/chains/open-banking-api-lifecycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/open-banking-api-lifecycle.md

## Workflow chain: Open Banking API Lifecycle

Open Banking API explorer > VRP mandate/SEPA validation > consent compliance audit: composite open banking API lifecycle mandate.

Domain: Open Banking / Open Finance

### Steps

1. 10-open-banking-api-explorer
   api_capabilities and endpoint_coverage feed Stage 2 VRP/SEPA mandate validation
2. 11-vrp-mandate-sepa-validator
   vrp_mandate_terms and sepa_compliance feed Stage 3 consent compliance audit
3. 03-consent-compliance-auditor
   consent_obligations and compliance_gaps - final open banking API mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
