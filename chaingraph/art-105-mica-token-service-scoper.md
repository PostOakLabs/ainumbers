# MiCA Token & Service Scoper

Disambiguation router classifying a case as ART/EMT-issuer (delegated to existing stablecoin-compliance chains) vs CASP-service (MiCA chains). Prevents Title III/IV vs Title V overlap; packages the MiCA suite.

- Page: https://ainumbers.co/chaingraph/art-105-mica-token-service-scoper.html
- Markdown twin: https://ainumbers.co/chaingraph/art-105-mica-token-service-scoper.md
- MCP tool: scope_mica_token_and_service (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- inputs (unknown, optional)

## Outputs

- classification (string, optional)
- delegated_to_existing (boolean, optional)
- existing_chains_delegated (array, optional)
- mica_note (string, optional)
- rationale (string, optional)
- reference_version (string, optional)
- route_target (string, optional)
- wave20_chains_applicable (array, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `scope_mica_token_and_service` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
