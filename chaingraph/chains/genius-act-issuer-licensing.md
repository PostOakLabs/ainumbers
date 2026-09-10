# GENIUS Act Issuer Licensing

Issuer classification mapping > reserve attestation checklist > AML/sanctions scope building > state-federal licensing path selection > disclosure and reporting builder: composite GENIUS Act issuer mandate.

- Page: https://ainumbers.co/chaingraph/chains/genius-act-issuer-licensing.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/genius-act-issuer-licensing.md

## Workflow chain: GENIUS Act Issuer Licensing

Issuer classification mapping > reserve attestation checklist > AML/sanctions scope building > state-federal licensing path selection > disclosure and reporting builder: composite GENIUS Act issuer mandate.

Domain: Digital-Asset Rails

### Steps

1. 336-genius-act-issuer-classification-mapper
   issuer_classification and regulatory_pathway feed Stage 2 reserve attestation
2. 337-genius-act-reserve-attestation-checklist
   reserve_requirements and attestation_gaps feed Stage 3 AML/sanctions scope
3. 338-genius-act-aml-sanctions-scope-builder
   aml_programme_requirements and sanctions_controls feed Stage 4 licensing path
4. 387-genius-act-state-federal-licensing-path-selector
   licensing_pathway and jurisdiction_plan feed Stage 5 disclosure/reporting builder
5. 389-genius-act-disclosure-reporting-builder
   disclosure_requirements and reporting_schedule - final GENIUS Act issuer mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
