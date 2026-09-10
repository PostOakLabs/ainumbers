# E-Invoicing & ViDA Digital Reporting

DRR readiness > B2B e-invoice compliance (EN16931) > Peppol XML audit > invoice-to-ISO20022 bridge > e-invoicing compliance mandate.

- Page: https://ainumbers.co/chaingraph/chains/einvoicing-vida.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/einvoicing-vida.md

## Workflow chain: E-Invoicing & ViDA Digital Reporting

DRR readiness > B2B e-invoice compliance (EN16931) > Peppol XML audit > invoice-to-ISO20022 bridge > e-invoicing compliance mandate.

Domain: ViDA / E-Invoicing

### Steps

1. 179-vida-drr-readiness-scorer
   drr_gaps feed Stage 2 e-invoice compliance scoring
2. 180-b2b-einvoice-compliance-scorer
   compliance_score and field_errors feed Stage 3 XML audit
3. 174-peppol-xml-auditor
   xml_validation_results feed Stage 4 ISO 20022 bridge
4. 178-invoice-to-iso20022-bridge
   Exports e-invoicing Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
