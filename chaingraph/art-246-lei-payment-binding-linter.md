# Wolfsberg Payment Transparency & LEI Binding Linter

Full ISO 17442 LEI check-digit validation via ISO 7064 Mod 97-10 for originator and beneficiary LEIs in pacs.008. Also scores Wolfsberg Payment Transparency Standards across six fields (originator name, account, LEI; beneficiary name, account, LEI) and assigns a transparency tier (HIGH, MEDIUM, LOW). LEIs are public GLEIF registry data - no PII involved. For format-only LEI checks within broader party completeness validation use validate_pacs008_party_completeness (art-242).

- Page: https://ainumbers.co/chaingraph/art-246-lei-payment-binding-linter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-246-lei-payment-binding-linter.md
- MCP tool: lint_lei_payment_binding (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- beneficiary_account (unknown, required)
- beneficiary_lei (unknown, required)
- beneficiary_name (unknown, required)
- originator_account (unknown, required)
- originator_lei (unknown, required)
- originator_name (unknown, required)

## Outputs

- error_count (integer, optional)
- issues (array, optional)
- lei_results (object, optional)
- lei_valid (boolean, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- wolfsberg_field_results (array, optional)
- wolfsberg_transparency_score (integer, optional)
- wolfsberg_transparency_tier (string, optional)

## Sample

```json
{
  "originator_lei": "00000000000000000001",
  "beneficiary_lei": "00000000000000000001",
  "originator_name": "Synthetic Bank AG",
  "originator_account": "DE89370400440532013000",
  "beneficiary_name": "Test Recipient Corp",
  "beneficiary_account": "GB82WEST12345698765432"
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_lei_payment_binding` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
