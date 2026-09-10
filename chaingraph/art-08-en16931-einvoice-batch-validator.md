# EN 16931 / Factur-X E-Invoicing Batch Validator

Batch validation of e-invoices against EN 16931 mandatory fields, VAT logic, and country profiles. France mandatory September 2026; SMEs September 2027.

- Page: https://ainumbers.co/chaingraph/art-08-en16931-einvoice-batch-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-08-en16931-einvoice-batch-validator.md
- MCP tool: validate_einvoice_batch (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_einvoice_batch` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
