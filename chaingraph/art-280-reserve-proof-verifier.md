# Reserve Proof Verifier

Verifies a Merkle-sum Proof-of-Reserves customer-inclusion proof (OKX, Binance, Gate, Kraken export formats, or a generic canonical shape) against a declared root, and checks a Chainlink PoR / NAVLink aggregator round for staleness and deviation. Part of the Reserve Verification Family alongside check_genius_reserve_disclosure (art-275). Composes with verify_eth_state_proof (VR-1) when an on-chain storage proof is available. Records what is NOT proven: liabilities completeness, off-balance-sheet encumbrances, and point-in-time-only scope. Not a PCAOB audit.

- Page: https://ainumbers.co/chaingraph/art-280-reserve-proof-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-280-reserve-proof-verifier.md
- MCP tool: verify_reserve_proof (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- exchange (unknown, optional)
- merkle_proof (unknown, required)
- por_round (unknown, optional)
- storage_proof_composition (unknown, optional)

## Outputs

- computed_leaf_hash (string, optional)
- computed_root (object, optional)
- declared_root (object, optional)
- exchange (string, optional)
- inclusion_verified (boolean, optional)
- not_proven (array, optional)
- por_round (string, optional)
- regulatory_framework (string, optional)
- reserve_proof_determination (string, optional)
- root_hash_match (boolean, optional)
- storage_proof_composition (object, optional)
- structural_error (string, optional)
- sum_verified (boolean, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_reserve_proof` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
