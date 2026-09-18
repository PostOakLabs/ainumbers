# Cross-Network Atomic Settlement Validator

Validates atomic settlement across two or more networks: cash leg final on the money ledger, asset leg delivered on the asset ledger, FX leg PvP where present. Detects finality mismatch across legs, non-atomic cross-network risk, and PvP gaps per CPMI-IOSCO PFMI Principles 8 + 12. Models BIS Agorá unifying-ledger, ECB Pontes TARGET-link, and DTCC Collateral AppChain coordination patterns. Distinct from Canton single-network DvP.

- Page: https://ainumbers.co/chaingraph/art-58-cross-network-settlement-validator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-58-cross-network-settlement-validator.md
- MCP tool: validate_cross_network_settlement (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- coordination_mechanism (any, optional): type not evidenced by kernel source
- legs (any, optional): type not evidenced by kernel source
- networks (any, optional): type not evidenced by kernel source
- pvp_required (any, optional): type not evidenced by kernel source
- rollback_supported (any, optional): type not evidenced by kernel source
- timeout_window_sec (any, optional): type not evidenced by kernel source

## Outputs

- atomicity_verdict (string, optional)
- coordination_recommendation (string, optional)
- leg_findings (array, optional)
- note (string, optional)
- pvp_check (string, optional)
- residual_exposure (string, optional)
- settlement_risk_window_sec (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `validate_cross_network_settlement` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
