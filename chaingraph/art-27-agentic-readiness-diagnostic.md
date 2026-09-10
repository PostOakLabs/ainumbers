# Agentic Payments Readiness Diagnostic

12-question scored diagnostic: graded A–F across policy & mandates, protocol formalisation, financial-crime controls, and MCP runtime operations. Single-node ChainGraph (chain_depth: 0). Promoted from guides/agentic-readiness-diagnostic.html.

- Page: https://ainumbers.co/chaingraph/art-27-agentic-readiness-diagnostic.html
- Markdown twin: https://ainumbers.co/chaingraph/art-27-agentic-readiness-diagnostic.md
- MCP tool: run_agentic_readiness_diagnostic (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "q1": "yes",
  "q2": "yes",
  "q3": "yes",
  "q4": "yes",
  "q5": "yes",
  "q6": "yes",
  "q7": "yes",
  "q8": "yes",
  "q9": "yes",
  "q10": "yes",
  "q11": "yes",
  "q12": "yes"
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_agentic_readiness_diagnostic` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
