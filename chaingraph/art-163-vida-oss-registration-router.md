# ViDA OSS Registration Router

Route a supply to the correct ViDA Single VAT Registration scheme: Union OSS (EU-established supplier, cross-border B2C or stock transfer within EU), Non-Union OSS (non-EU digital or deemed services to EU consumers), IOSS (non-EU goods ≤EUR 150 to EU consumers), or Domestic VAT (same-MS supply). ViDA extends Union OSS coverage from 2028-07-01. Returns recommended_scheme, scheme_rationale, and eligible_for_oss. Middle node of the vida-platform-and-registration chain. Zero network, zero PII. EU 2025/516.

- Page: https://ainumbers.co/chaingraph/art-163-vida-oss-registration-router.html
- Markdown twin: https://ainumbers.co/chaingraph/art-163-vida-oss-registration-router.md
- MCP tool: route_vida_oss_registration (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "supply": {
    "supply_type": "B2C_digital",
    "seller_establishment": "DE",
    "destination_member_state": "FR"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `route_vida_oss_registration` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
