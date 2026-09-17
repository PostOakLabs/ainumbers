# Arc xReserve Config Linter

8-check A–F linter for an Arc xReserve / on-chain reserve configuration. Checks: reserve sum=100%, GENIUS Act §4 eligible assets (US issuers), GENIUS §4(a)(11) yield prohibition (US PPSIs), MiCA Art. 54 (EU EMIs), USYC composition (0–80% pass), CCTP v2 domains ≥2, attestation cadence, mint/burn role segregation.

- Page: https://ainumbers.co/chaingraph/art-45-arc-xreserve-linter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-45-arc-xreserve-linter.md
- MCP tool: lint_arc_xreserve_config (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- attestation_cadence (unknown, optional)
- cctp_domains (unknown, optional)
- is_eu_emt (unknown, optional)
- is_us_ppsi (unknown, optional)
- mint_role_segregated (unknown, optional)
- other_pct (unknown, optional): Percentage value
- reserve_segregated (unknown, optional)
- us_issuers_only (unknown, optional)
- usdc_pct (unknown, optional): Percentage value
- usyc_pct (unknown, optional): Percentage value
- yield_enabled (unknown, optional)

## Outputs

- verdict (string, optional)
- grade (string, optional)
- fail_count (integer, optional)
- warn_count (integer, optional)
- compliance_flags (array, optional)

## Sample

```json
{
  "usdc_pct": 70,
  "usyc_pct": 25,
  "other_pct": 5,
  "us_issuers_only": true,
  "yield_enabled": false,
  "is_us_ppsi": true,
  "is_eu_emt": false,
  "reserve_segregated": false,
  "cctp_domains": 3,
  "attestation_cadence": "monthly",
  "mint_role_segregated": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_arc_xreserve_config` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
