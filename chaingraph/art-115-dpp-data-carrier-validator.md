# EU ESPR Digital Product Passport Data Carrier Validator

Validate DPP required data elements against the CIRPASS-2 Core Ontology (durability, reparability, recyclability, carbon footprint, substances of concern) and check GS1 Digital Link data-carrier type. EU ESPR: Central DPP Registry live 19 Jul 2026.

- Page: https://ainumbers.co/chaingraph/art-115-dpp-data-carrier-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-115-dpp-data-carrier-validator.md
- MCP tool: validate_dpp_data_carrier (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- data_carrier_type (unknown, optional)
- elements (unknown, optional)
- ontology_version (unknown, optional)
- product_id (unknown, optional)

## Outputs

- carrier_valid (boolean, optional)
- missing_elements (array, optional)
- ontology_conformant (boolean, optional)
- ontology_version (string, optional)
- product_id (string, optional)

## Sample

```json
{
  "product_id": "GS1-DL-8712345678901",
  "data_carrier_type": "qr_gs1_digital_link",
  "elements": {
    "unique_product_identifier": "8712345678901",
    "lookup_mechanism": "https://id.gs1.org/01/8712345678901",
    "durability": "10 years",
    "reparability": "Consumer repairable — 7 spare parts available",
    "recyclability": "95% recyclable by weight",
    "carbon_footprint": "12.4 kgCO2e",
    "substances_of_concern": "none declared"
  },
  "ontology_version": "CIRPASS-2-2025-03"
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_dpp_data_carrier` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
