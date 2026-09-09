# Crypto-Asset Whitepaper Linter (iXBRL)

Validates Art 6/8 whitepaper: Annex I section completeness + iXBRL/XHTML well-formedness + ESMA MiCA taxonomy structural conformance (ITS 2024/2984). Section gaps + non-compliance-register risk.

- Page: https://ainumbers.co/chaingraph/art-102-crypto-asset-whitepaper-linter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-102-crypto-asset-whitepaper-linter.md
- MCP tool: lint_crypto_asset_whitepaper (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- inputs (unknown, optional)

## Outputs

- annex_i_gaps (array, optional)
- conformance_grade (string, optional)
- ixbrl_valid (boolean, optional)
- note (string, optional)
- reference_version (string, optional)
- sections_checked (integer, optional)
- taxonomy_conformant (boolean, optional)
- taxonomy_note (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_crypto_asset_whitepaper` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
