# CBPR+ Cutover Validation

Validate message structure, remittance mapping, cross-rail compatibility, and schema compliance before SWIFT CBPR+ go-live.

- Page: https://ainumbers.co/chaingraph/chains/cbpr-cutover.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/cbpr-cutover.md

## Workflow chain: CBPR+ Cutover Validation

Validate message structure, remittance mapping, cross-rail compatibility, and schema compliance before SWIFT CBPR+ go-live.

Domain: Cross-Border & Instant Payments

### Steps

1. 02-iso20022-builder
   generated_xml and validation_status feed T144 remittance validation
2. 144-iso20022-remittance-validator
   remittance_fields and mapping_errors feed T254 cross-rail check
3. 254-iso20022-cross-rail-compatibility
   compatibility_matrix and gap_list feed T98 schema validation
4. 98-iso20022-validator
   Exports ISO 20022 validation Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
