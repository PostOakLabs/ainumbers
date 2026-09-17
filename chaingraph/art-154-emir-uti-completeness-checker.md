# EMIR UTI Completeness Checker

Validate EMIR Refit UTI format (ISO 23897, 52 alphanumeric characters max), generating-party identity, and T+1 sharing timing: UTI must be shared with the other counterparty by 10:00 CET next business day (approximately 34-hour window). Caller supplies Unix timestamps. Catches late or malformed UTIs before Trade Repository submission. Feeds UPI validator (art-155).

- Page: https://ainumbers.co/chaingraph/art-154-emir-uti-completeness-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-154-emir-uti-completeness-checker.md
- MCP tool: check_emir_uti_completeness (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "uti": "UTI001EXAMPLE2024042901",
  "generating_party": "MAES062Z21O4RZ2U7M96",
  "trade_unix": 1714348800,
  "uti_shared_unix": 1714406400
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_emir_uti_completeness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
