# MAR-Crypto Surveillance-Readiness Assessor

Scores market-abuse arrangements (Arts 86-92 + Dec-2024 RTS): PPAET (prevention/detection), STOR templates, insider lists, manipulation-pattern config on synthetic order batches. Readiness grade + STOR-template completeness.

- Page: https://ainumbers.co/chaingraph/art-103-mar-crypto-surveillance-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/art-103-mar-crypto-surveillance-readiness.md
- MCP tool: assess_mar_crypto_surveillance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- inputs (unknown, optional)

## Outputs

- arrangement_scores (object, optional)
- assets_in_scope (integer, optional)
- composite_pct (integer, optional)
- gaps (array, optional)
- mar_rts_note (string, optional)
- note (string, optional)
- ppaet_status (string, optional)
- reference_version (string, optional)
- stor_ready (boolean, optional)
- surveillance_grade (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_mar_crypto_surveillance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
