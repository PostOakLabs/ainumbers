# Remittance Disclosure Calculator (Reg E Subpart B)

Computes the required Reg E subpart B (12 CFR 1005.31/1005.32) remittance disclosure fields: transfer_amount_usd (send minus fees), exchange_rate_disclosed, amount_received_dest in destination currency, fees breakdown, total_to_sender_usd, disclosure_type (EXACT or ESTIMATED), estimate_permissible flag, and accounting identity check. Pre-transfer receipt anchor point for CFPB exam and error-resolution disputes (12 CFR 1005.33). ZERO PII: amounts, rates, fees, and taxes only. Gate node for the remittance-disclosure-and-corridor-cost chain.

- Page: https://ainumbers.co/chaingraph/art-248-compute-remittance-disclosure.html
- Markdown twin: https://ainumbers.co/chaingraph/art-248-compute-remittance-disclosure.md
- MCP tool: compute_remittance_disclosure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- destination_country (unknown, required)
- destination_currency (unknown, required)
- estimate_permissible (boolean, required)
- exchange_rate (unknown, required)
- provider_fee (unknown, required)
- send_amount (unknown, required)
- taxes (unknown, required)
- third_party_fees (unknown, required)

## Outputs

- accounting_identity_delta (integer, optional)
- accounting_identity_ok (boolean, optional)
- amount_received_dest (number, optional)
- anchor_surface (string, optional)
- destination_country (string, optional)
- destination_currency (string, optional)
- disclosure_type (string, optional)
- estimate_permissible (boolean, optional)
- exchange_rate_disclosed (number, optional)
- fees (object, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- required_fields_complete (boolean, optional)
- table_source (string, optional)
- table_version (string, optional)
- total_to_sender_usd (integer, optional)
- transfer_amount_usd (number, optional)

## Sample

```json
{
  "send_amount": 1000,
  "exchange_rate": 17.15,
  "provider_fee": 2.99,
  "third_party_fees": 0,
  "taxes": 0,
  "destination_currency": "MXN",
  "destination_country": "MX",
  "estimate_permissible": false
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_remittance_disclosure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
