# VoP Batch Match-Rate Analyser

Batch IBAN-name matching: match/close-match/no-match classification, configurable strictness (exact/normalized/fuzzy), false-positive vs false-negative trade-off curves, per-corridor mismatch-rate distribution. Upgrades T289 to full ChainGraph export schema.

- Page: https://ainumbers.co/chaingraph/art-11-vop-batch-match-rate-analyser.html
- Markdown twin: https://ainumbers.co/chaingraph/art-11-vop-batch-match-rate-analyser.md
- MCP tool: simulate_vop_matching (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- close_match_threshold (unknown, required)
- match_threshold (unknown, required)
- payees (array, required)

## Outputs

- close_match (integer, optional)
- match (integer, optional)
- match_rate_pct (integer, optional)
- no_match (integer, optional)
- total_records (integer, optional)

## Sample

```json
{
  "payees": [
    {
      "account_name": "Acme Corporation",
      "reference_name": "Acme Corp"
    },
    {
      "account_name": "Globex International",
      "reference_name": "Globex International"
    },
    {
      "account_name": "Initech Solutions Ltd",
      "reference_name": "Initech Solutions Limited"
    },
    {
      "account_name": "Umbrella Financial",
      "reference_name": "Umbrella Financial"
    },
    {
      "account_name": "Hooli Technologies",
      "reference_name": "Hooli Technologies Inc"
    }
  ],
  "match_threshold": 0.9,
  "close_match_threshold": 0.75
}
```

## Verify

Run the sample policy_parameters through MCP tool `simulate_vop_matching` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
