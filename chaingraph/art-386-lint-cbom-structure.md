# CBOM Structural Lint & CNSA-2.0 Classifier

Validates a pasted CycloneDX 1.6 Cryptography Bill of Materials against a hand-derived field subset (algorithm, key size, certification level, crypto functions) and classifies declared algorithm assets as quantum-vulnerable (RSA, ECDSA/ECDH, DH, SHA-1) or CNSA-2.0 target-aligned (ML-KEM-1024, ML-DSA-87, AES-256, SHA-384/512). Structural and classification checks only; every finding asserted from the pasted CBOM. Not a scanner, not discovery, not a cryptographic audit.

- Page: https://ainumbers.co/chaingraph/art-386-lint-cbom-structure.html
- Markdown twin: https://ainumbers.co/chaingraph/art-386-lint-cbom-structure.md
- MCP tool: lint_cbom_structure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- cbom (unknown, required)

## Outputs

- cbom_structurally_valid (boolean, optional)
- cnsa2_ready_count (integer, optional)
- compliance_flags (array, optional)
- data_version (string, optional)
- findings (array, optional)
- structural_issues (array, optional)
- structurally_invalid_count (integer, optional)
- total_algorithm_assets (integer, optional)
- total_components (integer, optional)
- unclassified_count (integer, optional)
- verdict (string, optional)
- vulnerable_count (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_cbom_structure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
