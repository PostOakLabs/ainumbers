# E-Invoice Jurisdiction Mandate Router

Deterministic lookup over a version-pinned mandate table: given supplier/buyer country, transaction type, and transaction date, routes to the applicable e-invoicing regime, format, phase status, and transmission channel. Covers France (PDP, B2B receive obligation live 2026-09-01), Germany (XRechnung), UAE (PINT-AE pilot), Malaysia (MyInvois), Belgium (Peppol BIS 3.0, mandatory since 2026-01-01), and Poland (KSeF FA(3), mandatory-use phase-in from 2026-02-01). Third node of the einvoice-validation-pipeline chain. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-295-einvoice-jurisdiction-mandate-router.html
- Markdown twin: https://ainumbers.co/chaingraph/art-295-einvoice-jurisdiction-mandate-router.md
- MCP tool: route_einvoice_jurisdiction_mandate (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- buyer_country (string, required)
- supplier_country (string, required)
- transaction_date (unknown, required)
- transaction_type (unknown, required)

## Outputs

- applicable_format (string, optional)
- mandatory_from (string, optional)
- phase_status (string, optional)
- regime_country (string, optional)
- table_version (string, optional)
- transmission_channel (string, optional)

## Sample

```json
{
  "supplier_country": "DE",
  "buyer_country": "FR",
  "transaction_type": "B2B",
  "transaction_date": "2026-09-15"
}
```

## Verify

Run the sample policy_parameters through MCP tool `route_einvoice_jurisdiction_mandate` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
