# TFR Travel-Rule Batch Validator

Validates originator/beneficiary field completeness on synthetic/hashed transfer batches (self-/cross-CASP + unhosted-wallet branches) per TFR recast Reg. (EU) 2023/1113. Batch conformance + Merkle root. No real PII.

- Page: https://ainumbers.co/chaingraph/art-104-tfr-travel-rule-batch-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-104-tfr-travel-rule-batch-validator.md
- MCP tool: validate_tfr_travel_rule_batch (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- inputs (unknown, optional)

## Outputs

- batch_conformance_pct (integer, optional)
- batch_size (integer, optional)
- merkle_root (string, optional)
- note (string, optional)
- reference_version (string, optional)
- tfr_note (string, optional)
- transfers_flagged (array, optional)
- unhosted_dd_required_count (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_tfr_travel_rule_batch` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
