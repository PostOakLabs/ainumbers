# EUDR Supply-Chain Traceability Linker

Validate EUDR single-DDS rule compliance and supply-chain traceability: first operators file the DDS; downstream operators reference upstream DDS reference numbers from TRACES NT. Checks single-DDS rule, TRACES NT reference format validity, plot geolocation coverage, and custody-chain completeness. Returns chain_integrity verdict and traceability_gaps list. Feeds readiness diagnostic (art-170). Zero network, zero PII. Reg. EU 2023/1115 Art. 4.

- Page: https://ainumbers.co/chaingraph/art-169-eudr-supply-chain-traceability-linker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-169-eudr-supply-chain-traceability-linker.md
- MCP tool: link_eudr_supply_chain_traceability (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- supply_chain (unknown, optional)

## Outputs

- chain_integrity (boolean, optional)
- custody_chain_complete (boolean, optional)
- linked_dds_count (integer, optional)
- operator_is_first (boolean, optional)
- plot_geolocation_present (boolean, optional)
- refs_valid (string, optional)
- single_dds_rule_met (boolean, optional)
- traceability_gaps (array, optional)

## Sample

```json
{
  "supply_chain": {
    "operator_is_first": true,
    "upstream_dds_refs": [],
    "plot_geolocation_present": true,
    "custody_chain_complete": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `link_eudr_supply_chain_traceability` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
