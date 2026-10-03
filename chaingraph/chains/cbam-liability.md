# CBAM Import Liability & Certificate Declaration

W-A flagship. Embedded-emissions calculation (ART-69) -> default-value resolution (ART-70) -> certificate cost + free-allocation phase-out + holding/surrender schedule (ART-71). The importer-to-customs CBAM declaration lifecycle end-to-end. Decision-support draft, not a filed declaration.

- Page: https://ainumbers.co/chaingraph/chains/cbam-liability.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/cbam-liability.md

## Workflow chain: CBAM Import Liability & Certificate Declaration

W-A flagship. Embedded-emissions calculation (ART-69) -> default-value resolution (ART-70) -> certificate cost + free-allocation phase-out + holding/surrender schedule (ART-71). The importer-to-customs CBAM declaration lifecycle end-to-end. Decision-support draft, not a filed declaration.

Domain: CBAM

### Steps

1. art-70-cbam-default-value-resolver
   resolved default value + markup (H1) feeds the emissions calculator
2. art-69-cbam-embedded-emissions-calculator
   total embedded emissions (H2) feed the certificate-cost engine
3. art-71-cbam-certificate-cost-engine
   Exports composite CBAM liability artifact with execution_hash (H3) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: We import iron and steel on default emissions values while paying a carbon price at origin. What CBAM certificate cost follows?
Run the AINumbers MCP tool `run_chain` with {"chain":"cbam-liability"} and read `art-71-cbam-certificate-cost-engine.certificate_liability_eur`.
Re-run with `inputs` for `art-71-cbam-certificate-cost-engine`, reusing the values that result echoed, with `origin_carbon_price_eur_per_t` changed so no origin carbon price applies, so it is 0. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/cbam-liability.html
