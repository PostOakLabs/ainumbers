# pacs.008 Party Completeness Validator

Validates BIS CPMI d218 harmonised data requirements for a pacs.008 payment instruction: UETR UUIDv4 format, debtor and creditor names, BIC format, LEI format (presence and format; full mod-97 check-digit validation is in lint_lei_payment_binding art-246), and purpose code format. Outputs a CPMI d218 completeness score. Does not validate PostalAddress24 structure (use lint_cbpr_structured_address art-241) or PQC crypto readiness (use check_iso20022_pqc_readiness art-87).

- Page: https://ainumbers.co/chaingraph/art-242-pacs008-party-completeness-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-242-pacs008-party-completeness-validator.md
- MCP tool: validate_pacs008_party_completeness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- creditor_agent_bic (unknown, required)
- creditor_lei (unknown, required)
- creditor_name (unknown, required)
- debtor_agent_bic (unknown, required)
- debtor_lei (unknown, required)
- debtor_name (unknown, required)
- purpose_code (unknown, required)
- uetr (unknown, required)

## Outputs

- compliant (boolean, optional)
- cpmi_d218_score (integer, optional)
- disambiguation (string, optional)
- error_count (integer, optional)
- field_status (object, optional)
- issues (array, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- warning_count (integer, optional)

## Sample

```json
{
  "uetr": "550e8400-e29b-41d4-a716-446655440000",
  "debtor_name": "Acme Corp GmbH",
  "creditor_name": "Global Trade AG",
  "debtor_agent_bic": "DEUTDEFFXXX",
  "creditor_agent_bic": "BARCGB22XXX",
  "debtor_lei": "00000000000000000001",
  "creditor_lei": "00000000000000000001",
  "purpose_code": "TRAD"
}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_pacs008_party_completeness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
