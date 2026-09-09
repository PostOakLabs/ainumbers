# Cross-Border Payment Prevalidation Readiness Scorer

Aggregate CBPR+ pre-validation readiness check for a single pacs.008 payment instruction. Combines IBAN mod-97 check (ISO 13616), BIC format (ISO 9362), LEI format (ISO 17442, presence and format only), UUIDv4 UETR, and PostalAddress24 structure (CBPR+ Nov-2026 hybrid/fully-structured rules) into a single /ready boolean for STP gate use. Gate node for the cross-border-payment-prevalidation chain: ready=true means the instruction passes pre-validation; ready=false means remediation is required.

- Page: https://ainumbers.co/chaingraph/art-247-prevalidation-readiness-scorer.html
- Markdown twin: https://ainumbers.co/chaingraph/art-247-prevalidation-readiness-scorer.md
- MCP tool: prevalidation_readiness_scorer (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- address_building_number (unknown, required)
- address_country (unknown, required)
- address_lines (array, required)
- address_post_code (unknown, required)
- address_street_name (unknown, required)
- address_town_name (unknown, required)
- bic (unknown, required)
- iban (unknown, required)
- lei (unknown, required)
- uetr (unknown, required)

## Outputs

- cbpr_plus_deadline (string, optional)
- chain_gate_note (string, optional)
- check_details (object, optional)
- checks_passed (integer, optional)
- checks_total (integer, optional)
- pii_note (string, optional)
- readiness_pct (integer, optional)
- ready (boolean, optional)
- regulatory_basis (string, optional)
- remediation_actions (array, optional)
- table_source (string, optional)
- table_version (string, optional)

## Sample

```json
{
  "iban": "DE89370400440532013000",
  "bic": "DEUTDEFFXXX",
  "lei": "00000000000000000001",
  "uetr": "550e8400-e29b-41d4-a716-446655440000",
  "address_street_name": "Kaiserstrasse",
  "address_building_number": "29",
  "address_post_code": "60311",
  "address_town_name": "Frankfurt",
  "address_country": "DE"
}
```

## Verify

Run the sample policy_parameters through MCP tool `prevalidation_readiness_scorer` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
