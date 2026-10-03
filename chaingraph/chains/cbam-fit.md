# Carbon & Climate Compliance Fit Diagnostic

Single-node D0 diagnostic classifying which carbon/climate obligations bind a firm (CBAM authorised-declarant duty, EU Taxonomy alignment, EU Green Bond conformance, climate stress) and routing to the right carbon-compliance chain; separates in-force CBAM liability (since 1 Jan 2026) from prepare-ahead items.

- Page: https://ainumbers.co/chaingraph/chains/cbam-fit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/cbam-fit.md

## Workflow chain: Carbon & Climate Compliance Fit Diagnostic

Single-node D0 diagnostic classifying which carbon/climate obligations bind a firm (CBAM authorised-declarant duty, EU Taxonomy alignment, EU Green Bond conformance, climate stress) and routing to the right carbon-compliance chain; separates in-force CBAM liability (since 1 Jan 2026) from prepare-ahead items.

Domain: CBAM

### Steps

1. art-68-carbon-compliance-fit-diagnostic
   verdicts route to carbon-compliance-liability / carbon-compliance-precursor / taxonomy-align / taxonomy-kpi / eugb-conformance / climate-scenario / carbon-audit-pack

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our CBAM goods imports passed the annual tonnage threshold. Does the fit check flag an authorised-declarant obligation?
Run the AINumbers MCP tool `run_chain` with {"chain":"cbam-fit"} and read `art-68-carbon-compliance-fit-diagnostic.cbam_declarant_required`.
Re-run with `inputs` for `art-68-carbon-compliance-fit-diagnostic`, reusing the values that result echoed, with `imports_cbam_goods` set to "above-50t". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/cbam-fit.html
