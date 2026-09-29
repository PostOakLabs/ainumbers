# Allocation/Affirmation Conformance Checker

Checks allocation and confirmation/affirmation events against the ESMA CSDR SDR RTS 23:00 CET trade-date rule and the machine-readable-format mandate (binding Dec 2026). Computes per-event pass/fail and batch on-time rate.

- Page: https://ainumbers.co/chaingraph/art-81-allocation-affirmation-conformance.html
- Markdown twin: https://ainumbers.co/chaingraph/art-81-allocation-affirmation-conformance.md
- MCP tool: check_allocation_affirmation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cutoff_timezone_reading (string, optional)
- early_allocation_agreement (boolean, optional)
- events (array, required)
- firm_close_of_business (string, optional)
- firm_start_of_business (string, optional)
- logical_date (string, required)
- regime (string, optional)
- rule_version (string, optional)
- source_digests (array, optional)

## Outputs

- status (string, optional)
- on_time_rate (number,null, optional)
- rate_basis (string, optional)
- counts (object, optional)
- events (array, optional)
- unresolved (array, optional)
- issues (array, optional)
- regime (string, optional)
- logical_date (string,null, optional)
- applicability_wave (string,null, optional)
- cutoff_timezone_reading (string, optional)
- cutoff_disclosure (string, optional)
- rule_version (string,null, optional)
- source_digests (array, optional)
- disclosures (array, optional)
- evidence_labels (object, optional)
- note (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `check_allocation_affirmation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
