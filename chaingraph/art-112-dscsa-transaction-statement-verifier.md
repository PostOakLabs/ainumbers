# DSCSA Transaction Statement (T3) Verifier

Verify the DSCSA T3 set (Transaction Information + History + Statement) completeness, validate the GS1 SGTIN, and map the EPCIS 2.0 event type. Feeds the saleable-returns verifier (art-113). DSCSA §582: enforcement live since Aug 2025.

- Page: https://ainumbers.co/chaingraph/art-112-dscsa-transaction-statement-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-112-dscsa-transaction-statement-verifier.md
- MCP tool: verify_dscsa_transaction_statement (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- epcis_event_type (unknown, optional)
- expiry (unknown, optional)
- gln_buyer (unknown, optional)
- gln_seller (unknown, optional)
- lot (unknown, optional)
- product_identifier (unknown, optional)
- th_present (unknown, optional)
- ti_present (unknown, optional)
- transaction_date (unknown, optional)
- ts_present (unknown, optional)

## Outputs

- epcis_event (string, optional)
- identifier_valid (boolean, optional)
- missing_elements (array, optional)
- t3_complete (boolean, optional)
- transaction_date (string, optional)

## Sample

```json
{
  "product_identifier": "00312345678906.SN12345",
  "lot": "L2026A",
  "expiry": "2027-12-31",
  "ti_present": true,
  "th_present": true,
  "ts_present": true,
  "gln_seller": "0312345000009",
  "gln_buyer": "0312345000016",
  "epcis_event_type": "shipping",
  "transaction_date": "2026-06-01"
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_dscsa_transaction_statement` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
