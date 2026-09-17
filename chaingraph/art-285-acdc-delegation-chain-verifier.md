# ACDC Delegation Chain Verifier

Verifies a chain of Authentic Chained Data Containers (ACDC): per-credential SAID self-addressing integrity, issuer-to-issuee edge linkage between successive credentials, schema SAID match, termination at a stated root AID, and revocation-status passthrough (report, never resolve). KERI/ACDC/CESR ratified by the Trust over IP Foundation, January 2026. Verify-only; JSON-serialized ACDCs only, CESR binary streams not yet accepted.

- Page: https://ainumbers.co/chaingraph/art-285-acdc-delegation-chain-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-285-acdc-delegation-chain-verifier.md
- MCP tool: verify_acdc_delegation_chain (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- credentials (array, required)
- expected_root_aid (unknown, optional)
- max_chain_depth (number, required)

## Outputs

- chain_depth (integer, optional)
- edge_failures (array, optional)
- revocation_status_reported (array, optional)
- root_aid_matched (boolean, optional)
- said_failures (array, optional)
- valid (boolean, optional)

## Sample

```json
{
  "credentials": [
    {
      "v": "ACDC10JSON",
      "i": "EAleaf000000000000000000000000000000000000000",
      "ri": "ERegistryLeaf00000000000000000000000000000000",
      "s": "ESchemaKYAAgentDelegation000000000000000000000",
      "a": {
        "i": "agent-alpha",
        "dt": "2026-01-10T00:00:00Z",
        "scopes": [
          "execute:trade"
        ]
      },
      "e": {
        "d": "EEdgeBlockLeaf00000000000000000000000000000000",
        "auth": {
          "n": "4e73ab65b5464c273bf2cdd23c3f779900d8c165f7ce7770aba8d478364cfdef",
          "s": "ESchemaKYAAgentDelegation000000000000000000000"
        }
      },
      "d": "233755f557351c47dfbfed014dcbcecb4ec8108a096536665976d5f56d09a6c3"
    },
    {
      "v": "ACDC10JSON",
      "i": "EAmid00000000000000000000000000000000000000000",
      "ri": "ERegistryMid00000000000000000000000000000000",
      "s": "ESchemaKYAAgentDelegation000000000000000000000",
      "a": {
        "i": "EAleaf000000000000000000000000000000000000000",
        "dt": "2026-01-05T00:00:00Z",
        "role": "delegate"
      },
      "e": {
        "d": "EEdgeBlockMid000000000000000000000000000000000",
        "auth": {
          "n": "dc87883132b9e2b6ba1938ff72d561ebbf5b514fb11a442dbf07b2fad36438e4",
          "s": "ESchemaKYAAgentDelegation000000000000000000000"
        }
      },
      "d": "4e73ab65b5464c273bf2cdd23c3f779900d8c165f7ce7770aba8d478364cfdef"
    },
    {
      "v": "ACDC10JSON",
      "i": "EAroot0000000000000000000000000000000000000000",
      "ri": "ERegistryRoot0000000000000000000000000000000",
      "s": "ESchemaKYAAgentDelegation000000000000000000000",
      "a": {
        "i": "EAmid00000000000000000000000000000000000000000",
        "dt": "2026-01-01T00:00:00Z",
        "role": "delegate-authority"
      },
      "d": "dc87883132b9e2b6ba1938ff72d561ebbf5b514fb11a442dbf07b2fad36438e4"
    }
  ],
  "expected_root_aid": "EAroot0000000000000000000000000000000000000000"
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_acdc_delegation_chain` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
