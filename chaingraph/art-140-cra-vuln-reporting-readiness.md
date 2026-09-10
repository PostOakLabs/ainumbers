# CRA Vulnerability Reporting Readiness (Art. 14)

Assesses EU CRA Article 14 vulnerability reporting readiness: actively_exploited_detection, 24-hour early_warning_24h_process, 72-hour notification_72h_process, csirt_enisa_endpoint_configured, and coordinated_disclosure_policy. Obligation date: 11 Sep 2026. Penalty: up to €15M or 2.5% global turnover. Emits vuln_reporting_ready verdict with PDF export. Terminal stage of cra-product-conformance chain.

- Page: https://ainumbers.co/chaingraph/art-140-cra-vuln-reporting-readiness.html
- Markdown twin: https://ainumbers.co/chaingraph/art-140-cra-vuln-reporting-readiness.md
- MCP tool: assess_cra_vuln_reporting_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- actively_exploited_detection (unknown, optional)
- coordinated_disclosure_policy (unknown, optional)
- csirt_enisa_endpoint_configured (unknown, optional)
- early_warning_24h_process (unknown, optional)
- notification_72h_process (unknown, optional)

## Outputs

- gaps (array, optional)
- vuln_reporting_ready (boolean, optional)

## Sample

```json
{
  "actively_exploited_detection": true,
  "early_warning_24h_process": true,
  "notification_72h_process": true,
  "csirt_enisa_endpoint_configured": true,
  "coordinated_disclosure_policy": true
}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_cra_vuln_reporting_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
