# ISO 20022 Structured-Address Migration Batch Verifier

GPU-parallel validation of PostalAddress24 fields across pacs.008 messages (up to 500k). Country-specific rules (UK postcode, DE Postleitzahl, US ZIP+4), MT103 :50K: truncation-risk flagging, November-2026 readiness score.

- Page: https://ainumbers.co/chaingraph/rca-03-iso20022-address-migration-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/rca-03-iso20022-address-migration-verifier.md
- MCP tool: verify_address_migration_batch (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- records (unknown, required)
- strictness (unknown, optional)
- trunc_threshold (unknown, optional)

## Outputs

- batch_summary (object, optional)
- compliance_flags (array, optional)
- failing_records (array, optional)
- november_2026_readiness_pct (integer, optional)
- verdict (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_address_migration_batch` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
