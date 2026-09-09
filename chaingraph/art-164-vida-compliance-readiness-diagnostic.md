# ViDA Compliance Readiness Diagnostic

Scored ViDA readiness diagnostic across four dimensions: einvoice (EN 16931-1:2026 ready), drr (DRR reporting pipeline ready), platform (deemed-supplier assessed or not applicable), and oss (OSS/SVR scheme configured or not applicable). Returns readiness_score (0–100), gaps list, fully_ready boolean, and phased obligation timeline (2028-07-01 platform+SVR, 2030-07-01 DRR+e-invoice mandatory, 2035-01-01 legacy regime harmonization). Terminal node of the vida-platform-and-registration chain. Zero network, zero PII. EU 2025/516.

- Page: https://ainumbers.co/chaingraph/art-164-vida-compliance-readiness-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-164-vida-compliance-readiness-diagnostic.md
- MCP tool: run_vida_readiness_diagnostic (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "entity": {
    "einvoice_ready": true,
    "drr_ready": true,
    "platform_not_applicable": true,
    "oss_scheme_configured": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_vida_readiness_diagnostic` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
