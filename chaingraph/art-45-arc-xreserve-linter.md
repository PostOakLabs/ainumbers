# Arc xReserve Config Linter

8-check A–F linter for an Arc xReserve / on-chain reserve configuration. Checks: reserve sum=100%, GENIUS Act §4 eligible assets (US issuers), GENIUS §4(a)(11) yield prohibition (US PPSIs), MiCA Art. 54 (EU EMIs), USYC composition (0–80% pass), CCTP v2 domains ≥2, attestation cadence, mint/burn role segregation.

- Page: https://ainumbers.co/chaingraph/art-45-arc-xreserve-linter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-45-arc-xreserve-linter.md
- MCP tool: lint_arc_xreserve_config (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- attestation_cadence (any, optional): type not evidenced by kernel source
- cctp_domains (any, optional): type not evidenced by kernel source
- is_eu_emt (any, optional): type not evidenced by kernel source
- is_us_ppsi (any, optional): type not evidenced by kernel source
- mint_role_segregated (any, optional): type not evidenced by kernel source
- other_pct (any, optional): Percentage value; type not evidenced by kernel source
- reserve_segregated (any, optional): type not evidenced by kernel source
- us_issuers_only (any, optional): type not evidenced by kernel source
- usdc_pct (any, optional): Percentage value; type not evidenced by kernel source
- usyc_pct (any, optional): Percentage value; type not evidenced by kernel source
- yield_enabled (any, optional): type not evidenced by kernel source

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
