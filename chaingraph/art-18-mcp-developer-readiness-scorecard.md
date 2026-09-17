# MCP Developer Readiness Scorecard

Rolls up caller-supplied yes/partial/no answers across six MCP ship-readiness sections (tool definitions, server.json/registry, OAuth 2.1, transport security, tool-poisoning hygiene, spec-revision compliance) into an overall 0-100 score and a prioritized gap list. Stage 4 (terminal) of the Agentic Policy Chain. Self-reported rollup; validate each weak section with its own deep-dive tool. Deterministic, zero PII.

- Page: https://ainumbers.co/chaingraph/art-18-mcp-developer-readiness-scorecard.html
- Markdown twin: https://ainumbers.co/chaingraph/art-18-mcp-developer-readiness-scorecard.md
- MCP tool: score_mcp_server_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- answers (object, optional)

## Outputs

- answers_used (object, optional)
- gaps (array, optional)
- gaps_count (integer, optional)
- note (string, optional)
- overall (integer, optional)
- sections (array, optional)
- verdict (string, optional)

## Sample

```json
{
  "answers": {
    "tooldef_schema": "yes",
    "tooldef_desc": "yes",
    "tooldef_ann": "yes",
    "serverjson_name": "yes",
    "serverjson_meta": "yes",
    "serverjson_pkg": "yes",
    "oauth_prm": "yes",
    "oauth_aud": "yes",
    "oauth_pass": "yes",
    "transport_origin": "yes",
    "transport_bind": "yes",
    "poison_clean": "yes",
    "poison_trust": "yes",
    "spec_rev": "yes",
    "spec_stateless": "yes"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `score_mcp_server_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
