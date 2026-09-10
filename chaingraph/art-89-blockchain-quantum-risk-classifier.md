# Blockchain / Stablecoin Quantum-Risk Classifier

Classifies quantum-exposure risk for blockchain/stablecoin assets: exposed public-key percentage, address reuse, and migration-path maturity (BIP-360/XRPL/Ethereum roadmaps). Reuses CBOM inventory from tool 499. Ties PQC to the suite's stablecoin/tokenization clusters.

- Page: https://ainumbers.co/chaingraph/art-89-blockchain-quantum-risk-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-89-blockchain-quantum-risk-classifier.md
- MCP tool: classify_blockchain_quantum_risk (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- asset_type (unknown, optional)
- chain (unknown, optional)

## Outputs

- address_reuse_pct (integer, optional)
- asset_type (string, optional)
- bip360_status (string, optional)
- exposed_pct (integer, optional)
- exposure_thresholds (object, optional)
- migration_readiness (string, optional)
- note (string, optional)
- quantum_risk_tier (string, optional)
- reference_version (string, optional)
- reuse_risk (string, optional)
- roadmap_ref (object, optional)
- signature_scheme (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_blockchain_quantum_risk` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
